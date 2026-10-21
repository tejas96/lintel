import type {
  ChallengeResolution,
  ChallengeTarget,
  NewRewardChallenge,
  RewardChallengeRecord,
  RewardChallengeStore,
} from '@lintel/application';
import { and, count, eq, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { rewardChallenges, roleCapabilities, users } from '../schema';

type ChallengeRow = typeof rewardChallenges.$inferSelect;

const targetColumn = (target: ChallengeTarget) =>
  target.kind === 'evaluation'
    ? eq(rewardChallenges.evaluationId, target.recordId)
    : eq(rewardChallenges.milestoneRecipientId, target.recordId);

function toRecord(row: ChallengeRow): RewardChallengeRecord {
  const target: ChallengeTarget = row.evaluationId
    ? { kind: 'evaluation', recordId: row.evaluationId }
    : { kind: 'milestone', recordId: row.milestoneRecipientId ?? '' };
  return {
    id: row.id,
    target,
    raisedByUserId: row.raisedByUserId,
    reason: row.reason,
    status: row.status,
    recordBefore: row.recordBefore,
    version: row.version,
  };
}

export class RewardChallengeRepository implements RewardChallengeStore {
  constructor(private readonly db: DatabaseExecutor) {}

  async historyOf(target: ChallengeTarget) {
    const [row] = await this.db
      .select({
        total: count(),
        open: sql<number>`count(*) filter (where ${rewardChallenges.status} = 'open')`.mapWith(
          Number,
        ),
      })
      .from(rewardChallenges)
      .where(targetColumn(target));
    return { total: row?.total ?? 0, open: (row?.open ?? 0) > 0 };
  }

  /** The partial unique indexes allow one open challenge per record; a lost race returns null. */
  async create(challenge: NewRewardChallenge) {
    const [row] = await this.db
      .insert(rewardChallenges)
      .values({
        evaluationId: challenge.target.kind === 'evaluation' ? challenge.target.recordId : null,
        milestoneRecipientId:
          challenge.target.kind === 'milestone' ? challenge.target.recordId : null,
        raisedByUserId: challenge.raisedByUserId,
        reason: challenge.reason,
        recordBefore: { ...challenge.recordBefore },
      })
      .onConflictDoNothing()
      .returning();
    return row ? toRecord(row) : null;
  }

  async find(challengeId: string) {
    const [row] = await this.db
      .select()
      .from(rewardChallenges)
      .where(eq(rewardChallenges.id, challengeId));
    return row ? toRecord(row) : null;
  }

  async resolve(challengeId: string, expectedVersion: number, resolution: ChallengeResolution) {
    const rows = await this.db
      .update(rewardChallenges)
      .set({
        status: resolution.status,
        resolvedByUserId: resolution.resolvedByUserId,
        resolvedAt: resolution.resolvedAt,
        resolutionNote: resolution.resolutionNote,
        recordAfter: { ...resolution.recordAfter },
        version: sql`${rewardChallenges.version} + 1`,
        updatedAt: resolution.resolvedAt,
      })
      .where(
        and(
          eq(rewardChallenges.id, challengeId),
          eq(rewardChallenges.version, expectedVersion),
          eq(rewardChallenges.status, 'open'),
        ),
      )
      .returning({ id: rewardChallenges.id });
    return rows.length > 0;
  }

  async reviewerUserIds() {
    const rows = await this.db
      .select({ id: users.id })
      .from(users)
      .innerJoin(roleCapabilities, eq(roleCapabilities.role, users.role))
      .where(and(eq(roleCapabilities.capability, 'rewards.decide'), eq(users.status, 'active')));
    return rows.map((row) => row.id);
  }
}
