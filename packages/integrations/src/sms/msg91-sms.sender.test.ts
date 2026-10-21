import { describe, expect, it } from 'vitest';
import { DevelopmentSmsSender } from './development-sms.sender';
import { Msg91SmsSender } from './msg91-sms.sender';

const config = {
  baseUrl: 'https://control.msg91.com',
  authKey: 'test-auth-key',
  templateId: 'sms-tpl-1',
  dltTemplateId: '1107161234567890123',
  timeoutMs: 2000,
};

const message = {
  phoneE164: '+919800000001',
  link: 'https://studio.example.com/leave/abc',
  reference: 'delivery-1',
};

type Call = { url: string; init: RequestInit };

function fakeFetch(status: number, body: unknown, calls: Call[] = []) {
  return async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };
}

describe('MSG91 SMS sender', () => {
  it('posts the documented flow request with only the link as a variable', async () => {
    const calls: Call[] = [];
    const sender = new Msg91SmsSender(
      config,
      fakeFetch(200, { type: 'success', message: '5e1e93cad6fc054d8e759a5b' }, calls),
    );
    const result = await sender.send(message);
    expect(result).toEqual({ outcome: 'sent', providerMessageId: '5e1e93cad6fc054d8e759a5b' });
    expect(calls[0]?.url).toBe('https://control.msg91.com/api/v5/flow');
    expect(calls[0]?.init.method).toBe('POST');
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers.authkey).toBe('test-auth-key');
    expect(headers['content-type']).toBe('application/json');
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      template_id: 'sms-tpl-1',
      short_url: '0',
      realTimeResponse: '1',
      recipients: [{ mobiles: '919800000001', link: 'https://studio.example.com/leave/abc' }],
    });
    expect(sender.templateReference).toBe('sms-tpl-1 (DLT 1107161234567890123)');
  });

  it('treats an HTTP 200 error body as a permanent, mapped failure', async () => {
    const sender = new Msg91SmsSender(
      config,
      fakeFetch(200, { type: 'error', message: 'DLT Template Id missing for +919800000001' }),
    );
    const result = await sender.send(message);
    expect(result).toEqual({
      outcome: 'permanent_failure',
      reason: 'MSG91 rejected the DLT registration of the template.',
    });
    expect(JSON.stringify(result)).not.toContain('9800000001');
  });

  it('retries outages, rate limits and network failures', async () => {
    const outage = new Msg91SmsSender(config, fakeFetch(503, {}));
    expect((await outage.send(message)).outcome).toBe('retryable_failure');
    const limited = new Msg91SmsSender(config, fakeFetch(429, { type: 'error' }));
    expect(await limited.send(message)).toEqual({
      outcome: 'retryable_failure',
      reason: 'MSG91 rate limit reached.',
    });
    const offline = new Msg91SmsSender(config, async () => {
      throw new Error('ECONNRESET secret-host');
    });
    expect(await offline.send(message)).toEqual({
      outcome: 'retryable_failure',
      reason: 'MSG91 could not be reached.',
    });
  });

  it('rejects a bad auth key permanently', async () => {
    const sender = new Msg91SmsSender(config, fakeFetch(401, { message: 'Unauthorized' }));
    expect(await sender.send(message)).toEqual({
      outcome: 'permanent_failure',
      reason: 'MSG91 rejected the auth key.',
    });
  });
});

describe('development SMS sender', () => {
  it('records the generic text with a masked number and never claims delivery', async () => {
    const lines: string[] = [];
    const sender = new DevelopmentSmsSender({ info: (line) => lines.push(line) }, 'development');
    const result = await sender.send(message);
    expect(result.outcome).toBe('not_configured');
    expect(lines[0]).toContain('+91 •••••• 0001');
    expect(lines[0]).toContain('https://studio.example.com/leave/abc');
    expect(lines[0]).not.toContain('9800000001');
  });

  it('refuses to exist in production', () => {
    expect(() => new DevelopmentSmsSender({ info: () => undefined }, 'production')).toThrow(
      /production/,
    );
  });
});
