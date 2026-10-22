'use client';

import { StatusGlyph } from '@lintel/design-system/web';
import { poolOutcomeWith } from '@lintel/domain';
import { formatAmount } from './reward-presentation';

export interface RewardPool {
  /** The amount planned for the milestone. */
  readonly amountMinor: number;
  /** What the other people on the reward take from it. */
  readonly othersMinor: number;
}

interface PoolOverrunNoteProps {
  readonly pool: RewardPool | null;
  /** The amount this decision grants, or null while it isn't an amount yet. */
  readonly amountMinor: number | null;
  readonly currency: string;
}

/**
 * Warns, while deciding, when the amount takes the milestone past its pool:
 * "Total for this milestone becomes ₹3,000, ₹1,000 over the ₹2,000 pool."
 * It never blocks — a person decides rewards — and the overrun is recorded.
 * The live region stays mounted so screen readers hear the warning appear.
 */
export function PoolOverrunNote({ pool, amountMinor, currency }: PoolOverrunNoteProps) {
  const outcome =
    pool && amountMinor !== null
      ? poolOutcomeWith(pool.amountMinor, pool.othersMinor, amountMinor)
      : null;
  const money = (minor: number) => formatAmount(minor, currency);
  return (
    <div role="status" aria-live="polite">
      {pool && outcome && outcome.overMinor > 0 && (
        <p className="flex items-start gap-2 rounded-md border border-at-risk-solid/40 bg-at-risk-tint/60 px-3 py-2 type-body-sm text-ink">
          <StatusGlyph name="atRisk" className="mt-0.5 size-3.5 shrink-0 text-at-risk" />
          <span>
            Total for this milestone becomes {money(outcome.totalMinor)}, {money(outcome.overMinor)}{' '}
            over the {money(pool.amountMinor)} pool. You can still go ahead; the overrun is recorded
            with your decision.
          </span>
        </p>
      )}
    </div>
  );
}
