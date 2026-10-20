import type { Capability, Role } from '@lintel/domain';

export type UserStatus = 'invited' | 'active' | 'deactivated';
export type SessionClient = 'web' | 'mobile';

export interface UserRecord {
  readonly id: string;
  readonly phoneE164: string;
  readonly fullName: string;
  readonly email: string | null;
  readonly designation: string | null;
  readonly role: Role;
  readonly status: UserStatus;
  readonly teamId: string | null;
  readonly reportsToUserId: string | null;
  readonly capacityPercent: number;
  readonly avatarHue: number;
  readonly version: number;
}

export interface OtpChallengeRecord {
  readonly id: string;
  readonly phoneE164: string;
  readonly codeHash: string;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

export interface SessionRecord {
  readonly id: string;
  readonly userId: string;
  readonly client: SessionClient;
  readonly userAgent: string | null;
  readonly createdAt: Date;
  readonly lastSeenAt: Date;
  readonly expiresAt: Date;
}

/** Persistence for people, sign-in challenges, abuse counters and sessions. */
export interface IdentityStore {
  findUserByPhone(phoneE164: string): Promise<UserRecord | null>;
  findUserById(userId: string): Promise<UserRecord | null>;
  capabilitiesForRole(role: Role): Promise<Capability[]>;

  latestChallenge(phoneE164: string): Promise<OtpChallengeRecord | null>;
  /** The newest challenge that is not consumed, invalidated or expired. */
  openChallenge(phoneE164: string, now: Date): Promise<OtpChallengeRecord | null>;
  createChallenge(input: {
    phoneE164: string;
    codeHash: string;
    provider: string;
    maxAttempts: number;
    expiresAt: Date;
    requestIpHash: string | null;
  }): Promise<OtpChallengeRecord>;
  invalidateOpenChallenges(phoneE164: string, at: Date): Promise<void>;
  /** Atomically increments and returns the new attempt count. */
  recordFailedAttempt(challengeId: string): Promise<number>;
  /** Marks a challenge used. Returns false if another request consumed it first. */
  consumeChallenge(challengeId: string, at: Date): Promise<boolean>;

  /** Atomically increments a fixed-window counter and returns the new count. */
  incrementRateLimit(key: string, windowStart: Date): Promise<number>;

  createSession(input: {
    userId: string;
    tokenHash: string;
    client: SessionClient;
    userAgent: string | null;
    ipHash: string | null;
    expiresAt: Date;
  }): Promise<SessionRecord>;
  findActiveSessionByTokenHash(tokenHash: string, now: Date): Promise<SessionRecord | null>;
  touchSession(sessionId: string, at: Date): Promise<void>;
  revokeSession(sessionId: string, reason: string, at: Date): Promise<void>;
  revokeAllSessions(userId: string, reason: string, at: Date): Promise<number>;
  listActiveSessions(userId: string, now: Date): Promise<SessionRecord[]>;
}
