import { describe, expect, it } from 'vitest';
import {
  formatCalendarDateWords,
  formatCalendarRangeWords,
  withCalendarDateWords,
} from './calendar-date-words';

describe('calendar dates in words', () => {
  it('writes day and short month', () => {
    expect(formatCalendarDateWords('2026-10-28')).toBe('28 Oct');
  });

  it('adds the year only when it differs from the reference date', () => {
    expect(formatCalendarDateWords('2027-01-04', '2026-10-22')).toBe('4 Jan 2027');
    expect(formatCalendarDateWords('2026-01-04', '2026-10-22')).toBe('4 Jan');
  });

  it('writes ranges with an en dash', () => {
    expect(formatCalendarRangeWords('2026-11-14', '2026-11-27')).toBe('14 Nov–27 Nov');
    expect(formatCalendarRangeWords('2026-11-14', '2026-11-14')).toBe('14 Nov');
  });

  it('replaces ISO dates inside sentences', () => {
    expect(withCalendarDateWords('due 2026-10-28 → 2026-10-30')).toBe('due 28 Oct → 30 Oct');
  });
});
