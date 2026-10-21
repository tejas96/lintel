import type { RewardPolicy } from '@lintel/api-contracts';
import {
  describeRewardCriterion,
  REWARD_CRITERION_LABELS,
  type RewardCriterionType,
} from '@lintel/domain';

export type Criterion = RewardPolicy['criteria'][number];

/** A rate is edited as a whole percentage; a count as a whole number. */
export interface CriterionField {
  readonly key: string;
  readonly label: string;
  readonly kind: 'rate' | 'count';
}

interface CriterionDefinition {
  readonly label: string;
  /** What the criterion rewards, in one plain sentence. */
  readonly explanation: string;
  readonly fields: readonly CriterionField[];
  readonly defaults: Readonly<Record<string, number>>;
}

const minimumTasks: CriterionField = {
  key: 'minimumTasks',
  label: 'Out of at least (tasks)',
  kind: 'count',
};

export const CRITERIA: Readonly<Record<RewardCriterionType, CriterionDefinition>> = {
  on_time_delivery_rate: {
    label: REWARD_CRITERION_LABELS.on_time_delivery_rate,
    explanation: 'Finished tasks delivered by their latest approved due date.',
    fields: [{ key: 'minimumRate', label: 'On time at least (%)', kind: 'rate' }, minimumTasks],
    defaults: { minimumRate: 0.85, minimumTasks: 3 },
  },
  first_pass_approval_rate: {
    label: REWARD_CRITERION_LABELS.first_pass_approval_rate,
    explanation: 'Reviewed work approved the first time it was sent.',
    fields: [
      { key: 'minimumRate', label: 'Approved first time at least (%)', kind: 'rate' },
      { key: 'minimumReviews', label: 'Out of at least (reviews)', kind: 'count' },
    ],
    defaults: { minimumRate: 0.6, minimumReviews: 1 },
  },
  milestones_delivered_on_time: {
    label: REWARD_CRITERION_LABELS.milestones_delivered_on_time,
    explanation: 'Milestones the person or team completed by their due date.',
    fields: [{ key: 'minimumCount', label: 'At least (milestones)', kind: 'count' }],
    defaults: { minimumCount: 1 },
  },
  proactive_blocker_reporting: {
    label: REWARD_CRITERION_LABELS.proactive_blocker_reporting,
    explanation: 'Problems reported early enough for someone to act.',
    fields: [
      { key: 'minimumCount', label: 'At least (blockers raised)', kind: 'count' },
      { key: 'leadDays', label: 'Days before the due date', kind: 'count' },
    ],
    defaults: { minimumCount: 1, leadDays: 2 },
  },
  collaboration: {
    label: REWARD_CRITERION_LABELS.collaboration,
    explanation: 'Tasks owned by someone else that the person helped finish.',
    fields: [{ key: 'minimumTasks', label: 'At least (tasks helped)', kind: 'count' }],
    defaults: { minimumTasks: 2 },
  },
  process_compliance_rate: {
    label: REWARD_CRITERION_LABELS.process_compliance_rate,
    explanation: 'Tasks finished with every required checklist item done.',
    fields: [
      { key: 'minimumRate', label: 'Checklist complete at least (%)', kind: 'rate' },
      minimumTasks,
    ],
    defaults: { minimumRate: 0.8, minimumTasks: 3 },
  },
  on_time_improvement: {
    label: REWARD_CRITERION_LABELS.on_time_improvement,
    explanation: 'On-time delivery better than in the previous period.',
    fields: [
      { key: 'minimumPercentagePoints', label: 'Better by at least (points)', kind: 'count' },
    ],
    defaults: { minimumPercentagePoints: 5 },
  },
};

export const CRITERION_TYPES = Object.keys(CRITERIA) as RewardCriterionType[];

/** Editable form of a criterion: its type and every number as typed. */
export interface CriterionDraft {
  readonly type: RewardCriterionType;
  readonly values: Readonly<Record<string, string>>;
}

const asText = (field: CriterionField, value: number) =>
  field.kind === 'rate' ? String(Math.round(value * 100)) : String(value);

export function draftOf(criterion: Criterion): CriterionDraft {
  const values: Record<string, string> = {};
  const numbers: Readonly<Record<string, unknown>> = criterion;
  for (const field of CRITERIA[criterion.type].fields) {
    const value = numbers[field.key];
    values[field.key] = typeof value === 'number' ? asText(field, value) : '';
  }
  return { type: criterion.type, values };
}

export function newDraft(type: RewardCriterionType): CriterionDraft {
  const definition = CRITERIA[type];
  const values: Record<string, string> = {};
  for (const field of definition.fields) {
    values[field.key] = asText(field, definition.defaults[field.key] ?? 0);
  }
  return { type, values };
}

/** A whole number in range, or the message to show next to the field. */
export function readField(field: CriterionField, text: string): number | string {
  const value = Number(text);
  if (text.trim() === '' || !Number.isInteger(value)) return 'Enter a whole number.';
  const max = field.kind === 'rate' ? 100 : 1000;
  if (value < 0 || value > max) return `Use 0 to ${max}.`;
  return field.kind === 'rate' ? value / 100 : value;
}

export type BuiltCriterion =
  | { readonly criterion: Criterion }
  | { readonly errors: Readonly<Record<string, string>> };

/** Turns a draft into the criterion the API expects, or says which numbers need fixing. */
export function buildCriterion(draft: CriterionDraft): BuiltCriterion {
  const numbers: Record<string, number> = {};
  const errors: Record<string, string> = {};
  for (const field of CRITERIA[draft.type].fields) {
    const result = readField(field, draft.values[field.key] ?? '');
    if (typeof result === 'string') errors[field.key] = result;
    else numbers[field.key] = result;
  }
  if (Object.keys(errors).length > 0) return { errors };
  const value = (key: string) => numbers[key] ?? 0;
  switch (draft.type) {
    case 'on_time_delivery_rate':
    case 'process_compliance_rate':
      return {
        criterion: {
          type: draft.type,
          minimumRate: value('minimumRate'),
          minimumTasks: value('minimumTasks'),
        },
      };
    case 'first_pass_approval_rate':
      return {
        criterion: {
          type: draft.type,
          minimumRate: value('minimumRate'),
          minimumReviews: value('minimumReviews'),
        },
      };
    case 'milestones_delivered_on_time':
      return { criterion: { type: draft.type, minimumCount: value('minimumCount') } };
    case 'proactive_blocker_reporting':
      return {
        criterion: {
          type: draft.type,
          minimumCount: value('minimumCount'),
          leadDays: value('leadDays'),
        },
      };
    case 'collaboration':
      return { criterion: { type: draft.type, minimumTasks: value('minimumTasks') } };
    case 'on_time_improvement':
      return {
        criterion: { type: draft.type, minimumPercentagePoints: value('minimumPercentagePoints') },
      };
  }
}

/** One plain sentence for a criterion, e.g. "At least 85% of tasks on time, out of 3 or more". */
export function describeCriterion(criterion: Criterion): string {
  return describeRewardCriterion(criterion);
}
