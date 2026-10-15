// @ts-check
/** Stage 7A's Definition of Done (documentation/desktop/plan.md): the app's own window and its one title bar row. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { launch, pageMatching, quitGracefully } from './launch.mjs';

/** @param {import('@playwright/test').ElectronApplication} app */
const quit = async (app) => {
  await app.evaluate(({ app: a }) => a.quit()).catch(() => {});
  await app.close().catch(() => {});
};

/** The window, its views' bounds and order, and its display's work area. @param {import('@playwright/test').ElectronApplication} app */
const windowInfo = (app) =>
  app.evaluate(({ BaseWindow, screen }) => {
    const w = BaseWindow.getAllWindows()[0];
    const kids = w.contentView.children;
    return {
      bounds: w.getBounds(),
      minimized: w.isMinimized(),
      workArea: screen.getDisplayMatching(w.getBounds()).workArea,
      views: kids.map((v) => ({ url: /** @type {Electron.WebContentsView} */ (v).webContents.getURL().replace(/\?.*$/, ''), bounds: v.getBounds() })),
    };
  });

/** @param {{ port: number, root?: string }} o */
async function openEditMode(o) {
  const l = await launch({ port: o.port, ...(o.root ? { root: o.root } : {}) });
  const frame = await pageMatching(l.app, /frame\.html/);
  // a first launch offers the checkout; a later one opens the remembered one directly
  if (!o.root) await (await pageMatching(l.app, /welcome\.html/)).getByRole('button', { name: 'Open this checkout' }).click();
  const editor = await pageMatching(l.app, new RegExp(`localhost:${o.port}/_edit/`));
  await expect(frame.locator('#server')).toHaveAttribute('aria-label', 'Edit mode ready');
  return { ...l, frame, editor };
}

