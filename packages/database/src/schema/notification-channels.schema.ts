import { sql } from 'drizzle-orm';
import { check, date, index, integer, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, instant, primaryId } from './columns';
import { deliveryAttemptOutcomeEnum, deliveryStatusEnum, notificationChannelEnum } from './enums';
import { users } from './identity.schema';
import { notificationDeliveries } from './notifications.schema';

/**
 * One person's daily email digest. At most one per person and business day,
 * so a re-run Schedule never sends the same digest twice; no row is written
 * for an empty digest.
 */
export const emailDigests = pgTable(
  'email_digests',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** The business day (studio timezone) the digest covers. */
    digestDate: date('digest_date', { mode: 'string' }).notNull(),
    status: deliveryStatusEnum('status').notNull().default('pending'),
    itemCount: integer('item_count').notNull(),
    attempts: integer('attempts').notNull().default(0),
    providerMessageId: text('provider_message_id'),
    lastError: text('last_error'),
    sentAt: instant('sent_at'),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex('email_digests_user_day_unique').on(table.userId, table.digestDate)],
);

/**
 * Every SMS/email send attempt, with its outcome. A row is written before the
 * provider is called and finished afterwards, so an attempt that crashed
 * half-way stays visible (outcome null) instead of disappearing.
 */
export const notificationDeliveryAttempts = pgTable(
  'notification_delivery_attempts',
  {
    id: primaryId(),
    deliveryId: uuid('delivery_id').references(() => notificationDeliveries.id, {
      onDelete: 'cascade',
    }),
    digestId: uuid('digest_id').references(() => emailDigests.id, { onDelete: 'cascade' }),
    channel: notificationChannelEnum('channel').notNull(),
    attempt: integer('attempt').notNull(),
    provider: text('provider').notNull(),
    outcome: deliveryAttemptOutcomeEnum('outcome'),
    providerMessageId: text('provider_message_id'),
    /** Safe, mapped text only: never a phone number, an address or a raw provider body. */
    error: text('error'),
    startedAt: instant('started_at').notNull().defaultNow(),
    finishedAt: instant('finished_at'),
  },
  (table) => [
    uniqueIndex('delivery_attempts_delivery_unique').on(table.deliveryId, table.attempt),
    uniqueIndex('delivery_attempts_digest_unique').on(table.digestId, table.attempt),
    index('delivery_attempts_started_idx').on(table.startedAt),
    check(
      'delivery_attempts_one_subject',
      sql`(${table.deliveryId} is null) <> (${table.digestId} is null)`,
    ),
  ],
);
