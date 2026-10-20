import { defaultChannelPreference } from '@lintel/application';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_KINDS,
  type NotificationChannel,
  type NotificationKind,
} from '@lintel/domain';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { notificationPreferences, notifications, users } from '../../schema';

export interface NotificationView {
  readonly id: string;
  readonly kind: NotificationKind;
  readonly title: string;
  readonly body: string;
  readonly linkPath: string | null;
  readonly readAt: string | null;
  readonly createdAt: string;
}

/** The person's own inbox, newest first, with the unread count. */
export async function queryNotifications(
  db: DatabaseExecutor,
  userId: string,
  query: { unreadOnly: boolean; page: number; pageSize: number },
) {
  const mine = eq(notifications.recipientUserId, userId);
  const unread = and(mine, isNull(notifications.readAt));
  const where = query.unreadOnly ? unread : mine;
  const [[totals], [unreadTotals], rows] = await Promise.all([
    db.select({ total: count() }).from(notifications).where(where),
    db.select({ total: count() }).from(notifications).where(unread),
    db
      .select({
        id: notifications.id,
        kind: notifications.kind,
        title: notifications.title,
        body: notifications.body,
        linkPath: notifications.linkPath,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
  ]);
  const items: NotificationView[] = rows.map((row) => ({
    ...row,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
  return { items, totalItems: totals?.total ?? 0, unreadCount: unreadTotals?.total ?? 0 };
}

export interface NotificationPreferencesView {
  readonly quietHours: { start: string; end: string } | null;
  readonly channels: { kind: NotificationKind; channel: NotificationChannel; enabled: boolean }[];
}

/** Every kind × channel with the stored choice, or the default when never chosen. */
export async function loadNotificationPreferences(
  db: DatabaseExecutor,
  userId: string,
): Promise<NotificationPreferencesView> {
  const [[user], stored] = await Promise.all([
    db
      .select({ start: users.quietHoursStart, end: users.quietHoursEnd })
      .from(users)
      .where(eq(users.id, userId)),
    db
      .select({
        kind: notificationPreferences.kind,
        channel: notificationPreferences.channel,
        enabled: notificationPreferences.enabled,
      })
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId)),
  ]);
  const chosen = new Map(stored.map((row) => [`${row.kind}:${row.channel}`, row.enabled]));
  return {
    quietHours: user?.start && user.end ? { start: user.start, end: user.end } : null,
    channels: NOTIFICATION_KINDS.flatMap((kind) =>
      NOTIFICATION_CHANNELS.map((channel) => ({
        kind,
        channel,
        enabled: chosen.get(`${kind}:${channel}`) ?? defaultChannelPreference(channel),
      })),
    ),
  };
}
