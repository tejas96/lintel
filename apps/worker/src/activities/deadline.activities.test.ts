import type { EscalationStep } from '@lintel/domain';
import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import { createFakeWorld } from '../testing/fake-world';
import { ADMIN, BUSINESS_OWNER, deadlineTask, MANAGER, OWNER } from '../testing/fixtures';
import { createDeadlineActivities } from './deadline.activities';
import { toDeadlinePlanSteps } from './deadline-plan';

function world(now?: string) {
  const fake = createFakeWorld(now);
  for (const user of [OWNER, MANAGER, BUSINESS_OWNER, ADMIN]) {
    fake.stores.notifications.activeUsers.add(user);
  }
  fake.stores.background.followUps.capabilityHolders.set('dashboard.view_business', [
    BUSINESS_OWNER,
    ADMIN,
  ]);
  return { ...fake, activities: createDeadlineActivities(fake.deps) };
}

describe('deadline plan steps', () => {
  const step = (at: string, audience: EscalationStep['audience']): EscalationStep => ({
    at: new Date(at),
    audience,
    kind: audience === 'task_owner' ? 'task_overdue' : 'task_overdue_escalated',
    label: audience,
  });

  it('computes waits from the clock and supersedes stale steps of the same audience', () => {
    const steps = toDeadlinePlanSteps(
      [
        { ...step('2026-11-07T04:30:00Z', 'task_owner'), kind: 'deadline_upcoming' },
        step('2026-11-09T13:00:00Z', 'task_owner'),
        step('2026-11-10T04:00:00Z', 'project_manager'),
      ],
      new Date('2026-11-09T14:00:00Z'),
    );
    expect(steps.map((planned) => [planned.key, planned.delayMs, planned.superseded])).toEqual([
      ['deadline_upcoming.task_owner', 0, true],
      ['task_overdue.task_owner', 0, false],
      ['task_overdue_escalated.project_manager', 14 * 3600 * 1000, false],
    ]);
  });
});

describe('deadline activities', () => {
  it('plans with the studio reminder time and the owner calendar', async () => {
    // Saturday 7 Nov 2026, 09:00 IST: Monday's reminder is due at 10:00 the same day.
    const fake = world('2026-11-07T03:30:00.000Z');
    fake.stores.background.followUps.deadlines.set(
      'task-1',
      deadlineTask({ dueDate: toCalendarDate('2026-11-09') }),
    );
    fake.stores.settings.organizationSettings = {
      ...fake.stores.settings.organizationSettings,
      deadlineReminderTime: '10:00',
    };
    const plan = await fake.activities.loadDeadlinePlan('task-1');
    expect(plan.open).toBe(true);
    expect(plan.dueDate).toBe('2026-11-09');
    expect(plan.steps[0]).toMatchObject({
      key: 'deadline_upcoming.task_owner',
      at: '2026-11-07T04:30:00.000Z',
      delayMs: 3600 * 1000,
      superseded: false,
    });
    expect(plan.steps.map((planned) => planned.audience)).toEqual([
      'task_owner',
      'task_owner',
      'project_manager',
    ]);
  });

  it('reads the task’s current escalation delay every time it plans', async () => {
    const fake = world('2026-11-07T03:30:00.000Z');
    const due = toCalendarDate('2026-11-09');
    const managerStep = async () =>
      (await fake.activities.loadDeadlinePlan('task-1')).steps.find(
        (planned) => planned.audience === 'project_manager',
      );
    fake.stores.background.followUps.deadlines.set('task-1', deadlineTask({ dueDate: due }));
    // One working day overdue: Tuesday 10 Nov, 09:30 IST.
    expect((await managerStep())?.at).toBe('2026-11-10T04:00:00.000Z');
    // A manager changes it to three days; the reloaded plan moves the alert to Thursday.
    fake.stores.background.followUps.deadlines.set(
      'task-1',
      deadlineTask({ dueDate: due, escalateAfterOverdueDays: 3 }),
    );
    expect((await managerStep())?.at).toBe('2026-11-12T04:00:00.000Z');
  });

  it('reports a closed or archived task so the workflow can stop', async () => {
    const fake = world();
    fake.stores.background.followUps.deadlines.set('task-1', deadlineTask({ status: 'done' }));
    expect(await fake.activities.loadDeadlinePlan('task-1')).toMatchObject({ open: false });
    expect(await fake.activities.loadDeadlinePlan('missing')).toMatchObject({ open: false });
  });

  it('re-checks the task before sending and never notifies for a closed task', async () => {
    const fake = world();
    const step = {
      key: 'task_overdue.task_owner',
      audience: 'task_owner',
      kind: 'task_overdue',
    } as const;
    fake.stores.background.followUps.deadlines.set('task-1', deadlineTask({ status: 'cancelled' }));
    expect(await fake.activities.sendDeadlineStep('task-1', '2026-11-10', step)).toBe(
      'task_closed',
    );
    fake.stores.background.followUps.deadlines.set(
      'task-1',
      deadlineTask({ dueDate: toCalendarDate('2026-11-12') }),
    );
    expect(await fake.activities.sendDeadlineStep('task-1', '2026-11-10', step)).toBe(
      'due_date_changed',
    );
    expect(fake.stores.notifications.created).toEqual([]);
  });

  it('notifies the owner once per step and due date, even when retried', async () => {
    const fake = world();
    const step = {
      key: 'task_overdue.task_owner',
      audience: 'task_owner',
      kind: 'task_overdue',
    } as const;
    fake.stores.background.followUps.deadlines.set('task-1', deadlineTask());
    expect(await fake.activities.sendDeadlineStep('task-1', '2026-11-10', step)).toBe('sent');
    expect(await fake.activities.sendDeadlineStep('task-1', '2026-11-10', step)).toBe('sent');
    expect(fake.stores.notifications.created).toHaveLength(1);
    expect(fake.stores.notifications.created[0]).toMatchObject({
      recipientUserId: OWNER,
      kind: 'task_overdue',
      linkPath: '/tasks/task-1',
      dedupeKey: `task_overdue:${OWNER}:task-1:2026-11-10:task_overdue.task_owner`,
    });
  });

  it('escalates to the project manager and to every business owner', async () => {
    const fake = world();
    fake.stores.background.followUps.deadlines.set('task-1', deadlineTask({ priority: 'urgent' }));
    const kind = 'task_overdue_escalated' as const;
    await fake.activities.sendDeadlineStep('task-1', '2026-11-10', {
      key: 'manager',
      audience: 'project_manager',
      kind,
    });
    await fake.activities.sendDeadlineStep('task-1', '2026-11-10', {
      key: 'owner',
      audience: 'business_owner',
      kind,
    });
    expect(fake.stores.notifications.created.map((n) => n.recipientUserId)).toEqual([
      MANAGER,
      BUSINESS_OWNER,
      ADMIN,
    ]);
  });

  it('skips the owner step when the task has no owner', async () => {
    const fake = world();
    fake.stores.background.followUps.deadlines.set('task-1', deadlineTask({ ownerUserId: null }));
    const step = { key: 'k', audience: 'task_owner', kind: 'deadline_upcoming' } as const;
    expect(await fake.activities.sendDeadlineStep('task-1', '2026-11-10', step)).toBe(
      'no_recipient',
    );
  });
});

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
