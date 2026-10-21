import type {
  DigestCompletion,
  EmailDigestRecord,
  EmailDigestStore,
  HeldDigestEmail,
} from '@lintel/application';
import type { CalendarDate } from '@lintel/shared';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../client';
import {
  emailDigests,
  notificationDeliveries,
  notificationDeliveryAttempts,
  notifications,
  users,
} from '../schema';

const held = and(
  eq(notificationDeliveries.channel, 'email'),
  eq(notificationDeliveries.status, 'digest'),
);

/** Daily email digests over the email deliveries held in status `digest`. */
export class EmailDigestRepository implements EmailDigestStore {
  constructor(private readonly db: DatabaseExecutor) {}

  async recipientsWithHeldEmails(): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ userId: notifications.recipientUserId })
      .from(notificationDeliveries)
      .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
      .where(held)
      .orderBy(asc(notifications.recipientUserId));
    return rows.map((row) => row.userId);
  }

  async heldEmails(userId: string) {
    const [user] = await this.db
      .select({ fullName: users.fullName, status: users.status, email: users.email })
      .from(users)
      .where(eq(users.id, userId));
    if (!user) return null;
    const rows = await this.db
      .select({
        deliveryId: notificationDeliveries.id,
        notificationId: notifications.id,
        kind: notifications.kind,
        title: notifications.title,
        body: notifications.body,
        linkPath: notifications.linkPath,
        createdAt: notifications.createdAt,
      })
      .from(notificationDeliveries)
      .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
      .where(and(held, eq(notifications.recipientUserId, userId)))
      .orderBy(asc(notifications.createdAt));
    const items: HeldDigestEmail[] = rows;
    return {
      recipient: {
        userId,
        fullName: user.fullName,
        active: user.status === 'active',
        email: user.email?.trim() || null,
      },
      items,
    };
  }

  async claimDigest(
    userId: string,
    digestDate: CalendarDate,
    itemCount: number,
  ): Promise<EmailDigestRecord> {
    await this.db
      .insert(emailDigests)
      .values({ userId, digestDate, itemCount })
      .onConflictDoUpdate({
        target: [emailDigests.userId, emailDigests.digestDate],
        set: { itemCount: sql`excluded.item_count` },
        setWhere: eq(emailDigests.status, 'pending'),
      });
    const [row] = await this.db
      .select({ id: emailDigests.id, status: emailDigests.status, attempts: emailDigests.attempts })
      .from(emailDigests)
      .where(and(eq(emailDigests.userId, userId), eq(emailDigests.digestDate, digestDate)));
    if (!row) throw new Error('Claiming the email digest returned no row.');
    return row;
  }

  async startDigestAttempt(digestId: string, attempt: number, provider: string, at: Date) {
    await this.db
      .insert(notificationDeliveryAttempts)
      .values({ digestId, channel: 'email', attempt, provider, startedAt: at })
      .onConflictDoNothing({
        target: [notificationDeliveryAttempts.digestId, notificationDeliveryAttempts.attempt],
      });
  }

  async recordRetryableDigestAttempt(digestId: string, attempt: number, error: string, at: Date) {
    await this.finishAttemptRow(digestId, attempt, 'retryable_failure', null, error, at);
    await this.db
      .update(emailDigests)
      .set({ attempts: attempt, lastError: error })
      .where(and(eq(emailDigests.id, digestId), eq(emailDigests.status, 'pending')));
  }

  async completeDigest(completion: DigestCompletion): Promise<boolean> {
    const finished = await this.db
      .update(emailDigests)
      .set({
        status: completion.status,
        attempts: completion.attempt,
        providerMessageId: completion.providerMessageId,
        lastError: completion.error,
        sentAt: completion.status === 'sent' ? completion.at : null,
      })
      .where(and(eq(emailDigests.id, completion.digestId), eq(emailDigests.status, 'pending')))
      .returning({ id: emailDigests.id });
    if (finished.length === 0) return false;
    await this.finishAttemptRow(
      completion.digestId,
      completion.attempt,
      completion.outcome,
      completion.providerMessageId,
      completion.error,
      completion.at,
    );
    if (completion.deliveryIds.length > 0) {
      await this.db
        .update(notificationDeliveries)
        .set({
          status: completion.status,
          attempts: sql`${notificationDeliveries.attempts} + 1`,
          providerMessageId: `digest:${completion.digestId}`,
          lastError: completion.error,
          sentAt: completion.status === 'sent' ? completion.at : null,
        })
        .where(and(held, inArray(notificationDeliveries.id, [...completion.deliveryIds])));
    }
    return true;
  }

  async abandonDigest(userId: string, digestDate: CalendarDate, reason: string) {
    const rows = await this.db
      .update(emailDigests)
      .set({ status: 'failed', lastError: reason })
      .where(
        and(
          eq(emailDigests.userId, userId),
          eq(emailDigests.digestDate, digestDate),
          eq(emailDigests.status, 'pending'),
        ),
      )
      .returning({ id: emailDigests.id });
    return rows.length > 0;
  }

  async skipHeldEmails(deliveryIds: readonly string[], reason: string) {
    if (deliveryIds.length === 0) return;
    await this.db
      .update(notificationDeliveries)
      .set({ status: 'skipped', lastError: reason })
      .where(and(held, inArray(notificationDeliveries.id, [...deliveryIds])));
  }

  private async finishAttemptRow(
    digestId: string,
    attempt: number,
    outcome: DigestCompletion['outcome'] | 'retryable_failure',
    providerMessageId: string | null,
    error: string | null,
    at: Date,
  ) {
    await this.db
      .update(notificationDeliveryAttempts)
      .set({ outcome, providerMessageId, error, finishedAt: at })
      .where(
        and(
          eq(notificationDeliveryAttempts.digestId, digestId),
          eq(notificationDeliveryAttempts.attempt, attempt),
        ),
      );
  }
}
