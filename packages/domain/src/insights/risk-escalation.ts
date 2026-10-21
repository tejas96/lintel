import { calendarDateInTimeZone, localTimeInTimeZone } from '@lintel/shared';
import type { WorkingCalendar } from '../calendar/working-calendar';
import { planDeadlineEscalation } from '../notifications/deadline-escalation.policy';
import {
  planBlockerFollowUp,
  planReviewFollowUp,
} from '../notifications/follow-up-escalation.policy';
import type { ProjectCriticality } from '../projects/project-status';
import type {
  ResponsibleRole,
  RiskContext,
  RiskEscalation,
  RiskRule,
  RiskTaskFacts,
} from './risk-card.types';

type Audience = RiskEscalation['audience'];

interface TimelineStep {
  readonly at: Date;
  readonly audience: Audience | 'task_owner';
}

const AUDIENCE_NAME: Readonly<Record<Audience, string>> = {
  reviewer: 'The reviewer',
  project_manager: 'The project manager',
  business_owner: 'The studio owner',
};

/** What "nobody acted" means for each rule, in the escalation sentence. */
const STILL: Partial<Readonly<Record<RiskRule, string>>> = {
  blocked: 'it is still blocked',
  review_waiting: 'the review is still waiting',
  overdue: 'it is still open',
  late_start: 'it is still open after its due date',
  scheduled_late: 'it is still open after its due date',
};

/** Audiences that count as "above" the responsible person for that role. */
function isAbove(audience: TimelineStep['audience'], responsible: ResponsibleRole): boolean {
  if (audience === 'task_owner') return false;
  if (audience === 'reviewer') return responsible === 'task_owner';
  if (audience === 'project_manager') return responsible !== 'project_manager';
  return true;
}

function timelineFor(
  rule: RiskRule,
  task: RiskTaskFacts,
  criticality: ProjectCriticality,
  context: RiskContext,
): TimelineStep[] {
  const calendar: WorkingCalendar = context.calendar;
  if (rule === 'blocked' && task.openBlocker) {
    return planBlockerFollowUp(calendar, task.openBlocker.raisedAt);
  }
  if (rule === 'review_waiting' && task.submittedAt) {
    return planReviewFollowUp(calendar, task.submittedAt);
  }
  if ((rule === 'overdue' || rule === 'late_start' || rule === 'scheduled_late') && task.dueDate) {
    return planDeadlineEscalation({
      dueDate: task.dueDate,
      priority: task.priority,
      projectCriticality: criticality,
      escalateAfterOverdueDays: task.escalateAfterOverdueDays,
      calendar,
      reminderTime: context.reminderTime,
    });
  }
  return [];
}

/**
 * When the risk reaches someone above the responsible person if nobody acts:
 * the next alert in the same timeline the worker follows (blocker and review
 * follow-ups, the deadline escalation). When every alert has gone out, the
 * last one is reported as already happened. Null for rules with no
 * automatic alert (a decision waiting, cover for an absence).
 */
export function escalationFor(
  rule: RiskRule,
  task: RiskTaskFacts,
  responsible: ResponsibleRole,
  criticality: ProjectCriticality,
  context: RiskContext,
): RiskEscalation | null {
  const steps = timelineFor(rule, task, criticality, context)
    .filter((step) => isAbove(step.audience, responsible))
    .sort((left, right) => left.at.getTime() - right.at.getTime());
  if (steps.length === 0) return null;
  const now = context.now.getTime();
  const next = steps.find((step) => step.at.getTime() > now);
  const step = next ?? steps[steps.length - 1];
  if (!step || step.audience === 'task_owner') return null;
  const zone = context.calendar.timeZone;
  const when = `${calendarDateInTimeZone(step.at, zone)} at ${localTimeInTimeZone(step.at, zone)}`;
  const condition = STILL[rule] ?? 'nothing changes';
  const audience = AUDIENCE_NAME[step.audience];
  return {
    audience: step.audience,
    at: step.at,
    alreadyHappened: next === undefined,
    summary: next
      ? `${audience} is alerted on ${when} if ${condition}.`
      : `${audience} was alerted on ${when}; ${condition}.`,
  };
}
