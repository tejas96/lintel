import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

/**
 * Where the browser suite runs. Ports and the database are its own (never the
 * development ones); object storage is shared with a separate bucket.
 */
const repositoryRoot = resolve(__dirname, '../../..');

/** Only the object-storage credentials are taken from a local .env (they match infra:up). */
function localStorageCredentials(): Record<string, string> {
  const file = resolve(repositoryRoot, '.env');
  if (!existsSync(file)) return {};
  const values = parseEnv(readFileSync(file, 'utf8'));
  const picked: Record<string, string> = {};
  for (const key of ['STORAGE_ENDPOINT', 'STORAGE_ACCESS_KEY', 'STORAGE_SECRET_KEY']) {
    const value = values[key];
    if (value) picked[key] = value;
  }
  return picked;
}

const apiPort = Number(process.env.E2E_API_PORT ?? 4131);
const webPort = Number(process.env.E2E_WEB_PORT ?? 3131);

export const E2E = {
  repositoryRoot,
  apiPort,
  webPort,
  apiUrl: `http://127.0.0.1:${apiPort}`,
  webUrl: `http://localhost:${webPort}`,
  databaseUrl:
    process.env.E2E_DATABASE_URL ?? 'postgres://lintel:lintel-local-only@127.0.0.1:5450/lintel_e2e',
  /** The development sign-in code the API accepts in this suite. */
  otpCode: '123456',
} as const;

/** The API process environment: test mode, its own port and database, no Temporal. */
export function apiEnvironment(): Record<string, string> {
  return {
    NODE_ENV: 'test',
    LOG_LEVEL: 'warn',
    API_PORT: String(E2E.apiPort),
    API_BASE_URL: E2E.apiUrl,
    WEB_BASE_URL: E2E.webUrl,
    CORS_ALLOWED_ORIGINS: E2E.webUrl,
    DATABASE_URL: E2E.databaseUrl,
    OTP_PROVIDER: 'local',
    OTP_DEVELOPMENT_CODE: E2E.otpCode,
    PUSH_PROVIDER: 'log',
    // Channels on with the development senders, so the settings screens show them.
    SMS_NOTIFICATIONS_ENABLED: 'true',
    SMS_PROVIDER: 'log',
    EMAIL_NOTIFICATIONS_ENABLED: 'true',
    EMAIL_PROVIDER: 'log',
    TEMPORAL_ENABLED: 'false',
    STORAGE_BUCKET: process.env.E2E_STORAGE_BUCKET ?? 'lintel-e2e',
    STORAGE_AUTO_CREATE_BUCKET: 'true',
    ...localStorageCredentials(),
  };
}
