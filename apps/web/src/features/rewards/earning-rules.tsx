'use client';

import type { RewardPolicy } from '@lintel/api-contracts';
import { Badge, listItemEnter } from '@lintel/design-system/web';
import { REWARD_CRITERION_EXPLANATIONS, REWARD_CRITERION_LABELS } from '@lintel/domain';
import { motion } from 'motion/react';
import { describeCriterion } from './criterion-definitions';
import { formatAmount } from './reward-presentation';

/**
 * A policy read aloud for the people it may reward: how often, for whom,
 * how much, and every criterion with how it is measured. Every one must be
 * met in the same month or quarter.
 */
function PolicyRules({ policy, index }: { readonly policy: RewardPolicy; readonly index: number }) {
  return (
    <motion.li
      {...listItemEnter(index)}
      className="flex flex-col gap-4 rounded-lg border border-hairline bg-raised p-5 sm:p-6"
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <h3 className="type-title-lg text-ink">{policy.name}</h3>
          {policy.description && (
            <p className="max-w-prose type-body-sm text-ink-muted">{policy.description}</p>
          )}
          <p className="flex flex-wrap gap-1.5">
            <Badge>{policy.scope === 'team' ? 'For each team' : 'For each person'}</Badge>
            <Badge>{policy.period === 'monthly' ? 'Every month' : 'Every quarter'}</Badge>
          </p>
        </div>
        <p className="font-display text-[1.5rem] leading-8 text-ink tabular-nums">
          {formatAmount(policy.amountMinor, policy.currency)}
        </p>
      </header>
      <ol className="grid gap-3 sm:grid-cols-2">
        {policy.criteria.map((criterion) => (
          <li key={criterion.type} className="flex flex-col gap-1 border-l-2 border-rule pl-3">
            <span className="type-body-sm font-medium text-ink">
              {REWARD_CRITERION_LABELS[criterion.type]}
            </span>
            <span className="type-body-sm text-ink">{describeCriterion(criterion)}.</span>
            <span className="type-body-sm text-ink-faint">
              {REWARD_CRITERION_EXPLANATIONS[criterion.type]}
            </span>
          </li>
        ))}
      </ol>
    </motion.li>
  );
}

/** The studio's active policies, as the rules that can earn the person a reward. */
export function EarningPolicies({ policies }: { readonly policies: readonly RewardPolicy[] }) {
  const active = policies.filter((policy) => policy.isActive);
  if (active.length === 0) return null;
  return (
    <ul className="flex flex-col gap-4">
      {active.map((policy, index) => (
        <PolicyRules key={policy.id} policy={policy} index={index} />
      ))}
    </ul>
  );
}
