import type { RewardEvaluationStatus } from '@lintel/domain';
import { and, asc, count, desc, eq, or } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { rewardEvaluations, rewardPolicies, teams, users } from '../../schema';
import { loadUserSummaries, pickUser } from '../shared/user-summary.query';

/** Policies people can see; managers of rewards also see inactive ones. */
export async function listRewardPolicies(db: DatabaseExecutor, includeInactive: boolean) {
  const rows = await db
    .select()
    .from(rewardPolicies)
    .where(includeInactive ? undefined : eq(rewardPolicies.isActive, true))
    .orderBy(desc(rewardPolicies.isActive), asc(rewardPolicies.name));
  return rows.map(toPolicyView);
}

export function toPolicyView(row: {
  id: string;
  name: string;
  description: string | null;
  scope: 'individual' | 'team';
  period: 'monthly' | 'quarterly';
  criteria: (typeof rewardPolicies.$inferSelect)['criteria'];
  amountMinor: number;
  currency: string;
  isActive: boolean;
  version: number;
}) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    scope: row.scope,
    period: row.period,
    criteria: [...row.criteria],
    amountMinor: row.amountMinor,
    currency: row.currency,
    isActive: row.isActive,
    version: row.version,
  };
}

export interface RewardEvaluationQuery {
  readonly viewerUserId: string;
  /** `rewards.view_all`: every evaluation and every amount. */
  readonly canViewAll: boolean;
  readonly scope: 'mine' | 'all';
  readonly status?: RewardEvaluationStatus | undefined;
  readonly evaluationId?: string | undefined;
  readonly page: number;
  readonly pageSize: number;
}

/**
 * Evaluations with the evidence behind them. "mine" covers my own and my
 * team's evaluations. Amounts are visible only to the subject and to people
 * holding `rewards.view_all`.
 */
export async function queryRewardEvaluations(db: DatabaseExecutor, query: RewardEvaluationQuery) {
  const [viewer] = await db
    .select({ teamId: users.teamId })
    .from(users)
    .where(eq(users.id, query.viewerUserId));
  const viewerTeamId = viewer?.teamId ?? null;
  const mine = or(
    eq(rewardEvaluations.userId, query.viewerUserId),
    viewerTeamId ? eq(rewardEvaluations.teamId, viewerTeamId) : undefined,
  );
  const where = and(
    query.scope === 'mine' ? mine : undefined,
    query.status ? eq(rewardEvaluations.status, query.status) : undefined,
    query.evaluationId ? eq(rewardEvaluations.id, query.evaluationId) : undefined,
  );
  const [totals] = await db.select({ total: count() }).from(rewardEvaluations).where(where);
  const rows = await db
    .select({
      evaluation: rewardEvaluations,
      policy: {
        id: rewardPolicies.id,
        name: rewardPolicies.name,
        scope: rewardPolicies.scope,
        currency: rewardPolicies.currency,
      },
      team: { id: teams.id, name: teams.name },
    })
    .from(rewardEvaluations)
    .innerJoin(rewardPolicies, eq(rewardPolicies.id, rewardEvaluations.policyId))
    .leftJoin(teams, eq(teams.id, rewardEvaluations.teamId))
    .where(where)
    .orderBy(desc(rewardEvaluations.periodStart), asc(rewardEvaluations.createdAt))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);
  const people = await loadUserSummaries(
    db,
    rows.flatMap((row) => [row.evaluation.userId, row.evaluation.decidedByUserId]),
  );
  const items = rows.map(({ evaluation, policy, team }) => {
    const isSubject =
      evaluation.userId === query.viewerUserId ||
      (evaluation.teamId !== null && evaluation.teamId === viewerTeamId);
    const showAmounts = query.canViewAll || isSubject;
    return {
      id: evaluation.id,
      policy: { id: policy.id, name: policy.name, scope: policy.scope },
      user: pickUser(people, evaluation.userId),
      team: team?.id ? { id: team.id, name: team.name } : null,
      periodStart: evaluation.periodStart,
      periodEnd: evaluation.periodEnd,
      status: evaluation.status,
      summary: evaluation.summary,
      criteria: evaluation.evidence.criteria.map((criterion) => ({ ...criterion })),
      amountMinor: showAmounts ? evaluation.amountMinor : null,
      adjustedAmountMinor: showAmounts ? evaluation.adjustedAmountMinor : null,
      adjustmentReason: showAmounts ? evaluation.adjustmentReason : null,
      currency: policy.currency,
      decidedBy: pickUser(people, evaluation.decidedByUserId),
      decidedAt: evaluation.decidedAt?.toISOString() ?? null,
      decisionNote: evaluation.decisionNote,
      createdAt: evaluation.createdAt.toISOString(),
      version: evaluation.version,
    };
  });
  return { items, totalItems: totals?.total ?? 0 };
}
