/**
 * The themes panel (documentation/site-ui/theming.md §8, DoD T5 to T7, T9, T10): the live site beside the panel,
 * every change on it at once and on every page the person navigates to, presets read only, Save as new, Save, Apply,
 * Rename, Revert and Delete, colours from a picture, and axe in light and dark. The editor project, on the fixture
 * server (port 4330).
 *
 *   npx playwright test --project=editor -g "editor: theme"
 */
import { expect, test, type Frame, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { FIXTURE, reset } from '../../scripts/editor-test-server.mjs';

const SITE = join(FIXTURE, 'content/site.json');
const themeFile = (id: string) => join(FIXTURE, `content/themes/${id}.json`);
const readJson = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const panel = (page: Page) => page.locator('[data-theme-panel]');
const item = (page: Page, name: string) => panel(page).locator('[data-theme-list] label', { hasText: name });
const action = (page: Page, name: string) => panel(page).locator(`[data-theme-action="${name}"]`);
/** The site page in the panel's frame. */
const site = async (page: Page): Promise<Frame> => {
  await expect.poll(() => page.frames().some((f) => f !== page.mainFrame() && /:4330\/(?!_edit)/.test(f.url()))).toBe(true);
  return page.frames().find((f) => f !== page.mainFrame() && /:4330\/(?!_edit)/.test(f.url()))!;
};
const token = (f: Frame | Page, name: string) => f.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

/** A small PNG: one colour, so its accent is known. */
function png(r: number, g: number, b: number, size = 16): Buffer {
  const crc = (buf: Buffer) => {
    let c = ~0;
    for (const x of buf) {
      c ^= x;
      for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    }
    return ~c >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const t = Buffer.concat([Buffer.from(type), data]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(t));
    return Buffer.concat([len, t, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const rows = Buffer.concat(Array.from({ length: size }, () => Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: size }, () => [r, g, b]).flat())])));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}

async function openPanel(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/_edit/theme/');
  await expect(panel(page).getByRole('heading', { level: 1, name: 'Theme' })).toBeVisible();
  await expect(panel(page).locator('[data-theme-name]')).toHaveText('Atiya');
}

