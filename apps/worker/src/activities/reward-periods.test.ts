import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import { closedPeriodStart } from './reward-periods';

describe('closed reward periods', () => {
  it('evaluates the previous month, across a year boundary', () => {
    expect(closedPeriodStart('monthly', toCalendarDate('2026-11-01'))).toBe('2026-10-01');
    expect(closedPeriodStart('monthly', toCalendarDate('2027-01-01'))).toBe('2026-12-01');
  });

  it('evaluates the previous quarter only in the first month of a quarter', () => {
    expect(closedPeriodStart('quarterly', toCalendarDate('2026-10-01'))).toBe('2026-07-01');
    expect(closedPeriodStart('quarterly', toCalendarDate('2027-01-01'))).toBe('2026-10-01');
    expect(closedPeriodStart('quarterly', toCalendarDate('2026-11-01'))).toBeNull();
  });
});
