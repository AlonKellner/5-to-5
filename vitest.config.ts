import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/main.ts', 'src/worker/generator.worker.ts'],
      reporter: ['text', 'html'],
      thresholds: { statements: 90, branches: 85, functions: 90, lines: 90 },
    },
  },
});
