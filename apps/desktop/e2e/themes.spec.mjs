// @ts-check
/**
 * The themes panel docked beside the site (documentation/site-ui/theming.md §8, DoD T5): the title bar's Theme
 * button opens it while the site shows, edit mode's Theme screen opens it too, the dock closes itself, and leaving
 * the site closes it.
 */
import { expect, test } from '@playwright/test';
import { launch, pageMatching, quitGracefully } from './launch.mjs';

/** The window's views: their addresses and bounds. @param {import('@playwright/test').ElectronApplication} app */
const views = (app) =>
  app.evaluate(({ BaseWindow }) => {
    const w = BaseWindow.getAllWindows().find((x) => x.isFocusable()) ?? BaseWindow.getAllWindows()[0];
    return w.contentView.children.map((v) => ({ url: /** @type {Electron.WebContentsView} */ (v).webContents.getURL(), bounds: v.getBounds() }));
  });
const bodyOf = async (/** @type {any} */ app) => (await views(app)).find((v) => !v.url.includes('frame.html') && !v.url.includes('dock'));
const dockOf = async (/** @type {any} */ app) => (await views(app)).find((v) => v.url.includes('/_edit/theme/?dock'));

test.describe('desktop: themes panel', () => {
  test('the Theme button docks the panel beside the site; it closes itself; edit mode’s Theme screen opens it; leaving the site closes it', async ({}, testInfo) => {
    const { app } = await launch({ port: 4431 });
    try {
      const frame = await pageMatching(app, /frame\.html/);
      await (await pageMatching(app, /welcome\.html/)).getByRole('button', { name: 'Open this checkout' }).click();
      await pageMatching(app, /localhost:4431\/_edit\//);
      const themes = frame.getByRole('button', { name: 'Theme', exact: true });
      // offered only while the site shows
      await expect(themes).toBeHidden();
      await frame.getByRole('radio', { name: 'Site' }).click();
      await expect(themes).toBeVisible();
      await expect(themes).toHaveAttribute('aria-pressed', 'false');
      const full = (await bodyOf(app))?.bounds;

      await themes.click();
      await expect(themes).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(async () => (await dockOf(app))?.bounds.width ?? 0).toBeGreaterThan(300);
      const body = (await bodyOf(app))?.bounds;
      const dock = (await dockOf(app))?.bounds;
      expect(body?.width).toBeLessThan(full?.width ?? 0);
      // the dock on the right of the site, the card's gap between them, the same height
      expect(dock?.x).toBe((body?.x ?? 0) + (body?.width ?? 0) + 8);
      expect(dock?.y).toBe(body?.y);
      expect(dock?.height).toBe(body?.height);
      await expect(frame.locator('html')).toHaveAttribute('data-dock', '');
      await testInfo.attach('docked', { body: await frame.screenshot(), contentType: 'image/png' });

      // the dock's own page closes it
      const dockPage = await pageMatching(app, /\/_edit\/theme\/\?dock/);
      expect(await dockPage.evaluate(() => typeof (/** @type {any} */ (window).atiyaDock?.close))).toBe('function');
      await dockPage.evaluate(() => /** @type {any} */ (window).atiyaDock.close());
      await expect(themes).toHaveAttribute('aria-pressed', 'false');
      await expect.poll(async () => !!(await dockOf(app))).toBe(false);
      expect((await bodyOf(app))?.bounds).toEqual(full);

      // edit mode's Theme screen opens the panel beside the site
      await frame.getByRole('radio', { name: 'Edit mode' }).click();
      const editor = await pageMatching(app, /localhost:4431\/_edit\/$/);
      await editor.evaluate(() => location.assign('/_edit/theme/'));
      await expect.poll(async () => !!(await dockOf(app))).toBe(true);
      await expect(frame.getByRole('radio', { name: 'Site' })).toHaveAttribute('aria-checked', 'true');
      await expect.poll(async () => (await bodyOf(app))?.url).toBe('http://localhost:4431/');

      // leaving the site closes it
      await frame.getByRole('radio', { name: 'Edit mode' }).click();
      await expect.poll(async () => !!(await dockOf(app))).toBe(false);
      await expect(themes).toBeHidden();
    } finally {
      await quitGracefully(app);
    }
  });
});
