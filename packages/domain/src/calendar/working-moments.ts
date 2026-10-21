import {
  addDays,
  type CalendarDate,
  calendarDateInTimeZone,
  localTimeInTimeZone,
  zonedTimeToInstant,
} from '@lintel/shared';
import {
  addWorkingDays,
  isWorkingDay,
  nextWorkingDayOnOrAfter,
  type WorkingCalendar,
} from './working-calendar';

function clampTime(time: string, earliest: string, latest: string): string {
  if (time < earliest) return earliest;
  if (time > latest) return latest;
  return time;
}

/**
 * The same working moment `workingDays` working days later: a review
 * submitted on Tuesday at 15:00 is followed up on Wednesday at 15:00 (or
 * the next working day). Times outside working hours are clamped into them,
 * and anything raised on a non-working day counts from the next day's start.
 */
export function afterWorkingDays(
  calendar: WorkingCalendar,
  instant: Date,
  workingDays: number,
): Date {
  const zone = calendar.timeZone;
  const date = calendarDateInTimeZone(instant, zone);
  const working = isWorkingDay(calendar, date);
  const startDay = working ? date : nextWorkingDayOnOrAfter(calendar, date);
  const time = working
    ? clampTime(localTimeInTimeZone(instant, zone), calendar.dayStartTime, calendar.dayEndTime)
    : calendar.dayStartTime;
  return zonedTimeToInstant(addWorkingDays(calendar, startDay, workingDays), time, zone);
}

/** The last working day strictly before `date`. */
export function previousWorkingDay(calendar: WorkingCalendar, date: CalendarDate): CalendarDate {
  let candidate = addDays(date, -1);
  for (let guard = 0; guard < 366 && !isWorkingDay(calendar, candidate); guard += 1) {
    candidate = addDays(candidate, -1);
  }
  return candidate;
}

/** The first working day strictly after `date`. */
export function nextWorkingDayAfter(calendar: WorkingCalendar, date: CalendarDate): CalendarDate {
  return nextWorkingDayOnOrAfter(calendar, addDays(date, 1));
}
