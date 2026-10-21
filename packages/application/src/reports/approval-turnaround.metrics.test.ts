import { DEFAULT_WORKING_CALENDAR } from '@lintel/domain';
import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import {
  type DecisionFact,
  elapsedHours,
  median,
  slowestDecisions,
  summarizeTurnaround,
} from './approval-turnaround.metrics';
import { buildLeaveBreakdown, leaveDaysInRange } from './leave-report.metrics';

const at = (iso: string) => new Date(iso);

function decision(id: string, requested: string, decided: string | null): DecisionFact {
  return {
    kind: 'deliverable_review',
    id,
    requestedAt: at(requested),
    decidedAt: decided ? at(decided) : null,
    deciderUserId: decided ? 'reviewer' : null,
  };
}

describe('approval turnaround', () => {
  it('measures elapsed clock hours to one decimal', () => {
    expect(elapsedHours(at('2026-10-01T09:00:00Z'), at('2026-10-02T11:30:00Z'))).toBe(26.5);
  });

  it('takes the middle value, or the mean of the two middle values', () => {
    expect(median([])).toBeNull();
    expect(median([7])).toBe(7);
    expect(median([30, 2, 9])).toBe(9);
    expect(median([4, 1, 10, 3])).toBe(3.5);
  });

  it('summarises decisions made in the window and what is still waiting', () => {
    const window = { from: at('2026-10-01T00:00:00Z'), to: at('2026-11-01T00:00:00Z') };
    const now = at('2026-10-21T12:00:00Z');
    const facts = [
      decision('a', '2026-10-02T10:00:00Z', '2026-10-02T14:00:00Z'),
      decision('b', '2026-10-05T10:00:00Z', '2026-10-07T10:00:00Z'),
      decision('c', '2026-10-09T10:00:00Z', '2026-10-09T20:00:00Z'),
      decision('before', '2026-09-20T10:00:00Z', '2026-09-28T10:00:00Z'),
      decision('waiting', '2026-10-19T12:00:00Z', null),
      decision('older', '2026-09-30T12:00:00Z', null),
    ];
    const summary = summarizeTurnaround(facts, window, now);
    expect(summary).toMatchObject({
      decided: 3,
      medianHours: 10,
      slowestHours: 48,
      waiting: 2,
      oldestWaitingHours: 504,
    });
    expect(summary.slowest?.id).toBe('b');
    expect(slowestDecisions(facts, window, 2).map((item) => item.fact.id)).toEqual(['b', 'c']);
  });

  it('has no median or slowest when nothing was decided', () => {
    const summary = summarizeTurnaround(
      [decision('waiting', '2026-10-19T12:00:00Z', null)],
      { from: at('2026-10-01T00:00:00Z'), to: at('2026-11-01T00:00:00Z') },
      at('2026-10-20T12:00:00Z'),
    );
    expect(summary).toMatchObject({ decided: 0, medianHours: null, slowest: null, waiting: 1 });
  });
});

describe('leave taken', () => {
  const date = toCalendarDate;
  const range = { start: date('2026-10-01'), end: date('2026-10-31') };
  const today = date('2026-10-21');

  it('counts working days inside the range, half days as half, upcoming apart', () => {
    const across = leaveDaysInRange(
      {
        userId: 'u1',
        leaveTypeId: 'casual',
        startDate: date('2026-10-29'),
        endDate: date('2026-11-03'),
        dayPortion: 'full',
      },
      DEFAULT_WORKING_CALENDAR,
      range,
      today,
    );
    // 29, 30, 31 October are working days (Thu–Sat); November is outside the range.
    expect(across).toEqual({ days: 3, upcomingDays: 3 });
    const half = leaveDaysInRange(
      {
        userId: 'u1',
        leaveTypeId: 'casual',
        startDate: date('2026-10-05'),
        endDate: date('2026-10-05'),
        dayPortion: 'first_half',
      },
      DEFAULT_WORKING_CALENDAR,
      range,
      today,
    );
    expect(half).toEqual({ days: 0.5, upcomingDays: 0 });
  });

  it('groups by person and type and skips requests with no day in the range', () => {
    const breakdown = buildLeaveBreakdown(
      [
        {
          userId: 'u1',
          leaveTypeId: 'sick',
          startDate: date('2026-10-12'),
          endDate: date('2026-10-13'),
          dayPortion: 'full',
        },
        {
          userId: 'u1',
          leaveTypeId: 'sick',
          startDate: date('2026-10-20'),
          endDate: date('2026-10-20'),
          dayPortion: 'second_half',
        },
        {
          userId: 'u2',
          leaveTypeId: 'earned',
          startDate: date('2026-10-18'),
          endDate: date('2026-10-18'),
          dayPortion: 'full',
        },
        {
          userId: 'u2',
          leaveTypeId: 'earned',
          startDate: date('2026-11-10'),
          endDate: date('2026-11-12'),
          dayPortion: 'full',
        },
      ],
      () => DEFAULT_WORKING_CALENDAR,
      range,
      today,
    );
    expect(breakdown.byPersonAndType.get('u1:sick')).toMatchObject({ requests: 2, days: 2.5 });
    // 18 October is a Sunday: no working day, so the request is not counted.
    expect(breakdown.byPerson.get('u2')).toBeUndefined();
    expect(breakdown.totals).toEqual({ requests: 2, days: 2.5, upcomingDays: 0 });
  });
});