test.describe('desktop: the window', () => {
  test('7A.1 one title bar row: logo and menu, title, Edit mode | Site, Open in browser, the server; going live; the window controls', async () => {
    const { app, frame } = await openEditMode({ port: 4401 });
    try {
      const bar = frame.getByRole('banner', { name: 'Atiya Studio' });
      await expect(bar.getByRole('button', { name: 'Atiya Studio menu' })).toBeVisible();
      await expect(bar.getByRole('heading', { name: 'Atiya Studio', level: 1 })).toBeVisible();
      const views = bar.getByRole('radiogroup', { name: 'What to show' });
      await expect(views.getByRole('radio')).toHaveText(['Edit mode', 'Site']);
      await expect(bar.getByRole('button', { name: 'Open in browser' })).toBeEnabled();
      await expect(bar.getByRole('button', { name: 'Edit mode ready' })).toHaveAttribute('aria-haspopup', 'dialog');
      const controls = bar.getByRole('group', { name: 'Window' });
      await expect(controls.getByRole('button')).toHaveText(['', '', '']);
      for (const name of ['Minimize', 'Maximize', 'Close']) await expect(controls.getByRole('button', { name })).toBeVisible();
      // one row: the body starts right under the bar, inside the shadow margin, as an inset card
      const info = await windowInfo(app);
      const body = info.views.find((v) => !v.url.includes('frame.html'));
      expect(info.views.find((v) => v.url.includes('frame.html'))?.bounds).toEqual({ x: 0, y: 0, width: info.bounds.width, height: info.bounds.height });
      expect(body?.bounds).toEqual({ x: 16 + 8, y: 16 + 56, width: info.bounds.width - 2 * 16 - 2 * 8, height: info.bounds.height - 2 * 16 - 56 - 8 });
      expect(await frame.evaluate(() => ({ ...document.documentElement.dataset }))).toMatchObject({ frame: 'custom', margin: 'rest', maximized: 'false' });
      // the taskbar names the site, as the bar no longer does
      expect(await app.evaluate(({ BaseWindow }) => BaseWindow.getAllWindows()[0].getTitle())).toBe('Test Site · Atiya Studio');
      // the segmented control is a radio group: the arrows move the choice
      await views.getByRole('radio', { name: 'Edit mode' }).focus();
      await frame.keyboard.press('ArrowRight');
      await expect(views.getByRole('radio', { name: 'Site' })).toHaveAttribute('aria-checked', 'true');
      await expect(views.getByRole('radio', { name: 'Site' })).toBeFocused();
    } finally {
      await quit(app);
    }
  });

  test('7A.2 maximize fills the work area with square corners, restore puts it back, minimize minimizes; a double-click on the bar maximizes', async () => {
    const { app, frame } = await openEditMode({ port: 4402 });
    try {
      const before = (await windowInfo(app)).bounds;
      await frame.getByRole('button', { name: 'Maximize' }).click();
      await expect.poll(async () => (await windowInfo(app)).bounds).toEqual((await windowInfo(app)).workArea);
      await expect(frame.locator('html')).toHaveAttribute('data-margin', '0');
      await expect(frame.getByRole('button', { name: 'Restore' })).toBeVisible();
      await frame.getByRole('button', { name: 'Restore' }).click();
      await expect.poll(async () => (await windowInfo(app)).bounds).toEqual(before);
      await expect(frame.locator('html')).toHaveAttribute('data-margin', 'rest');
      await frame.getByRole('heading', { name: 'Atiya Studio' }).dblclick();
      await expect(frame.locator('html')).toHaveAttribute('data-maximized', 'true');
      await frame.getByRole('heading', { name: 'Atiya Studio' }).dblclick();
      await expect(frame.locator('html')).toHaveAttribute('data-maximized', 'false');
      await frame.getByRole('button', { name: 'Minimize' }).click();
      if (process.platform === 'win32') await expect.poll(async () => (await windowInfo(app)).minimized).toBe(true);
    } finally {
      await quit(app);
    }
  });

  test('7A.3 the server popover drops over the body with the details and Restart, and Esc or a press elsewhere closes it', async () => {
    const { app, frame } = await openEditMode({ port: 4403 });
    try {
      const dot = frame.getByRole('button', { name: 'Edit mode ready' });
      await dot.click();
      const panel = frame.getByRole('dialog', { name: 'Edit mode ready' });
      await expect(panel).toBeVisible();
      await expect(panel).toBeFocused();
      await expect(panel.locator('#site-name')).toHaveText('Test Site');
      await expect(panel.locator('#server-address')).toHaveText('localhost:4403');
      await expect(panel.getByRole('button', { name: 'Restart' })).toBeVisible();
      await expect(dot).toHaveAttribute('aria-expanded', 'true');
      // the frame's view is on top while it's open, so the popover shows over the body
      expect((await windowInfo(app)).views.at(-1)?.url).toContain('frame.html');
      for (const scheme of /** @type {const} */ (['light', 'dark'])) {
        await frame.emulateMedia({ colorScheme: scheme });
        const r = await new AxeBuilder({ page: frame }).setLegacyMode(true).disableRules(['landmark-one-main']).analyze();
        expect(r.violations.map((v) => `${scheme}: ${v.id}`)).toEqual([]);
      }
      await frame.keyboard.press('Escape');
      await expect(panel).toBeHidden();
      await expect(dot).toBeFocused();
      expect((await windowInfo(app)).views.at(-1)?.url).not.toContain('frame.html');
      await dot.click();
      await expect(panel).toBeVisible();
      await frame.mouse.click(700, 500);
      await expect(panel).toBeHidden();
      // Restart from the popover restarts the dev server
      await dot.click();
      await panel.getByRole('button', { name: 'Restart' }).click();
      await expect(frame.locator('#server')).toHaveAttribute('aria-label', /Restarting edit mode…|Starting edit mode…|Edit mode ready/);
      await expect(frame.locator('#server')).toHaveAttribute('aria-label', 'Edit mode ready', { timeout: 30_000 });
    } finally {
      await quit(app);
    }
  });

  test('7A.4 Snap Layouts opens from Maximize by ↓, places the window in a zone, and moving by the bar follows the pointer', async () => {
    const { app, frame } = await openEditMode({ port: 4404 });
    try {
      await frame.getByRole('button', { name: 'Maximize' }).focus();
      await frame.keyboard.press('ArrowDown');
      const layouts = frame.getByRole('dialog', { name: 'Snap layouts' });
      await expect(layouts).toBeVisible();
      await expect(layouts.getByRole('button', { name: 'Left half' })).toBeFocused();
      await frame.keyboard.press('Enter');
      await expect(layouts).toBeHidden();
      await expect.poll(async () => {
        const i = await windowInfo(app);
        return Math.abs(i.bounds.width - Math.round(i.workArea.width / 2)) <= 1 && i.bounds.x === i.workArea.x && i.bounds.height === i.workArea.height;
      }).toBe(true);
      await expect(frame.locator('html')).toHaveAttribute('data-margin', '0');
      // moving by the bar: the page reports the pointer, the main process moves the window (and a move off a snap restores it)
      const start = (await windowInfo(app)).bounds;
      await frame.evaluate(({ x, y }) => {
        const w = /** @type {any} */ (window).atiya.window;
        w.drag('start', 'move', x, y, false);
        w.drag('move', 'move', x + 300, y + 200, false);
        w.drag('end', 'move', x + 300, y + 200, false);
      }, { x: start.x + 400, y: start.y + 20 });
      await expect.poll(async () => (await windowInfo(app)).bounds.y).toBeGreaterThan(start.y + 100);
      await expect(frame.locator('html')).toHaveAttribute('data-margin', 'rest');
    } finally {
      await quit(app);
    }
  });

  test('7A.5 the logo opens the app\'s menu (the window has no menu bar), and the place and size are remembered', async () => {
    const first = await openEditMode({ port: 4405 });
    try {
      await first.app.evaluate(({ Menu }) => {
        const g = /** @type {any} */ (globalThis);
        g.__menus = [];
        Menu.prototype.popup = function () {
          g.__menus.push(this.items.map((/** @type {any} */ i) => i.label).filter(Boolean));
        };
      });
      await first.frame.getByRole('button', { name: 'Atiya Studio menu' }).click();
      await expect.poll(() => first.app.evaluate(() => /** @type {any} */ (globalThis).__menus.length)).toBe(1);
      const labels = await first.app.evaluate(() => /** @type {any} */ (globalThis).__menus[0]);
      for (const l of ['Make a new site', 'Open a source folder…', 'Edit mode', 'Site', 'Restart the dev server', 'Minimize', 'Maximize', 'Quit']) expect(labels).toContain(l);
      await first.frame.getByRole('button', { name: 'Maximize' }).click();
      await expect(first.frame.locator('html')).toHaveAttribute('data-maximized', 'true');
    } finally {
      await quitGracefully(first.app);
    }
    const again = await openEditMode({ port: 4405, root: first.root });
    try {
      await expect(again.frame.locator('html')).toHaveAttribute('data-maximized', 'true');
      const i = await windowInfo(again.app);
      expect(i.bounds).toEqual(i.workArea);
    } finally {
      await quit(again.app);
    }
  });
});
