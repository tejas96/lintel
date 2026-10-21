import type { CalendarDate } from '@lintel/shared';
import {
  addWorkingDays,
  nextWorkingDayOnOrAfter,
  type WorkingCalendar,
  workingDaysBetween,
} from '../calendar/working-calendar';
import { nextWorkingDayAfter } from '../calendar/working-moments';
import type { TaskDependencyEdge } from '../tasks/task-dependency-graph';
import { isOpenTaskStatus, type TaskStatus } from '../tasks/task-status';

export interface ForecastTask {
  readonly id: string;
  readonly status: TaskStatus;
  readonly plannedStartDate: CalendarDate | null;
  readonly dueDate: CalendarDate | null;
  /** An unresolved blocker counts like the blocked status. */
  readonly hasOpenBlocker: boolean;
}

/** Why a task's forecast finish is where it is. */
export type ForecastCause =
  | 'on_plan'
  | 'overdue'
  | 'late_start'
  | 'blocked'
  | 'waiting_on_prerequisite';

export interface TaskForecast {
  readonly taskId: string;
  readonly forecastFinish: CalendarDate;
  /** Working days the forecast finish lies after the due date (0 when on time). */
  readonly slipWorkingDays: number;
  readonly cause: ForecastCause;
  /** The open prerequisite whose forecast pushed this task's start, when that is the cause. */
  readonly pushedBy: string | null;
}

const NOT_STARTED: readonly TaskStatus[] = ['draft', 'ready'];

/**
 * Forecast finish of every open task with a due date (forward pass, rules in
 * docs/PRODUCT_REQUIREMENTS.md §15.2):
 * - Duration = working days from planned start to due date (1 without a start).
 * - Work that has started finishes on its due date, or today at the earliest
 *   when it is overdue: nothing finishes in the past. Blocked work cannot
 *   finish today: the working day after today at the earliest.
 * - Work not started yet starts on its planned start, but never before today
 *   and never before the working day after each open prerequisite's forecast
 *   finish (finish-to-start), then keeps its duration.
 * Done and cancelled tasks never delay anything. Loops are refused when
 * dependencies are saved; a loop met here is cut where it closes.
 */
export function forecastSchedule(
  tasks: readonly ForecastTask[],
  edges: readonly TaskDependencyEdge[],
  calendar: WorkingCalendar,
  today: CalendarDate,
): Map<string, TaskForecast> {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const prerequisites = new Map<string, string[]>();
  for (const edge of edges) {
    prerequisites.set(edge.taskId, [
      ...(prerequisites.get(edge.taskId) ?? []),
      edge.dependsOnTaskId,
    ]);
  }
  const result = new Map<string, TaskForecast>();
  const visiting = new Set<string>();
  const visit = (id: string): TaskForecast | null => {
    const known = result.get(id);
    if (known) return known;
    const task = byId.get(id);
    if (!task || !isOpenTaskStatus(task.status) || task.dueDate === null || visiting.has(id)) {
      return null;
    }
    visiting.add(id);
    const upstream = (prerequisites.get(id) ?? []).flatMap((prerequisiteId) => {
      const forecast = visit(prerequisiteId);
      return forecast ? [forecast] : [];
    });
    visiting.delete(id);
    const forecast = forecastTask(task, task.dueDate, upstream, calendar, today);
    result.set(id, forecast);
    return forecast;
  };
  for (const task of tasks) visit(task.id);
  return result;
}

