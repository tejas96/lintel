import type { WorkingCalendar } from '../calendar/working-calendar';
import { afterWorkingDays } from '../calendar/working-moments';
import type { EscalationAudience } from './deadline-escalation.policy';

export type BlockerFollowUpStage = 'manager' | 'owner';
export type ReviewFollowUpStage = 'reviewer' | 'manager';

/** Working days a blocker stays open before each audience hears about it. */
export const BLOCKER_FOLLOW_UP_WORKING_DAYS: Readonly<Record<BlockerFollowUpStage, number>> = {
  manager: 1,
  owner: 3,
};

/** Working days after submission: remind the reviewer after 1, the manager 2 days later. */
export const REVIEW_FOLLOW_UP_WORKING_DAYS: Readonly<Record<ReviewFollowUpStage, number>> = {
  reviewer: 1,
  manager: 3,
};

export interface FollowUpEscalationStep {
  readonly at: Date;
  readonly audience: EscalationAudience | 'reviewer';
}

/**
 * When an open blocker reaches the project manager and then the business
 * owner (people holding `dashboard.view_business`). The worker's blocker
 * follow-up workflow sleeps until exactly these moments.
 */
export function planBlockerFollowUp(
  calendar: WorkingCalendar,
  raisedAt: Date,
): FollowUpEscalationStep[] {
  return [
    {
      at: afterWorkingDays(calendar, raisedAt, BLOCKER_FOLLOW_UP_WORKING_DAYS.manager),
      audience: 'project_manager',
    },
    {
      at: afterWorkingDays(calendar, raisedAt, BLOCKER_FOLLOW_UP_WORKING_DAYS.owner),
      audience: 'business_owner',
    },
  ];
}

/** When a waiting review reminds the reviewer and then the project manager. */
export function planReviewFollowUp(
  calendar: WorkingCalendar,
  submittedAt: Date,
): FollowUpEscalationStep[] {
  return [
    {
      at: afterWorkingDays(calendar, submittedAt, REVIEW_FOLLOW_UP_WORKING_DAYS.reviewer),
      audience: 'reviewer',
    },
    {
      at: afterWorkingDays(calendar, submittedAt, REVIEW_FOLLOW_UP_WORKING_DAYS.manager),
      audience: 'project_manager',
    },
  ];
}
