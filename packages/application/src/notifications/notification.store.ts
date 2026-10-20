import type { NotificationChannel, NotificationKind } from '@lintel/domain';

export interface NewNotification {
  readonly recipientUserId: string;
  readonly kind: NotificationKind;
  readonly title: string;
  readonly body: string;
  /** In-app path, e.g. `/tasks/<id>`. Opening it re-checks permissions. */
  readonly linkPath: string | null;
  readonly subjectType: string | null;
  readonly subjectId: string | null;
  /** Same recipient + key → stored once. Build with `notificationDedupeKey`. */
  readonly dedupeKey: string;
  readonly groupKey?: string | null;
}

export interface PlannedDelivery {
  readonly channel: NotificationChannel;
  readonly status: 'pending' | 'deferred' | 'skipped';
  readonly notBefore: Date | null;
  readonly reason: string;
}

export interface NotificationRecipientContext {
  readonly userId: string;
  readonly quietHoursStart: string | null;
  readonly quietHoursEnd: string | null;
  readonly hasActiveDevice: boolean;
  readonly preferences: readonly {
    kind: NotificationKind;
    channel: NotificationChannel;
    enabled: boolean;
  }[];
}

/** Persistence for in-app notifications and their per-channel deliveries. */
export interface NotificationStore {
  recipientContext(userId: string): Promise<NotificationRecipientContext | null>;
  /**
   * Inserts the notification and its deliveries. Returns null when a
   * notification with the same dedupe key already exists for the recipient.
   */
  create(
    notification: NewNotification,
    deliveries: readonly PlannedDelivery[],
  ): Promise<{ id: string } | null>;
}
