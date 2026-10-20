/** The longest an outbox event waits between relay attempts. */
export const MAX_OUTBOX_RETRY_DELAY_SECONDS = 3600;

/**
 * Exponential backoff for an outbox event that failed `attempts` times:
 * 2 s, 4 s, 8 s … capped at one hour. Events are never dropped.
 */
export function outboxRetryDelaySeconds(attempts: number): number {
  const safeAttempts = Math.max(1, Math.floor(attempts));
  if (safeAttempts >= 12) return MAX_OUTBOX_RETRY_DELAY_SECONDS;
  return Math.min(2 ** safeAttempts, MAX_OUTBOX_RETRY_DELAY_SECONDS);
}

export function outboxRetryAt(now: Date, attempts: number): Date {
  return new Date(now.getTime() + outboxRetryDelaySeconds(attempts) * 1000);
}
