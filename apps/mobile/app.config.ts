import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Lintel app configuration (Continuous Native Generation: `ios/` and `android/`
 * are generated from this file by `expo prebuild` and are not committed).
 *
 * Firebase files are optional. Without them the app builds and runs; push
 * registration reports that push is not configured. See README.md → Push.
 */
const BUNDLE_ID = 'studio.lintel.app';

/** Returns the path when the file exists, so missing Firebase files never break a build. */
function optionalFile(envName: string, defaultPath: string): string | undefined {
  const configured = process.env[envName] ?? defaultPath;
  return existsSync(resolve(__dirname, configured)) ? configured : undefined;
}

const androidGoogleServices = optionalFile('LINTEL_GOOGLE_SERVICES_JSON', './google-services.json');
const iosGoogleServices = optionalFile(
  'LINTEL_GOOGLE_SERVICE_INFO_PLIST',
  './GoogleService-Info.plist',
);
const apnsEnvironment =
  process.env.LINTEL_APNS_ENVIRONMENT === 'production' ? 'production' : 'development';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Lintel',
  slug: 'lintel',
  scheme: 'lintel',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#F3EFE7',
  ios: {
    bundleIdentifier: BUNDLE_ID,
    buildNumber: '1',
    supportsTablet: true,
    ...(iosGoogleServices ? { googleServicesFile: iosGoogleServices } : {}),
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: BUNDLE_ID,
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      monochromeImage: './assets/images/adaptive-icon-monochrome.png',
      backgroundColor: '#2D44B0',
    },
    ...(androidGoogleServices ? { googleServicesFile: androidGoogleServices } : {}),
    blockedPermissions: [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
  },
  web: { favicon: './assets/images/favicon.png' },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-image',
    'expo-secure-store',
    'expo-status-bar',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 96,
        resizeMode: 'contain',
        backgroundColor: '#F3EFE7',
        dark: { image: './assets/images/splash-icon-dark.png', backgroundColor: '#141311' },
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Lintel uses your photos to attach drawings and site photos to work.',
        cameraPermission: 'Lintel uses the camera to capture site photos and deliverables.',
        microphonePermission: false,
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/images/notification-icon.png',
        color: '#2D44B0',
        defaultChannel: 'work-updates',
        mode: apnsEnvironment,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    pushConfigured: {
      android: Boolean(androidGoogleServices),
      ios: Boolean(iosGoogleServices),
    },
  },
});
