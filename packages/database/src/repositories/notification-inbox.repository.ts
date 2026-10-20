import type {
  ChannelPreferenceRecord,
  DeviceRecord,
  DeviceRegistration,
  NotificationInboxStore,
} from '@lintel/application';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { deviceTokens, notificationPreferences, notifications, users } from '../schema';

function toDevice(row: typeof deviceTokens.$inferSelect): DeviceRecord {
  return {
    id: row.id,
    userId: row.userId,
    platform: row.platform,
    appVersion: row.appVersion,
    lastSeenAt: row.lastSeenAt,
  };
}

export class NotificationInboxRepository implements NotificationInboxStore {
  constructor(private readonly db: DatabaseExecutor) {}

  async markRead(userId: string, notificationId: string, at: Date) {
    const [row] = await this.db
      .update(notifications)
      .set({ readAt: sql`coalesce(${notifications.readAt}, ${at.toISOString()}::timestamptz)` })
      .where(and(eq(notifications.id, notificationId), eq(notifications.recipientUserId, userId)))
      .returning({ id: notifications.id });
    return Boolean(row);
  }

  async markAllRead(userId: string, at: Date) {
    const rows = await this.db
      .update(notifications)
      .set({ readAt: at })
      .where(and(eq(notifications.recipientUserId, userId), isNull(notifications.readAt)))
      .returning({ id: notifications.id });
    return rows.length;
  }

  async savePreferences(userId: string, rows: readonly ChannelPreferenceRecord[]) {
    if (rows.length === 0) return;
    await this.db
      .insert(notificationPreferences)
      .values(rows.map((row) => ({ ...row, userId })))
      .onConflictDoUpdate({
        target: [
          notificationPreferences.userId,
          notificationPreferences.kind,
          notificationPreferences.channel,
        ],
        set: { enabled: sql`excluded.enabled` },
      });
  }

  async setQuietHours(userId: string, start: string | null, end: string | null) {
    await this.db
      .update(users)
      .set({ quietHoursStart: start, quietHoursEnd: end, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async registerDevice(userId: string, device: DeviceRegistration, at: Date) {
    const [existing] = await this.db
      .select({ userId: deviceTokens.userId })
      .from(deviceTokens)
      .where(eq(deviceTokens.token, device.token))
      .for('update');
    const [row] = await this.db
      .insert(deviceTokens)
      .values({ ...device, userId, lastSeenAt: at })
      .onConflictDoUpdate({
        target: deviceTokens.token,
        set: {
          userId,
          platform: device.platform,
          tokenType: device.tokenType,
          appVersion: device.appVersion,
          lastSeenAt: at,
          revokedAt: null,
          revokedReason: null,
        },
      })
      .returning();
    if (!row) throw new Error('Registering the device returned no row.');
    return { device: toDevice(row), previousUserId: existing?.userId ?? null };
  }

  async revokeDevice(userId: string, deviceId: string, at: Date, reason: string) {
    const [row] = await this.db
      .update(deviceTokens)
      .set({
        revokedAt: sql`coalesce(${deviceTokens.revokedAt}, ${at.toISOString()}::timestamptz)`,
        revokedReason: sql`coalesce(${deviceTokens.revokedReason}, ${reason})`,
      })
      .where(and(eq(deviceTokens.id, deviceId), eq(deviceTokens.userId, userId)))
      .returning({ id: deviceTokens.id });
    return Boolean(row);
  }
}
