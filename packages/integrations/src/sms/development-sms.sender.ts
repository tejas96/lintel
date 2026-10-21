import type { MessageSendResult, SmsMessage, SmsSender } from '@lintel/application';
import { maskPhoneNumber } from '@lintel/shared';
import { URGENT_SMS_TEMPLATE_TEXT } from './msg91-sms.sender';

export interface MessageLogger {
  info(message: string): void;
}

/**
 * Development SMS sender. It records what would be sent (masked number, the
 * generic template with the link) and reports `not_configured`, so the
 * delivery is recorded as skipped, never as sent. Refuses to exist in production.
 */
export class DevelopmentSmsSender implements SmsSender {
  readonly name = 'development';
  readonly isDevelopmentOnly = true;

  constructor(
    private readonly logger: MessageLogger,
    nodeEnvironment: string,
  ) {
    if (nodeEnvironment === 'production') {
      throw new Error('The development SMS sender cannot be used in production.');
    }
  }

  async send(message: SmsMessage): Promise<MessageSendResult> {
    const text = URGENT_SMS_TEMPLATE_TEXT.replace('##link##', message.link);
    this.logger.info(
      `[DEVELOPMENT ONLY] SMS not sent to ${maskPhoneNumber(message.phoneE164)}: "${text}"`,
    );
    return {
      outcome: 'not_configured',
      reason: 'Development SMS sender: recorded in the worker log, not sent.',
    };
  }
}
