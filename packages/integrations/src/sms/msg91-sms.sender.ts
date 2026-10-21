import type { MessageSendResult, SmsMessage, SmsSender } from '@lintel/application';

export interface Msg91SmsConfiguration {
  readonly baseUrl: string;
  readonly authKey: string;
  /** MSG91 SMS template ID. The DLT template is linked to it in the MSG91 panel. */
  readonly templateId: string;
  /** The DLT registration of that template; recorded for audits, not sent (see the docs). */
  readonly dltTemplateId: string;
  readonly timeoutMs: number;
}

/** The template variable that carries the link: `##link##` in the MSG91 template text. */
export const MSG91_SMS_LINK_VARIABLE = 'link';

/** The generic text to register with MSG91 and on the DLT portal (no details, only a link). */
export const URGENT_SMS_TEMPLATE_TEXT =
  'Lintel: an urgent update is waiting for you. Open ##link## to see it.';

type FetchFunction = (input: string, init: RequestInit) => Promise<Response>;

interface Msg91FlowResponse {
  readonly type?: string;
  readonly message?: string;
}

/** Provider messages are mapped to safe text; raw responses are never stored or shown. */
export function mapMsg91SmsError(status: number, message: string | undefined): string {
  const text = message ?? '';
  if (status === 401 || /auth ?key/i.test(text)) return 'MSG91 rejected the auth key.';
  if (/dlt/i.test(text)) return 'MSG91 rejected the DLT registration of the template.';
  if (/template|flow/i.test(text)) return 'MSG91 rejected the SMS template.';
  if (/mobile|number/i.test(text)) return 'MSG91 rejected the mobile number.';
  if (/balance/i.test(text)) return 'The MSG91 account has no SMS balance.';
  if (/ip/i.test(text)) return 'MSG91 refused this server’s IP address.';
  if (status === 429) return 'MSG91 rate limit reached.';
  return 'MSG91 did not accept the SMS.';
}

/**
 * MSG91 "Send SMS" (POST /api/v5/flow) with one recipient and the link as the
 * only variable. Docs: https://docs.msg91.com/sms/send-sms.md — success is
 * `{"type":"success","message":"<request id>"}`; like the OTP API, MSG91 may
 * answer HTTP 200 for errors, so `type` decides.
 */
export class Msg91SmsSender implements SmsSender {
  readonly name = 'msg91';
  readonly isDevelopmentOnly = false;

  constructor(
    private readonly config: Msg91SmsConfiguration,
    private readonly fetchImpl: FetchFunction = fetch,
  ) {}

  /** Recorded on each attempt so an audit can tie a send to its DLT registration. */
  get templateReference(): string {
    return `${this.config.templateId} (DLT ${this.config.dltTemplateId})`;
  }

  async send(message: SmsMessage): Promise<MessageSendResult> {
    const url = new URL('/api/v5/flow', this.config.baseUrl);
    const body = {
      template_id: this.config.templateId,
      // Our own link is sent as-is: MSG91 short links would add a tracking redirect.
      short_url: '0',
      realTimeResponse: '1',
      recipients: [
        {
          mobiles: message.phoneE164.replace(/^\+/, ''),
          [MSG91_SMS_LINK_VARIABLE]: message.link,
        },
      ],
    };
    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), {
        method: 'POST',
        headers: {
          authkey: this.config.authKey,
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch {
      return { outcome: 'retryable_failure', reason: 'MSG91 could not be reached.' };
    }
    const payload = (await response.json().catch(() => ({}))) as Msg91FlowResponse;
    if (response.ok && payload.type === 'success') {
      return { outcome: 'sent', providerMessageId: payload.message ?? null };
    }
    const reason = mapMsg91SmsError(response.status, payload.message);
    const retryable = response.status >= 500 || response.status === 429;
    return retryable
      ? { outcome: 'retryable_failure', reason }
      : { outcome: 'permanent_failure', reason };
  }
}
