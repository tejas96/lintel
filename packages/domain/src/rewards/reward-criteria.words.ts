import type { RewardCriterion, RewardCriterionType } from './reward-criteria';

/** How each criterion is measured, in one plain sentence (shared by web and mobile). */
export const REWARD_CRITERION_EXPLANATIONS: Readonly<Record<RewardCriterionType, string>> = {
  on_time_delivery_rate:
    'Finished tasks delivered by their latest approved due date. Days spent waiting on a client, supplier or decision are not counted as late.',
  first_pass_approval_rate: 'Reviewed work approved the first time it was sent.',
  milestones_delivered_on_time: 'Milestones the person or team completed by their due date.',
  proactive_blocker_reporting: 'Problems reported early enough for someone to act.',
  collaboration: 'Tasks owned by someone else that the person helped finish.',
  process_compliance_rate: 'Tasks finished with every required checklist item done.',
  on_time_improvement: 'On-time delivery better than in the previous period.',
};

const percent = (rate: number) => `${Math.round(rate * 100)}%`;
const count = (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`;

/** One plain sentence for a criterion, e.g. "At least 85% of tasks on time, out of 3 or more". */
export function describeRewardCriterion(criterion: RewardCriterion): string {
  switch (criterion.type) {
    case 'on_time_delivery_rate':
      return `At least ${percent(criterion.minimumRate)} of tasks on time, out of ${criterion.minimumTasks} or more`;
    case 'first_pass_approval_rate':
      return `At least ${percent(criterion.minimumRate)} approved first time, out of ${criterion.minimumReviews} or more reviews`;
    case 'milestones_delivered_on_time':
      return `At least ${count(criterion.minimumCount, 'milestone', 'milestones')} delivered on time`;
    case 'proactive_blocker_reporting':
      return `At least ${count(criterion.minimumCount, 'blocker', 'blockers')} raised ${count(criterion.leadDays, 'day', 'days')} or more before the due date`;
    case 'collaboration':
      return `Helped on at least ${count(criterion.minimumTasks, 'task', 'tasks')} owned by others`;
    case 'process_compliance_rate':
      return `At least ${percent(criterion.minimumRate)} of tasks finished with the checklist complete, out of ${criterion.minimumTasks} or more`;
    case 'on_time_improvement':
      return `On-time delivery up by at least ${count(criterion.minimumPercentagePoints, 'point', 'points')} on the previous period`;
  }
}
