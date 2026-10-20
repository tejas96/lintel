import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import { createFakeWorld } from '../testing/fake-world';
import { ADMIN, BUSINESS_OWNER, MANAGER, OWNER, PROJECT } from '../testing/fixtures';
import { createBlockerActivities } from './blocker.activities';
import { createLeaveActivities } from './leave.activities';
import { createReviewActivities } from './review.activities';

const REVIEWER = 'user-reviewer';
// Monday 9 Nov 2026, 11:30 IST.
const NOW = '2026-11-09T06:00:00.000Z';

function world() {
  const fake = createFakeWorld(NOW);
  for (const user of [OWNER, MANAGER, REVIEWER, BUSINESS_OWNER, ADMIN]) {
    fake.stores.notifications.activeUsers.add(user);
  }
  fake.stores.background.followUps.capabilityHolders.set('dashboard.view_business', [
    BUSINESS_OWNER,
    ADMIN,
  ]);
  return fake;
}

describe('review follow-up', () => {
  const subject = { type: 'task', taskId: 'task-1', submittedAt: NOW } as const;
  const review = {
    taskId: 'task-1',
    title: 'Concept boards',
    status: 'in_review' as const,
    submittedAt: new Date(NOW),
    reviewerUserId: REVIEWER,
    ownerName: 'Ananya Joshi',
    project: PROJECT,
  };

  it('waits one working day for the reviewer and three for the manager', async () => {
    const fake = world();
    fake.stores.background.followUps.taskReviews.set('task-1', review);
    const plan = await createReviewActivities(fake.deps).planReviewFollowUp(subject);
    const day = 24 * 3600 * 1000;
    expect(plan).toEqual({
      active: true,
      stages: [
        { key: 'reviewer', delayMs: day },
        { key: 'manager', delayMs: 3 * day },
      ],
    });
  });

  it('reminds the reviewer, escalates to the manager and stops once decided', async () => {
    const fake = world();
    const activities = createReviewActivities(fake.deps);
    fake.stores.background.followUps.taskReviews.set('task-1', review);
    expect(await activities.sendReviewFollowUp(subject, 'reviewer')).toBe('sent');
    expect(await activities.sendReviewFollowUp(subject, 'manager')).toBe('sent');
    expect(fake.stores.notifications.created.map((n) => [n.recipientUserId, n.kind])).toEqual([
      [REVIEWER, 'review_reminder'],
      [MANAGER, 'review_reminder'],
    ]);
    fake.stores.background.followUps.taskReviews.set('task-1', { ...review, status: 'done' });
    expect(await activities.sendReviewFollowUp(subject, 'manager')).toBe('resolved');
    expect((await activities.planReviewFollowUp(subject)).active).toBe(false);
  });

  it('treats a later submission as a new round handled by its own workflow', async () => {
    const fake = world();
    const later = new Date(Date.parse(NOW) + 3600 * 1000);
    fake.stores.background.followUps.taskReviews.set('task-1', { ...review, submittedAt: later });
    expect(await createReviewActivities(fake.deps).sendReviewFollowUp(subject, 'reviewer')).toBe(
      'resolved',
    );
  });
});

describe('blocker follow-up', () => {
  const blocker = {
    blockerId: 'blocker-1',
    taskId: 'task-1',
    taskTitle: 'Site measurements',
    category: 'client',
    reason: 'Client has not shared the keys',
    raisedAt: new Date(NOW),
    resolvedAt: null,
    project: PROJECT,
  };

  it('tells the manager after one working day and business owners after three', async () => {
    const fake = world();
    const activities = createBlockerActivities(fake.deps);
    fake.stores.background.followUps.blockers.set('blocker-1', blocker);
    await activities.sendBlockerFollowUp('blocker-1', 'manager');
    await activities.sendBlockerFollowUp('blocker-1', 'owner');
    expect(fake.stores.notifications.created.map((n) => n.recipientUserId)).toEqual([
      MANAGER,
      BUSINESS_OWNER,
      ADMIN,
    ]);
    expect(fake.stores.notifications.created[0]?.body).toContain('waiting on the client');
  });

  it('stops when the blocker is resolved', async () => {
    const fake = world();
    fake.stores.background.followUps.blockers.set('blocker-1', {
      ...blocker,
      resolvedAt: new Date(NOW),
    });
    const activities = createBlockerActivities(fake.deps);
    expect(await activities.sendBlockerFollowUp('blocker-1', 'manager')).toBe('resolved');
    expect((await activities.planBlockerFollowUp('blocker-1')).active).toBe(false);
  });
});

describe('leave reassessment', () => {
  const leave = {
    id: 'leave-1',
    userId: OWNER,
    fullName: 'Ananya Joshi',
    startDate: toCalendarDate('2026-11-12'),
    endDate: toCalendarDate('2026-11-13'),
    dayPortion: 'full' as const,
    status: 'approved' as const,
    isUrgentAbsence: false,
  };
  const task = (taskId: string, managerUserId: string, dueDate: string) => ({
    taskId,
    title: `Task ${taskId}`,
    projectId: `project-${managerUserId}`,
    projectName: 'Project',
    projectCriticality: 'normal' as const,
    status: 'in_progress' as const,
    priority: 'medium' as const,
    plannedStartDate: null,
    dueDate: toCalendarDate(dueDate),
    milestoneName: null,
    milestoneDueDate: null,
    managerUserId,
  });

  it('notifies each affected manager once and schedules the handover reminder', async () => {
    const fake = world();
    const store = fake.stores.background.leaveImpact;
    store.requests.set('leave-1', leave);
    store.tasksByOwner.set(OWNER, [
      task('t1', MANAGER, '2026-11-12'),
      task('t2', MANAGER, '2026-11-13'),
      task('t3', ADMIN, '2026-11-20'),
    ]);
    const activities = createLeaveActivities(fake.deps);
    const result = await activities.notifyLeaveImpact('leave-1');
    await activities.notifyLeaveImpact('leave-1');
    expect(result).toMatchObject({ status: 'notified', affectedTasks: 2, managersNotified: 1 });
    // Reminder on Wednesday 11 Nov at 10:00 IST (04:30 UTC), from Monday 06:00 UTC.
    expect(result.handoverReminderDelayMs).toBe((2 * 24 - 1.5) * 3600 * 1000);
    expect(fake.stores.notifications.created).toHaveLength(1);
    expect(fake.stores.notifications.created[0]?.body).toContain('"Task t1", "Task t2"');
  });

  it('ignores leave that is not approved and reminds only about unapplied handovers', async () => {
    const fake = world();
    const store = fake.stores.background.leaveImpact;
    const activities = createLeaveActivities(fake.deps);
    store.requests.set('leave-1', { ...leave, status: 'pending' });
    expect((await activities.notifyLeaveImpact('leave-1')).status).toBe('inactive');
    store.requests.set('leave-1', leave);
    expect(await activities.sendHandoverReminder('leave-1')).toBe('nothing_pending');
    store.handovers.set('leave-1', [
      {
        handoverId: 'h1',
        taskId: 't1',
        title: 'Task t1',
        projectName: 'Project',
        managerUserId: MANAGER,
        status: 'accepted',
        toUserName: 'Dev Patel',
      },
    ]);
    expect(await activities.sendHandoverReminder('leave-1')).toBe('sent');
    expect(fake.stores.notifications.created[0]).toMatchObject({
      recipientUserId: MANAGER,
      kind: 'handover_requested',
    });
  });
});
