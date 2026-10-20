import {
  type BlockerReportFact,
  isWorkingDay,
  type RewardCriterion,
  type RewardMetrics,
  type TaskOutcomeFact,
  type WorkingCalendar,
  wasDeliveredOnTime,
} from '@lintel/domain';
import {
  addDays,
  type CalendarDate,
  calendarDateInTimeZone,
  eachCalendarDate,
  toCalendarDate,
} from '@lintel/shared';
import type {
  BlockerReportRecord,
  CompletedMilestoneRecord,
  CompletedTaskRecord,
} from './reward.store';

/** Waiting on these is outside the person's control, so it never counts against them. */
export const EXTERNAL_BLOCKER_CATEGORIES: ReadonlySet<string> = new Set([
  'client',
  'supplier',
  'manager_decision',
]);

/** A half-open window of instants: [from, to). */
export interface InstantWindow {
  readonly from: Date;
  readonly to: Date;
}

export interface FactContext {
  readonly calendar: WorkingCalendar;
  readonly timeZone: string;
}

const inWindow = (instant: Date, window: InstantWindow) =>
  instant >= window.from && instant < window.to;

/**
 * Working days the task waited on a client, supplier or manager decision.
 * Overlapping blockers are counted once; the day a blocker is resolved is not
 * counted as waiting.
 */
export function externalBlockedWorkingDays(
  task: Pick<CompletedTaskRecord, 'blockers' | 'completedAt'>,
  context: FactContext,
): number {
  const waiting = new Set<CalendarDate>();
  for (const blocker of task.blockers) {
    if (!EXTERNAL_BLOCKER_CATEGORIES.has(blocker.category)) continue;
    const start = calendarDateInTimeZone(blocker.raisedAt, context.timeZone);
    const end = calendarDateInTimeZone(blocker.resolvedAt ?? task.completedAt, context.timeZone);
    for (const date of eachCalendarDate(start, addDays(end, -1))) {
      if (isWorkingDay(context.calendar, date)) waiting.add(date);
    }
  }
  return waiting.size;
}

/**
 * One fact per finished task the subject took part in: as owner when one of
 * them owned it, otherwise as collaborator. Tasks without a due date cannot be
 * late, so their completion day stands in for the due date.
 */
export function taskOutcomesFor(
  members: ReadonlySet<string>,
  tasks: readonly CompletedTaskRecord[],
  window: InstantWindow,
  context: FactContext,
): TaskOutcomeFact[] {
  const outcomes: TaskOutcomeFact[] = [];
  for (const task of tasks) {
    if (!inWindow(task.completedAt, window)) continue;
    const isOwner = task.ownerUserId !== null && members.has(task.ownerUserId);
    const isCollaborator = task.collaboratorUserIds.some((userId) => members.has(userId));
    if (!isOwner && !isCollaborator) continue;
    const completedOn = calendarDateInTimeZone(task.completedAt, context.timeZone);
    outcomes.push({
      taskId: task.taskId,
      isOwner,
      completedOn,
      effectiveDueDate: task.dueDate ? toCalendarDate(task.dueDate) : completedOn,
      externalBlockedDays: externalBlockedWorkingDays(task, context),
      wasReviewed: task.requiresReview,
      reviewRounds: task.reviewRounds,
      checklistCompleteAtFinish: task.requiredChecklistCompletedAt.every(
        (completedAt) => completedAt !== null && completedAt <= task.completedAt,
      ),
    });
  }
  return outcomes;
}

/** Owned on-time ÷ owned completed; null when nothing owned was finished. */
export function onTimeRateOf(outcomes: readonly TaskOutcomeFact[]): number | null {
  const owned = outcomes.filter((outcome) => outcome.isOwner);
  if (owned.length === 0) return null;
  return owned.filter(wasDeliveredOnTime).length / owned.length;
}

export function blockerReportsFor(
  members: ReadonlySet<string>,
  reports: readonly BlockerReportRecord[],
  window: InstantWindow,
  timeZone: string,
): BlockerReportFact[] {
  return reports
    .filter((report) => members.has(report.raisedByUserId) && inWindow(report.raisedAt, window))
    .map((report) => ({
      reportedOn: calendarDateInTimeZone(report.raisedAt, timeZone),
      taskDueDate: report.taskDueDate ? toCalendarDate(report.taskDueDate) : null,
    }));
}

/** Milestones completed in the window on or before their due date, delivered by the subject. */
export function milestonesDeliveredOnTime(
  members: ReadonlySet<string>,
  milestones: readonly CompletedMilestoneRecord[],
  window: InstantWindow,
  timeZone: string,
): number {
  return milestones.filter(
    (milestone) =>
      inWindow(milestone.completedAt, window) &&
      calendarDateInTimeZone(milestone.completedAt, timeZone) <= milestone.dueDate &&
      milestone.taskOwnerUserIds.some((userId) => members.has(userId)),
  ).length;
}

/** The numbers behind a decision, stored as evidence next to the criteria results. */
export function metricsEvidence(
  metrics: RewardMetrics,
  criteria: readonly RewardCriterion[],
): Record<string, number | null> {
  const evidence: Record<string, number | null> = {
    ownedTasksCompleted: metrics.ownedTasksCompleted,
    ownedTasksOnTime: metrics.ownedTasksOnTime,
    reviewedTasks: metrics.reviewedDeliverables,
    approvedFirstTime: metrics.approvedFirstTime,
    milestonesDeliveredOnTime: metrics.milestonesDeliveredOnTime,
    collaboratorTasksCompleted: metrics.collaboratorTasksCompleted,
    checklistCompliantTasks: metrics.checklistCompliantTasks,
    previousOnTimeRate: metrics.previousOnTimeRate,
  };
  for (const criterion of criteria) {
    if (criterion.type === 'proactive_blocker_reporting') {
      evidence[`earlyBlockerReports${criterion.leadDays}d`] = metrics.earlyBlockerReports(
        criterion.leadDays,
      );
    }
  }
  return evidence;
}
