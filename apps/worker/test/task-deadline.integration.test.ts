import type { WorkflowHandle, WorkflowHandleWithFirstExecutionRunId } from '@temporalio/client';
import type { TestWorkflowEnvironment } from '@temporalio/testing';
import type { WorkflowBundle } from '@temporalio/worker';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DeadlinePlan, WorkerActivities } from '../src/activities';
import {
  MAX_RELOADS_PER_RUN,
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

type DeadlineActivities = Pick<WorkerActivities, 'loadDeadlinePlan' | 'sendDeadlineStep'>;

interface ScriptedTask {
  open: boolean;
  dueDate: string | null;
  /** Absolute times (ms since epoch) of the steps, in order. */
  stepTimes: number[];
}

/** Stub activities: the plan comes from `task`, sends are recorded with their time. */
function scriptedActivities(task: ScriptedTask) {
  const sent: { key: string; dueDate: string; at: number }[] = [];
  let loads = 0;
  const activities: DeadlineActivities = {
    async loadDeadlinePlan(): Promise<DeadlinePlan> {
      loads += 1;
      const now = Date.now();
      return {
        open: task.open,
        dueDate: task.dueDate,
        steps: task.stepTimes.map((at, index) => ({
          key: `step-${index + 1}`,
          audience: 'task_owner',
          kind: 'task_overdue',
          label: `Step ${index + 1}`,
          at: new Date(at).toISOString(),
          delayMs: Math.max(0, at - now),
          superseded: false,
        })),
      };
    },
    async sendDeadlineStep(_taskId, dueDate, step) {
      if (!task.open) return 'task_closed';
      if (dueDate !== task.dueDate) return 'due_date_changed';
      sent.push({ key: step.key, dueDate, at: Date.now() });
      return 'sent';
    },
  };
  return { activities, sent, loads: () => loads };
}

describe('taskDeadlineWorkflow on the Temporal dev server', () => {
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

  async function run<T>(
    activities: DeadlineActivities,
    body: (
      start: (
        taskId: string,
      ) => Promise<WorkflowHandleWithFirstExecutionRunId<typeof taskDeadlineWorkflow>>,
    ) => Promise<T>,
  ): Promise<T> {
    const taskQueue = uniqueTaskQueue('deadline');
    const worker = await createTestWorker(env, { taskQueue, bundle, activities });
    return worker.runUntil(
      body(async (taskId) => {
        const handle = await env.client.workflow.start(taskDeadlineWorkflow, {
          taskQueue,
          workflowId: uniqueWorkflowId('deadline'),
          args: [taskId],
        });
        handles.push(handle);
        return handle;
      }),
    );
  }

  it('fires the steps in order, each at its time, then completes', async () => {
    const start = Date.now();
    const task: ScriptedTask = {
      open: true,
      dueDate: '2026-11-10',
      stepTimes: [start + 1000, start + 2000, start + 3000],
    };
    const script = scriptedActivities(task);
    const outcome = await run(script.activities, async (startWorkflow) =>
      (await startWorkflow('task-1')).result(),
    );
    expect(outcome).toBe('all_steps_sent');
    expect(script.sent.map((entry) => entry.key)).toEqual(['step-1', 'step-2', 'step-3']);
    script.sent.forEach((entry, index) => {
      expect(entry.at).toBeGreaterThanOrEqual((task.stepTimes[index] ?? 0) - 50);
    });
  });

  it('stops as soon as the task is closed', async () => {
    const start = Date.now();
    const task: ScriptedTask = {
      open: true,
      dueDate: '2026-11-10',
      stepTimes: [start + 1000, start + 2000, start + 4000],
    };
    const script = scriptedActivities(task);
    const outcome = await run(script.activities, async (startWorkflow) => {
      const handle = await startWorkflow('task-2');
      await eventually(() => expect(script.sent).toHaveLength(2));
      task.open = false;
      await handle.signal(taskClosedSignal);
      return handle.result();
    });
    expect(outcome).toBe('task_closed');
    await new Promise((done) => setTimeout(done, 2500));
    expect(script.sent.map((entry) => entry.key)).toEqual(['step-1', 'step-2']);
  });

  it('recomputes the plan when the schedule changes', async () => {
    const start = Date.now();
    const task: ScriptedTask = {
      open: true,
      dueDate: '2026-11-10',
      stepTimes: [start + 1000, start + 60_000],
    };
    const script = scriptedActivities(task);
    const outcome = await run(script.activities, async (startWorkflow) => {
      const handle = await startWorkflow('task-3');
      await eventually(() => expect(script.sent).toHaveLength(1));
      const changedAt = Date.now();
      task.dueDate = '2026-11-12';
      task.stepTimes = [changedAt + 1000, changedAt + 2000];
      await handle.signal(scheduleChangedSignal, { dueDate: '2026-11-12' });
      return handle.result();
    });
    expect(outcome).toBe('all_steps_sent');
    expect(script.sent.map((entry) => `${entry.dueDate}/${entry.key}`)).toEqual([
      '2026-11-10/step-1',
      '2026-11-12/step-1',
      '2026-11-12/step-2',
    ]);
  });

  it('continues as new after many reschedules and keeps what it already sent', async () => {
    const start = Date.now();
    const task: ScriptedTask = {
      open: true,
      dueDate: '2026-11-10',
      stepTimes: [start, start + 120_000],
    };
    const script = scriptedActivities(task);
    const runs = await run(script.activities, async (startWorkflow) => {
      const handle = await startWorkflow('task-4');
      await eventually(() => expect(script.sent).toHaveLength(1));
      // One signal per reload (signals that arrive together wake the workflow only once).
      for (let index = 0; index <= MAX_RELOADS_PER_RUN + 1; index += 1) {
        const loadsBefore = script.loads();
        await handle.signal(scheduleChangedSignal);
        await eventually(() => expect(script.loads()).toBeGreaterThan(loadsBefore));
      }
      await eventually(async () => {
        const description = await handle.describe();
        expect(description.runId).not.toBe(handle.firstExecutionRunId);
      });
      task.open = false;
      await handle.signal(taskClosedSignal);
      await expect(handle.result()).resolves.toBe('task_closed');
      return script.loads();
    });
    expect(runs).toBeGreaterThan(MAX_RELOADS_PER_RUN);
    expect(script.sent.map((entry) => entry.key)).toEqual(['step-1']);
  });
});
