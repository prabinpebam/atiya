import { defineConfig, devices } from '@playwright/test';

const PORT = 4329;
/** Edit mode's own dev server, on a fixture copy of content/ (scripts/editor-test-server.mjs; documentation/editor/plan.md §4). */
const EDITOR_PORT = 4330;

// Each project needs only its own server: the site's groups the test build, the editor its fixture dev
// server. Asking for one project (--project editor, --project=chromium) starts only that one's.
const asked = process.argv.flatMap((a, i, all) => (a.startsWith('--project=') ? [a.slice(10)] : a === '--project' ? [all[i + 1]] : []));
const wants = (name: string) => !asked.length || asked.includes(name);
/** Edit mode's spec files: their own project, on the fixture server. */
const EDITOR_SPECS = /editor(-access|-tests|-perf|-ways|-studio|-find|-services|-theme|-recommendations|-ai)?\.spec\.ts$/;
/** Screenshot comparisons (documentation/site-ui/design-system-review.md WS1): their own project, never in a plain run. */
const VISUAL_SPECS = /visual(-[\w-]+)?\.spec\.ts$/;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // the live reporter: every run shows in edit mode's Tests screen (documentation/editor/test-runs.md)
  reporter: [['list'], ['./tests/reporters/live.ts']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: [EDITOR_SPECS, VISUAL_SPECS],
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
      testMatch: EDITOR_SPECS,
      testIgnore: VISUAL_SPECS,
      use: { ...devices['Desktop Chrome'], channel: process.env.PW_CHANNEL || undefined, baseURL: `http://localhost:${EDITOR_PORT}`, viewport: { width: 1440, height: 900 } },
    },
    {
      // screenshots of every story, the key pages and the game's gallery, compared with committed baselines
      // (made and checked on Windows, locally: no workflow runs the browser tests). `npm run visual:update` rewrites them.
      name: 'visual',
      testMatch: VISUAL_SPECS,
      // a pixel counts as changed past 2% colour distance (the default, 20%, lets a token move one shade unseen:
      // indigo 700 → 600 is about 4.7%); anti-aliasing is still told apart and not counted
      expect: { toHaveScreenshot: { threshold: 0.02 } },
      // a real change fails both tries; a one-off sub-pixel shift of text (a few hundred pixels, seen about once in
      // 1,700 shots) passes the second and is reported as flaky, so it's seen without failing the run
      retries: 1,
      // reduced motion: an entrance (the hero's words rise) can end a fraction of a pixel off, and the design's
      // still state is what's compared; the motion is the components' own concern (their @media rules, tested)
      use: { ...devices['Desktop Chrome'], channel: process.env.PW_CHANNEL || undefined, viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' },
    },
  ],
  // one baseline per platform and spec, beside the specs (tests/e2e/__screenshots__/)
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}-{platform}{ext}',
  webServer: [
    ...(wants('chromium') || wants('visual')
      ? [
          {
            // Test build: includes the window.__game hook (never present in production builds).
            command: `npm run build:test && node scripts/verify-sealed.mjs && npx astro preview --port ${PORT}`,
            url: `http://localhost:${PORT}/`,
            timeout: 240_000,
            reuseExistingServer: !process.env.CI,
            // the server's own lines (the test build's progress) reach the console, so the Tests screen can say what it's doing while it gets ready
            stdout: 'pipe' as const,
          },
        ]
      : []),
    ...(wants('editor') || wants('visual')
      ? [
          {
            command: `node scripts/editor-test-server.mjs --port ${EDITOR_PORT}`,
            url: `http://localhost:${EDITOR_PORT}/_edit/`,
            timeout: 240_000,
            reuseExistingServer: !process.env.CI,
            // the server's own lines (the test build's progress) reach the console, so the Tests screen can say what it's doing while it gets ready
            stdout: 'pipe' as const,
          },
        ]
      : []),
  ],
});
