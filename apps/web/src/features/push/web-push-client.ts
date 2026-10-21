'use client';

import {
  serviceWorkerUrl,
  WEB_PUSH_CONFIG,
  WEB_PUSH_SCOPE,
  type WebPushConfig,
} from './web-push-config';

/** The device row this browser registered (POST /v1/devices), kept to unregister it later. */
const DEVICE_KEY = 'lintel.web-push-device';
const REGISTER_TIMEOUT_MS = 20_000;
const APP_NAME = 'lintel-web-push';

export class WebPushPermissionError extends Error {
  constructor(readonly permission: NotificationPermission) {
    super(`Notification permission is ${permission}.`);
    this.name = 'WebPushPermissionError';
  }
}

export function storedDeviceId(): string | null {
  try {
    return window.localStorage.getItem(DEVICE_KEY);
  } catch {
    return null;
  }
}

function rememberDevice(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(DEVICE_KEY, id);
    else window.localStorage.removeItem(DEVICE_KEY);
  } catch {
    // Private windows may refuse storage; the server still drops dead registrations.
  }
}

/** Firebase is only downloaded once someone actually uses web push. */
async function loadMessaging(config: WebPushConfig) {
  const [{ getApps, initializeApp }, messagingModule] = await Promise.all([
    import('firebase/app'),
    import('firebase/messaging'),
  ]);
  const app =
    getApps().find((candidate) => candidate.name === APP_NAME) ??
    initializeApp(
      {
        apiKey: config.apiKey,
        projectId: config.projectId,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId,
      },
      APP_NAME,
    );
  return { messaging: messagingModule.getMessaging(app), sdk: messagingModule };
}

/** True when Firebase web config exists and this browser can receive web push. */
export async function isWebPushSupported(): Promise<boolean> {
  if (!WEB_PUSH_CONFIG || typeof window === 'undefined') return false;
  if (!window.isSecureContext || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return false;
  }
  const { isSupported } = await import('firebase/messaging');
  return isSupported().catch(() => false);
}

/**
 * Registers this browser with FCM by Firebase Installation ID (the current,
 * non-deprecated API) and resolves with the ID once `onRegistered` reports it.
 */
async function registerInstallation(config: WebPushConfig): Promise<string> {
  const { messaging, sdk } = await loadMessaging(config);
  const registration = await navigator.serviceWorker.register(serviceWorkerUrl(config), {
    scope: WEB_PUSH_SCOPE,
  });
  return new Promise<string>((resolve, reject) => {
    let unsubscribe: (() => void) | null = null;
    const timer = window.setTimeout(() => {
      unsubscribe?.();
      reject(new Error('Firebase did not register this browser in time.'));
    }, REGISTER_TIMEOUT_MS);
    const finish = () => {
      window.clearTimeout(timer);
      unsubscribe?.();
    };
    unsubscribe = sdk.onRegistered(messaging, (installationId) => {
      finish();
      resolve(installationId);
    });
    sdk
      .register(messaging, { vapidKey: config.vapidKey, serviceWorkerRegistration: registration })
      .catch((error: unknown) => {
        finish();
        reject(error);
      });
  });
}

export type SaveDevice = (installationId: string) => Promise<{ readonly id: string }>;
export type RemoveDevice = (deviceId: string) => Promise<void>;

/** Asks for permission (call it from a click), registers the browser and the device row. */
export async function enableWebPush(saveDevice: SaveDevice): Promise<void> {
  const config = WEB_PUSH_CONFIG;
  if (!config) throw new Error('Web push is not configured for this studio.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new WebPushPermissionError(permission);
  const device = await saveDevice(await registerInstallation(config));
  rememberDevice(device.id);
}

/** On each visit: re-register so a changed installation ID reaches the server. */
export async function refreshWebPush(saveDevice: SaveDevice): Promise<void> {
  const config = WEB_PUSH_CONFIG;
  if (!config || !storedDeviceId() || Notification.permission !== 'granted') return;
  const device = await saveDevice(await registerInstallation(config));
  rememberDevice(device.id);
}

/** Stops pushes to this browser: device row, FCM registration and the worker. Best effort. */
export async function disableWebPush(removeDevice: RemoveDevice): Promise<void> {
  const deviceId = storedDeviceId();
  rememberDevice(null);
  if (deviceId) await removeDevice(deviceId).catch(() => undefined);
  const config = WEB_PUSH_CONFIG;
  if (!config || !('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration(WEB_PUSH_SCOPE);
  if (!registration) return;
  const { messaging, sdk } = await loadMessaging(config);
  await sdk.unregister(messaging).catch(() => undefined);
  await registration.unregister().catch(() => false);
}

/** While a Lintel tab has focus, FCM hands messages to the page instead of showing them. */
export async function onForegroundPush(listener: () => void): Promise<() => void> {
  const config = WEB_PUSH_CONFIG;
  if (!config || !storedDeviceId()) return () => undefined;
  const { messaging, sdk } = await loadMessaging(config);
  return sdk.onMessage(messaging, () => listener());
}
