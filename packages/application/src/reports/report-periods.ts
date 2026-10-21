import {
  addDays,
  type CalendarDate,
  isoWeekday,
  maxCalendarDate,
  minCalendarDate,
  toCalendarDate,
} from '@lintel/shared';

export type ReportGranularity = 'week' | 'month';

/** One bucket of a report: an ISO week (Monday–Sunday) or a calendar month, clipped to the range. */
export interface ReportPeriod {
  readonly start: CalendarDate;
  readonly end: CalendarDate;
}

function bucketStart(date: CalendarDate, granularity: ReportGranularity): CalendarDate {
  if (granularity === 'week') return addDays(date, 1 - isoWeekday(date));
  return toCalendarDate(`${date.slice(0, 7)}-01`);
}

function nextBucketStart(start: CalendarDate, granularity: ReportGranularity): CalendarDate {
  if (granularity === 'week') return addDays(start, 7);
  const year = Number(start.slice(0, 4));
  const month = Number(start.slice(5, 7));
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return toCalendarDate(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01`);
}

/** The weeks or months that make up the range, oldest first, each clipped to the range. */
export function reportPeriods(
  range: { start: CalendarDate; end: CalendarDate },
  granularity: ReportGranularity,
): ReportPeriod[] {
  const periods: ReportPeriod[] = [];
  let start = bucketStart(range.start, granularity);
  while (start <= range.end) {
    const next = nextBucketStart(start, granularity);
    periods.push({
      start: maxCalendarDate(start, range.start),
      end: minCalendarDate(addDays(next, -1), range.end),
    });
    start = next;
  }
  return periods;
}

/** Index of the period a date falls in, or -1 outside the range. */
export function periodIndexOf(periods: readonly ReportPeriod[], date: CalendarDate): number {
  return periods.findIndex((period) => date >= period.start && date <= period.end);
}
