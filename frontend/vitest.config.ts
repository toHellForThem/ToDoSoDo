import { defineConfig } from 'vitest/config';

/** Юнит-тесты чистой логики: Node-окружение без нативных модулей. */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
