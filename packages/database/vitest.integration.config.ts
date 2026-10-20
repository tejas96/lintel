import { defineConfig } from 'vitest/config';

/** Integration tests run against a real PostgreSQL (DATABASE_URL), one file at a time. */
export default defineConfig({
  test: {
    include: ['test/**/*.integration.test.ts'],
    testTimeout: 30_000,
    fileParallelism: false,
  },
});
