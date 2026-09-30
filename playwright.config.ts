import { defineConfig, devices } from '@playwright/test';

const PORT = 4329;
/** Edit mode's own dev server, on a fixture copy of content/ (scripts/editor-test-server.mjs; documentation/editor/plan.md §4). */
const EDITOR_PORT = 4330;

// Each project needs only its own server: the site's groups the test build, the editor its fixture dev
// server. Asking for one project (--project editor, --project=chromium) starts only that one's.
const asked = process.argv.flatMap((a, i, all) => (a.startsWith('--project=') ? [a.slice(10)] : a === '--project' ? [all[i + 1]] : []));
const wants = (name: string) => !asked.length || asked.includes(name);

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
      testIgnore: /editor\.spec\.ts$/,
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
    {
      // edit mode: its screens and API against the fixture (it writes, commits and pushes there, never to content/)
      name: 'editor',
      testMatch: /editor\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'], channel: process.env.PW_CHANNEL || undefined, baseURL: `http://localhost:${EDITOR_PORT}`, viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: [
    ...(wants('chromium')
      ? [
          {
            // Test build: includes the window.__game hook (never present in production builds).
            command: `npm run build:test && npx astro preview --port ${PORT}`,
            url: `http://localhost:${PORT}/`,
            timeout: 240_000,
            reuseExistingServer: !process.env.CI,
          },
        ]
      : []),
    ...(wants('editor')
      ? [
          {
            command: `node scripts/editor-test-server.mjs --port ${EDITOR_PORT}`,
            url: `http://localhost:${EDITOR_PORT}/_edit/`,
            timeout: 240_000,
            reuseExistingServer: !process.env.CI,
          },
        ]
      : []),
  ],
});
