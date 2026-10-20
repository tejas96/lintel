import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import { DEFAULT_WORKING_CALENDAR } from '../calendar/working-calendar';
import { planDeadlineEscalation } from './deadline-escalation.policy';
import {
  isWithinQuietHours,
  planNotificationDelivery,
  pushPreviewFor,
} from './notification.policy';

describe('notification delivery plan', () => {
  const base = {
    kind: 'task_assigned' as const,
    preferences: [],
    hasActiveDevice: true,
    smsConfigured: false,
    quietHours: { start: '21:00', end: '08:00' },
    localTime: '14:00',
  };

  it('always keeps in-app and sends push during the day', () => {
    expect(planNotificationDelivery(base).map((d) => `${d.channel}:${d.deliver}`)).toEqual([
      'in_app:now',
      'push:now',
    ]);
  });

  it('holds non-urgent push during quiet hours but not urgent ones', () => {
    const night = { ...base, localTime: '23:30' };
    expect(planNotificationDelivery(night)[1]?.deliver).toBe('after_quiet_hours');
    expect(planNotificationDelivery({ ...night, kind: 'absence_reassessment' })[1]?.deliver).toBe(
      'now',
    );
  });

  it('handles quiet hours that cross midnight', () => {
    expect(isWithinQuietHours({ start: '21:00', end: '08:00' }, '07:59')).toBe(true);
    expect(isWithinQuietHours({ start: '21:00', end: '08:00' }, '08:00')).toBe(false);
  });

  it('hides sensitive details in push previews', () => {
    expect(pushPreviewFor('reward_updated', 'Reward approved', '₹5,000').body).not.toContain('₹');
  });
});

describe('deadline escalation plan', () => {
  it('reminds the day before, flags overdue, then escalates', () => {
    const steps = planDeadlineEscalation({
      dueDate: toCalendarDate('2026-11-09'),
      priority: 'urgent',
      projectCriticality: 'normal',
      escalateAfterOverdueDays: 1,
      calendar: DEFAULT_WORKING_CALENDAR,
      reminderTime: '10:00',
    });
    expect(steps.map((step) => step.audience)).toEqual([
      'task_owner',
      'task_owner',
      'project_manager',
      'business_owner',
    ]);
    // Monday's reminder lands on Saturday (Sunday is not a working day).
    expect(steps[0]?.at.toISOString()).toBe('2026-11-07T04:30:00.000Z');
    expect(steps[1]?.at.toISOString()).toBe('2026-11-09T13:00:00.000Z');
  });
});
