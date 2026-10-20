import { and, isNotNull, lt, or } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { idempotencyRecords, otpChallenges, rateLimitCounters, sessions } from '../schema';

const DAY_MS = 86_400_000;

export interface HousekeepingResult {
  readonly rateLimitCounters: number;
  readonly otpChallenges: number;
  readonly sessions: number;
  readonly idempotencyRecords: number;
}

/**
 * Deletes security records that no longer serve a purpose, so these tables
 * stay small. Safe to run repeatedly (the worker runs it daily).
 */
export async function purgeExpiredSecurityRecords(
  db: DatabaseExecutor,
  now: Date,
): Promise<HousekeepingResult> {
  const twoDaysAgo = new Date(now.getTime() - 2 * DAY_MS);
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const monthAgo = new Date(now.getTime() - 30 * DAY_MS);
  const counters = await db
    .delete(rateLimitCounters)
    .where(lt(rateLimitCounters.windowStart, twoDaysAgo))
    .returning({ key: rateLimitCounters.key });
  const challenges = await db
    .delete(otpChallenges)
    .where(lt(otpChallenges.createdAt, weekAgo))
    .returning({ id: otpChallenges.id });
  const oldSessions = await db
    .delete(sessions)
    .where(
      or(
        lt(sessions.expiresAt, monthAgo),
        and(isNotNull(sessions.revokedAt), lt(sessions.revokedAt, monthAgo)),
      ),
    )
    .returning({ id: sessions.id });
  const replays = await db
    .delete(idempotencyRecords)
    .where(lt(idempotencyRecords.expiresAt, now))
    .returning({ id: idempotencyRecords.id });
  return {
    rateLimitCounters: counters.length,
    otpChallenges: challenges.length,
    sessions: oldSessions.length,
    idempotencyRecords: replays.length,
  };
}
