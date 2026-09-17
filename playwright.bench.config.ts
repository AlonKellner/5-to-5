import { defineConfig } from '@playwright/test';
import base from './playwright.config';

/** In-browser generator benchmarks: npm run bench:browser */
export default defineConfig({
  ...base,
  testMatch: '**/*.bench.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
});
