import { type CalendarDate, daysBetween } from '@lintel/shared';
import type { TaskStatus } from '../tasks/task-status';
import { isOpenTaskStatus } from '../tasks/task-status';

export const MILESTONE_STATUSES = ['pending', 'completed', 'cancelled'] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export type MilestoneHealth = 'completed' | 'on_track' | 'at_risk' | 'missed';

export interface MilestoneTaskFact {
  readonly title: string;
  readonly status: TaskStatus;
  readonly dueDate: CalendarDate | null;
  /** An unresolved blocker counts like the blocked status (as in the forecast). */
  readonly hasOpenBlocker: boolean;
}

/** A commitment's schedule forecast (§15.2): the latest forecast finish of its open tasks. */
export interface CommitmentForecast {
  readonly forecastDate: CalendarDate;
  /** Working days the forecast lies after the committed date (0 when on time). */
  readonly slipWorkingDays: number;
}

export interface MilestoneRiskInput {
  readonly name: string;
  readonly status: MilestoneStatus;
  readonly dueDate: CalendarDate;
  readonly tasks: readonly MilestoneTaskFact[];
  /** The forecast of its linked tasks (`forecastCommitment`); null without open dated work. */
  readonly forecast: CommitmentForecast | null;
}

export interface MilestoneRiskAssessment {
  readonly health: MilestoneHealth;
  readonly reasons: readonly string[];
  readonly openTaskCount: number;
}

/** Days before a milestone in which open blocked or late work counts as a risk. */
export const MILESTONE_RISK_WINDOW_DAYS = 7;

const workingDays = (count: number) => `${count} working day${count === 1 ? '' : 's'}`;

/**
 * A pending milestone is at risk when its schedule forecast passes its due
 * date, or when, within 7 days of it, a linked open task is blocked or
 * overdue (docs/PRODUCT_REQUIREMENTS.md §6). The slip comes first among the
 * reasons, then what explains it.
 */
export function assessMilestoneRisk(
  milestone: MilestoneRiskInput,
  today: CalendarDate,
): MilestoneRiskAssessment {
  const openTasks = milestone.tasks.filter((task) => isOpenTaskStatus(task.status));
  if (milestone.status === 'completed' || milestone.status === 'cancelled') {
    return { health: 'completed', reasons: [], openTaskCount: 0 };
  }
  const daysLeft = daysBetween(today, milestone.dueDate);
  if (daysLeft < 0) {
    return {
      health: 'missed',
      reasons: [`"${milestone.name}" was due ${-daysLeft} day(s) ago and is not complete.`],
      openTaskCount: openTasks.length,
    };
  }
  const reasons: string[] = [];
  const forecast = milestone.forecast;
  if (forecast && forecast.slipWorkingDays > 0) {
    reasons.push(
      `Forecast ${workingDays(forecast.slipWorkingDays)} late, on ${forecast.forecastDate} instead of ${milestone.dueDate}.`,
    );
  }
  // Always part of the slip above (nothing finishes before its due date); says why.
  const lateTasks = openTasks.filter(
    (task) => task.dueDate !== null && task.dueDate > milestone.dueDate,
  );
  if (lateTasks.length > 0) {
    reasons.push(`${lateTasks.length} task(s) are scheduled to finish after the milestone.`);
  }
  if (daysLeft <= MILESTONE_RISK_WINDOW_DAYS) {
    const blocked = openTasks.filter((task) => task.status === 'blocked' || task.hasOpenBlocker);
    const overdue = openTasks.filter((task) => task.dueDate !== null && task.dueDate < today);
    if (blocked.length > 0) reasons.push(`${blocked.length} task(s) are blocked.`);
    if (overdue.length > 0) reasons.push(`${overdue.length} task(s) are overdue.`);
  }
  return {
    health: reasons.length > 0 ? 'at_risk' : 'on_track',
    reasons,
    openTaskCount: openTasks.length,
  };
}
