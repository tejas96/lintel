import { afterWorkingDays, previousWorkingDay } from '@lintel/domain';
import { calendarDateInTimeZone, localTimeInTimeZone } from '@lintel/shared';

/** Milliseconds from `now` until `at`; zero when `at` has passed. */
export function delayUntil(at: Date, now: Date): number {
  return Math.max(0, at.getTime() - now.getTime());
}

/** Local "HH:mm" (24-hour) of an instant in a timezone. */
export const localTimeOf = localTimeInTimeZone;

export { afterWorkingDays, previousWorkingDay };

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
