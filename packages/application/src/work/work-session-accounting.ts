import type { OperationsStores } from '../tasks/operations-context';
import type { WorkSessionRecord } from './work-session.store';

type AccountingStores = Pick<OperationsStores, 'workSessions' | 'tasks'>;

/** Whole minutes between two instants, rounded to the nearest minute and never negative. */
export function sessionMinutes(startedAt: Date, endedAt: Date): number {
  return Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000));
}

/** Ends a session and adds its minutes to the task's actual time. Returns the minutes added. */
export async function endWorkSession(
  stores: AccountingStores,
  session: WorkSessionRecord,
  at: Date,
): Promise<number> {
  await stores.workSessions.endSession(session.id, at);
  const minutes = sessionMinutes(session.startedAt, at);
  if (minutes > 0) await stores.tasks.addActualMinutes(session.taskId, minutes);
  return minutes;
}

/** Closes everyone's open sessions on a task, e.g. when it leaves "in progress". */
export async function closeSessionsOnTask(
  stores: AccountingStores,
  taskId: string,
  at: Date,
): Promise<void> {
  for (const session of await stores.workSessions.activeSessionsOnTask(taskId)) {
    await endWorkSession(stores, session, at);
  }
}
