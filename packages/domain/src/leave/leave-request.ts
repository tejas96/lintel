import { type CalendarDate, daysBetween } from '@lintel/shared';
import { type WorkingCalendar, workingDaysInRange } from '../calendar/working-calendar';

export const LEAVE_STATUSES = [
  'pending',
  'info_requested',
  'approved',
  'rejected',
  'cancelled',
] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

/** Half days are allowed only for single-day requests. */
export const DAY_PORTIONS = ['full', 'first_half', 'second_half'] as const;
export type DayPortion = (typeof DAY_PORTIONS)[number];

export interface LeavePeriod {
  readonly startDate: CalendarDate;
  readonly endDate: CalendarDate;
  readonly dayPortion: DayPortion;
}

export interface LeaveDay {
  readonly date: CalendarDate;
  /** 2 = full day, 1 = half day. Integers avoid fractional arithmetic. */
  readonly halfDayUnits: 1 | 2;
}

export interface LeavePeriodProblem {
  readonly field: 'startDate' | 'endDate' | 'dayPortion';
  readonly message: string;
}

export function validateLeavePeriod(period: LeavePeriod): LeavePeriodProblem[] {
  const problems: LeavePeriodProblem[] = [];
  if (period.endDate < period.startDate) {
    problems.push({
      field: 'endDate',
      message: 'The end date must be on or after the start date.',
    });
  }
  if (period.dayPortion !== 'full' && period.startDate !== period.endDate) {
    problems.push({
      field: 'dayPortion',
      message: 'Half days are only possible for a single day.',
    });
  }
  if (daysBetween(period.startDate, period.endDate) > 90) {
    problems.push({ field: 'endDate', message: 'A single request cannot be longer than 90 days.' });
  }
  return problems;
}

/** The working days a request takes, skipping weekends and holidays. */
export function leaveDays(period: LeavePeriod, calendar: WorkingCalendar): LeaveDay[] {
  const units: 1 | 2 = period.dayPortion === 'full' ? 2 : 1;
  return workingDaysInRange(calendar, period.startDate, period.endDate).map((date) => ({
    date,
    halfDayUnits: units,
  }));
}

export function totalHalfDayUnits(days: readonly LeaveDay[]): number {
  return days.reduce((total, day) => total + day.halfDayUnits, 0);
}

/** "1.5 days" style label from half-day units. */
export function formatLeaveDuration(halfDayUnits: number): string {
  const days = halfDayUnits / 2;
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

/** Statuses that hold the person's time and block overlapping requests. */
export const ACTIVE_LEAVE_STATUSES: readonly LeaveStatus[] = [
  'pending',
  'info_requested',
  'approved',
];

export const LEAVE_TRANSITIONS: Readonly<Record<LeaveStatus, readonly LeaveStatus[]>> = {
  pending: ['approved', 'rejected', 'info_requested', 'cancelled'],
  info_requested: ['pending', 'cancelled', 'rejected'],
  approved: ['cancelled'],
  rejected: [],
  cancelled: [],
};

export function isLegalLeaveTransition(from: LeaveStatus, to: LeaveStatus): boolean {
  return LEAVE_TRANSITIONS[from].includes(to);
}
