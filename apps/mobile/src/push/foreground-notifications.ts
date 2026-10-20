import * as Notifications from 'expo-notifications';

/**
 * While Lintel is open, a push shows as a banner (no sound) and the inbox and
 * work queue refresh, so the person sees the change without pulling to refresh.
 */
export function configureForegroundNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** The server puts the in-app path under `data.linkPath` (see FirebasePushProvider). */
export function linkPathOf(notification: Notifications.Notification): string | null {
  const data: unknown = notification.request.content.data;
  if (typeof data !== 'object' || data === null || !('linkPath' in data)) return null;
  const { linkPath } = data;
  return typeof linkPath === 'string' && linkPath.startsWith('/') ? linkPath : null;
}
