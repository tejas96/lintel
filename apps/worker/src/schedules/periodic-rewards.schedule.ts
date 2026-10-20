import { type Client, ScheduleAlreadyRunning, ScheduleOverlapPolicy } from '@temporalio/client';
import { WORKFLOW_TYPES } from '../workflows/workflow-contract';

export interface PeriodicRewardsScheduleOptions {
  readonly scheduleId: string;
  readonly taskQueue: string;
  readonly timeZone: string;
}

/** Creates or updates the 07:00, first-of-month reward evaluation Schedule (idempotent). */
export async function ensurePeriodicRewardsSchedule(
  client: Client,
  options: PeriodicRewardsScheduleOptions,
): Promise<'created' | 'updated'> {
  const spec = {
    calendars: [
      { dayOfMonth: 1, hour: 7, minute: 0, comment: 'Evaluate the period that just closed' },
    ],
    timezone: options.timeZone,
  };
  const action = {
    type: 'startWorkflow' as const,
    workflowType: WORKFLOW_TYPES.periodicRewards,
    workflowId: `${options.scheduleId}-run`,
    taskQueue: options.taskQueue,
    args: [],
    workflowExecutionTimeout: '1 day',
  } as const;
  const policies = { overlap: ScheduleOverlapPolicy.SKIP, catchupWindow: '2 days' } as const;
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
