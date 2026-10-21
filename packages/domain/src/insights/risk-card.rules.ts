import { calendarDateInTimeZone } from '@lintel/shared';
import { isLateToStart } from '../tasks/late-start.policy';
import { TASK_STATUS_LABELS } from '../tasks/task-status';
import type {
  BlockerCategoryName,
  ResponsibleRole,
  RiskCommitment,
  RiskContext,
  RiskLinkTarget,
  RiskRule,
  RiskTaskFacts,
} from './risk-card.types';

/** The rule that explains a task's part in a risk (first match in RISK_RULES order). */
export function ruleForTask(task: RiskTaskFacts, today: RiskContext['today']): RiskRule {
  if (task.openDateRequest) return 'date_request_waiting';
  if (task.status === 'blocked' || task.openBlocker) return 'blocked';
  if (task.status === 'in_review') return 'review_waiting';
  if (task.ownerAway) return 'owner_away';
  if (task.dueDate !== null && task.dueDate < today) return 'overdue';
  if (isLateToStart(task, today)) return 'late_start';
  return 'scheduled_late';
}

/** True when a rule names a concrete problem (not only "due after the commitment"). */
export function isActionableRule(rule: RiskRule): boolean {
  return rule !== 'scheduled_late' && rule !== 'missed_without_open_work';
}

export function responsibleFor(
  rule: RiskRule,
  task: RiskTaskFacts | null,
  managerUserId: string,
): { role: ResponsibleRole; userId: string | null } {
  const manager = { role: 'project_manager' as const, userId: managerUserId };
  if (!task) return manager;
  switch (rule) {
    case 'blocked': {
      const blocker = task.openBlocker;
      if (blocker?.waitingOnUserId) return { role: 'waiting_on', userId: blocker.waitingOnUserId };
      if (blocker?.category === 'manager_decision') return manager;
      return task.ownerUserId ? { role: 'task_owner', userId: task.ownerUserId } : manager;
    }
    case 'review_waiting':
      return task.reviewerUserId ? { role: 'reviewer', userId: task.reviewerUserId } : manager;
    case 'overdue':
    case 'late_start':
      return task.ownerUserId ? { role: 'task_owner', userId: task.ownerUserId } : manager;
    default:
      return manager;
  }
}

const WAITING_ON: Readonly<Record<BlockerCategoryName, string>> = {
  client: 'waiting on the client',
  supplier: 'waiting on a supplier',
  internal_dependency: 'waiting on other work',
  manager_decision: 'waiting for a manager decision',
  information: 'waiting for information',
  other: 'blocked',
};

const BLOCKER_ACTION: Readonly<Record<BlockerCategoryName, string>> = {
  client: 'Chase the client so "%t" can move',
  supplier: 'Chase the supplier so "%t" can move',
  internal_dependency: 'Unblock the work "%t" waits on',
  manager_decision: 'Make the decision "%t" is waiting for',
  information: 'Get the missing information for "%t"',
  other: 'Clear the blocker on "%t"',
};

/** One plain sentence: what is happening. ISO dates are made readable by the apps. */
export function happeningFor(
  rule: RiskRule,
  task: RiskTaskFacts | null,
  commitment: RiskCommitment,
  context: RiskContext,
): string {
  const zone = context.calendar.timeZone;
  if (!task) {
    return `"${commitment.name}" was due ${commitment.dueDate}; its tasks are done but it is not marked complete.`;
  }
  const title = task.title;
  switch (rule) {
    case 'date_request_waiting':
      return `A new due date (${task.openDateRequest?.proposedDueDate ?? ''}) was asked for "${title}" and waits for a decision.`;
    case 'blocked': {
      const blocker = task.openBlocker;
      if (!blocker) return `"${title}" is blocked.`;
      const since = calendarDateInTimeZone(blocker.raisedAt, zone);
      return `"${title}" is ${WAITING_ON[blocker.category]} since ${since}: ${blocker.reason}`;
    }
    case 'review_waiting':
      return task.submittedAt
        ? `"${title}" has waited for review since ${calendarDateInTimeZone(task.submittedAt, zone)}.`
        : `"${title}" is waiting for review.`;
    case 'owner_away':
      return `The owner of "${title}" is away from ${task.ownerAway?.startDate ?? ''} to ${task.ownerAway?.endDate ?? ''}.`;
    case 'overdue':
      return `"${title}" was due ${task.dueDate ?? ''} and is still ${TASK_STATUS_LABELS[task.status].toLowerCase()}.`;
    case 'late_start':
      return `"${title}" was planned to start ${task.plannedStartDate ?? ''} and has not started.`;
    default:
      return `"${title}" is due ${task.dueDate ?? ''}, after ${commitmentLabel(commitment)} (${commitment.dueDate}).`;
  }
}

