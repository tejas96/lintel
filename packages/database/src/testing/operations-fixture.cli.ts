import { createDatabaseConnection } from '../client';
import { seedOperationsFixture } from './operations-fixture';

/**
 * Loads the leave/capacity/rewards development fixture into a local database:
 * `DATABASE_URL=… pnpm --filter @lintel/database exec tsx src/testing/operations-fixture.cli.ts`
 */
async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The development fixture must never run in production.');
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required.');
  const connection = createDatabaseConnection(url, { max: 2 });
  try {
    const outcome = await seedOperationsFixture(connection.db);
    console.info(outcome === 'created' ? 'Operations fixture loaded.' : 'Fixture already present.');
  } finally {
    await connection.close();
  }
}

main().catch((error: unknown) => {
  console.error('Fixture failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
