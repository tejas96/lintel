import { type DayPortion, leaveDays, type WorkingCalendar } from '@lintel/domain';
import type { CalendarDate } from '@lintel/shared';
import type { ReportSpan } from './report-plan';

/** An approved leave request (urgent absences included: they are approved when recorded). */
export interface ApprovedLeaveFact {
  readonly userId: string;
  readonly leaveTypeId: string;
  readonly startDate: CalendarDate;
  readonly endDate: CalendarDate;
  readonly dayPortion: DayPortion;
}

export interface LeaveDaysInRange {
  /** Working days of leave inside the range (a half day counts 0.5). */
  readonly days: number;
  /** The part of `days` after today: booked, not yet taken. */
  readonly upcomingDays: number;
}

/**
 * Leave days = the request's working days (weekends and holidays skipped, as
 * when it was requested) that fall inside the range; half days count half.
 */
export function leaveDaysInRange(
  fact: ApprovedLeaveFact,
  calendar: WorkingCalendar,
  range: ReportSpan,
  today: CalendarDate,
): LeaveDaysInRange {
  const inside = leaveDays(fact, calendar).filter(
    (day) => day.date >= range.start && day.date <= range.end,
  );
  const units = (days: typeof inside) => days.reduce((total, day) => total + day.halfDayUnits, 0);
  return {
    days: units(inside) / 2,
    upcomingDays: units(inside.filter((day) => day.date > today)) / 2,
  };
}

export interface LeaveTotals {
  readonly requests: number;
  readonly days: number;
  readonly upcomingDays: number;
}

export interface LeaveBreakdown {
  /** Keyed `${userId}:${leaveTypeId}`. */
  readonly byPersonAndType: ReadonlyMap<string, LeaveTotals & { userId: string; typeId: string }>;
  readonly byType: ReadonlyMap<string, LeaveTotals>;
  readonly byPerson: ReadonlyMap<string, LeaveTotals>;
  readonly totals: LeaveTotals;
}

const add = (left: LeaveTotals, right: LeaveTotals): LeaveTotals => ({
  requests: left.requests + right.requests,
  days: left.days + right.days,
  upcomingDays: left.upcomingDays + right.upcomingDays,
});

const NONE: LeaveTotals = { requests: 0, days: 0, upcomingDays: 0 };

/** Approved leave in the range per person and type. Requests with no day inside are skipped. */
export function buildLeaveBreakdown(
  facts: readonly ApprovedLeaveFact[],
  calendarOf: (userId: string) => WorkingCalendar,
  range: ReportSpan,
  today: CalendarDate,
): LeaveBreakdown {
  const byPersonAndType = new Map<string, LeaveTotals & { userId: string; typeId: string }>();
  const byType = new Map<string, LeaveTotals>();
  const byPerson = new Map<string, LeaveTotals>();
  let totals = NONE;
  for (const fact of facts) {
    const inRange = leaveDaysInRange(fact, calendarOf(fact.userId), range, today);
    if (inRange.days === 0) continue;
    const part = { requests: 1, ...inRange };
    const key = `${fact.userId}:${fact.leaveTypeId}`;
    byPersonAndType.set(key, {
      ...add(byPersonAndType.get(key) ?? NONE, part),
      userId: fact.userId,
      typeId: fact.leaveTypeId,
    });
    byType.set(fact.leaveTypeId, add(byType.get(fact.leaveTypeId) ?? NONE, part));
    byPerson.set(fact.userId, add(byPerson.get(fact.userId) ?? NONE, part));
    totals = add(totals, part);
  }
  return { byPersonAndType, byType, byPerson, totals };
}
