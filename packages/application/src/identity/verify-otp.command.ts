import { type Clock, UnauthenticatedError } from '@lintel/shared';
import type { RecordStore } from '../common/record.store';
import type { ClientContext } from '../common/request-context';
import type { RandomSource, SecretHasher } from '../ports/security.port';
import type { IdentityStore, SessionClient, UserRecord } from './identity.store';
import type { OtpPolicy } from './otp-policy';
import { FixedWindowRateLimiter } from './rate-limiter';

export interface VerifyOtpInput {
  readonly phoneE164: string;
  readonly code: string;
  readonly sessionClient: SessionClient;
  readonly client: ClientContext;
}

export interface VerifyOtpResult {
  /** Returned once. Only its hash is stored. */
  readonly sessionToken: string;
  readonly sessionId: string;
  readonly expiresAt: Date;
  readonly user: UserRecord;
}

const GENERIC_FAILURE = 'That code is incorrect or has expired. Request a new code and try again.';

/** Checks a code against the stored hash and opens a session for an active account. */
export class VerifyOtpCommand {
  private readonly limiter: FixedWindowRateLimiter;

  constructor(
    private readonly store: IdentityStore,
    private readonly records: RecordStore,
    private readonly hasher: SecretHasher,
    private readonly random: RandomSource,
    private readonly clock: Clock,
    private readonly policy: OtpPolicy,
  ) {
    this.limiter = new FixedWindowRateLimiter(store);
  }

  async execute(input: VerifyOtpInput): Promise<VerifyOtpResult> {
    const now = this.clock.now();
    const ipHash = input.client.ipAddress ? this.hasher.hash(input.client.ipAddress) : null;
    const quarterHour = { windowSeconds: 900 };
    await this.limiter.consume(
      {
        name: 'otp-verify-phone',
        limit: this.policy.verificationsPerPhonePerQuarterHour,
        ...quarterHour,
      },
      input.phoneE164,
      now,
    );
    if (ipHash) {
      await this.limiter.consume(
        {
          name: 'otp-verify-ip',
          limit: this.policy.verificationsPerIpPerQuarterHour,
          ...quarterHour,
        },
        ipHash,
        now,
      );
    }

    const challenge = await this.store.openChallenge(input.phoneE164, now);
    if (!challenge || challenge.attempts >= challenge.maxAttempts) {
      throw new UnauthenticatedError(GENERIC_FAILURE);
    }
    if (!this.hasher.matches(input.code, challenge.codeHash)) {
      const attempts = await this.store.recordFailedAttempt(challenge.id);
      if (attempts >= challenge.maxAttempts)
        await this.store.invalidateOpenChallenges(input.phoneE164, now);
      throw new UnauthenticatedError(GENERIC_FAILURE);
    }
    const consumed = await this.store.consumeChallenge(challenge.id, now);
    const user = await this.store.findUserByPhone(input.phoneE164);
    if (!consumed || !user || user.status !== 'active')
      throw new UnauthenticatedError(GENERIC_FAILURE);

    const sessionToken = this.random.token();
    const lifetimeDays =
      input.sessionClient === 'web' ? this.policy.webSessionDays : this.policy.mobileSessionDays;
    const session = await this.store.createSession({
      userId: user.id,
      tokenHash: this.hasher.hash(sessionToken),
      client: input.sessionClient,
      userAgent: input.client.userAgent?.slice(0, 300) ?? null,
      ipHash,
      expiresAt: new Date(now.getTime() + lifetimeDays * 86_400_000),
    });
    await this.records.appendAudit({
      actorUserId: user.id,
      action: 'auth.signed_in',
      entityType: 'session',
      entityId: session.id,
      after: { client: input.sessionClient },
      requestId: input.client.requestId,
    });
    return { sessionToken, sessionId: session.id, expiresAt: session.expiresAt, user };
  }
}
