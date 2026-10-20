/** Cryptographic helpers the application needs, implemented with node:crypto. */
export interface SecretHasher {
  /** Keyed hash (HMAC-SHA-256) for OTP codes, session tokens and IP addresses. */
  hash(value: string): string;
  /** Constant-time comparison of a value with a stored hash. */
  matches(value: string, expectedHash: string): boolean;
}

export interface RandomSource {
  /** A uniformly random numeric code of the given length, e.g. "481920". */
  numericCode(length: number): string;
  /** A URL-safe random token with at least 256 bits of entropy. */
  token(): string;
}
