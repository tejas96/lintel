import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, instant, primaryId } from './columns';
import {
  deliveryStatusEnum,
  devicePlatformEnum,
  notificationChannelEnum,
  notificationKindEnum,
  pushTokenTypeEnum,
} from './enums';
import { users } from './identity.schema';

export const notifications = pgTable(
  'notifications',
  {
    id: primaryId(),
    recipientUserId: uuid('recipient_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: notificationKindEnum('kind').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    /** In-app path such as "/tasks/<id>". Always re-authorised when opened. */
    linkPath: text('link_path'),
    subjectType: text('subject_type'),
    subjectId: uuid('subject_id'),
    dedupeKey: text('dedupe_key').notNull(),
    groupKey: text('group_key'),
    readAt: instant('read_at'),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('notifications_dedupe_unique').on(table.recipientUserId, table.dedupeKey),
    index('notifications_recipient_idx').on(table.recipientUserId, table.readAt, table.createdAt),
  ],
);

export const notificationDeliveries = pgTable(
  'notification_deliveries',
  {
    id: primaryId(),
    notificationId: uuid('notification_id')
      .notNull()
      .references(() => notifications.id, { onDelete: 'cascade' }),
    channel: notificationChannelEnum('channel').notNull(),
    status: deliveryStatusEnum('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    notBefore: instant('not_before'),
    lastError: text('last_error'),
    providerMessageId: text('provider_message_id'),
    sentAt: instant('sent_at'),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('notification_deliveries_channel_unique').on(table.notificationId, table.channel),
    index('notification_deliveries_status_idx').on(table.status, table.notBefore),
  ],
);

export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: notificationKindEnum('kind').notNull(),
    channel: notificationChannelEnum('channel').notNull(),
    enabled: boolean('enabled').notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.kind, table.channel] })],
);

export const deviceTokens = pgTable(
  'device_tokens',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    platform: devicePlatformEnum('platform').notNull(),
    tokenType: pushTokenTypeEnum('token_type').notNull(),
    token: text('token').notNull(),
    appVersion: text('app_version'),
    lastSeenAt: instant('last_seen_at').notNull().defaultNow(),
    revokedAt: instant('revoked_at'),
    revokedReason: text('revoked_reason'),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('device_tokens_token_unique').on(table.token),
    index('device_tokens_user_idx').on(table.userId, table.revokedAt),
  ],
);
