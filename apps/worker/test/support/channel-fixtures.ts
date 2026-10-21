import { type DatabaseConnection, schema } from '@lintel/database';
import type { NotificationChannel, NotificationKind } from '@lintel/domain';
import { and, asc, eq, inArray } from 'drizzle-orm';

/** Rows for the SMS/email channel tests (users come from FixtureFactory and cascade away). */
export class ChannelFixtures {
  constructor(private readonly connection: DatabaseConnection) {}

  private get db() {
    return this.connection.db;
  }

  /** Email and digest activities read the studio name and timezone; a bare test database has none. */
  async ensureOrganization() {
    await this.db
      .insert(schema.organizationSettings)
      .values({ id: 1, name: 'Integration Test Studio' })
      .onConflictDoNothing();
  }

  async contactDetails(userId: string, email: string | null, dailyDigest: boolean) {
    await this.db
      .update(schema.users)
      .set({ email, emailDigestEnabled: dailyDigest })
      .where(eq(schema.users.id, userId));
  }

  async optIn(userId: string, kinds: readonly NotificationKind[], channel: NotificationChannel) {
    await this.db
      .insert(schema.notificationPreferences)
      .values(kinds.map((kind) => ({ userId, kind, channel, enabled: true })))
      .onConflictDoNothing();
  }

  async deliveries(notificationIds: readonly string[]) {
    if (notificationIds.length === 0) return [];
    return this.db
      .select()
      .from(schema.notificationDeliveries)
      .where(inArray(schema.notificationDeliveries.notificationId, [...notificationIds]))
      .orderBy(asc(schema.notificationDeliveries.channel));
  }

  async notificationsOf(userId: string) {
    return this.db
      .select({ id: schema.notifications.id, kind: schema.notifications.kind })
      .from(schema.notifications)
      .where(eq(schema.notifications.recipientUserId, userId))
      .orderBy(asc(schema.notifications.createdAt));
  }

  async attempts(deliveryId: string) {
    return this.db
      .select()
      .from(schema.notificationDeliveryAttempts)
      .where(eq(schema.notificationDeliveryAttempts.deliveryId, deliveryId))
      .orderBy(asc(schema.notificationDeliveryAttempts.attempt));
  }

  async digests(userId: string) {
    return this.db.select().from(schema.emailDigests).where(eq(schema.emailDigests.userId, userId));
  }

  async queuedEvents(notificationIds: readonly string[]) {
    if (notificationIds.length === 0) return [];
    return this.db
      .select({ eventType: schema.outboxEvents.eventType, payload: schema.outboxEvents.payload })
      .from(schema.outboxEvents)
      .where(
        and(
          eq(schema.outboxEvents.aggregateType, 'notification'),
          inArray(schema.outboxEvents.aggregateId, [...notificationIds]),
        ),
      );
  }

  async removeEvents(notificationIds: readonly string[]) {
    if (notificationIds.length === 0) return;
    await this.db
      .delete(schema.outboxEvents)
      .where(inArray(schema.outboxEvents.aggregateId, [...notificationIds]));
  }
}
