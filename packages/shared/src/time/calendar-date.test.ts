import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  eachCalendarDate,
  isCalendarDate,
  isoWeekday,
  rangesOverlap,
  toCalendarDate,
} from './calendar-date';

describe('calendar dates', () => {
  it('accepts real dates and rejects impossible ones', () => {
    expect(isCalendarDate('2026-02-28')).toBe(true);
    expect(isCalendarDate('2026-02-30')).toBe(false);
    expect(isCalendarDate('2026-2-3')).toBe(false);
    expect(() => toCalendarDate('tomorrow')).toThrow(RangeError);
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays(toCalendarDate('2026-12-31'), 1)).toBe('2027-01-01');
    expect(addDays(toCalendarDate('2026-03-01'), -1)).toBe('2026-02-28');
  });

  it('counts days between dates in both directions', () => {
    const start = toCalendarDate('2026-10-01');
    const end = toCalendarDate('2026-10-21');
    expect(daysBetween(start, end)).toBe(20);
    expect(daysBetween(end, start)).toBe(-20);
  });

  it('uses ISO weekdays with Monday as 1', () => {
    expect(isoWeekday(toCalendarDate('2026-10-19'))).toBe(1);
    expect(isoWeekday(toCalendarDate('2026-10-25'))).toBe(7);
  });

  it('lists inclusive ranges and detects overlaps', () => {
    const range = eachCalendarDate(toCalendarDate('2026-10-30'), toCalendarDate('2026-11-02'));
    expect(range).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
    const first = { start: toCalendarDate('2026-10-01'), end: toCalendarDate('2026-10-05') };
    const touching = { start: toCalendarDate('2026-10-05'), end: toCalendarDate('2026-10-09') };
    const later = { start: toCalendarDate('2026-10-06'), end: toCalendarDate('2026-10-09') };
    expect(rangesOverlap(first, touching)).toBe(true);
    expect(rangesOverlap(first, later)).toBe(false);
  });
});
