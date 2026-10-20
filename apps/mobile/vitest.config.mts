import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/** Unit tests for the app's pure logic (no React Native runtime needed). */
export default defineConfig({
  resolve: {
    alias: {
      '@lintel/design-system/tokens': fileURLToPath(
        new URL('../../packages/design-system/src/tokens/index.ts', import.meta.url),
      ),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
