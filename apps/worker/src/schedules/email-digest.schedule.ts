import { type Client, ScheduleAlreadyRunning, ScheduleOverlapPolicy } from '@temporalio/client';
import { WORKFLOW_TYPES } from '../workflows/workflow-contract';

export const EMAIL_DIGEST_SCHEDULE_ID = 'lintel-email-digest';

export interface EmailDigestScheduleOptions {
  readonly scheduleId: string;
  readonly taskQueue: string;
  /** IANA timezone of the studio. */
  readonly timeZone: string;
  /** "HH:mm" in that timezone (EMAIL_DIGEST_TIME). */
  readonly time: string;
}

/**
 * Creates or updates the daily email digest Schedule (idempotent on every
 * worker start, so a changed time or timezone takes effect on restart).
 */
export async function ensureEmailDigestSchedule(
  client: Client,
  options: EmailDigestScheduleOptions,
): Promise<'created' | 'updated'> {
  const [hour, minute] = options.time.split(':').map(Number);
  const spec = {
    calendars: [
      { hour: hour ?? 18, minute: minute ?? 0, comment: 'Daily email digest, business timezone' },
    ],
    timezone: options.timeZone,
  };
  const action = {
    type: 'startWorkflow' as const,
    workflowType: WORKFLOW_TYPES.emailDigest,
    workflowId: `${options.scheduleId}-run`,
    taskQueue: options.taskQueue,
    args: [],
    workflowExecutionTimeout: '12 hours',
  } as const;
  // A digest that was missed (server down) is still worth sending within a few hours.
  const policies = { overlap: ScheduleOverlapPolicy.SKIP, catchupWindow: '4 hours' } as const;
  try {
    await client.schedule.create({ scheduleId: options.scheduleId, spec, action, policies });
    return 'created';
  } catch (error) {
    if (!(error instanceof ScheduleAlreadyRunning)) throw error;
  }
  await client.schedule.getHandle(options.scheduleId).update((previous) => ({
    spec,
    action,
    policies: { ...previous.policies, ...policies },
    state: previous.state,
  }));
  return 'updated';
}
