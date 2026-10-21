import { and, count, desc, eq, inArray } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import {
  milestoneRewardRecipients,
  milestoneRewards,
  milestones,
  projects,
  rewardChallenges,
  rewardEvaluations,
  rewardPolicies,
  teams,
  users,
} from '../../schema';
import { loadUserSummaries } from '../shared/user-summary.query';
import { challengeEntryView } from './challenge-entries.query';
import { rewardPeriodWords } from './reward-record-words';

export interface RewardChallengeQuery {
  readonly viewerUserId: string;
  readonly canViewAll: boolean;
  /** mine = raised by the viewer; review = every challenge (for `rewards.decide`). */
  readonly scope: 'mine' | 'review';
  readonly status?: 'open' | 'resolved' | undefined;
  readonly challengeId?: string | undefined;
  readonly page: number;
  readonly pageSize: number;
}

interface RecordSummary {
  readonly kind: 'evaluation' | 'milestone';
  readonly id: string;
  readonly title: string;
  readonly subjectName: string;
  /** The people the record is about (amounts are theirs to see). */
  readonly subjectUserIds: readonly string[];
  readonly status: string;
  readonly summary: string | null;
  readonly criteria: {
    type: string;
    label: string;
    passed: boolean;
    actual: string;
    required: string;
    explanation: string;
  }[];
  readonly proposedAmountMinor: number;
  readonly currency: string;
}

async function evaluationSummaries(db: DatabaseExecutor, ids: readonly string[]) {
  if (ids.length === 0) return [];
  const rows = await db
    .select({
      evaluation: rewardEvaluations,
      policy: rewardPolicies,
      person: users.fullName,
      team: teams.name,
    })
    .from(rewardEvaluations)
    .innerJoin(rewardPolicies, eq(rewardPolicies.id, rewardEvaluations.policyId))
    .leftJoin(users, eq(users.id, rewardEvaluations.userId))
    .leftJoin(teams, eq(teams.id, rewardEvaluations.teamId))
    .where(inArray(rewardEvaluations.id, [...ids]));
  const teamIds = rows.flatMap((row) => (row.evaluation.teamId ? [row.evaluation.teamId] : []));
  const members =
    teamIds.length === 0
      ? []
      : await db
          .select({ id: users.id, teamId: users.teamId })
          .from(users)
          .where(inArray(users.teamId, teamIds));
  return rows.map(
    ({ evaluation, policy, person, team }): RecordSummary => ({
      kind: 'evaluation',
      id: evaluation.id,
      title: `${policy.name} · ${rewardPeriodWords(evaluation.periodStart, evaluation.periodEnd)}`,
      subjectName: person ?? team ?? 'Unknown',
      subjectUserIds: evaluation.userId
        ? [evaluation.userId]
        : members.filter((m) => m.teamId === evaluation.teamId).map((m) => m.id),
      status: evaluation.status,
      summary: evaluation.summary,
      criteria: evaluation.evidence.criteria.map((criterion) => ({ ...criterion })),
      proposedAmountMinor: evaluation.amountMinor,
      currency: policy.currency,
    }),
  );
}

async function milestoneSummaries(db: DatabaseExecutor, ids: readonly string[]) {
  if (ids.length === 0) return [];
  const rows = await db
    .select({
      share: milestoneRewardRecipients,
      plan: milestoneRewards,
      milestone: milestones.name,
      reference: projects.reference,
      person: users.fullName,
    })
    .from(milestoneRewardRecipients)
    .innerJoin(
      milestoneRewards,
      eq(milestoneRewards.id, milestoneRewardRecipients.milestoneRewardId),
    )
    .innerJoin(milestones, eq(milestones.id, milestoneRewards.milestoneId))
    .innerJoin(projects, eq(projects.id, milestoneRewards.projectId))
    .innerJoin(users, eq(users.id, milestoneRewardRecipients.userId))
    .where(inArray(milestoneRewardRecipients.id, [...ids]));
  return rows.map(
    ({ share, plan, milestone, reference, person }): RecordSummary => ({
      kind: 'milestone',
      id: share.id,
      title: `${milestone} · ${reference}`,
      subjectName: person,
      subjectUserIds: [share.userId],
      status: share.status,
      summary: share.summary,
      criteria: (share.evidence?.checks ?? []).map((check) => ({ ...check })),
      proposedAmountMinor: share.shareAmountMinor,
      currency: plan.currency,
    }),
  );
}

/**
 * Challenges with the record they dispute, newest first. Amounts (in the
 * record and its before/after snapshots) only for the record's people and
 * holders of `rewards.view_all`.
 */
export async function queryRewardChallenges(db: DatabaseExecutor, query: RewardChallengeQuery) {
  const where = and(
    query.scope === 'mine' ? eq(rewardChallenges.raisedByUserId, query.viewerUserId) : undefined,
    query.status === 'open' ? eq(rewardChallenges.status, 'open') : undefined,
    query.status === 'resolved'
      ? inArray(rewardChallenges.status, ['upheld', 'corrected'])
      : undefined,
    query.challengeId ? eq(rewardChallenges.id, query.challengeId) : undefined,
  );
  const [totals] = await db.select({ total: count() }).from(rewardChallenges).where(where);
  const rows = await db
    .select()
    .from(rewardChallenges)
    .where(where)
    .orderBy(desc(rewardChallenges.createdAt))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);
  const records = [
    ...(await evaluationSummaries(
      db,
      rows.flatMap((row) => (row.evaluationId ? [row.evaluationId] : [])),
    )),
    ...(await milestoneSummaries(
      db,
      rows.flatMap((row) => (row.milestoneRecipientId ? [row.milestoneRecipientId] : [])),
    )),
  ];
  const people = await loadUserSummaries(
    db,
    rows.flatMap((row) => [row.raisedByUserId, row.resolvedByUserId]),
  );
  const items = rows.flatMap((row) => {
    const record = records.find(
      (item) => item.id === (row.evaluationId ?? row.milestoneRecipientId),
    );
    if (!record) return [];
    const showAmounts = query.canViewAll || record.subjectUserIds.includes(query.viewerUserId);
    const { subjectUserIds: _subjects, proposedAmountMinor, ...visible } = record;
    return [
      {
        ...challengeEntryView(row, people, showAmounts),
        record: { ...visible, proposedAmountMinor: showAmounts ? proposedAmountMinor : null },
      },
    ];
  });
  return { items, totalItems: totals?.total ?? 0 };
}
