import { TASK_STATUS_LABELS, type TaskStatus } from '@lintel/domain';
import { StaleVersionError } from '@lintel/shared';
import type { RequestContext } from '../common/request-context';
import type { Notifier } from '../notifications/notifier';
import { closeSessionsOnTask } from '../work/work-session-accounting';
import type { OperationsStores } from './operations-context';
import type { TaskChanges, TaskRecord } from './task.store';
import { assertTransitionAllowed, decideFor, type TaskDecisionFacts } from './task-decision';
import { recordTaskChange } from './task-records';
import { applyTransitionEffects } from './task-transition.effects';

export interface TransitionRequest {
  readonly context: RequestContext;
  readonly facts: TaskDecisionFacts;
  readonly to: TaskStatus;
  readonly note: string | null;
  readonly expectedVersion: number;
  readonly now: Date;
}

/** Column changes that come with entering a status. History stays in the activity feed. */
export function transitionChanges(
  task: TaskRecord,
  to: TaskStatus,
  note: string | null,
  actorUserId: string,
  now: Date,
): TaskChanges {
  switch (to) {
    case 'in_progress':
      return {
        status: to,
        startedAt: task.startedAt ?? now,
        // Starting work is how the owner acknowledges the assignment.
        acknowledgedAt:
          task.ownerUserId === actorUserId ? (task.acknowledgedAt ?? now) : task.acknowledgedAt,
        ...(task.status === 'done' ? { completedAt: null, completedByUserId: null } : {}),
      };
    case 'in_review':
      return { status: to, submittedAt: now };
    case 'changes_requested':
      return { status: to, reviewRounds: task.reviewRounds + 1 };
    case 'done':
      return { status: to, completedAt: now, completedByUserId: actorUserId };
    case 'cancelled':
      return { status: to, cancelledReason: note };
    case 'draft':
      return { status: to, cancelledReason: null };
    case 'ready':
      return {
        status: to,
        baselineDueDate: task.baselineDueDate ?? (task.status === 'draft' ? task.dueDate : null),
      };
    case 'blocked':
      return { status: to };
  }
}

/**
 * The single path every status change takes (transition route, start work,
 * blockers): domain decision, optimistic update, time accounting, activity,
 * audit, notifications and outbox events.
 */
export async function performTransition(
  stores: OperationsStores,
  notifier: Notifier,
  request: TransitionRequest,
): Promise<TaskRecord> {
  const { context, facts, to, note, now } = request;
  const before = facts.task;
  assertTransitionAllowed(decideFor(facts, to, note));
  const changes = transitionChanges(before, to, note, context.actor.userId, now);
  const after = await stores.tasks.update(before.id, request.expectedVersion, changes);
  if (!after) throw new StaleVersionError('This task');
  if (before.status === 'in_progress' && to !== 'in_progress') {
    await closeSessionsOnTask(stores, before.id, now);
  }
  await recordTaskChange(stores.records, context, after, {
    action: 'task.status_changed',
    summary: `Moved “${after.title}” from ${TASK_STATUS_LABELS[before.status]} to ${TASK_STATUS_LABELS[to]}.`,
    before: { status: before.status, version: before.version },
    after: { status: to, version: after.version, note },
  });
  await applyTransitionEffects(stores, notifier, { context, before, after, note });
  return after;
}
