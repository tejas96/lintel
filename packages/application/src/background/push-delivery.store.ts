import type { NotificationKind } from '@lintel/domain';
import type { PushTokenType } from '../ports/push-provider.port';

/** `digest`: an email held for the person's daily digest (never a push status). */
export type DeliveryStatus = 'pending' | 'deferred' | 'digest' | 'sent' | 'failed' | 'skipped';

export interface PushDeliveryFacts {
  readonly notificationId: string;
  readonly recipientUserId: string;
  readonly recipientActive: boolean;
  readonly kind: NotificationKind;
  readonly title: string;
  readonly body: string;
  readonly linkPath: string | null;
  readonly groupKey: string | null;
  /** The push channel row; null when the notification has no push delivery. */
  readonly delivery: {
    readonly id: string;
    readonly status: DeliveryStatus;
    readonly notBefore: Date | null;
    readonly attempts: number;
    /** While pending: progress of a multi-device send (see the worker's push progress). */
    readonly providerMessageId: string | null;
  } | null;
}

export interface PushDevice {
  readonly id: string;
  readonly token: string;
  readonly tokenType: PushTokenType;
}

export interface PushAttemptProgress {
  readonly attempts: number;
  readonly lastError: string | null;
  readonly providerMessageId: string | null;
}

export interface PushDeliveryOutcome extends PushAttemptProgress {
  readonly status: 'sent' | 'failed' | 'skipped';
  readonly sentAt: Date | null;
}

/** Push channel deliveries and the device tokens they go to. */
export interface PushDeliveryStore {
  pushDelivery(notificationId: string): Promise<PushDeliveryFacts | null>;
  activeDevices(userId: string): Promise<PushDevice[]>;
  revokeDevice(deviceId: string, reason: string, at: Date): Promise<void>;
  /** Saves progress of an unfinished delivery; the row stays pending. */
  recordAttempt(deliveryId: string, progress: PushAttemptProgress): Promise<void>;
  /** Finishes a pending or deferred delivery. Returns false when it was already finished. */
  finish(deliveryId: string, outcome: PushDeliveryOutcome): Promise<boolean>;
}
