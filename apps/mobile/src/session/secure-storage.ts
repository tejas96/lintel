import * as SecureStore from 'expo-secure-store';

/**
 * The session token lives only in the platform keychain/keystore. Small app
 * preferences use the same store so nothing is written to plain files.
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export const STORAGE_KEYS = {
  sessionToken: 'lintel.session-token',
  pushDeviceId: 'lintel.push-device-id',
  pushPromptAnswered: 'lintel.push-prompt-answered',
  lastPhone: 'lintel.last-phone',
} as const;

type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export async function readSecure(key: StorageKey): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key, OPTIONS);
  } catch {
    // A keychain read can fail after a device restore; treat it as absent.
    return null;
  }
}

export async function writeSecure(key: StorageKey, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value, OPTIONS);
}

export async function deleteSecure(key: StorageKey): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key, OPTIONS);
  } catch {
    // Already gone.
  }
}
