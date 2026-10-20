import type { Actor, TaskStatus } from '@lintel/domain';
import { PreconditionFailedError, StaleVersionError } from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import type { OperationsDependencies, OperationsStores } from './operations-context';
import type { TaskRecord } from './task.store';
import { type TransitionOptionView, transitionOptions } from './task-decision';
import { loadDecisionFacts, loadTaskForActor } from './task-loader';
import { performTransition } from './task-transition.service';

export interface TransitionTaskInput {
  readonly to: TaskStatus;
  readonly note: string | null;
  readonly version: number;
}

/** Changes a task's status through the domain rules. Blocking goes through "report blocker". */
export class TransitionTaskCommand {
  constructor(private readonly deps: OperationsDependencies) {}

  async execute(
    context: RequestContext,
    taskId: string,
    input: TransitionTaskInput,
  ): Promise<TaskRecord> {
    const now = this.deps.clock.now();
    return this.deps.uow.transaction(async (stores) => {
      const loaded = await loadTaskForActor(stores, context.actor, taskId, true);
      if (input.to === 'blocked') {
        throw new PreconditionFailedError(
          'To block a task, report a blocker (POST /v1/tasks/:id/blockers) so everyone can see what it waits on.',
        );
      }
      if (loaded.task.version !== input.version) throw new StaleVersionError('This task');
      const facts = await loadDecisionFacts(stores, loaded);
      const notifier = await this.deps.context.notifierFor(stores);
      return performTransition(stores, notifier, {
        context,
        facts,
        to: input.to,
        note: input.note,
        expectedVersion: input.version,
        now,
      });
    });
  }
}

export interface TaskViewerState {
  readonly projectId: string;
  readonly transitions: TransitionOptionView[];
  readonly viewerCanManage: boolean;
  readonly viewerCanEdit: boolean;
}

/** What the viewer may do with a task. Throws 404 when the task is missing or hidden. */
export class TaskViewerQuery {
  constructor(private readonly stores: Pick<OperationsStores, 'access' | 'tasks'>) {}

  async execute(actor: Actor, taskId: string): Promise<TaskViewerState> {
    const loaded = await loadTaskForActor(this.stores, actor, taskId, false);
    const facts = await loadDecisionFacts(this.stores, loaded);
    return {
      projectId: loaded.task.projectId,
      transitions: transitionOptions(facts),
      viewerCanManage: loaded.relation.canManage,
      viewerCanEdit: loaded.relation.canManage || loaded.relation.isTaskOwner,
    };
  }
}
