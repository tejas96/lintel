import { and, eq, gt } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { idempotencyRecords } from '../schema';

export interface StoredReplay {
  readonly requestFingerprint: string;
  readonly responseStatus: number;
  readonly responseBody: unknown;
}

/** Stored responses for retried commands that carried an `Idempotency-Key`. */
export class IdempotencyRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async find(userId: string, key: string, now: Date): Promise<StoredReplay | null> {
    const [row] = await this.db
      .select({
        requestFingerprint: idempotencyRecords.requestFingerprint,
        responseStatus: idempotencyRecords.responseStatus,
        responseBody: idempotencyRecords.responseBody,
      })
      .from(idempotencyRecords)
      .where(
        and(
          eq(idempotencyRecords.userId, userId),
          eq(idempotencyRecords.key, key),
          gt(idempotencyRecords.expiresAt, now),
        ),
      );
    return row ?? null;
  }

  async save(input: {
    userId: string;
    key: string;
    requestFingerprint: string;
    responseStatus: number;
    responseBody: unknown;
    expiresAt: Date;
  }): Promise<void> {
    await this.db.insert(idempotencyRecords).values(input).onConflictDoNothing();
  }
}
