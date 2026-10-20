import { DEFAULT_WORKING_CALENDAR } from '@lintel/domain';
import { type CalendarDate, toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import { afterWorkingDays, delayUntil, previousWorkingDay, summariseList } from './working-time';

const calendar = {
  ...DEFAULT_WORKING_CALENDAR,
  holidays: new Set<CalendarDate>([toCalendarDate('2026-11-11')]),
};

describe('working time', () => {
  it('moves to the same time on the next working day', () => {
    // Tuesday 10 Nov, 15:00 IST → Thursday 12 Nov (Wednesday is a holiday).
    const submitted = new Date('2026-11-10T09:30:00.000Z');
    expect(afterWorkingDays(calendar, submitted, 1).toISOString()).toBe('2026-11-12T09:30:00.000Z');
    expect(afterWorkingDays(calendar, submitted, 3).toISOString()).toBe('2026-11-14T09:30:00.000Z');
  });

  it('clamps into working hours and starts non-working days at day start', () => {
    // Saturday 7 Nov 22:00 IST → clamped to 18:30 → Monday 9 Nov 18:30 IST.
    expect(afterWorkingDays(calendar, new Date('2026-11-07T16:30:00.000Z'), 1).toISOString()).toBe(
      '2026-11-09T13:00:00.000Z',
    );
    // Sunday 8 Nov → Monday is day 0, Tuesday 09:30 IST is one working day later.
    expect(afterWorkingDays(calendar, new Date('2026-11-08T06:00:00.000Z'), 1).toISOString()).toBe(
      '2026-11-10T04:00:00.000Z',
    );
  });

  it('finds the previous working day across weekends and holidays', () => {
    expect(previousWorkingDay(calendar, toCalendarDate('2026-11-09'))).toBe('2026-11-07');
    expect(previousWorkingDay(calendar, toCalendarDate('2026-11-12'))).toBe('2026-11-10');
  });

  it('never returns a negative delay and keeps lists short', () => {
    const now = new Date('2026-11-09T06:00:00.000Z');
    expect(delayUntil(new Date('2026-11-09T05:00:00.000Z'), now)).toBe(0);
    expect(delayUntil(new Date('2026-11-09T06:00:02.000Z'), now)).toBe(2000);
    expect(summariseList(['a', 'b', 'c'], 2)).toBe('a, b and 1 more');
  });
});
