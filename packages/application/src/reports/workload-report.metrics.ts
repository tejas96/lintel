import {
  DEFAULT_TASK_ESTIMATE_MINUTES,
  isWorkingDay,
  type LoadStatus,
  loadStatus,
  type WorkingCalendar,
  workingDaysInRange,
} from '@lintel/domain';
import { type CalendarDate, eachCalendarDate } from '@lintel/shared';
import type { ReportPeriod } from './report-periods';
import type { ReportSpan } from './report-plan';

/** A scheduled task: not cancelled, not archived, with an owner and a due date. */
export interface PlannedWorkFact {
  readonly estimateMinutes: number | null;
  readonly plannedStartDate: CalendarDate | null;
  readonly dueDate: CalendarDate;
  /** Draft tasks are tentative and kept apart from planned work. */
  readonly tentative: boolean;
}

export interface WorkloadPersonInput {
  readonly calendar: WorkingCalendar;
  /** 100 for full time, 50 for half time. */
  readonly capacityPercent: number;
  /** Approved leave by working day (2 half-day units = the whole day). */
  readonly approvedLeave: readonly { date: CalendarDate; halfDayUnits: number }[];
  readonly tasks: readonly PlannedWorkFact[];
  /** Ended work sessions: the business day each started on and its length. */
  readonly sessions: readonly { day: CalendarDate; minutes: number }[];
}

export interface WorkloadMinutes {
  readonly available: number;
  readonly planned: number;
  readonly tentative: number;
  readonly logged: number;
}

const ZERO: WorkloadMinutes = { available: 0, planned: 0, tentative: 0, logged: 0 };

export function addWorkload(left: WorkloadMinutes, right: WorkloadMinutes): WorkloadMinutes {
  return {
    available: left.available + right.available,
    planned: left.planned + right.planned,
    tentative: left.tentative + right.tentative,
    logged: left.logged + right.logged,
  };
}

/**
 * A task's estimate (120 minutes when it has none) spread evenly over the
 * owner's working days from its planned start (or its due date) to its due
 * date; with no working day in that window it all lands on the due date.
 */
export function spreadPlannedWork(
  task: PlannedWorkFact,
  calendar: WorkingCalendar,
): Map<CalendarDate, number> {
  const estimate = task.estimateMinutes ?? DEFAULT_TASK_ESTIMATE_MINUTES;
  const start =
    task.plannedStartDate && task.plannedStartDate <= task.dueDate
      ? task.plannedStartDate
      : task.dueDate;
  const window = workingDaysInRange(calendar, start, task.dueDate);
  const days = window.length > 0 ? window : [task.dueDate];
  return new Map(days.map((date) => [date, estimate / days.length]));
}

/**
 * Available = working minutes × capacity % on each working day, less approved
 * leave (a half day removes half). Planned / tentative = the spread estimates
 * of confirmed / draft tasks. Logged = ended work sessions on the day they began.
 */
export function workloadByDay(
  input: WorkloadPersonInput,
  range: ReportSpan,
): Map<CalendarDate, WorkloadMinutes> {
  const leave = new Map<CalendarDate, number>();
  for (const day of input.approvedLeave) {
    leave.set(day.date, Math.min(2, (leave.get(day.date) ?? 0) + day.halfDayUnits));
  }
  const days = new Map<CalendarDate, WorkloadMinutes>();
  for (const date of eachCalendarDate(range.start, range.end)) {
    const base = isWorkingDay(input.calendar, date)
      ? (input.calendar.workingMinutesPerDay * input.capacityPercent) / 100
      : 0;
    days.set(date, { ...ZERO, available: base * (1 - (leave.get(date) ?? 0) / 2) });
  }
  const add = (date: CalendarDate, part: Partial<WorkloadMinutes>) => {
    const current = days.get(date);
    if (current) days.set(date, addWorkload(current, { ...ZERO, ...part }));
  };
  for (const task of input.tasks) {
    for (const [date, minutes] of spreadPlannedWork(task, input.calendar)) {
      add(date, task.tentative ? { tentative: minutes } : { planned: minutes });
    }
  }
  for (const session of input.sessions) add(session.day, { logged: session.minutes });
  return days;
}

export function sumWorkload(parts: Iterable<WorkloadMinutes>): WorkloadMinutes {
  let total = ZERO;
  for (const part of parts) total = addWorkload(total, part);
  return total;
}

/** Totals of a day map per report period, in period order. */
export function workloadByPeriod(
  days: ReadonlyMap<CalendarDate, WorkloadMinutes>,
  periods: readonly ReportPeriod[],
): WorkloadMinutes[] {
  return periods.map((period) =>
    sumWorkload(
      [...days].filter(([date]) => date >= period.start && date <= period.end).map(([, m]) => m),
    ),
  );
}

export interface WorkloadSummary {
  readonly availableMinutes: number;
  readonly plannedMinutes: number;
  readonly tentativeMinutes: number;
  readonly loggedMinutes: number;
  /** Planned ÷ available, rounded to 0.001; null when nothing was available. */
  readonly utilization: number | null;
  readonly status: LoadStatus;
}

/** Whole minutes, the planned share of available time and the capacity load status. */
export function summarizeWorkload(minutes: WorkloadMinutes): WorkloadSummary {
  const available = Math.round(minutes.available);
  const planned = Math.round(minutes.planned);
  return {
    availableMinutes: available,
    plannedMinutes: planned,
    tentativeMinutes: Math.round(minutes.tentative),
    loggedMinutes: Math.round(minutes.logged),
    utilization: available > 0 ? Math.round((planned / available) * 1000) / 1000 : null,
    status: loadStatus(available, planned),
  };
}
