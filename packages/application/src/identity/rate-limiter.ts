import { RateLimitedError } from '@lintel/shared';
import type { IdentityStore } from './identity.store';

export interface RateLimitRule {
  readonly name: string;
  readonly limit: number;
  readonly windowSeconds: number;
}

/**
 * Fixed-window limits stored in PostgreSQL so they hold across restarts and
 * across several API instances.
 */
export class FixedWindowRateLimiter {
  constructor(private readonly store: Pick<IdentityStore, 'incrementRateLimit'>) {}

  async consume(rule: RateLimitRule, subject: string, now: Date): Promise<void> {
    const windowMs = rule.windowSeconds * 1000;
    const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
    const count = await this.store.incrementRateLimit(`${rule.name}:${subject}`, windowStart);
    if (count > rule.limit) {
      const retryAfterSeconds = Math.ceil(
        (windowStart.getTime() + windowMs - now.getTime()) / 1000,
      );
      throw new RateLimitedError(
        'Too many attempts. Please wait a little and try again.',
        retryAfterSeconds,
      );
    }
  }
}
