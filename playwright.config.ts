import { defineConfig, devices } from '@playwright/test';

const PORT = 4329;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Set PW_CHANNEL=msedge to use the locally installed Edge instead of Playwright's Chromium.
        channel: process.env.PW_CHANNEL || undefined,
        viewport: { width: 1280, height: 800 },
        launchOptions: {
          // Headless WebGL via SwiftShader (Chromium requires an explicit opt-in).
          args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader'],
        },
      },
    },
  ],
  webServer: {
    // Test build: includes the window.__game hook (never present in production builds).
    command: `npm run build:test && npx astro preview --port ${PORT}`,
    url: `http://localhost:${PORT}/`,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
  },
});
