import type { MilestoneRewardShareInput, NewMilestoneRewardPlan } from '@lintel/application';
import { and, eq, isNull, notInArray, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { milestoneRewards, milestoneRewardRecipients as recipients } from '../schema';

/** The plan's own columns from a planner's request. */
function planColumns(plan: NewMilestoneRewardPlan) {
  return {
    milestoneId: plan.milestoneId,
    projectId: plan.projectId,
    scope: plan.scope,
    amountMinor: plan.amountMinor,
    currency: plan.currency,
    agreedDueDate: plan.agreedDueDate,
    requiredDocumentFolders: [...plan.requiredDocumentFolders],
    note: plan.note,
  };
}

export async function insertRewardPlan(db: DatabaseExecutor, plan: NewMilestoneRewardPlan) {
  const [row] = await db
    .insert(milestoneRewards)
    .values({ ...planColumns(plan), createdByUserId: plan.actorUserId })
    .returning({ id: milestoneRewards.id });
  if (!row) throw new Error('Saving the milestone reward returned no row.');
  return row;
}

/** Also revives a withdrawn plan: the withdrawal is cleared (the audit log keeps it). */
export async function updateRewardPlan(
  db: DatabaseExecutor,
  planId: string,
  expectedVersion: number,
  plan: NewMilestoneRewardPlan,
) {
  const rows = await db
    .update(milestoneRewards)
    .set({
      ...planColumns(plan),
      updatedByUserId: plan.actorUserId,
      withdrawnAt: null,
      withdrawnByUserId: null,
      withdrawReason: null,
      version: sql`${milestoneRewards.version} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(milestoneRewards.id, planId),
        eq(milestoneRewards.version, expectedVersion),
        isNull(milestoneRewards.evaluatedAt),
      ),
    )
    .returning({ id: milestoneRewards.id });
  return rows.length > 0;
}

/** People left out are removed; everyone else is saved as planned, in split order. */
export async function replaceRewardShares(
  db: DatabaseExecutor,
  planId: string,
  shares: readonly MilestoneRewardShareInput[],
) {
  const keep = shares.map((share) => share.userId);
  await db
    .delete(recipients)
    .where(
      and(
        eq(recipients.milestoneRewardId, planId),
        keep.length > 0 ? notInArray(recipients.userId, keep) : undefined,
      ),
    );
  for (const share of shares) {
    await db
      .insert(recipients)
      .values({ milestoneRewardId: planId, ...share })
      .onConflictDoUpdate({
        target: [recipients.milestoneRewardId, recipients.userId],
        set: {
          position: share.position,
          shareAmountMinor: share.shareAmountMinor,
          status: 'planned',
          version: sql`${recipients.version} + 1`,
          updatedAt: new Date(),
        },
      });
  }
}

/** Withdraws an unchecked plan and every planned share with it. */
export async function withdrawRewardPlan(
  db: DatabaseExecutor,
  planId: string,
  expectedVersion: number,
  withdrawal: { at: Date; byUserId: string; reason: string },
) {
  const rows = await db
    .update(milestoneRewards)
    .set({
      withdrawnAt: withdrawal.at,
      withdrawnByUserId: withdrawal.byUserId,
      withdrawReason: withdrawal.reason,
      version: sql`${milestoneRewards.version} + 1`,
      updatedAt: withdrawal.at,
    })
    .where(
      and(
        eq(milestoneRewards.id, planId),
        eq(milestoneRewards.version, expectedVersion),
        isNull(milestoneRewards.withdrawnAt),
        isNull(milestoneRewards.evaluatedAt),
      ),
    )
    .returning({ id: milestoneRewards.id });
  if (rows.length === 0) return false;
  await db
    .update(recipients)
    .set({
      status: 'withdrawn',
      version: sql`${recipients.version} + 1`,
      updatedAt: withdrawal.at,
    })
    .where(eq(recipients.milestoneRewardId, planId));
  return true;
}
