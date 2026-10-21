import {
  happeningFor,
  impactFor,
  isActionableRule,
  nextActionFor,
  responsibleFor,
  ruleForTask,
} from './risk-card.rules';
import type {
  RiskCard,
  RiskCommitment,
  RiskContext,
  RiskProjectFacts,
  RiskRule,
  RiskTaskFacts,
} from './risk-card.types';
import { escalationFor } from './risk-escalation';
import {
  forecastCommitment,
  forecastSchedule,
  rootCauseOf,
  type TaskForecast,
} from './schedule-forecast';

/**
 * Which problem explains a risk best when nothing slips yet: blocked and
 * overdue work first, then a decision waiting, a late start, an absence, a review.
 */
const CANDIDATE_ORDER: readonly RiskRule[] = [
  'blocked',
  'overdue',
  'date_request_waiting',
  'late_start',
  'owner_away',
  'review_waiting',
];
const RULE_ORDER = new Map<RiskRule, number>(CANDIDATE_ORDER.map((rule, index) => [rule, index]));

function isOpen(task: RiskTaskFacts): boolean {
  return !['done', 'cancelled'].includes(task.status);
}

/**
 * The task that explains a commitment's risk: when the forecast slips it,
 * the task where the delay starts (followed upstream through prerequisites);
 * otherwise the linked open task with the most pressing problem.
 */
function driverOf(
  commitment: RiskCommitment,
  tasks: ReadonlyMap<string, RiskTaskFacts>,
  forecasts: ReadonlyMap<string, TaskForecast>,
  forecast: ReturnType<typeof forecastCommitment>,
  context: RiskContext,
): RiskTaskFacts | null {
  if (forecast && forecast.slipWorkingDays > 0) {
    const root = rootCauseOf(forecast.driverTaskId, forecasts);
    return tasks.get(root?.taskId ?? forecast.driverTaskId) ?? null;
  }
  const candidates = commitment.taskIds
    .map((id) => tasks.get(id))
    .filter((task): task is RiskTaskFacts => task !== undefined && isOpen(task))
    .map((task) => ({ task, rule: ruleForTask(task, context.today) }))
    .filter((candidate) => isActionableRule(candidate.rule))
    .sort(
      (left, right) =>
        (RULE_ORDER.get(left.rule) ?? 99) - (RULE_ORDER.get(right.rule) ?? 99) ||
        (left.task.dueDate ?? '9999').localeCompare(right.task.dueDate ?? '9999'),
    );
  return candidates[0]?.task ?? null;
}

function needsCard(
  commitment: RiskCommitment,
  forecast: ReturnType<typeof forecastCommitment>,
): boolean {
  if ((forecast?.slipWorkingDays ?? 0) > 0) return true;
  return commitment.health === 'at_risk' || commitment.health === 'missed';
}

function cardFor(
  project: RiskProjectFacts,
  commitment: RiskCommitment,
  forecasts: ReadonlyMap<string, TaskForecast>,
  tasks: ReadonlyMap<string, RiskTaskFacts>,
  context: RiskContext,
): RiskCard | null {
  const forecast = forecastCommitment(
    commitment.dueDate,
    commitment.taskIds,
    forecasts,
    context.calendar,
  );
  if (!needsCard(commitment, forecast)) return null;
  const task = driverOf(commitment, tasks, forecasts, forecast, context);
  if (!task && commitment.health !== 'missed') return null;
  const rule: RiskRule = task ? ruleForTask(task, context.today) : 'missed_without_open_work';
  const responsible = responsibleFor(rule, task, project.managerUserId);
  const impact = impactFor(commitment, forecast, context.today);
  const missed = commitment.dueDate < context.today;
  return {
    key: `${commitment.kind}:${commitment.id}:${rule}:${task?.id ?? 'none'}`,
    rule,
    severity: commitment.critical || missed || impact.slipWorkingDays > 0 ? 'critical' : 'risk',
    projectId: project.id,
    commitment: {
      kind: commitment.kind,
      id: commitment.id,
      name: commitment.name,
      dueDate: commitment.dueDate,
    },
    task: task ? { id: task.id, title: task.title } : null,
    happening: happeningFor(rule, task, commitment, context),
    impact,
    alsoAffects: [],
    nextAction: nextActionFor(rule, task, commitment, project.id),
    responsible,
    escalation: task
      ? escalationFor(rule, task, responsible.role, project.criticality, context)
      : null,
  };
}

