import { calendarDateInTimeZone } from '@lintel/shared';
import { createDatabaseConnection } from '../src/client';
import { createTaskFixture } from './fixtures/task-fixture';

/** Development only: inserts the task fixture into DATABASE_URL and prints its IDs as JSON. */
async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') throw new Error('Never run fixtures in production.');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required.');
  const connection = createDatabaseConnection(url, { max: 2 });
  try {
    const today = calendarDateInTimeZone(new Date(), 'Asia/Kolkata');
    const fixture = await createTaskFixture(connection.db, today);
    console.info(JSON.stringify(fixture, null, 2));
  } finally {
    await connection.close();
  }
}

main().catch((error: unknown) => {
  console.error('Fixture failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
