import {
  planTaskReschedule,
  rescheduleChangeIssue,
  type TaskDateChange,
  type WorkingCalendar,
} from '@lintel/domain';
import { type CalendarDate, type ErrorDetail, isCalendarDate } from '@lintel/shared';
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

/** Converts checked requests to domain changes (call `taskDateChangeIssues` first). */
export function toTaskDateChanges(changes: readonly TaskDateRequest[]): TaskDateChange[] {
  return changes.flatMap((change) => {
    const start = asDate(change.plannedStartDate);
    const due = asDate(change.dueDate);
    return start && due ? [{ taskId: change.taskId, plannedStartDate: start, dueDate: due }] : [];
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
    changes: toTaskDateChanges(changes),
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
