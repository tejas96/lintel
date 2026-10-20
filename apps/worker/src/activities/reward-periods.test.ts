import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import { scheduleIdFor } from '../schedules/daily-operations.schedule';
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

describe('schedule IDs per task queue', () => {
  it('keeps plain IDs for the main queue and suffixes others', () => {
    expect(scheduleIdFor('lintel-daily-operations', 'lintel-main')).toBe('lintel-daily-operations');
    expect(scheduleIdFor('lintel-daily-operations', 'lintel-web2')).toBe(
      'lintel-daily-operations--lintel-web2',
    );
  });
});
