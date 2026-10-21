import { DEFAULT_WORKING_CALENDAR } from '@lintel/domain';
import { addDays, calendarDateInTimeZone } from '@lintel/shared';
import type { WorkflowHandle } from '@temporalio/client';
import type { TestWorkflowEnvironment } from '@temporalio/testing';
import type { WorkflowBundle } from '@temporalio/worker';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDeadlineActivities } from '../src/activities/deadline.activities';
import { createFakeWorld } from '../src/testing/fake-world';
import { deadlineTask, OWNER } from '../src/testing/fixtures';
import {
  scheduleChangedSignal,
  taskClosedSignal,
  taskDeadlineWorkflow,
} from '../src/workflows/task-deadline.workflow';
import {
  bundleTestWorkflows,
  connectTestEnvironment,
  createTestWorker,
  eventually,
  terminateAll,
  uniqueTaskQueue,
  uniqueWorkflowId,
} from './support/temporal';

/**
 * The late-start step end to end: the real deadline workflow and the real
 * deadline activities (on in-memory stores) against the Temporal dev server.
 */
describe('late-start nudge in the deadline workflow', () => {
  let env: TestWorkflowEnvironment;
  let bundle: WorkflowBundle;
  const handles: WorkflowHandle[] = [];

  beforeAll(async () => {
    env = await connectTestEnvironment();
    bundle = await bundleTestWorkflows();
  });

  afterAll(async () => {
    await terminateAll(handles);
    await env?.teardown();
  });

  it('nudges the owner once when the planned start has passed, and not after work starts', async () => {
    const fake = createFakeWorld(new Date().toISOString());
    fake.stores.notifications.activeUsers.add(OWNER);
    // Every day a working day, so the test does not depend on the weekday it runs on.
    fake.stores.settings.calendar = {
      ...DEFAULT_WORKING_CALENDAR,
      workingWeekdays: [1, 2, 3, 4, 5, 6, 7],
    };
    const today = calendarDateInTimeZone(new Date(), DEFAULT_WORKING_CALENDAR.timeZone);
    const task = deadlineTask({
      status: 'ready',
      plannedStartDate: addDays(today, -2),
      dueDate: addDays(today, 5),
    });
    fake.stores.background.followUps.deadlines.set(task.taskId, task);
    const taskQueue = uniqueTaskQueue('late-start');
    const worker = await createTestWorker(env, {
      taskQueue,
      bundle,
      activities: createDeadlineActivities(fake.deps),
    });
    const nudges = () =>
      fake.stores.notifications.created.filter((item) => item.kind === 'task_late_start');
    const outcome = await worker.runUntil(async () => {
      const handle = await env.client.workflow.start(taskDeadlineWorkflow, {
        taskQueue,
        workflowId: uniqueWorkflowId('late-start'),
        args: [task.taskId],
      });
      handles.push(handle);
      await eventually(() => expect(nudges()).toHaveLength(1));
      // The owner starts the work; the workflow re-plans and sleeps until the next reminder.
      fake.stores.background.followUps.deadlines.set(task.taskId, {
        ...task,
        status: 'in_progress',
      });
      await handle.signal(scheduleChangedSignal, { dueDate: task.dueDate });
      await new Promise((done) => setTimeout(done, 1500));
      await handle.signal(taskClosedSignal);
      return handle.result();
    });
    expect(outcome).toBe('task_closed');
    expect(nudges()).toHaveLength(1);
    expect(nudges()[0]).toMatchObject({
      recipientUserId: OWNER,
      linkPath: `/tasks/${task.taskId}?nudge=late-start`,
    });
    expect(fake.stores.notifications.created.map((item) => item.kind)).toEqual(['task_late_start']);
  });
});
