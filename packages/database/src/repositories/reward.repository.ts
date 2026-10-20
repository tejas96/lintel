import type {
  RewardDecision,
  RewardEvaluationUpsert,
  RewardPolicyInput,
  RewardPolicyRecord,
  RewardStore,
  RewardUpsertOutcome,
} from '@lintel/application';
import { and, asc, eq, ne, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { rewardEvaluations, rewardPolicies, teams, users } from '../schema';
import {
  loadBlockerReports,
  loadCompletedMilestones,
  loadCompletedTasks,
} from './reward-facts.queries';

function toPolicy(row: typeof rewardPolicies.$inferSelect): RewardPolicyRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    scope: row.scope,
    period: row.period,
    criteria: row.criteria,
    amountMinor: row.amountMinor,
    currency: row.currency,
    isActive: row.isActive,
    version: row.version,
  };
}

export class RewardRepository implements RewardStore {
  constructor(private readonly db: DatabaseExecutor) {}

  async findPolicy(policyId: string) {
    const [row] = await this.db
      .select()
      .from(rewardPolicies)
      .where(eq(rewardPolicies.id, policyId));
    return row ? toPolicy(row) : null;
  }

  async createPolicy(input: RewardPolicyInput, currency: string, createdByUserId: string) {
    const [row] = await this.db
      .insert(rewardPolicies)
      .values({ ...input, criteria: [...input.criteria], currency, createdByUserId })
      .returning();
    if (!row) throw new Error('Creating the reward policy returned no row.');
    return toPolicy(row);
  }

  async updatePolicy(policyId: string, expectedVersion: number, input: RewardPolicyInput) {
    const [row] = await this.db
      .update(rewardPolicies)
      .set({
        ...input,
        criteria: [...input.criteria],
        version: sql`${rewardPolicies.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(rewardPolicies.id, policyId), eq(rewardPolicies.version, expectedVersion)))
      .returning();
    return row ? toPolicy(row) : null;
  }

  async individualSubjects() {
    const rows = await this.db
      .select({ userId: users.id, teamId: users.teamId })
      .from(users)
      .where(and(eq(users.status, 'active'), ne(users.role, 'owner')))
      .orderBy(asc(users.fullName));
    return rows;
  }

  async teamSubjects() {
    const teamRows = await this.db.select({ id: teams.id }).from(teams).orderBy(asc(teams.name));
    const memberRows = await this.db
      .select({ id: users.id, teamId: users.teamId })
      .from(users)
      .where(eq(users.status, 'active'));
    return teamRows.map((team) => ({
      teamId: team.id,
      memberUserIds: memberRows.filter((row) => row.teamId === team.id).map((row) => row.id),
    }));
  }

  completedTasks(userIds: readonly string[], from: Date, to: Date) {
    return loadCompletedTasks(this.db, userIds, from, to);
  }

  blockerReports(userIds: readonly string[], from: Date, to: Date) {
    return loadBlockerReports(this.db, userIds, from, to);
  }

  completedMilestones(from: Date, to: Date) {
    return loadCompletedMilestones(this.db, from, to);
  }

  /**
   * One row per (policy, subject, period) thanks to the unique index. The
   * conflict update only applies while the evaluation is undecided, so a
   * decided evaluation (and its reward) is never changed or duplicated.
   */
  async upsertEvaluation(input: RewardEvaluationUpsert): Promise<RewardUpsertOutcome> {
    const values = { ...input, evidence: { ...input.evidence } };
    const rows = await this.db
      .insert(rewardEvaluations)
      .values(values)
      .onConflictDoUpdate({
        target: [
          rewardEvaluations.policyId,
          rewardEvaluations.subjectKey,
          rewardEvaluations.periodStart,
        ],
        set: {
          periodEnd: input.periodEnd,
          status: input.status,
          summary: input.summary,
          evidence: values.evidence,
          amountMinor: input.amountMinor,
          version: sql`${rewardEvaluations.version} + 1`,
          updatedAt: new Date(),
        },
        setWhere: sql`${rewardEvaluations.decidedAt} is null`,
      })
      .returning({ id: rewardEvaluations.id, inserted: sql<boolean>`(xmax = 0)` });
    const [row] = rows;
    if (!row) return 'decided';
    return row.inserted ? 'created' : 'refreshed';
  }

  async findEvaluation(evaluationId: string) {
    const [row] = await this.db
      .select({
        id: rewardEvaluations.id,
        policyId: rewardEvaluations.policyId,
        policyName: rewardPolicies.name,
        userId: rewardEvaluations.userId,
        teamId: rewardEvaluations.teamId,
        periodStart: rewardEvaluations.periodStart,
        status: rewardEvaluations.status,
        amountMinor: rewardEvaluations.amountMinor,
        version: rewardEvaluations.version,
      })
      .from(rewardEvaluations)
      .innerJoin(rewardPolicies, eq(rewardPolicies.id, rewardEvaluations.policyId))
      .where(eq(rewardEvaluations.id, evaluationId));
    return row ?? null;
  }

  async decideEvaluation(evaluationId: string, expectedVersion: number, decision: RewardDecision) {
    const rows = await this.db
      .update(rewardEvaluations)
      .set({ ...decision, version: sql`${rewardEvaluations.version} + 1`, updatedAt: new Date() })
      .where(
        and(
          eq(rewardEvaluations.id, evaluationId),
          eq(rewardEvaluations.version, expectedVersion),
          eq(rewardEvaluations.status, 'pending_review'),
        ),
      )
      .returning({ id: rewardEvaluations.id });
    return rows.length > 0;
  }

  async teamMemberIds(teamId: string) {
    const rows = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.teamId, teamId), eq(users.status, 'active')));
    return rows.map((row) => row.id);
  }
}
