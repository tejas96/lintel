import type { ApplicationStores } from '../common/unit-of-work';
import type { RewardDecision } from './reward.store';
import type { ChallengeRecordSnapshot, ChallengeTarget } from './reward-challenge.store';

type RecordStores = Pick<ApplicationStores, 'rewards' | 'milestoneRewards'>;

/** A periodic evaluation or a milestone share, as the challenge rules see it. */
export interface ChallengeableRecordView {
  readonly target: ChallengeTarget;
  /** "Monthly on-time delivery, period from 2026-10-01" or "Milestone: Concept approved". */
  readonly title: string;
  /** The people the record is about: the person, or every active member of the team. */
  readonly subjectUserIds: readonly string[];
  readonly decidedByUserId: string | null;
  readonly snapshot: ChallengeRecordSnapshot;
  readonly version: number;
}

/** The record behind a challenge target, or null when it does not exist. */
export async function loadChallengeable(
  stores: RecordStores,
  target: ChallengeTarget,
): Promise<ChallengeableRecordView | null> {
  if (target.kind === 'evaluation') {
    const evaluation = await stores.rewards.findEvaluation(target.recordId);
    if (!evaluation) return null;
    const subjects = evaluation.userId
      ? [evaluation.userId]
      : evaluation.teamId
        ? await stores.rewards.teamMemberIds(evaluation.teamId)
        : [];
    return {
      target,
      title: `${evaluation.policyName}, period from ${evaluation.periodStart}`,
      subjectUserIds: subjects,
      decidedByUserId: evaluation.decidedByUserId,
      snapshot: {
        status: evaluation.status,
        grantedAmountMinor:
          evaluation.status === 'approved'
            ? (evaluation.adjustedAmountMinor ?? evaluation.amountMinor)
            : null,
        decisionNote: evaluation.decisionNote,
      },
      version: evaluation.version,
    };
  }
  const share = await stores.milestoneRewards.findShare(target.recordId);
  if (!share) return null;
  return {
    target,
    title: `Milestone reward: ${share.milestoneName}`,
    subjectUserIds: [share.userId],
    decidedByUserId: share.decidedByUserId,
    snapshot: {
      status: share.status,
      grantedAmountMinor:
        share.status === 'approved' ? (share.adjustedAmountMinor ?? share.shareAmountMinor) : null,
      decisionNote: share.decisionNote,
    },
    version: share.version,
  };
}

/**
 * Grants the record (or raises its amount) as a challenge correction, when
 * its version still matches. The corrected amount is stored as the adjusted
 * amount, so the original stays on record next to it.
 */
export async function applyCorrection(
  stores: RecordStores,
  record: ChallengeableRecordView,
  decision: RewardDecision,
): Promise<boolean> {
  if (record.target.kind === 'evaluation') {
    return stores.rewards.correctEvaluation(record.target.recordId, record.version, decision);
  }
  const status = record.snapshot.status === 'approved' ? 'approved' : 'rejected';
  return stores.milestoneRewards.decideShare(
    record.target.recordId,
    record.version,
    status,
    decision,
  );
}
