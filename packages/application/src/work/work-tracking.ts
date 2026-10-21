import { PreconditionFailedError } from '@lintel/shared';
import type { OperationsStores } from '../tasks/operations-context';
import { endWorkSession } from './work-session-accounting';

/** Whether the studio tracks working time (the `workTrackingEnabled` organisation setting). */
export interface WorkTrackingSetting {
  isEnabled(): Promise<boolean>;
}

const EXPLANATION =
  'Work tracking is switched off for this studio, so work sessions cannot be started or paused.';
const WHAT_TO_DO =
  'Move the task with its status instead. An administrator can switch tracking on in Settings, Studio.';

/** A start or pause was asked for while the studio does not track working time. */
export class WorkTrackingDisabledError extends PreconditionFailedError {
  constructor() {
    super(EXPLANATION, [{ message: WHAT_TO_DO }]);
    this.name = 'WorkTrackingDisabledError';
  }
}

export async function assertWorkTrackingEnabled(setting: WorkTrackingSetting): Promise<void> {
  if (!(await setting.isEnabled())) throw new WorkTrackingDisabledError();
}

/**
 * Ends every running session, booking its minutes to the task, when the studio
 * switches tracking off, so no session is left running that nobody can pause.
 * Returns how many sessions were closed.
 */
export async function closeAllWorkSessions(
  stores: Pick<OperationsStores, 'workSessions' | 'tasks'>,
  at: Date,
): Promise<number> {
  const running = await stores.workSessions.activeSessions();
  for (const session of running) await endWorkSession(stores, session, at);
  return running.length;
}