function forecastTask(
  task: ForecastTask,
  dueDate: CalendarDate,
  upstream: readonly TaskForecast[],
  calendar: WorkingCalendar,
  today: CalendarDate,
): TaskForecast {
  const todayWorking = nextWorkingDayOnOrAfter(calendar, today);
  const blocked = task.status === 'blocked' || task.hasOpenBlocker;
  if (!NOT_STARTED.includes(task.status) || blocked) {
    return startedForecast(task.id, dueDate, blocked, todayWorking, today, calendar);
  }
  const plannedStart = task.plannedStartDate ?? dueDate;
  const duration = Math.max(0, workingDaysBetween(calendar, plannedStart, dueDate));
  let start = nextWorkingDayOnOrAfter(calendar, plannedStart);
  let cause: ForecastCause = 'on_plan';
  let pushedBy: string | null = null;
  if (start < todayWorking) {
    start = todayWorking;
    cause = dueDate < today ? 'overdue' : 'late_start';
  }
  for (const prerequisite of upstream) {
    const earliest = nextWorkingDayAfter(calendar, prerequisite.forecastFinish);
    if (earliest > start) {
      start = earliest;
      cause = 'waiting_on_prerequisite';
      pushedBy = prerequisite.taskId;
    }
  }
  const computed = addWorkingDays(calendar, start, duration);
  const finish = computed > dueDate ? computed : dueDate;
  return result(task.id, dueDate, finish, finish > dueDate ? cause : 'on_plan', pushedBy, calendar);
}

/** Started or blocked work finishes on its due date, or the next working moment when overdue. */
function startedForecast(
  taskId: string,
  dueDate: CalendarDate,
  blocked: boolean,
  todayWorking: CalendarDate,
  today: CalendarDate,
  calendar: WorkingCalendar,
): TaskForecast {
  const earliest = blocked ? nextWorkingDayAfter(calendar, today) : todayWorking;
  const finish = dueDate < earliest ? earliest : dueDate;
  const cause: ForecastCause = blocked ? 'blocked' : dueDate < today ? 'overdue' : 'on_plan';
  return result(taskId, dueDate, finish, cause, null, calendar);
}

function result(
  taskId: string,
  dueDate: CalendarDate,
  forecastFinish: CalendarDate,
  cause: ForecastCause,
  pushedBy: string | null,
  calendar: WorkingCalendar,
): TaskForecast {
  const slip = forecastFinish > dueDate ? workingDaysBetween(calendar, dueDate, forecastFinish) : 0;
  return {
    taskId,
    forecastFinish,
    slipWorkingDays: slip,
    cause: slip > 0 || cause === 'blocked' ? cause : 'on_plan',
    pushedBy: slip > 0 ? pushedBy : null,
  };
}

/**
 * Forecast for a commitment (a milestone or the planned delivery date): the
 * latest forecast finish among its open tasks, and how many working days that
 * lies after the committed date. Null when no open task with a date is linked.
 */
export function forecastCommitment(
  dueDate: CalendarDate,
  taskIds: readonly string[],
  forecasts: ReadonlyMap<string, TaskForecast>,
  calendar: WorkingCalendar,
): { forecastDate: CalendarDate; slipWorkingDays: number; driverTaskId: string } | null {
  let driver: TaskForecast | null = null;
  for (const id of taskIds) {
    const forecast = forecasts.get(id);
    if (forecast && (driver === null || forecast.forecastFinish > driver.forecastFinish)) {
      driver = forecast;
    }
  }
  if (driver === null) return null;
  const slip =
    driver.forecastFinish > dueDate
      ? workingDaysBetween(calendar, dueDate, driver.forecastFinish)
      : 0;
  return {
    forecastDate: driver.forecastFinish,
    slipWorkingDays: slip,
    driverTaskId: driver.taskId,
  };
}

/** Follows `pushedBy` upstream to the task where the delay starts. */
export function rootCauseOf(
  taskId: string,
  forecasts: ReadonlyMap<string, TaskForecast>,
): TaskForecast | null {
  let current = forecasts.get(taskId) ?? null;
  const seen = new Set<string>();
  while (current?.pushedBy && !seen.has(current.taskId)) {
    seen.add(current.taskId);
    const next = forecasts.get(current.pushedBy);
    if (!next) break;
    current = next;
  }
  return current;
}
