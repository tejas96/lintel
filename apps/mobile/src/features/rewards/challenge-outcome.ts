import type { ChallengeEntry } from '@lintel/api-contracts';
import { formatAmount } from '@/formatting/money';
import { isRewardRecordStatus, rewardStatusPresentation } from '@/theme/status-vocabulary';

type Snapshot = ChallengeEntry['before'];

/** A record's outcome at one moment: "Approved, ₹2,000" or "Not approved". */
export function snapshotWords(snapshot: Snapshot, currency: string): string {
  const status = isRewardRecordStatus(snapshot.status)
    ? rewardStatusPresentation(snapshot.status).label
    : snapshot.status.replaceAll('_', ' ');
  return snapshot.grantedAmountMinor === null
    ? status
    : `${status}, ${formatAmount(snapshot.grantedAmountMinor, currency)}`;
}

/**
 * What the challenge changed, once a reviewer answered: "Not approved → Approved,
 * ₹3,000", or "Unchanged: Approved, ₹2,000" when the record stood.
 */
export function challengeOutcome(challenge: ChallengeEntry, currency: string): string | null {
  if (!challenge.after) return null;
  const before = snapshotWords(challenge.before, currency);
  const after = snapshotWords(challenge.after, currency);
  return before === after ? `Unchanged: ${after}` : `${before} → ${after}`;
}
