/** One wait-then-notify stage of a follow-up workflow (JSON-safe). */
export interface FollowUpStagePlan {
  readonly key: string;
  readonly delayMs: number;
}

/** Computed by an activity so the workflow never reads the clock or the calendar itself. */
export interface FollowUpPlan {
  /** False when the subject is already decided, resolved or gone. */
  readonly active: boolean;
  readonly stages: readonly FollowUpStagePlan[];
}

/** `resolved`: the review was decided or the blocker cleared, so the workflow stops. */
export type FollowUpSendResult = 'sent' | 'no_recipient' | 'resolved';

export const INACTIVE_PLAN: FollowUpPlan = { active: false, stages: [] };
