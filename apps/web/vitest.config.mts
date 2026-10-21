import { defineConfig } from 'vitest/config';

/** Unit tests for browser-side logic that needs no DOM (browser APIs are stubbed per test). */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
