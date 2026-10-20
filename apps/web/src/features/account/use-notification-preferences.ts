'use client';

import type { NotificationPreferences } from '@lintel/api-contracts';
import { useToast } from '@lintel/design-system/web';
import type { NotificationChannel, NotificationKind } from '@lintel/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, expectStatus } from '@/lib/api/api-client';
import { useFailureToast } from '@/lib/query/use-failure-toast';

export const preferencesKey = ['notifications', 'preferences'] as const;

export function useNotificationPreferences() {
  return useQuery({
    queryKey: preferencesKey,
    queryFn: () => expectStatus(api.operations.getNotificationPreferences(), 200),
  });
}

export function useSavePreferences() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const fail = useFailureToast();
  return useMutation({
    mutationFn: (preferences: NotificationPreferences) =>
      expectStatus(api.operations.updateNotificationPreferences({ body: preferences }), 200),
    onSuccess: (saved) => {
      queryClient.setQueryData(preferencesKey, saved);
      toast({ tone: 'success', title: 'Notification settings saved' });
    },
    onError: (error) => fail(error, 'save the notification settings', [preferencesKey]),
  });
}

/** Whether a kind reaches a channel, as the person has it set. */
export function isEnabled(
  preferences: NotificationPreferences,
  kind: NotificationKind,
  channel: NotificationChannel,
): boolean {
  return preferences.channels.some(
    (row) => row.kind === kind && row.channel === channel && row.enabled,
  );
}

/** A copy of the preferences with one kind and channel switched on or off. */
export function withChannel(
  preferences: NotificationPreferences,
  kind: NotificationKind,
  channel: NotificationChannel,
  enabled: boolean,
): NotificationPreferences {
  const exists = preferences.channels.some((row) => row.kind === kind && row.channel === channel);
  return {
    ...preferences,
    channels: exists
      ? preferences.channels.map((row) =>
          row.kind === kind && row.channel === channel ? { ...row, enabled } : row,
        )
      : [...preferences.channels, { kind, channel, enabled }],
  };
}
