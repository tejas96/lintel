#!/usr/bin/env node
// Gives the browser suite a fresh database: creates it when missing, drops
// everything in it, applies every migration, then runs the foundation and demo
// seeds. Refuses any database whose name does not contain "e2e".
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { createDatabaseConnection } = require('@lintel/database');

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required.');
const target = new URL(url);
const name = decodeURIComponent(target.pathname.slice(1));
if (!/e2e/.test(name) || !/^[a-z0-9_]+$/.test(name)) {
  throw new Error(`Refusing to reset "${name}": the end-to-end database name must contain "e2e".`);
}

async function ensureDatabase() {
  const maintenance = new URL(url);
  maintenance.pathname = '/postgres';
  const connection = createDatabaseConnection(maintenance.toString(), { max: 1 });
  try {
    const found = await connection.pool.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      name,
    ]);
    if (found.rowCount === 0) await connection.pool.query(`CREATE DATABASE "${name}"`);
  } finally {
    await connection.close();
  }
}

async function resetSchemas() {
  const connection = createDatabaseConnection(url, { max: 1 });
  try {
    await connection.pool.query(
      'DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;',
    );
  } finally {
    await connection.close();
  }
}

const dist = dirname(require.resolve('@lintel/database'));
function run(script) {
  const result = spawnSync(process.execPath, [join(dist, script)], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error(`${script} failed with exit code ${result.status}.`);
}

await ensureDatabase();
await resetSchemas();
run('migrate.cli.js');
run('seed/seed.cli.js');
run('seed/demo/seed-demo.cli.js');
console.info(`End-to-end database "${name}" is fresh.`);
