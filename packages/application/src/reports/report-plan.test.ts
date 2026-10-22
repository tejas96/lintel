import { type Actor, type Capability, DEFAULT_ROLE_CAPABILITIES, type Role } from '@lintel/domain';
import { ForbiddenError, toCalendarDate, ValidationFailedError } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import { reportPeriods } from './report-periods';
import { planReport, reportInstantWindow } from './report-plan';

const today = toCalendarDate('2026-10-21');

function actor(role: Role, userId = `${role}-1`): Actor {
  return { userId, role, capabilities: new Set<Capability>(DEFAULT_ROLE_CAPABILITIES[role]) };
}

describe('report plan', () => {
  it('gives the owner the whole studio over the last 90 days by week', () => {
    const plan = planReport(actor('owner'), { managerUserId: 'pm-9' }, today, false);
    expect(plan.scope).toBe('business');
    expect(plan.range).toEqual({ start: '2026-07-24', end: '2026-10-21' });
    expect(plan.granularity).toBe('week');
    expect(plan.managerUserId).toBe('pm-9');
    expect(plan.periods[0]).toEqual({ start: '2026-07-24', end: '2026-07-26' });
    expect(plan.periods.at(-1)).toEqual({ start: '2026-10-19', end: '2026-10-21' });
  });

  it('limits a project manager to the projects they manage, whatever they ask for', () => {
    const plan = planReport(
      actor('project_manager', 'pm-1'),
      { managerUserId: 'someone-else' },
      today,
      true,
    );
    expect(plan.scope).toBe('managed');
    expect(plan.managerUserId).toBe('pm-1');
  });

  it('refuses people who neither hold the business view nor manage projects', () => {
    expect(() => planReport(actor('employee'), {}, today, false)).toThrow(ForbiddenError);
    expect(() => planReport(actor('team_lead'), {}, today, false)).toThrow(ForbiddenError);
    expect(planReport(actor('team_lead'), {}, today, true).scope).toBe('managed');
  });

  it('switches to months beyond 14 weeks and validates the range', () => {
    const plan = planReport(actor('owner'), { from: '2026-01-15', to: '2026-06-30' }, today, false);
    expect(plan.granularity).toBe('month');
    expect(plan.periods).toHaveLength(6);
    expect(plan.periods[0]).toEqual({ start: '2026-01-15', end: '2026-01-31' });
    expect(() =>
      planReport(actor('owner'), { from: '2026-10-22', to: '2026-10-21' }, today, false),
    ).toThrow(ValidationFailedError);
    expect(() =>
      planReport(actor('owner'), { from: '2025-01-01', to: '2026-10-21' }, today, false),
    ).toThrow(ValidationFailedError);
  });

  it('never counts days before the studio started', () => {
    const started = toCalendarDate('2026-10-14');
    const plan = planReport(actor('owner'), {}, today, false, started);
    expect(plan.range).toEqual({ start: '2026-10-14', end: '2026-10-21' });
    expect(plan.studioStartDate).toBe('2026-10-14');
    expect(plan.periods).toEqual([
      { start: '2026-10-14', end: '2026-10-18' },
      { start: '2026-10-19', end: '2026-10-21' },
    ]);
    const long = planReport(
      actor('owner'),
      { from: '2026-01-01', to: '2026-10-21' },
      today,
      false,
      started,
    );
    expect(long.range.start).toBe('2026-10-14');
    expect(long.granularity).toBe('week');
    const before = planReport(
      actor('owner'),
      { from: '2026-09-01', to: '2026-09-30' },
      today,
      false,
      started,
    );
    expect(before.range).toEqual({ start: '2026-09-01', end: '2026-09-30' });
  });

  it('turns the range into instants at studio midnight', () => {
    const window = reportInstantWindow(
      { start: toCalendarDate('2026-10-01'), end: toCalendarDate('2026-10-31') },
      'Asia/Kolkata',
    );
    expect(window.from.toISOString()).toBe('2026-09-30T18:30:00.000Z');
    expect(window.to.toISOString()).toBe('2026-10-31T18:30:00.000Z');
  });
});

describe('report periods', () => {
  it('splits a range into ISO weeks clipped at both ends', () => {
    const periods = reportPeriods(
      { start: toCalendarDate('2026-10-07'), end: toCalendarDate('2026-10-20') },
      'week',
    );
    expect(periods).toEqual([
      { start: '2026-10-07', end: '2026-10-11' },
      { start: '2026-10-12', end: '2026-10-18' },
      { start: '2026-10-19', end: '2026-10-20' },
    ]);
  });

  it('splits across a year boundary by month', () => {
    const periods = reportPeriods(
      { start: toCalendarDate('2026-11-20'), end: toCalendarDate('2027-02-03') },
      'month',
    );
    expect(periods.map((period) => period.start)).toEqual([
      '2026-11-20',
      '2026-12-01',
      '2027-01-01',
      '2027-02-01',
    ]);
    expect(periods.at(-1)?.end).toBe('2027-02-03');
  });
});
