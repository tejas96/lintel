import type { NotificationKind } from '@lintel/domain';
import type { DeliveryStatus } from './push-delivery.store';

export type MessageChannel = 'sms' | 'email';

export type DeliveryAttemptOutcome =
  | 'sent'
  | 'retryable_failure'
  | 'permanent_failure'
  | 'not_configured'
  | 'recipient_unavailable';

export interface MessageRecipient {
  readonly userId: string;
  readonly fullName: string;
  readonly active: boolean;
  readonly phoneE164: string;
  readonly email: string | null;
}

export interface MessageDeliveryFacts {
  readonly notificationId: string;
  readonly kind: NotificationKind;
  readonly title: string;
  readonly body: string;
  readonly linkPath: string | null;
  readonly recipient: MessageRecipient;
  /** The SMS or email row; null when the notification has none for the channel. */
  readonly delivery: {
    readonly id: string;
    readonly status: DeliveryStatus;
    readonly attempts: number;
  } | null;
}

export interface AttemptStart {
  readonly deliveryId: string;
  readonly channel: MessageChannel;
  readonly attempt: number;
  readonly provider: string;
  readonly at: Date;
}

export interface AttemptFinish {
  readonly deliveryId: string;
  readonly attempt: number;
  readonly outcome: DeliveryAttemptOutcome;
  readonly providerMessageId: string | null;
  /** Safe, mapped text (no phone numbers, addresses or raw provider bodies). */
  readonly error: string | null;
  readonly at: Date;
  /** `pending` keeps the delivery open for Temporal's next retry. */
  readonly deliveryStatus: 'pending' | 'sent' | 'failed' | 'skipped';
}

/** SMS and immediate-email deliveries, with one attempt row per send. */
export interface MessageDeliveryStore {
  messageDelivery(
    notificationId: string,
    channel: MessageChannel,
  ): Promise<MessageDeliveryFacts | null>;
  /** Writes attempt N before the provider is called. Repeating it for the same N is a no-op. */
  startAttempt(start: AttemptStart): Promise<void>;
  /**
   * Finishes attempt N and updates the delivery (attempt count, error, status).
   * Returns false when the delivery was already finished by someone else.
   */
  finishAttempt(finish: AttemptFinish): Promise<boolean>;
  /** After the last retry: an open delivery is recorded as failed with the reason. */
  giveUp(deliveryId: string, reason: string): Promise<boolean>;
}
