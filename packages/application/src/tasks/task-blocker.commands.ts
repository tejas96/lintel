import { domainEvent } from '@lintel/domain';
import { ConflictError, ForbiddenError, NotFoundError, StaleVersionError } from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import type { OperationsDependencies } from './operations-context';
import { decideFor } from './task-decision';
import type { BlockerCategory } from './task-item.store';
import { isParticipant, loadDecisionFacts, loadTaskForActor } from './task-loader';
import { notifyAboutTask, quoted, recordTaskChange } from './task-records';
import { performTransition } from './task-transition.service';
import { assertActivePeople } from './task-validation';

const CATEGORY_LABELS: Readonly<Record<BlockerCategory, string>> = {
  client: 'Waiting on the client',
  supplier: 'Waiting on a supplier',
  internal_dependency: 'Waiting on other work',
  manager_decision: 'Needs a manager decision',
  information: 'Missing information',
  other: 'Blocked',
};

export interface ReportBlockerInput {
  readonly category: BlockerCategory;
  readonly reason: string;
  readonly waitingOnUserId: string | null;
  readonly version: number;
}

/** Blocking a task says what it waits on; resolving can put it straight back to work. */
export class TaskBlockerCommands {
  constructor(private readonly deps: OperationsDependencies) {}

  async report(context: RequestContext, taskId: string, input: ReportBlockerInput): Promise<void> {
    const now = this.deps.clock.now();
    await this.deps.uow.transaction(async (stores) => {
      const loaded = await loadTaskForActor(stores, context.actor, taskId, true);
      const { task } = loaded;
      if (task.version !== input.version) throw new StaleVersionError('This task');
      await assertActivePeople(stores, [
        { field: 'waitingOnUserId', userId: input.waitingOnUserId },
      ]);
      const notifier = await this.deps.context.notifierFor(stores);
      if (task.status === 'blocked') {
        if (!isParticipant(loaded.relation)) {
          throw new ForbiddenError('Only the owner or a collaborator can do this.');
        }
      } else {
        const facts = await loadDecisionFacts(stores, loaded);
        await performTransition(stores, notifier, {
          context,
          facts,
          to: 'blocked',
          note: input.reason,
          expectedVersion: input.version,
          now,
        });
      }
      const blocker = await stores.taskItems.createBlocker({
        taskId,
        category: input.category,
        reason: input.reason,
        waitingOnUserId: input.waitingOnUserId,
        raisedByUserId: context.actor.userId,
      });
      await recordTaskChange(stores.records, context, task, {
        action: 'task.blocker_reported',
        summary: `${CATEGORY_LABELS[input.category]}: ${quoted(task.title)} is blocked.`,
        after: { blockerId: blocker.id, category: input.category, reason: input.reason },
      });
      await stores.records.enqueueEvent(
        domainEvent('TaskBlocked', 'task', task.id, {
          taskId: task.id,
          projectId: task.projectId,
          blockerId: blocker.id,
        }),
      );
      const notice = {
        kind: 'task_blocked' as const,
        title: `Blocked: ${quoted(task.title)}`,
        body: `${CATEGORY_LABELS[input.category]} — ${input.reason}`,
      };
      await notifyAboutTask(notifier, context.actor.userId, task, `blocker:${blocker.id}`, [
        { ...notice, recipientUserId: loaded.access.managerUserId },
        { ...notice, recipientUserId: input.waitingOnUserId },
      ]);
    });
  }

  /** Returns the task ID so the caller can show the updated task. */
  async resolve(
    context: RequestContext,
    blockerId: string,
    input: { resolution: string; resumeWork: boolean },
  ): Promise<string> {
    const now = this.deps.clock.now();
    return this.deps.uow.transaction(async (stores) => {
      const blocker = await stores.taskItems.findBlockerForUpdate(blockerId);
      if (!blocker) throw new NotFoundError('Blocker');
      const loaded = await loadTaskForActor(stores, context.actor, blocker.taskId, true, 'Blocker');
      const actorId = context.actor.userId;
      const mayResolve =
        loaded.relation.canManage ||
        blocker.raisedByUserId === actorId ||
        blocker.waitingOnUserId === actorId;
      if (!mayResolve) {
        throw new ForbiddenError(
          'Only the project manager, the person who raised it or the person it waits on can resolve this blocker.',
        );
      }
      if (blocker.resolvedAt) throw new ConflictError('This blocker is already resolved.');
      await stores.taskItems.resolveBlocker(blockerId, {
        at: now,
        byUserId: actorId,
        note: input.resolution,
      });
      const { task } = loaded;
      await recordTaskChange(stores.records, context, task, {
        action: 'task.blocker_resolved',
        summary: `Resolved a blocker on ${quoted(task.title)}.`,
        after: { blockerId, resolution: input.resolution, resumeWork: input.resumeWork },
      });
      await stores.records.enqueueEvent(
        domainEvent('TaskUnblocked', 'task', task.id, {
          taskId: task.id,
          projectId: task.projectId,
          blockerId,
        }),
      );
      const notifier = await this.deps.context.notifierFor(stores);
      const notice = {
        kind: 'blocker_resolved' as const,
        title: `Blocker resolved: ${quoted(task.title)}`,
        body: input.resolution,
      };
      await notifyAboutTask(notifier, actorId, task, `blocker-resolved:${blockerId}`, [
        { ...notice, recipientUserId: task.ownerUserId },
        { ...notice, recipientUserId: blocker.raisedByUserId },
      ]);
      if (input.resumeWork && task.status === 'blocked') {
        const facts = await loadDecisionFacts(stores, loaded);
        // Resume only when the rules allow it (no other open blocker, a worker resolving).
        if (decideFor(facts, 'in_progress', null).allowed) {
          await performTransition(stores, notifier, {
            context,
            facts,
            to: 'in_progress',
            note: input.resolution,
            expectedVersion: task.version,
            now,
          });
        }
      }
      return task.id;
    });
  }
}
