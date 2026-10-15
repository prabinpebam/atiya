// @ts-check
/** Stage 7's Definition of Done (documentation/desktop/plan.md): managed sites in the app, on the fake GitHub. */
import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startFakeGitHub } from '../src/core/setup/fake-github.mjs';
import { launchSetup, pageMatching } from './launch.mjs';

/** @param {import('@playwright/test').ElectronApplication} app */
const quit = async (app) => {
  await app.evaluate(({ app: a }) => a.quit()).catch(() => {});
  await app.close().catch(() => {});
};
const fake = () => startFakeGitHub({ root: join(mkdtempSync(join(tmpdir(), 'atiya-e2e7-')), 'remotes'), buildMs: 800, deviceApproveAfterMs: 300, deviceInterval: 0 });

/** Makes a site through the first run and waits for edit mode. @param {Awaited<ReturnType<typeof launchSetup>>['app']} app */
async function makeSite(app) {
  const welcome = await pageMatching(app, /welcome\.html/);
  await welcome.getByRole('button', { name: 'Make my site' }).click();
  const setup = await pageMatching(app, /setup\.html/);
  await setup.getByRole('button', { name: 'Continue with GitHub' }).click();
  await setup.getByRole('button', { name: 'Create my site' }).click({ timeout: 20_000 });
  return pageMatching(app, /localhost:4381\/_edit\//, 30_000);
}

test.describe('desktop: managed site', () => {
  test('7.2 the site\'s server answers the app\'s views, and refuses a browser or another program', async () => {
    const gh = await fake();
    const { app } = await launchSetup({ fakeUrl: gh.url });
    try {
      const editor = await makeSite(app);
      await expect(editor.locator('h1')).toHaveText('Edit mode (stand-in) for Ada Lovelace');
      const plain = await fetch('http://localhost:4381/_edit/');
      expect(plain.status).toBe(403);
      expect(await plain.text()).toBe('This site is open in Atiya Studio. Open it there.');
      expect((await fetch('http://localhost:4381/')).status).toBe(403);
      // the site, shown in the app's own view, gets through too
      const frame = await pageMatching(app, /frame\.html/);
      await frame.getByRole('radio', { name: 'Site', exact: true }).click();
      await expect(editor.locator('h1')).toHaveText('Site (stand-in)');
    } finally {
      await quit(app);
      await gh.close();
    }
  });

  test('7.3 a page changed on this computer and another asks which to keep, then opens edit mode with the choice', async () => {
    const gh = await fake();
    const first = await launchSetup({ fakeUrl: gh.url });
    await makeSite(first.app);
    await quit(first.app);
    const dir = join(first.root, 'home', 'Atiya', 'ada.github.io');
    // another computer saves a change to the About page and pushes it
    const other = join(first.root, 'other');
    const remote = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: dir, encoding: 'utf8' }).trim();
    execFileSync('git', ['clone', remote, other]);
    const page = 'content/articles/about-me.json';
    const doc = JSON.parse(readFileSync(join(other, page), 'utf8'));
    writeFileSync(join(other, page), JSON.stringify({ ...doc, title: 'About me, from the laptop' }, null, 2) + '\n');
    execFileSync('git', ['-c', 'user.name=B', '-c', 'user.email=b@b', 'commit', '-am', 'Elsewhere'], { cwd: other });
    execFileSync('git', ['push'], { cwd: other });
    // and this computer saved its own change to it, not yet saved to remote
    writeFileSync(join(dir, page), JSON.stringify({ ...doc, title: 'About me, from the desktop' }, null, 2) + '\n');

    const again = await launchSetup({ fakeUrl: gh.url, root: first.root });
    try {
      const sync = await pageMatching(again.app, /sync\.html/, 30_000);
      await expect(sync.getByRole('heading', { name: 'Changed on two computers' })).toBeVisible();
      await expect(sync.getByRole('group', { name: 'Page: About me, from the desktop, changed here and on another computer' })).toBeVisible();
      await expect(sync.getByRole('button', { name: 'Keep my choices' })).toBeDisabled();
      await sync.getByRole('radio', { name: 'Keep the other' }).check();
      await sync.getByRole('button', { name: 'Keep my choices' }).click();
      const editor = await pageMatching(again.app, /localhost:4381\/_edit\//, 30_000);
      await expect(editor.locator('h1')).toHaveText('Edit mode (stand-in) for Ada Lovelace');
      expect(JSON.parse(readFileSync(join(dir, page), 'utf8')).title).toBe('About me, from the laptop');
      expect(execFileSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' })).toBe('');
    } finally {
      await quit(again.app);
      await gh.close();
    }
  });

  test('7.4 Check my site lists the same checks as atiya doctor, each ok on a live site', async () => {
    const gh = await fake();
    const { app } = await launchSetup({ fakeUrl: gh.url });
    try {
      await makeSite(app);
      const frame = await pageMatching(app, /frame\.html/);
      await expect(frame.locator('#state')).toHaveText('Live', { timeout: 30_000 });
      await frame.getByRole('button', { name: 'Check my site' }).click();
      const check = await pageMatching(app, /check\.html/);
      await expect(check.locator('#summary')).toHaveText('Everything is in order.', { timeout: 20_000 });
      expect(await check.locator('#checks li').evaluateAll((els) => els.map((e) => e.getAttribute('data-check')))).toEqual(['atiya.json', 'content', 'repository', 'saved', 'pushed', 'built', 'publishing']);
      // a change not yet saved shows as one thing that needs you
      const dir = join((await app.evaluate(({ app: a }) => a.getPath('userData'))), '..', 'home', 'Atiya', 'ada.github.io');
      writeFileSync(join(dir, 'content', 'site.json'), readFileSync(join(dir, 'content', 'site.json'), 'utf8').replace('Ada Lovelace', 'Ada K. Lovelace'));
      await check.getByRole('button', { name: 'Check again' }).click();
      await expect(check.locator('#summary')).toHaveText('1 thing needs you.');
      await expect(check.locator('li[data-check="saved"]')).toHaveAttribute('data-ok', 'false');
    } finally {
      await quit(app);
      await gh.close();
    }
  });
});
