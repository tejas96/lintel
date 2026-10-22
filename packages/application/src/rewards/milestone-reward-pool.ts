import { otherSharesMinor, type PoolOutcome, poolOutcomeWith } from '@lintel/domain';
import type { ApplicationStores } from '../common/unit-of-work';

type PoolStores = Pick<ApplicationStores, 'milestoneRewards'>;

export interface PoolAfterDecision extends PoolOutcome {
  readonly poolMinor: number;
}

/**
 * The milestone's total once one share is granted `amountMinor`. Going past
 * the pool is allowed — a person decides rewards — but it is recorded with
 * the decision, so the audit shows who granted more than was planned.
 */
export async function poolAfterDecision(
  stores: PoolStores,
  share: { readonly id: string; readonly milestoneId: string },
  amountMinor: number,
): Promise<PoolAfterDecision | null> {
  const plan = await stores.milestoneRewards.findPlanByMilestone(share.milestoneId);
  if (!plan) return null;
  const outcome = poolOutcomeWith(
    plan.amountMinor,
    otherSharesMinor(plan.recipients, share.id),
    amountMinor,
  );
  return { poolMinor: plan.amountMinor, ...outcome };
}

/** Audit fields for a decision that takes the milestone past its pool; empty when it fits. */
export async function poolOverrunAudit(
  stores: PoolStores,
  share: { readonly id: string; readonly milestoneId: string },
  amountMinor: number | null,
): Promise<Record<string, number>> {
  if (amountMinor === null) return {};
  const pool = await poolAfterDecision(stores, share, amountMinor);
  if (!pool || pool.overMinor === 0) return {};
  return {
    poolMinor: pool.poolMinor,
    poolTotalMinor: pool.totalMinor,
    poolOverrunMinor: pool.overMinor,
  };
}
