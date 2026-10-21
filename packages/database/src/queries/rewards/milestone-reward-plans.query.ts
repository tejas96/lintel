import { describeMilestoneRewardConditions } from '@lintel/domain';
import { toCalendarDate } from '@lintel/shared';
import { asc, eq, inArray } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { milestoneRewardRecipients, milestoneRewards, milestones } from '../../schema';
import { loadUserSummaries } from '../shared/user-summary.query';
import { isDocumentFolder } from './milestone-reward-shares.query';

type PlanRow = typeof milestoneRewards.$inferSelect;

/**
 * The rewards attached to a project's milestones, for the people who plan
 * and decide rewards. Shows the amount and planned split they set; what is
 * finally granted (adjustments, corrections) stays with the person's own
 * record and `rewards.view_all`.
 */
export async function listProjectMilestoneRewards(db: DatabaseExecutor, projectId: string) {
  const plans = await db
    .select({ plan: milestoneRewards })
    .from(milestoneRewards)
    .innerJoin(milestones, eq(milestones.id, milestoneRewards.milestoneId))
    .where(eq(milestoneRewards.projectId, projectId))
    .orderBy(asc(milestones.dueDate), asc(milestones.position));
  return milestoneRewardPlanViews(
    db,
    plans.map((row) => row.plan),
  );
}

/** The plan of one milestone, or null. */
export async function findMilestoneRewardPlan(db: DatabaseExecutor, milestoneId: string) {
  const [plan] = await db
    .select()
    .from(milestoneRewards)
    .where(eq(milestoneRewards.milestoneId, milestoneId));
  if (!plan) return null;
  const [view] = await milestoneRewardPlanViews(db, [plan]);
  return view ?? null;
}

async function milestoneRewardPlanViews(db: DatabaseExecutor, plans: readonly PlanRow[]) {
  if (plans.length === 0) return [];
  const shares = await db
    .select()
    .from(milestoneRewardRecipients)
    .where(
      inArray(
        milestoneRewardRecipients.milestoneRewardId,
        plans.map((plan) => plan.id),
      ),
    )
    .orderBy(asc(milestoneRewardRecipients.position));
  const people = await loadUserSummaries(
    db,
    shares.map((share) => share.userId),
  );
  return plans.map((plan) => {
    const mine = shares.filter((share) => share.milestoneRewardId === plan.id);
    const folders = plan.requiredDocumentFolders.filter(isDocumentFolder);
    return {
      id: plan.id,
      milestoneId: plan.milestoneId,
      scope: plan.scope,
      amountMinor: plan.amountMinor,
      currency: plan.currency,
      agreedDueDate: plan.agreedDueDate,
      requiredDocumentFolders: folders,
      note: plan.note,
      state: plan.withdrawnAt
        ? ('withdrawn' as const)
        : plan.evaluatedAt
          ? ('checked' as const)
          : ('planned' as const),
      evaluatedAt: plan.evaluatedAt?.toISOString() ?? null,
      withdrawnAt: plan.withdrawnAt?.toISOString() ?? null,
      withdrawReason: plan.withdrawReason,
      recipients: mine.flatMap((share) => {
        const user = people.get(share.userId);
        if (!user) return [];
        return [
          {
            user,
            shareAmountMinor: share.shareAmountMinor,
            status: share.status,
            recommendation: share.recommendation,
          },
        ];
      }),
      conditions: describeMilestoneRewardConditions({
        agreedDueDate: toCalendarDate(plan.agreedDueDate),
        requiredFolders: folders,
        sharedBy: Math.max(1, mine.length),
      }),
      version: plan.version,
    };
  });
}
