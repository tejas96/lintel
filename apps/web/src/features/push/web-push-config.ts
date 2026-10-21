/**
 * Public Firebase web configuration (NEXT_PUBLIC_* values are inlined at
 * build time, so each must be read literally). None of these are secrets;
 * the server key never reaches the browser. When any is missing, web push
 * hides itself and nothing Firebase-related is loaded.
 */
export interface WebPushConfig {
  readonly apiKey: string;
  readonly projectId: string;
  readonly messagingSenderId: string;
  readonly appId: string;
  /** Public key of the Web Push certificate (Firebase console → Cloud Messaging). */
  readonly vapidKey: string;
}

function readConfig(): WebPushConfig | null {
  const config: WebPushConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? '',
  };
  return Object.values(config).every((value) => value.length > 0) ? config : null;
}

export const WEB_PUSH_CONFIG = readConfig();

/** Firebase's own default scope: the worker never controls Lintel's pages. */
export const WEB_PUSH_SCOPE = '/firebase-cloud-messaging-push-scope';

/** The worker reads the public config from its URL (one file for every environment). */
export function serviceWorkerUrl(config: WebPushConfig): string {
  const query = new URLSearchParams({
    apiKey: config.apiKey,
    projectId: config.projectId,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
  });
  return `/firebase-messaging-sw.js?${query.toString()}`;
}
