/**
 * Ways to explore (plan stage 8A, 8A.5 and 8A.6): edit mode turns the little planet off and on and picks
 * the home page's first offer; the dev server starts again and the site follows; a site that's never had
 * the planet gets its starting map. The editor project, on the fixture server (port 4330).
 *
 *   npx playwright test --project=editor -g "ways to explore"
 */
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURE, reset } from '../../scripts/editor-test-server.mjs';

const WAYS = join(FIXTURE, 'content/structures/ways.json');
const PLANET = join(FIXTURE, 'content/structures/modes/little-planet.json');
const readJson = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const status = (page: Page) => page.locator('[data-editor-status]');
const modeBox = (page: Page) => page.getByRole('checkbox', { name: /^Little planet/ });
const firstOffer = (page: Page, name: RegExp) => page.locator('fieldset', { hasText: 'What the home page offers first' }).getByRole('radio', { name });
const planetLink = (page: Page) => page.locator('nav').getByRole('link', { name: 'Planet', exact: true });

/** Opens a screen, waiting out a restart of the dev server. */
async function open(page: Page, path: string) {
  await expect
    .poll(
      async () => {
        const r = await page.goto(path).catch(() => null);
        return r?.status() ?? 0;
      },
      { timeout: 90_000, intervals: [1000] },
    )
    .toBe(200);
  await expect(page.locator('h1')).toBeVisible();
}

/** A page of the site, as text, once the server answers (it may be starting again). */
const text = async (page: Page, path: string) => {
  for (let i = 0; ; i++) {
    try {
      const r = await page.request.get(path);
      if (r.status() < 500 || i >= 30) return { status: r.status(), body: await r.text() };
    } catch (e) {
      if (i >= 30) throw e;
    }
    await page.waitForTimeout(1000);
  }
};

test.describe('editor: ways to explore', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(300_000);
  test.beforeEach(() => reset());
  test.afterAll(() => reset());

  test('ways to explore: the little planet off and back on, the first offer, the site following, and axe in light and dark', async ({ page }) => {
    // the home page's views (home-views plan 2a) are kept by every save of this screen
    const kept = existsSync(WAYS) && readJson(WAYS).home ? { home: readJson(WAYS).home } : {};
    await open(page, '/_edit/ways/');
    await expect(page.getByRole('heading', { level: 1, name: 'Ways to explore' })).toBeVisible();
    // each scheme set before the page loads, so no colour is caught mid-transition
    for (const scheme of ['dark', 'light'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await open(page, '/_edit/ways/');
      const r = await new AxeBuilder({ page }).analyze();
      expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${scheme}: ${v.id}: ${v.nodes.map((n) => `${n.target.join(' ')} (${n.failureSummary?.split('\n').pop()?.trim()})`).join(', ')}`)).toEqual([]);
    }
    await expect(modeBox(page)).toBeChecked();
    await expect(planetLink(page)).toBeVisible({ timeout: 120_000 });

    // off: by keyboard, the first offer follows (only a way that's on can be offered)
    await firstOffer(page, /^Little planet/).check();
    await modeBox(page).focus();
    await page.keyboard.press('Space');
    await expect(modeBox(page)).not.toBeChecked();
    await expect(firstOffer(page, /^Little planet/)).toBeDisabled();
    await expect(firstOffer(page, /^Read the site/)).toBeChecked();
    await page.getByRole('button', { name: 'Save ways to explore' }).click();
    await expect(status(page)).toHaveText(/^Saved ways to explore/, { timeout: 120_000 });
    expect(readJson(WAYS)).toEqual({ modes: [{ id: 'little-planet', on: false, mount: 'play' }], primary: 'site', ...kept });
    expect(existsSync(PLANET)).toBe(true);
    await expect(planetLink(page)).toHaveCount(0, { timeout: 120_000 });
    await expect(page.getByRole('checkbox', { name: /^Little planet/ })).toHaveAccessibleDescription(/Its map is kept/);

    // the site follows: no way in on the home page, /play/ says it isn't offered, no building's pages
    const home = await text(page, '/');
    expect(home.body).not.toContain('Explore the planet');
    const play = await text(page, '/play/');
    expect(play.status).toBe(200);
    expect(play.body).toMatch(/This way of exploring isn(?:'|&#39;|’)t offered/);
    expect(play.body).toContain('name="robots" content="noindex"');
    // the game's element and code aren't there (the dev server inlines the page's stylesheet, which names it)
    expect(play.body).not.toContain('id="game-container"');
    expect(play.body).not.toMatch(/platform\/gate/);
    expect((await text(page, '/play/lighthouse/')).status).toBe(404);

    // Save to remote lists the ways file while it differs (turned back on below, it's as it was)
    await open(page, '/_edit/publish/');
    await expect(page.locator('main')).toContainText('structures/ways.json');

    // back on, and offered first: the buildings are as they were
    const before = readFileSync(PLANET, 'utf8');
    await open(page, '/_edit/ways/');
    await modeBox(page).check();
    await firstOffer(page, /^Little planet/).check();
    await page.getByRole('button', { name: 'Save ways to explore' }).click();
    await expect(status(page)).toHaveText(/^Saved ways to explore/, { timeout: 120_000 });
    expect(readJson(WAYS)).toEqual({ modes: [{ id: 'little-planet', on: true, mount: 'play' }], primary: 'little-planet', ...kept });
    expect(readFileSync(PLANET, 'utf8')).toBe(before);
    await expect(planetLink(page)).toBeVisible({ timeout: 120_000 });
    expect((await text(page, '/')).body).toContain('Explore the planet');
    expect((await text(page, '/play/')).body).toContain('id="game-container"');
  });

  test('ways to explore: a site that has never had the planet gets its starting map when it is turned on', async ({ page }) => {
    // a site made without the planet: no planet structure, nothing on (a change the server starts again for)
    const startedNow = async () => (await (await page.request.get('/_edit/__warm').catch(() => null))?.json().catch(() => null))?.started ?? null;
    await open(page, '/_edit/ways/');
    const before = await startedNow();
    writeFileSync(WAYS, `${JSON.stringify({ modes: [], primary: 'site' }, null, 2)}\n`);
    rmSync(PLANET);
    await expect.poll(startedNow, { timeout: 90_000, intervals: [500] }).not.toBe(before);
    await expect.poll(startedNow, { timeout: 90_000, intervals: [500] }).not.toBeNull();
    await open(page, '/_edit/ways/');
    await expect(modeBox(page)).not.toBeChecked();
    await expect(planetLink(page)).toHaveCount(0, { timeout: 120_000 });
    await modeBox(page).check();
    await page.getByRole('button', { name: 'Save ways to explore' }).click();
    await expect(status(page)).toHaveText(/^Saved ways to explore/, { timeout: 120_000 });
    const map = readJson(PLANET).places as { id: string; title: string; site: string }[];
    expect(map.map((p) => p.id)).toEqual(['workshop', 'town-hall', 'lighthouse', 'library', 'amphitheater', 'greenhouse', 'post-office']);
    expect(map[0].title).toBe('Workshop');
    expect(new Set(map.map((p) => p.site)).size).toBe(7);
    await expect(planetLink(page)).toBeVisible({ timeout: 120_000 });
    expect((await text(page, '/play/')).body).toContain('id="game-container"');
  });
});
