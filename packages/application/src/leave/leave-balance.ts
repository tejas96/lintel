import {
  type DayPortion,
  type LeaveStatus,
  leaveDays,
  totalHalfDayUnits,
  type WorkingCalendar,
} from '@lintel/domain';
import {
  type CalendarDate,
  maxCalendarDate,
  minCalendarDate,
  toCalendarDate,
} from '@lintel/shared';
import type { LeavePeriodRecord, LeaveTypeRecord } from './leave.store';

export interface LeaveDateRange {
  readonly start: CalendarDate;
  readonly end: CalendarDate;
}

export function calendarYearOf(date: CalendarDate): LeaveDateRange {
  const year = date.slice(0, 4);
  return { start: toCalendarDate(`${year}-01-01`), end: toCalendarDate(`${year}-12-31`) };
}

/**
 * Half-day units the requests take inside the range. A request fully inside
 * keeps the units stored when it was made; one crossing the boundary is
 * re-counted on the working days that fall inside.
 */
export function halfDaysWithinRange(
  requests: readonly Pick<
    LeavePeriodRecord,
    'startDate' | 'endDate' | 'dayPortion' | 'halfDayUnits'
  >[],
  range: LeaveDateRange,
  calendar: WorkingCalendar,
): number {
  return requests.reduce((total, request) => {
    if (request.startDate >= range.start && request.endDate <= range.end) {
      return total + request.halfDayUnits;
    }
    const start = maxCalendarDate(request.startDate, range.start);
    const end = minCalendarDate(request.endDate, range.end);
    if (start > end) return total;
    const portion: DayPortion = request.dayPortion;
    return (
      total +
      totalHalfDayUnits(
        leaveDays({ startDate: start, endDate: end, dayPortion: portion }, calendar),
      )
    );
  }, 0);
}

const PENDING_STATUSES: readonly LeaveStatus[] = ['pending', 'info_requested'];

export interface LeaveBalanceRow {
  readonly leaveType: { id: string; code: string; name: string; colorIndex: number };
  /** Null when the studio does not track an allowance for this type. */
  readonly allowanceHalfDays: number | null;
  /** Approved leave in the calendar year. Balance = allowance − used. */
  readonly usedHalfDays: number;
  readonly pendingHalfDays: number;
}

/** Per-type balance for one calendar year. */
export function buildLeaveBalances(
  types: readonly LeaveTypeRecord[],
  requests: readonly LeavePeriodRecord[],
  year: LeaveDateRange,
  calendar: WorkingCalendar,
): LeaveBalanceRow[] {
  return types.map((type) => {
    const ofType = requests.filter((request) => request.leaveTypeId === type.id);
    return {
      leaveType: { id: type.id, code: type.code, name: type.name, colorIndex: type.colorIndex },
      allowanceHalfDays: type.annualAllowanceHalfDays,
      usedHalfDays: halfDaysWithinRange(
        ofType.filter((request) => request.status === 'approved'),
        year,
        calendar,
      ),
      pendingHalfDays: halfDaysWithinRange(
        ofType.filter((request) => PENDING_STATUSES.includes(request.status)),
        year,
        calendar,
      ),
    };
  });
}
