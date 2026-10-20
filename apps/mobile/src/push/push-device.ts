import * as Application from 'expo-application';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api, unwrap } from '@/api/api-client';
import { deleteSecure, readSecure, STORAGE_KEYS, writeSecure } from '@/session/secure-storage';

/** Matches `defaultChannel` in app.config.ts (used by FCM when no channel is given). */
export const WORK_CHANNEL_ID = 'work-updates';

/** Android 13+ only shows the permission prompt after a channel exists. */
export async function ensureNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(WORK_CHANNEL_ID, {
    name: 'Work updates',
    description: 'Assignments, reviews, blockers, deadlines and leave decisions.',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: '#2D44B0',
    vibrationPattern: [0, 160, 120, 160],
    showBadge: true,
  });
}

export type PushPermission = Notifications.PermissionStatus;

export async function currentPushPermission(): Promise<PushPermission> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

export async function requestPushPermission(): Promise<PushPermission> {
  await ensureNotificationChannel();
  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return status;
}

export type DeviceRegistration =
  | { readonly outcome: 'registered' }
  | { readonly outcome: 'unavailable'; readonly reason: string };

/**
 * Registers the native push token: an FCM token on Android, an APNs token on
 * iOS (Expo returns APNs on iOS; see README → Push for FCM on iOS).
 */
export async function registerPushDevice(
  knownToken?: Notifications.DevicePushToken,
): Promise<DeviceRegistration> {
  await ensureNotificationChannel();
  let deviceToken: Notifications.DevicePushToken;
  try {
    deviceToken = knownToken ?? (await Notifications.getDevicePushTokenAsync());
  } catch {
    return {
      outcome: 'unavailable',
      reason:
        Platform.OS === 'android'
          ? 'Push isn’t set up in this build (Firebase configuration is missing).'
          : 'This device couldn’t get a push token. Push needs a development or release build.',
    };
  }
  if (typeof deviceToken.data !== 'string' || deviceToken.data.length < 20) {
    return { outcome: 'unavailable', reason: 'This device returned no usable push token.' };
  }
  const device = await unwrap(
    api.operations.registerDevice({
      body: {
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        tokenType: Platform.OS === 'ios' ? 'apns' : 'fcm',
        token: deviceToken.data,
        appVersion: Application.nativeApplicationVersion ?? null,
      },
    }),
  );
  await writeSecure(STORAGE_KEYS.pushDeviceId, device.id);
  return { outcome: 'registered' };
}

/** Best effort: called before signing out so this phone stops receiving pushes. */
export async function unregisterPushDevice(): Promise<void> {
  const deviceId = await readSecure(STORAGE_KEYS.pushDeviceId);
  if (!deviceId) return;
  try {
    await unwrap(api.operations.unregisterDevice({ params: { id: deviceId } }));
  } catch {
    // The server drops tokens that stop working; nothing else to do here.
  }
  await deleteSecure(STORAGE_KEYS.pushDeviceId);
}

export function forgetPushDevice(): Promise<void> {
  return deleteSecure(STORAGE_KEYS.pushDeviceId);
}
