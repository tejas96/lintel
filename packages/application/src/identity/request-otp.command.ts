import {
  type Clock,
  DependencyUnavailableError,
  maskPhoneNumber,
  RateLimitedError,
} from '@lintel/shared';
import type { ClientContext } from '../common/request-context';
import type { OtpProvider } from '../ports/otp-provider.port';
import type { RandomSource, SecretHasher } from '../ports/security.port';
import type { IdentityStore } from './identity.store';
import type { OtpPolicy } from './otp-policy';
import { FixedWindowRateLimiter } from './rate-limiter';

export interface RequestOtpInput {
  readonly phoneE164: string;
  readonly client: ClientContext;
}

export interface RequestOtpResult {
  readonly maskedPhone: string;
  readonly expiresInSeconds: number;
  readonly resendAvailableInSeconds: number;
}

/**
 * Starts a sign-in. The response is identical whether or not the number
 * belongs to an account, so the endpoint cannot be used to discover members.
 * A code is only sent to active accounts.
 */
export class RequestOtpCommand {
  private readonly limiter: FixedWindowRateLimiter;

  constructor(
    private readonly store: IdentityStore,
    private readonly provider: OtpProvider,
    private readonly hasher: SecretHasher,
    private readonly random: RandomSource,
    private readonly clock: Clock,
    private readonly policy: OtpPolicy,
  ) {
    this.limiter = new FixedWindowRateLimiter(store);
  }

  async execute(input: RequestOtpInput): Promise<RequestOtpResult> {
    const now = this.clock.now();
    const ipHash = input.client.ipAddress ? this.hasher.hash(input.client.ipAddress) : null;
    await this.enforceLimits(input.phoneE164, ipHash, now);

    const code = this.random.numericCode(this.policy.codeLength);
    const expiresAt = new Date(now.getTime() + this.policy.expiryMinutes * 60_000);
    await this.store.invalidateOpenChallenges(input.phoneE164, now);
    const challenge = await this.store.createChallenge({
      phoneE164: input.phoneE164,
      codeHash: this.hasher.hash(code),
      provider: this.provider.name,
      maxAttempts: this.policy.maxVerifyAttempts,
      expiresAt,
      requestIpHash: ipHash,
    });

    const user = await this.store.findUserByPhone(input.phoneE164);
    if (user?.status === 'active') {
      const delivery = await this.provider.sendCode({
        phoneE164: input.phoneE164,
        code,
        expiresInMinutes: this.policy.expiryMinutes,
      });
      if (!delivery.delivered) {
        await this.store.invalidateOpenChallenges(challenge.phoneE164, now);
        throw new DependencyUnavailableError(
          'We could not send the code right now. Please try again.',
        );
      }
    }
    return {
      maskedPhone: maskPhoneNumber(input.phoneE164),
      expiresInSeconds: this.policy.expiryMinutes * 60,
      resendAvailableInSeconds: this.policy.resendCooldownSeconds,
    };
  }

  private async enforceLimits(phone: string, ipHash: string | null, now: Date): Promise<void> {
    const latest = await this.store.latestChallenge(phone);
    if (latest) {
      const elapsedSeconds = (now.getTime() - latest.createdAt.getTime()) / 1000;
      const wait = Math.ceil(this.policy.resendCooldownSeconds - elapsedSeconds);
      if (wait > 0)
        throw new RateLimitedError(`Please wait ${wait}s before asking for a new code.`, wait);
    }
    await this.limiter.consume(
      {
        name: 'otp-request-phone',
        limit: this.policy.requestsPerPhonePerHour,
        windowSeconds: 3600,
      },
      phone,
      now,
    );
    if (ipHash) {
      await this.limiter.consume(
        { name: 'otp-request-ip', limit: this.policy.requestsPerIpPerHour, windowSeconds: 3600 },
        ipHash,
        now,
      );
    }
  }
}
