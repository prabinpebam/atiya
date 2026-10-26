/**
 * The Albums screen's list view (documentation/editor/list-and-details.md B8): choosing between the gallery's setup
 * and an album opens another page, but nothing above the list moves: the same heading and line, the list and the
 * details at the same place, and the details open with a heading either way. The editor project, on the fixture
 * server (port 4330, with the gallery fixture's `fixture-album`).
 *
 *   npx playwright test --project=editor -g "editor: albums: list"
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { FIXTURE, reset } from '../../scripts/editor-test-server.mjs';

const top = async (page: Page, selector: string) => Math.round((await page.locator(selector).first().boundingBox())!.y);

async function layout(page: Page, details: string) {
  await expect(page.locator('main h1')).toBeVisible();
  return {
    heading: await page.locator('main h1').innerText(),
    line: await page.locator('.screen-head p').first().innerText(),
    head: await top(page, '.screen-head'),
    list: await top(page, '[data-album-list]'),
    details: await top(page, details),
  };
}

test.describe('editor: albums: list and details', () => {
  test.beforeEach(() => reset());

  test('the header stays put between the gallery and an album', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/_edit/albums/?view=list');
    const gallery = await layout(page, '#gallery-setup-title');
    expect(gallery.heading).toBe('Albums');

    await page.goto('/_edit/albums/fixture-album/');
    const album = await layout(page, '[data-album-words] h2');
    expect(album).toEqual(gallery);
  });

  test("typing the album's title renames its details' heading and the top bar's", async ({ page }) => {
    await page.goto('/_edit/albums/fixture-album/');
    await page.locator('[data-album-words]').getByLabel('Title', { exact: true }).fill('Harbour walks');
    await expect(page.locator('#album-words-title')).toHaveText('Harbour walks');
    await expect(page.locator('[data-title-line][data-album-heading]')).toHaveText('Harbour walks');
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
});
