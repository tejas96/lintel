import type { WorkflowHandle } from '@temporalio/client';
import type { TestWorkflowEnvironment } from '@temporalio/testing';
import type { WorkflowBundle } from '@temporalio/worker';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FollowUpPlan, WorkerActivities } from '../src/activities';
import {
  blockerFollowUpWorkflow,
  blockerResolvedSignal,
} from '../src/workflows/blocker-follow-up.workflow';
import { dailyOperationsWorkflow } from '../src/workflows/daily-operations.workflow';
import { leaveReassessmentWorkflow } from '../src/workflows/leave-reassessment.workflow';
import {
  reviewDecidedSignal,
  reviewFollowUpWorkflow,
} from '../src/workflows/review-follow-up.workflow';
import {
  bundleTestWorkflows,
  connectTestEnvironment,
  createTestWorker,
  eventually,
  terminateAll,
  uniqueTaskQueue,
  uniqueWorkflowId,
} from './support/temporal';

/** A plan whose stages are due at fixed absolute times (ms since epoch). */
function planAt(times: Record<string, number>, active = () => true) {
  return async (): Promise<FollowUpPlan> => ({
    active: active(),
    stages: Object.entries(times).map(([key, at]) => ({
      key,
      delayMs: Math.max(0, at - Date.now()),
    })),
  });
}

describe('follow-up, leave and daily workflows on the Temporal dev server', () => {
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

  async function withWorker<T>(
    activities: Partial<WorkerActivities>,
    body: (taskQueue: string) => Promise<T>,
  ): Promise<T> {
    const taskQueue = uniqueTaskQueue('follow-up');
    const worker = await createTestWorker(env, { taskQueue, bundle, activities });
    return worker.runUntil(body(taskQueue));
  }

  it('reminds the reviewer, then the manager, at the planned times', async () => {
    const start = Date.now();
    const sent: { stage: string; at: number }[] = [];
    const outcome = await withWorker(
      {
        planReviewFollowUp: planAt({ reviewer: start + 1000, manager: start + 2000 }),
        sendReviewFollowUp: async (_subject, stage) => {
          sent.push({ stage, at: Date.now() });
          return 'sent';
        },
      },
      async (taskQueue) => {
        const handle = await env.client.workflow.start(reviewFollowUpWorkflow, {
          taskQueue,
          workflowId: uniqueWorkflowId('review'),
          args: [{ type: 'deliverable', versionId: 'v1' }],
        });
        handles.push(handle);
        return handle.result();
      },
    );
    expect(outcome).toBe('completed');
    expect(sent.map((entry) => entry.stage)).toEqual(['reviewer', 'manager']);
    expect(sent[1]?.at ?? 0).toBeGreaterThanOrEqual(start + 1950);
  });

  it('stops a review follow-up as soon as the decision signal arrives', async () => {
    const start = Date.now();
    const sent: string[] = [];
    const outcome = await withWorker(
      {
        planReviewFollowUp: planAt({ reviewer: start + 500, manager: start + 60_000 }),
        sendReviewFollowUp: async (_subject, stage) => {
          sent.push(stage);
          return 'sent';
        },
      },
      async (taskQueue) => {
        const handle = await env.client.workflow.start(reviewFollowUpWorkflow, {
          taskQueue,
          workflowId: uniqueWorkflowId('review'),
          args: [{ type: 'task', taskId: 't1', submittedAt: new Date(start).toISOString() }],
        });
        handles.push(handle);
        await eventually(() => expect(sent).toEqual(['reviewer']));
        await handle.signal(reviewDecidedSignal);
        return handle.result();
      },
    );
    expect(outcome).toBe('resolved');
    expect(sent).toEqual(['reviewer']);
  });

  it('ends a blocker follow-up when the blocker is resolved before the first stage', async () => {
    const start = Date.now();
    const sent: string[] = [];
    const outcome = await withWorker(
      {
        planBlockerFollowUp: planAt({ manager: start + 60_000, owner: start + 120_000 }),
        sendBlockerFollowUp: async (_blockerId, stage) => {
          sent.push(stage);
          return 'sent';
        },
      },
      async (taskQueue) => {
        const handle = await env.client.workflow.start(blockerFollowUpWorkflow, {
          taskQueue,
          workflowId: uniqueWorkflowId('blocker'),
          args: ['b1'],
        });
        handles.push(handle);
        await handle.signal(blockerResolvedSignal);
        return handle.result();
      },
    );
    expect(outcome).toBe('resolved');
    expect(sent).toEqual([]);
  });

  it('notifies about leave impact at once and sends the handover reminder later', async () => {
    const calls: { name: string; at: number }[] = [];
    const start = Date.now();
    const outcome = await withWorker(
      {
        notifyLeaveImpact: async () => {
          calls.push({ name: 'impact', at: Date.now() });
          return {
            status: 'notified',
            affectedTasks: 2,
            managersNotified: 1,
            handoverReminderDelayMs: 1500,
          };
        },
        sendHandoverReminder: async () => {
          calls.push({ name: 'handover', at: Date.now() });
          return 'sent';
        },
      },
      async (taskQueue) =>
        env.client.workflow.execute(leaveReassessmentWorkflow, {
          taskQueue,
          workflowId: uniqueWorkflowId('leave'),
          args: ['leave-1'],
        }),
    );
    expect(outcome).toEqual({
      status: 'notified',
      affectedTasks: 2,
      managersNotified: 1,
      handoverReminder: 'sent',
    });
    expect(calls.map((call) => call.name)).toEqual(['impact', 'handover']);
    expect((calls[1]?.at ?? 0) - start).toBeGreaterThanOrEqual(1400);
  });

  it('runs every daily operations activity', async () => {
    const outcome = await withWorker(
      {
        notifyProjectRisks: async () => ({
          projectsChecked: 3,
          projectsNotified: 1,
          milestoneChanges: 2,
        }),
        healDeadlineWorkflows: async () => ({ started: 4 }),
        purgeSecurityRecords: async () => ({
          rateLimitCounters: 5,
          otpChallenges: 2,
          sessions: 1,
          idempotencyRecords: 0,
        }),
        recordBusinessHealth: async () => ({ recorded: 3 }),
      },
      async (taskQueue) =>
        env.client.workflow.execute(dailyOperationsWorkflow, {
          taskQueue,
          workflowId: uniqueWorkflowId('daily'),
        }),
    );
    expect(outcome).toEqual({
      projectsChecked: 3,
      projectsNotified: 1,
      milestoneChanges: 2,
      deadlineWorkflowsStarted: 4,
      securityRecordsPurged: 8,
      healthScopesRecorded: 3,
    });
  });
});
