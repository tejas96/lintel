import { defineConfig } from 'vitest/config';

/** Tests against a real PostgreSQL database named by DATABASE_URL (never a shared one). */
export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
