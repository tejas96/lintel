/** Calendar dates ("2026-10-21") as whole UTC days, for timeline geometry. */
const DAY_MS = 86_400_000;

export function dayNumber(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Math.round(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1) / DAY_MS);
}

export function dateFromDayNumber(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function daysFrom(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}

/** Position of `date` between `start` and `end` as 0–1 (clamped). */
export function positionBetween(date: string, start: string, end: string): number {
  const span = Math.max(1, daysFrom(start, end));
  return Math.max(0, Math.min(1, daysFrom(start, date) / span));
}

const SHORT_DATE = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

/** "21 Oct". */
export function shortDate(date: string): string {
  return SHORT_DATE.format(new Date(dayNumber(date) * DAY_MS));
}
