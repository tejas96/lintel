import type {
  AttemptFinish,
  AttemptStart,
  MessageChannel,
  MessageDeliveryFacts,
  MessageDeliveryStore,
} from '@lintel/application';
import { and, eq, inArray } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import {
  notificationDeliveries,
  notificationDeliveryAttempts,
  notifications,
  users,
} from '../schema';

/** The SMS and email channels of notification deliveries, with per-attempt rows. */
export class MessageDeliveryRepository implements MessageDeliveryStore {
  constructor(private readonly db: DatabaseExecutor) {}

  async messageDelivery(
    notificationId: string,
    channel: MessageChannel,
  ): Promise<MessageDeliveryFacts | null> {
    const [row] = await this.db
      .select({
        notification: notifications,
        recipient: {
          userId: users.id,
          fullName: users.fullName,
          status: users.status,
          phoneE164: users.phoneE164,
          email: users.email,
        },
        delivery: {
          id: notificationDeliveries.id,
          status: notificationDeliveries.status,
          attempts: notificationDeliveries.attempts,
        },
      })
      .from(notifications)
      .innerJoin(users, eq(users.id, notifications.recipientUserId))
      .leftJoin(
        notificationDeliveries,
        and(
          eq(notificationDeliveries.notificationId, notifications.id),
          eq(notificationDeliveries.channel, channel),
        ),
      )
      .where(eq(notifications.id, notificationId));
    if (!row) return null;
    const { notification, recipient } = row;
    return {
      notificationId: notification.id,
      kind: notification.kind,
      title: notification.title,
      body: notification.body,
      linkPath: notification.linkPath,
      recipient: {
        userId: recipient.userId,
        fullName: recipient.fullName,
        active: recipient.status === 'active',
        phoneE164: recipient.phoneE164,
        email: recipient.email?.trim() || null,
      },
      delivery: row.delivery,
    };
  }

  async startAttempt(start: AttemptStart): Promise<void> {
    await this.db
      .insert(notificationDeliveryAttempts)
      .values({
        deliveryId: start.deliveryId,
        channel: start.channel,
        attempt: start.attempt,
        provider: start.provider,
        startedAt: start.at,
      })
      .onConflictDoNothing({
        target: [notificationDeliveryAttempts.deliveryId, notificationDeliveryAttempts.attempt],
      });
  }

  async finishAttempt(finish: AttemptFinish): Promise<boolean> {
    await this.db
      .update(notificationDeliveryAttempts)
      .set({
        outcome: finish.outcome,
        providerMessageId: finish.providerMessageId,
        error: finish.error,
        finishedAt: finish.at,
      })
      .where(
        and(
          eq(notificationDeliveryAttempts.deliveryId, finish.deliveryId),
          eq(notificationDeliveryAttempts.attempt, finish.attempt),
        ),
      );
    const rows = await this.db
      .update(notificationDeliveries)
      .set({
        status: finish.deliveryStatus,
        attempts: finish.attempt,
        lastError: finish.error,
        providerMessageId: finish.providerMessageId,
        sentAt: finish.deliveryStatus === 'sent' ? finish.at : null,
      })
      .where(
        and(
          eq(notificationDeliveries.id, finish.deliveryId),
          inArray(notificationDeliveries.status, ['pending', 'deferred']),
        ),
      )
      .returning({ id: notificationDeliveries.id });
    return rows.length > 0;
  }

  async giveUp(deliveryId: string, reason: string): Promise<boolean> {
    const rows = await this.db
      .update(notificationDeliveries)
      .set({ status: 'failed', lastError: reason })
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
