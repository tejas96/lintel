import { describe, expect, it } from 'vitest';
import { dueLabel, formatDateRange, relativeDayLabel, withReadableDates } from './dates';
import { formatElapsed, formatHalfDayNumber, formatHalfDays, formatMinutes } from './quantities';

describe('dates', () => {
  it('describes due dates relative to the business day', () => {
    expect(dueLabel('2026-10-21', '2026-10-21')).toBe('Due today');
    expect(dueLabel('2026-10-22', '2026-10-21')).toBe('Due tomorrow');
    expect(dueLabel('2026-10-20', '2026-10-21')).toBe('1 day overdue');
    expect(dueLabel('2026-10-18', '2026-10-21')).toBe('3 days overdue');
    expect(dueLabel(null, '2026-10-21')).toBe('No due date');
    expect(relativeDayLabel('2026-10-27', '2026-10-21')).toBe('in 6 days');
  });

  it('keeps calendar dates on their day in any phone timezone', () => {
    expect(formatDateRange('2026-10-26', '2026-10-28')).toBe('26 – 28 Oct');
    expect(formatDateRange('2026-10-30', '2026-11-02')).toBe('30 Oct – 2 Nov');
  });

  it('makes server sentences with ISO dates readable', () => {
    expect(withReadableDates('#1: due 2026-10-26 → 2026-10-30')).toBe('#1: due 26 Oct → 30 Oct');
    expect(withReadableDates('No dates here, version 2026-1')).toBe(
      'No dates here, version 2026-1',
    );
  });
});

describe('quantities', () => {
  it('formats durations and leave in half days', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(150)).toBe('2 h 30 min');
    expect(formatElapsed(3849)).toBe('1:04:09');
    expect(formatHalfDays(1)).toBe('½ day');
    expect(formatHalfDays(2)).toBe('1 day');
    expect(formatHalfDays(3)).toBe('1½ days');
    expect(formatHalfDayNumber(24)).toBe('12');
  });
});
