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
    // the app's window, not the snap preview (a window of its own, which never takes focus)
    const w = BaseWindow.getAllWindows().find((x) => x.isFocusable()) ?? BaseWindow.getAllWindows()[0];
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
      // the bar's empty band (the screen's title is part of it: the app's own name steps aside for it)
      await frame.locator('#page-context .page-text').first().dblclick();
      await expect(frame.locator('html')).toHaveAttribute('data-maximized', 'true');
      // the bar's empty band (the screen's title is part of it: the app's own name steps aside for it)
      await frame.locator('#page-context .page-text').first().dblclick();
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

  test('7A.6 Edit mode | Site is a proper segmented control, and the bar\'s hover states apply, in light and dark', async () => {
    const { app, frame } = await openEditMode({ port: 4406 });
    try {
      const anatomy = () =>
        frame.evaluate(() => {
          const track = /** @type {HTMLElement} */ (document.querySelector('.segmented'));
          const bar = /** @type {HTMLElement} */ (document.querySelector('.bar'));
          const [chosen, other] = ['[aria-checked="true"]', '[aria-checked="false"]'].map((s) => /** @type {HTMLElement} */ (track.querySelector(s)));
          const t = getComputedStyle(track);
          const pill = (/** @type {HTMLElement} */ el) => {
            const p = getComputedStyle(el, '::before');
            return { bg: p.backgroundColor, border: p.borderTopWidth, borderColor: p.borderTopColor, shadow: p.boxShadow, top: p.top, left: p.left, right: p.right, bottom: p.bottom };
          };
          return {
            track: { bg: t.backgroundColor, border: t.borderTopWidth, shadow: t.boxShadow, outline: t.outlineStyle },
            barBg: getComputedStyle(bar).backgroundColor,
            optionBg: [getComputedStyle(chosen).backgroundColor, getComputedStyle(other).backgroundColor],
            optionHeight: chosen.getBoundingClientRect().height,
            chosen: pill(chosen),
            other: pill(other),
          };
        });
      for (const scheme of /** @type {const} */ (['light', 'dark'])) {
        await frame.emulateMedia({ colorScheme: scheme });
        await frame.mouse.move(700, 600);
        const a = await anatomy();
        // the track: a fill of its own, no border, no ring
        expect(a.track.border, scheme).toBe('0px');
        expect(a.track.shadow, scheme).toBe('none');
        expect(a.track.bg, scheme).not.toBe(a.barBg);
        expect(a.track.bg, scheme).not.toBe('rgba(0, 0, 0, 0)');
        // the options paint nothing of their own: only their pills
        expect(a.optionBg, scheme).toEqual(['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)']);
        expect(a.optionHeight, scheme).toBeGreaterThanOrEqual(44);
        // the chosen pill: its own fill, a border and a drop shadow, with room all round inside the track
        expect(a.chosen.bg, scheme).not.toBe(a.track.bg);
        expect(a.chosen.bg, scheme).not.toBe('rgba(0, 0, 0, 0)');
        expect(a.chosen.border, scheme).toBe('1px');
        expect(a.chosen.borderColor, scheme).not.toBe('rgba(0, 0, 0, 0)');
        expect(a.chosen.shadow, scheme).not.toBe('none');
        for (const side of /** @type {const} */ (['top', 'left', 'right', 'bottom'])) expect(parseFloat(a.chosen[side]), `${scheme} ${side}`).toBeGreaterThanOrEqual(3);
        // the other: nothing at rest
        expect(a.other.bg, scheme).toBe('rgba(0, 0, 0, 0)');
        expect(a.other.shadow, scheme).toBe('none');
        // the bar's hover states apply (a broken selector list once dropped them all)
        const close = frame.getByRole('button', { name: 'Close' });
        await close.hover();
        const red = await frame.evaluate(() => {
          const probe = document.createElement('i');
          probe.style.color = 'var(--color-negative)';
          document.body.append(probe);
          const c = getComputedStyle(probe).color;
          probe.remove();
          return c;
        });
        expect(await close.evaluate((b) => getComputedStyle(b).backgroundColor), `${scheme} close on hover`).toBe(red);
        await frame.getByRole('button', { name: 'Atiya Studio menu' }).hover();
        expect(await frame.getByRole('button', { name: 'Atiya Studio menu' }).evaluate((b) => getComputedStyle(b).backgroundColor), `${scheme} logo on hover`).not.toBe('rgba(0, 0, 0, 0)');
      }
    } finally {
      await quit(app);
    }
  });

  test('7A.7 the window\'s shadow stays inside its margin on every side, so the window\'s bounds never cut it off', async () => {
    const { app, frame } = await openEditMode({ port: 4407 });
    try {
      for (const scheme of /** @type {const} */ (['light', 'dark'])) {
        await frame.emulateMedia({ colorScheme: scheme });
        const r = await frame.evaluate(() => {
          const w = /** @type {HTMLElement} */ (document.querySelector('.window'));
          const s = getComputedStyle(w);
          // each shadow: its colour, then x y blur spread (px); the hairline ring has no offset or blur
          const shadows = s.boxShadow.split(/,(?![^(]*\))/).map((one) => (one.match(/-?[\d.]+px/g) ?? []).map(parseFloat));
          return { margin: parseFloat(s.top), shadows, inner: [innerWidth, innerHeight] };
        });
        expect(r.margin, scheme).toBe(16);
        let reach = { top: 0, right: 0, bottom: 0, left: 0 };
        for (const [x = 0, y = 0, blur = 0, spread = 0] of r.shadows)
          reach = { top: Math.max(reach.top, spread + blur - y), right: Math.max(reach.right, spread + blur + x), bottom: Math.max(reach.bottom, spread + blur + y), left: Math.max(reach.left, spread + blur - x) };
        for (const [side, px] of Object.entries(reach)) expect(px, `${scheme} ${side}`).toBeLessThanOrEqual(r.margin);
        // and there is a shadow: it reaches the bottom of the margin
        expect(reach.bottom, scheme).toBeGreaterThanOrEqual(r.margin / 2);
      }
    } finally {
      await quit(app);
    }
  });

  test("7A.9 the top or bottom edge dragged to the screen's edge, or double-clicked, fills the height at the same width; a move by the bar puts it back", async () => {
    const { app, frame } = await openEditMode({ port: 4408 });
    try {
      const before = await windowInfo(app);
      const content = { x: before.bounds.x + 16, y: before.bounds.y + 16, width: before.bounds.width - 32 };
      // the top edge, dragged by the page's reports up to the top of the work area
      await frame.evaluate(({ x, y, top }) => {
        const w = /** @type {any} */ (window).atiya.window;
        w.drag('start', 'n', x, y, false);
        w.drag('move', 'n', x, top + 1, false);
        w.drag('end', 'n', x, top + 1, false);
      }, { x: content.x + 300, y: content.y, top: before.workArea.y });
      await expect.poll(async () => (await windowInfo(app)).bounds).toEqual({ x: content.x, y: before.workArea.y, width: content.width, height: before.workArea.height });
      await expect(frame.locator('html')).toHaveAttribute('data-margin', '0');
      // moved by the bar: its height comes back
      const full = (await windowInfo(app)).bounds;
      await frame.evaluate(({ x, y }) => {
        const w = /** @type {any} */ (window).atiya.window;
        w.drag('start', 'move', x, y, false);
        w.drag('move', 'move', x, y + 120, false);
        w.drag('end', 'move', x, y + 120, false);
      }, { x: full.x + 300, y: full.y + 20 });
      await expect.poll(async () => (await windowInfo(app)).bounds.height).toBe(before.bounds.height);
      await expect(frame.locator('html')).toHaveAttribute('data-margin', 'rest');
      // a double-click on the bottom edge's handle fills the height, and again puts it back
      const h = (await windowInfo(app)).bounds.height;
      await frame.locator('[data-window-handle="s"]').dispatchEvent('dblclick');
      await expect.poll(async () => (await windowInfo(app)).bounds.height).toBe(before.workArea.height);
      await frame.locator('[data-window-handle="s"]').dispatchEvent('dblclick');
      await expect.poll(async () => (await windowInfo(app)).bounds.height).toBe(h);
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
