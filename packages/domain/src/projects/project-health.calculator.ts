import { type CalendarDate, daysBetween } from '@lintel/shared';
import { isOpenTaskStatus, type TaskStatus } from '../tasks/task-status';
import type { MilestoneHealth } from './milestone-risk';
import type { ProjectStatus } from './project-status';

export type ProjectHealthStatus = 'not_started' | 'on_track' | 'at_risk' | 'off_track' | 'closed';

export interface ProjectHealthInput {
  readonly status: ProjectStatus;
  readonly plannedEndDate: CalendarDate | null;
  readonly tasks: readonly { readonly status: TaskStatus; readonly dueDate: CalendarDate | null }[];
  readonly milestoneHealth: readonly MilestoneHealth[];
  /** Ages, in days, of blockers that are still open. */
  readonly openBlockerAgesInDays: readonly number[];
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
  /** Latest due date among open tasks: a simple forecast of the finish date. */
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

function latestDate(dates: readonly (CalendarDate | null)[]): CalendarDate | null {
  let latest: CalendarDate | null = null;
  for (const date of dates) if (date !== null && (latest === null || date > latest)) latest = date;
  return latest;
}

function collectReasons(
  input: ProjectHealthInput,
  counts: { open: number; overdue: number; forecastEnd: CalendarDate | null },
): ProjectHealthReason[] {
  const reasons: ProjectHealthReason[] = [];
  const missed = input.milestoneHealth.filter((health) => health === 'missed').length;
  const atRisk = input.milestoneHealth.filter((health) => health === 'at_risk').length;
  if (missed > 0)
    reasons.push({ severity: 'critical', message: `${missed} milestone(s) were missed.` });
  if (atRisk > 0)
    reasons.push({ severity: 'risk', message: `${atRisk} milestone(s) are at risk.` });
  if (counts.overdue > 0) {
    const share = counts.open === 0 ? 0 : counts.overdue / counts.open;
    const critical = counts.overdue >= OVERDUE_COUNT_CRITICAL || share >= OVERDUE_SHARE_CRITICAL;
    reasons.push({
      severity: critical ? 'critical' : 'risk',
      message: `${counts.overdue} task(s) are overdue.`,
    });
  }
  const staleBlockers = input.openBlockerAgesInDays.filter(
    (age) => age >= STALE_BLOCKER_DAYS,
  ).length;
  if (staleBlockers > 0) {
    reasons.push({
      severity: 'risk',
      message: `${staleBlockers} blocker(s) have been open for ${STALE_BLOCKER_DAYS}+ days.`,
    });
  }
  if (input.plannedEndDate && counts.forecastEnd && counts.forecastEnd > input.plannedEndDate) {
    const slip = daysBetween(input.plannedEndDate, counts.forecastEnd);
    reasons.push({
      severity: 'critical',
      message: `Open work is scheduled ${slip} day(s) past the planned delivery date.`,
    });
  }
  return reasons;
}

/**
 * Default rules, documented in docs/PRODUCT_REQUIREMENTS.md:
 * off track when any reason is critical; at risk when any reason exists.
 */
export const defaultProjectHealthCalculator: ProjectHealthCalculator = {
  name: 'rules-v1',
  calculate(input, today) {
    const openTasks = input.tasks.filter((task) => isOpenTaskStatus(task.status));
    const overdue = openTasks.filter(
      (task) => task.dueDate !== null && task.dueDate < today,
    ).length;
    const forecastEnd = latestDate(openTasks.map((task) => task.dueDate));
    const base = {
      openTaskCount: openTasks.length,
      overdueTaskCount: overdue,
      blockedTaskCount: openTasks.filter((task) => task.status === 'blocked').length,
      completedTaskCount: input.tasks.filter((task) => task.status === 'done').length,
      forecastEndDate: forecastEnd,
    };
    if (['completed', 'cancelled', 'archived'].includes(input.status)) {
      return { ...base, status: 'closed', reasons: [] };
    }
    if (input.status === 'draft') return { ...base, status: 'not_started', reasons: [] };
    const reasons = collectReasons(input, { open: openTasks.length, overdue, forecastEnd });
    const status: ProjectHealthStatus = reasons.some((reason) => reason.severity === 'critical')
      ? 'off_track'
      : reasons.length > 0
        ? 'at_risk'
        : 'on_track';
    return { ...base, status, reasons };
  },
};