function forecastProject(project: RiskProjectFacts, context: RiskContext) {
  return forecastSchedule(
    project.tasks.map((task) => ({
      id: task.id,
      status: task.status,
      plannedStartDate: task.plannedStartDate,
      dueDate: task.dueDate,
      hasOpenBlocker: task.openBlocker !== null,
    })),
    project.dependencies,
    context.calendar,
    context.today,
  );
}

/** Most pressing first: critical before risk, larger slip, earlier commitment. */
export function compareRiskCards(left: RiskCard, right: RiskCard): number {
  const severity = (card: RiskCard) => (card.severity === 'critical' ? 0 : 1);
  return (
    severity(left) - severity(right) ||
    right.impact.slipWorkingDays - left.impact.slipWorkingDays ||
    left.commitment.dueDate.localeCompare(right.commitment.dueDate)
  );
}

/**
 * One card per cause: when the same problem on the same task puts several
 * commitments at risk, the earliest commitment keeps the card and the others
 * are listed as also affected (the planned delivery only when it slips).
 */
function mergeByCause(candidates: readonly RiskCard[]): RiskCard[] {
  const ordered = [...candidates].sort(
    (left, right) =>
      Number(left.commitment.kind === 'delivery') - Number(right.commitment.kind === 'delivery') ||
      left.commitment.dueDate.localeCompare(right.commitment.dueDate),
  );
  const byCause = new Map<string, RiskCard>();
  for (const card of ordered) {
    const cause = `${card.rule}:${card.task?.id ?? card.commitment.id}`;
    const first = byCause.get(cause);
    if (!first) {
      byCause.set(cause, card);
      continue;
    }
    if (card.commitment.kind === 'delivery' && card.impact.slipWorkingDays === 0) continue;
    byCause.set(cause, {
      ...first,
      severity: first.severity === 'critical' || card.severity === 'critical' ? 'critical' : 'risk',
      alsoAffects: [
        ...first.alsoAffects,
        { ...card.commitment, slipWorkingDays: card.impact.slipWorkingDays },
      ],
    });
  }
  return [...byCause.values()].sort(compareRiskCards);
}

/**
 * Risk cards for one project (rules in docs/PRODUCT_REQUIREMENTS.md §15.2):
 * one per pending milestone that is at risk, missed or forecast late, plus one
 * for the planned delivery date when the forecast passes it or the project is
 * at risk or off track; cards with the same cause are merged (mergeByCause).
 */
export function buildProjectRiskCards(project: RiskProjectFacts, context: RiskContext): RiskCard[] {
  const tasks = new Map(project.tasks.map((task) => [task.id, task]));
  const forecasts = forecastProject(project, context);
  const candidates = project.commitments
    .map((commitment) => cardFor(project, commitment, forecasts, tasks, context))
    .filter((card): card is RiskCard => card !== null);
  return mergeByCause(candidates);
}

/**
 * The project's planned delivery against the same forecast the cards use:
 * the latest forecast finish of its open tasks. Null without open dated work.
 */
export function forecastDelivery(
  project: RiskProjectFacts,
  context: RiskContext,
): { forecastDate: RiskContext['today']; slipWorkingDays: number } | null {
  const delivery = project.commitments.find((item) => item.kind === 'delivery');
  if (!delivery) return null;
  const forecasts = forecastProject(project, context);
  const forecast = forecastCommitment(
    delivery.dueDate,
    delivery.taskIds,
    forecasts,
    context.calendar,
  );
  return forecast
    ? { forecastDate: forecast.forecastDate, slipWorkingDays: forecast.slipWorkingDays }
    : null;
}
