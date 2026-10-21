import type { RewardChallengeStatus, RewardRecordKind } from '@lintel/domain';

/** The reward record a challenge is about. */
export interface ChallengeTarget {
  readonly kind: RewardRecordKind;
  readonly recordId: string;
}

/** A record's outcome at one moment, kept with the challenge as history. */
export interface ChallengeRecordSnapshot {
  readonly status: string;
  readonly grantedAmountMinor: number | null;
  readonly decisionNote: string | null;
}

export interface RewardChallengeRecord {
  readonly id: string;
  readonly target: ChallengeTarget;
  readonly raisedByUserId: string;
  readonly reason: string;
  readonly status: RewardChallengeStatus;
  readonly recordBefore: ChallengeRecordSnapshot;
  readonly version: number;
}

export interface NewRewardChallenge {
  readonly target: ChallengeTarget;
  readonly raisedByUserId: string;
  readonly reason: string;
  readonly recordBefore: ChallengeRecordSnapshot;
}

export interface ChallengeResolution {
  readonly status: 'upheld' | 'corrected';
  readonly resolvedByUserId: string;
  readonly resolvedAt: Date;
  readonly resolutionNote: string;
  readonly recordAfter: ChallengeRecordSnapshot;
}

/** Persistence for challenges of reward records. */
export interface RewardChallengeStore {
  /** How often the record was challenged, and whether one is open now. */
  historyOf(target: ChallengeTarget): Promise<{ total: number; open: boolean }>;
  /** Null when another open challenge of the same record won the race. */
  create(challenge: NewRewardChallenge): Promise<RewardChallengeRecord | null>;
  find(challengeId: string): Promise<RewardChallengeRecord | null>;
  resolve(
    challengeId: string,
    expectedVersion: number,
    resolution: ChallengeResolution,
  ): Promise<boolean>;
  /** Active people holding `rewards.decide`: the reviewers of rewards and challenges. */
  reviewerUserIds(): Promise<string[]>;
}