test.describe('editor: theme', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(180_000);
  test.beforeEach(() => reset());
  test.afterAll(() => reset());

  test('the live site beside the panel follows every change, on every page the person navigates to', async ({ page, context }) => {
    await openPanel(page);
    const frame = await site(page);
    await expect.poll(() => token(frame, '--radius-md')).toBe('0.875rem');
    // a preset, previewed at once
    await item(page, 'Studio').click();
    await expect(panel(page).locator('p[data-theme-state]')).toHaveText('Preset');
    await expect.poll(() => token(frame, '--radius-md')).toBe('0rem');
    await expect.poll(() => token(frame, '--font-display')).toMatch(/^'Figtree'/);
    // a control, previewed at once
    await panel(page).locator('details[data-theme-group="space"] > summary').click();
    await panel(page).getByRole('radio', { name: 'Rounded' }).check();
    await expect.poll(() => token(frame, '--radius-md')).toBe('1.3125rem');
    await panel(page).getByRole('radio', { name: 'Loose' }).check();
    await expect.poll(async () => parseFloat(await token(frame, '--space-4'))).toBeGreaterThan(1);
    // the person navigates the live site: the next page shows the draft from its first paint
    const next = (await frame.locator('header nav a[href]').first().getAttribute('href'))!;
    await frame.goto(new URL(next, frame.url()).href);
    await expect.poll(() => frame.evaluate(() => !!document.querySelector('style[data-site-theme-draft]'))).toBe(true);
    await expect.poll(() => token(frame, '--radius-md')).toBe('1.3125rem');
    // and so does any other open page of the site (another tab)
    const other = await context.newPage();
    await other.goto('/');
    await expect.poll(() => token(other, '--radius-md')).toBe('1.3125rem');
    // the panel keeps its state: the draft is marked, and Revert goes back
    await expect(panel(page).locator('p[data-theme-state]')).toHaveText('Preset · Unsaved changes');
    await expect(action(page, 'save')).toBeHidden();
    await action(page, 'revert').click();
    await expect.poll(() => token(frame, '--radius-md')).toBe('0rem');
    // Close: the pages go back to the theme in use
    await action(page, 'close').click();
    await expect(page).toHaveURL(/\/_edit\/$/);
    await expect.poll(() => token(other, '--radius-md')).toBe('0.875rem');
    // nothing was written
    expect(readJson(SITE).theme).toBeUndefined();
  });

  test('presets are read only: Save as new, Save, Apply, Rename, Delete; the site uses what was applied', async ({ page }) => {
    await openPanel(page);
    await item(page, 'Garden').click();
    await expect(action(page, 'save')).toBeHidden();
    await expect(action(page, 'delete')).toBeHidden();
    await panel(page).locator('details[data-theme-group="type"] > summary').click();
    await panel(page).getByRole('radio', { name: /^Dramatic/ }).check();
    // Apply on a changed preset asks for a name first
    await action(page, 'apply').click();
    const dialog = page.getByRole('dialog', { name: 'Save as a new theme' });
    await expect(dialog.getByRole('textbox', { name: 'Name' })).toHaveValue('Garden copy');
    await dialog.getByRole('textbox', { name: 'Name' }).fill('Night garden');
    await dialog.getByRole('button', { name: 'Save theme' }).click();
    await expect(panel(page).locator('[data-theme-note]')).toHaveText("Night garden is the site's theme now.");
    expect(readJson(themeFile('night-garden'))).toMatchObject({ id: 'night-garden', name: 'Night garden', basedOn: 'garden', corners: 'rounded', type: { largest: 2, contrast: 2 } });
    expect(readJson(SITE).theme).toBe('night-garden');
    await expect(panel(page).locator('p[data-theme-state]')).toHaveText('Based on Garden · In use');
    // the site itself, with no draft, is drawn in it; edit mode and the design library show the system as it is
    const fresh = await page.context().browser()!.newPage({ baseURL: page.url().replace(/\/_edit\/.*$/, '') });
    await fresh.goto('/');
    await expect(fresh.locator('style[data-site-theme]')).toHaveCount(1);
    await expect.poll(() => token(fresh, '--radius-md')).toBe('1.3125rem');
    await fresh.goto('/_edit/');
    await expect(fresh.locator('style[data-site-theme]')).toHaveCount(0);
    if ((await fresh.request.get('/design/')).ok()) {
      await fresh.goto('/design/');
      await expect(fresh.locator('style[data-site-theme]')).toHaveCount(0);
    }
    await fresh.close();
    // Save on one's own theme
    await panel(page).locator('details[data-theme-group="space"] > summary').click();
    await panel(page).getByRole('radio', { name: 'Tight' }).check();
    await expect(action(page, 'save')).toBeEnabled();
    await action(page, 'save').click();
    await expect(panel(page).locator('[data-theme-note]')).toHaveText('Night garden is saved.');
    expect(readJson(themeFile('night-garden')).spacing).toBe('tight');
    // Rename
    await action(page, 'rename').click();
    const rename = page.getByRole('dialog', { name: 'Rename this theme' });
    await rename.getByRole('textbox', { name: 'Name' }).fill('Evening garden');
    await rename.getByRole('button', { name: 'Save theme' }).click();
    await expect(panel(page).locator('[data-theme-name]')).toHaveText('Evening garden');
    await expect.poll(() => readJson(themeFile('night-garden')).name).toBe('Evening garden');
    // Delete the theme in use: the site goes back to Atiya in the same save
    await action(page, 'delete').click();
    await page.getByRole('dialog', { name: 'Delete this theme?' }).getByRole('button', { name: 'Delete theme' }).click();
    await expect(panel(page).locator('[data-theme-note]')).toHaveText('Evening garden is deleted.');
    expect(existsSync(themeFile('night-garden'))).toBe(false);
    expect(readJson(SITE).theme).toBeUndefined();
    await expect(panel(page).locator('[data-theme-name]')).toHaveText('Atiya');
    // the API refuses a write over a preset
    const r = await page.request.put('/_edit/api/themes/studio', { headers: { 'X-Editor': '1', 'content-type': 'application/json', origin: 'http://localhost:4330' }, data: { theme: { id: 'studio', name: 'Mine' } } });
    expect(r.status()).toBe(422);
  });

  test('colours: a palette, an accent, a picture, one by one with contrast, and Fix contrast', async ({ page }) => {
    await openPanel(page);
    const frame = await site(page);
    await panel(page).locator('[data-theme-palettes] label', { hasText: 'Forest' }).click();
    await expect.poll(() => token(frame, '--color-accent')).toMatch(/#2F6B4A/i);
    // from a picture: a red one gives a red accent
    await panel(page).locator('input[name="picture-file"]').setInputFiles({ name: 'red.png', mimeType: 'image/png', buffer: png(196, 48, 40) });
    await expect(panel(page).locator('[data-theme-swatches] button').first()).toBeVisible();
    await panel(page).locator('[data-theme-swatches] button', { hasText: 'Use these colours' }).click();
    await expect.poll(async () => (await token(frame, '--color-accent')).toUpperCase()).not.toMatch(/2F6B4A/);
    // one by one: a muted text too light to read is flagged, and Fix contrast fixes it
    await panel(page).locator('details[data-theme-roles-group] > summary').click();
    const muted = panel(page).locator('[data-role="text-muted"]');
    await muted.locator('input[data-mode="light"]').fill('#d0d0d0');
    await expect(muted.locator('.role-contrast')).toContainText('under 4.5:1');
    await expect(panel(page).locator('[data-theme-issues]')).toBeVisible();
    await action(page, 'fix-contrast').click();
    await expect(muted.locator('.role-contrast')).not.toContainText('under');
    await expect(panel(page).locator('[data-theme-issues]')).toBeHidden();
  });

  test('the panel passes axe in light and dark', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await openPanel(page);
      for (const g of ['type', 'space']) await panel(page).locator(`details[data-theme-group="${g}"] > summary`).click();
      const r = await new AxeBuilder({ page }).include('[data-theme-panel]').analyze();
      expect(r.violations.map((v) => `${scheme}: ${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    }
  });
});
