import {
  downstreamTasks,
  isOpenTaskStatus,
  shiftByWorkingDays,
  type WorkingCalendar,
  workingDaysBetween,
} from '@lintel/domain';
import { type CalendarDate, type ErrorDetail, isCalendarDate } from '@lintel/shared';
import type {
  ProjectScheduleFacts,
  ScheduleTaskFact,
  ScopeChangeImpact,
} from './scope-change.store';

export interface TaskShiftRequest {
  readonly taskId: string;
  readonly shiftWorkingDays: number;
}

/** One task's proposed move. Kept as its own name for readers of the impact code. */
export type PlannedTaskMove = ScopeChangeImpact;

export interface ScopeChangeImpactResult {
  readonly impacts: readonly PlannedTaskMove[];
  /** Working days the latest open due date would land after the current planned end (≥ 0). */
  readonly projectEndImpactDays: number;
  readonly forecastEndDate: CalendarDate | null;
}

export { shiftByWorkingDays };

/** Shifts a date that may be missing; tasks without dates keep none. */
export function shiftOptionalDate(
  calendar: WorkingCalendar,
  date: string | null,
  days: number,
): string | null {
  return date && isCalendarDate(date) ? shiftByWorkingDays(calendar, date, days) : date;
}

/** Problems with the requested shifts: unknown, repeated or already finished tasks. */
export function scopeChangeShiftIssues(
  facts: ProjectScheduleFacts,
  shifts: readonly TaskShiftRequest[],
): ErrorDetail[] {
  const tasks = new Map(facts.tasks.map((task) => [task.id, task]));
  const seen = new Set<string>();
  return shifts.flatMap((shift, index): ErrorDetail[] => {
    const field = `taskShifts.${index}.taskId`;
    const task = tasks.get(shift.taskId);
    if (!task) return [{ field, message: 'This task is not part of the project.' }];
    if (seen.has(shift.taskId)) return [{ field, message: 'This task is listed more than once.' }];
    seen.add(shift.taskId);
    if (!isOpenTaskStatus(task.status)) {
      return [{ field, message: `"${task.title}" is already ${task.status}.` }];
    }
    return [];
  });
}

/**
 * Inherited shifts: every task waiting (directly or indirectly) on a task
 * that moves later moves by the largest such shift. Pulling a task earlier
 * does not pull its dependents, since they may wait on other work too.
 */
function inheritedShifts(
  facts: ProjectScheduleFacts,
  explicit: ReadonlyMap<string, number>,
): Map<string, number> {
  const inherited = new Map<string, number>();
  for (const [taskId, shift] of explicit) {
    if (shift <= 0) continue;
    for (const downstreamId of downstreamTasks(taskId, facts.dependencies)) {
      inherited.set(downstreamId, Math.max(inherited.get(downstreamId) ?? 0, shift));
    }
  }
  return inherited;
}

function move(
  calendar: WorkingCalendar,
  task: ScheduleTaskFact,
  shift: number,
  isDownstream: boolean,
): PlannedTaskMove {
  return {
    taskId: task.id,
    taskTitle: task.title,
    currentDueDate: task.dueDate,
    proposedDueDate: shiftOptionalDate(calendar, task.dueDate, shift),
    currentStartDate: task.plannedStartDate,
    proposedStartDate: shiftOptionalDate(calendar, task.plannedStartDate, shift),
    shiftWorkingDays: shift,
    isDownstream,
    appliesExactDates: false,
  };
}

/** The latest open due date once the proposed dates apply: the new forecast end. */
function forecastEnd(
  openTasks: Iterable<ScheduleTaskFact>,
  impacts: readonly PlannedTaskMove[],
): CalendarDate | null {
  const proposed = new Map(impacts.map((impact) => [impact.taskId, impact.proposedDueDate]));
  let forecast: CalendarDate | null = null;
  for (const task of openTasks) {
    const due = proposed.has(task.id) ? (proposed.get(task.id) ?? null) : task.dueDate;
    if (due && isCalendarDate(due) && (forecast === null || due > forecast)) forecast = due;
  }
  return forecast;
}

/**
 * Works out every date a scope change would move, including downstream
 * tasks, and how far it would push the project past its planned end.
 * Call `scopeChangeShiftIssues` first; unknown or closed tasks are skipped.
 */
export function calculateScopeChangeImpact(
  facts: ProjectScheduleFacts,
  shifts: readonly TaskShiftRequest[],
  calendar: WorkingCalendar,
): ScopeChangeImpactResult {
  const openTasks = facts.tasks.filter((task) => isOpenTaskStatus(task.status));
  const explicit = new Map(shifts.map((shift) => [shift.taskId, shift.shiftWorkingDays]));
  const inherited = inheritedShifts(facts, explicit);
  const impacts: PlannedTaskMove[] = [];
  for (const task of openTasks) {
    const own = explicit.get(task.id);
    const pushed = inherited.get(task.id);
    if (own === undefined && pushed === undefined) continue;
    const governedByUpstream = pushed !== undefined && (own === undefined || pushed > own);
    const shift = governedByUpstream ? (pushed ?? 0) : (own ?? 0);
    impacts.push(move(calendar, task, shift, governedByUpstream));
  }
  const forecast = forecastEnd(openTasks, impacts);
  const plannedEnd = facts.plannedEndDate;
  const projectEndImpactDays =
    forecast && isCalendarDate(plannedEnd) && forecast > plannedEnd
      ? workingDaysBetween(calendar, plannedEnd, forecast)
      : 0;
  return { impacts, projectEndImpactDays, forecastEndDate: forecast };
}
