// @ts-check
/** Stage 7D's Definition of Done (documentation/desktop/plan.md): one colour theme for the whole app, the site included. */
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, pageMatching } from './launch.mjs';

/** @param {import('@playwright/test').ElectronApplication} app */
const quit = async (app) => {
  await app.evaluate(({ app: a }) => a.quit()).catch(() => {});
  await app.close().catch(() => {});
};
const dark = (/** @type {import('@playwright/test').Page} */ p) => p.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches);

test.describe('desktop: one theme', () => {
  test('7D.1 the title bar chooses the theme for the whole app: the bar, edit mode and the site follow it, and it is remembered', async () => {
    const { app, root } = await launch({ port: 4419 });
    try {
      const frame = await pageMatching(app, /frame\.html/);
      await (await pageMatching(app, /welcome\.html/)).getByRole('button', { name: 'Open this checkout' }).click();
      const editor = await pageMatching(app, /localhost:4419\/_edit\//);

      // in the left group, after the server's dot, before the screen's own title
      const theme = frame.getByRole('button', { name: 'Colour theme: Match the system' });
      await expect(theme).toBeVisible();
      const order = await frame.evaluate(() => ['server', 'theme', 'page-context'].map((id) => /** @type {HTMLElement} */ (document.getElementById(id)).getBoundingClientRect().left));
      expect(order[0]).toBeLessThan(order[1]);
      expect(order[1]).toBeLessThan(order[2]);
      expect(await theme.evaluate((b) => !!b.closest('.group.start'))).toBe(true);

      // Dark: the bar and edit mode follow, and the site's own storage says so (it reads it before its first paint)
      await theme.click();
      const menu = frame.getByRole('menu', { name: 'Colour theme' });
      await expect(menu.getByRole('menuitemradio', { name: 'Match the system' })).toHaveAttribute('aria-checked', 'true');
      await menu.getByRole('menuitemradio', { name: 'Dark' }).click();
      await expect(frame.getByRole('button', { name: 'Colour theme: Dark' })).toBeFocused();
      await expect.poll(() => dark(frame)).toBe(true);
      await expect.poll(() => dark(editor)).toBe(true);
      await expect.poll(() => editor.evaluate(() => [localStorage.getItem('site.theme'), document.documentElement.dataset.theme])).toEqual(['dark', 'dark']);
      expect(JSON.parse(readFileSync(join(root, 'data', 'settings.json'), 'utf8')).theme).toBe('dark');

      // the site's own switch has nothing to choose in the app
      await expect(editor.locator('#site-switch')).toBeHidden();
      // the site, too: a page loaded after the choice paints in it
      await frame.getByRole('radio', { name: 'Site' }).click();
      await expect.poll(() => editor.url()).toBe('http://localhost:4419/');
      await expect.poll(() => editor.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
      await expect.poll(() => dark(editor)).toBe(true);

      // Light, then back to the system's: the site's stored choice goes, so it follows the system again
      await frame.getByRole('button', { name: 'Colour theme: Dark' }).click();
      await frame.getByRole('menu', { name: 'Colour theme' }).getByRole('menuitemradio', { name: 'Light' }).click();
      await expect.poll(() => dark(frame)).toBe(false);
      await expect.poll(() => editor.evaluate(() => localStorage.getItem('site.theme'))).toBe('light');
      await frame.getByRole('button', { name: 'Colour theme: Light' }).click();
      await frame.getByRole('menu', { name: 'Colour theme' }).getByRole('menuitemradio', { name: 'Match the system' }).click();
      await expect.poll(() => editor.evaluate(() => [localStorage.getItem('site.theme'), document.documentElement.dataset.theme ?? null])).toEqual([null, null]);
      expect(JSON.parse(readFileSync(join(root, 'data', 'settings.json'), 'utf8')).theme).toBe('system');
    } finally {
      await quit(app);
    }
  });

  test("7D.4 the documentation follows the app's theme too: its own stored choice set to follow, its toggle hidden", async () => {
    const { app } = await launch({ port: 4420 });
    try {
      const frame = await pageMatching(app, /frame\.html/);
      await (await pageMatching(app, /welcome\.html/)).getByRole('button', { name: 'Open this checkout' }).click();
      const body = await pageMatching(app, /localhost:4420\/_edit\//);
      // as if the docs' own toggle had once chosen Light
      await body.evaluate(() => localStorage.setItem('slate-theme-pref', 'light'));
      await frame.getByRole('button', { name: /^Colour theme/ }).click();
      await frame.getByRole('menu', { name: 'Colour theme' }).getByRole('menuitemradio', { name: 'Dark' }).click();
      await body.goto('http://localhost:4420/docs/#engineering/overview.md');
      await expect.poll(() => body.evaluate(() => [localStorage.getItem('slate-theme-pref'), document.documentElement.getAttribute('data-theme')])).toEqual(['auto', 'dark']);
      await expect(body.locator('.theme-toggle')).toBeHidden();
      // a change in the title bar reaches the open documentation
      await frame.getByRole('button', { name: 'Colour theme: Dark' }).click();
      await frame.getByRole('menu', { name: 'Colour theme' }).getByRole('menuitemradio', { name: 'Light' }).click();
      await expect.poll(() => body.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('light');
    } finally {
      await quit(app);
    }
  });
});
