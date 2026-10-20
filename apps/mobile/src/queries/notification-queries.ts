import type { NotificationPreferences } from '@lintel/api-contracts';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/api/api-client';
import { queryKeys } from '@/api/query-keys';

const PAGE_SIZE = 25;

export function useNotifications() {
  return useInfiniteQuery({
    queryKey: queryKeys.notifications,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      unwrap(
        api.operations.listNotifications({
          query: { page: pageParam, pageSize: PAGE_SIZE, unreadOnly: false },
          fetchOptions: { signal },
        }),
      ),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
}

/** Unread count for the Inbox badge; polls gently while the app is open. */
export function useUnreadNotificationCount(): number {
  const query = useQuery({
    queryKey: [...queryKeys.notifications, 'unread-count'],
    queryFn: ({ signal }) =>
      unwrap(
        api.operations.listNotifications({
          query: { page: 1, pageSize: 1, unreadOnly: true },
          fetchOptions: { signal },
        }),
      ),
    refetchInterval: 60_000,
    retry: false,
  });
  return query.data?.unreadCount ?? 0;
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) =>
      unwrap(api.operations.markNotificationRead({ params: { id: notificationId }, body: {} })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.operations.markAllNotificationsRead({ body: {} })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: queryKeys.notificationPreferences,
    queryFn: ({ signal }) =>
      unwrap(api.operations.getNotificationPreferences({ fetchOptions: { signal } })),
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (preferences: NotificationPreferences) =>
      unwrap(api.operations.updateNotificationPreferences({ body: preferences })),
    onSuccess: (saved) => queryClient.setQueryData(queryKeys.notificationPreferences, saved),
  });
}
