import type { MilestoneRewardStatus } from './milestone-reward.rules';

/** One person's share of a milestone reward, as the pool totals need it. */
export interface PoolShareFact {
  readonly id: string;
  readonly status: MilestoneRewardStatus;
  readonly shareAmountMinor: number;
  readonly adjustedAmountMinor: number | null;
}

export interface MilestonePoolTotals {
  /** Granted, plus what still waits for a decision at its split amount. */
  readonly committedMinor: number;
  /** Approved shares only, at the amount each person receives. */
  readonly grantedMinor: number;
}

/**
 * What a share takes from the pool: nothing once declined or withdrawn, the
 * amount granted once approved, and its split amount while still open.
 */
export function committedShareMinor(share: PoolShareFact): number {
  if (share.status === 'rejected' || share.status === 'withdrawn') return 0;
  if (share.status === 'approved') return share.adjustedAmountMinor ?? share.shareAmountMinor;
  return share.shareAmountMinor;
}

export function milestonePoolTotals(shares: readonly PoolShareFact[]): MilestonePoolTotals {
  return shares.reduce(
    (totals, share) => ({
      committedMinor: totals.committedMinor + committedShareMinor(share),
      grantedMinor:
        totals.grantedMinor +
        (share.status === 'approved' ? (share.adjustedAmountMinor ?? share.shareAmountMinor) : 0),
    }),
    { committedMinor: 0, grantedMinor: 0 },
  );
}

/** What everyone else on the reward takes from the pool. */
export function otherSharesMinor(shares: readonly PoolShareFact[], shareId: string): number {
  return milestonePoolTotals(shares.filter((share) => share.id !== shareId)).committedMinor;
}

export interface PoolOutcome {
  readonly totalMinor: number;
  /** How far the total runs past the pool; 0 when it fits. */
  readonly overMinor: number;
}

/**
 * The milestone's total when one share is granted `amountMinor`. A reviewer
 * may go past the pool (rewards are a person's decision, never automatic):
 * the overrun is shown before deciding and recorded with the decision.
 */
export function poolOutcomeWith(
  poolMinor: number,
  othersMinor: number,
  amountMinor: number,
): PoolOutcome {
  const totalMinor = othersMinor + amountMinor;
  return { totalMinor, overMinor: Math.max(0, totalMinor - poolMinor) };
}
