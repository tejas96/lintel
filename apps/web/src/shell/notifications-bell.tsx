'use client';

import type { NotificationItem } from '@lintel/api-contracts';
import { CountBadge, cn, IconButton, LineDrawing, Popover } from '@lintel/design-system/web';
import { Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatRelativeInstant } from '@/lib/format/dates';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from './use-notifications';

/** The bell appears only when the server offers notifications. */
export function NotificationsBell({ className }: { readonly className?: string }) {
  const notifications = useNotifications();
  const [open, setOpen] = useState(false);
  if (!notifications.available || !notifications.data) return null;
  const { items, unreadCount } = notifications.data;
  return (
    <Popover
      label="Notifications"
      open={open}
      onOpenChange={setOpen}
      align="end"
      className="w-[22rem] p-0"
      trigger={
        <IconButton
          label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          className={className}
        >
          <Bell aria-hidden />
          <span aria-hidden className="pointer-events-none absolute top-1 right-1">
            <CountBadge count={unreadCount} label={`${unreadCount} unread`} />
          </span>
        </IconButton>
      }
    >
      <NotificationList items={items} unreadCount={unreadCount} onNavigate={() => setOpen(false)} />
    </Popover>
  );
}

function NotificationList({
  items,
  unreadCount,
  onNavigate,
}: {
  readonly items: readonly NotificationItem[];
  readonly unreadCount: number;
  readonly onNavigate: () => void;
}) {
  const router = useRouter();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  return (
    <div className="flex max-h-[min(32rem,70dvh)] flex-col">
      <header className="flex items-center justify-between border-b border-hairline px-4 py-3">
        <h2 className="type-title-md text-ink">Notifications</h2>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAll.mutate()}
            className="rounded-sm type-body-sm text-accent underline-offset-4 hover:underline"
          >
            Mark all as read
          </button>
        )}
      </header>
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <LineDrawing name="lamp" className="w-24" />
          <p className="type-body-sm text-ink-muted">
            Nothing new. Assignments, reviews and deadlines will show up here.
          </p>
        </div>
      ) : (
        <ul className="overflow-y-auto py-1">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  if (!item.readAt) markRead.mutate(item.id);
                  if (item.linkPath) {
                    onNavigate();
                    router.push(item.linkPath);
                  }
                }}
                className="flex w-full gap-3 px-4 py-3 text-left hover:bg-sunken/70"
              >
                <span
                  aria-hidden
                  className={cn(
                    'mt-2 size-2 shrink-0 rounded-full',
                    item.readAt ? 'bg-transparent' : 'bg-accent',
                  )}
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span
                    className={cn(
                      'type-body-sm',
                      item.readAt ? 'text-ink-muted' : 'font-medium text-ink',
                    )}
                  >
                    {item.title}
                    {!item.readAt && <span className="sr-only"> (unread)</span>}
                  </span>
                  <span className="line-clamp-2 type-body-sm text-ink-faint">{item.body}</span>
                  <time dateTime={item.createdAt} className="type-mono text-ink-faint">
                    {formatRelativeInstant(item.createdAt)}
                  </time>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
