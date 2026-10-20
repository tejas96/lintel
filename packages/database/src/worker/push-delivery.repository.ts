import type {
  PushAttemptProgress,
  PushDeliveryFacts,
  PushDeliveryOutcome,
  PushDeliveryStore,
  PushDevice,
} from '@lintel/application';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import { deviceTokens, notificationDeliveries, notifications, users } from '../schema';

/** The push channel of notification deliveries, and device token hygiene. */
export class PushDeliveryRepository implements PushDeliveryStore {
  constructor(private readonly db: DatabaseExecutor) {}

  async pushDelivery(notificationId: string): Promise<PushDeliveryFacts | null> {
    const [row] = await this.db
      .select({
        notification: notifications,
        recipientStatus: users.status,
        delivery: {
          id: notificationDeliveries.id,
          status: notificationDeliveries.status,
          notBefore: notificationDeliveries.notBefore,
          attempts: notificationDeliveries.attempts,
          providerMessageId: notificationDeliveries.providerMessageId,
        },
      })
      .from(notifications)
      .innerJoin(users, eq(users.id, notifications.recipientUserId))
      .leftJoin(
        notificationDeliveries,
        and(
          eq(notificationDeliveries.notificationId, notifications.id),
          eq(notificationDeliveries.channel, 'push'),
        ),
      )
      .where(eq(notifications.id, notificationId));
    if (!row) return null;
    const { notification } = row;
    return {
      notificationId: notification.id,
      recipientUserId: notification.recipientUserId,
      recipientActive: row.recipientStatus === 'active',
      kind: notification.kind,
      title: notification.title,
      body: notification.body,
      linkPath: notification.linkPath,
      groupKey: notification.groupKey,
      delivery: row.delivery,
    };
  }

  async activeDevices(userId: string): Promise<PushDevice[]> {
    return this.db
      .select({ id: deviceTokens.id, token: deviceTokens.token, tokenType: deviceTokens.tokenType })
      .from(deviceTokens)
      .where(and(eq(deviceTokens.userId, userId), isNull(deviceTokens.revokedAt)))
      .orderBy(asc(deviceTokens.createdAt));
  }

  async revokeDevice(deviceId: string, reason: string, at: Date): Promise<void> {
    await this.db
      .update(deviceTokens)
      .set({ revokedAt: at, revokedReason: reason })
      .where(and(eq(deviceTokens.id, deviceId), isNull(deviceTokens.revokedAt)));
  }

  async recordAttempt(deliveryId: string, progress: PushAttemptProgress): Promise<void> {
    await this.db
      .update(notificationDeliveries)
      .set(progress)
      .where(
        and(
          eq(notificationDeliveries.id, deliveryId),
          inArray(notificationDeliveries.status, ['pending', 'deferred']),
        ),
      );
  }

  async finish(deliveryId: string, outcome: PushDeliveryOutcome): Promise<boolean> {
    const rows = await this.db
      .update(notificationDeliveries)
      .set(outcome)
      .where(
        and(
          eq(notificationDeliveries.id, deliveryId),
          inArray(notificationDeliveries.status, ['pending', 'deferred']),
        ),
      )
      .returning({ id: notificationDeliveries.id });
    return rows.length > 0;
  }
}
