// @ts-check
/** Stage 7C's Definition of Done (documentation/desktop/plan.md): who's signed in, which site is open, signing out. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { cpSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startFakeGitHub } from '../src/core/setup/fake-github.mjs';
import { fakeCheckout, launch, launchSetup, pageMatching } from './launch.mjs';

/** @param {import('@playwright/test').ElectronApplication} app */
const quit = async (app) => {
  await app.evaluate(({ app: a }) => a.quit()).catch(() => {});
  await app.close().catch(() => {});
};

test.describe('desktop: account and sites', () => {
  test('7C.1 the row says who is signed in and which site is open; signing out asks once, forgets the token, and signing in brings it back', async () => {
    const gh = await startFakeGitHub({ root: join(mkdtempSync(join(tmpdir(), 'atiya-e2e-fake-')), 'remotes'), buildMs: 1200, deviceApproveAfterMs: 800, deviceInterval: 0 });
    const { app, root } = await launchSetup({ fakeUrl: gh.url });
    try {
      const welcome = await pageMatching(app, /welcome\.html/);
      await welcome.getByRole('button', { name: 'Make my site' }).click();
      const setup = await pageMatching(app, /setup\.html/);
      await setup.getByRole('button', { name: 'Continue with GitHub' }).click();
      await expect(setup.getByRole('heading', { name: 'Your site' })).toBeVisible({ timeout: 20_000 });
      await setup.getByRole('button', { name: 'Create my site' }).click();
      const editor = await pageMatching(app, /localhost:4381\/_edit\//, 30_000);
      const frame = await pageMatching(app, /frame\.html/);

      // the button: the open site, and who's signed in
      const button = frame.getByRole('button', { name: 'Ada Lovelace, signed in to GitHub as ada' });
      await expect(button).toBeVisible({ timeout: 15_000 });
      await expect(button).toContainText('Ada Lovelace');
      await button.click();
      const panel = frame.getByRole('dialog', { name: 'Your account and sites' });
      await expect(panel).toBeFocused();
      await expect(panel.locator('#who')).toContainText('Ada Lovelace');
      await expect(panel.locator('#who')).toContainText('@ada');
      // a site made by the app saves with the app's account, so no note about the computer's git
      await expect(panel.locator('#pushes-note')).toBeHidden();
      const sites = panel.getByRole('list', { name: 'Your sites' });
      await expect(sites.getByRole('button')).toHaveCount(1);
      await expect(sites.getByRole('button').first()).toHaveAttribute('aria-current', 'true');
      await expect(sites.getByRole('button').first()).toContainText('Ada Lovelace');
      for (const scheme of /** @type {const} */ (['light', 'dark'])) {
        await frame.emulateMedia({ colorScheme: scheme });
        const r = await new AxeBuilder({ page: frame }).setLegacyMode(true).disableRules(['landmark-one-main']).analyze();
        expect(r.violations.map((v) => `${scheme}: ${v.id}`)).toEqual([]);
      }

      // signing out asks once, inline; staying keeps it
      await panel.getByRole('button', { name: 'Sign out' }).click();
      await expect(panel.getByText("Sign out of GitHub on this computer? The GitHub CLI signs out too, and you'll need to sign in again to save to remote.")).toBeVisible();
      await expect(panel.getByRole('button', { name: 'Stay signed in' })).toBeFocused();
      await panel.getByRole('button', { name: 'Stay signed in' }).click();
      await expect(panel.getByRole('button', { name: 'Sign out' })).toBeFocused();
      await panel.getByRole('button', { name: 'Sign out' }).click();
      await panel.locator('#sign-out-yes').click();
      await expect(panel.locator('#who')).toHaveText('Not signed in to GitHub.');
      await expect(panel.getByRole('button', { name: 'Sign in with GitHub' })).toBeFocused();
      await expect(frame.getByRole('button', { name: 'Ada Lovelace, not signed in to GitHub' })).toBeVisible();
      // one sign-in for the computer: the GitHub CLI (the stand-in's keychain) signed out too
      expect(existsSync(join(root, 'data', 'gh-fake', 'fake-token'))).toBe(false);
      // the site's server starts again without the token, and edit mode comes back
      await expect.poll(() => editor.url(), { timeout: 30_000 }).toMatch(/localhost:4381\/_edit\//);

      // signing in again: GitHub's code in setup's page, then back to edit mode, signed in
      await panel.getByRole('button', { name: 'Sign in with GitHub' }).click();
      await expect(frame.getByRole('button', { name: 'Ada Lovelace, signed in to GitHub as ada' })).toBeVisible({ timeout: 20_000 });
      await expect.poll(() => editor.url(), { timeout: 20_000 }).toMatch(/localhost:4381\/_edit\//);
      expect(existsSync(join(root, 'data', 'gh-fake', 'fake-token'))).toBe(true);
    } finally {
      await quit(app);
      await gh.close();
    }
  });

  test('7C.2 every remembered site is listed with the open one marked, and choosing another opens it', async () => {
    const root = mkdtempSync(join(tmpdir(), 'atiya-e2e-sites-'));
    const first = fakeCheckout(root);
    const second = join(root, 'second');
    cpSync(first, second, { recursive: true });
    writeFileSync(join(second, 'content', 'site.json'), JSON.stringify({ name: 'Second Site' }));
    mkdirSync(join(root, 'data'), { recursive: true });
    writeFileSync(
      join(root, 'data', 'settings.json'),
      JSON.stringify({ workspaces: [{ kind: 'developer', path: first, name: 'Test Site' }, { kind: 'developer', path: second, name: 'Second Site' }], current: first, keepInTray: true }),
    );
    const { app } = await launch({ root, port: 4416 });
    try {
      const frame = await pageMatching(app, /frame\.html/);
      await pageMatching(app, /localhost:4416\/_edit\//, 30_000);
      const button = frame.getByRole('button', { name: /^Test Site, / });
      await expect(button).toBeVisible();
      await button.click();
      const panel = frame.getByRole('dialog', { name: 'Your account and sites' });
      // signed out here, and a source checkout says it saves with the computer's own git sign-in
      await expect(panel.locator('#who')).toHaveText('Not signed in to GitHub.');
      await expect(panel.locator('#pushes-note')).toBeVisible();
      const sites = panel.getByRole('list', { name: 'Your sites' }).getByRole('button');
      await expect(sites).toHaveCount(2);
      await expect(sites.nth(0)).toHaveAttribute('aria-label', 'Test Site, Source checkout: checkout, open now');
      await expect(sites.nth(1)).toHaveAttribute('aria-label', 'Second Site, Source checkout: second');
      await sites.nth(1).click();
      await expect(panel).toBeHidden();
      await expect(frame.getByRole('button', { name: /^Second Site, / })).toBeVisible({ timeout: 30_000 });
      await expect.poll(() => app.evaluate(({ BaseWindow }) => BaseWindow.getAllWindows()[0].getTitle())).toBe('Second Site · Atiya Studio');
      await frame.getByRole('button', { name: /^Second Site, / }).click();
      await expect(panel.getByRole('list', { name: 'Your sites' }).getByRole('button').first()).toHaveAttribute('aria-label', 'Second Site, Source checkout: second, open now');
    } finally {
      await quit(app);
    }
  });
});
