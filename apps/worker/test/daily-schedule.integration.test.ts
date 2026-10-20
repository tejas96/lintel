import type { TestWorkflowEnvironment } from '@temporalio/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureDailyOperationsSchedule } from '../src/schedules/daily-operations.schedule';
import { connectTestEnvironment, uniqueWorkflowId } from './support/temporal';

describe('daily operations schedule', () => {
  let env: TestWorkflowEnvironment;
  const scheduleId = uniqueWorkflowId('daily-schedule');

  beforeAll(async () => {
    env = await connectTestEnvironment();
  });

  afterAll(async () => {
    try {
      await env.client.schedule.getHandle(scheduleId).delete();
    } catch {
      // Not created.
    }
    await env?.teardown();
  });

  it('is created at 08:30 in the business timezone and updated idempotently', async () => {
    const options = {
      scheduleId,
      taskQueue: 'lintel-worker-test-schedule',
      timeZone: 'Asia/Kolkata',
    };
    expect(await ensureDailyOperationsSchedule(env.client, options)).toBe('created');
    expect(
      await ensureDailyOperationsSchedule(env.client, { ...options, timeZone: 'Europe/London' }),
    ).toBe('updated');
    const description = await env.client.schedule.getHandle(scheduleId).describe();
    expect(description.spec.timezone).toBe('Europe/London');
    expect(description.spec.calendars?.[0]).toMatchObject({
      hour: [{ start: 8, end: 8, step: 1 }],
    });
    expect(description.spec.calendars?.[0]).toMatchObject({
      minute: [{ start: 30, end: 30, step: 1 }],
    });
    expect(description.action).toMatchObject({
      type: 'startWorkflow',
      workflowType: 'dailyOperationsWorkflow',
      taskQueue: 'lintel-worker-test-schedule',
    });
    expect(description.policies.overlap).toBe('SKIP');
    const next = description.info.nextActionTimes[0];
    expect(next).toBeInstanceOf(Date);
    // 08:30 in London is 08:30 UTC in winter or 07:30 UTC in summer.
    expect([7, 8]).toContain(next?.getUTCHours());
    expect(next?.getUTCMinutes()).toBe(30);
  });
});
