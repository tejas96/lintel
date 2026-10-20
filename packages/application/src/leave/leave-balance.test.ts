import { DEFAULT_WORKING_CALENDAR } from '@lintel/domain';
import { type CalendarDate, toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import type { LeavePeriodRecord, LeaveTypeRecord } from './leave.store';
import { buildLeaveBalances, calendarYearOf, halfDaysWithinRange } from './leave-balance';

const date = toCalendarDate;
const year2026 = calendarYearOf(date('2026-06-15'));

function request(
  startDate: string,
  endDate: string,
  halfDayUnits: number,
  extra: Partial<LeavePeriodRecord> = {},
): LeavePeriodRecord {
  return {
    id: `${startDate}-${endDate}`,
    userId: 'ana',
    leaveTypeId: 'casual',
    startDate: startDate as CalendarDate,
    endDate: endDate as CalendarDate,
    dayPortion: 'full',
    halfDayUnits,
    status: 'approved',
    ...extra,
  };
}

const casual: LeaveTypeRecord = {
  id: 'casual',
  code: 'casual',
  name: 'Casual leave',
  colorIndex: 0,
  isActive: true,
  requiresReason: false,
  allowsHalfDay: true,
  minimumNoticeDays: 2,
  annualAllowanceHalfDays: 24,
};

describe('leave balance math', () => {
  it('uses the stored units for requests inside the year', () => {
    expect(year2026).toEqual({ start: '2026-01-01', end: '2026-12-31' });
    // The stored value wins even if the calendar changed since (e.g. a new holiday).
    expect(
      halfDaysWithinRange(
        [request('2026-03-02', '2026-03-04', 6)],
        year2026,
        DEFAULT_WORKING_CALENDAR,
      ),
    ).toBe(6);
  });

  it('re-counts only the working days inside the year for a request crossing it', () => {
    // 30 Dec 2026 (Wed) to 2 Jan 2027 (Sat): 30 and 31 Dec fall in 2026.
    const crossing = request('2026-12-30', '2027-01-02', 8);
    expect(halfDaysWithinRange([crossing], year2026, DEFAULT_WORKING_CALENDAR)).toBe(4);
    expect(
      halfDaysWithinRange([crossing], calendarYearOf(date('2027-01-01')), DEFAULT_WORKING_CALENDAR),
    ).toBe(4);
  });

  it('skips weekends and holidays when re-counting', () => {
    const calendar = { ...DEFAULT_WORKING_CALENDAR, holidays: new Set([date('2026-12-31')]) };
    // 26 Dec (Sat) to 3 Jan: in 2026 only 26, 28, 29, 30 are working days (27 is Sunday, 31 a holiday).
    expect(halfDaysWithinRange([request('2026-12-26', '2027-01-03', 14)], year2026, calendar)).toBe(
      8,
    );
  });

  it('builds balances: approved counts as used, pending and info-requested as pending', () => {
    const [row] = buildLeaveBalances(
      [casual],
      [
        request('2026-02-02', '2026-02-03', 4),
        request('2026-05-04', '2026-05-04', 1, { dayPortion: 'first_half', status: 'pending' }),
        request('2026-07-06', '2026-07-06', 2, { status: 'info_requested' }),
        request('2026-08-03', '2026-08-03', 2, { status: 'cancelled' }),
        request('2026-09-07', '2026-09-07', 2, { leaveTypeId: 'sick' }),
      ],
      year2026,
      DEFAULT_WORKING_CALENDAR,
    );
    expect(row).toEqual({
      leaveType: { id: 'casual', code: 'casual', name: 'Casual leave', colorIndex: 0 },
      allowanceHalfDays: 24,
      usedHalfDays: 4,
      pendingHalfDays: 3,
    });
  });
});
