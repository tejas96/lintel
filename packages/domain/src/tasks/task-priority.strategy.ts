import { type CalendarDate, daysBetween, pluralize } from '@lintel/shared';
import type { ProjectCriticality } from '../projects/project-status';
import {
  deadlineSignal,
  deadlineSortKey,
  isOverdueAt,
  type PriorityClock,
} from './deadline-priority';
import type { TaskPriority, TaskStatus } from './task-status';

/** Everything the planner needs to rank one task for one person on one day. */
export interface PrioritizationInput {
  readonly taskId: string;
  readonly title: string;
  readonly status: TaskStatus;
  readonly priority: TaskPriority;
  readonly dueDate: CalendarDate | null;
  /** "HH:mm" in the business timezone; null means the end of the working day. */
  readonly dueTime: string | null;
  readonly estimateMinutes: number | null;
  readonly projectCriticality: ProjectCriticality;
  readonly openDependentCount: number;
  /** Due date of the earliest open milestone this task belongs to or unblocks. */
  readonly milestoneDueDate: CalendarDate | null;
  readonly milestoneName: string | null;
  readonly hasUnmetPrerequisites: boolean;
  readonly isBlocked: boolean;
}

export type WorkQueueBucket =
  | 'overdue'
  | 'today'
  | 'upcoming'
  | 'later'
  | 'blocked'
  | 'waiting'
  | 'in_review';

export interface PriorityReason {
  readonly code: string;
  readonly points: number;
  readonly explanation: string;
}

export interface PrioritizedTask {
  readonly taskId: string;
  readonly score: number;
  readonly bucket: WorkQueueBucket;
  readonly reasons: readonly PriorityReason[];
  /** One sentence that tells the person why this task sits where it does. */
  readonly headline: string;
}

/** A replaceable ranking policy (Strategy pattern). */
export interface TaskPriorityStrategy {
  readonly name: string;
  prioritize(
    input: PrioritizationInput,
    today: CalendarDate,
    clock?: PriorityClock,
  ): PrioritizedTask;
}

const PRIORITY_POINTS: Readonly<Record<TaskPriority, number>> = {
  urgent: 40,
  high: 25,
  medium: 12,
  low: 0,
};

const CRITICALITY_POINTS: Readonly<Record<ProjectCriticality, number>> = {
  critical: 10,
  high: 6,
  normal: 2,
  low: 0,
};

function milestoneReason(input: PrioritizationInput, today: CalendarDate): PriorityReason | null {
  if (input.milestoneDueDate === null || input.openDependentCount === 0) return null;
  const daysLeft = daysBetween(today, input.milestoneDueDate);
  if (daysLeft > 7) return null;
  const when = daysLeft <= 0 ? 'now' : daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`;
  const name = input.milestoneName ?? 'a milestone';
  return {
    code: 'BLOCKS_MILESTONE',
    points: 10,
    explanation: `It blocks work for "${name}", due ${when}.`,
  };
}

function bucketFor(
  input: PrioritizationInput,
  today: CalendarDate,
  clock: PriorityClock | undefined,
): WorkQueueBucket {
  if (input.isBlocked || input.status === 'blocked') return 'blocked';
  if (input.status === 'in_review') return 'in_review';
  if (input.hasUnmetPrerequisites) return 'waiting';
  if (input.dueDate === null) return 'later';
  const daysLeft = daysBetween(today, input.dueDate);
  if (isOverdueAt(input, today, clock)) return 'overdue';
  if (daysLeft === 0) return 'today';
  return daysLeft <= 7 ? 'upcoming' : 'later';
}

function collectReasons(
  input: PrioritizationInput,
  today: CalendarDate,
  clock: PriorityClock | undefined,
): PriorityReason[] {
  const reasons: PriorityReason[] = [];
  const priorityPoints = PRIORITY_POINTS[input.priority];
  if (priorityPoints > 0) {
    reasons.push({
      code: 'EXPLICIT_PRIORITY',
      points: priorityPoints,
      explanation: `It is marked ${input.priority} priority.`,
    });
  }
  const deadline = deadlineSignal(input, today, clock);
  if (deadline) reasons.push(deadline);
  const milestone = milestoneReason(input, today);
  if (milestone) reasons.push(milestone);
  if (input.openDependentCount > 0) {
    reasons.push({
      code: 'UNBLOCKS_OTHERS',
      points: Math.min(input.openDependentCount * 4, 12),
      explanation: `${pluralize(input.openDependentCount, 'other task')} ${input.openDependentCount === 1 ? 'waits' : 'wait'} for it.`,
    });
  }
  const criticality = CRITICALITY_POINTS[input.projectCriticality];
  if (criticality > 2) {
    reasons.push({
      code: 'CRITICAL_PROJECT',
      points: criticality,
      explanation: `The project is marked ${input.projectCriticality}.`,
    });
  }
  if (input.status === 'changes_requested') {
    reasons.push({ code: 'REWORK', points: 8, explanation: 'A reviewer asked for changes.' });
  }
  if (input.status === 'in_progress') {
    reasons.push({ code: 'IN_PROGRESS', points: 5, explanation: 'You already started it.' });
  }
  return reasons;
}

function headlineFor(bucket: WorkQueueBucket, reasons: readonly PriorityReason[]): string {
  if (bucket === 'blocked') return 'Blocked — resolve the blocker or ask for help.';
  if (bucket === 'waiting') return 'Waiting on earlier tasks before it can start.';
  if (bucket === 'in_review') return 'Submitted — waiting for the reviewer.';
  const strongest = [...reasons].sort((left, right) => right.points - left.points)[0];
  if (!strongest) return 'No deadline pressure yet — plan it in.';
  return `Recommended because ${strongest.explanation.charAt(0).toLowerCase()}${strongest.explanation.slice(1)}`;
}

/**
 * Default ranking: explicit priority, deadline proximity, milestone impact,
 * downstream work, project criticality and rework. Weights are documented in
 * docs/PRODUCT_REQUIREMENTS.md and are a policy, not an objective truth.
 */
export const deadlineAwarePriorityStrategy: TaskPriorityStrategy = {
  name: 'deadline-aware-v1',
  prioritize(input, today, clock) {
    const bucket = bucketFor(input, today, clock);
    const reasons = collectReasons(input, today, clock);
    const actionable = bucket !== 'blocked' && bucket !== 'waiting' && bucket !== 'in_review';
    const score = actionable ? reasons.reduce((total, reason) => total + reason.points, 0) : 0;
    return { taskId: input.taskId, score, bucket, reasons, headline: headlineFor(bucket, reasons) };
  },
};

/**
 * Highest score first; ties go to the earlier deadline (date, then due time,
 * with no time meaning the end of the working day), then to the title.
 */
export function rankWorkQueue(
  inputs: readonly PrioritizationInput[],
  today: CalendarDate,
  strategy: TaskPriorityStrategy = deadlineAwarePriorityStrategy,
  clock?: PriorityClock,
): PrioritizedTask[] {
  const dueDates = new Map(inputs.map((input) => [input.taskId, deadlineSortKey(input, clock)]));
  const titles = new Map(inputs.map((input) => [input.taskId, input.title]));
  return inputs
    .map((input) => strategy.prioritize(input, today, clock))
    .sort(
      (left, right) =>
        right.score - left.score ||
        (dueDates.get(left.taskId) ?? '').localeCompare(dueDates.get(right.taskId) ?? '') ||
        (titles.get(left.taskId) ?? '').localeCompare(titles.get(right.taskId) ?? ''),
    );
}
