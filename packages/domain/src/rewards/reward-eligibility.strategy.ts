import { assertNever } from '@lintel/shared';
import { REWARD_CRITERION_LABELS, type RewardCriterion } from './reward-criteria';
import type { RewardMetrics } from './reward-metrics';

export interface CriterionResult {
  readonly type: RewardCriterion['type'];
  readonly label: string;
  readonly passed: boolean;
  readonly actual: string;
  readonly required: string;
  readonly explanation: string;
}

export interface RewardEligibility {
  readonly eligible: boolean;
  readonly criteria: readonly CriterionResult[];
  readonly summary: string;
}

const percent = (value: number) => `${Math.round(value * 100)}%`;
const rate = (part: number, whole: number) => (whole === 0 ? 0 : part / whole);

function rateCriterion(
  criterion: RewardCriterion,
  part: number,
  whole: number,
  minimumRate: number,
  minimumSample: number,
  noun: string,
): CriterionResult {
  const label = REWARD_CRITERION_LABELS[criterion.type];
  const actualRate = rate(part, whole);
  const enoughData = whole >= minimumSample;
  const passed = enoughData && actualRate >= minimumRate;
  const explanation = enoughData
    ? `${part} of ${whole} ${noun} (${percent(actualRate)}); needs ${percent(minimumRate)}.`
    : `Only ${whole} ${noun} in this period; at least ${minimumSample} are needed to judge fairly.`;
  return {
    type: criterion.type,
    label,
    passed,
    actual: percent(actualRate),
    required: `${percent(minimumRate)} of ≥ ${minimumSample}`,
    explanation,
  };
}

function countCriterion(
  criterion: RewardCriterion,
  actual: number,
  minimum: number,
  noun: string,
): CriterionResult {
  return {
    type: criterion.type,
    label: REWARD_CRITERION_LABELS[criterion.type],
    passed: actual >= minimum,
    actual: String(actual),
    required: `≥ ${minimum}`,
    explanation: `${actual} ${noun}; needs at least ${minimum}.`,
  };
}

function evaluateCriterion(criterion: RewardCriterion, metrics: RewardMetrics): CriterionResult {
  switch (criterion.type) {
    case 'on_time_delivery_rate':
      return rateCriterion(
        criterion,
        metrics.ownedTasksOnTime,
        metrics.ownedTasksCompleted,
        criterion.minimumRate,
        criterion.minimumTasks,
        'owned tasks were on time',
      );
    case 'first_pass_approval_rate':
      return rateCriterion(
        criterion,
        metrics.approvedFirstTime,
        metrics.reviewedDeliverables,
        criterion.minimumRate,
        criterion.minimumReviews,
        'reviewed tasks passed first time',
      );
    case 'process_compliance_rate':
      return rateCriterion(
        criterion,
        metrics.checklistCompliantTasks,
        metrics.ownedTasksCompleted,
        criterion.minimumRate,
        criterion.minimumTasks,
        'tasks finished with the checklist complete',
      );
    case 'milestones_delivered_on_time':
      return countCriterion(
        criterion,
        metrics.milestonesDeliveredOnTime,
        criterion.minimumCount,
        'milestone(s) delivered on time',
      );
    case 'proactive_blocker_reporting':
      return countCriterion(
        criterion,
        metrics.earlyBlockerReports(criterion.leadDays),
        criterion.minimumCount,
        `blocker(s) raised ${criterion.leadDays}+ days before the due date`,
      );
    case 'collaboration':
      return countCriterion(
        criterion,
        metrics.collaboratorTasksCompleted,
        criterion.minimumTasks,
        'task(s) completed as a collaborator',
      );
    case 'on_time_improvement': {
      const current = rate(metrics.ownedTasksOnTime, metrics.ownedTasksCompleted);
      const previous = metrics.previousOnTimeRate;
      const gain = previous === null ? 0 : Math.round((current - previous) * 100);
      return {
        type: criterion.type,
        label: REWARD_CRITERION_LABELS[criterion.type],
        passed: previous !== null && gain >= criterion.minimumPercentagePoints,
        actual: previous === null ? 'no history' : `${gain >= 0 ? '+' : ''}${gain} pts`,
        required: `+${criterion.minimumPercentagePoints} pts`,
        explanation:
          previous === null
            ? 'There is no earlier period to compare with yet.'
            : `On-time delivery moved from ${percent(previous)} to ${percent(current)}.`,
      };
    }
    default:
      return assertNever(criterion, 'reward criterion');
  }
}

/** Evaluates a policy's criteria against a person's (or team's) metrics. All must pass. */
export function evaluateRewardEligibility(
  criteria: readonly RewardCriterion[],
  metrics: RewardMetrics,
): RewardEligibility {
  const results = criteria.map((criterion) => evaluateCriterion(criterion, metrics));
  const eligible = results.length > 0 && results.every((result) => result.passed);
  const failed = results.filter((result) => !result.passed).map((result) => result.label);
  const summary = eligible
    ? 'Every criterion was met. Waiting for a manager to review.'
    : results.length === 0
      ? 'This policy has no criteria, so nobody can qualify.'
      : `Not eligible yet: ${failed.join(', ')}.`;
  return { eligible, criteria: results, summary };
}
