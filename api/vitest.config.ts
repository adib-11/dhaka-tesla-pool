import { defineConfig } from 'vitest/config';
import { TEST_DATABASE_URL } from './test/test-db-url';

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: 'test-only-secret-that-is-at-least-32-characters',
    },
    globalSetup: './test/global-setup.ts',
    setupFiles: ['./test/setup.ts'],
    fileParallelism: false, // integration files share one database
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
