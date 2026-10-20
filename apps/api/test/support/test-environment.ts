/** Environment for integration tests. Uses the dedicated `lintel_test` database. */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://lintel:lintel-local-only@127.0.0.1:5450/lintel_test';

export function applyTestEnvironment(): void {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
    DATABASE_URL: TEST_DATABASE_URL,
    OTP_PROVIDER: 'local',
    OTP_DEVELOPMENT_CODE: '123456',
    PUSH_PROVIDER: 'log',
    TEMPORAL_ENABLED: 'false',
    STORAGE_AUTO_CREATE_BUCKET: 'false',
  });
}
