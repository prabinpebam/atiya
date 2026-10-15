// @ts-check
/** Stage 7E's Definition of Done (documentation/desktop/plan.md): the action center (documentation/desktop/action-center.md). */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, pageMatching } from './launch.mjs';

/** @param {import('@playwright/test').ElectronApplication} app */
const quit = async (app) => {
  await app.evaluate(({ app: a }) => a.quit()).catch(() => {});
  await app.close().catch(() => {});
};
const saved = (/** @type {string} */ root) => JSON.parse(readFileSync(join(root, 'data', 'settings.json'), 'utf8'));
/**
 * Ctrl+/ as a person presses it, in the body's view (Playwright's own key presses skip the app's input handling,
 * where the main process catches it).
 * @param {import('@playwright/test').ElectronApplication} app
 */
const ctrlSlash = (app) =>
  app.evaluate(({ webContents }) => {
    const w = webContents.getAllWebContents().find((x) => !x.getURL().includes('frame.html') && !x.getURL().startsWith('devtools:'));
    w?.sendInputEvent({ type: 'keyDown', keyCode: '/', modifiers: ['control'] });
    w?.sendInputEvent({ type: 'keyUp', keyCode: '/', modifiers: ['control'] });
  });

/** The app on the stand-in's edit mode, with the frame and the body's page. @param {number} port */
async function openApp(port) {
  const l = await launch({ port });
  const frame = await pageMatching(l.app, /frame\.html/);
  const welcome = await pageMatching(l.app, /welcome\.html/);
  return { ...l, frame, welcome };
}
/** @param {import('@playwright/test').Page} frame */
const panelOf = (frame) => frame.getByRole('dialog', { name: 'Action center' });
/** Types into the panel's field, replacing what's there. @param {import('@playwright/test').Page} frame @param {string} q */
async function find(frame, q) {
  const field = panelOf(frame).getByRole('combobox', { name: 'Search' });
  await field.fill(q);
  return field;
}
/** The chosen result's words. @param {import('@playwright/test').Page} frame */
const chosen = (frame) => panelOf(frame).locator('[role="option"][aria-selected="true"] .finder-title');

