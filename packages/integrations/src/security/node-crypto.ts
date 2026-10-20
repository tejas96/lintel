import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import type { RandomSource, SecretHasher } from '@lintel/application';

/** HMAC-SHA-256 keyed with the server secret, so leaked hashes cannot be brute-forced offline. */
export class HmacSecretHasher implements SecretHasher {
  constructor(private readonly secret: string) {
    if (secret.length < 32)
      throw new RangeError('The hashing secret must be at least 32 characters.');
  }

  hash(value: string): string {
    return createHmac('sha256', this.secret).update(value).digest('hex');
  }

  matches(value: string, expectedHash: string): boolean {
    const actual = Buffer.from(this.hash(value), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}

export class CryptoRandomSource implements RandomSource {
  numericCode(length: number): string {
    let code = '';
    for (let index = 0; index < length; index += 1) code += String(randomInt(0, 10));
    return code;
  }

  token(): string {
    return randomBytes(32).toString('base64url');
  }
}

/**
 * Development and test only: every OTP is the configured code so people can
 * sign in locally without SMS. Configuration rejects it in production.
 */
export class FixedCodeRandomSource implements RandomSource {
  private readonly fallback = new CryptoRandomSource();

  constructor(private readonly code: string) {}

  numericCode(length: number): string {
    return this.code.length === length ? this.code : this.fallback.numericCode(length);
  }

  token(): string {
    return this.fallback.token();
  }
}
