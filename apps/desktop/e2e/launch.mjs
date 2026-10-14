// @ts-check
/** Launching the app for an E2E test: its own data folder, a stand-in server, a fake checkout. */
import { _electron as electron } from '@playwright/test';
import { mkdirSync, mkdtempSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

export const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(APP_DIR, 'package.json'));
export const ELECTRON = /** @type {string} */ (require('electron'));
export const STUB = join(APP_DIR, 'e2e', 'fixtures', 'stub-server.mjs');

/** A folder that passes the checkout check, with a site name. @param {string} root */
export function fakeCheckout(root) {
  const dir = join(root, 'checkout');
  mkdirSync(join(dir, 'node_modules', 'astro', 'bin'), { recursive: true });
  mkdirSync(join(dir, 'content'), { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'personal-site' }));
  writeFileSync(join(dir, 'astro.config.mjs'), 'export default {};\n');
  writeFileSync(join(dir, 'node_modules', 'astro', 'package.json'), JSON.stringify({ name: 'astro', bin: { astro: './bin/astro.mjs' } }));
  writeFileSync(join(dir, 'node_modules', 'astro', 'bin', 'astro.mjs'), '');
  writeFileSync(join(dir, 'content', 'site.json'), JSON.stringify({ name: 'Test Site' }));
  return dir;
}

/**
 * @param {{ port?: number, stubMode?: string, root?: string, suggest?: string | null, env?: Record<string, string> }} [o]
 */
export async function launch(o = {}) {
  const root = o.root ?? mkdtempSync(join(tmpdir(), 'atiya-e2e-'));
  const checkout = existsSync(join(root, 'checkout')) ? join(root, 'checkout') : fakeCheckout(root);
  const externalLog = join(root, 'external.log');
  const port = o.port ?? 4391;
  const app = await electron.launch({
    executablePath: ELECTRON,
    args: [APP_DIR],
    env: {
      ...process.env,
      ATIYA_USER_DATA: join(root, 'data'),
      ATIYA_DEV_SERVER: JSON.stringify({ command: process.execPath, args: [STUB] }),
      ATIYA_DEV_PORT: String(port),
      ATIYA_SUGGEST_DIR: o.suggest === null ? '' : (o.suggest ?? checkout),
      ATIYA_EXTERNAL_LOG: externalLog,
      STUB_MODE: o.stubMode ?? 'ok',
      ...o.env,
    },
  });
  const externals = () => (existsSync(externalLog) ? readFileSync(externalLog, 'utf8').split('\n').filter(Boolean) : []);
  return { app, root, checkout, port, externals };
}

/**
 * The app on a fake GitHub (stage 3): a fresh data folder and home, the stand-in server for edit mode.
 * @param {{ fakeUrl: string, root?: string, env?: Record<string, string> }} o
 */
export async function launchSetup(o) {
  const root = o.root ?? mkdtempSync(join(tmpdir(), 'atiya-e2e-setup-'));
  const externalLog = join(root, 'external.log');
  const clipboardLog = join(root, 'clipboard.log');
  const app = await electron.launch({
    executablePath: ELECTRON,
    args: [APP_DIR],
    env: {
      ...process.env,
      ATIYA_CLIPBOARD_LOG: clipboardLog,
      ATIYA_USER_DATA: join(root, 'data'),
      ATIYA_HOME: join(root, 'home'),
      ATIYA_GITHUB_URL: o.fakeUrl,
      ATIYA_DEV_SERVER: JSON.stringify({ command: process.execPath, args: [STUB] }),
      ATIYA_SITE_PORT: '4381',
      ATIYA_SUGGEST_DIR: '',
      ATIYA_EXTERNAL_LOG: externalLog,
      ATIYA_POLL_MS: '150',
      ATIYA_EMAIL_POLL_MS: '200',
      ATIYA_FIRST_RUN_WAIT_MS: '600',
      GH_TOKEN: '',
      GITHUB_TOKEN: '',
      ...o.env,
    },
  });
  const externals = () => (existsSync(externalLog) ? readFileSync(externalLog, 'utf8').split('\n').filter(Boolean) : []);
  const copied = () => (existsSync(clipboardLog) ? readFileSync(clipboardLog, 'utf8').split('\n').filter(Boolean) : []);
  return { app, root, externals, copied };
}

/**
 * The page whose address matches, once it exists.
 * @param {import('@playwright/test').ElectronApplication} app
 * @param {RegExp} url
 */
export async function pageMatching(app, url, timeout = 30_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    for (const p of app.windows()) if (url.test(p.url())) return p;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`no page matching ${url}; pages: ${app.windows().map((p) => p.url()).join(', ')}`);
}
