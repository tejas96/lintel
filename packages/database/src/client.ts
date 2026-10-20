import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema';

export type Schema = typeof schema;
export type Database = NodePgDatabase<Schema>;
/** The transaction handle Drizzle passes to `db.transaction(async (tx) => …)`. */
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
/** Either the pooled database or an open transaction. Repositories accept both. */
export type DatabaseExecutor = Database | Transaction;

export interface DatabaseConnection {
  readonly db: Database;
  readonly pool: Pool;
  close(): Promise<void>;
}

export function createDatabaseConnection(
  connectionString: string,
  options: Omit<PoolConfig, 'connectionString'> = {},
): DatabaseConnection {
  const pool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000, ...options });
  const db = drizzle(pool, { schema });
  return { db, pool, close: () => pool.end() };
}
