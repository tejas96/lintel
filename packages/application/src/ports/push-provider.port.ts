export interface PushMessage {
  readonly token: string;
  readonly tokenType: 'fcm' | 'apns';
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
