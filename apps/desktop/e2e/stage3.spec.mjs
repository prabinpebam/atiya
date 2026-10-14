// @ts-check
/** Stage 3's Definition of Done (documentation/desktop/plan.md): the first run in the app, on the fake GitHub. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ADA, startFakeGitHub } from '../src/core/setup/fake-github.mjs';
import { launchSetup, pageMatching } from './launch.mjs';

/** @param {import('@playwright/test').ElectronApplication} app */
const quit = async (app) => {
  await app.evaluate(({ app: a }) => a.quit()).catch(() => {});
  await app.close().catch(() => {});
};

/** @param {Partial<Parameters<typeof startFakeGitHub>[0]>} [o] */
const fake = (o = {}) => startFakeGitHub({ root: join(mkdtempSync(join(tmpdir(), 'atiya-e2e-fake-')), 'remotes'), buildMs: 1200, deviceApproveAfterMs: 800, deviceInterval: 0, ...o });
/** @param {string} base @param {string} path @param {unknown} body */
const post = (base, path, body) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

/** The words a person can see on a page: no path, no git, no terminal before edit mode (3.7). @param {import('@playwright/test').Page} p */
async function expectNoDeveloperWords(p) {
  const text = await p.evaluate(() => document.body.innerText);
  expect(text).not.toMatch(/\bgit\b|terminal|command line|[A-Z]:\\|\/Users\/|repository|npm/i);
}

