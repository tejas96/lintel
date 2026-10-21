import { formatCalendarDate, formatMonthLong } from '@/lib/format/dates';

/** "83%", or an en dash when there is nothing to rate. */
export function formatRate(rate: number | null): string {
  return rate === null ? '–' : `${Math.round(rate * 100)}%`;
}

/** "312 h", "7.5 h", "0 h" — totals over weeks read better in hours than "312h 30m". */
export function formatHours(minutes: number): string {
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours.toLocaleString('en-IN', { maximumFractionDigits: 1 })} h`;
}

/** "4.5 days", "1 day", "half a day". */
export function formatDays(days: number): string {
  if (days === 0.5) return 'half a day';
  return `${days.toLocaleString('en-IN', { maximumFractionDigits: 1 })} ${days === 1 ? 'day' : 'days'}`;
}

/** Elapsed time from hours: "40 min", "6 h", "2 d 3 h". */
export function formatDuration(hours: number | null): string {
  if (hours === null) return '–';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 24) return `${Math.round(hours * 10) / 10} h`;
  const days = Math.floor(hours / 24);
  const rest = Math.round(hours - days * 24);
  return rest === 0 ? `${days} d` : `${days} d ${rest} h`;
}

/** A report period's name: "Week of 13 Oct" or "October". */
export function periodName(
  period: { start: string; end: string },
  granularity: 'week' | 'month',
  today: string,
): string {
  return granularity === 'week'
    ? `Week of ${formatCalendarDate(period.start, today)}`
    : `${formatMonthLong(period.start)}${period.start.slice(0, 4) === today.slice(0, 4) ? '' : ` ${period.start.slice(0, 4)}`}`;
}

/** A short label under a column: "13 Oct" or "Oct". */
export function periodTick(
  period: { start: string },
  granularity: 'week' | 'month',
  today: string,
) {
  return granularity === 'week'
    ? formatCalendarDate(period.start, today)
    : formatMonthLong(period.start).slice(0, 3);
}
