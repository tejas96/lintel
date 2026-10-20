/**
 * Reward rules are configured by administrators as a list of criteria; every
 * criterion must pass. Raw task volume is deliberately not a criterion.
 */
export type RewardCriterion =
  | {
      readonly type: 'on_time_delivery_rate';
      readonly minimumRate: number;
      readonly minimumTasks: number;
    }
  | {
      readonly type: 'first_pass_approval_rate';
      readonly minimumRate: number;
      readonly minimumReviews: number;
    }
  | { readonly type: 'milestones_delivered_on_time'; readonly minimumCount: number }
  | {
      readonly type: 'proactive_blocker_reporting';
      readonly minimumCount: number;
      readonly leadDays: number;
    }
  | { readonly type: 'collaboration'; readonly minimumTasks: number }
  | {
      readonly type: 'process_compliance_rate';
      readonly minimumRate: number;
      readonly minimumTasks: number;
    }
  | { readonly type: 'on_time_improvement'; readonly minimumPercentagePoints: number };

export type RewardCriterionType = RewardCriterion['type'];

export const REWARD_CRITERION_LABELS: Readonly<Record<RewardCriterionType, string>> = {
  on_time_delivery_rate: 'Delivered on time',
  first_pass_approval_rate: 'Approved without rework',
  milestones_delivered_on_time: 'Milestones delivered on time',
  proactive_blocker_reporting: 'Raised blockers early',
  collaboration: 'Helped on other tasks',
  process_compliance_rate: 'Followed the checklist',
  on_time_improvement: 'Improved on-time delivery',
};

export const REWARD_SCOPES = ['individual', 'team'] as const;
export type RewardScope = (typeof REWARD_SCOPES)[number];

export const REWARD_PERIODS = ['monthly', 'quarterly'] as const;
export type RewardPeriod = (typeof REWARD_PERIODS)[number];

export const REWARD_EVALUATION_STATUSES = [
  'ineligible',
  'pending_review',
  'approved',
  'rejected',
] as const;
export type RewardEvaluationStatus = (typeof REWARD_EVALUATION_STATUSES)[number];
