import type { MessageSendResult } from './message-send-result';

export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  /** Plain-text part; always present so every mail client can read the message. */
  readonly text: string;
  readonly html: string;
  /**
   * Deterministic Message-ID (e.g. `<notification.<id>@lintel>`), so a retried
   * send is recognisable as the same message.
   */
  readonly messageId: string;
  /** Lintel's own reference for logs (the delivery or digest ID). */
  readonly reference: string;
}

/** Sends notification emails (SMTP in production). */
export interface EmailSender {
  readonly name: string;
  /** True only for the development adapter. Production must reject it. */
  readonly isDevelopmentOnly: boolean;
  send(message: EmailMessage): Promise<MessageSendResult>;
}
