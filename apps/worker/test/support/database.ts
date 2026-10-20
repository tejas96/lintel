import { randomInt } from 'node:crypto';
import { createDatabaseConnection, type DatabaseConnection, schema } from '@lintel/database';
import { eq, inArray } from 'drizzle-orm';

/** The integration database. Tests only insert and delete rows they created themselves. */
export function connectTestDatabase(): DatabaseConnection {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required for integration tests (see .env.example).');
  }
  return createDatabaseConnection(url, { max: 5 });
}

/** Tracks fixture rows so a test file can remove exactly what it created. */
export class FixtureFactory {
  private readonly userIds: string[] = [];
  private readonly projectIds: string[] = [];

  constructor(private readonly connection: DatabaseConnection) {}

  get db() {
    return this.connection.db;
  }

  async user(
    fullName: string,
    options: { quietHoursStart?: string; quietHoursEnd?: string } = {},
  ): Promise<string> {
    const [row] = await this.db
      .insert(schema.users)
      .values({
        fullName,
        phoneE164: `+9199${String(randomInt(0, 99_999_999)).padStart(8, '0')}`,
        role: 'employee',
        quietHoursStart: options.quietHoursStart ?? null,
        quietHoursEnd: options.quietHoursEnd ?? null,
      })
      .returning({ id: schema.users.id });
    if (!row) throw new Error('Could not create a fixture user.');
    this.userIds.push(row.id);
    return row.id;
  }

  async device(userId: string, token: string): Promise<string> {
    const [row] = await this.db
      .insert(schema.deviceTokens)
      .values({ userId, platform: 'android', tokenType: 'fcm', token })
      .returning({ id: schema.deviceTokens.id });
    if (!row) throw new Error('Could not create a fixture device.');
    return row.id;
  }

  /** A notification with a push delivery row in the given state. */
  async pushNotification(
    recipientUserId: string,
    delivery: { status: 'pending' | 'deferred'; notBefore?: Date | null },
  ): Promise<{ notificationId: string; deliveryId: string }> {
    const [notification] = await this.db
      .insert(schema.notifications)
      .values({
        recipientUserId,
        kind: 'task_overdue',
        title: 'Overdue: Working drawings',
        body: 'Working drawings was due yesterday.',
        linkPath: '/tasks/00000000-0000-0000-0000-000000000001',
        dedupeKey: `integration-test:${randomInt(0, 1_000_000_000)}`,
      })
      .returning({ id: schema.notifications.id });
    if (!notification) throw new Error('Could not create a fixture notification.');
    const [row] = await this.db
      .insert(schema.notificationDeliveries)
      .values({
        notificationId: notification.id,
        channel: 'push',
        status: delivery.status,
        notBefore: delivery.notBefore ?? null,
      })
      .returning({ id: schema.notificationDeliveries.id });
    if (!row) throw new Error('Could not create a fixture delivery.');
    return { notificationId: notification.id, deliveryId: row.id };
  }

  async pushDelivery(deliveryId: string) {
    const [row] = await this.db
      .select()
      .from(schema.notificationDeliveries)
      .where(eq(schema.notificationDeliveries.id, deliveryId));
    return row;
  }

  async deviceRow(deviceId: string) {
    const [row] = await this.db
      .select()
      .from(schema.deviceTokens)
      .where(eq(schema.deviceTokens.id, deviceId));
    return row;
  }

  /** Deletes fixture projects, then users (notifications and devices cascade). */
  async cleanUp(): Promise<void> {
    if (this.projectIds.length > 0) {
      await this.db.delete(schema.projects).where(inArray(schema.projects.id, this.projectIds));
    }
    if (this.userIds.length > 0) {
      await this.db.delete(schema.users).where(inArray(schema.users.id, this.userIds));
    }
  }

  trackProject(projectId: string): void {
    this.projectIds.push(projectId);
  }
}
