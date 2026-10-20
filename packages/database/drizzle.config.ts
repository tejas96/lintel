import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://lintel:lintel-local-only@127.0.0.1:5450/lintel',
  },
  strict: true,
  verbose: true,
});
