import { addDays, type CalendarDate, eachCalendarDate, isoWeekday } from '@lintel/shared';

/**
 * When people work. Holidays are full non-working days; partial holidays are
 * not modelled yet.
 */
export interface WorkingCalendar {
  readonly timeZone: string;
  /** ISO weekdays, 1 = Monday … 7 = Sunday. */
  readonly workingWeekdays: readonly number[];
  readonly dayStartTime: string;
  readonly dayEndTime: string;
  readonly workingMinutesPerDay: number;
  readonly holidays: ReadonlySet<CalendarDate>;
}

/** Monday to Saturday, 09:30–18:30 with a one-hour break: common for Indian studios. */
export const DEFAULT_WORKING_CALENDAR: WorkingCalendar = {
  timeZone: 'Asia/Kolkata',
  workingWeekdays: [1, 2, 3, 4, 5, 6],
  dayStartTime: '09:30',
  dayEndTime: '18:30',
  workingMinutesPerDay: 480,
  holidays: new Set(),
};

export function isWorkingDay(calendar: WorkingCalendar, date: CalendarDate): boolean {
  return calendar.workingWeekdays.includes(isoWeekday(date)) && !calendar.holidays.has(date);
}

/** The given date if it is a working day, otherwise the next working day. */
export function nextWorkingDayOnOrAfter(
  calendar: WorkingCalendar,
  date: CalendarDate,
): CalendarDate {
  assertCalendarHasWorkingDays(calendar);
  let current = date;
  while (!isWorkingDay(calendar, current)) current = addDays(current, 1);
  return current;
}

/**
 * Moves forward by working days. `addWorkingDays(cal, monday, 0)` returns
 * Monday (or the next working day); a 3-day task starting Monday ends on
 * `addWorkingDays(cal, monday, 2)`.
 */
export function addWorkingDays(
  calendar: WorkingCalendar,
  start: CalendarDate,
  workingDays: number,
): CalendarDate {
  let current = nextWorkingDayOnOrAfter(calendar, start);
  let remaining = workingDays;
  while (remaining > 0) {
    current = nextWorkingDayOnOrAfter(calendar, addDays(current, 1));
    remaining -= 1;
  }
  return current;
}

/** The given date if it is a working day, otherwise the working day before it. */
export function previousWorkingDayOnOrBefore(
  calendar: WorkingCalendar,
  date: CalendarDate,
): CalendarDate {
  assertCalendarHasWorkingDays(calendar);
  let current = date;
  while (!isWorkingDay(calendar, current)) current = addDays(current, -1);
  return current;
}

/** Moves a date by working days in either direction; 0 snaps to the next working day. */
export function shiftByWorkingDays(
  calendar: WorkingCalendar,
  date: CalendarDate,
  days: number,
): CalendarDate {
  if (days >= 0) return addWorkingDays(calendar, date, days);
  let current = previousWorkingDayOnOrBefore(calendar, date);
  for (let remaining = -days; remaining > 0; remaining -= 1) {
    current = previousWorkingDayOnOrBefore(calendar, addDays(current, -1));
  }
  return current;
}

export function workingDaysInRange(
  calendar: WorkingCalendar,
  start: CalendarDate,
  end: CalendarDate,
): CalendarDate[] {
  return eachCalendarDate(start, end).filter((date) => isWorkingDay(calendar, date));
}

/** Working days strictly after `from` up to and including `to`. Negative if `to` is earlier. */
export function workingDaysBetween(
  calendar: WorkingCalendar,
  from: CalendarDate,
  to: CalendarDate,
): number {
  if (from === to) return 0;
  if (to < from) return -workingDaysBetween(calendar, to, from);
  return workingDaysInRange(calendar, addDays(from, 1), to).length;
}

function assertCalendarHasWorkingDays(calendar: WorkingCalendar): void {
  if (calendar.workingWeekdays.length === 0) {
    throw new RangeError('A working calendar needs at least one working weekday.');
  }
}
