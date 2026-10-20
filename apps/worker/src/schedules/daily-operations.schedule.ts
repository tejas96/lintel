import {
  type Client,
  ScheduleAlreadyRunning,
  ScheduleOverlapPolicy,
  type ScheduleSpec,
} from '@temporalio/client';
import { WORKFLOW_TYPES } from '../workflows/workflow-contract';

export const DAILY_OPERATIONS_SCHEDULE_ID = 'lintel-daily-operations';
export const PERIODIC_REWARDS_SCHEDULE_ID = 'lintel-periodic-rewards';

/** The task queue whose schedules keep the plain IDs (one namespace per environment in production). */
export const DEFAULT_TASK_QUEUE = 'lintel-main';

/**
 * Schedule IDs are unique per Temporal namespace. Workers on another task queue
 * (developers, tests, previews sharing a namespace) get their own suffixed
 * schedules instead of re-pointing everyone else's at themselves.
 */
export function scheduleIdFor(baseId: string, taskQueue: string): string {
  return taskQueue === DEFAULT_TASK_QUEUE ? baseId : `${baseId}--${taskQueue}`;
}

export interface DailyOperationsScheduleOptions {
  readonly scheduleId: string;
  readonly taskQueue: string;
  /** IANA timezone; the schedule fires at 08:30 local time there. */
  readonly timeZone: string;
  readonly hour?: number;
  readonly minute?: number;
}

function scheduleParts(options: DailyOperationsScheduleOptions) {
  const hour = options.hour ?? 8;
  const minute = options.minute ?? 30;
  const spec: ScheduleSpec = {
    calendars: [{ hour, minute, comment: 'Daily operations in the business timezone' }],
    timezone: options.timeZone,
  };
  const action = {
    type: 'startWorkflow' as const,
    workflowType: WORKFLOW_TYPES.dailyOperations,
    workflowId: `${options.scheduleId}-run`,
    taskQueue: options.taskQueue,
    args: [],
    // With overlap SKIP, a run nobody executes (no worker on the queue) must not block
    // every later day: give each run a bounded lifetime.
    workflowExecutionTimeout: '12 hours',
  } as const;
  // One run at a time; if the server was down at 08:30, catch up within six hours.
  const policies = { overlap: ScheduleOverlapPolicy.SKIP, catchupWindow: '6 hours' } as const;
  return { spec, action, policies };
}

/**
 * Creates the daily operations Schedule, or updates it in place when it
 * already exists (each worker start is idempotent and applies the current
 * timezone and task queue).
 */
export async function ensureDailyOperationsSchedule(
  client: Client,
  options: DailyOperationsScheduleOptions,
): Promise<'created' | 'updated'> {
  const { spec, action, policies } = scheduleParts(options);
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
