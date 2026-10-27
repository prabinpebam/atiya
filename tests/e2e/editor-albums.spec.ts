/**
 * The album editor (documentation/gallery/spec.md §9.2, §9.6): a studio, the albums docked beside the album and
 * the inspector at its end, its Album tab the album's words and settings, its Selection tab the details of what's
 * selected in the album (one item's words, a text card's, or what several share), kept in the address. Then adding
 * in the grid. The editor project, on the fixture server (port 4330, with the gallery fixture's albums).
 *
 *   npx playwright test --project=editor -g "editor: albums"
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { FIXTURE, reset } from '../../scripts/editor-test-server.mjs';

const sidecar = (id: string) => JSON.parse(readFileSync(join(FIXTURE, 'content', 'media', 'articles', 'fixture-album', `${id}.json`), 'utf8')) as { place?: string };
const albumFile = (id: string) => JSON.parse(readFileSync(join(FIXTURE, 'content', 'albums', `${id}.json`), 'utf8')) as { items: { id: string; text?: string }[] };
const inspector = (page: Page) => page.locator('[data-album-inspector]');
const tab = (page: Page, name: string) => inspector(page).getByRole('tab', { name });
test.describe('editor: albums: the inspector', () => {
  test.beforeEach(() => reset());

  test('a studio: the albums beside the album, the inspector at its end on the Album tab, which renames the album as you type', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/_edit/albums/fixture-album/');
    await expect(page.locator('[data-album-list]')).toBeVisible();
    await expect(inspector(page)).toBeVisible();
    await expect(tab(page, 'Album')).toHaveAttribute('aria-selected', 'true');
    await inspector(page).getByLabel('Title', { exact: true }).fill('Harbour walks');
    await expect(page.locator('[data-title-line][data-album-heading]')).toHaveText('Harbour walks');
    const axe = await new AxeBuilder({ page }).include('[data-album-inspector]').analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
  });

  test('a click selects one item and the Selection tab shows it; Ctrl adds to it; the address keeps it', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/_edit/albums/fixture-album/');
    const items = page.locator('[data-album-items] li[data-item]');
    await items.nth(0).click();
    await expect(tab(page, 'Selection')).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(/[?&]selected=p01\b/);
    const selection = page.locator('[data-album-selection]');
    await expect(selection).toHaveAttribute('data-album-selection', 'one');
    await expect(selection.locator('#album-selection-title')).toHaveText('Picture');
    await expect(selection.getByLabel('Caption')).toBeVisible();
    // a plain click on another replaces it
    await items.nth(1).click();
    await expect(page).toHaveURL(/[?&]selected=p02\b/);
    await expect(page.locator('[data-album-items] li[data-item][aria-selected="true"]')).toHaveCount(1);
    await items.nth(2).click({ modifiers: ['Control'] });
    await expect(selection).toHaveAttribute('data-album-selection', 'many');
    await expect(selection.locator('#album-selection-title')).toHaveText('2 selected');
    await page.reload();
    await expect(page.locator('[data-album-selection]')).toHaveAttribute('data-album-selection', 'many');
    await expect(tab(page, 'Selection')).toHaveAttribute('aria-selected', 'true');
  });

  test("several selected: a place set once is each picture's own", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/_edit/albums/fixture-album/?selected=p01,p02');
    const selection = page.locator('[data-album-selection="many"]');
    const place = selection.getByLabel('Place');
    await place.fill('Harbour wall');
    await place.press('Tab');
    await expect.poll(() => [sidecar('p01').place, sidecar('p02').place], { timeout: 30_000 }).toEqual(['Harbour wall', 'Harbour wall']);
  });

  test("a text card's words are edited in the inspector, saved as they're typed", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/_edit/albums/fixture-story/');
    await page.locator('[data-album-items] li[data-item="words"]').click();
    const words = page.locator('[data-album-selection="one"]').getByLabel('Words');
    await expect(words).toBeVisible();
    await words.fill('From the pass, the way down.');
    await expect.poll(() => albumFile('fixture-story').items.find((i) => i.id === 'words')?.text, { timeout: 30_000 }).toBe('From the pass, the way down.');
  });

  test('choosing items shows the selection bar with its count, and Clear selection hides it', async ({ page }) => {
    await page.goto('/_edit/albums/fixture-album/');
    const bar = page.getByRole('group', { name: 'Selected items' });
    await expect(bar).toBeHidden();
    const items = page.locator('[data-album-items] li[data-item]');
    await items.nth(0).click({ modifiers: ['Control'] });
    await items.nth(1).click({ modifiers: ['Control'] });
    await expect(bar).toBeVisible();
    await expect(bar.getByRole('status')).toHaveText('2 selected');
    await bar.getByRole('button', { name: 'Clear selection' }).click();
    await expect(bar).toBeHidden();
  });

  test('a cell focused from the keyboard is never under the selection bar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 520 });
    await page.goto('/_edit/albums/fixture-album/');
    const items = page.locator('[data-album-items] li[data-item]');
    await items.nth(0).click({ modifiers: ['Control'] });
    const bar = page.getByRole('group', { name: 'Selected items' });
    await expect(bar).toBeVisible();
    await page.keyboard.press('End');
    const focused = page.locator('[data-album-items] li[data-item]:focus');
    await expect(focused).toHaveCount(1);
    const cell = (await focused.boundingBox())!;
    const under = (await bar.boundingBox())!;
    expect(cell.y + cell.height).toBeLessThanOrEqual(under.y);
  });
});

const POSTERS = join(process.cwd(), 'tests', 'fixtures', 'gallery', 'content', 'media', 'articles', 'fixture-album');
const storyItems = () => JSON.parse(readFileSync(join(FIXTURE, 'content', 'albums', 'fixture-story.json'), 'utf8')).items as { id: string; media?: string }[];

/** Drops files on `selector` as a person's drag from the desktop would: enter, over, then drop, at its left edge. */
async function dropFiles(page: Page, selector: string, files: string[]) {
  const data = files.map((f) => ({ name: f, bytes: [...readFileSync(join(POSTERS, f))] }));
  const transfer = await page.evaluateHandle((list) => {
    const dt = new DataTransfer();
    for (const f of list) dt.items.add(new File([new Uint8Array(f.bytes)], f.name, { type: 'image/webp' }));
    return dt;
  }, data);
  const box = (await page.locator(selector).boundingBox())!;
  const at = { clientX: box.x + 4, clientY: box.y + box.height / 2 };
  for (const type of ['dragenter', 'dragover', 'drop']) await page.locator(selector).dispatchEvent(type, { dataTransfer: transfer, ...at });
}

