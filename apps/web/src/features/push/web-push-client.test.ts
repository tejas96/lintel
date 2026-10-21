import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => {
  let registered: ((installationId: string) => void) | null = null;
  return {
    getMessaging: vi.fn(() => ({ kind: 'messaging' })),
    isSupported: vi.fn(async () => true),
    onRegistered: vi.fn((_messaging: unknown, listener: (installationId: string) => void) => {
      registered = listener;
      return () => {
        registered = null;
      };
    }),
    register: vi.fn(async () => {
      setTimeout(() => registered?.('fid-0123456789abcdefghij'), 0);
    }),
    unregister: vi.fn(async () => undefined),
    onMessage: vi.fn(() => () => undefined),
  };
});

vi.mock('firebase/app', () => ({
  getApps: () => [],
  initializeApp: vi.fn((options: unknown, name: string) => ({ options, name })),
}));
vi.mock('firebase/messaging', () => sdk);

const CONFIG = {
  NEXT_PUBLIC_FIREBASE_API_KEY: 'public-api-key',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'lintel-test',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '1234567890',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:1234567890:web:abc',
  NEXT_PUBLIC_FIREBASE_VAPID_KEY: 'public-vapid-key',
};

function stubBrowser(permission: NotificationPermission) {
  const storage = new Map<string, string>();
  const registration = { unregister: vi.fn(async () => true) };
  const notification = { permission, requestPermission: vi.fn(async () => permission) };
  const serviceWorker = {
    register: vi.fn(async (_url: string, _options: { scope: string }) => registration),
    getRegistration: vi.fn(async () => registration),
  };
  vi.stubGlobal('Notification', notification);
  vi.stubGlobal('navigator', { serviceWorker });
  vi.stubGlobal('window', {
    isSecureContext: true,
    Notification: notification,
    setTimeout,
    clearTimeout,
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });
  return { storage, registration, notification, serviceWorker };
}

async function load(withConfig = true) {
  vi.resetModules();
  for (const [key, value] of Object.entries(CONFIG)) vi.stubEnv(key, withConfig ? value : '');
  return import('./web-push-client');
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('web push without Firebase web config', () => {
  it('hides itself and never loads Firebase', async () => {
    stubBrowser('default');
    const client = await load(false);
    expect(await client.isWebPushSupported()).toBe(false);
    await expect(client.enableWebPush(vi.fn())).rejects.toThrow(/not configured/);
    expect(sdk.isSupported).not.toHaveBeenCalled();
  });
});

describe('web push with Firebase web config', () => {
  it('asks permission, registers the worker and the installation ID, and saves the device', async () => {
    const browser = stubBrowser('granted');
    const client = await load();
    const saveDevice = vi.fn(async () => ({ id: 'device-1' }));
    await client.enableWebPush(saveDevice);
    expect(browser.notification.requestPermission).toHaveBeenCalledOnce();
    const [url, options] = browser.serviceWorker.register.mock.calls[0] ?? [];
    expect(url).toBe(
      '/firebase-messaging-sw.js?apiKey=public-api-key&projectId=lintel-test&messagingSenderId=1234567890&appId=1%3A1234567890%3Aweb%3Aabc',
    );
    expect(options).toEqual({ scope: '/firebase-cloud-messaging-push-scope' });
    expect(sdk.register).toHaveBeenCalledWith(expect.anything(), {
      vapidKey: 'public-vapid-key',
      serviceWorkerRegistration: browser.registration,
    });
    expect(saveDevice).toHaveBeenCalledWith('fid-0123456789abcdefghij');
    expect(client.storedDeviceId()).toBe('device-1');
  });

  it('stops when the person declines, without registering anything', async () => {
    const browser = stubBrowser('denied');
    const client = await load();
    const saveDevice = vi.fn(async () => ({ id: 'device-1' }));
    await expect(client.enableWebPush(saveDevice)).rejects.toBeInstanceOf(
      client.WebPushPermissionError,
    );
    expect(browser.serviceWorker.register).not.toHaveBeenCalled();
    expect(saveDevice).not.toHaveBeenCalled();
    expect(client.storedDeviceId()).toBeNull();
  });

  it('unregisters the device, the installation and the worker (sign-out and turn off)', async () => {
    const browser = stubBrowser('granted');
    browser.storage.set('lintel.web-push-device', 'device-1');
    const client = await load();
    const removeDevice = vi.fn(async () => undefined);
    await client.disableWebPush(removeDevice);
    expect(removeDevice).toHaveBeenCalledWith('device-1');
    expect(sdk.unregister).toHaveBeenCalledOnce();
    expect(browser.registration.unregister).toHaveBeenCalledOnce();
    expect(client.storedDeviceId()).toBeNull();
  });

  it('refreshes only browsers that turned web push on', async () => {
    stubBrowser('granted');
    const client = await load();
    const saveDevice = vi.fn(async () => ({ id: 'device-2' }));
    await client.refreshWebPush(saveDevice);
    expect(saveDevice).not.toHaveBeenCalled();
  });
});