test.describe('desktop: first run', () => {
  test('3.1 three choices reach edit mode on the new site, then Going live and Live', async () => {
    const gh = await fake();
    const { app, externals } = await launchSetup({ fakeUrl: gh.url });
    try {
      const welcome = await pageMatching(app, /welcome\.html/);
      await expectNoDeveloperWords(welcome);
      await welcome.getByRole('button', { name: 'Make my site' }).click(); // 1
      const setup = await pageMatching(app, /setup\.html/);
      await expectNoDeveloperWords(setup);
      await setup.getByRole('button', { name: 'Continue with GitHub' }).click(); // 2
      await expect(setup.getByRole('heading', { name: 'Your site' })).toBeVisible({ timeout: 20_000 });
      await expectNoDeveloperWords(setup);
      await setup.getByRole('button', { name: 'Create my site' }).click(); // 3
      const editor = await pageMatching(app, /localhost:4381\/_edit\//, 30_000);
      await expect(editor.locator('h1')).toHaveText('Edit mode (stand-in) for Ada Lovelace');
      const frame = await pageMatching(app, /frame\.html/);
      await expect(frame.locator('#site-name')).toHaveText('Ada Lovelace');
      await expect(frame.locator('#state')).toHaveText(/Going live|Live/);
      await expect(frame.locator('#state')).toHaveText('Live', { timeout: 30_000 });
      await frame.getByRole('button', { name: 'Open my site' }).click();
      await expect.poll(externals).toContain(`${gh.url}/sites/ada/ada.github.io/`);
      expect(gh.writes().map((c) => `${c.method} ${c.path}`)).toEqual(['POST /user/repos', 'POST /repos/ada/ada.github.io/pages']);
    } finally {
      await quit(app);
      await gh.close();
    }
  });

  test('3.2 Continue with GitHub copies the code and opens GitHub\'s page', async () => {
    const gh = await fake({ deviceApproveAfterMs: null });
    const { app, externals, copied } = await launchSetup({ fakeUrl: gh.url });
    try {
      const welcome = await pageMatching(app, /welcome\.html/);
      await welcome.getByRole('button', { name: 'Make my site' }).click();
      const setup = await pageMatching(app, /setup\.html/);
      await setup.getByRole('button', { name: 'Continue with GitHub' }).click();
      await expect(setup.getByRole('heading', { name: 'Paste the code on GitHub' })).toBeVisible();
      await expect(setup.locator('#user-code')).toHaveText('WDJB-MJHT');
      await expect.poll(copied).toEqual(['WDJB-MJHT']);
      await expect.poll(externals).toContain(`${gh.url}/login/device`);
      await expect(setup.locator('#time-left')).toHaveText(/This code works for 1[45] more minutes\./);
      await post(gh.url, '/__fake/approve', {});
      await expect(setup.getByRole('heading', { name: 'Your site' })).toBeVisible({ timeout: 20_000 });
    } finally {
      await quit(app);
      await gh.close();
    }
  });

  test('3.3 Your site is filled in from the profile: name, address, the planet, sample pages', async () => {
    const gh = await fake();
    const { app } = await launchSetup({ fakeUrl: gh.url });
    try {
      const welcome = await pageMatching(app, /welcome\.html/);
      await welcome.getByRole('button', { name: 'Make my site' }).click();
      const setup = await pageMatching(app, /setup\.html/);
      await setup.getByRole('button', { name: 'Continue with GitHub' }).click();
      await expect(setup.getByRole('heading', { name: 'Your site' })).toBeVisible({ timeout: 20_000 });
      await expect(setup.getByLabel('Your name')).toHaveValue('Ada Lovelace');
      await expect(setup.locator('#address')).toHaveText('ada.github.io');
      await expect(setup.getByRole('radio', { name: /little planet/ })).toBeChecked();
      await expect(setup.getByRole('checkbox', { name: /Start with sample pages/ })).toBeChecked();
      await expect(setup.locator('details.more')).not.toHaveAttribute('open', '');
      await setup.locator('details.more summary').click();
      await setup.getByLabel('Address name').fill('portfolio');
      await setup.getByLabel('Address name').press('Tab');
      await expect(setup.locator('#address')).toHaveText('ada.github.io/portfolio');
    } finally {
      await quit(app);
      await gh.close();
    }
  });

  test('3.4 Confirm your email shows only when it\'s needed, and carries on by itself', async () => {
    const gh = await fake({ users: { 'fake-ada': { ...ADA, emailVerified: false } } });
    const { app } = await launchSetup({ fakeUrl: gh.url });
    try {
      const welcome = await pageMatching(app, /welcome\.html/);
      await welcome.getByRole('button', { name: 'Make my site' }).click();
      const setup = await pageMatching(app, /setup\.html/);
      await setup.getByRole('button', { name: 'Continue with GitHub' }).click();
      await expect(setup.getByRole('heading', { name: 'Confirm your email' })).toBeVisible({ timeout: 20_000 });
      await expectNoDeveloperWords(setup);
      await post(gh.url, '/__fake/user', { token: 'fake-ada', patch: { emailVerified: true } });
      await expect(setup.getByRole('heading', { name: 'Your site' })).toBeVisible({ timeout: 10_000 });
    } finally {
      await quit(app);
      await gh.close();
    }
  });

  test('3.5 quitting while Creating, then starting again, carries on where it stopped', async () => {
    const gh = await fake();
    gh.settings.slowCreateMs = 4000;
    const first = await launchSetup({ fakeUrl: gh.url });
    const welcome = await pageMatching(first.app, /welcome\.html/);
    await welcome.getByRole('button', { name: 'Make my site' }).click();
    const setup = await pageMatching(first.app, /setup\.html/);
    await setup.getByRole('button', { name: 'Continue with GitHub' }).click();
    await setup.getByRole('button', { name: 'Create my site' }).click({ timeout: 20_000 });
    await expect(setup.getByRole('heading', { name: 'Creating your site' })).toBeVisible();
    await quit(first.app);
    gh.settings.slowCreateMs = 0;
    const again = await launchSetup({ fakeUrl: gh.url, root: first.root });
    try {
      const editor = await pageMatching(again.app, /localhost:4381\/_edit\//, 40_000);
      await expect(editor.locator('h1')).toHaveText('Edit mode (stand-in) for Ada Lovelace');
      expect(gh.writes().filter((c) => c.path === '/user/repos').length).toBeGreaterThanOrEqual(1);
      expect([...gh.repos.keys()]).toEqual(['ada/ada.github.io']);
    } finally {
      await quit(again.app);
      await gh.close();
    }
  });

  test('3.6 a refusal on GitHub, Actions turned off, and a failed build each say what happened and offer a way on', async () => {
    const denied = await fake({ deviceApproveAfterMs: null });
    const a = await launchSetup({ fakeUrl: denied.url });
    try {
      const welcome = await pageMatching(a.app, /welcome\.html/);
      await welcome.getByRole('button', { name: 'Make my site' }).click();
      const setup = await pageMatching(a.app, /setup\.html/);
      await setup.getByRole('button', { name: 'Continue with GitHub' }).click();
      await expect(setup.locator('#user-code')).toHaveText('WDJB-MJHT');
      await post(denied.url, '/__fake/deny', {});
      await expect(setup.getByRole('heading', { name: 'Connect GitHub' })).toBeVisible({ timeout: 10_000 });
      await expect(setup.locator('[data-phase="connect"] [data-error]')).toHaveText("GitHub wasn't connected. Atiya Studio needs it to keep and publish your site.");
      await expect(setup.getByRole('button', { name: 'Continue with GitHub' })).toBeEnabled();
    } finally {
      await quit(a.app);
      await denied.close();
    }

    for (const [setting, words] of /** @type {const} */ ([['actionsDisabled', /GitHub Actions is off for this account/], ['buildFails', /Your site didn't publish: the step "Build the site" failed\./]])) {
      const gh = await fake();
      gh.settings[setting] = true;
      const b = await launchSetup({ fakeUrl: gh.url });
      try {
        const welcome = await pageMatching(b.app, /welcome\.html/);
        await welcome.getByRole('button', { name: 'Make my site' }).click();
        const setup = await pageMatching(b.app, /setup\.html/);
        await setup.getByRole('button', { name: 'Continue with GitHub' }).click();
        await setup.getByRole('button', { name: 'Create my site' }).click({ timeout: 20_000 });
        const frame = await pageMatching(b.app, /frame\.html/);
        await expect(frame.locator('#state')).toHaveText("Didn't publish", { timeout: 30_000 });
        await frame.getByRole('button', { name: 'See why' }).click();
        const publish = await pageMatching(b.app, /publish\.html/);
        await expect(publish.locator('#message')).toHaveText(words);
        await expect(publish.getByRole('button', { name: 'Try again' })).toBeVisible();
        if (setting === 'buildFails') {
          gh.settings.buildFails = false;
          await publish.getByRole('button', { name: 'Try again' }).click();
          await expect(frame.locator('#state')).toHaveText('Live', { timeout: 30_000 });
        }
      } finally {
        await quit(b.app);
        await gh.close();
      }
    }
  });

  test('3.7 every setup screen passes axe in light and dark, and works by keyboard', async () => {
    const gh = await fake({ deviceApproveAfterMs: null, users: { 'fake-ada': { ...ADA, emailVerified: false } } });
    const { app } = await launchSetup({ fakeUrl: gh.url });
    /** @param {import('@playwright/test').Page} p @param {string} name */
    const axe = async (p, name) => {
      for (const scheme of /** @type {const} */ (['light', 'dark'])) {
        await p.emulateMedia({ colorScheme: scheme });
        const r = await new AxeBuilder({ page: p }).setLegacyMode(true).analyze();
        expect(r.violations.map((v) => `${scheme} ${name}: ${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
      }
    };
    try {
      const welcome = await pageMatching(app, /welcome\.html/);
      await axe(welcome, 'welcome');
      await expect(welcome.getByRole('button', { name: 'Make my site' })).toBeFocused();
      await welcome.keyboard.press('Enter');
      const setup = await pageMatching(app, /setup\.html/);
      await expect(setup.getByRole('heading', { name: 'Connect GitHub' })).toBeVisible();
      await axe(setup, 'connect');
      await expect(setup.getByRole('button', { name: 'Continue with GitHub' })).toBeFocused();
      await setup.keyboard.press('Enter');
      await expect(setup.getByRole('heading', { name: 'Paste the code on GitHub' })).toBeVisible();
      await axe(setup, 'code');
      await post(gh.url, '/__fake/approve', {});
      await expect(setup.getByRole('heading', { name: 'Confirm your email' })).toBeVisible({ timeout: 10_000 });
      await axe(setup, 'email');
      await post(gh.url, '/__fake/user', { token: 'fake-ada', patch: { emailVerified: true } });
      await expect(setup.getByRole('heading', { name: 'Your site' })).toBeVisible({ timeout: 10_000 });
      await axe(setup, 'site');
      await expect(setup.getByRole('button', { name: 'Create my site' })).toBeFocused();
      // keyboard: from the name field to Create my site, through the cards and the switch
      await setup.getByLabel('Your name').focus();
      await setup.keyboard.press('Tab');
      await expect(setup.getByRole('radio', { name: /little planet/ })).toBeFocused();
      await setup.keyboard.press('ArrowDown');
      await expect(setup.getByRole('radio', { name: 'Just the site Clear pages, quick to load. You can add the planet later.' })).toBeChecked();
      await setup.keyboard.press('Tab');
      await expect(setup.getByRole('checkbox', { name: /Start with sample pages/ })).toBeFocused();
    } finally {
      await quit(app);
      await gh.close();
    }
  });
});
