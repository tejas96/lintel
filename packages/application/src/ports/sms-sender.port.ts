import type { MessageSendResult } from './message-send-result';

/**
 * An urgent-notification SMS. It deliberately carries no title or body: the
 * text is a pre-approved generic template (DLT in India) plus a link into the
 * app, where the person sees the details after signing in.
 */
export interface SmsMessage {
  readonly phoneE164: string;
  /** Absolute URL into the web app, e.g. https://studio.example.com/leave/<id>. */
  readonly link: string;
  /** Lintel's own reference for logs and provider reports (the delivery ID). */
  readonly reference: string;
}

/** Sends notification SMS (MSG91 in production). */
export interface SmsSender {
  readonly name: string;
  /** True only for the development adapter. Production must reject it. */
  readonly isDevelopmentOnly: boolean;
  /** The template (and its DLT registration) in use; recorded on every attempt. */
  readonly templateReference?: string;
  send(message: SmsMessage): Promise<MessageSendResult>;
}
