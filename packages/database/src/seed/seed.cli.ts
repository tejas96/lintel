import { createDatabaseConnection } from '../client';
import { seedFoundation } from './seed-foundation';

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The development seed must never run in production.');
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required.');
  const connection = createDatabaseConnection(url, { max: 2 });
  try {
    const people = await seedFoundation(connection.db);
    console.info(`Seeded foundation data for ${people.size} people.`);
  } finally {
    await connection.close();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
