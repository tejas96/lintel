import {
  addWorkingDays,
  nextWorkingDayOnOrAfter,
  planTaskReschedule,
  rescheduleChangeIssue,
  type TaskDateChange,
  type WorkingCalendar,
  workingDaysInRange,
} from '@lintel/domain';
import {
  type CalendarDate,
  daysBetween,
  type ErrorDetail,
  isCalendarDate,
  maxCalendarDate,
} from '@lintel/shared';
import type { ProjectScheduleFacts } from './scope-change.store';
import type { TaskDateRequest } from './scope-change-additions';
import type { ScopeChangeImpactResult } from './scope-change-impact';

function asDate(value: string | null): CalendarDate | null {
  return value && isCalendarDate(value) ? value : null;
}

/** Problems with exact dates: unknown or closed tasks, repeats, impossible dates, shifts too. */
export function taskDateChangeIssues(
  facts: ProjectScheduleFacts,
  changes: readonly TaskDateRequest[],
  shiftCount: number,
): ErrorDetail[] {
  if (changes.length > 0 && shiftCount > 0) {
    return [{ field: 'taskShifts', message: 'Move tasks by days or by dates, not both.' }];
  }
  const tasks = new Map(facts.tasks.map((task) => [task.id, task]));
  const seen = new Set<string>();
  return changes.flatMap((change, index): ErrorDetail[] => {
    const field = `taskDateChanges.${index}`;
    if (!isCalendarDate(change.plannedStartDate) || !isCalendarDate(change.dueDate)) {
      return [{ field, message: 'Use real dates in YYYY-MM-DD format.' }];
    }
    if (seen.has(change.taskId)) return [{ field, message: 'This task is listed more than once.' }];
    seen.add(change.taskId);
    const task = tasks.get(change.taskId);
    const issue = rescheduleChangeIssue(
      task && {
        id: task.id,
        title: task.title,
        status: task.status,
        plannedStartDate: asDate(task.plannedStartDate),
        dueDate: asDate(task.dueDate),
      },
      { taskId: change.taskId, plannedStartDate: change.plannedStartDate, dueDate: change.dueDate },
    );
    return issue ? [{ field, message: issue }] : [];
  });
}

type CurrentDates = ReadonlyMap<string, { start: CalendarDate | null; due: CalendarDate | null }>;

/**
 * One request on the studio calendar. A bar moved whole (same length in
 * days) keeps its length in working days and starts on the first working day
 * at or after where it was dropped; a resized bar snaps each end forward to a
 * working day.
 */
function snapToWorkingDays(
  calendar: WorkingCalendar,
  start: CalendarDate,
  due: CalendarDate,
  current: { start: CalendarDate | null; due: CalendarDate | null } | undefined,
): { start: CalendarDate; due: CalendarDate } {
  const snappedStart = nextWorkingDayOnOrAfter(calendar, start);
  const moved =
    current?.start &&
    current.due &&
    daysBetween(start, due) === daysBetween(current.start, current.due);
  if (moved && current?.start && current.due) {
    const length = Math.max(1, workingDaysInRange(calendar, current.start, current.due).length);
    return { start: snappedStart, due: addWorkingDays(calendar, snappedStart, length - 1) };
  }
  return {
    start: snappedStart,
    due: maxCalendarDate(snappedStart, nextWorkingDayOnOrAfter(calendar, due)),
  };
}

/**
 * Converts checked requests to domain changes (call `taskDateChangeIssues`
 * first). Dates dropped on a day off move to the next working day, so a bar
 * dragged onto a Sunday starts on Monday — and a moved bar keeps its length.
 */
export function toTaskDateChanges(
  changes: readonly TaskDateRequest[],
  calendar: WorkingCalendar,
  facts?: Pick<ProjectScheduleFacts, 'tasks'>,
): TaskDateChange[] {
  const current: CurrentDates = new Map(
    (facts?.tasks ?? []).map((task) => [
      task.id,
      { start: asDate(task.plannedStartDate), due: asDate(task.dueDate) },
    ]),
  );
  return changes.flatMap((change) => {
    const start = asDate(change.plannedStartDate);
    const due = asDate(change.dueDate);
    if (!start || !due) return [];
    const snapped = snapToWorkingDays(calendar, start, due, current.get(change.taskId));
    return [{ taskId: change.taskId, plannedStartDate: snapped.start, dueDate: snapped.due }];
  });
}

/**
 * The impact of exact new dates with the domain's knock-on rule, as stored
 * impacts: approval later sets these dates rather than shifting by days.
 */
export function exactDateImpact(
  facts: ProjectScheduleFacts,
  changes: readonly TaskDateRequest[],
  calendar: WorkingCalendar,
): ScopeChangeImpactResult {
  const plannedEnd = asDate(facts.plannedEndDate);
  const plan = planTaskReschedule({
    tasks: facts.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      plannedStartDate: asDate(task.plannedStartDate),
      dueDate: asDate(task.dueDate),
    })),
    dependencies: facts.dependencies,
    changes: toTaskDateChanges(changes, calendar, facts),
    calendar,
    plannedEndDate: plannedEnd ?? ('9999-12-31' as CalendarDate),
  });
  return {
    impacts: plan.moves.map((move) => ({
      taskId: move.taskId,
      taskTitle: move.title,
      currentDueDate: move.currentDueDate,
      proposedDueDate: move.proposedDueDate,
      currentStartDate: move.currentStartDate,
      proposedStartDate: move.proposedStartDate,
      shiftWorkingDays: move.shiftWorkingDays,
      isDownstream: move.isDownstream,
      appliesExactDates: true,
    })),
    projectEndImpactDays: plan.projectEndImpactDays,
    forecastEndDate: plan.forecastEndDate,
  };
}
