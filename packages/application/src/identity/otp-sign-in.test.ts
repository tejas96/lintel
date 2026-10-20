import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { RecordStore } from '../common/record.store';
import type { OtpDeliveryRequest, OtpProvider } from '../ports/otp-provider.port';
import type { RandomSource, SecretHasher } from '../ports/security.port';
import { InMemoryIdentityStore } from '../testing/in-memory-identity.store';
import { AuthenticateSessionQuery } from './authenticate-session.query';
import { DEFAULT_OTP_POLICY } from './otp-policy';
import { RequestOtpCommand } from './request-otp.command';
import { VerifyOtpCommand } from './verify-otp.command';

const hasher: SecretHasher = {
  hash: (value) => createHmac('sha256', 'test-key').update(value).digest('hex'),
  matches: (value, expected) =>
    createHmac('sha256', 'test-key').update(value).digest('hex') === expected,
};
const random: RandomSource = { numericCode: () => '482913', token: () => 't'.repeat(43) };
const records: RecordStore = {
  appendActivity: async () => {},
  appendAudit: async () => {},
  enqueueEvent: async () => {},
};
const client = { ipAddress: '10.0.0.1', userAgent: 'test', requestId: 'r1' };

function setup() {
  let now = new Date('2026-10-21T10:00:00Z');
  const clock = { now: () => new Date(now.getTime()) };
  const store = new InMemoryIdentityStore();
  store.now = clock.now;
  const sent: OtpDeliveryRequest[] = [];
  const provider: OtpProvider = {
    name: 'test',
    isDevelopmentOnly: true,
    sendCode: async (request) => {
      sent.push(request);
      return { delivered: true, providerReference: null };
    },
  };
  const requestOtp = new RequestOtpCommand(
    store,
    provider,
    hasher,
    random,
    clock,
    DEFAULT_OTP_POLICY,
  );
  const verifyOtp = new VerifyOtpCommand(store, records, hasher, random, clock, DEFAULT_OTP_POLICY);
  const advance = (seconds: number) => {
    now = new Date(now.getTime() + seconds * 1000);
  };
  return { store, sent, requestOtp, verifyOtp, advance, clock };
}

describe('OTP sign-in', () => {
  it('signs in an active member and stores only hashes', async () => {
    const { store, sent, requestOtp, verifyOtp, clock } = setup();
    store.addUser({ phoneE164: '+919800000001' });
    await requestOtp.execute({ phoneE164: '+919800000001', client });
    expect(sent).toHaveLength(1);
    expect(store.challenges[0]?.codeHash).not.toContain('482913');
    const result = await verifyOtp.execute({
      phoneE164: '+919800000001',
      code: '482913',
      sessionClient: 'web',
      client,
    });
    expect(store.sessions[0]?.tokenHash).not.toBe(result.sessionToken);
    const auth = await new AuthenticateSessionQuery(store, hasher, clock).execute(
      result.sessionToken,
    );
    expect(auth?.actor.userId).toBe(result.user.id);
  });

  it('answers unknown numbers exactly like known ones but sends nothing', async () => {
    const { sent, requestOtp } = setup();
    const response = await requestOtp.execute({ phoneE164: '+919800000099', client });
    expect(response.maskedPhone).toBe('+91 •••••• 0099');
    expect(sent).toHaveLength(0);
  });

  it('enforces the resend cooldown', async () => {
    const { store, requestOtp, advance } = setup();
    store.addUser({ phoneE164: '+919800000001' });
    await requestOtp.execute({ phoneE164: '+919800000001', client });
    await expect(requestOtp.execute({ phoneE164: '+919800000001', client })).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
    advance(31);
    await expect(requestOtp.execute({ phoneE164: '+919800000001', client })).resolves.toBeDefined();
  });

  it('locks the challenge after too many wrong codes', async () => {
    const { store, requestOtp, verifyOtp } = setup();
    store.addUser({ phoneE164: '+919800000001' });
    await requestOtp.execute({ phoneE164: '+919800000001', client });
    for (let attempt = 0; attempt < DEFAULT_OTP_POLICY.maxVerifyAttempts; attempt += 1) {
      await expect(
        verifyOtp.execute({
          phoneE164: '+919800000001',
          code: '000000',
          sessionClient: 'web',
          client,
        }),
      ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    }
    await expect(
      verifyOtp.execute({
        phoneE164: '+919800000001',
        code: '482913',
        sessionClient: 'web',
        client,
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('rejects expired and reused codes', async () => {
    const { store, requestOtp, verifyOtp, advance } = setup();
    store.addUser({ phoneE164: '+919800000001' });
    await requestOtp.execute({ phoneE164: '+919800000001', client });
    await verifyOtp.execute({
      phoneE164: '+919800000001',
      code: '482913',
      sessionClient: 'mobile',
      client,
    });
    await expect(
      verifyOtp.execute({
        phoneE164: '+919800000001',
        code: '482913',
        sessionClient: 'mobile',
        client,
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    advance(60);
    await requestOtp.execute({ phoneE164: '+919800000001', client });
    advance(DEFAULT_OTP_POLICY.expiryMinutes * 60 + 1);
    await expect(
      verifyOtp.execute({
        phoneE164: '+919800000001',
        code: '482913',
        sessionClient: 'mobile',
        client,
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('refuses deactivated accounts', async () => {
    const { store, requestOtp, verifyOtp } = setup();
    store.addUser({ phoneE164: '+919800000001', status: 'deactivated' });
    await requestOtp.execute({ phoneE164: '+919800000001', client });
    await expect(
      verifyOtp.execute({
        phoneE164: '+919800000001',
        code: '482913',
        sessionClient: 'web',
        client,
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });
});
