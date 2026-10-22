import { DEFAULT_WORKING_CALENDAR } from '@lintel/domain';
import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import { leaveWorld } from '../testing/leave-test-world';
import {
  type CompletionFact,
  onTimeDeliveryKpi,
  onTimeRate,
  overloadedPeople,
  presenceToday,
  projectsNeedingAttention,
  weeklyDeliveryTrend,
} from './command-center.metrics';
import { planCommandCenter } from './command-center.plan';

const today = toCalendarDate('2026-10-21');
const fact = (completedOn: string, dueDate: string | null): CompletionFact => ({
  completedOn: toCalendarDate(completedOn),
  dueDate: dueDate ? toCalendarDate(dueDate) : null,
});

describe('command center scope', () => {
  const { ctx } = leaveWorld();

  it('gives owners and administrators the whole studio with the last 30 days', () => {
    const plan = planCommandCenter(ctx('owner').actor, {}, today, false);
    expect(plan).toMatchObject({
      scope: 'business',
      range: { start: '2026-09-22', end: '2026-10-21' },
      previousRange: { start: '2026-08-23', end: '2026-09-21' },
      week: { start: '2026-10-19', end: '2026-10-25' },
      remainingWeek: { start: '2026-10-21', end: '2026-10-25' },
      milestoneHorizon: { start: '2026-10-21', end: '2026-11-04' },
      includeRewards: true,
      managerUserId: null,
    });
    expect(planCommandCenter(ctx('admin').actor, {}, today, false).includeRewards).toBe(false);
  });

  it('limits a project manager to the projects they manage', () => {
    const plan = planCommandCenter(ctx('pm').actor, { managerUserId: 'someone-else' }, today, true);
    expect(plan).toMatchObject({ scope: 'managed', managerUserId: 'pm', includeRewards: false });
  });

  it('refuses everyone else, even with filters', () => {
    expect(() => planCommandCenter(ctx('ana').actor, {}, today, false)).toThrow(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
    expect(() => planCommandCenter(ctx('lead').actor, {}, today, false)).toThrow(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
    // A team lead who manages a project gets the managed view.
    expect(planCommandCenter(ctx('lead').actor, {}, today, true).scope).toBe('managed');
  });

  it('validates the range', () => {
    expect(() =>
      planCommandCenter(ctx('owner').actor, { from: '2026-10-22', to: '2026-10-21' }, today, false),
    ).toThrow(expect.objectContaining({ code: 'VALIDATION_FAILED' }));
  });

  it('ends the delivery trend with the period, never after today', () => {
    const owner = ctx('owner').actor;
    expect(planCommandCenter(owner, {}, today, false).trendEndsOn).toBe('2026-10-21');
    const past = { from: '2024-01-01', to: '2024-01-31' };
    expect(planCommandCenter(owner, past, today, false).trendEndsOn).toBe('2024-01-31');
    const ahead = { from: '2026-10-01', to: '2026-11-30' };
    expect(planCommandCenter(owner, ahead, today, false).trendEndsOn).toBe('2026-10-21');
  });
});

describe('command center formulas', () => {
  const range = { start: toCalendarDate('2026-10-01'), end: toCalendarDate('2026-10-21') };
  const previous = { start: toCalendarDate('2026-09-10'), end: toCalendarDate('2026-09-30') };
  const completions = [
    fact('2026-10-05', '2026-10-06'),
    fact('2026-10-09', '2026-10-07'),
    fact('2026-10-12', '2026-10-12'),
    fact('2026-10-14', null),
    fact('2026-09-15', '2026-09-14'),
    fact('2026-09-20', '2026-09-22'),
  ];

  it('on-time rate = on or before due ÷ completed with a due date, in the range', () => {
    expect(onTimeRate(completions, range)).toEqual({ rate: 0.667, sampleSize: 3 });
    expect(onTimeRate([], range)).toEqual({ rate: null, sampleSize: 0 });
    expect(onTimeDeliveryKpi(completions, range, previous)).toEqual({
      value: 0.667,
      previousValue: 0.5,
      sampleSize: 3,
    });
  });

  it('builds an eight-week trend ending with this week', () => {
    const trend = weeklyDeliveryTrend(completions, today, 8);
    expect(trend).toHaveLength(8);
    expect(trend[0]?.weekStart).toBe('2026-08-31');
    expect(trend.at(-1)?.weekStart).toBe('2026-10-19');
    expect(trend.find((week) => week.weekStart === '2026-10-05')).toEqual({
      weekStart: '2026-10-05',
      onTime: 1,
      late: 1,
    });
  });

  it('puts off-track projects before at-risk ones and drops healthy ones', () => {
    const project = (id: string, status: 'on_track' | 'at_risk' | 'off_track', end: string) => ({
      id,
      health: { status },
      plannedEndDate: end,
    });
    const ranked = projectsNeedingAttention(
      [
        project('a', 'at_risk', '2026-11-01'),
        project('b', 'on_track', '2026-10-01'),
        project('c', 'off_track', '2026-12-01'),
        project('d', 'at_risk', '2026-10-25'),
      ],
      8,
    );
    expect(ranked.map((item) => item.id)).toEqual(['c', 'd', 'a']);
  });

  it('counts presence today and overload above 105%', () => {
    const calendar = DEFAULT_WORKING_CALENDAR;
    const sunday = toCalendarDate('2026-10-25');
    const people = [
      { userId: 'a', calendar, leaveHalfDaysToday: 0 },
      { userId: 'b', calendar, leaveHalfDaysToday: 1 },
      { userId: 'c', calendar, leaveHalfDaysToday: 2 },
    ];
    expect(presenceToday(people, today)).toEqual({ availableToday: 2, onLeaveUserIds: ['b', 'c'] });
    expect(presenceToday(people, sunday).availableToday).toBe(0);
    expect(
      overloadedPeople([
        { id: 'x', utilization: 1.05, overloadedDays: 0 },
        { id: 'y', utilization: 1.3, overloadedDays: 0 },
        { id: 'z', utilization: 1.1, overloadedDays: 0 },
        { id: 'priya', utilization: 0.42, overloadedDays: 1 },
        { id: 'calm', utilization: 0.6, overloadedDays: 0 },
      ]).map((row) => row.id),
    ).toEqual(['y', 'z', 'priya']);
  });
});
