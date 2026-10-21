import { TASK_STATUS_LABELS } from '@lintel/domain';
import { ForbiddenError, PreconditionFailedError } from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import type { OperationsDependencies, OperationsStores } from '../tasks/operations-context';
import { loadDecisionFacts, loadTaskForActor } from '../tasks/task-loader';
import { performTransition } from '../tasks/task-transition.service';
import { endWorkSession } from './work-session-accounting';
import { assertWorkTrackingEnabled, type WorkTrackingSetting } from './work-tracking';

async function logWork(
  stores: OperationsStores,
  context: RequestContext,
  task: { id: string; projectId: string; title: string },
  type: 'work.started' | 'work.paused',
  payload: Record<string, unknown>,
): Promise<void> {
  await stores.records.appendActivity({
    projectId: task.projectId,
    taskId: task.id,
    actorUserId: context.actor.userId,
    type,
    summary: `${type === 'work.started' ? 'Started' : 'Paused'} work on “${task.title}”.`,
    payload,
  });
}

/**
 * Work sessions: one running session per person. Starting another task pauses
 * the running one and adds its minutes to that task's actual time. Both are
 * refused while the studio does not track working time.
 */
export class WorkSessionCommands {
  constructor(
    private readonly deps: OperationsDependencies,
    private readonly tracking: WorkTrackingSetting,
  ) {}

  async start(context: RequestContext, taskId: string): Promise<void> {
    await assertWorkTrackingEnabled(this.tracking);
    const now = this.deps.clock.now();
    const actor = context.actor;
    await this.deps.uow.transaction(async (stores) => {
      await stores.workSessions.lockPerson(actor.userId);
      const loaded = await loadTaskForActor(stores, actor, taskId, true);
      if (!loaded.relation.isTaskOwner && !loaded.relation.isCollaborator) {
        throw new ForbiddenError('Only the owner or a collaborator can track work on this task.');
      }
      const running = await stores.workSessions.activeSessionFor(actor.userId);
      if (running?.taskId === taskId) return;
      const { task } = loaded;
      if (task.status === 'ready' || task.status === 'changes_requested') {
        const facts = await loadDecisionFacts(stores, loaded);
        const notifier = await this.deps.context.notifierFor(stores);
        await performTransition(stores, notifier, {
          context,
          facts,
          to: 'in_progress',
          note: null,
          expectedVersion: task.version,
          now,
        });
      } else if (task.status !== 'in_progress') {
        throw new PreconditionFailedError(
          `Work can only be tracked on a task that is ready or in progress; this one is ${TASK_STATUS_LABELS[task.status].toLowerCase()}.`,
        );
      }
      let pausedTaskId: string | null = null;
      let pausedMinutes = 0;
      if (running) {
        pausedMinutes = await endWorkSession(stores, running, now);
        pausedTaskId = running.taskId;
      }
      await stores.workSessions.startSession(taskId, actor.userId, now);
      await logWork(stores, context, task, 'work.started', { pausedTaskId, pausedMinutes });
    });
  }

  async pause(context: RequestContext, taskId: string): Promise<void> {
    await assertWorkTrackingEnabled(this.tracking);
    const now = this.deps.clock.now();
    const actor = context.actor;
    await this.deps.uow.transaction(async (stores) => {
      await stores.workSessions.lockPerson(actor.userId);
      const loaded = await loadTaskForActor(stores, actor, taskId, false);
      const running = await stores.workSessions.activeSessionFor(actor.userId);
      if (!running || running.taskId !== taskId) {
        throw new PreconditionFailedError('You have no running work session on this task.');
      }
      const minutes = await endWorkSession(stores, running, now);
      await logWork(stores, context, loaded.task, 'work.paused', { minutes });
    });
  }
}
