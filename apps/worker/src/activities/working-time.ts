import {
  addWorkingDays,
  isWorkingDay,
  nextWorkingDayOnOrAfter,
  type WorkingCalendar,
} from '@lintel/domain';
import {
  addDays,
  type CalendarDate,
  calendarDateInTimeZone,
  zonedTimeToInstant,
} from '@lintel/shared';

/** Milliseconds from `now` until `at`; zero when `at` has passed. */
export function delayUntil(at: Date, now: Date): number {
  return Math.max(0, at.getTime() - now.getTime());
}

/** Local "HH:mm" (24-hour) of an instant in a timezone. */
export function localTimeOf(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instant);
}

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
    ? clampTime(localTimeOf(instant, zone), calendar.dayStartTime, calendar.dayEndTime)
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

/** "Mon 9 Nov" for a calendar date (no timezone shift: it is already a local date). */
export function formatCalendarDate(date: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

/** "Mon 9 Nov" for the local calendar date of an instant in the business timezone. */
export function formatLocalDate(instant: Date, timeZone: string): string {
  return formatCalendarDate(calendarDateInTimeZone(instant, timeZone));
}

/** "a, b, c and 2 more" — keeps notification bodies short. */
export function summariseList(items: readonly string[], shown = 5): string {
  if (items.length <= shown) return items.join(', ');
  return `${items.slice(0, shown).join(', ')} and ${items.length - shown} more`;
}
