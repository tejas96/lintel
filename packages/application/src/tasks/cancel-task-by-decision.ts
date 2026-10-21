import type { RequestContext } from '../common/request-context';
import type { ApplicationStores } from '../common/unit-of-work';
import { closeSessionsOnTask } from '../work/work-session-accounting';
import type { TaskRecord } from './task.store';
import { quoted, recordTaskChange } from './task-records';

type Stores = Pick<ApplicationStores, 'tasks' | 'workSessions' | 'records'>;

export interface DecidedCancellation {
  readonly context: RequestContext;
  /** Shown on the task and in the feed, e.g. "Template updated to v3." */
  readonly reason: string;
  readonly at: Date;
  /** Where the decision was made, kept with the activity and audit entries. */
  readonly source: Readonly<Record<string, string>>;
}

/**
 * Cancels a task because a manager's decision removed it (a template update
 * or an approved scope change). Like any status change it is an optimistic
 * update, running timers on the task stop and count their time, and the feed
 * and the audit log record it. Returns null when the task changed since it
 * was read.
 */
export async function cancelTaskByDecision(
  stores: Stores,
  task: TaskRecord,
  cancellation: DecidedCancellation,
): Promise<TaskRecord | null> {
  const after = await stores.tasks.update(task.id, task.version, {
    status: 'cancelled',
    cancelledReason: cancellation.reason,
  });
  if (!after) return null;
  await closeSessionsOnTask(stores, task.id, cancellation.at);
  await recordTaskChange(stores.records, cancellation.context, after, {
    action: 'task.cancelled',
    summary: `Cancelled ${quoted(task.title)}: ${cancellation.reason}`,
    before: { status: task.status, version: task.version },
    after: { status: 'cancelled', version: after.version, ...cancellation.source },
  });
  return after;
}

/** Cancels subtasks of a cancelled task that have not started; started ones stay for their owners. */
export async function cancelSubtasksByDecision(
  stores: Stores,
  subtaskIds: readonly string[],
  cancellation: DecidedCancellation,
): Promise<void> {
  for (const subtaskId of subtaskIds) {
    const subtask = await stores.tasks.findForUpdate(subtaskId);
    if (subtask) await cancelTaskByDecision(stores, subtask, cancellation);
  }
}
