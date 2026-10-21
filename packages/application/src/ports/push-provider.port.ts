/**
 * `fcm`: an FCM registration token (Android). `fcm_fid`: a Firebase
 * Installation ID (the web app registers with `register()`/`onRegistered()`).
 * `apns`: a raw APNs token (iOS without the Firebase iOS SDK; never sent).
 */
export type PushTokenType = 'fcm' | 'fcm_fid' | 'apns';

export interface PushMessage {
  readonly token: string;
  readonly tokenType: PushTokenType;
  readonly title: string;
  readonly body: string;
  /** Only an in-app path; never sensitive content. */
  readonly linkPath: string | null;
  readonly collapseKey: string | null;
}

export type PushResult =
  | { readonly outcome: 'sent'; readonly providerMessageId: string }
  | { readonly outcome: 'invalid_token'; readonly reason: string }
  | { readonly outcome: 'retryable_failure'; readonly reason: string }
  | { readonly outcome: 'permanent_failure'; readonly reason: string }
  | { readonly outcome: 'not_configured'; readonly reason: string };

/** Push delivery (Firebase Cloud Messaging in production). */
export interface PushProvider {
  readonly name: string;
  readonly isDevelopmentOnly: boolean;
  send(message: PushMessage): Promise<PushResult>;
}
