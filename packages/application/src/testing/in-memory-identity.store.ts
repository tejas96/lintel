import type { Capability, Role } from '@lintel/domain';
import { DEFAULT_ROLE_CAPABILITIES } from '@lintel/domain';
import type {
  IdentityStore,
  OtpChallengeRecord,
  SessionRecord,
  UserRecord,
} from '../identity/identity.store';

interface StoredChallenge extends OtpChallengeRecord {
  consumedAt: Date | null;
  invalidatedAt: Date | null;
}

interface StoredSession extends SessionRecord {
  tokenHash: string;
  revokedAt: Date | null;
}

/** Test double for IdentityStore with the same atomic semantics as the SQL version. */
export class InMemoryIdentityStore implements IdentityStore {
  readonly users: UserRecord[] = [];
  readonly challenges: StoredChallenge[] = [];
  readonly sessions: StoredSession[] = [];
  private readonly counters = new Map<string, number>();
  private sequence = 0;

  addUser(user: Partial<UserRecord> & { phoneE164: string }): UserRecord {
    const record: UserRecord = {
      id: `user-${this.users.length + 1}`,
      fullName: 'Test Person',
      email: null,
      designation: null,
      role: 'employee',
      status: 'active',
      teamId: null,
      reportsToUserId: null,
      capacityPercent: 100,
      avatarHue: 200,
      version: 1,
      ...user,
    };
    this.users.push(record);
    return record;
  }

  async findUserByPhone(phone: string) {
    return this.users.find((user) => user.phoneE164 === phone) ?? null;
  }
  async findUserById(id: string) {
    return this.users.find((user) => user.id === id) ?? null;
  }
  async capabilitiesForRole(role: Role): Promise<Capability[]> {
    return [...DEFAULT_ROLE_CAPABILITIES[role]];
  }
  async latestChallenge(phone: string) {
    return this.challenges.filter((c) => c.phoneE164 === phone).at(-1) ?? null;
  }
  async openChallenge(phone: string, now: Date) {
    const open = this.challenges.filter(
      (c) => c.phoneE164 === phone && !c.consumedAt && !c.invalidatedAt && c.expiresAt > now,
    );
    return open.at(-1) ?? null;
  }
  async createChallenge(input: Parameters<IdentityStore['createChallenge']>[0]) {
    this.sequence += 1;
    const challenge: StoredChallenge = {
      id: `challenge-${this.sequence}`,
      phoneE164: input.phoneE164,
      codeHash: input.codeHash,
      attempts: 0,
      maxAttempts: input.maxAttempts,
      expiresAt: input.expiresAt,
      createdAt: new Date(this.now().getTime()),
      consumedAt: null,
      invalidatedAt: null,
    };
    this.challenges.push(challenge);
    return challenge;
  }
  async invalidateOpenChallenges(phone: string, at: Date) {
    for (const c of this.challenges) {
      if (c.phoneE164 === phone && !c.consumedAt && !c.invalidatedAt) c.invalidatedAt = at;
    }
  }
  async recordFailedAttempt(id: string) {
    const challenge = this.challenges.find((c) => c.id === id);
    if (!challenge) return 0;
    const updated = { ...challenge, attempts: challenge.attempts + 1 };
    this.challenges.splice(this.challenges.indexOf(challenge), 1, updated);
    return updated.attempts;
  }
  async consumeChallenge(id: string, at: Date) {
    const challenge = this.challenges.find((c) => c.id === id);
    if (!challenge || challenge.consumedAt) return false;
    challenge.consumedAt = at;
    return true;
  }
  async incrementRateLimit(key: string, windowStart: Date) {
    const counterKey = `${key}@${windowStart.toISOString()}`;
    const next = (this.counters.get(counterKey) ?? 0) + 1;
    this.counters.set(counterKey, next);
    return next;
  }
  async createSession(input: Parameters<IdentityStore['createSession']>[0]) {
    const session: StoredSession = {
      id: `session-${this.sessions.length + 1}`,
      userId: input.userId,
      client: input.client,
      userAgent: input.userAgent,
      tokenHash: input.tokenHash,
      createdAt: this.now(),
      lastSeenAt: this.now(),
      expiresAt: input.expiresAt,
      revokedAt: null,
    };
    this.sessions.push(session);
    return session;
  }
  async findActiveSessionByTokenHash(hash: string, now: Date) {
    return (
      this.sessions.find((s) => s.tokenHash === hash && !s.revokedAt && s.expiresAt > now) ?? null
    );
  }
  async touchSession() {}
  async revokeSession(id: string, _reason: string, at: Date) {
    const session = this.sessions.find((s) => s.id === id);
    if (session) session.revokedAt = at;
  }
  async revokeAllSessions(userId: string, _reason: string, at: Date) {
    const active = this.sessions.filter((s) => s.userId === userId && !s.revokedAt);
    for (const session of active) session.revokedAt = at;
    return active.length;
  }
  async listActiveSessions(userId: string, now: Date) {
    return this.sessions.filter((s) => s.userId === userId && !s.revokedAt && s.expiresAt > now);
  }

  /** Tests set this to control creation timestamps. */
  now: () => Date = () => new Date();
}
