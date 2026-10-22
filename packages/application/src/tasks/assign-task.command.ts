import { domainEvent } from '@lintel/domain';
import { ForbiddenError, formatCalendarDateWords, StaleVersionError } from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import type {
  OperationsContext,
  OperationsDependencies,
  OperationsStores,
} from './operations-context';
import { admitToProject } from './project-admission';
import type { TaskRecord } from './task.store';
import { type LoadedTask, loadTaskForActor } from './task-loader';
import { notifyAboutTask, quoted, recordTaskChange } from './task-records';
import { assertActivePeople, assertReviewerIsNotOwner } from './task-validation';

function assertCanAssign(loaded: LoadedTask): void {
  if (!loaded.access.canAssign && !loaded.relation.canManage) {
    throw new ForbiddenError('You cannot assign work in this project.');
  }
}

export interface AssignTaskInput {
  readonly ownerUserId: string;
  readonly reason: string | null;
  readonly version: number;
}

/**
 * Sets or changes a task's accountable owner inside the caller's transaction:
 * checks the right to assign, admits the person to the project, audits the
 * change, notifies the new and previous owner and starts reminders. Shared by
 * direct assignment and accepted reassignment requests.
 */
export async function assignTaskOwner(
  stores: OperationsStores,
  operations: OperationsContext,
  context: RequestContext,
  taskId: string,
  input: AssignTaskInput,
): Promise<TaskRecord> {
  const loaded = await loadTaskForActor(stores, context.actor, taskId, true);
  const { task } = loaded;
  assertCanAssign(loaded);
  if (task.version !== input.version) throw new StaleVersionError('This task');
  await assertActivePeople(stores, [{ field: 'ownerUserId', userId: input.ownerUserId }]);
  assertReviewerIsNotOwner(input.ownerUserId, task.reviewerUserId);
  if (task.ownerUserId === input.ownerUserId) return task;
  await admitToProject(stores, loaded.access, task.projectId, [input.ownerUserId]);
  if (loaded.collaboratorUserIds.includes(input.ownerUserId)) {
    await stores.tasks.replaceCollaborators(
      task.id,
      loaded.collaboratorUserIds.filter((id) => id !== input.ownerUserId),
    );
  }
  const after = await stores.tasks.update(task.id, input.version, {
    ownerUserId: input.ownerUserId,
    acknowledgedAt: null,
  });
  if (!after) throw new StaleVersionError('This task');
  await recordTaskChange(stores.records, context, after, {
    action: 'task.assigned',
    summary: `Assigned ${quoted(after.title)} to a new owner.`,
    before: { ownerUserId: task.ownerUserId },
    after: { ownerUserId: input.ownerUserId, reason: input.reason },
  });
  const notifier = await operations.notifierFor(stores);
  const reason = input.reason ? ` Reason: ${input.reason}` : '';
  await notifyAboutTask(notifier, context.actor.userId, after, `v${after.version}`, [
    {
      kind: 'task_assigned',
      recipientUserId: input.ownerUserId,
      title: `New task: ${quoted(after.title)}`,
      body: `${after.dueDate ? `Due ${formatCalendarDateWords(after.dueDate)}.` : 'A task was assigned to you.'}${reason}`,
    },
    {
      kind: 'task_reassigned',
      recipientUserId: task.ownerUserId,
      title: `${quoted(after.title)} was reassigned`,
      body: `Someone else now owns this task.${reason}`,
    },
  ]);
  await stores.records.enqueueEvent(
    domainEvent('TaskAssigned', 'task', after.id, {
      taskId: after.id,
      projectId: after.projectId,
      ownerId: input.ownerUserId,
      assignedBy: context.actor.userId,
    }),
  );
  return after;
}

/** Ownership, collaborators and acknowledgement of a task. */
export class AssignTaskCommands {
  constructor(private readonly deps: OperationsDependencies) {}

  async assign(
    context: RequestContext,
    taskId: string,
    input: AssignTaskInput,
  ): Promise<TaskRecord> {
    return this.deps.uow.transaction((stores) =>
      assignTaskOwner(stores, this.deps.context, context, taskId, input),
    );
  }

  async setCollaborators(
    context: RequestContext,
    taskId: string,
    userIds: readonly string[],
  ): Promise<void> {
    const now = this.deps.clock.now();
    await this.deps.uow.transaction(async (stores) => {
      const loaded = await loadTaskForActor(stores, context.actor, taskId, true);
      const { task } = loaded;
      assertCanAssign(loaded);
      const next = [...new Set(userIds)].filter((id) => id !== task.ownerUserId);
      await assertActivePeople(
        stores,
        next.map((userId) => ({ field: 'userIds', userId })),
      );
      await admitToProject(stores, loaded.access, task.projectId, next);
      await stores.tasks.replaceCollaborators(task.id, next);
      const added = next.filter((id) => !loaded.collaboratorUserIds.includes(id));
      const removed = loaded.collaboratorUserIds.filter((id) => !next.includes(id));
      if (added.length === 0 && removed.length === 0) return;
      await recordTaskChange(stores.records, context, task, {
        action: 'task.collaborators_changed',
        summary: `Changed the collaborators on ${quoted(task.title)}.`,
        before: { collaboratorUserIds: [...loaded.collaboratorUserIds] },
        after: { collaboratorUserIds: next },
      });
      const notifier = await this.deps.context.notifierFor(stores);
      await notifyAboutTask(
        notifier,
        context.actor.userId,
        task,
        `collaborators:${now.getTime()}`,
        added.map((userId) => ({
          kind: 'task_assigned' as const,
          recipientUserId: userId,
          title: `You were added to ${quoted(task.title)}`,
          body: 'You are a collaborator on this task.',
        })),
      );
    });
  }

  /** The owner confirms they have seen the assignment. Repeating it changes nothing. */
  async acknowledge(context: RequestContext, taskId: string): Promise<TaskRecord> {
    const now = this.deps.clock.now();
    return this.deps.uow.transaction(async (stores) => {
      const loaded = await loadTaskForActor(stores, context.actor, taskId, true);
      const { task } = loaded;
      if (!loaded.relation.isTaskOwner) {
        throw new ForbiddenError('Only the task owner can acknowledge it.');
      }
      if (task.acknowledgedAt) return task;
      const after = await stores.tasks.update(task.id, task.version, { acknowledgedAt: now });
      if (!after) throw new StaleVersionError('This task');
      await recordTaskChange(stores.records, context, after, {
        action: 'task.acknowledged',
        summary: `Acknowledged ${quoted(after.title)}.`,
        after: { acknowledgedAt: now.toISOString() },
      });
      return after;
    });
  }
}
