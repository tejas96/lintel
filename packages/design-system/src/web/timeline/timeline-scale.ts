import { dateFromDayNumber, dayNumber } from '../lib/calendar-math';

export type TimelineZoom = 'week' | 'month';

export interface TimelineTick {
  readonly date: string;
  readonly x: number;
  readonly label: string | null;
  readonly gridline: 'major' | 'minor' | 'none';
  readonly isWeekend: boolean;
}

export interface TimelineScale {
  readonly start: string;
  readonly end: string;
  readonly dayWidth: number;
  readonly width: number;
  /** Left edge of a date's column, in px. */
  readonly x: (date: string) => number;
  readonly ticks: readonly TimelineTick[];
}

const DAY_MS = 86_400_000;
const DAY_WIDTH: Readonly<Record<TimelineZoom, number>> = { week: 32, month: 9 };
const MONTH = new Intl.DateTimeFormat('en-IN', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const DAY_MONTH = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

function tickFor(
  day: number,
  startDay: number,
  dayWidth: number,
  zoom: TimelineZoom,
): TimelineTick {
  const date = dateFromDayNumber(day);
  // 1970-01-01 was a Thursday, so (day + 3) % 7 is 0 on Mondays.
  const weekday = (day + 3) % 7;
  const isMonday = weekday === 0;
  const isMonthStart = date.endsWith('-01');
  const when = new Date(day * DAY_MS);
  let label: string | null = null;
  let gridline: TimelineTick['gridline'] = 'none';
  if (zoom === 'week') {
    if (isMonday) {
      label = DAY_MONTH.format(when);
      gridline = 'major';
    }
  } else if (isMonthStart) {
    label = MONTH.format(when);
    gridline = 'major';
  } else if (isMonday) {
    gridline = 'minor';
  }
  return { date, x: (day - startDay) * dayWidth, label, gridline, isWeekend: weekday >= 5 };
}

/**
 * Pixel geometry for a Gantt chart between two calendar dates. The range is
 * padded to whole weeks (Monday start) with a week either side.
 */
export function createTimelineScale(
  rangeStart: string,
  rangeEnd: string,
  zoom: TimelineZoom,
): TimelineScale {
  const first = dayNumber(rangeStart);
  const last = Math.max(first, dayNumber(rangeEnd));
  const startDay = first - ((first + 3) % 7) - 7;
  const endDay = last + (6 - ((last + 3) % 7)) + 7;
  const dayWidth = DAY_WIDTH[zoom];
  const ticks: TimelineTick[] = [];
  for (let day = startDay; day <= endDay; day += 1) {
    ticks.push(tickFor(day, startDay, dayWidth, zoom));
  }
  return {
    start: dateFromDayNumber(startDay),
    end: dateFromDayNumber(endDay),
    dayWidth,
    width: (endDay - startDay + 1) * dayWidth,
    x: (date: string) => (dayNumber(date) - startDay) * dayWidth,
    ticks,
  };
}
