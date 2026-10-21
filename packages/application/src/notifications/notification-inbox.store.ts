import type { NotificationChannel, NotificationKind } from '@lintel/domain';
import type { PushTokenType } from '../ports/push-provider.port';

export interface ChannelPreferenceRecord {
  readonly kind: NotificationKind;
  readonly channel: NotificationChannel;
  readonly enabled: boolean;
}

export interface DeviceRegistration {
  readonly platform: 'ios' | 'android' | 'web';
  readonly tokenType: PushTokenType;
  readonly token: string;
  readonly appVersion: string | null;
}

export interface DeviceRecord {
  readonly id: string;
  readonly userId: string;
  readonly platform: 'ios' | 'android' | 'web';
  readonly appVersion: string | null;
  readonly lastSeenAt: Date;
}

/** The signed-in person's inbox state, channel preferences, quiet hours and push devices. */
export interface NotificationInboxStore {
  /** Marks one of the person's notifications read. False when it is not theirs or missing. */
  markRead(userId: string, notificationId: string, at: Date): Promise<boolean>;
  markAllRead(userId: string, at: Date): Promise<number>;
  /** Upserts the given kind × channel rows; other rows are left as they are. */
  savePreferences(userId: string, rows: readonly ChannelPreferenceRecord[]): Promise<void>;
  setQuietHours(userId: string, start: string | null, end: string | null): Promise<void>;
  /** On: non-urgent emails wait for one digest a day. Off: each email goes out on its own. */
  setEmailDigest(userId: string, daily: boolean): Promise<void>;
  /**
   * Upserts by token. A token registered by someone else moves to this person
   * (the phone changed hands); the previous owner is returned for the audit.
   */
  registerDevice(
    userId: string,
    device: DeviceRegistration,
    at: Date,
  ): Promise<{ device: DeviceRecord; previousUserId: string | null }>;
  /** Revokes one of the person's own devices. False when it is not theirs or missing. */
  revokeDevice(userId: string, deviceId: string, at: Date, reason: string): Promise<boolean>;
}
