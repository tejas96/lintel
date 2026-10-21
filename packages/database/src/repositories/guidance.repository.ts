import type { GuidanceStore } from '@lintel/application';
import { eq } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { userGuidanceTips } from '../schema';

/** Drizzle implementation of the seen first-run tips. */
export class GuidanceRepository implements GuidanceStore {
  constructor(private readonly db: DatabaseExecutor) {}

  async seenTipKeys(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ tipKey: userGuidanceTips.tipKey })
      .from(userGuidanceTips)
      .where(eq(userGuidanceTips.userId, userId));
    return rows.map((row) => row.tipKey);
  }

  async markSeen(userId: string, tipKey: string, at: Date): Promise<void> {
    await this.db
      .insert(userGuidanceTips)
      .values({ userId, tipKey, seenAt: at })
      .onConflictDoNothing();
  }

  async forget(userId: string): Promise<void> {
    await this.db.delete(userGuidanceTips).where(eq(userGuidanceTips.userId, userId));
  }
}