test.describe('editor: albums: adding in the grid', () => {
  test.beforeEach(() => reset());

  test("the grid's Add tile opens Add, as the header's button does", async ({ page }) => {
    await page.goto('/_edit/albums/fixture-story/');
    const tile = page.locator('[data-album-items] [data-photo-add]');
    await expect(tile).toBeVisible();
    await expect(page.locator('[data-album-items] li[data-item]').last()).toHaveAttribute('data-item', 'map');
    // a pointer's shortcut, hidden from assistive tech: the listbox holds only its items
    const axe = await new AxeBuilder({ page }).include('[data-album-items]').analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
    await tile.click();
    await expect(page.locator('dialog#album-add')).toBeVisible();
  });

  test('files dropped on an item land before it, in the order dropped', async ({ page }) => {
    // a draft: a published album refuses a picture without alt text (V54), and an upload has none yet
    const file = join(FIXTURE, 'content', 'albums', 'fixture-story.json');
    writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, 'utf8')), status: 'draft' }, null, 2) + '\n');
    await page.goto('/_edit/albums/fixture-story/');
    await dropFiles(page, '[data-album-items] li[data-item="words"]', ['anim.poster.webp', 'clip.poster.webp']);
    const cells = page.locator('[data-album-items] ul[data-photo-cells] > li:not([data-photo-add])');
    await expect(cells).toHaveCount(6);
    await expect(cells.nth(4)).toHaveAttribute('data-item', 'words');
    await expect.poll(() => storyItems().length, { timeout: 30_000 }).toBe(6);
    const items = storyItems();
    expect(items.map((i) => i.id).filter((id) => ['cloud', 'flags', 'words', 'map'].includes(id))).toEqual(['cloud', 'flags', 'words', 'map']);
    expect(items[0].id).toBe('cloud');
    expect(items[1].id).toBe('flags');
    expect(items[2].media).toMatch(/anim/);
    expect(items[3].media).toMatch(/clip/);
    expect(items[4].id).toBe('words');
    await page.reload();
    await expect(page.locator('[data-album-items] li[data-item]').nth(4)).toHaveAttribute('data-item', 'words');
  });

  test('a pasted picture is added as Upload adds it, and a paste into a field stays there', async ({ page }) => {
    const file = join(FIXTURE, 'content', 'albums', 'fixture-story.json');
    writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, 'utf8')), status: 'draft' }, null, 2) + '\n');
    await page.goto('/_edit/albums/fixture-story/');
    const paste = (selector: string) =>
      page.locator(selector).first().evaluate(async (el) => {
        // a screenshot of its own, so the library's duplicate check can't take it for one it has
        const c = new OffscreenCanvas(64, 48);
        const g = c.getContext('2d')!;
        g.fillStyle = `hsl(${Date.now() % 360} 70% 50%)`;
        g.fillRect(0, 0, 64, 48);
        g.fillText(String(Date.now()), 2, 24);
        const dt = new DataTransfer();
        dt.items.add(new File([await c.convertToBlob({ type: 'image/png' })], 'image.png', { type: 'image/png' }));
        el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
      });
    // into a field: not the album's
    await paste('input:not([type="hidden"]), textarea');
    await page.waitForTimeout(500);
    await expect(page.locator('[data-album-items] li[data-upload]')).toHaveCount(0);
    // on the page: an upload, in its place
    await paste('[data-album-items] li[data-item="cloud"]');
    await expect.poll(() => storyItems().length, { timeout: 30_000 }).toBe(5);
    expect(storyItems().some((i) => /pasted-picture/.test(i.media ?? ''))).toBe(true);
  });
});

