import type { OtpDeliveryRequest, OtpDeliveryResult, OtpProvider } from '@lintel/application';

export interface Msg91Configuration {
  readonly baseUrl: string;
  readonly authKey: string;
  readonly templateId: string;
  readonly timeoutMs: number;
}

type FetchFunction = (input: string, init: RequestInit) => Promise<Response>;

interface Msg91Response {
  readonly type?: string;
  readonly message?: string;
  readonly request_id?: string;
}

/**
 * MSG91 classic OTP API (POST /api/v5/otp). The application generates the
 * code and passes it in `otp`, so verification and abuse limits stay ours.
 * Docs: https://docs.msg91.com/otp/sendotp.md — MSG91 answers HTTP 200 for
 * many errors, so the `type` field decides success.
 */
export class Msg91OtpProvider implements OtpProvider {
  readonly name = 'msg91';
  readonly isDevelopmentOnly = false;

  constructor(
    private readonly config: Msg91Configuration,
    private readonly fetchImpl: FetchFunction = fetch,
  ) {}

  async sendCode(request: OtpDeliveryRequest): Promise<OtpDeliveryResult> {
    const url = new URL('/api/v5/otp', this.config.baseUrl);
    url.searchParams.set('template_id', this.config.templateId);
    url.searchParams.set('mobile', request.phoneE164.replace(/^\+/, ''));
    url.searchParams.set('otp', request.code);
    url.searchParams.set('otp_length', String(request.code.length));
    url.searchParams.set('otp_expiry', String(request.expiresInMinutes));
    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), {
        method: 'POST',
        headers: { authkey: this.config.authKey, 'content-type': 'application/json' },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch {
      return { delivered: false, retryable: true, reason: 'MSG91 could not be reached.' };
    }
    const payload = (await response.json().catch(() => ({}))) as Msg91Response;
    if (response.ok && payload.type === 'success') {
      return { delivered: true, providerReference: payload.request_id ?? null };
    }
    return {
      delivered: false,
      retryable: response.status >= 500 || response.status === 429,
      reason: mapMsg91Error(response.status, payload.message),
    };
  }
}

/** Provider messages are mapped to safe text; raw responses are never shown to users. */
export function mapMsg91Error(status: number, message: string | undefined): string {
  if (status === 401 || /auth ?key/i.test(message ?? '')) return 'MSG91 rejected the auth key.';
  if (/template/i.test(message ?? '')) return 'MSG91 rejected the template ID.';
  if (status === 429) return 'MSG91 rate limit reached.';
  return 'MSG91 did not accept the request.';
}
