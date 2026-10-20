import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { queryKeys } from '@/api/query-keys';
import { linkPathOf } from './foreground-notifications';
import { hrefForLinkPath } from './link-routing';
import { currentPushPermission, registerPushDevice } from './push-device';

/**
 * Signed-in only. When permission is granted, register this device's token on
 * launch, on every return to the foreground (permission may have been turned
 * on in Settings meanwhile) and whenever the OS rotates the token. Repeats of
 * the same token are skipped in `registerPushDevice`.
 */
export function usePushRegistration(): void {
  useEffect(() => {
    let active = true;
    const registerIfAllowed = () => {
      void currentPushPermission()
        .then((permission) => (permission === 'granted' && active ? registerPushDevice() : null))
        .catch(() => undefined);
    };
    registerIfAllowed();
    const foreground = AppState.addEventListener('change', (status) => {
      if (status === 'active') registerIfAllowed();
    });
    const tokens = Notifications.addPushTokenListener((token) => {
      void registerPushDevice(token).catch(() => undefined);
    });
    return () => {
      active = false;
      foreground.remove();
      tokens.remove();
    };
  }, []);
}

const handledResponses = new Set<string>();

/**
 * A tap on a notification opens the record it is about (its `linkPath`);
 * pushes that arrive while the app is open refresh the affected lists.
 */
export function useNotificationNavigation(): void {
  const router = useRouter();
  const queryClient = useQueryClient();
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!response) return;
    const id = response.notification.request.identifier;
    if (handledResponses.has(id)) return;
    handledResponses.add(id);
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    router.push(hrefForLinkPath(linkPathOf(response.notification)) ?? '/inbox');
    void Notifications.clearLastNotificationResponseAsync();
  }, [response, router]);

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workQueue });
      void queryClient.invalidateQueries({ queryKey: queryKeys.approvals });
    });
    return () => subscription.remove();
  }, [queryClient]);
}
