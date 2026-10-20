import { defineConfig } from 'vitest/config';

/**
 * Integration tests against a real PostgreSQL database (TEST_DATABASE_URL, or
 * DATABASE_URL — never a shared one), one file at a time.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.integration.test.ts', 'src/**/*.integration.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
