import type { EmailSender, MessageSendResult, SmsSender } from '@lintel/application';

/** The SMS and email senders, and where links in messages point. */
export interface MessageChannelDependencies {
  readonly sms: SmsSender;
  readonly email: EmailSender;
  /** Public web address used to build links (https in production). */
  readonly webBaseUrl: string;
}

const NOT_CONFIGURED: MessageSendResult = {
  outcome: 'not_configured',
  reason: 'This channel is not configured for the worker.',
};

/**
 * For callers (tests, tools) that never send SMS or email: every attempt is
 * recorded as skipped, never as sent.
 */
export function unconfiguredChannels(
  webBaseUrl = 'http://localhost:3100',
): MessageChannelDependencies {
  return {
    sms: { name: 'none', isDevelopmentOnly: true, send: async () => NOT_CONFIGURED },
    email: { name: 'none', isDevelopmentOnly: true, send: async () => NOT_CONFIGURED },
    webBaseUrl,
  };
}

/** Error type Temporal shows when an SMS or email attempt is retried. */
export const RETRYABLE_MESSAGE_FAILURE = 'RetryableMessageFailure';

/** How a provider result ends the delivery row. */
export function deliveryStatusFor(
  result: MessageSendResult,
): 'pending' | 'sent' | 'failed' | 'skipped' {
  switch (result.outcome) {
    case 'sent':
      return 'sent';
    case 'retryable_failure':
      return 'pending';
    case 'permanent_failure':
      return 'failed';
    case 'not_configured':
      return 'skipped';
  }
}
