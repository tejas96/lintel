/**
 * Calendar dates ("2026-10-21") without a time or timezone. Schedules, due
 * dates and leave days are calendar dates in the business timezone; instants
 * (createdAt, sentAt) are stored separately as UTC timestamps.
 */
export type CalendarDate = string & { readonly __brand: 'CalendarDate' };

const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MILLISECONDS_PER_DAY = 86_400_000;

export function isCalendarDate(value: string): value is CalendarDate {
  const match = CALENDAR_DATE_PATTERN.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return parsed.toISOString().slice(0, 10) === value;
}

export function toCalendarDate(value: string): CalendarDate {
  if (!isCalendarDate(value)) {
    throw new RangeError(`"${value}" is not a valid calendar date (expected YYYY-MM-DD).`);
  }
  return value;
}

function toUtcMidnight(date: CalendarDate): number {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

function fromUtcMilliseconds(milliseconds: number): CalendarDate {
  return new Date(milliseconds).toISOString().slice(0, 10) as CalendarDate;
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  return fromUtcMilliseconds(toUtcMidnight(date) + days * MILLISECONDS_PER_DAY);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: CalendarDate, to: CalendarDate): number {
  return Math.round((toUtcMidnight(to) - toUtcMidnight(from)) / MILLISECONDS_PER_DAY);
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: CalendarDate): number {
  const weekday = new Date(toUtcMidnight(date)).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

export function compareCalendarDates(left: CalendarDate, right: CalendarDate): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function minCalendarDate(left: CalendarDate, right: CalendarDate): CalendarDate {
  return left <= right ? left : right;
}

export function maxCalendarDate(left: CalendarDate, right: CalendarDate): CalendarDate {
  return left >= right ? left : right;
}

/** Inclusive range of dates. Returns an empty list when `end` is before `start`. */
export function eachCalendarDate(start: CalendarDate, end: CalendarDate): CalendarDate[] {
  const dates: CalendarDate[] = [];
  for (let current = start; current <= end; current = addDays(current, 1)) {
    dates.push(current);
  }
  return dates;
}

export function rangesOverlap(
  first: { start: CalendarDate; end: CalendarDate },
  second: { start: CalendarDate; end: CalendarDate },
): boolean {
  return first.start <= second.end && second.start <= first.end;
}
