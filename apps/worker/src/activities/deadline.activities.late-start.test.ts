import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import { deadlineWorld as world } from '../testing/deadline-world';
import { deadlineTask, OWNER } from '../testing/fixtures';

describe('late-start nudge step', () => {
  const lateStart = (key = 'task_late_start.task_owner@2026-11-06') =>
    ({ key, audience: 'task_owner', kind: 'task_late_start' }) as const;
  const readyTask = (overrides: Parameters<typeof deadlineTask>[0] = {}) =>
    deadlineTask({
      status: 'ready',
      plannedStartDate: toCalendarDate('2026-11-06'),
      dueDate: toCalendarDate('2026-11-12'),
      ...overrides,
    });

  it('plans the nudge the working day after the planned start, keyed by that start', async () => {
    // Monday 9 Nov, 09:00 IST; the start was Friday 6 Nov, so the nudge was due Saturday 10:00.
    const fake = world('2026-11-09T03:30:00.000Z');
    fake.stores.background.followUps.deadlines.set('task-1', readyTask());
    const plan = await fake.activities.loadDeadlinePlan('task-1');
    expect(plan.steps[0]).toMatchObject({
      key: 'task_late_start.task_owner@2026-11-06',
      kind: 'task_late_start',
      at: '2026-11-07T04:30:00.000Z',
      delayMs: 0,
      superseded: false,
    });
  });

  it('plans no nudge once work has started or while a prerequisite is open', async () => {
    const fake = world('2026-11-09T03:30:00.000Z');
    const kinds = async () =>
      (await fake.activities.loadDeadlinePlan('task-1')).steps.map((step) => step.kind);
    fake.stores.background.followUps.deadlines.set('task-1', readyTask({ status: 'in_progress' }));
    expect(await kinds()).not.toContain('task_late_start');
    fake.stores.background.followUps.deadlines.set(
      'task-1',
      readyTask({ prerequisitesDone: false }),
    );
    expect(await kinds()).not.toContain('task_late_start');
  });

  it('asks the owner to start, report a blocker or ask for a new date', async () => {
    const fake = world();
    fake.stores.background.followUps.deadlines.set('task-1', readyTask());
    expect(await fake.activities.sendDeadlineStep('task-1', '2026-11-12', lateStart())).toBe(
      'sent',
    );
    expect(fake.stores.notifications.created[0]).toMatchObject({
      recipientUserId: OWNER,
      kind: 'task_late_start',
      title: 'Not started yet: Working drawings',
      body: '"Working drawings" (Saska residence) was planned to start on Fri 6 Nov. Start it, report a blocker, or ask for a new date.',
      linkPath: '/tasks/task-1?nudge=late-start',
      dedupeKey: `task_late_start:${OWNER}:task-1:2026-11-12:task_late_start.task_owner@2026-11-06`,
    });
  });

  it('re-checks before sending: started work needs no nudge, a moved start re-plans', async () => {
    const fake = world();
    fake.stores.background.followUps.deadlines.set('task-1', readyTask({ status: 'in_progress' }));
    expect(await fake.activities.sendDeadlineStep('task-1', '2026-11-12', lateStart())).toBe(
      'not_needed',
    );
    fake.stores.background.followUps.deadlines.set(
      'task-1',
      readyTask({ plannedStartDate: toCalendarDate('2026-11-10') }),
    );
    expect(await fake.activities.sendDeadlineStep('task-1', '2026-11-12', lateStart())).toBe(
      'due_date_changed',
    );
    expect(fake.stores.notifications.created).toEqual([]);
  });
});