test.describe('editor: albums: save to remote', () => {
  test.beforeEach(() => reset());

  test("Save to remote opens the article editor's dialog over the album, with only the album's changes ticked", async ({ page }) => {
    const site = join(FIXTURE, 'content', 'site.json');
    writeFileSync(site, JSON.stringify({ ...JSON.parse(readFileSync(site, 'utf8')), positioning: 'Left for a later save.' }, null, 2) + '\n');
    const file = join(FIXTURE, 'content', 'albums', 'fixture-story.json');
    writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, 'utf8')), title: 'Saved on its own' }, null, 2) + '\n');
    await page.goto('/_edit/albums/fixture-story/');
    const albumUrl = page.url();
    await page.getByRole('button', { name: 'Save to remote', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Save to remote' });
    await expect(dialog.getByRole('heading', { name: '2 changes to save' })).toBeVisible({ timeout: 15_000 });
    const row = (name: string) => dialog.locator('li', { has: page.locator(`[data-publish-discard][data-name^="${name}"]`) }).getByRole('checkbox');
    await expect(row('File: albums/fixture-story')).toBeChecked();
    await expect(row('Settings')).not.toBeChecked();
    await dialog.getByRole('button', { name: 'Save 1 of 2 to remote' }).click();
    await expect(dialog.getByRole('heading', { name: 'Saved to remote', exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-editor-remote-status]')).toHaveText('Saved to remote');
    expect(execFileSync('git', ['show', '--name-only', '--format=', 'HEAD'], { cwd: FIXTURE, encoding: 'utf8' }).trim()).toBe('content/albums/fixture-story.json');
    await dialog.getByRole('button', { name: 'Close and keep editing' }).click();
    await expect(page).toHaveURL(albumUrl);
    await expect(page.locator('[data-album-items]')).toBeVisible();
  });
});
