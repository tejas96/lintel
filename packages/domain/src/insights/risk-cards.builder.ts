import {
  happeningFor,
  impactFor,
  isActionableRule,
  nextActionFor,
  responsibleFor,
  ruleForTask,
} from './risk-card.rules';
import {
  RISK_RULES,
  type RiskCard,
  type RiskCommitment,
  type RiskContext,
  type RiskProjectFacts,
  type RiskRule,
  type RiskTaskFacts,
} from './risk-card.types';
import { escalationFor } from './risk-escalation';
import {
  forecastCommitment,
  forecastSchedule,
  rootCauseOf,
  type TaskForecast,
} from './schedule-forecast';

const RULE_ORDER = new Map<RiskRule, number>(RISK_RULES.map((rule, index) => [rule, index]));

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
    severity: missed || impact.slipWorkingDays > 0 ? 'critical' : 'risk',
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
    nextAction: nextActionFor(rule, task, commitment, project.id),
    responsible,
    escalation: task
      ? escalationFor(rule, task, responsible.role, project.criticality, context)
      : null,
  };
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
 * Risk cards for one project (rules in docs/PRODUCT_REQUIREMENTS.md §15.2):
 * one per pending milestone that is at risk, missed or forecast late, plus one
 * for the planned delivery date when the forecast passes it and the cause is
 * not already explained by a milestone card.
 */
export function buildProjectRiskCards(project: RiskProjectFacts, context: RiskContext): RiskCard[] {
  const tasks = new Map(project.tasks.map((task) => [task.id, task]));
  const forecasts = forecastSchedule(
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
  const cards: RiskCard[] = [];
  for (const commitment of project.commitments.filter((item) => item.kind === 'milestone')) {
    const card = cardFor(project, commitment, forecasts, tasks, context);
    if (card) cards.push(card);
  }
  const explained = new Set(cards.map((card) => card.task?.id));
  for (const commitment of project.commitments.filter((item) => item.kind === 'delivery')) {
    const card = cardFor(project, commitment, forecasts, tasks, context);
    if (card && card.impact.slipWorkingDays > 0 && !explained.has(card.task?.id)) cards.push(card);
  }
  return cards.sort(compareRiskCards);
}
