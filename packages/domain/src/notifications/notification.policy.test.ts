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

  it('sends SMS only for urgent kinds the person opted into, when SMS is switched on', () => {
    const channels = (input: Parameters<typeof planNotificationDelivery>[0]) =>
      planNotificationDelivery(input).map((d) => `${d.channel}:${d.deliver}`);
    const smsOn = [
      { kind: 'absence_reassessment' as const, channel: 'sms' as const, enabled: true },
    ];
    const urgent = { ...base, kind: 'absence_reassessment' as const, preferences: smsOn };
    expect(channels({ ...urgent, smsConfigured: true })).toContain('sms:now');
    expect(channels({ ...urgent, smsConfigured: false })).not.toContain('sms:now');
    expect(channels({ ...urgent, preferences: [], smsConfigured: true })).not.toContain('sms:now');
    const notUrgent = [{ kind: 'task_assigned' as const, channel: 'sms' as const, enabled: true }];
    expect(channels({ ...base, preferences: notUrgent, smsConfigured: true })).not.toContain(
      'sms:now',
    );
  });

  it('plans email only when opted in, immediately or for the daily digest', () => {
    const emailOn = (kind: 'task_assigned' | 'absence_reassessment') => ({
      ...base,
      kind,
      preferences: [{ kind, channel: 'email' as const, enabled: true }],
    });
    const email = { configured: true, hasAddress: true, dailyDigest: false };
    const decide = (input: Parameters<typeof planNotificationDelivery>[0]) =>
      planNotificationDelivery(input).find((d) => d.channel === 'email')?.deliver ?? 'none';
    expect(decide({ ...base, email })).toBe('none');
    expect(decide(emailOn('task_assigned'))).toBe('none');
    const notConfigured = { ...email, configured: false };
    expect(decide({ ...emailOn('task_assigned'), email: notConfigured })).toBe('none');
    expect(decide({ ...emailOn('task_assigned'), email })).toBe('now');
    const noAddress = { ...email, hasAddress: false };
    expect(decide({ ...emailOn('task_assigned'), email: noAddress })).toBe('skip');
    const digest = { ...email, dailyDigest: true };
    expect(decide({ ...emailOn('task_assigned'), email: digest })).toBe('digest');
    expect(decide({ ...emailOn('absence_reassessment'), email: digest })).toBe('now');
    // Quiet hours hold push, never email.
    expect(decide({ ...emailOn('task_assigned'), email, localTime: '23:30' })).toBe('now');
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
  it('makes a task overdue at its due time when one is set', () => {
    const steps = planDeadlineEscalation({
      dueDate: toCalendarDate('2026-11-09'),
      dueTime: '11:00',
      priority: 'medium',
      projectCriticality: 'normal',
      escalateAfterOverdueDays: 1,
      calendar: DEFAULT_WORKING_CALENDAR,
      reminderTime: '10:00',
    });
    const overdue = steps.find((step) => step.kind === 'task_overdue');
    // 11:00 in Asia/Kolkata is 05:30 UTC.
    expect(overdue?.at.toISOString()).toBe('2026-11-09T05:30:00.000Z');
    expect(overdue?.label).toBe('Overdue at 11:00 am on the due day');
    expect(steps.find((step) => step.audience === 'project_manager')?.at.toISOString()).toBe(
      '2026-11-10T04:00:00.000Z',
    );
  });
});
