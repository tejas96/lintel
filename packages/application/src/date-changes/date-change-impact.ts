import { isOpenTaskStatus, type WorkingCalendar, workingDaysBetween } from '@lintel/domain';
import { isCalendarDate } from '@lintel/shared';
import { type PreviewedMove, previewReschedule } from '../scheduling/reschedule-plan';
import type { ProjectScheduleFacts } from '../scope-changes/scope-change.store';
import type { DateChangeRequestRecord } from './date-change.store';

export interface WaitingTask {
  readonly taskId: string;
  readonly title: string;
  readonly plannedStartDate: string | null;
  readonly dueDate: string | null;
}

export interface SlippingCommitment {
  readonly id: string;
  readonly name: string;
  readonly dueDate: string;
  /** The latest due date of its open tasks once the new dates (and what follows) apply. */
  readonly forecastDueDate: string;
  readonly slipWorkingDays: number;
}

/** What accepting a new-date request does to the rest of the plan, before anyone decides. */
export interface DateChangeImpact {
  readonly requestId: string;
  /** Tasks that wait on this one and would start before it ends if only this task moves. */
  readonly waitingTasks: WaitingTask[];
  /** What "accept and move the waiting tasks too" moves: every task pushed along, in plan order. */
  readonly dependentMoves: PreviewedMove[];
  /** Milestones whose work would now end after them (the waiting work cannot start earlier). */
  readonly slippingMilestones: SlippingCommitment[];
  readonly plannedEndDate: string;
  /** The latest open due date today, and once the new dates and their knock-on apply. */
  readonly currentForecastEndDate: string | null;
  readonly forecastEndDate: string | null;
  /** Working days the latest due date moves later (0 when it does not). */
  readonly forecastShiftWorkingDays: number;
  /** Working days past the agreed end; moving the waiting tasks then needs a scope change. */
  readonly projectEndImpactDays: number;
  readonly movingWaitingTasksNeedsScopeChange: boolean;
}

/** The start the task keeps: the proposed one, else the current one unless it now falls after the due date. */
export function acceptedStartDate(
  request: Pick<DateChangeRequestRecord, 'proposedStartDate' | 'proposedDueDate'>,
  task: { readonly plannedStartDate: string | null },
): string | null {
  if (request.proposedStartDate) return request.proposedStartDate;
  if (task.plannedStartDate && task.plannedStartDate > request.proposedDueDate) {
    return request.proposedDueDate;
  }
  return task.plannedStartDate;
}

function latestOpenDue(facts: ProjectScheduleFacts): string | null {
  return facts.tasks
    .filter((task) => isOpenTaskStatus(task.status) && task.dueDate !== null)
    .reduce<string | null>(
      (latest, task) =>
        task.dueDate && (!latest || task.dueDate > latest) ? task.dueDate : latest,
      null,
    );
}

function workingDaysLater(calendar: WorkingCalendar, from: string | null, to: string | null) {
  if (!from || !to || to <= from || !isCalendarDate(from) || !isCalendarDate(to)) return 0;
  return workingDaysBetween(calendar, from, to);
}

/**
 * The knock-on of accepting a request, worked out with the same rule as the
 * timeline drag (`previewReschedule`): the waiting tasks that would start
 * before this one ends, where they would move, the milestones that slip and
 * whether the delivery forecast moves.
 */
export function dateChangeImpact(
  facts: ProjectScheduleFacts,
  request: DateChangeRequestRecord,
  calendar: WorkingCalendar,
): DateChangeImpact {
  const currentForecastEndDate = latestOpenDue(facts);
  const task = facts.tasks.find((candidate) => candidate.id === request.taskId);
  const none: DateChangeImpact = {
    requestId: request.id,
    waitingTasks: [],
    dependentMoves: [],
    slippingMilestones: [],
    plannedEndDate: facts.plannedEndDate,
    currentForecastEndDate,
    forecastEndDate: currentForecastEndDate,
    forecastShiftWorkingDays: 0,
    projectEndImpactDays: 0,
    movingWaitingTasksNeedsScopeChange: false,
  };
  if (!task || !isOpenTaskStatus(task.status)) return none;
  const due = request.proposedDueDate;
  const preview = previewReschedule(
    facts,
    [{ taskId: task.id, plannedStartDate: acceptedStartDate(request, task) ?? due, dueDate: due }],
    calendar,
  );
  const waitingIds = new Set(
    facts.dependencies
      .filter((edge) => edge.dependsOnTaskId === task.id)
      .map((edge) => edge.taskId),
  );
  const waitingTasks = facts.tasks
    .filter((candidate) => waitingIds.has(candidate.id) && isOpenTaskStatus(candidate.status))
    .filter((candidate) => {
      const start = candidate.plannedStartDate ?? candidate.dueDate;
      return start !== null && start <= due;
    })
    .map((candidate) => ({
      taskId: candidate.id,
      title: candidate.title,
      plannedStartDate: candidate.plannedStartDate,
      dueDate: candidate.dueDate,
    }));
  return {
    ...none,
    waitingTasks,
    dependentMoves: preview.moves.filter((move) => move.isDownstream),
    slippingMilestones: preview.slippingMilestones.map((milestone) => ({
      id: milestone.id,
      name: milestone.name,
      dueDate: milestone.dueDate,
      forecastDueDate: milestone.latestTaskDueDate,
      slipWorkingDays: workingDaysLater(calendar, milestone.dueDate, milestone.latestTaskDueDate),
    })),
    forecastEndDate: preview.forecastEndDate,
    forecastShiftWorkingDays: workingDaysLater(
      calendar,
      currentForecastEndDate,
      preview.forecastEndDate,
    ),
    projectEndImpactDays: preview.projectEndImpactDays,
    movingWaitingTasksNeedsScopeChange: preview.requiresScopeChange,
  };
}
