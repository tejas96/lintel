import { defineConfig } from 'vitest/config';

/** Unit tests only; tests that need PostgreSQL run with vitest.integration.config.ts. */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.integration.test.ts', 'node_modules/**', 'dist/**'],
  },
});
