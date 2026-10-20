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

function linkPathIn(source: unknown): string | null {
  if (typeof source !== 'object' || source === null || !('linkPath' in source)) return null;
  const { linkPath } = source;
  return typeof linkPath === 'string' && linkPath.startsWith('/') ? linkPath : null;
}

/**
 * The server sends the in-app path as the data key `linkPath` (see
 * FirebasePushProvider). Depending on platform and delivery path it surfaces in
 * `content.data`, the iOS APNs payload, or the Android FCM data map.
 */
export function linkPathOf(notification: Notifications.Notification): string | null {
  const { content, trigger } = notification.request;
  const fromData = linkPathIn(content.data);
  if (fromData) return fromData;
  if (trigger && typeof trigger === 'object' && 'type' in trigger && trigger.type === 'push') {
    return linkPathIn(trigger.payload) ?? linkPathIn(trigger.remoteMessage?.data);
  }
  return null;
}
