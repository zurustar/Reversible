import { defineConfig } from 'vitest/config';

// Isolated config for the dev-only audio probes (kept out of `npm test` / build).
export default defineConfig({
  test: {
    include: ['tools/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30000,
  },
});
