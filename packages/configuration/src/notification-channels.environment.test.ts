import { describe, expect, it } from 'vitest';
import { ConfigurationError, loadEnvironment } from './environment.schema';
import { smtpUsesImplicitTls } from './notification-channels.environment';

const base = { DATABASE_URL: 'postgres://u:p@localhost:5450/lintel' };

/** A production configuration that passes every non-channel check. */
const production = {
  ...base,
  NODE_ENV: 'production',
  SESSION_SECRET: 'a-real-secret-that-is-long-enough-for-production-use',
  OTP_PROVIDER: 'msg91',
  MSG91_AUTH_KEY: 'auth-key-0123456789',
  MSG91_TEMPLATE_ID: 'otp-template-1',
  STORAGE_SECRET_KEY: 'a-real-storage-secret',
  PUSH_PROVIDER: 'fcm',
  FIREBASE_PROJECT_ID: 'lintel-test',
  FIREBASE_CLIENT_EMAIL: 'push@lintel-test.iam.gserviceaccount.com',
  FIREBASE_PRIVATE_KEY: 'key',
  WEB_BASE_URL: 'https://studio.example.com',
};

function problemsOf(source: Record<string, string>): string {
  try {
    loadEnvironment(source);
    return '';
  } catch (error) {
    if (!(error instanceof ConfigurationError)) throw error;
    return error.problems.join(' ');
  }
}

describe('notification channel configuration', () => {
  it('keeps SMS and email off with development adapters by default', () => {
    const env = loadEnvironment(base);
    expect(env.SMS_NOTIFICATIONS_ENABLED).toBe(false);
    expect(env.SMS_PROVIDER).toBe('log');
    expect(env.EMAIL_NOTIFICATIONS_ENABLED).toBe(false);
    expect(env.EMAIL_PROVIDER).toBe('log');
    expect(env.EMAIL_DIGEST_TIME).toBe('18:00');
    expect(env.SMTP_REQUIRE_TLS).toBe(true);
  });

  it('accepts a complete production setup', () => {
    expect(problemsOf(production)).toBe('');
    const full = {
      ...production,
      SMS_NOTIFICATIONS_ENABLED: 'true',
      SMS_PROVIDER: 'msg91',
      MSG91_SMS_TEMPLATE_ID: 'sms-template-1',
      MSG91_SMS_DLT_TEMPLATE_ID: '1107161234567890123',
      EMAIL_NOTIFICATIONS_ENABLED: 'true',
      EMAIL_PROVIDER: 'smtp',
      SMTP_HOST: 'smtp.example.com',
      SMTP_FROM: 'Lintel <notifications@studio.example.com>',
      SMTP_USER: 'lintel',
      SMTP_PASSWORD: 'smtp-password',
    };
    expect(problemsOf(full)).toBe('');
  });

  it('refuses the development SMS and email adapters in production', () => {
    const problems = problemsOf({
      ...production,
      SMS_NOTIFICATIONS_ENABLED: 'true',
      EMAIL_NOTIFICATIONS_ENABLED: 'true',
    });
    expect(problems).toContain('SMS_PROVIDER must be msg91');
    expect(problems).toContain('EMAIL_PROVIDER must be smtp');
  });

  it('requires https links in production when messages leave the app', () => {
    const problems = problemsOf({
      ...production,
      WEB_BASE_URL: 'http://localhost:3100',
      EMAIL_NOTIFICATIONS_ENABLED: 'true',
      EMAIL_PROVIDER: 'smtp',
      SMTP_HOST: 'smtp.example.com',
      SMTP_FROM: 'notifications@studio.example.com',
    });
    expect(problems).toContain('WEB_BASE_URL must be the public https://');
  });

  it('refuses SMTP without TLS in production', () => {
    const problems = problemsOf({
      ...production,
      EMAIL_PROVIDER: 'smtp',
      SMTP_HOST: 'smtp.example.com',
      SMTP_FROM: 'notifications@studio.example.com',
      SMTP_REQUIRE_TLS: 'false',
    });
    expect(problems).toContain('SMTP must use TLS');
  });

  it('requires the MSG91 SMS template and its DLT ID when MSG91 sends SMS', () => {
    const problems = problemsOf({
      ...base,
      SMS_PROVIDER: 'msg91',
      MSG91_AUTH_KEY: 'key-0123456789',
    });
    expect(problems).toContain('MSG91_SMS_TEMPLATE_ID and MSG91_SMS_DLT_TEMPLATE_ID');
    expect(problemsOf({ ...base, MSG91_SMS_DLT_TEMPLATE_ID: 'not-numeric' })).toContain(
      'DLT template IDs are numeric',
    );
  });

  it('validates the SMTP settings', () => {
    expect(problemsOf({ ...base, EMAIL_PROVIDER: 'smtp' })).toContain('SMTP_HOST and SMTP_FROM');
    expect(problemsOf({ ...base, SMTP_USER: 'only-user' })).toContain(
      'SMTP_USER and SMTP_PASSWORD',
    );
    expect(problemsOf({ ...base, SMTP_FROM: 'not an address' })).toContain('Use "Name');
    expect(problemsOf({ ...base, EMAIL_DIGEST_TIME: '25:00' })).toContain('HH:mm');
  });

  it('uses implicit TLS for port 465 unless told otherwise', () => {
    expect(smtpUsesImplicitTls({ SMTP_PORT: 465, SMTP_SECURE: undefined })).toBe(true);
    expect(smtpUsesImplicitTls({ SMTP_PORT: 587, SMTP_SECURE: undefined })).toBe(false);
    expect(smtpUsesImplicitTls({ SMTP_PORT: 2465, SMTP_SECURE: true })).toBe(true);
  });
});
