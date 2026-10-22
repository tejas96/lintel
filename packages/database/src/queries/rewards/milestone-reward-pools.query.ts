import { type PoolShareFact } from '@lintel/domain';
import { inArray } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { milestoneRewardRecipients } from '../../schema';

/** Every share of each plan, as the pool rules (`milestonePoolTotals`) need them. */
export async function loadPoolShares(
  db: DatabaseExecutor,
  planIds: readonly string[],
): Promise<Map<string, PoolShareFact[]>> {
  const byPlan = new Map<string, PoolShareFact[]>();
  if (planIds.length === 0) return byPlan;
  const rows = await db
    .select({
      planId: milestoneRewardRecipients.milestoneRewardId,
      id: milestoneRewardRecipients.id,
      status: milestoneRewardRecipients.status,
      shareAmountMinor: milestoneRewardRecipients.shareAmountMinor,
      adjustedAmountMinor: milestoneRewardRecipients.adjustedAmountMinor,
    })
    .from(milestoneRewardRecipients)
    .where(inArray(milestoneRewardRecipients.milestoneRewardId, [...planIds]));
  for (const { planId, ...share } of rows) {
    byPlan.set(planId, [...(byPlan.get(planId) ?? []), share]);
  }
  return byPlan;
}
