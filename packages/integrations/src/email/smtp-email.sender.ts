import type { EmailMessage, EmailSender, MessageSendResult } from '@lintel/application';
import { createTransport, type SendMailOptions } from 'nodemailer';

export interface SmtpConfiguration {
  readonly host: string;
  readonly port: number;
  /** TLS from the first byte (port 465); otherwise STARTTLS on a plain connection. */
  readonly secure: boolean;
  /** Refuse to send when the server does not upgrade with STARTTLS. */
  readonly requireTls: boolean;
  readonly user: string | null;
  readonly password: string | null;
  /** "Lintel <notifications@studio.example.com>" */
  readonly from: string;
  readonly timeoutMs: number;
}

/** The part of a Nodemailer transporter this adapter uses (mocked in tests). */
export interface MailTransport {
  sendMail(mail: SendMailOptions): Promise<{
    readonly messageId?: string;
    readonly accepted?: readonly unknown[] | undefined;
    readonly rejected?: readonly unknown[] | undefined;
  }>;
  close(): void;
}

const UNREACHABLE = new Set(['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS', 'EPROXY']);

function errorFields(error: unknown): { code: string; responseCode: number | null } {
  if (typeof error !== 'object' || error === null) return { code: '', responseCode: null };
  const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
  const responseCode =
    'responseCode' in error && typeof error.responseCode === 'number' ? error.responseCode : null;
  return { code, responseCode };
}

/**
 * Maps a Nodemailer/SMTP failure to a safe reason. 4xx replies (greylisting,
 * mailbox busy) and connection trouble are retried; credentials, TLS and 5xx
 * replies are not. Server text is never kept (it can contain the address).
 */
export function classifySmtpError(error: unknown): MessageSendResult {
  const { code, responseCode } = errorFields(error);
  if (responseCode !== null && responseCode >= 400 && responseCode < 500) {
    return {
      outcome: 'retryable_failure',
      reason: `The mail server asked to retry (${responseCode}).`,
    };
  }
  if (code === 'EAUTH' || code === 'ENOAUTH') {
    return {
      outcome: 'permanent_failure',
      reason: 'The mail server rejected the SMTP credentials.',
    };
  }
  if (code === 'ETLS' || code === 'EREQUIRETLS') {
    return { outcome: 'permanent_failure', reason: 'A TLS connection to the mail server failed.' };
  }
  if (UNREACHABLE.has(code)) {
    return { outcome: 'retryable_failure', reason: 'The mail server could not be reached.' };
  }
  if (code === 'EENVELOPE') {
    return {
      outcome: 'permanent_failure',
      reason: 'The mail server refused the sender or recipient.',
    };
  }
  if (responseCode !== null && responseCode >= 500) {
    return {
      outcome: 'permanent_failure',
      reason: `The mail server refused the message (${responseCode}).`,
    };
  }
  return { outcome: 'permanent_failure', reason: 'The mail server did not accept the message.' };
}

/**
 * Sends notification emails over SMTP with Nodemailer (https://www.nodemailer.com/smtp).
 * File and URL access in message content is disabled: Lintel only sends text it rendered.
 */
export class SmtpEmailSender implements EmailSender {
  readonly name = 'smtp';
  readonly isDevelopmentOnly = false;
  private readonly transport: MailTransport;

  constructor(
    private readonly config: SmtpConfiguration,
    transport?: MailTransport,
  ) {
    this.transport =
      transport ??
      createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        requireTLS: !config.secure && config.requireTls,
        ...(config.user && config.password
          ? { auth: { user: config.user, pass: config.password } }
          : {}),
        connectionTimeout: config.timeoutMs,
        greetingTimeout: Math.min(config.timeoutMs, 30_000),
        socketTimeout: config.timeoutMs * 2,
        disableFileAccess: true,
        disableUrlAccess: true,
      });
  }

  async send(message: EmailMessage): Promise<MessageSendResult> {
    try {
      const info = await this.transport.sendMail({
        from: this.config.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        messageId: message.messageId,
        headers: {
          // RFC 3834: tells mail servers not to send out-of-office replies.
          'Auto-Submitted': 'auto-generated',
          'X-Lintel-Reference': message.reference,
        },
      });
      if ((info.rejected?.length ?? 0) > 0 && (info.accepted?.length ?? 0) === 0) {
        return { outcome: 'permanent_failure', reason: 'The mail server refused the recipient.' };
      }
      return { outcome: 'sent', providerMessageId: info.messageId ?? message.messageId };
    } catch (error) {
      return classifySmtpError(error);
    }
  }

  async close(): Promise<void> {
    this.transport.close();
  }
}
