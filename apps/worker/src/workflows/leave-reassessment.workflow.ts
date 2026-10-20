import { proxyActivities, sleep } from '@temporalio/workflow';
import type { WorkerActivities } from '../activities';
import { DATABASE_ACTIVITY } from './activity-options';

const { notifyLeaveImpact, sendHandoverReminder } =
  proxyActivities<WorkerActivities>(DATABASE_ACTIVITY);

export interface LeaveReassessmentOutcome {
  readonly status: 'notified' | 'inactive' | 'missing';
  readonly affectedTasks: number;
  readonly managersNotified: number;
  readonly handoverReminder: 'sent' | 'nothing_pending' | 'inactive' | 'not_needed';
}

/**
 * Reassesses work when someone is away. Immediately tells each affected
 * project manager once; for planned leave, reminds managers on the working
 * day before the start about handovers not yet applied. Never reassigns.
 */
export async function leaveReassessmentWorkflow(
  leaveRequestId: string,
): Promise<LeaveReassessmentOutcome> {
  const impact = await notifyLeaveImpact(leaveRequestId);
  const summary = {
    status: impact.status,
    affectedTasks: impact.affectedTasks,
    managersNotified: impact.managersNotified,
  };
  if (impact.status !== 'notified' || impact.handoverReminderDelayMs === null) {
    return { ...summary, handoverReminder: 'not_needed' };
  }
  if (impact.handoverReminderDelayMs > 0) await sleep(impact.handoverReminderDelayMs);
  return { ...summary, handoverReminder: await sendHandoverReminder(leaveRequestId) };
}
