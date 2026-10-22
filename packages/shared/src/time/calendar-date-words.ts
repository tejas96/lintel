/**
 * Calendar dates in words for sentences people read ("28 Oct", "28 Oct 2027").
 * Never put a raw ISO date ("2026-10-28") into a notification, activity
 * summary or health reason; format it here so every surface reads the same.
 */
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(withYear: boolean): Intl.DateTimeFormat {
  const key = withYear ? 'dmy' : 'dm';
  let existing = formatters.get(key);
  if (!existing) {
    existing = new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      ...(withYear ? { year: 'numeric' } : {}),
      timeZone: 'UTC',
    });
    formatters.set(key, existing);
  }
  return existing;
}

/** "28 Oct" for a calendar date; adds the year when it differs from `referenceDate` (usually today). */
export function formatCalendarDateWords(date: string, referenceDate?: string): string {
  const withYear = referenceDate !== undefined && referenceDate.slice(0, 4) !== date.slice(0, 4);
  return formatter(withYear).format(new Date(`${date}T12:00:00Z`));
}

/** "14 Nov–27 Nov" (or "14 Nov" when the range is a single day). */
export function formatCalendarRangeWords(
  start: string,
  end: string,
  referenceDate?: string,
): string {
  const from = formatCalendarDateWords(start, referenceDate);
  return start === end ? from : `${from}–${formatCalendarDateWords(end, referenceDate)}`;
}

const ISO_DATE_IN_TEXT = /\b(\d{4}-\d{2}-\d{2})\b/g;

/** Server sentences that still carry ISO dates ("due 2026-10-28") made readable. */
export function withCalendarDateWords(text: string, referenceDate?: string): string {
  return text.replace(ISO_DATE_IN_TEXT, (date) => formatCalendarDateWords(date, referenceDate));
}
