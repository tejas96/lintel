import { shiftByWorkingDays } from '@lintel/application';
import type { WorkingCalendar } from '@lintel/domain';
import {
  type CalendarDate,
  calendarDateInTimeZone,
  toCalendarDate,
  zonedTimeToInstant,
} from '@lintel/shared';

export const MINUTE_MS = 60_000;
export const HOUR_MS = 3_600_000;

/**
 * A stable, well-spread number for a text (FNV-1a with a final mix), so the
 * demo history varies from task to task without ever depending on chance.
 */
export function stableHash(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35) >>> 0;
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/** "HH:mm" for a number of minutes after midnight. */
export function clockTime(minutesAfterMidnight: number): string {
  const hours = Math.floor(minutesAfterMidnight / 60);
  const minutes = minutesAfterMidnight % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function plusMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * MINUTE_MS);
}

export function plusHours(instant: Date, hours: number): Date {
  return new Date(instant.getTime() + hours * HOUR_MS);
}

export function latestOf(instants: readonly (Date | null)[]): Date | null {
  let latest: Date | null = null;
  for (const instant of instants) {
    if (instant && (!latest || instant > latest)) latest = instant;
  }
  return latest;
}

/** Business-timezone dates and times for the history, anchored on one "now". */
export interface HistoryClock {
  readonly now: Date;
  readonly today: CalendarDate;
  readonly timeZone: string;
  readonly calendar: WorkingCalendar;
  /** A wall-clock time ("HH:mm") on a business date, as a UTC instant. */
  at(date: string, time: string): Date;
  /** The business date an instant falls on. */
  dateOf(instant: Date): CalendarDate;
  /** The instant, or a few minutes ago when it would otherwise be in the future. */
  past(instant: Date): Date;
  /** Moves a date by working days (negative is earlier). */
  shift(date: string, workingDays: number): CalendarDate;
}

export function createHistoryClock(
  now: Date,
  timeZone: string,
  calendar: WorkingCalendar,
): HistoryClock {
  const latestAllowed = now.getTime() - 5 * MINUTE_MS;
  return {
    now,
    today: calendarDateInTimeZone(now, timeZone),
    timeZone,
    calendar,
    at: (date, time) => zonedTimeToInstant(toCalendarDate(date), time, timeZone),
    dateOf: (instant) => calendarDateInTimeZone(instant, timeZone),
    past: (instant) => (instant.getTime() > latestAllowed ? new Date(latestAllowed) : instant),
    shift: (date, workingDays) => shiftByWorkingDays(calendar, toCalendarDate(date), workingDays),
  };
}
