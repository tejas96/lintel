import type {
  NewNotification,
  NotificationRecipientContext,
  NotificationStore,
  PlannedDelivery,
} from '@lintel/application';
import { and, eq, isNull } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import {
  deviceTokens,
  notificationDeliveries,
  notificationPreferences,
  notifications,
  users,
} from '../schema';

export class NotificationRepository implements NotificationStore {
  constructor(private readonly db: DatabaseExecutor) {}

  async recipientContext(userId: string): Promise<NotificationRecipientContext | null> {
    const [user] = await this.db
      .select({
        id: users.id,
        status: users.status,
        start: users.quietHoursStart,
        end: users.quietHoursEnd,
        email: users.email,
        emailDigest: users.emailDigestEnabled,
      })
      .from(users)
      .where(eq(users.id, userId));
    if (user?.status !== 'active') return null;
    const [device] = await this.db
      .select({ id: deviceTokens.id })
      .from(deviceTokens)
      .where(and(eq(deviceTokens.userId, userId), isNull(deviceTokens.revokedAt)))
      .limit(1);
    const preferences = await this.db
      .select({
        kind: notificationPreferences.kind,
        channel: notificationPreferences.channel,
        enabled: notificationPreferences.enabled,
      })
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
    return {
      userId,
      quietHoursStart: user.start,
      quietHoursEnd: user.end,
      hasActiveDevice: Boolean(device),
      email: { hasAddress: Boolean(user.email?.trim()), dailyDigest: user.emailDigest },
      preferences,
    };
  }

  async create(notification: NewNotification, deliveries: readonly PlannedDelivery[]) {
    const [row] = await this.db
      .insert(notifications)
      .values({
        recipientUserId: notification.recipientUserId,
        kind: notification.kind,
        title: notification.title,
        body: notification.body,
        linkPath: notification.linkPath,
        subjectType: notification.subjectType,
        subjectId: notification.subjectId,
        dedupeKey: notification.dedupeKey,
        groupKey: notification.groupKey ?? null,
      })
      .onConflictDoNothing({ target: [notifications.recipientUserId, notifications.dedupeKey] })
      .returning({ id: notifications.id });
    if (!row) return null;
    if (deliveries.length > 0) {
      await this.db.insert(notificationDeliveries).values(
        deliveries.map((delivery) => ({
          notificationId: row.id,
          channel: delivery.channel,
          status: delivery.status,
          notBefore: delivery.notBefore,
          lastError: delivery.status === 'skipped' ? delivery.reason : null,
        })),
      );
    }
    return row;
  }
}
