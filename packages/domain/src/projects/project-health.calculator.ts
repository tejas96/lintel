import type { CalendarDate } from '@lintel/shared';
import { isOrAre, pluralize, wasOrWere } from '@lintel/shared';
import { isOpenTaskStatus, type TaskStatus } from '../tasks/task-status';
import type { CommitmentForecast, MilestoneHealth } from './milestone-risk';
import type { ProjectStatus } from './project-status';

export type ProjectHealthStatus = 'not_started' | 'on_track' | 'at_risk' | 'off_track' | 'closed';

export interface ProjectHealthInput {
  readonly status: ProjectStatus;
  readonly plannedEndDate: CalendarDate | null;
  readonly tasks: readonly { readonly status: TaskStatus; readonly dueDate: CalendarDate | null }[];
  readonly milestoneHealth: readonly MilestoneHealth[];
  /** Ages, in days, of blockers that are still open. */
  readonly openBlockerAgesInDays: readonly number[];
  /**
   * The schedule forecast (§15.2) of all open dated work against the planned
   * delivery date; null without open dated work.
   */
  readonly deliveryForecast: CommitmentForecast | null;
}

export interface ProjectHealthReason {
  readonly severity: 'risk' | 'critical';
  readonly message: string;
}

export interface ProjectHealth {
  readonly status: ProjectHealthStatus;
  readonly reasons: readonly ProjectHealthReason[];
  readonly openTaskCount: number;
  readonly overdueTaskCount: number;
  readonly blockedTaskCount: number;
  readonly completedTaskCount: number;
  /**
   * When open work is forecast to finish: the schedule forecast of §15.2
   * (durations kept, nothing in the past, blocked work not today,
   * prerequisites first), the same date as the delivery risk card. Null
   * without open dated work.
   */
  readonly forecastEndDate: CalendarDate | null;
}

/** A replaceable health policy (Strategy pattern). */
export interface ProjectHealthCalculator {
  readonly name: string;
  calculate(input: ProjectHealthInput, today: CalendarDate): ProjectHealth;
}

const STALE_BLOCKER_DAYS = 2;
const OVERDUE_COUNT_CRITICAL = 3;
const OVERDUE_SHARE_CRITICAL = 0.2;

function collectReasons(
  input: ProjectHealthInput,
  counts: { open: number; overdue: number },
): ProjectHealthReason[] {
  const reasons: ProjectHealthReason[] = [];
  const missed = input.milestoneHealth.filter((health) => health === 'missed').length;
  const atRisk = input.milestoneHealth.filter((health) => health === 'at_risk').length;
  if (missed > 0)
    reasons.push({
      severity: 'critical',
      message: `${pluralize(missed, 'milestone')} ${wasOrWere(missed)} missed.`,
    });
  if (atRisk > 0)
    reasons.push({
      severity: 'risk',
      message: `${pluralize(atRisk, 'milestone')} ${isOrAre(atRisk)} at risk.`,
    });
  if (counts.overdue > 0) {
    const share = counts.open === 0 ? 0 : counts.overdue / counts.open;
    const critical = counts.overdue >= OVERDUE_COUNT_CRITICAL || share >= OVERDUE_SHARE_CRITICAL;
    reasons.push({
      severity: critical ? 'critical' : 'risk',
      message: `${pluralize(counts.overdue, 'task')} ${isOrAre(counts.overdue)} overdue.`,
    });
  }
  const staleBlockers = input.openBlockerAgesInDays.filter(
    (age) => age >= STALE_BLOCKER_DAYS,
  ).length;
  if (staleBlockers > 0) {
    reasons.push({
      severity: 'risk',
      message: `${pluralize(staleBlockers, 'blocker')} ${staleBlockers === 1 ? 'has' : 'have'} been open for ${STALE_BLOCKER_DAYS}+ days.`,
    });
  }
  const forecast = input.deliveryForecast;
  if (input.plannedEndDate && forecast && forecast.slipWorkingDays > 0) {
    const days = `${forecast.slipWorkingDays} working day${forecast.slipWorkingDays === 1 ? '' : 's'}`;
    reasons.push({
      severity: 'critical',
      message: `Open work is forecast to finish ${days} past the planned delivery date, on ${forecast.forecastDate}.`,
    });
  }
  return reasons;
}

/**
 * Default rules, documented in docs/PRODUCT_REQUIREMENTS.md §6:
 * off track when any reason is critical; at risk when any reason exists.
 */
export const defaultProjectHealthCalculator: ProjectHealthCalculator = {
  name: 'rules-v2',
  calculate(input, today) {
    const openTasks = input.tasks.filter((task) => isOpenTaskStatus(task.status));
    const overdue = openTasks.filter(
      (task) => task.dueDate !== null && task.dueDate < today,
    ).length;
    const base = {
      openTaskCount: openTasks.length,
      overdueTaskCount: overdue,
      blockedTaskCount: openTasks.filter((task) => task.status === 'blocked').length,
      completedTaskCount: input.tasks.filter((task) => task.status === 'done').length,
      forecastEndDate: input.deliveryForecast?.forecastDate ?? null,
    };
    if (['completed', 'cancelled', 'archived'].includes(input.status)) {
      return { ...base, status: 'closed', reasons: [] };
    }
    if (input.status === 'draft') return { ...base, status: 'not_started', reasons: [] };
    // Critical reasons first: the first line explains an off-track status.
    const reasons = collectReasons(input, { open: openTasks.length, overdue }).sort(
      (left, right) => Number(right.severity === 'critical') - Number(left.severity === 'critical'),
    );
    const status: ProjectHealthStatus = reasons.some((reason) => reason.severity === 'critical')
      ? 'off_track'
      : reasons.length > 0
        ? 'at_risk'
        : 'on_track';
    return { ...base, status, reasons };
  },
};
