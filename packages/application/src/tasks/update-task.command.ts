import type { TaskActorRelation, TaskPriority } from '@lintel/domain';
import {
  definedOnly,
  ForbiddenError,
  type Patch,
  StaleVersionError,
  ValidationFailedError,
} from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import type { OperationsDependencies, OperationsStores } from './operations-context';
import { admitToProject } from './project-admission';
import type { TaskChanges, TaskRecord } from './task.store';
import type { LoadedTask } from './task-loader';
import { loadTaskForActor } from './task-loader';
import { notifyAboutTask, quoted, recordTaskChange } from './task-records';
import { deadlineText, enqueueDeadlineReload, recordScheduleChange } from './task-schedule-records';
import {
  assertActivePeople,
  assertDateOrder,
  assertDueTime,
  assertEscalationDelay,
  assertReferencesInProject,
  assertReviewerIsNotOwner,
} from './task-validation';

export interface EditableTaskFields {
  readonly title: string;
  readonly description: string | null;
  readonly priority: TaskPriority;
  readonly reviewerUserId: string | null;
  readonly plannedStartDate: string | null;
  readonly dueDate: string | null;
  /** "HH:mm" in the business timezone; null = the end of the working day. */
  readonly dueTime: string | null;
  readonly estimateMinutes: number | null;
  readonly requiresReview: boolean;
  readonly completionCriteria: string | null;
  readonly milestoneId: string | null;
  readonly stageId: string | null;
  /** Working days overdue before the project manager is alerted. */
  readonly escalateAfterOverdueDays: number;
}

export interface UpdateTaskInput {
  readonly version: number;
  readonly changes: Patch<EditableTaskFields>;
  /** Required when a committed due date or time moves; kept in the schedule history. */
  readonly scheduleChangeReason?: string | undefined;
}

/** Fields only a project manager may change; the owner may edit the rest. */
const MANAGER_FIELDS: readonly (keyof EditableTaskFields)[] = [
  'priority',
  'reviewerUserId',
  'requiresReview',
  'milestoneId',
  'stageId',
  'escalateAfterOverdueDays',
];

/** Changes the deadline workflow must re-plan for (it re-reads the task when signalled). */
const DEADLINE_PLAN_FIELDS: readonly (keyof EditableTaskFields)[] = [
  'priority',
  'escalateAfterOverdueDays',
  'plannedStartDate',
  'dueTime',
];

function changedFields(task: TaskRecord, changes: Partial<EditableTaskFields>): TaskChanges {
  // Clearing the due date clears its time too.
  const withTime = changes.dueDate === null ? { ...changes, dueTime: null } : changes;
  const entries = Object.entries(withTime).filter(
    ([key, value]) => task[key as keyof EditableTaskFields] !== value,
  );
  return Object.fromEntries(entries) as TaskChanges;
}

/** The deadline (date or time) of a task that is no longer a draft moves. */
function committedDeadlineMoves(task: TaskRecord, changes: TaskChanges): boolean {
  return task.status !== 'draft' && ('dueDate' in changes || 'dueTime' in changes);
}

function assertEditRights(relation: TaskActorRelation, changes: TaskChanges): void {
  if (!relation.canManage && !relation.isTaskOwner) {
    throw new ForbiddenError('Only the task owner or the project manager can edit this task.');
  }
  const managerOnly = MANAGER_FIELDS.filter((field) => field in changes);
  if (managerOnly.length > 0 && !relation.canManage) {
    throw new ForbiddenError(`Only the project manager can change: ${managerOnly.join(', ')}.`);
  }
}

/** Edits task details. Moving a committed due date needs a manager and a recorded reason. */
export class UpdateTaskCommand {
  constructor(private readonly deps: OperationsDependencies) {}

