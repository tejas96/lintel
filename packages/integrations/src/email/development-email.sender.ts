import type { EmailMessage, EmailSender, MessageSendResult } from '@lintel/application';
import { maskEmailAddress } from '@lintel/shared';

export interface EmailLogger {
  info(message: string): void;
}

/**
 * Development email sender. It writes the subject and the plain-text part to
 * the worker log (the address masked) and reports `not_configured`, so the
 * delivery is recorded as skipped, never as sent. Refuses to exist in production.
 */
export class DevelopmentEmailSender implements EmailSender {
  readonly name = 'development';
  readonly isDevelopmentOnly = true;

  constructor(
    private readonly logger: EmailLogger,
    nodeEnvironment: string,
  ) {
    if (nodeEnvironment === 'production') {
      throw new Error('The development email sender cannot be used in production.');
    }
  }

  async send(message: EmailMessage): Promise<MessageSendResult> {
    this.logger.info(
      [
        `[DEVELOPMENT ONLY] Email not sent to ${maskEmailAddress(message.to)}`,
        `Subject: ${message.subject}`,
        message.text,
      ].join('\n'),
    );
    return {
      outcome: 'not_configured',
      reason: 'Development email sender: written to the worker log, not sent.',
    };
  }
}
