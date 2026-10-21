import { zonedParts } from './time-zone';

/** A 24-hour wall-clock time, "HH:mm" (00:00–23:59). */
const TIME_OF_DAY = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isTimeOfDay(value: string): boolean {
  return TIME_OF_DAY.test(value);
}

/** The wall-clock time ("HH:mm") it is at an instant in the given timezone. */
export function timeOfDayInTimeZone(instant: Date, timeZone: string): string {
  const parts = zonedParts(instant, timeZone);
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

/** Orders two "HH:mm" times; plain string order works because both are zero-padded. */
export function compareTimesOfDay(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
