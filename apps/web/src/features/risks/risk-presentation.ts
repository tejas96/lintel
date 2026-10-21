import type { RiskCardItem } from '@lintel/api-contracts';
import type { PillTone, StatusGlyphName } from '@lintel/design-system/web';

/** A short name for the rule that explained the risk. */
export const RULE_LABELS: Readonly<Record<RiskCardItem['rule'], string>> = {
  date_request_waiting: 'New date asked',
  blocked: 'Blocked',
  review_waiting: 'Review waiting',
  owner_away: 'Owner away',
  overdue: 'Overdue',
  late_start: 'Late start',
  scheduled_late: 'Planned too late',
  missed_without_open_work: 'Not closed',
};

export const ROLE_LABELS: Readonly<Record<RiskCardItem['responsible']['role'], string>> = {
  task_owner: 'Task owner',
  reviewer: 'Reviewer',
  project_manager: 'Project manager',
  waiting_on: 'Waiting on them',
};

/** Critical and forecast late: "Slipping"; critical without a slip yet: "Critical"; else "At risk". */
export function severityOf(card: RiskCardItem): {
  tone: PillTone;
  glyph: StatusGlyphName;
  label: string;
} {
  if (card.severity === 'risk') return { tone: 'atRisk', glyph: 'atRisk', label: 'At risk' };
  return {
    tone: 'overdue',
    glyph: 'overdue',
    label: card.impact.slipWorkingDays > 0 ? 'Slipping' : 'Critical',
  };
}

/** Why a card has no escalation time, in the rule's own terms. */
export const NO_ESCALATION: Readonly<Record<RiskCardItem['rule'], string>> = {
  date_request_waiting: 'No automatic alert: the request waits in the project manager’s approvals.',
  blocked: 'No further alert is planned.',
  review_waiting: 'No further alert is planned.',
  owner_away: 'No automatic alert: choosing cover is the project manager’s call.',
  overdue: 'No further alert is planned for this task.',
  late_start: 'No alert to anyone else until the task is overdue.',
  scheduled_late: 'No alert to anyone else until the task is overdue.',
  missed_without_open_work: 'No automatic alert: it stays here until someone closes it.',
};
