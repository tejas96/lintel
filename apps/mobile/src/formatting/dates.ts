import { type CalendarDate, daysBetween, isCalendarDate } from '@lintel/shared';

const LOCALE = 'en-IN';

/** Calendar dates are formatted as UTC so the day never shifts with the phone's timezone. */
function calendarDateToUtc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

const SHORT_DATE = new Intl.DateTimeFormat(LOCALE, {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const DAY_MONTH = new Intl.DateTimeFormat(LOCALE, {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
});
const LONG_DATE = new Intl.DateTimeFormat(LOCALE, {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** "Thu, 23 Oct" */
export function formatShortDate(date: string): string {
  return SHORT_DATE.format(calendarDateToUtc(date));
}

/** "23 Oct" */
export function formatDayMonth(date: string): string {
  return DAY_MONTH.format(calendarDateToUtc(date));
}

/** "Tuesday 21 October" */
export function formatLongDate(date: string): string {
  return LONG_DATE.format(calendarDateToUtc(date)).replace(',', '');
}

/** "23 – 25 Oct" or "30 Oct – 2 Nov" */
export function formatDateRange(start: string, end: string): string {
  if (start === end) return formatDayMonth(start);
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  const startLabel = sameMonth ? String(Number(start.slice(8, 10))) : formatDayMonth(start);
  return `${startLabel} – ${formatDayMonth(end)}`;
}

/** Server sentences carry ISO dates ("due 2026-10-26"); people read "due 26 Oct". */
export function withReadableDates(text: string): string {
  return text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, (date) =>
    isCalendarDate(date) ? formatDayMonth(date) : date,
  );
}

function asCalendarDate(value: string): CalendarDate | null {
  return isCalendarDate(value) ? value : null;
}

/** "Due today", "Due tomorrow", "Due Thu, 23 Oct", "2 days overdue". */
export function dueLabel(dueDate: string | null, today: string): string {
  if (!dueDate) return 'No due date';
  const due = asCalendarDate(dueDate);
  const now = asCalendarDate(today);
  if (!due || !now) return `Due ${formatShortDate(dueDate)}`;
  const days = daysBetween(now, due);
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days === -1) return '1 day overdue';
  if (days < 0) return `${-days} days overdue`;
  return `Due ${formatShortDate(dueDate)}`;
}

/** Distance only, for use beside a printed date: "today", "in 6 days", "2 days overdue". */
export function relativeDayLabel(date: string, today: string): string {
  const target = asCalendarDate(date);
  const now = asCalendarDate(today);
  if (!target || !now) return '';
  const days = daysBetween(now, target);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days > 1) return `in ${days} days`;
  return days === -1 ? '1 day overdue' : `${-days} days overdue`;
}

const TIME = new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit' });
const DATE_TIME = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

/** Instants: "just now", "12 min ago", "3 h ago", then "21 Oct, 4:05 pm". */
export function formatRelativeInstant(instant: string, now: Date = new Date()): string {
  const then = new Date(instant);
  const minutes = Math.round((now.getTime() - then.getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24 && then.getDate() === now.getDate()) return `${hours} h ago`;
  if (hours < 48) return `Yesterday, ${TIME.format(then)}`;
  return DATE_TIME.format(then);
}

export function formatInstant(instant: string): string {
  return DATE_TIME.format(new Date(instant));
}

/** "Good morning" in the person's own local time. */
export function greetingFor(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