test.describe('desktop: the action center', () => {
  test('7E.1 Ctrl+/ opens it from the app’s pages, edit mode and the site, with the keys; it holds its size, and closes back where it was', async () => {
    const { app, frame, welcome } = await openApp(4431);
    try {
      // the app's own page (the welcome), before edit mode, once it's there
      await expect(welcome.getByRole('button', { name: 'Open this checkout' })).toBeVisible();
      await expect(frame.getByRole('button', { name: 'Action center' })).toBeVisible();
      await ctrlSlash(app);
      const panel = panelOf(frame);
      await expect(panel).toBeVisible();
      await expect(panel.getByRole('combobox', { name: 'Search' })).toBeFocused();
      // ready to draw at once: the frame measured it
      const ms = await frame.evaluate(() => performance.getEntriesByName('finder:open').at(-1)?.duration ?? 999);
      expect(ms).toBeLessThan(50);
      await frame.keyboard.press('Escape');
      await expect(panel).toBeHidden();

      await welcome.getByRole('button', { name: 'Open this checkout' }).click();
      const body = await pageMatching(app, /localhost:4431\/_edit\//);
      await body.evaluate(() => {
        /** @type {any} */ (window).keys = [];
        addEventListener('keydown', (e) => /** @type {any} */ (window).keys.push(`${e.ctrlKey ? 'Ctrl+' : ''}${e.key}`), true);
      });
      await body.locator('body').click();
      await ctrlSlash(app);
      await expect(panel).toBeVisible();
      // the keys never reached the page
      expect(await body.evaluate(() => /** @type {any} */ (window).keys)).not.toContain('Ctrl+/');

      // nothing typed: Suggested; then results follow each letter, and the panel keeps its size
      await expect(panel.getByRole('group', { name: 'Suggested' })).toBeVisible();
      await panel.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
      const before = await panel.boundingBox();
      await find(frame, 'dark');
      await expect(chosen(frame)).toHaveText('Colour theme');
      await expect(panel.getByRole('group', { name: 'Top hit' })).toBeVisible();
      expect(await panel.boundingBox()).toEqual(before);
      await expect(frame.locator('#finder-live')).toHaveText(/\d+ results?/);

      // Esc clears, Esc again closes, and the keys go back to the page
      await frame.keyboard.press('Escape');
      await expect(panel.getByRole('combobox')).toHaveValue('');
      await frame.keyboard.press('Escape');
      await expect(panel).toBeHidden();
      await expect.poll(() => body.evaluate(() => document.hasFocus())).toBe(true);

      // Ctrl+/ again closes; the search button opens it, and a press outside closes it, focus back on the button
      await ctrlSlash(app);
      await expect(panel).toBeVisible();
      await frame.keyboard.press('Control+Slash');
      await expect(panel).toBeHidden();
      const button = frame.getByRole('button', { name: 'Action center' });
      await expect(button).toHaveAttribute('aria-keyshortcuts', 'Control+Slash');
      await button.click();
      await expect(panel).toBeVisible();
      await expect(button).toHaveAttribute('aria-expanded', 'true');
      // a press beside the panel, over the body, closes it
      const box = /** @type {{ x: number, y: number, width: number, height: number }} */ (await panel.boundingBox());
      await frame.mouse.click(box.x + box.width / 2, box.y + box.height + 12);
      await expect(panel).toBeHidden();
      await expect(button).toHaveAttribute('aria-expanded', 'false');
      // opened from the body, a press outside gives the keys back to it
      await ctrlSlash(app);
      await expect(panel).toBeVisible();
      await frame.mouse.click(box.x + box.width / 2, box.y + box.height + 12);
      await expect(panel).toBeHidden();
      await expect.poll(() => body.evaluate(() => document.hasFocus())).toBe(true);

      // over the site too
      await frame.getByRole('radio', { name: 'Site' }).click();
      const site = await pageMatching(app, /localhost:4431\/$/);
      await site.locator('body').click();
      await ctrlSlash(app);
      await expect(panel).toBeVisible();
      await frame.keyboard.press('Escape');
    } finally {
      await quit(app);
    }
  });

  test("7E.2 the app's actions and the screen's own controls do what their buttons do", async () => {
    const { app, frame, welcome } = await openApp(4432);
    try {
      await welcome.getByRole('button', { name: 'Open this checkout' }).click();
      const body = await pageMatching(app, /localhost:4432\/_edit\//);
      const panel = panelOf(frame);
      await ctrlSlash(app);

      // the screen's own: a button, and a choice of its menu, pressed as the row would
      await find(frame, 'undo');
      await expect(chosen(frame)).toHaveText('Undo');
      await expect(panel.getByRole('group', { name: 'Top hit' }).getByRole('option')).toContainText('Undo');
      await frame.keyboard.press('Enter');
      await expect(panel).toBeHidden();
      await expect(body.locator('#commands')).toContainText('click s2');
      await ctrlSlash(app);
      await find(frame, 'show drafts');
      await expect(chosen(frame)).toHaveText('Show: Drafts');
      await frame.keyboard.press('Enter');
      await expect(body.locator('#commands')).toContainText('select s4 drafts');

      // an app action: Show the site, then Show edit mode by its other word
      await ctrlSlash(app);
      await find(frame, 'show the site');
      await expect(chosen(frame)).toHaveText('Show the site');
      await expect(panel.locator('.finder-card')).toContainText('Ctrl+2');
      await frame.keyboard.press('Enter');
      await expect.poll(() => body.url()).toBe('http://localhost:4432/');
      await ctrlSlash(app);
      await find(frame, 'editor');
      await expect(chosen(frame)).toHaveText('Show edit mode');
      await frame.keyboard.press('Enter');
      await expect.poll(() => body.url()).toBe('http://localhost:4432/_edit/');
    } finally {
      await quit(app);
    }
  });

  test("7E.3 the app's settings change on their cards and are kept; Enter flips a switch, a click on its row doesn't; Recent", async () => {
    const { app, frame, welcome, root } = await openApp(4433);
    try {
      await welcome.getByRole('button', { name: 'Open this checkout' }).click();
      const body = await pageMatching(app, /localhost:4433\/_edit\//);
      const panel = panelOf(frame);
      const zoomOf = () => app.evaluate(({ webContents }) => webContents.getAllWebContents().map((w) => [w.getURL(), w.getZoomFactor()]));
      await ctrlSlash(app);

      // the theme: Tab to the choice, the arrows choose; the whole app follows
      await find(frame, 'dark');
      await frame.keyboard.press('Tab');
      const choice = panel.getByRole('radiogroup', { name: 'Colour theme' });
      await expect(choice.getByRole('radio', { name: 'Match the system' })).toBeFocused();
      await frame.keyboard.press('ArrowRight');
      await frame.keyboard.press('ArrowRight');
      await expect(choice.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
      await expect(panel.locator('#finder-status')).toHaveText('Saved');
      await expect(frame.locator('#finder-live')).toHaveText('Colour theme: Dark. Saved.');
      await expect.poll(() => saved(root).theme).toBe('dark');
      await expect.poll(() => frame.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true);
      // Esc goes back to the field
      await frame.keyboard.press('Escape');
      await expect(panel.getByRole('combobox')).toBeFocused();

      // zoom: the body's pages, not the frame, and kept
      await find(frame, 'zoom');
      await expect(chosen(frame)).toHaveText('Zoom');
      await frame.keyboard.press('Enter');
      const slider = panel.getByRole('slider', { name: 'Zoom' });
      await expect(slider).toBeFocused();
      await frame.keyboard.press('ArrowRight');
      await expect(slider).toHaveAttribute('aria-valuetext', '110%');
      await expect.poll(() => saved(root).zoom).toBe(1.1);
      await expect.poll(async () => (await zoomOf()).find(([u]) => String(u).includes('/_edit/'))?.[1]).toBeCloseTo(1.1);
      expect((await zoomOf()).find(([u]) => String(u).includes('frame.html'))?.[1]).toBe(1);
      await panel.getByRole('button', { name: 'Reset to 100%' }).click();
      await expect.poll(() => saved(root).zoom).toBe(1);

      // keeping in the tray: a click on its row chooses it and doesn't flip it; Enter flips it
      await panel.getByRole('combobox').focus();
      await find(frame, 'tray');
      await panel.getByRole('option', { name: /Keep running in the tray/ }).click();
      const sw = panel.getByRole('switch', { name: 'Keep running in the tray' });
      await expect(sw).toBeFocused();
      await expect(sw).toHaveAttribute('aria-checked', 'true');
      await panel.getByRole('combobox').focus();
      await frame.keyboard.press('Enter');
      await expect(sw).toHaveAttribute('aria-checked', 'false');
      await expect.poll(() => saved(root).keepInTray).toBe(false);

      // Recent: what was changed comes first when nothing's typed
      await find(frame, '');
      const recent = panel.getByRole('group', { name: 'Recent' }).getByRole('option');
      await expect(recent.first()).toContainText('Keep running in the tray');
      await expect(recent).toHaveCount(3);
      expect(Object.values(saved(root).recent)[0]).toEqual(['setting:tray', 'setting:zoom', 'setting:theme']);
    } finally {
      await quit(app);
    }
  });

  test("7E.4 edit mode's content: pages, sections, pictures, screens, opened where they belong; thumbnails; edit mode not ready", async () => {
    const { app, frame, welcome, root } = await openApp(4434);
    try {
      await welcome.getByRole('button', { name: 'Open this checkout' }).click();
      const body = await pageMatching(app, /localhost:4434\/_edit\//);
      const panel = panelOf(frame);
      await ctrlSlash(app);

      // a page by its title: its card with its picture, Enter edits it
      await find(frame, 'designup');
      await expect(chosen(frame)).toHaveText('My journey with DesignUp');
      const card = panel.locator('.finder-card');
      await expect(card.getByRole('heading', { name: 'My journey with DesignUp' })).toBeVisible();
      await expect(card.locator('.finder-picture img')).toHaveAttribute('src', /^data:image\/png;base64,/);
      await expect(panel.locator('[role="option"][aria-selected="true"] img')).toHaveAttribute('src', /^data:image\/png/);
      await expect(card.getByRole('button', { name: 'View on site' })).toBeVisible();
      await frame.keyboard.press('Enter');
      await expect.poll(() => body.url()).toBe('http://localhost:4434/_edit/articles/designup/');
      await expect.poll(() => body.evaluate(() => document.hasFocus())).toBe(true);

      // Ctrl+Enter: on the site
      await ctrlSlash(app);
      await find(frame, 'designup');
      await frame.keyboard.press('Control+Enter');
      await expect.poll(() => body.url()).toBe('http://localhost:4434/writing/designup/');

      // by words in its body, the line shown with them marked
      await ctrlSlash(app);
      await find(frame, 'ship weekly');
      await expect(chosen(frame)).toHaveText('My journey with DesignUp');
      await expect(card.locator('mark')).toHaveText(['ship', 'weekly']);

      // a picture opens in Media, chosen; a section in Sections; a screen by its other word
      await find(frame, 'on stage');
      await expect(chosen(frame)).toHaveText('Speaking on stage at DesignUp');
      await expect(card).toContainText('1600 × 900');
      await frame.keyboard.press('Enter');
      await expect.poll(() => body.url()).toBe('http://localhost:4434/_edit/media/?id=articles%2Fdesignup%2Fstage');
      await ctrlSlash(app);
      await find(frame, 'writing');
      await expect(chosen(frame)).toHaveText('Writing');
      await expect(panel.locator('[role="option"][aria-selected="true"]')).toContainText('2 pages');
      await frame.keyboard.press('Enter');
      await expect.poll(() => body.url()).toBe('http://localhost:4434/_edit/sections/?section=writing');
      await ctrlSlash(app);
      await find(frame, 'photos');
      await expect(chosen(frame)).toHaveText('Media');
      await frame.keyboard.press('Enter');
      await expect.poll(() => body.url()).toBe('http://localhost:4434/_edit/media/');

      // a private page opens, but isn't remembered
      await ctrlSlash(app);
      await find(frame, 'private plan');
      await expect(panel.locator('[role="option"][aria-selected="true"]')).toContainText('Private');
      await frame.keyboard.press('Enter');
      await expect.poll(() => body.url()).toBe('http://localhost:4434/_edit/articles/secret-plan/');
      const recent = Object.values(saved(root).recent)[0];
      expect(recent).toContain('page:designup');
      expect(recent).not.toContain('page:secret-plan');
    } finally {
      await quit(app);
    }

    // edit mode never starts: the app's own results work, and the panel says why the rest aren't there
    const down = await launch({ port: 4435, stubMode: 'never-listen' });
    try {
      const frame = await pageMatching(down.app, /frame\.html/);
      const welcome = await pageMatching(down.app, /welcome\.html/);
      await welcome.getByRole('button', { name: 'Open this checkout' }).click();
      await pageMatching(down.app, /server\.html/);
      await expect(frame.getByRole('button', { name: /Edit mode stopped/ })).toBeVisible({ timeout: 30_000 });
      await frame.getByRole('button', { name: 'Action center' }).click();
      const panel = panelOf(frame);
      await find(frame, 'designup');
      await expect(panel.locator('#finder-note')).toContainText('Pages, pictures and site settings appear when edit mode is ready.');
      await expect(panel.getByRole('button', { name: 'Restart edit mode' })).toBeVisible();
      await find(frame, 'theme');
      await expect(chosen(frame)).toHaveText('Colour theme');
      await find(frame, 'show the site');
      await expect(panel.locator('#finder-status')).toHaveText('Waits for edit mode to be ready.');
    } finally {
      await quit(down.app);
    }
  });

  test("7E.11 the site's settings change on their cards through edit mode: a refusal said, a way to explore waits for the restart", async () => {
    const { app, frame, welcome } = await openApp(4436);
    try {
      await welcome.getByRole('button', { name: 'Open this checkout' }).click();
      const body = await pageMatching(app, /localhost:4436\/_edit\//);
      const panel = panelOf(frame);
      await ctrlSlash(app);

      await find(frame, 'site name');
      await expect(chosen(frame)).toHaveText('Site name');
      await frame.keyboard.press('Enter');
      const field = panel.getByRole('textbox', { name: 'Site name' });
      await expect(field).toBeFocused();
      await expect(field).toHaveValue('Ada Lovelace');
      await field.fill('Ada King');
      await frame.keyboard.press('Enter');
      await expect(panel.locator('#finder-status')).toHaveText('Saved');
      // refused by the content's rules: said, and the field back to what's saved
      await field.fill('  ');
      await frame.keyboard.press('Enter');
      await expect(panel.locator('#finder-status')).toHaveText('The site needs a name.');
      await expect(field).toHaveValue('Ada King');
      // Ctrl+Enter: its screen
      await frame.keyboard.press('Control+Enter');
      await expect.poll(() => body.url()).toBe('http://localhost:4436/_edit/settings/');

      // the little planet: Enter flips it, and it says so until edit mode is back
      await ctrlSlash(app);
      await find(frame, 'little planet');
      await expect(chosen(frame)).toHaveText('Little planet');
      await frame.keyboard.press('Enter');
      await expect(panel.locator('#finder-status')).toHaveText('Starting the site again…');
      await expect(panel.locator('#finder-status')).toHaveText('Saved', { timeout: 15_000 });
      await expect(panel.getByRole('switch', { name: 'Little planet' })).toHaveAttribute('aria-checked', 'true');
    } finally {
      await quit(app);
    }
  });

  test('7E.13 the anatomy, light and dark: the chosen row filled with the accent edge, thin scrollbars, a long title clamped, the switch', async () => {
    const { app, frame, welcome } = await openApp(4438);
    try {
      await welcome.getByRole('button', { name: 'Open this checkout' }).click();
      await pageMatching(app, /localhost:4438\/_edit\//);
      await ctrlSlash(app);
      const panel = panelOf(frame);
      for (const scheme of /** @type {const} */ (['light', 'dark'])) {
        await frame.emulateMedia({ colorScheme: scheme });
        await find(frame, 'tray');
        const look = await frame.evaluate(() => {
          const css = (/** @type {string} */ s) => getComputedStyle(/** @type {Element} */ (document.querySelector(s)));
          const probe = document.createElement('div');
          probe.style.background = 'var(--color-bg-sunk)';
          probe.style.color = 'var(--color-accent)';
          document.body.append(probe);
          const want = { sunk: getComputedStyle(probe).backgroundColor, accent: getComputedStyle(probe).color };
          probe.remove();
          const row = css('.finder-row[aria-selected="true"]');
          return {
            want,
            rowFill: row.backgroundColor,
            rowEdge: row.boxShadow,
            lists: [css('.finder-list').scrollbarWidth, css('.finder-card').scrollbarWidth],
            clamp: css('.finder-card h2').webkitLineClamp,
            track: css('.finder-switch[aria-checked="true"] .track, .finder-switch .track').backgroundColor,
            radius: css('#finder').borderTopLeftRadius,
          };
        });
        expect(look.rowFill, scheme).toBe(look.want.sunk);
        expect(look.rowEdge, scheme).toContain(look.want.accent);
        expect(look.rowEdge, scheme).toContain('inset');
        expect(look.lists).toEqual(['thin', 'thin']);
        expect(look.clamp).toBe('3');
        expect(look.track, scheme).toBe(look.want.accent);
        expect(parseFloat(look.radius)).toBeGreaterThan(8);
        await expect(panel.getByRole('switch', { name: 'Keep running in the tray' })).toHaveAttribute('aria-checked', 'true');
      }
    } finally {
      await quit(app);
    }
  });

  test('7E.12 axe passes on the panel in light and dark with a page, a picture and a setting chosen', async () => {
    const { app, frame, welcome } = await openApp(4437);
    try {
      await welcome.getByRole('button', { name: 'Open this checkout' }).click();
      const body = await pageMatching(app, /localhost:4437\/_edit\//);
      await ctrlSlash(app);
      for (const scheme of /** @type {const} */ (['light', 'dark'])) {
        await frame.emulateMedia({ colorScheme: scheme });
        for (const q of ['designup', 'on stage', 'zoom', 'dark', 'tray', '']) {
          await find(frame, q);
          await expect(panelOf(frame).locator('.finder-card h2')).toBeVisible();
          const r = await new AxeBuilder({ page: frame }).include('#finder').setLegacyMode(true).analyze();
          expect(r.violations.map((v) => `${scheme} "${q}": ${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
        }
      }
    } finally {
      await quit(app);
    }
  });
});
