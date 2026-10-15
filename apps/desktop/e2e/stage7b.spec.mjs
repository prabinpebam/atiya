// @ts-check
/** Stage 7B's Definition of Done (documentation/desktop/plan.md): one row, with edit mode's header in it. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { get } from 'node:http';
import { launch, pageMatching } from './launch.mjs';

/** @param {import('@playwright/test').ElectronApplication} app */
const quit = async (app) => {
  await app.evaluate(({ app: a }) => a.quit()).catch(() => {});
  await app.close().catch(() => {});
};
/** A page fetched as a browser would, without the app's request header. @param {string} url */
const fetchPage = (url) => new Promise((resolve, reject) => get(url, (r) => { let s = ''; r.on('data', (d) => (s += d)); r.on('end', () => resolve(s)); }).on('error', reject));

test.describe('desktop: one row', () => {
  test('7B.1 edit mode comes without its own header in the app (not in a browser), and the row draws its title and controls', async () => {
    const { app } = await launch({ port: 4411 });
    try {
      const frame = await pageMatching(app, /frame\.html/);
      await (await pageMatching(app, /welcome\.html/)).getByRole('button', { name: 'Open this checkout' }).click();
      const editor = await pageMatching(app, /localhost:4411\/_edit\//);
      await expect(editor.locator('#studio-asked')).toHaveText('asked');
      expect(await fetchPage('http://localhost:4411/_edit/')).toContain('<p id="studio-asked">not asked</p>');
      const bar = frame.getByRole('banner', { name: 'Atiya Studio' });
      // the screen's title after the start
      const context = bar.locator('#page-context');
      await expect(context.getByRole('button', { name: 'Pages' })).toBeVisible();
      await expect(context).toContainText('A stand-in page');
      await expect(context).toContainText('Published');
      // its controls before the window's
      const controls = bar.getByRole('group', { name: 'This screen' });
      await expect(controls.getByRole('status')).toHaveText('All changes saved');
      await expect(controls.getByRole('button', { name: 'Undo' })).toBeVisible();
      await expect(controls.getByRole('button', { name: 'Desktop width' })).toHaveAttribute('aria-pressed', 'true');
      await expect(controls.getByRole('button', { name: 'Show: Everything' })).toBeVisible();
      await expect(controls.getByRole('button', { name: 'Save to remote' })).toBeVisible();
      // what the row can't draw isn't drawn
      await expect(bar).not.toContainText('not drawn');
      // in one row: all of it shares the bar's line, before the window's controls
      const row = await frame.evaluate(() => {
        const bar = /** @type {HTMLElement} */ (document.querySelector('.bar')).getBoundingClientRect();
        const ids = ['menu', 'show-site', 'server', 'page-context', 'page-controls', 'close'];
        return ids.map((id) => { const r = /** @type {HTMLElement} */ (document.getElementById(id)).getBoundingClientRect(); return { id, inBar: r.top >= bar.top && r.bottom <= bar.bottom + 0.5, x: r.left }; });
      });
      for (const r of row) expect(r.inBar, r.id).toBe(true);
      expect(row.map((r) => r.id)).toEqual([...row].sort((a, b) => a.x - b.x).map((r) => r.id));
    } finally {
      await quit(app);
    }
  });

  test('7B.2 the row\'s controls press edit mode\'s own, a choice goes through, and every control reads well in both themes', async () => {
    const { app } = await launch({ port: 4412 });
    try {
      const frame = await pageMatching(app, /frame\.html/);
      await (await pageMatching(app, /welcome\.html/)).getByRole('button', { name: 'Open this checkout' }).click();
      const editor = await pageMatching(app, /localhost:4412\/_edit\//);
      const controls = frame.getByRole('group', { name: 'This screen' });
      await controls.getByRole('button', { name: 'Undo' }).click();
      await controls.getByRole('button', { name: 'Save to remote' }).click();
      await frame.locator('#page-context').getByRole('button', { name: 'Pages' }).click();
      await expect(editor.locator('#commands li')).toHaveText(['click s2', 'click s5', 'click s1']);
      // a choice: the menu over the body, keyboard and all
      const show = controls.getByRole('button', { name: 'Show: Everything' });
      await show.click();
      const menu = frame.getByRole('menu', { name: 'Show' });
      await expect(menu).toBeVisible();
      await expect(menu.getByRole('menuitemradio', { name: 'Everything' })).toBeFocused();
      await frame.keyboard.press('ArrowDown');
      await expect(menu.getByRole('menuitemradio', { name: 'Drafts' })).toBeFocused();
      await frame.keyboard.press('Enter');
      await expect(menu).toBeHidden();
      await expect(editor.locator('#commands li').last()).toHaveText('select s4 drafts');
      await expect(controls.getByRole('button', { name: 'Show: Drafts' })).toBeFocused();
      // every control of the screen's keeps its words readable at rest and on hover, light and dark (a filled
      // button once lost its fill on hover, leaving its on-accent text on the plain hover colour), and axe passes
      const contrast = (/** @type {import('@playwright/test').Locator} */ b) =>
        b.evaluate((el) => {
          const rgb = (/** @type {string} */ c) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
          const lum = (/** @type {number[]} */ [r, g, b]) => [r, g, b].map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
          const s = getComputedStyle(el);
          let bg = s.backgroundColor;
          for (let e = /** @type {HTMLElement | null} */ (el); e && /rgba\(0, 0, 0, 0\)|transparent/.test(bg); e = e.parentElement) bg = getComputedStyle(e).backgroundColor;
          const [a, z] = [lum(rgb(s.color)), lum(rgb(bg))].sort((x, y) => y - x);
          return (a + 0.05) / (z + 0.05);
        });
      for (const [scheme, label] of /** @type {const} */ ([['light', 'Light'], ['dark', 'Dark']])) {
        // the app's own theme, from the title bar, as a person would choose it
        await frame.getByRole('button', { name: /^Colour theme: / }).click();
        await frame.getByRole('menu', { name: 'Colour theme' }).getByRole('menuitemradio', { name: label }).click();
        await expect.poll(() => frame.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(scheme === 'dark');
        const r = await new AxeBuilder({ page: frame }).setLegacyMode(true).disableRules(['landmark-one-main']).analyze();
        expect(r.violations.map((v) => `${scheme}: ${v.id}`)).toEqual([]);
        for (const name of ['Save to remote', 'Undo', 'Show: Drafts']) {
          const b = controls.getByRole('button', { name });
          await frame.mouse.move(5, 300);
          expect(await contrast(b), `${scheme} ${name} at rest`).toBeGreaterThanOrEqual(4.5);
          await b.hover();
          expect(await contrast(b), `${scheme} ${name} on hover`).toBeGreaterThanOrEqual(4.5);
        }
      }      // the site has no header of edit mode's: the row's go
      await frame.getByRole('radio', { name: 'Site' }).click();
      await expect(frame.locator('#page-controls')).toBeHidden();
      await expect(frame.locator('#page-context')).toBeEmpty();
      // and come back with edit mode
      await frame.getByRole('radio', { name: 'Edit mode' }).click();
      await expect(controls.getByRole('button', { name: 'Undo' })).toBeVisible();
    } finally {
      await quit(app);
    }
  });
});
