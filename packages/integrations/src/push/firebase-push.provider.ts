import type { PushMessage, PushProvider, PushResult } from '@lintel/application';
import { type App, cert, deleteApp, initializeApp } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';

export interface FirebaseConfiguration {
  readonly projectId: string;
  readonly clientEmail: string;
  /** PEM key; "\n" escapes from environment files are converted to new lines. */
  readonly privateKey: string;
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

/**
 * Firebase Cloud Messaging through the Admin SDK. Only FCM registration
 * tokens are sent here; raw APNs tokens are reported as not configured
 * (see docs/INTEGRATIONS.md for the iOS setup).
 */
export class FirebasePushProvider implements PushProvider {
  readonly name = 'fcm';
  readonly isDevelopmentOnly = false;
  private readonly app: App;
  private readonly messaging: Messaging;

  constructor(config: FirebaseConfiguration) {
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
    if (message.tokenType !== 'fcm') {
      return {
        outcome: 'not_configured',
        reason: 'APNs tokens need the Firebase iOS SDK on the device.',
      };
    }
    try {
      const providerMessageId = await this.messaging.send({
        token: message.token,
        notification: { title: message.title, body: message.body },
        data: message.linkPath ? { linkPath: message.linkPath } : {},
        android: {
          priority: 'high',
          ...(message.collapseKey ? { collapseKey: message.collapseKey } : {}),
        },
        apns: { headers: message.collapseKey ? { 'apns-collapse-id': message.collapseKey } : {} },
      });
      return { outcome: 'sent', providerMessageId };
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
      if (INVALID_TOKEN_CODES.has(code)) return { outcome: 'invalid_token', reason: code };
      if (RETRYABLE_CODES.has(code)) return { outcome: 'retryable_failure', reason: code };
      return { outcome: 'permanent_failure', reason: code || 'Unknown FCM error' };
    }
  }

  async close(): Promise<void> {
    await deleteApp(this.app);
  }
}
