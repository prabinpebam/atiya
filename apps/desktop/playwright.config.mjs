// @ts-check
import { defineConfig } from '@playwright/test';

/** The app's own E2E tests: Playwright's Electron support, one app at a time, nothing on port 4321. */
export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.mjs$/,
  timeout: 90_000,
  workers: 1,
  fullyParallel: false,
  reporter: [['line']],
  use: { trace: 'retain-on-failure' },
});
