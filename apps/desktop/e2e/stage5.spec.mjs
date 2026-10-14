// @ts-check
/** Stage 5's Definition of Done (documentation/desktop/plan.md): the token kept across a restart, and private pages on first use, on the fake GitHub. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startFakeGitHub } from '../src/core/setup/fake-github.mjs';
import { launchSetup, pageMatching, quitGracefully } from './launch.mjs';

/** @param {import('@playwright/test').ElectronApplication} app */
const quit = async (app) => {
  await app.evaluate(({ app: a }) => a.quit()).catch(() => {});
  await app.close().catch(() => {});
};
const fake = () => startFakeGitHub({ root: join(mkdtempSync(join(tmpdir(), 'atiya-e2e5-')), 'remotes'), buildMs: 800, deviceApproveAfterMs: 300, deviceInterval: 0 });

/** Makes a site through the first run and waits for edit mode. @param {Awaited<ReturnType<typeof launchSetup>>['app']} app */
async function makeSite(app) {
  const welcome = await pageMatching(app, /welcome\.html/);
  await welcome.getByRole('button', { name: 'Make my site' }).click();
  const setup = await pageMatching(app, /setup\.html/);
  await setup.getByRole('button', { name: 'Continue with GitHub' }).click();
  await setup.getByRole('button', { name: 'Create my site' }).click({ timeout: 20_000 });
  return pageMatching(app, /localhost:4381\/_edit\//, 30_000);
}

/** @param {string} dir @returns {string[]} */
const walk = (dir) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)])) : []);

test.describe('desktop: GitHub and private pages', () => {
  test('5.3 the token is kept only through the keychain, and still works after a restart', async () => {
    const gh = await fake();
    const first = await launchSetup({ fakeUrl: gh.url });
    try {
      await makeSite(first.app);
    } finally {
      await quitGracefully(first.app);
    }
    const file = join(first.root, 'data', 'github-token.fake.bin');
    expect(existsSync(file)).toBe(true);
    // the key it's encrypted with is kept by Chromium in Local State, written on a graceful quit
    expect(JSON.parse(readFileSync(join(first.root, 'data', 'Local State'), 'utf8')).os_crypt?.encrypted_key).toBeTruthy();
    // DPAPI's output: nothing of the token in the clear, here or in any other file the app or setup wrote
    expect(readFileSync(file).includes('fake-ada')).toBe(false);
    expect(walk(first.root).filter((f) => readFileSync(f).includes('fake-ada'))).toEqual([]);
    const again = await launchSetup({ fakeUrl: gh.url, root: first.root });
    try {
      await pageMatching(again.app, /localhost:4381\/_edit\//, 30_000);
      const frame = await pageMatching(again.app, /frame\.html/);
      await frame.getByRole('button', { name: 'Check my site' }).click();
      const check = await pageMatching(again.app, /check\.html/);
      // GitHub's own checks pass only with the token the first run kept
      await expect(check.locator('li[data-check="repository"]')).toHaveAttribute('data-ok', 'true', { timeout: 20_000 });
    } finally {
      await quit(again.app);
      await gh.close();
    }
  });

  test('5.4 edit mode\'s link sets up private pages: a private repository, a read-only key sealed into the site, the submodule', async () => {
    const gh = await fake();
    const { app } = await launchSetup({ fakeUrl: gh.url });
    try {
      const editor = await makeSite(app);
      // edit mode's "set up private pages" link: the dev server's page may open this one app page
      await editor.evaluate(() => {
        location.href = 'app://ui/private.html';
      });
      const page = await pageMatching(app, /private\.html/);
      await expect(page.getByRole('heading', { name: 'Set up private pages' })).toBeVisible();
      await expect(page.locator('#summary')).toHaveText('Keep some pages for the people you choose.');
      await expect(page.getByRole('button', { name: 'Set up private pages' })).toBeFocused();
      for (const scheme of /** @type {const} */ (['light', 'dark'])) {
        await page.emulateMedia({ colorScheme: scheme });
        const r = await new AxeBuilder({ page }).setLegacyMode(true).analyze();
        expect(r.violations.map((v) => `${scheme}: ${v.id}`)).toEqual([]);
      }
      expect(await page.evaluate(() => document.body.innerText)).not.toMatch(/\bgit\b|submodule|terminal|[A-Z]:\\/i);

      await page.getByRole('button', { name: 'Set up private pages' }).click();
      await expect(page.locator('#summary')).toHaveText('Private pages are ready. Edit mode starts again to bring them in.', { timeout: 30_000 });
      await expect(page.locator('#steps li[data-state="done"]')).toHaveCount(4);

      const priv = /** @type {any} */ (gh.repos.get('ada/ada.github.io-private'));
      expect(priv.private).toBe(true);
      expect(priv.keys).toHaveLength(1);
      expect(priv.keys[0].read_only).toBe(true);
      expect(/** @type {any} */ (gh.repos.get('ada/ada.github.io')).secrets.get('PRIVATE_CONTENT_KEY')).toMatch(/^-----BEGIN OPENSSH PRIVATE KEY-----/);

      await page.getByRole('button', { name: 'Back to edit mode' }).click();
      const back = await pageMatching(app, /localhost:4381\/_edit\//, 30_000);
      await expect(back.locator('h1')).toHaveText('Edit mode (stand-in) for Ada Lovelace');
      await back.evaluate(() => {
        location.href = 'app://ui/private.html';
      });
      const again = await pageMatching(app, /private\.html/);
      await expect(again.locator('#summary')).toHaveText('Your private pages are set up.');
    } finally {
      await quit(app);
      await gh.close();
    }
  });
});
