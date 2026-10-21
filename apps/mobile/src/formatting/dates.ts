import { type CalendarDate, daysBetween, isCalendarDate, spokenTimeOfDay } from '@lintel/shared';

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

function asCalendarDate(value: string): CalendarDate | null {
  return isCalendarDate(value) ? value : null;
}

/** Whole days from `today` to `date`; null when either is not a calendar date. */
function dayDistance(date: string, today: string): number | null {
  const target = asCalendarDate(date);
  const now = asCalendarDate(today);
  return target && now ? daysBetween(now, target) : null;
}

/** "Due today", "Due tomorrow", "Due Thu, 23 Oct", "2 days overdue". */
export function dueLabel(dueDate: string | null, today: string): string {
  if (!dueDate) return 'No due date';
  const days = dayDistance(dueDate, today);
  if (days === null) return `Due ${formatShortDate(dueDate)}`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days === -1) return '1 day overdue';
  if (days < 0) return `${-days} days overdue`;
  return `Due ${formatShortDate(dueDate)}`;
}

/** Distance only, for use beside a printed date: "today", "in 6 days", "2 days overdue". */
export function relativeDayLabel(date: string, today: string): string {
  const days = dayDistance(date, today);
  if (days === null) return '';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days > 1) return `in ${days} days`;
  return days === -1 ? '1 day overdue' : `${-days} days overdue`;
}

/**
 * A studio wall-clock time ("HH:mm", never shifted to the phone's timezone):
 * "14:30" → "2:30 pm", the same words the server uses.
 */
export const formatTimeOfDay = spokenTimeOfDay;

/** The due fields every task carries; a null time means "by the end of the working day". */
export interface TaskDue {
  readonly dueDate: string | null;
  readonly dueTime: string | null;
  readonly isOverdue: boolean;
}

export interface DueLabel {
  readonly text: string;
  /** Shown in the overdue tone: the server's `isOverdue`, true once the due moment has passed. */
  readonly late: boolean;
}

/**
 * `dueLabel` with the task's due time: "Due 11:00 am today", "Was due 11:00 am",
 * "Due 11:00 am tomorrow", "Due Fri, 23 Oct, 11:00 am". Earlier days keep "2 days overdue".
 */
export function taskDueLabel(task: TaskDue, today: string): DueLabel {
  const late = task.isOverdue;
  const text = dueLabel(task.dueDate, today);
  if (!task.dueDate || !task.dueTime) return { text, late };
  const time = formatTimeOfDay(task.dueTime);
  const days = dayDistance(task.dueDate, today);
  if (days === 0) return { text: late ? `Was due ${time}` : `Due ${time} today`, late };
  if (days === 1) return { text: `Due ${time} tomorrow`, late };
  if (days === null || days > 1) return { text: `${text}, ${time}`, late };
  return { text, late };
}

/** The printed due moment beside its distance: "Fri, 23 Oct, 11:00 am · in 2 days". */
export function dueDateLine(task: Omit<TaskDue, 'isOverdue'>, today: string): string {
  if (!task.dueDate) return 'No due date';
  const time = task.dueTime ? `, ${formatTimeOfDay(task.dueTime)}` : '';
  const relative = relativeDayLabel(task.dueDate, today);
  return `${formatShortDate(task.dueDate)}${time}${relative ? ` · ${relative}` : ''}`;
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
