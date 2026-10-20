import * as Device from 'expo-device';
import { Platform } from 'react-native';

const DEFAULT_API_URL = 'http://localhost:4106';

/**
 * `EXPO_PUBLIC_API_URL` is inlined at build time. On the Android emulator the
 * host machine is 10.0.2.2, so loopback addresses are rewritten there.
 */
export function resolveApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  const base = (configured && configured.length > 0 ? configured : DEFAULT_API_URL).replace(
    /\/+$/,
    '',
  );
  if (Platform.OS === 'android' && !Device.isDevice) {
    return base.replace(/\/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/, '//10.0.2.2');
  }
  return base;
}

export const API_BASE_URL = resolveApiBaseUrl();
