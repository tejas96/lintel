import { runMigrations } from './migrate';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required to run migrations.');
  process.exit(1);
}

runMigrations(url)
  .then(() => console.info('Migrations applied.'))
  .catch((error: unknown) => {
    console.error('Migration failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
