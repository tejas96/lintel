import type {
  ChallengeResolution,
  ChallengeTarget,
  NewRewardChallenge,
  RewardChallengeRecord,
  RewardChallengeStore,
} from '../rewards/reward-challenge.store';

type StoredChallenge = RewardChallengeRecord & { resolution: ChallengeResolution | null };

const sameTarget = (left: ChallengeTarget, right: ChallengeTarget) =>
  left.kind === right.kind && left.recordId === right.recordId;

/** Test double for challenges, enforcing one open challenge per record. */
export class InMemoryRewardChallengeStore implements RewardChallengeStore {
  readonly challenges: StoredChallenge[] = [];
  reviewers: string[] = ['owner'];

  async historyOf(target: ChallengeTarget) {
    const mine = this.challenges.filter((challenge) => sameTarget(challenge.target, target));
    return { total: mine.length, open: mine.some((challenge) => challenge.status === 'open') };
  }
  async create(challenge: NewRewardChallenge) {
    if ((await this.historyOf(challenge.target)).open) return null;
    const stored: StoredChallenge = {
      ...challenge,
      id: `challenge-${this.challenges.length + 1}`,
      status: 'open',
      version: 1,
      resolution: null,
    };
    this.challenges.push(stored);
    return stored;
  }
  async find(challengeId: string) {
    return this.challenges.find((challenge) => challenge.id === challengeId) ?? null;
  }
  async resolve(challengeId: string, expectedVersion: number, resolution: ChallengeResolution) {
    const index = this.challenges.findIndex((challenge) => challenge.id === challengeId);
    const current = this.challenges[index];
    if (!current || current.version !== expectedVersion || current.status !== 'open') return false;
    this.challenges[index] = {
      ...current,
      status: resolution.status,
      resolution,
      version: current.version + 1,
    };
    return true;
  }
  async reviewerUserIds() {
    return this.reviewers;
  }
}
