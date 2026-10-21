import type { PushMessage, PushProvider, PushResult } from '@lintel/application';
import { appLink } from '@lintel/shared';
import { type App, cert, deleteApp, initializeApp } from 'firebase-admin/app';
import { getMessaging, type Message, type Messaging } from 'firebase-admin/messaging';

export interface FirebaseConfiguration {
  readonly projectId: string;
  readonly clientEmail: string;
  /** PEM key; "\n" escapes from environment files are converted to new lines. */
  readonly privateKey: string;
  /** Public web address; web notifications open `webBaseUrl + linkPath` (https only). */
  readonly webBaseUrl?: string;
}

/** FCM opens `webpush.fcmOptions.link` on click, and only accepts https URLs. */
export function webClickLink(webBaseUrl: string | undefined, linkPath: string | null) {
  if (!webBaseUrl?.startsWith('https://')) return null;
  return appLink(webBaseUrl, linkPath);
}

/** Error codes that mean the token is dead and should be removed (firebase-admin 14). */
const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/installation-id-not-registered',
  'messaging/invalid-registration-token',
]);

const RETRYABLE_CODES = new Set([
  'messaging/message-rate-exceeded',
  'messaging/device-message-rate-exceeded',
  'messaging/server-unavailable',
  'messaging/internal-error',
]);

/** The part of the Admin SDK messaging client this adapter uses (faked in tests). */
export type MessagingClient = Pick<Messaging, 'send'>;

/** The FCM message for one device: Android tokens go to `token`, web installations to `fid`. */
export function firebaseMessageFor(message: PushMessage, webBaseUrl?: string): Message {
  const link = webClickLink(webBaseUrl, message.linkPath);
  const base = {
    notification: { title: message.title, body: message.body },
    data: message.linkPath ? { linkPath: message.linkPath } : {},
    android: {
      priority: 'high' as const,
      ...(message.collapseKey ? { collapseKey: message.collapseKey } : {}),
    },
    apns: { headers: message.collapseKey ? { 'apns-collapse-id': message.collapseKey } : {} },
    // Web targets only: a newer notification with the same tag replaces the older one,
    // and a click opens the record (FCM accepts https links only).
    webpush: {
      notification: message.collapseKey ? { tag: message.collapseKey } : {},
      ...(link ? { fcmOptions: { link } } : {}),
    },
  };
  return message.tokenType === 'fcm_fid'
    ? { ...base, fid: message.token }
    : { ...base, token: message.token };
}

/**
 * Firebase Cloud Messaging through the Admin SDK. Android registration
 * tokens and web Firebase Installation IDs are sent; raw APNs tokens are
 * reported as not configured (see docs/INTEGRATIONS.md for the iOS setup).
 */
export class FirebasePushProvider implements PushProvider {
  readonly name = 'fcm';
  readonly isDevelopmentOnly = false;
  private readonly app: App | null;
  private readonly messaging: MessagingClient;
  private readonly webBaseUrl: string | undefined;

  constructor(config: FirebaseConfiguration, client?: MessagingClient) {
    this.webBaseUrl = config.webBaseUrl;
    if (client) {
      this.app = null;
      this.messaging = client;
      return;
    }
    this.app = initializeApp(
      {
        credential: cert({
          projectId: config.projectId,
          clientEmail: config.clientEmail,
          privateKey: config.privateKey.replace(/\\n/g, '\n'),
        }),
        projectId: config.projectId,
      },
      'lintel-push',
    );
    this.messaging = getMessaging(this.app);
  }

  async send(message: PushMessage): Promise<PushResult> {
    if (message.tokenType === 'apns') {
      return {
        outcome: 'not_configured',
        reason: 'APNs tokens need the Firebase iOS SDK on the device.',
      };
    }
    try {
      const providerMessageId = await this.messaging.send(
        firebaseMessageFor(message, this.webBaseUrl),
      );
      return { outcome: 'sent', providerMessageId };
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
      if (INVALID_TOKEN_CODES.has(code)) return { outcome: 'invalid_token', reason: code };
      if (RETRYABLE_CODES.has(code)) return { outcome: 'retryable_failure', reason: code };
      return { outcome: 'permanent_failure', reason: code || 'Unknown FCM error' };
    }
  }

  async close(): Promise<void> {
    if (this.app) await deleteApp(this.app);
  }
}
