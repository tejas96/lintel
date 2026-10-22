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

/** How a rate criterion talks about its measure and about the sample behind it. */
interface RateWords {
  /** "owned tasks were on time", after "4 of 5". */
  readonly measure: string;
  /** What the sample counts: one, many, and the sentence opening when there is none. */
  readonly one: string;
  readonly many: string;
  readonly none: string;
}

const FINISHED_TASKS = {
  one: 'owned task was finished',
  many: 'owned tasks were finished',
  none: 'No finished tasks yet',
} as const;

const REVIEWED_DELIVERABLES = {
  one: 'deliverable was reviewed',
  many: 'deliverables were reviewed',
  none: 'No reviewed deliverables yet',
} as const;

/** "Only 1 owned task was finished in this period; …" or "No finished tasks yet in this period; …". */
function tooLittleDataWords(
  sample: number,
  minimumSample: number,
  words: Omit<RateWords, 'measure'>,
): string {
  const opening =
    sample === 0 ? words.none : `Only ${sample} ${sample === 1 ? words.one : words.many}`;
  return `${opening} in this period; at least ${minimumSample} are needed to judge fairly.`;
}

/** "1 milestone delivered on time" / "2 milestones delivered on time". */
const counted = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

function rateCriterion(
  criterion: RewardCriterion,
  part: number,
  whole: number,
  minimumRate: number,
  minimumSample: number,
  words: RateWords,
): CriterionResult {
  const label = REWARD_CRITERION_LABELS[criterion.type];
  const actualRate = rate(part, whole);
  const enoughData = whole >= minimumSample;
  const passed = enoughData && actualRate >= minimumRate;
  const explanation = enoughData
    ? `${part} of ${whole} ${words.measure} (${percent(actualRate)}); needs ${percent(minimumRate)}.`
    : tooLittleDataWords(whole, minimumSample, words);
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
  noun: { readonly one: string; readonly many: string },
): CriterionResult {
  return {
    type: criterion.type,
    label: REWARD_CRITERION_LABELS[criterion.type],
    passed: actual >= minimum,
    actual: String(actual),
    required: `≥ ${minimum}`,
    explanation: `${counted(actual, noun.one, noun.many)}; needs at least ${minimum}.`,
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
        { measure: 'owned tasks were on time', ...FINISHED_TASKS },
      );
    case 'first_pass_approval_rate':
      return rateCriterion(
        criterion,
        metrics.approvedFirstTime,
        metrics.reviewedDeliverables,
        criterion.minimumRate,
        criterion.minimumReviews,
        { measure: 'reviewed tasks passed first time', ...REVIEWED_DELIVERABLES },
      );
    case 'process_compliance_rate':
      return rateCriterion(
        criterion,
        metrics.checklistCompliantTasks,
        metrics.ownedTasksCompleted,
        criterion.minimumRate,
        criterion.minimumTasks,
        { measure: 'tasks finished with the checklist complete', ...FINISHED_TASKS },
      );
    case 'milestones_delivered_on_time':
      return countCriterion(criterion, metrics.milestonesDeliveredOnTime, criterion.minimumCount, {
        one: 'milestone delivered on time',
        many: 'milestones delivered on time',
      });
    case 'proactive_blocker_reporting':
      return countCriterion(
        criterion,
        metrics.earlyBlockerReports(criterion.leadDays),
        criterion.minimumCount,
        {
          one: `blocker raised ${criterion.leadDays}+ days before the due date`,
          many: `blockers raised ${criterion.leadDays}+ days before the due date`,
        },
      );
    case 'collaboration':
      return countCriterion(criterion, metrics.collaboratorTasksCompleted, criterion.minimumTasks, {
        one: 'task completed as a collaborator',
        many: 'tasks completed as a collaborator',
      });
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
