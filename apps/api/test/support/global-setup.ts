import { createDatabaseConnection, runMigrations } from '@lintel/database';
import { TEST_DATABASE_URL } from './test-environment';

/** Migrates the test database once and clears data written by earlier runs. */
export default async function setup(): Promise<void> {
  await runMigrations(TEST_DATABASE_URL);
  const connection = createDatabaseConnection(TEST_DATABASE_URL, { max: 1 });
  try {
    await connection.pool.query(
      'TRUNCATE rate_limit_counters, otp_challenges, sessions, idempotency_records, audit_log RESTART IDENTITY CASCADE',
    );
  } finally {
    await connection.close();
  }
}