function commitmentLabel(commitment: RiskCommitment): string {
  return commitment.kind === 'delivery' ? 'the planned delivery' : `"${commitment.name}"`;
}

export function nextActionFor(
  rule: RiskRule,
  task: RiskTaskFacts | null,
  commitment: RiskCommitment,
  projectId: string,
): { label: string; target: RiskLinkTarget } {
  if (!task) {
    return {
      label: `Mark "${commitment.name}" complete or agree a new date`,
      target: { kind: 'project', id: projectId },
    };
  }
  const taskTarget: RiskLinkTarget = { kind: 'task', id: task.id };
  const title = task.title;
  switch (rule) {
    case 'date_request_waiting':
      return {
        label: `Accept or decline the new date for "${title}"`,
        target: task.openDateRequest
          ? { kind: 'date_request', id: task.openDateRequest.id, taskId: task.id }
          : taskTarget,
      };
    case 'blocked':
      return {
        label: BLOCKER_ACTION[task.openBlocker?.category ?? 'other'].replace('%t', title),
        target: taskTarget,
      };
    case 'review_waiting':
      return { label: `Review "${title}"`, target: taskTarget };
    case 'owner_away':
      return {
        label: `Choose who covers "${title}"`,
        target: task.ownerAway ? { kind: 'leave', id: task.ownerAway.leaveRequestId } : taskTarget,
      };
    case 'overdue':
      return { label: `Finish "${title}" or ask for a new date`, target: taskTarget };
    case 'late_start':
      return {
        label: `Start "${title}", report a blocker or ask for a new date`,
        target: taskTarget,
      };
    default:
      return {
        label: `Re-plan "${title}" or move ${commitmentLabel(commitment)}`,
        target: taskTarget,
      };
  }
}

export function impactFor(
  commitment: RiskCommitment,
  forecast: { forecastDate: RiskContext['today']; slipWorkingDays: number } | null,
  today: RiskContext['today'],
): { slipWorkingDays: number; forecastDate: RiskContext['today'] | null; summary: string } {
  const label = commitment.kind === 'delivery' ? 'Delivery' : `"${commitment.name}"`;
  const inSentence = commitment.kind === 'delivery' ? 'the planned delivery' : label;
  const slip = forecast?.slipWorkingDays ?? 0;
  if (forecast && slip > 0) {
    const days = `${slip} working day${slip === 1 ? '' : 's'}`;
    return {
      slipWorkingDays: slip,
      forecastDate: forecast.forecastDate,
      summary: `${label} is forecast ${days} late, on ${forecast.forecastDate} instead of ${commitment.dueDate}.`,
    };
  }
  if (commitment.dueDate < today) {
    return {
      slipWorkingDays: 0,
      forecastDate: forecast?.forecastDate ?? null,
      summary: `${label} was due ${commitment.dueDate} and is not complete.`,
    };
  }
  return {
    slipWorkingDays: 0,
    forecastDate: forecast?.forecastDate ?? null,
    summary: `No slip forecast yet; ${inSentence} (due ${commitment.dueDate}) slips if this is not resolved.`,
  };
}
