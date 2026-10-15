// @ts-check
/**
 * Stage 9P's Definition of Done (documentation/desktop/plan.md): the built preview installer, installed silently
 * into a folder of its own, makes a site on its own fake GitHub with the engine and git it carries, then
 * uninstalls. Run on demand, after `npm run dist` (it's skipped without an installer):
 *   npx playwright test -c apps/desktop/playwright.config.mjs install.spec.mjs
 */
import { _electron as electron, expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { APP_DIR, pageMatching } from './launch.mjs';

const DIST = join(APP_DIR, 'dist');
const installer = existsSync(DIST) ? readdirSync(DIST).find((f) => /^Atiya-Studio-Setup-.*\.exe$/.test(f)) : undefined;

test.describe('desktop: the preview installer', () => {
  test.skip(process.platform !== 'win32' || !installer, 'needs the Windows installer from npm run dist');
  test.setTimeout(600_000);

  test('9P.3 installed into a folder of its own, the app makes a site with the engine and git it carries, then uninstalls', async () => {
    const root = mkdtempSync(join(tmpdir(), 'atiya-install-'));
    const dir = join(root, 'Atiya Studio');
    // NSIS: /S silent, /D= the folder (last, unquoted)
    const t0 = Date.now();
    execFileSync(join(DIST, /** @type {string} */ (installer)), ['/S', `/D=${dir}`], { stdio: 'ignore', timeout: 300_000 });
    // a person waits for this: well under a minute
    expect(Date.now() - t0).toBeLessThan(90_000);
    const exe = join(dir, 'Atiya Studio.exe');
    expect(existsSync(exe), 'the app is installed where it was asked').toBe(true);
    // the engine as one archive, with its manifest beside it (installed in seconds, not minutes)
    expect(existsSync(join(dir, 'resources', 'engine.tar'))).toBe(true);
    expect(existsSync(join(dir, 'resources', 'engine.json'))).toBe(true);
    const home = join(root, 'home');
    const app = await electron.launch({
      executablePath: exe,
      colorScheme: null,
      env: {
        ...process.env,
        ATIYA_USER_DATA: join(root, 'data'),
        ATIYA_HOME: home,
        ATIYA_BACKGROUND: '1',
        ATIYA_NO_TRAY: '1',
        ATIYA_SUGGEST_DIR: '',
        ATIYA_FAKE_GITHUB: '1',
        ATIYA_FAKE_APPROVE_MS: '500',
        ATIYA_FAKE_BUILD_MS: '1000',
        ATIYA_SITE_PORT: '4471',
        // nothing of this checkout's: the installed app runs on what it carries
        ATIYA_DEV_SERVER: '',
        ATIYA_ENGINE_ROOT: '',
        ATIYA_ENGINE_MANIFEST: '',
      },
    });
    try {
      // packaged: its engine and git are its own
      const where = await app.evaluate(({ app: a }) => ({ packaged: a.isPackaged, resources: process.resourcesPath }));
      expect(where.packaged).toBe(true);
      expect(where.resources.toLowerCase()).toBe(join(dir, 'resources').toLowerCase());

      const welcome = await pageMatching(app, /welcome\.html/);
      await welcome.getByRole('button', { name: 'Make my site' }).click();
      const setup = await pageMatching(app, /setup\.html/);
      await setup.getByRole('button', { name: 'Continue with GitHub' }).click();
      await expect(setup.getByRole('heading', { name: 'Your site' })).toBeVisible({ timeout: 60_000 });
      await setup.getByRole('button', { name: 'Create my site' }).click();
      // edit mode on the engine the app carries (the first start compiles it)
      const editor = await pageMatching(app, /localhost:4471\/_edit\//, 300_000);
      await expect(editor.locator('[data-editor-app]')).toBeVisible({ timeout: 120_000 });
      // the site's folder pins the engine the app carries, and its first commit was made by the git the app carries
      const sites = readdirSync(join(home, 'Atiya'), { withFileTypes: true }).filter((e) => e.isDirectory());
      expect(sites.length).toBe(1);
      const site = join(home, 'Atiya', sites[0].name);
      const pinned = JSON.parse(readFileSync(join(site, 'atiya.json'), 'utf8')).engine;
      const carried = JSON.parse(readFileSync(join(dir, 'resources', 'engine.json'), 'utf8'));
      // unpacked on the first start into the app's own data, under its release's name
      expect(existsSync(join(root, 'data', 'engine', `${carried.version}-${carried.sha256.slice(0, 12)}`, 'engine.json'))).toBe(true);
      expect(pinned).toMatchObject({ version: carried.version, sha256: carried.sha256 });
      const git = join(dir, 'resources', 'git', 'cmd', 'git.exe');
      expect(execFileSync(git, ['-C', site, 'log', '--oneline', '-1'], { encoding: 'utf8' }).trim()).not.toBe('');
    } finally {
      await app.evaluate(({ app: a }) => a.quit()).catch(() => {});
      await app.close().catch(() => {});
    }
    // quitting stops the site's server: its port is free again
    await expect.poll(() => fetch('http://localhost:4471/').then(() => 'answering', () => 'stopped'), { timeout: 30_000 }).toBe('stopped');
    // and it uninstalls
    const uninstaller = readdirSync(dir).find((f) => /^Uninstall .*\.exe$/.test(f));
    expect(uninstaller).toBeTruthy();
    execFileSync(join(dir, /** @type {string} */ (uninstaller)), ['/S'], { stdio: 'ignore', timeout: 120_000 });
    await expect.poll(() => existsSync(exe), { timeout: 60_000 }).toBe(false);
    // the uninstaller finishes in the background: the test's folder goes when it has (or is left in the temp folder)
    await expect.poll(() => { try { rmSync(root, { recursive: true, force: true }); return true; } catch { return false; } }, { timeout: 60_000 }).toBe(true).catch(() => {});
  });
});
