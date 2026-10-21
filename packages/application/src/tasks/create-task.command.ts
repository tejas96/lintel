import { domainEvent, type TaskPriority } from '@lintel/domain';
import { ForbiddenError } from '@lintel/shared';
import { ProjectAccessService } from '../access/project-access.service';
import type { RequestContext } from '../common/request-context';
import type { OperationsDependencies, OperationsStores } from './operations-context';
import { admitToProject } from './project-admission';
import type { TaskRecord } from './task.store';
import { notifyAboutTask, quoted, recordTaskChange } from './task-records';
import { deadlineText } from './task-schedule-records';
import {
  assertActivePeople,
  assertDateOrder,
  assertDueTime,
  assertReferencesInProject,
  assertReviewerIsNotOwner,
} from './task-validation';

export interface CreateTaskInput {
  readonly projectId: string;
  readonly stageId: string | null;
  readonly milestoneId: string | null;
  readonly parentTaskId: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly priority: TaskPriority;
  readonly ownerUserId: string | null;
  readonly reviewerUserId: string | null;
  readonly collaboratorUserIds: readonly string[];
  readonly plannedStartDate: string | null;
  readonly dueDate: string | null;
  /** Optional "HH:mm" in the business timezone; needs a due date. */
  readonly dueTime?: string | null;
  readonly estimateMinutes: number | null;
  readonly requiresReview: boolean;
  readonly completionCriteria: string | null;
  readonly checklist: readonly { readonly label: string; readonly isRequired: boolean }[];
  /** Created as "ready" when an owner and due date are set; otherwise as a draft. */
  readonly publish: boolean;
}

/** Adds a task to a project. Only people who manage or assign work in the project may do this. */
export class CreateTaskCommand {
  constructor(private readonly deps: OperationsDependencies) {}

  async execute(context: RequestContext, input: CreateTaskInput): Promise<TaskRecord> {
    const actor = context.actor;
    return this.deps.uow.transaction(async (stores) => {
      const access = await new ProjectAccessService(stores.access).requireView(
        actor,
        input.projectId,
      );
      if (!access.canManage && !access.canAssign && !actor.capabilities.has('tasks.manage_any')) {
        throw new ForbiddenError('Only the project manager can add tasks to this project.');
      }
      const collaborators = [...new Set(input.collaboratorUserIds)].filter(
        (id) => id !== input.ownerUserId,
      );
      await this.validate(stores, input, collaborators);
      const status = input.publish && input.ownerUserId && input.dueDate ? 'ready' : 'draft';
      const task = await stores.tasks.create({
        projectId: input.projectId,
        stageId: input.stageId,
        milestoneId: input.milestoneId,
        parentTaskId: input.parentTaskId,
        title: input.title,
        description: input.description,
        status,
        priority: input.priority,
        ownerUserId: input.ownerUserId,
        reviewerUserId: input.reviewerUserId,
        plannedStartDate: input.plannedStartDate,
        dueDate: input.dueDate,
        dueTime: input.dueTime ?? null,
        baselineDueDate: status === 'ready' ? input.dueDate : null,
        estimateMinutes: input.estimateMinutes,
        requiresReview: input.requiresReview,
        completionCriteria: input.completionCriteria,
        createdByUserId: actor.userId,
      });
      await admitToProject(stores, access, task.projectId, [
        input.ownerUserId,
        input.reviewerUserId,
        ...collaborators,
      ]);
      await this.addCollaboratorsAndChecklist(stores, task, input, collaborators);
      await recordTaskChange(stores.records, context, task, {
        action: 'task.created',
        summary: `Created task #${task.number} ${quoted(task.title)}.`,
        after: { status, ownerUserId: task.ownerUserId, dueDate: task.dueDate },
      });
      if (status === 'ready') await this.announce(stores, context, task, collaborators);
      return task;
    });
  }

  private async addCollaboratorsAndChecklist(
    stores: OperationsStores,
    task: TaskRecord,
    input: CreateTaskInput,
    collaborators: readonly string[],
  ): Promise<void> {
    if (collaborators.length > 0) await stores.tasks.replaceCollaborators(task.id, collaborators);
    if (input.checklist.length > 0) {
      await stores.taskItems.addChecklistItems(task.id, input.checklist);
    }
  }

  /** A published task is a real commitment: tell the owner and collaborators, start reminders. */
  private async announce(
    stores: OperationsStores,
    context: RequestContext,
    task: TaskRecord,
    collaborators: readonly string[],
  ): Promise<void> {
    if (!task.ownerUserId) return;
    const notifier = await this.deps.context.notifierFor(stores);
    await notifyAboutTask(notifier, context.actor.userId, task, 'created', [
      {
        kind: 'task_assigned',
        recipientUserId: task.ownerUserId,
        title: `New task: ${quoted(task.title)}`,
        body: task.dueDate ? `Due ${deadlineText(task)}.` : 'A task was assigned to you.',
      },
      ...collaborators.map((userId) => ({
        kind: 'task_assigned' as const,
        recipientUserId: userId,
        title: `You were added to ${quoted(task.title)}`,
        body: 'You are a collaborator on this task.',
      })),
    ]);
    await stores.records.enqueueEvent(
      domainEvent('TaskAssigned', 'task', task.id, {
        taskId: task.id,
        projectId: task.projectId,
        ownerId: task.ownerUserId,
        assignedBy: context.actor.userId,
      }),
    );
  }

  private async validate(
    stores: OperationsStores,
    input: CreateTaskInput,
    collaborators: readonly string[],
  ): Promise<void> {
    await assertReferencesInProject(stores, input.projectId, {
      stageId: input.stageId,
      milestoneId: input.milestoneId,
      taskId: input.parentTaskId,
    });
    await assertActivePeople(stores, [
      { field: 'ownerUserId', userId: input.ownerUserId },
      { field: 'reviewerUserId', userId: input.reviewerUserId },
      ...collaborators.map((userId) => ({ field: 'collaboratorUserIds', userId })),
    ]);
    assertReviewerIsNotOwner(input.ownerUserId, input.reviewerUserId);
    assertDateOrder(input.plannedStartDate, input.dueDate);
    assertDueTime(input.dueDate, input.dueTime ?? null);
  }
}
