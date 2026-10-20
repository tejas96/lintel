import { notificationDedupeKey } from '@lintel/domain';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationFailedError,
} from '@lintel/shared';
import { ProjectAccessService } from '../access/project-access.service';
import type { RequestContext } from '../common/request-context';
import type { Notifier } from '../notifications/notifier';
import type { OperationsDependencies } from '../tasks/operations-context';
import { loadTaskForActor } from '../tasks/task-loader';

async function notifyConflict(
  notifier: Notifier,
  recipients: readonly (string | null)[],
  actorUserId: string,
  conflictId: string,
  message: { title: string; body: string; window: string },
): Promise<void> {
  const unique = [...new Set(recipients)].filter(
    (id): id is string => id !== null && id !== actorUserId,
  );
  for (const recipientUserId of unique) {
    await notifier.notify({
      recipientUserId,
      kind: 'priority_changed',
      title: message.title,
      body: message.body,
      linkPath: `/priority-conflicts/${conflictId}`,
      subjectType: 'priority_conflict',
      subjectId: conflictId,
      dedupeKey: notificationDedupeKey({
        kind: 'priority_changed',
        recipientId: recipientUserId,
        subjectId: conflictId,
        window: message.window,
      }),
    });
  }
}

/** A person tells managers that commitments clash; a manager of an involved project decides. */
export class PriorityConflictCommands {
  constructor(private readonly deps: OperationsDependencies) {}

  async raise(
    context: RequestContext,
    taskIds: readonly string[],
    note: string,
  ): Promise<{ id: string }> {
    const ids = [...new Set(taskIds)];
    if (ids.length < 2) {
      throw new ValidationFailedError('Choose at least two different tasks.', [
        { field: 'taskIds', message: 'Pick two or more tasks that clash.' },
      ]);
    }
    const actor = context.actor;
    return this.deps.uow.transaction(async (stores) => {
      const loaded = [];
      for (const id of ids) loaded.push(await loadTaskForActor(stores, actor, id, false));
      if (loaded.some(({ relation }) => !relation.isTaskOwner && !relation.isCollaborator)) {
        throw new ValidationFailedError(
          'You can only raise a conflict between tasks you work on.',
          [{ field: 'taskIds', message: 'Pick tasks you own or collaborate on.' }],
        );
      }
      const conflict = await stores.workSessions.createPriorityConflict({
        raisedByUserId: actor.userId,
        taskIds: ids,
        note,
      });
      const titles = loaded.map(({ task }) => `“${task.title}”`).join(', ');
      for (const projectId of new Set(loaded.map(({ task }) => task.projectId))) {
        await stores.records.appendActivity({
          projectId,
          taskId: null,
          actorUserId: actor.userId,
          type: 'work.priority_conflict_raised',
          summary: `Raised a priority conflict between ${titles}.`,
          payload: { conflictId: conflict.id, taskIds: ids },
        });
      }
      await stores.records.appendAudit({
        actorUserId: actor.userId,
        action: 'work.priority_conflict_raised',
        entityType: 'priority_conflict',
        entityId: conflict.id,
        after: { taskIds: ids, note },
        requestId: context.requestId,
      });
      const notifier = await this.deps.context.notifierFor(stores);
      await notifyConflict(
        notifier,
        loaded.map(({ access }) => access.managerUserId),
        actor.userId,
        conflict.id,
        { title: 'Priority conflict raised', body: `${titles}: ${note}`, window: 'raised' },
      );
      return conflict;
    });
  }

  async resolve(
    context: RequestContext,
    conflictId: string,
    resolution: string,
  ): Promise<{ id: string }> {
    const now = this.deps.clock.now();
    const actor = context.actor;
    return this.deps.uow.transaction(async (stores) => {
      const conflict = await stores.workSessions.findPriorityConflictForUpdate(conflictId);
      if (!conflict) throw new NotFoundError('Priority conflict');
      const accessService = new ProjectAccessService(stores.access);
      const projectIds = new Set<string>();
      for (const taskId of conflict.taskIds) {
        const task = await stores.tasks.find(taskId);
        if (task) projectIds.add(task.projectId);
      }
      const accesses = [];
      for (const projectId of projectIds) {
        accesses.push(await accessService.evaluate(actor, projectId));
      }
      if (!accesses.some((access) => access.canView)) throw new NotFoundError('Priority conflict');
      const canDecide =
        actor.capabilities.has('tasks.manage_any') || accesses.some((access) => access.canManage);
      if (!canDecide) {
        throw new ForbiddenError(
          'Only a manager of an involved project can resolve this conflict.',
        );
      }
      if (conflict.status === 'resolved') {
        throw new ConflictError('This priority conflict is already resolved.');
      }
      await stores.workSessions.resolvePriorityConflict(conflictId, {
        at: now,
        byUserId: actor.userId,
        note: resolution,
      });
      await stores.records.appendAudit({
        actorUserId: actor.userId,
        action: 'work.priority_conflict_resolved',
        entityType: 'priority_conflict',
        entityId: conflictId,
        before: { status: 'open' },
        after: { status: 'resolved', resolution },
        requestId: context.requestId,
      });
      for (const projectId of projectIds) {
        await stores.records.appendActivity({
          projectId,
          taskId: null,
          actorUserId: actor.userId,
          type: 'work.priority_conflict_resolved',
          summary: 'Resolved a priority conflict.',
          payload: { conflictId, resolution },
        });
      }
      const notifier = await this.deps.context.notifierFor(stores);
      await notifyConflict(notifier, [conflict.raisedByUserId], actor.userId, conflictId, {
        title: 'Priority conflict resolved',
        body: resolution,
        window: 'resolved',
      });
      return { id: conflictId };
    });
  }
}
