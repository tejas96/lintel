'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, expectStatus } from '@/lib/api/api-client';
import { isApiError } from '@/lib/api/api-error';

export const notificationsQueryKey = ['notifications', 'recent'] as const;

/**
 * Recent notifications, refreshed every minute. `available` is false while
 * the server has no notifications endpoint (404), so the bell stays hidden.
 */
export function useNotifications() {
  const query = useQuery({
    queryKey: notificationsQueryKey,
    queryFn: () =>
      expectStatus(api.operations.listNotifications({ query: { page: 1, pageSize: 20 } }), 200),
    refetchInterval: (current) => (current.state.error ? false : 60_000),
    retry: false,
  });
  const unavailable = isApiError(query.error) && query.error.status === 404;
  return { ...query, available: !unavailable && query.isSuccess };
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      expectStatus(api.operations.markNotificationRead({ params: { id }, body: {} }), 204),
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationsQueryKey }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => expectStatus(api.operations.markAllNotificationsRead({ body: {} }), 204),
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationsQueryKey }),
  });
}
