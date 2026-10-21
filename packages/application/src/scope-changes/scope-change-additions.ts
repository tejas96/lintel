import {
  isOpenTaskStatus,
  TASK_STATUS_LABELS,
  type WorkingCalendar,
  workingDaysBetween,
} from '@lintel/domain';
import { type ErrorDetail, isCalendarDate } from '@lintel/shared';
import type {
  ProjectScheduleFacts,
  ScopeChangeNewTask,
  ScopeStageFact,
} from './scope-change.store';
import {
  calculateScopeChangeImpact,
  type ScopeChangeImpactResult,
  type TaskShiftRequest,
} from './scope-change-impact';

/** Everything one scope change asks for: date moves, new tasks and cancellations. */
export interface ScopeChangeRequest {
  readonly taskShifts: readonly TaskShiftRequest[];
  readonly newTasks: readonly ScopeChangeNewTask[];
  readonly cancelTaskIds: readonly string[];
}

export function isEmptyScopeChange(request: ScopeChangeRequest): boolean {
  return (
    request.taskShifts.length === 0 &&
    request.newTasks.length === 0 &&
    request.cancelTaskIds.length === 0
  );
}

/**
 * Problems with the tasks a proposal adds or cancels. New tasks go into an
 * open stage of the project with sensible dates; cancelled tasks must be
 * open project tasks that are not waiting for review, listed once, and not
 * also being moved.
 */
export function scopeChangeAdditionIssues(
  facts: ProjectScheduleFacts,
  stages: readonly ScopeStageFact[],
  request: ScopeChangeRequest,
): ErrorDetail[] {
  const openStages = new Set(
    stages
      .filter((stage) => stage.status === 'pending' || stage.status === 'active')
      .map((stage) => stage.id),
  );
  const issues: ErrorDetail[] = [];
  request.newTasks.forEach((task, index) => {
    const field = `newTasks.${index}`;
    if (task.title.trim().length === 0)
      issues.push({ field: `${field}.title`, message: 'Give the task a title.' });
    if (task.stageId !== null && !openStages.has(task.stageId)) {
      issues.push({
        field: `${field}.stageId`,
        message: 'Choose a stage of this project that is still open.',
      });
    }
    if (task.plannedStartDate && task.dueDate && task.plannedStartDate > task.dueDate) {
      issues.push({
        field: `${field}.plannedStartDate`,
        message: 'Start on or before the due date.',
      });
    }
  });
  const tasks = new Map(facts.tasks.map((task) => [task.id, task]));
  const shifted = new Set(request.taskShifts.map((shift) => shift.taskId));
  const seen = new Set<string>();
  request.cancelTaskIds.forEach((taskId, index) => {
    const field = `cancelTaskIds.${index}`;
    const task = tasks.get(taskId);
    if (!task) {
      issues.push({ field, message: 'This task is not part of the project.' });
    } else if (seen.has(taskId)) {
      issues.push({ field, message: 'This task is listed more than once.' });
    } else if (!isOpenTaskStatus(task.status)) {
      issues.push({
        field,
        message: `"${task.title}" is already ${TASK_STATUS_LABELS[task.status].toLowerCase()}.`,
      });
    } else if (task.status === 'in_review') {
      issues.push({
        field,
        message: `"${task.title}" is waiting for review. Decide the review first.`,
      });
    } else if (shifted.has(taskId)) {
      issues.push({
        field,
        message: `"${task.title}" is also being moved. Either move it or cancel it.`,
      });
    }
    seen.add(taskId);
  });
  return issues;
}

/**
 * The schedule impact of the whole change: cancelled tasks no longer count
 * towards the end date, moved tasks count at their new dates (with their
 * downstream tasks), and new tasks count at their own due dates.
 */
export function assessScopeChange(
  facts: ProjectScheduleFacts,
  request: ScopeChangeRequest,
  calendar: WorkingCalendar,
): ScopeChangeImpactResult {
  const cancelled = new Set(request.cancelTaskIds);
  const remaining = { ...facts, tasks: facts.tasks.filter((task) => !cancelled.has(task.id)) };
  const base = calculateScopeChangeImpact(remaining, request.taskShifts, calendar);
  let forecast = base.forecastEndDate;
  for (const task of request.newTasks) {
    if (
      task.dueDate &&
      isCalendarDate(task.dueDate) &&
      (forecast === null || task.dueDate > forecast)
    ) {
      forecast = task.dueDate;
    }
  }
  const plannedEnd = facts.plannedEndDate;
  const projectEndImpactDays =
    forecast && isCalendarDate(plannedEnd) && forecast > plannedEnd
      ? workingDaysBetween(calendar, plannedEnd, forecast)
      : 0;
  return { impacts: base.impacts, projectEndImpactDays, forecastEndDate: forecast };
}
