import { defineConfig, devices } from '@playwright/test';

const PORT = 5174;
/** Set E2E_BASE_URL (e.g. https://alonkellner.com/5-to-5/) to test a deployed site instead. */
const remote = process.env['E2E_BASE_URL'];

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  // Generating puzzles is CPU-bound, so tests get generous waits and limited parallelism.
  expect: { timeout: 30_000 },
  fullyParallel: true,
  workers: process.env['CI'] ? 2 : 4,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL: remote ?? `http://localhost:${PORT}/5-to-5/`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'] } },
  ],
  webServer: remote
    ? undefined
    : {
        command: `npx vite --port ${PORT} --strictPort --open false`,
        url: `http://localhost:${PORT}/5-to-5/`,
        reuseExistingServer: !process.env['CI'],
      },
});
