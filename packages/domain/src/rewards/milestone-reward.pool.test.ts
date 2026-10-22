import { describe, expect, it } from 'vitest';
import {
  committedShareMinor,
  milestonePoolTotals,
  otherSharesMinor,
  type PoolShareFact,
  poolOutcomeWith,
} from './milestone-reward.pool';

const share = (overrides: Partial<PoolShareFact>): PoolShareFact => ({
  id: 's',
  status: 'pending_review',
  shareAmountMinor: 100_000,
  adjustedAmountMinor: null,
  ...overrides,
});

describe('milestone reward pool', () => {
  it('counts granted amounts, open shares at their split, and nothing for declined ones', () => {
    expect(committedShareMinor(share({ status: 'rejected' }))).toBe(0);
    expect(committedShareMinor(share({ status: 'withdrawn' }))).toBe(0);
    expect(committedShareMinor(share({ status: 'approved', adjustedAmountMinor: 150_000 }))).toBe(
      150_000,
    );
    expect(committedShareMinor(share({ status: 'planned' }))).toBe(100_000);
  });

  it('reports a ₹2,000 pool granted ₹1,500 + ₹1,500 as ₹1,000 over', () => {
    const shares = [
      share({ id: 'imran', status: 'approved' }),
      share({ id: 'priya', status: 'approved', adjustedAmountMinor: 150_000 }),
    ];
    expect(milestonePoolTotals(shares)).toEqual({ committedMinor: 250_000, grantedMinor: 250_000 });
    const others = otherSharesMinor(shares, 'imran');
    expect(others).toBe(150_000);
    expect(poolOutcomeWith(200_000, others, 150_000)).toEqual({
      totalMinor: 300_000,
      overMinor: 100_000,
    });
    expect(poolOutcomeWith(200_000, others, 50_000)).toEqual({ totalMinor: 200_000, overMinor: 0 });
  });

  it('keeps shares still waiting in the committed total but not in the granted one', () => {
    const totals = milestonePoolTotals([
      share({ id: 'a', status: 'approved', adjustedAmountMinor: 150_000 }),
      share({ id: 'b' }),
    ]);
    expect(totals).toEqual({ committedMinor: 250_000, grantedMinor: 150_000 });
  });
});
