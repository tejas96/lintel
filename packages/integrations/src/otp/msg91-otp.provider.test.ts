import { describe, expect, it } from 'vitest';
import { Msg91OtpProvider } from './msg91-otp.provider';

const config = {
  baseUrl: 'https://control.msg91.com',
  authKey: 'test-auth-key',
  templateId: 'tpl-123',
  timeoutMs: 2000,
};

function fakeFetch(
  status: number,
  body: unknown,
  calls: { url: string; init: RequestInit }[] = [],
) {
  return async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };
}

describe('MSG91 OTP provider', () => {
  it('sends our code with the documented parameters and auth header', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const provider = new Msg91OtpProvider(
      config,
      fakeFetch(200, { type: 'success', request_id: 'req-1' }, calls),
    );
    const result = await provider.sendCode({
      phoneE164: '+919800000001',
      code: '482913',
      expiresInMinutes: 5,
    });
    expect(result).toEqual({ delivered: true, providerReference: 'req-1' });
    const url = new URL(calls[0]?.url ?? '');
    expect(url.pathname).toBe('/api/v5/otp');
    expect(url.searchParams.get('mobile')).toBe('919800000001');
    expect(url.searchParams.get('otp')).toBe('482913');
    expect(url.searchParams.get('template_id')).toBe('tpl-123');
    const headers = calls[0]?.init.headers as Record<string, string> | undefined;
    expect(headers?.authkey).toBe('test-auth-key');
  });

  it('treats an HTTP 200 error body as a failure', async () => {
    const provider = new Msg91OtpProvider(
      config,
      fakeFetch(200, { type: 'error', message: 'The provided flow ID or template ID is invalid.' }),
    );
    const result = await provider.sendCode({
      phoneE164: '+919800000001',
      code: '1',
      expiresInMinutes: 5,
    });
    expect(result).toEqual({
      delivered: false,
      retryable: false,
      reason: 'MSG91 rejected the template ID.',
    });
  });

  it('marks network failures as retryable without leaking details', async () => {
    const provider = new Msg91OtpProvider(config, async () => {
      throw new Error('ECONNRESET secret-host');
    });
    const result = await provider.sendCode({
      phoneE164: '+919800000001',
      code: '1',
      expiresInMinutes: 5,
    });
    expect(result).toEqual({
      delivered: false,
      retryable: true,
      reason: 'MSG91 could not be reached.',
    });
  });
});
