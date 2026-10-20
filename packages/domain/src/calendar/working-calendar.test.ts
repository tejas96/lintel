import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import {
  addWorkingDays,
  DEFAULT_WORKING_CALENDAR,
  isWorkingDay,
  nextWorkingDayOnOrAfter,
  type WorkingCalendar,
  workingDaysBetween,
} from './working-calendar';

const date = toCalendarDate;
const calendarWithDiwali: WorkingCalendar = {
  ...DEFAULT_WORKING_CALENDAR,
  holidays: new Set([date('2026-11-09')]),
};

describe('working calendar', () => {
  it('treats Sundays and holidays as non-working days', () => {
    expect(isWorkingDay(calendarWithDiwali, date('2026-11-07'))).toBe(true);
    expect(isWorkingDay(calendarWithDiwali, date('2026-11-08'))).toBe(false);
    expect(isWorkingDay(calendarWithDiwali, date('2026-11-09'))).toBe(false);
  });

  it('skips forward to the next working day', () => {
    expect(nextWorkingDayOnOrAfter(calendarWithDiwali, date('2026-11-08'))).toBe('2026-11-10');
  });

  it('adds working days across weekends and holidays', () => {
    expect(addWorkingDays(calendarWithDiwali, date('2026-11-06'), 0)).toBe('2026-11-06');
    expect(addWorkingDays(calendarWithDiwali, date('2026-11-06'), 2)).toBe('2026-11-10');
  });

  it('counts working days between two dates', () => {
    expect(workingDaysBetween(calendarWithDiwali, date('2026-11-06'), date('2026-11-11'))).toBe(3);
    expect(workingDaysBetween(calendarWithDiwali, date('2026-11-11'), date('2026-11-06'))).toBe(-3);
  });

  it('rejects calendars without working days', () => {
    const broken = { ...DEFAULT_WORKING_CALENDAR, workingWeekdays: [] };
    expect(() => nextWorkingDayOnOrAfter(broken, date('2026-11-06'))).toThrow(RangeError);
  });
});
