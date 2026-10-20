import { type CalendarDate, daysBetween } from '@lintel/shared';

/** What happened to one finished task in the period. Built from stored records. */
export interface TaskOutcomeFact {
  readonly taskId: string;
  readonly isOwner: boolean;
  readonly completedOn: CalendarDate;
  /** Latest approved due date, after any approved schedule change. */
  readonly effectiveDueDate: CalendarDate;
  /** Working days the task waited on a client, supplier or manager decision. */
  readonly externalBlockedDays: number;
  readonly wasReviewed: boolean;
  readonly reviewRounds: number;
  readonly checklistCompleteAtFinish: boolean;
}

export interface BlockerReportFact {
  readonly reportedOn: CalendarDate;
  readonly taskDueDate: CalendarDate | null;
}

export interface RewardMetrics {
  readonly ownedTasksCompleted: number;
  readonly ownedTasksOnTime: number;
  readonly reviewedDeliverables: number;
  readonly approvedFirstTime: number;
  readonly milestonesDeliveredOnTime: number;
  readonly earlyBlockerReports: (leadDays: number) => number;
  readonly collaboratorTasksCompleted: number;
  readonly checklistCompliantTasks: number;
  /** On-time rate of the previous period, or null when there is no history. */
  readonly previousOnTimeRate: number | null;
}

/**
 * Late only counts against the person once approved schedule changes and
 * external waiting time are taken into account.
 */
export function wasDeliveredOnTime(fact: TaskOutcomeFact): boolean {
  return daysBetween(fact.effectiveDueDate, fact.completedOn) <= fact.externalBlockedDays;
}

export function buildRewardMetrics(input: {
  readonly outcomes: readonly TaskOutcomeFact[];
  readonly blockerReports: readonly BlockerReportFact[];
  readonly milestonesDeliveredOnTime: number;
  readonly previousOnTimeRate: number | null;
}): RewardMetrics {
  const owned = input.outcomes.filter((fact) => fact.isOwner);
  const reviewed = owned.filter((fact) => fact.wasReviewed);
  return {
    ownedTasksCompleted: owned.length,
    ownedTasksOnTime: owned.filter(wasDeliveredOnTime).length,
    reviewedDeliverables: reviewed.length,
    approvedFirstTime: reviewed.filter((fact) => fact.reviewRounds === 0).length,
    milestonesDeliveredOnTime: input.milestonesDeliveredOnTime,
    earlyBlockerReports: (leadDays) =>
      input.blockerReports.filter(
        (report) =>
          report.taskDueDate !== null &&
          daysBetween(report.reportedOn, report.taskDueDate) >= leadDays,
      ).length,
    collaboratorTasksCompleted: input.outcomes.filter((fact) => !fact.isOwner).length,
    checklistCompliantTasks: owned.filter((fact) => fact.checklistCompleteAtFinish).length,
    previousOnTimeRate: input.previousOnTimeRate,
  };
}
