import { defineConfig } from 'vitest/config';

/**
 * Integration tests run against the local Temporal dev server (127.0.0.1:7240,
 * namespace "lintel") and the PostgreSQL database in DATABASE_URL. Each test
 * file uses its own task queue so it never collides with a running worker.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.integration.test.ts'],
    testTimeout: 90_000,
    hookTimeout: 90_000,
    fileParallelism: false,
  },
});
