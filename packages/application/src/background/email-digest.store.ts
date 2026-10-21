import type { DigestItem } from '@lintel/domain';
import type { CalendarDate } from '@lintel/shared';
import type { DeliveryStatus } from './push-delivery.store';

/** An email delivery waiting in status `digest`. */
export interface HeldDigestEmail extends DigestItem {
  readonly deliveryId: string;
}

export interface DigestRecipient {
  readonly userId: string;
  readonly fullName: string;
  readonly active: boolean;
  readonly email: string | null;
}

export interface EmailDigestRecord {
  readonly id: string;
  readonly status: DeliveryStatus;
  readonly attempts: number;
}

export interface DigestCompletion {
  readonly digestId: string;
  readonly attempt: number;
  readonly status: 'sent' | 'failed' | 'skipped';
  readonly outcome: 'sent' | 'permanent_failure' | 'not_configured' | 'recipient_unavailable';
  readonly providerMessageId: string | null;
  readonly error: string | null;
  /** The held deliveries the digest covered; they finish with the same status. */
  readonly deliveryIds: readonly string[];
  readonly at: Date;
}

/** Daily email digests: held deliveries, one digest row per person and day, attempts. */
export interface EmailDigestStore {
  /** People with at least one email delivery held for the digest. */
  recipientsWithHeldEmails(): Promise<string[]>;
  heldEmails(userId: string): Promise<{
    recipient: DigestRecipient;
    items: HeldDigestEmail[];
  } | null>;
  /** Returns the person's digest for the day, creating it (pending) when missing. */
  claimDigest(
    userId: string,
    digestDate: CalendarDate,
    itemCount: number,
  ): Promise<EmailDigestRecord>;
  /** Attempt N for a digest; repeating it for the same N is a no-op. */
  startDigestAttempt(digestId: string, attempt: number, provider: string, at: Date): Promise<void>;
  /** Keeps the digest pending after a retryable failure. */
  recordRetryableDigestAttempt(
    digestId: string,
    attempt: number,
    error: string,
    at: Date,
  ): Promise<void>;
  /**
   * Finishes the digest, its attempt and every delivery it covered (run it in
   * a transaction). False when the digest was already finished.
   */
  completeDigest(completion: DigestCompletion): Promise<boolean>;
  /**
   * After the last retry of a transient failure: the day's digest is recorded
   * as failed, and its emails stay held for the next digest.
   */
  abandonDigest(userId: string, digestDate: CalendarDate, reason: string): Promise<boolean>;
  /** Held deliveries that can never be sent (inactive person, no address). */
  skipHeldEmails(deliveryIds: readonly string[], reason: string): Promise<void>;
}
