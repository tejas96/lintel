import type { CalendarDate } from '@lintel/shared';
import type { WorkingCalendar } from '../calendar/working-calendar';
import {
  type ForecastTask,
  forecastCommitment,
  forecastSchedule,
  type TaskForecast,
} from '../insights/schedule-forecast';
import type { TaskDependencyEdge } from '../tasks/task-dependency-graph';
import {
  assessMilestoneRisk,
  type CommitmentForecast,
  type MilestoneRiskAssessment,
  type MilestoneStatus,
} from './milestone-risk';
import {
  defaultProjectHealthCalculator,
  type ProjectHealth,
  type ProjectHealthCalculator,
} from './project-health.calculator';
import type { ProjectStatus } from './project-status';

export interface ScheduledTaskFacts extends ForecastTask {
  readonly title: string;
  readonly milestoneId: string | null;
}

export interface ScheduledMilestoneFacts {
  readonly id: string;
  readonly name: string;
  readonly status: MilestoneStatus;
  readonly dueDate: CalendarDate;
}

/** One project's live records, as the health rules need them. */
export interface ProjectScheduleFacts {
  readonly status: ProjectStatus;
  readonly plannedEndDate: CalendarDate | null;
  /** Every non-archived task of the project. */
  readonly tasks: readonly ScheduledTaskFacts[];
  readonly dependencies: readonly TaskDependencyEdge[];
  readonly milestones: readonly ScheduledMilestoneFacts[];
  /** Ages, in days, of blockers that are still open. */
  readonly openBlockerAgesInDays: readonly number[];
}

export interface ProjectScheduleHealth {
  readonly health: ProjectHealth;
  readonly milestoneRisk: Map<string, MilestoneRiskAssessment>;
}

/** Latest forecast finish of all open dated work, against the planned delivery date. */
function deliveryForecastOf(
  plannedEndDate: CalendarDate | null,
  forecasts: ReadonlyMap<string, TaskForecast>,
  calendar: WorkingCalendar,
): CommitmentForecast | null {
  let latest: CalendarDate | null = null;
  for (const forecast of forecasts.values()) {
    if (latest === null || forecast.forecastFinish > latest) latest = forecast.forecastFinish;
  }
  if (latest === null) return null;
  if (plannedEndDate === null) return { forecastDate: latest, slipWorkingDays: 0 };
  const commitment = forecastCommitment(plannedEndDate, [...forecasts.keys()], forecasts, calendar);
  return commitment
    ? { forecastDate: commitment.forecastDate, slipWorkingDays: commitment.slipWorkingDays }
    : null;
}

/**
 * Milestone and project health judged on one schedule forecast
 * (docs/PRODUCT_REQUIREMENTS.md §6 and §15.2), the same forecast the risk
 * cards use: a milestone a card says is late is never "on track", and the
 * project's forecast end is the delivery card's forecast date.
 */
export function assessProjectSchedule(
  facts: ProjectScheduleFacts,
  calendar: WorkingCalendar,
  today: CalendarDate,
  calculator: ProjectHealthCalculator = defaultProjectHealthCalculator,
): ProjectScheduleHealth {
  const forecasts = forecastSchedule(facts.tasks, facts.dependencies, calendar, today);
  const milestoneRisk = new Map<string, MilestoneRiskAssessment>();
  for (const milestone of facts.milestones) {
    const linked = facts.tasks.filter((task) => task.milestoneId === milestone.id);
    const forecast = forecastCommitment(
      milestone.dueDate,
      linked.map((task) => task.id),
      forecasts,
      calendar,
    );
    milestoneRisk.set(
      milestone.id,
      assessMilestoneRisk(
        {
          name: milestone.name,
          status: milestone.status,
          dueDate: milestone.dueDate,
          tasks: linked,
          forecast: forecast
            ? { forecastDate: forecast.forecastDate, slipWorkingDays: forecast.slipWorkingDays }
            : null,
        },
        today,
      ),
    );
  }
  const health = calculator.calculate(
    {
      status: facts.status,
      plannedEndDate: facts.plannedEndDate,
      tasks: facts.tasks,
      milestoneHealth: [...milestoneRisk.values()].map((risk) => risk.health),
      openBlockerAgesInDays: facts.openBlockerAgesInDays,
      deliveryForecast: deliveryForecastOf(facts.plannedEndDate, forecasts, calendar),
    },
    today,
  );
  return { health, milestoneRisk };
}
