import { createDatabaseConnection } from '../../client';
import { seedDemoProjects } from './seed-demo';

/** `pnpm --filter @lintel/database db:seed:demo` — development only, safe to repeat. */
async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The demo seed must never run in production.');
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required.');
  const connection = createDatabaseConnection(url, { max: 2 });
  try {
    const { created, skipped } = await seedDemoProjects(connection.db);
    for (const project of created) console.info(`Created ${project}`);
    if (skipped.length > 0) console.info(`Already present, left unchanged: ${skipped.join(', ')}`);
    console.info(`Demo seed finished: ${created.length} created, ${skipped.length} skipped.`);
  } finally {
    await connection.close();
  }
}

main().catch((error: unknown) => {
  console.error('Demo seed failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
