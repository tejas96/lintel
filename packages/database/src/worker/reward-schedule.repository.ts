import { and, asc, eq } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { rewardPolicies, users } from '../schema';

/** Reads the scheduled reward run needs: active policies and the accountable owner. */
export class RewardScheduleRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  activePolicies(): Promise<{ id: string; period: 'monthly' | 'quarterly' }[]> {
    return this.db
      .select({ id: rewardPolicies.id, period: rewardPolicies.period })
      .from(rewardPolicies)
      .where(eq(rewardPolicies.isActive, true))
      .orderBy(asc(rewardPolicies.createdAt));
  }

  /** The studio owner the scheduled run is recorded under in the audit log. */
  async ownerUserId(): Promise<string | null> {
    const [row] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, 'owner'), eq(users.status, 'active')))
      .orderBy(asc(users.createdAt))
      .limit(1);
    return row?.id ?? null;
  }
}
