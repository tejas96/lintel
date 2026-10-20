import type { RewardPolicy } from '@lintel/api-contracts';
import { buildCriterion, type Criterion, type CriterionDraft } from './criterion-definitions';
import type { PolicyInput } from './use-reward-policies';

export interface PolicyFormValues {
  readonly name: string;
  readonly description: string;
  readonly scope: RewardPolicy['scope'];
  readonly period: RewardPolicy['period'];
  readonly amount: string;
  readonly isActive: boolean;
  readonly drafts: readonly CriterionDraft[];
}

/** Largest amount the API accepts, in minor units. */
const MAX_AMOUNT_MINOR = 100_000_000;

/**
 * Checks the form as a convenience before sending (the server checks again)
 * and builds the request body. Error keys match the API's field paths.
 */
export function readPolicyForm(values: PolicyFormValues): {
  readonly body: PolicyInput | null;
  readonly errors: Readonly<Record<string, string>>;
} {
  const errors: Record<string, string> = {};
  if (!values.name.trim()) errors.name = 'Give the policy a name people will recognise.';
  const cleaned = values.amount.replace(/[,\s₹]/g, '');
  const amountMinor = /^\d+(\.\d{1,2})?$/.test(cleaned) ? Math.round(Number(cleaned) * 100) : null;
  if (amountMinor === null) errors.amountMinor = 'Enter the amount in rupees, like 3000.';
  else if (amountMinor > MAX_AMOUNT_MINOR) errors.amountMinor = 'Use at most ₹10,00,000.';
  if (values.drafts.length === 0) errors.criteria = 'Add at least one criterion.';
  const criteria: Criterion[] = [];
  values.drafts.forEach((draft, index) => {
    const built = buildCriterion(draft);
    if ('criterion' in built) {
      criteria.push(built.criterion);
      return;
    }
    for (const [key, message] of Object.entries(built.errors)) {
      errors[`criteria.${index}.${key}`] = message;
    }
  });
  if (Object.keys(errors).length > 0 || amountMinor === null) return { body: null, errors };
  return {
    body: {
      name: values.name.trim(),
      description: values.description.trim() || null,
      scope: values.scope,
      period: values.period,
      criteria,
      amountMinor,
      isActive: values.isActive,
    },
    errors,
  };
}
