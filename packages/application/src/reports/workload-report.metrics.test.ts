import { DEFAULT_WORKING_CALENDAR, type WorkingCalendar } from '@lintel/domain';
import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import { reportPeriods } from './report-periods';
import {
  spreadPlannedWork,
  summarizeWorkload,
  sumWorkload,
  type WorkloadPersonInput,
  workloadByDay,
  workloadByPeriod,
} from './workload-report.metrics';

const date = toCalendarDate;
// Monday 2 November to Sunday 8 November 2026; Monday–Saturday working, 480 minutes a day.
const week = { start: date('2026-11-02'), end: date('2026-11-08') };

function person(overrides: Partial<WorkloadPersonInput>): WorkloadPersonInput {
  return {
    calendar: DEFAULT_WORKING_CALENDAR,
    capacityPercent: 100,
    approvedLeave: [],
    tasks: [],
    sessions: [],
    ...overrides,
  };
}

describe('workload: available time', () => {
  it('counts working days only, scaled by capacity', () => {
    const full = sumWorkload(workloadByDay(person({}), week).values());
    expect(full.available).toBe(6 * 480);
    const half = sumWorkload(workloadByDay(person({ capacityPercent: 50 }), week).values());
    expect(half.available).toBe(6 * 240);
  });

  it('removes approved leave, half days by half, and skips holidays', () => {
    const calendar: WorkingCalendar = {
      ...DEFAULT_WORKING_CALENDAR,
      holidays: new Set([date('2026-11-06')]),
    };
    const days = workloadByDay(
      person({
        calendar,
        approvedLeave: [
          { date: date('2026-11-03'), halfDayUnits: 2 },
          { date: date('2026-11-04'), halfDayUnits: 1 },
        ],
      }),
      week,
    );
    expect(days.get(date('2026-11-03'))?.available).toBe(0);
    expect(days.get(date('2026-11-04'))?.available).toBe(240);
    expect(days.get(date('2026-11-06'))?.available).toBe(0);
    expect(sumWorkload(days.values()).available).toBe(3 * 480 + 240);
  });
});

describe('workload: planned time', () => {
  it('spreads an estimate over the working days of its window', () => {
    const spread = spreadPlannedWork(
      {
        estimateMinutes: 900,
        plannedStartDate: date('2026-11-06'),
        dueDate: date('2026-11-09'),
        tentative: false,
      },
      DEFAULT_WORKING_CALENDAR,
    );
    // Friday, Saturday and Monday; Sunday is skipped.
    expect([...spread]).toEqual([
      ['2026-11-06', 300],
      ['2026-11-07', 300],
      ['2026-11-09', 300],
    ]);
  });

  it('assumes 120 minutes without an estimate and lands it on the due date without a start', () => {
    const spread = spreadPlannedWork(
      {
        estimateMinutes: null,
        plannedStartDate: null,
        dueDate: date('2026-11-08'),
        tentative: false,
      },
      DEFAULT_WORKING_CALENDAR,
    );
    expect([...spread]).toEqual([['2026-11-08', 120]]);
  });

  it('counts only the part of the window inside the range, drafts apart', () => {
    const days = workloadByDay(
      person({
        tasks: [
          {
            estimateMinutes: 1200,
            plannedStartDate: date('2026-11-05'),
            dueDate: date('2026-11-10'),
            tentative: false,
          },
          {
            estimateMinutes: 60,
            plannedStartDate: date('2026-11-02'),
            dueDate: date('2026-11-02'),
            tentative: true,
          },
        ],
        sessions: [
          { day: date('2026-11-02'), minutes: 45 },
          { day: date('2026-11-12'), minutes: 300 },
        ],
      }),
      week,
    );
    const total = sumWorkload(days.values());
    // Thursday 5 to Tuesday 10 has five working days, three of them in the week: 3 × 240.
    expect(total.planned).toBe(720);
    expect(total.tentative).toBe(60);
    expect(total.logged).toBe(45);
  });
});

describe('workload: summary and periods', () => {
  it('reports planned ÷ available with the capacity load status', () => {
    expect(summarizeWorkload({ available: 2400, planned: 2600, tentative: 0, logged: 0 })).toEqual({
      availableMinutes: 2400,
      plannedMinutes: 2600,
      tentativeMinutes: 0,
      loggedMinutes: 0,
      utilization: 1.083,
      status: 'overloaded',
    });
    expect(summarizeWorkload({ available: 0, planned: 0, tentative: 0, logged: 0 })).toMatchObject({
      utilization: null,
      status: 'available',
    });
  });

  it('sums days into report periods', () => {
    const range = { start: date('2026-11-02'), end: date('2026-11-15') };
    const totals = workloadByPeriod(workloadByDay(person({}), range), reportPeriods(range, 'week'));
    expect(totals.map((period) => period.available)).toEqual([2880, 2880]);
  });
});
