import { describe, expect, it } from 'vitest';
import { ConfigurationError, loadEnvironment } from './environment.schema';

const base = { DATABASE_URL: 'postgres://u:p@localhost:5450/lintel' };

describe('environment configuration', () => {
  it('starts locally with no external credentials', () => {
    const env = loadEnvironment(base);
    expect(env.OTP_PROVIDER).toBe('local');
    expect(env.PUSH_PROVIDER).toBe('log');
    expect(env.AI_FEATURES_ENABLED).toBe(false);
  });

  it('refuses development adapters and default secrets in production', () => {
    try {
      loadEnvironment({ ...base, NODE_ENV: 'production' });
      throw new Error('expected failure');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      const problems = (error as ConfigurationError).problems.join(' ');
      expect(problems).toContain('SESSION_SECRET');
      expect(problems).toContain('OTP_PROVIDER must be msg91');
      expect(problems).toContain('PUSH_PROVIDER must be fcm');
    }
  });

  it('keeps AI disabled in Phase 1', () => {
    expect(() => loadEnvironment({ ...base, AI_FEATURES_ENABLED: 'true' })).toThrow(/Phase 2/);
  });

  it('requires MSG91 credentials when MSG91 is selected', () => {
    expect(() => loadEnvironment({ ...base, OTP_PROVIDER: 'msg91' })).toThrow(/MSG91_AUTH_KEY/);
  });
});
