import type { NotificationItem } from '@lintel/api-contracts';
import { useRouter } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { errorMessage } from '@/api/api-error';
import { AccountButton } from '@/components/account-button';
import { Button } from '@/components/button';
import { PageHeader } from '@/components/screen';
import { SkeletonList } from '@/components/skeleton';
import { EmptyState, ErrorState } from '@/components/state-views';
import { TabList } from '@/components/tab-list';
import { useToast } from '@/feedback/toast';
import { hrefForLinkPath } from '@/push/link-routing';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/queries/notification-queries';
import { useAppTheme } from '@/theme/app-theme';
import { NotificationRow } from './notification-row';

/** Everything Lintel told the person, newest first; tapping opens the record it's about. */
export function InboxScreen() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useAppTheme();
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const items = notifications.data?.pages.flatMap((page) => page.items) ?? [];
  const unread = notifications.data?.pages[0]?.unreadCount ?? 0;

  const open = (notification: NotificationItem) => {
    if (notification.readAt === null) markRead.mutate(notification.id);
    const href = hrefForLinkPath(notification.linkPath);
    if (href) router.push(href);
  };

  const placeholder = notifications.isPending ? (
    <SkeletonList count={4} label="Loading notifications" />
  ) : notifications.isError ? (
    <ErrorState
      error={notifications.error}
      subject="your notifications"
      onRetry={() => void notifications.refetch()}
    />
  ) : (
    <EmptyState
      icon="inbox"
      title="No notifications"
      message="Assignments, reviews, blockers and leave decisions will show up here."
    />
  );

  return (
    <TabList<NotificationItem>
      data={items}
      keyExtractor={(notification) => notification.id}
      renderItem={({ item }) => (
        <NotificationRow
          notification={item}
          opensScreen={hrefForLinkPath(item.linkPath) !== null}
          onPress={open}
        />
      )}
      header={
        <>
          <PageHeader
            overline={unread > 0 ? `${unread} unread` : 'All read'}
            title="Inbox"
            trailing={<AccountButton />}
          />
          {unread > 0 ? (
            <Button
              label="Mark all as read"
              variant="secondary"
              icon="done"
              loading={markAll.isPending}
              onPress={() =>
                markAll.mutate(undefined, {
                  onError: (error) => toast.show(errorMessage(error), 'error'),
                })
              }
            />
          ) : null}
        </>
      }
      placeholder={placeholder}
      onRefresh={() => notifications.refetch()}
      onEndReached={() => {
        if (notifications.hasNextPage && !notifications.isFetchingNextPage) {
          void notifications.fetchNextPage();
        }
      }}
      footer={notifications.isFetchingNextPage ? <ActivityIndicator color={colors.accent} /> : null}
    />
  );
}
