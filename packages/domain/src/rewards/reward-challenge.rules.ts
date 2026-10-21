/** open → upheld (the record stands) or corrected (the reviewer changed it). */
export const REWARD_CHALLENGE_STATUSES = ['open', 'upheld', 'corrected'] as const;
export type RewardChallengeStatus = (typeof REWARD_CHALLENGE_STATUSES)[number];

/** What a challenge is about: a periodic evaluation or one person's milestone reward. */
export const REWARD_RECORD_KINDS = ['evaluation', 'milestone'] as const;
export type RewardRecordKind = (typeof REWARD_RECORD_KINDS)[number];

/** A record can be challenged this many times in total, one open challenge at a time. */
export const MAX_CHALLENGES_PER_RECORD = 3;

/** The largest corrected amount, in minor units (the same ceiling as policies). */
export const MAX_REWARD_AMOUNT_MINOR = 100_000_000;

/** The parts of a reward record the challenge rules look at. */
export interface ChallengeableRecord {
  readonly status: string;
  /** The amount granted (the adjusted one when a reviewer changed it); null unless approved. */
  readonly grantedAmountMinor: number | null;
}

/** Outcomes are known once a record is not eligible, approved or not approved. */
const SETTLED: ReadonlySet<string> = new Set(['ineligible', 'approved', 'rejected']);

/**
 * Why this person cannot challenge the record now, or null when they can.
 * Only the person the record is about (or a member of the team it is about)
 * may challenge, once the outcome is known, one challenge at a time.
 */
export function challengeRefusal(input: {
  readonly record: ChallengeableRecord;
  readonly isSubject: boolean;
  readonly hasOpenChallenge: boolean;
  readonly challengesSoFar: number;
}): string | null {
  if (!input.isSubject) return 'Only the person this record is about can challenge it.';
  if (!SETTLED.has(input.record.status)) {
    return 'You can challenge this once the outcome is known.';
  }
  if (input.hasOpenChallenge)
    return 'A challenge of this record is already waiting for a reviewer.';
  if (input.challengesSoFar >= MAX_CHALLENGES_PER_RECORD) {
    return `This record has been challenged ${MAX_CHALLENGES_PER_RECORD} times already.`;
  }
  return null;
}

/**
 * Why a correction is not allowed, or null when it is. A correction grants
 * the reward, or raises an amount already granted. A challenge never lowers
 * a reward and never takes one away.
 */
export function correctionProblem(
  record: ChallengeableRecord,
  correctedAmountMinor: number,
): string | null {
  if (!Number.isInteger(correctedAmountMinor) || correctedAmountMinor < 0) {
    return 'Enter the corrected amount as a whole, non-negative amount.';
  }
  if (correctedAmountMinor > MAX_REWARD_AMOUNT_MINOR) return 'That amount is too large.';
  if (!SETTLED.has(record.status)) return 'This record is no longer settled; refresh it first.';
  if (record.status === 'approved' && record.grantedAmountMinor !== null) {
    if (correctedAmountMinor <= record.grantedAmountMinor) {
      return 'A correction can only raise an approved reward. To keep it, uphold the record.';
    }
  }
  return null;
}