  async execute(
    context: RequestContext,
    taskId: string,
    input: UpdateTaskInput,
  ): Promise<TaskRecord> {
    return this.deps.uow.transaction(async (stores) => {
      const loaded = await loadTaskForActor(stores, context.actor, taskId, true);
      const { task, relation } = loaded;
      if (task.version !== input.version) throw new StaleVersionError('This task');
      const changes = changedFields(task, definedOnly(input.changes));
      assertEditRights(relation, changes);
      if (Object.keys(changes).length === 0) return task;
      const dueDateMoves = committedDeadlineMoves(task, changes);
      if (dueDateMoves) this.assertScheduleChange(loaded, changes, input.scheduleChangeReason);
      await this.validate(stores, task, changes);
      if (changes.reviewerUserId) {
        await admitToProject(stores, loaded.access, task.projectId, [changes.reviewerUserId]);
      }
      const after = await stores.tasks.update(task.id, input.version, changes);
      if (!after) throw new StaleVersionError('This task');
      if (dueDateMoves) {
        await recordScheduleChange(stores, context, task, after, input.scheduleChangeReason ?? '');
      } else if (DEADLINE_PLAN_FIELDS.some((field) => field in changes)) {
        await enqueueDeadlineReload(stores, after);
      }
      await recordTaskChange(stores.records, context, after, {
        action: 'task.updated',
        summary: `Updated ${Object.keys(changes).join(', ')} on ${quoted(after.title)}.`,
        before: Object.fromEntries(
          Object.keys(changes).map((key) => [key, task[key as keyof TaskRecord]]),
        ),
        after: { ...changes, scheduleChangeReason: input.scheduleChangeReason ?? null },
      });
      await this.notify(stores, context, task, after, dueDateMoves, input.scheduleChangeReason);
      return after;
    });
  }

  private assertScheduleChange(
    loaded: LoadedTask,
    changes: TaskChanges,
    reason: string | undefined,
  ): void {
    if (!loaded.relation.canManage) {
      throw new ForbiddenError('Only the project manager can move a committed deadline.');
    }
    if (!reason) {
      throw new ValidationFailedError('Explain why the committed deadline moves.', [
        { field: 'scheduleChangeReason', message: 'Add the reason for the new deadline.' },
      ]);
    }
    const isOpen = loaded.task.status !== 'done' && loaded.task.status !== 'cancelled';
    if (changes.dueDate === null && isOpen) {
      throw new ValidationFailedError('A committed task needs a due date.', [
        { field: 'dueDate', message: 'Choose a date instead of clearing it.' },
      ]);
    }
  }

  private async validate(
    stores: OperationsStores,
    task: TaskRecord,
    changes: TaskChanges,
  ): Promise<void> {
    await assertReferencesInProject(stores, task.projectId, {
      stageId: changes.stageId,
      milestoneId: changes.milestoneId,
    });
    if (changes.reviewerUserId) {
      await assertActivePeople(stores, [
        { field: 'reviewerUserId', userId: changes.reviewerUserId },
      ]);
    }
    assertReviewerIsNotOwner(task.ownerUserId, changes.reviewerUserId ?? task.reviewerUserId);
    if (changes.escalateAfterOverdueDays !== undefined) {
      assertEscalationDelay(changes.escalateAfterOverdueDays);
    }
    const dueDate = changes.dueDate !== undefined ? changes.dueDate : task.dueDate;
    assertDateOrder(
      changes.plannedStartDate !== undefined ? changes.plannedStartDate : task.plannedStartDate,
      dueDate,
    );
    assertDueTime(dueDate, changes.dueTime !== undefined ? changes.dueTime : task.dueTime);
  }

  private async notify(
    stores: OperationsStores,
    context: RequestContext,
    before: TaskRecord,
    after: TaskRecord,
    dueDateMoved: boolean,
    reason: string | undefined,
  ): Promise<void> {
    const lines: string[] = [];
    if (dueDateMoved) {
      lines.push(`Due ${deadlineText(before)} is now ${deadlineText(after)}: ${reason ?? ''}`);
    }
    if (before.priority !== after.priority) {
      lines.push(`Priority changed from ${before.priority} to ${after.priority}.`);
    }
    const reviewerChanged = before.reviewerUserId !== after.reviewerUserId;
    if (lines.length === 0 && !(reviewerChanged && after.status === 'in_review')) return;
    const notifier = await this.deps.context.notifierFor(stores);
    await notifyAboutTask(notifier, context.actor.userId, after, `v${after.version}`, [
      ...(lines.length > 0
        ? [
            {
              kind: 'priority_changed' as const,
              recipientUserId: after.ownerUserId,
              title: `${quoted(after.title)} changed`,
              body: lines.join(' '),
            },
          ]
        : []),
      ...(reviewerChanged && after.status === 'in_review'
        ? [
            {
              kind: 'review_requested' as const,
              recipientUserId: after.reviewerUserId,
              title: `Review requested: ${quoted(after.title)}`,
              body: 'You are now the reviewer of this submitted task.',
            },
          ]
        : []),
    ]);
  }
}
