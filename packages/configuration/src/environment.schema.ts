import { isValidTimeZone } from '@lintel/shared';
import { z } from 'zod';
import { booleanFlag } from './environment-primitives';
import {
  notificationChannelProblems,
  notificationChannelVariables,
} from './notification-channels.environment';

const DEVELOPMENT_SECRET = 'local-development-secret-change-me-0000000000';

/**
 * Every variable the API and worker read. Production-only rules live in
 * `assertProductionSafety` so local development needs no external accounts.
 */
export const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  WEB_BASE_URL: z.string().url().default('http://localhost:3100'),
  API_BASE_URL: z.string().url().default('http://localhost:4100'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4100),
  BUSINESS_TIMEZONE: z
    .string()
    .refine(isValidTimeZone, 'Unknown IANA timezone')
    .default('Asia/Kolkata'),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:3100'),
  TRUST_PROXY: booleanFlag.default('false'),
  COOKIE_SECURE: booleanFlag.optional(),

  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32).default(DEVELOPMENT_SECRET),

  OTP_PROVIDER: z.enum(['local', 'msg91']).default('local'),
  OTP_DEVELOPMENT_CODE: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
  MSG91_BASE_URL: z.string().url().default('https://control.msg91.com'),
  MSG91_AUTH_KEY: z.string().min(10).optional(),
  MSG91_TEMPLATE_ID: z.string().min(5).optional(),
  MSG91_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(8000),

  STORAGE_ENDPOINT: z.string().url().default('http://127.0.0.1:9110'),
  STORAGE_REGION: z.string().default('us-east-1'),
  STORAGE_BUCKET: z.string().min(3).default('lintel-files'),
  STORAGE_ACCESS_KEY: z.string().min(3).default('lintel-local'),
  STORAGE_SECRET_KEY: z.string().min(8).default('lintel-local-secret'),
  STORAGE_AUTO_CREATE_BUCKET: booleanFlag.default('true'),
  UPLOAD_MAX_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .default(25 * 1024 * 1024),

  TEMPORAL_ENABLED: booleanFlag.default('true'),
  TEMPORAL_ADDRESS: z.string().default('127.0.0.1:7240'),
  TEMPORAL_NAMESPACE: z.string().default('lintel'),
  TEMPORAL_TASK_QUEUE: z.string().default('lintel-main'),

  PUSH_PROVIDER: z.enum(['log', 'fcm']).default('log'),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().email().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),

  SMS_NOTIFICATIONS_ENABLED: booleanFlag.default('false'),
  AI_FEATURES_ENABLED: booleanFlag.default('false'),
  ...notificationChannelVariables,
});

export type Environment = z.infer<typeof environmentSchema>;

export class ConfigurationError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Invalid configuration:\n  - ${problems.join('\n  - ')}`);
    this.name = 'ConfigurationError';
  }
}

function productionProblems(env: Environment): string[] {
  if (env.NODE_ENV !== 'production') return [];
  const checks: [boolean, string][] = [
    [env.SESSION_SECRET === DEVELOPMENT_SECRET, 'SESSION_SECRET must be set.'],
    [env.OTP_PROVIDER !== 'msg91', 'OTP_PROVIDER must be msg91 in production.'],
    [Boolean(env.OTP_DEVELOPMENT_CODE), 'OTP_DEVELOPMENT_CODE is not allowed in production.'],
    [env.STORAGE_SECRET_KEY === 'lintel-local-secret', 'STORAGE_SECRET_KEY must be set.'],
    [env.PUSH_PROVIDER === 'log', 'PUSH_PROVIDER must be fcm in production.'],
    [env.COOKIE_SECURE === false, 'COOKIE_SECURE cannot be false in production.'],
  ];
  return checks.filter(([failed]) => failed).map(([, message]) => message);
}

function providerProblems(env: Environment): string[] {
  const problems: string[] = [];
  if (env.OTP_PROVIDER === 'msg91' && (!env.MSG91_AUTH_KEY || !env.MSG91_TEMPLATE_ID)) {
    problems.push('MSG91_AUTH_KEY and MSG91_TEMPLATE_ID are required when OTP_PROVIDER=msg91.');
  }
  const firebaseReady =
    env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY;
  if (env.PUSH_PROVIDER === 'fcm' && !firebaseReady) {
    problems.push(
      'FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY are required when PUSH_PROVIDER=fcm.',
    );
  }
  return problems;
}

/** Refuses to start production with development adapters or default secrets. */
export function assertProductionSafety(env: Environment): void {
  const problems = [
    ...(env.AI_FEATURES_ENABLED
      ? ['AI_FEATURES_ENABLED must stay false: AI is reserved for Phase 2.']
      : []),
    ...productionProblems(env),
    ...providerProblems(env),
    ...notificationChannelProblems(env),
  ];
  if (problems.length > 0) throw new ConfigurationError(problems);
}

export function loadEnvironment(source: NodeJS.ProcessEnv = process.env): Environment {
  const parsed = environmentSchema.safeParse(source);
  if (!parsed.success) {
    throw new ConfigurationError(
      parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }
  assertProductionSafety(parsed.data);
  return parsed.data;
}
