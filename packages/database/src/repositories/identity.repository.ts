import type {
  IdentityStore,
  OtpChallengeRecord,
  SessionRecord,
  UserRecord,
} from '@lintel/application';
import { CAPABILITIES, type Capability, type Role } from '@lintel/domain';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { otpChallenges, rateLimitCounters, roleCapabilities, sessions, users } from '../schema';

const KNOWN_CAPABILITIES = new Set<string>(CAPABILITIES);

export function toUserRecord(row: typeof users.$inferSelect): UserRecord {
  return {
    id: row.id,
    phoneE164: row.phoneE164,
    fullName: row.fullName,
    email: row.email,
    designation: row.designation,
    role: row.role,
    status: row.status,
    teamId: row.teamId,
    reportsToUserId: row.reportsToUserId,
    capacityPercent: row.capacityPercent,
    avatarHue: row.avatarHue,
    version: row.version,
  };
}

function toChallenge(row: typeof otpChallenges.$inferSelect): OtpChallengeRecord {
  return {
    id: row.id,
    phoneE164: row.phoneE164,
    codeHash: row.codeHash,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  };
}

function toSession(row: typeof sessions.$inferSelect): SessionRecord {
  return {
    id: row.id,
    userId: row.userId,
    client: row.client,
    userAgent: row.userAgent,
    createdAt: row.createdAt,
    lastSeenAt: row.lastSeenAt,
    expiresAt: row.expiresAt,
  };
}

export class IdentityRepository implements IdentityStore {
  constructor(private readonly db: DatabaseExecutor) {}

  async findUserByPhone(phoneE164: string) {
    const [row] = await this.db.select().from(users).where(eq(users.phoneE164, phoneE164)).limit(1);
    return row ? toUserRecord(row) : null;
  }

  async findUserById(userId: string) {
    const [row] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    return row ? toUserRecord(row) : null;
  }

  async capabilitiesForRole(role: Role): Promise<Capability[]> {
    const rows = await this.db
      .select({ capability: roleCapabilities.capability })
      .from(roleCapabilities)
      .where(eq(roleCapabilities.role, role));
    return rows
      .map((row) => row.capability)
      .filter((value): value is Capability => KNOWN_CAPABILITIES.has(value));
  }

  async latestChallenge(phoneE164: string) {
    const [row] = await this.db
      .select()
      .from(otpChallenges)
      .where(eq(otpChallenges.phoneE164, phoneE164))
      .orderBy(desc(otpChallenges.createdAt))
      .limit(1);
    return row ? toChallenge(row) : null;
  }

  async openChallenge(phoneE164: string, now: Date) {
    const [row] = await this.db
      .select()
      .from(otpChallenges)
      .where(
        and(
          eq(otpChallenges.phoneE164, phoneE164),
          isNull(otpChallenges.consumedAt),
          isNull(otpChallenges.invalidatedAt),
          gt(otpChallenges.expiresAt, now),
        ),
      )
      .orderBy(desc(otpChallenges.createdAt))
      .limit(1);
    return row ? toChallenge(row) : null;
  }

  async createChallenge(input: Parameters<IdentityStore['createChallenge']>[0]) {
    const [row] = await this.db.insert(otpChallenges).values(input).returning();
    if (!row) throw new Error('Inserting the OTP challenge returned no row.');
    return toChallenge(row);
  }

  async invalidateOpenChallenges(phoneE164: string, at: Date) {
    await this.db
      .update(otpChallenges)
      .set({ invalidatedAt: at })
      .where(
        and(
          eq(otpChallenges.phoneE164, phoneE164),
          isNull(otpChallenges.consumedAt),
          isNull(otpChallenges.invalidatedAt),
        ),
      );
  }

  async reserveAttempt(challengeId: string) {
    const [row] = await this.db
      .update(otpChallenges)
      .set({ attempts: sql`${otpChallenges.attempts} + 1` })
      .where(
        and(
          eq(otpChallenges.id, challengeId),
          sql`${otpChallenges.attempts} < ${otpChallenges.maxAttempts}`,
          isNull(otpChallenges.consumedAt),
          isNull(otpChallenges.invalidatedAt),
        ),
      )
      .returning({ attempts: otpChallenges.attempts });
    return row?.attempts ?? null;
  }

  async consumeChallenge(challengeId: string, at: Date) {
    const rows = await this.db
      .update(otpChallenges)
      .set({ consumedAt: at })
      .where(and(eq(otpChallenges.id, challengeId), isNull(otpChallenges.consumedAt)))
      .returning({ id: otpChallenges.id });
    return rows.length === 1;
  }

  async incrementRateLimit(key: string, windowStart: Date) {
    const [row] = await this.db
      .insert(rateLimitCounters)
      .values({ key, windowStart, count: 1 })
      .onConflictDoUpdate({
        target: [rateLimitCounters.key, rateLimitCounters.windowStart],
        set: { count: sql`${rateLimitCounters.count} + 1` },
      })
      .returning({ count: rateLimitCounters.count });
    return row?.count ?? 1;
  }

  async createSession(input: Parameters<IdentityStore['createSession']>[0]) {
    const [row] = await this.db.insert(sessions).values(input).returning();
    if (!row) throw new Error('Inserting the session returned no row.');
    return toSession(row);
  }

  async findActiveSessionByTokenHash(tokenHash: string, now: Date) {
    const [row] = await this.db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, now),
        ),
      )
      .limit(1);
    return row ? toSession(row) : null;
  }

  async findSessionOwner(sessionId: string, now: Date) {
    const [row] = await this.db
      .select({ user: users })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(
        and(eq(sessions.id, sessionId), isNull(sessions.revokedAt), gt(sessions.expiresAt, now)),
      )
      .limit(1);
    return row ? toUserRecord(row.user) : null;
  }

  async touchSession(sessionId: string, at: Date) {
    await this.db.update(sessions).set({ lastSeenAt: at }).where(eq(sessions.id, sessionId));
    await this.db
      .update(users)
      .set({ lastActiveAt: at })
      .where(eq(users.id, sql`(select user_id from sessions where id = ${sessionId})`));
  }

  async revokeSession(sessionId: string, reason: string, at: Date) {
    await this.db
      .update(sessions)
      .set({ revokedAt: at, revokedReason: reason })
      .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
  }

  async revokeAllSessions(userId: string, reason: string, at: Date) {
    const rows = await this.db
      .update(sessions)
      .set({ revokedAt: at, revokedReason: reason })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)))
      .returning({ id: sessions.id });
    return rows.length;
  }

  async listActiveSessions(userId: string, now: Date) {
    const rows = await this.db
      .select()
      .from(sessions)
      .where(
        and(eq(sessions.userId, userId), isNull(sessions.revokedAt), gt(sessions.expiresAt, now)),
      )
      .orderBy(desc(sessions.lastSeenAt));
    return rows.map(toSession);
  }
}
