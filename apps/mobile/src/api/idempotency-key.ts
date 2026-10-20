const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * A key for the API's `Idempotency-Key` header (8–100 of [A-Za-z0-9_-]). A
 * retried command carrying the same key gets the first answer replayed instead
 * of running twice. It is an identifier, not a secret.
 */
export function newIdempotencyKey(): string {
  let random = '';
  for (let index = 0; index < 22; index += 1) {
    random += ALPHABET[Math.floor(Math.random() * ALPHABET.length)] ?? 'x';
  }
  return `m-${Date.now().toString(36)}-${random}`;
}

export const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS']);
