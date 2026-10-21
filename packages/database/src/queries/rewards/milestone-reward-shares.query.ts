import {
  DOCUMENT_FOLDERS,
  type DocumentFolder,
  describeMilestoneRewardConditions,
  type MilestoneRewardStatus,
} from '@lintel/domain';
import { toCalendarDate } from '@lintel/shared';
import { and, asc, count, desc, eq, inArray } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { milestoneRewardRecipients, milestoneRewards, milestones, projects } from '../../schema';
import { loadUserSummaries, pickUser } from '../shared/user-summary.query';
import { challengeabilityOf, loadChallengeEntries } from './challenge-entries.query';

const recipients = milestoneRewardRecipients;

export const isDocumentFolder = (value: string): value is DocumentFolder =>
  (DOCUMENT_FOLDERS as readonly string[]).includes(value);

export interface MilestoneRewardShareQuery {
  readonly viewerUserId: string;
  /** `rewards.view_all`: every share and every amount. */
  readonly canViewAll: boolean;
  readonly scope: 'mine' | 'all';
  readonly status?: MilestoneRewardStatus | undefined;
  readonly shareId?: string | undefined;
  readonly page: number;
  readonly pageSize: number;
}

type ShareRow = typeof recipients.$inferSelect;

/** Compensation details, only for the person and `rewards.view_all`. */
function amountsOf(share: ShareRow, plan: { amountMinor: number }, showAmounts: boolean) {
  if (!showAmounts) {
    return {
      totalAmountMinor: null,
      shareAmountMinor: null,
      adjustedAmountMinor: null,
      adjustmentReason: null,
    };
  }
  return {
    totalAmountMinor: plan.amountMinor,
    shareAmountMinor: share.shareAmountMinor,
    adjustedAmountMinor: share.adjustedAmountMinor,
    adjustmentReason: share.adjustmentReason,
  };
}

/** Why a share has no findings yet, or the rules' summary. */
function summaryOf(share: ShareRow, withdrawReason: string | null): string | null {
  if (share.status !== 'withdrawn') return share.summary;
  return `Withdrawn before the milestone completed: ${withdrawReason ?? 'no reason given'}`;
}

/** How many people share each plan. */
async function sharedByOf(db: DatabaseExecutor, planIds: readonly string[]) {
  if (planIds.length === 0) return new Map<string, number>();
  const rows = await db
    .select({ planId: recipients.milestoneRewardId, people: count() })
    .from(recipients)
    .where(inArray(recipients.milestoneRewardId, [...planIds]))
    .groupBy(recipients.milestoneRewardId);
  return new Map(rows.map((row) => [row.planId, row.people]));
}

/**
 * Milestone rewards per person: what earns them, the rules' findings, the
 * decision and the challenge history. "mine" is the viewer's own shares.
 * Amounts are visible only to the person and to `rewards.view_all`.
 */
export async function queryMilestoneRewardShares(
  db: DatabaseExecutor,
  query: MilestoneRewardShareQuery,
) {
  const where = and(
    query.scope === 'mine' ? eq(recipients.userId, query.viewerUserId) : undefined,
    query.status ? eq(recipients.status, query.status) : undefined,
    query.shareId ? eq(recipients.id, query.shareId) : undefined,
  );
  const [totals] = await db.select({ total: count() }).from(recipients).where(where);
  const rows = await db
    .select({
      share: recipients,
      plan: milestoneRewards,
      milestone: {
        id: milestones.id,
        name: milestones.name,
        dueDate: milestones.dueDate,
        status: milestones.status,
        completedAt: milestones.completedAt,
      },
      project: {
        id: projects.id,
        reference: projects.reference,
        name: projects.name,
        colorIndex: projects.colorIndex,
      },
    })
    .from(recipients)
    .innerJoin(milestoneRewards, eq(milestoneRewards.id, recipients.milestoneRewardId))
    .innerJoin(milestones, eq(milestones.id, milestoneRewards.milestoneId))
    .innerJoin(projects, eq(projects.id, milestoneRewards.projectId))
    .where(where)
    .orderBy(desc(milestones.dueDate), asc(milestones.name), asc(recipients.position))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);
  const visible = (userId: string) => query.canViewAll || userId === query.viewerUserId;
  const ownerOf = new Map(rows.map((row) => [row.share.id, row.share.userId]));
  const people = await loadUserSummaries(
    db,
    rows.flatMap((row) => [row.share.userId, row.share.decidedByUserId]),
  );
  const sharedBy = await sharedByOf(db, [...new Set(rows.map((row) => row.plan.id))]);
  const history = await loadChallengeEntries(db, 'milestone', [...ownerOf.keys()], (id) =>
    visible(ownerOf.get(id) ?? ''),
  );
  const items = rows.map(({ share, plan, milestone, project }) => {
    const showAmounts = visible(share.userId);
    const sharers = sharedBy.get(plan.id) ?? 1;
    const challenges = history.get(share.id) ?? [];
    const granted =
      share.status === 'approved' ? (share.adjustedAmountMinor ?? share.shareAmountMinor) : null;
    return {
      id: share.id,
      planId: plan.id,
      project,
      milestone: { ...milestone, completedAt: milestone.completedAt?.toISOString() ?? null },
      scope: plan.scope,
      sharedBy: sharers,
      agreedDueDate: plan.agreedDueDate,
      conditions: describeMilestoneRewardConditions({
        agreedDueDate: toCalendarDate(plan.agreedDueDate),
        requiredFolders: plan.requiredDocumentFolders.filter(isDocumentFolder),
        sharedBy: sharers,
      }),
      note: plan.note,
      user: pickUser(people, share.userId),
      status: share.status,
      recommendation: share.recommendation,
      summary: summaryOf(share, plan.withdrawReason),
      criteria: (share.evidence?.checks ?? []).map((check) => ({ ...check })),
      ...amountsOf(share, plan, showAmounts),
      currency: plan.currency,
      decidedBy: pickUser(people, share.decidedByUserId),
      decidedAt: share.decidedAt?.toISOString() ?? null,
      decisionNote: share.decisionNote,
      challenges,
      challengeable: challengeabilityOf({
        status: share.status,
        grantedAmountMinor: granted,
        isSubject: share.userId === query.viewerUserId,
        history: challenges,
      }),
      version: share.version,
    };
  });
  return { items, totalItems: totals?.total ?? 0 };
}
