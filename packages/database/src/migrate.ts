import { dirname, join } from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDatabaseConnection } from './client';

/** Folder of generated SQL migrations, resolved from both src/ and dist/. */
export const MIGRATIONS_FOLDER = join(dirname(__dirname), 'migrations');

/** Applies pending migrations inside Drizzle's migration lock and bookkeeping table. */
export async function runMigrations(connectionString: string): Promise<void> {
  const connection = createDatabaseConnection(connectionString, { max: 1 });
  try {
    await migrate(connection.db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await connection.close();
  }
}
