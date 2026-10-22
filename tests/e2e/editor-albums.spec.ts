/**
 * Edit mode's album items (documentation/gallery/spec.md §9.2 to §9.5; plan G5, Definition of Done row 19): the
 * Items view of the made-up album (tests/fixtures/gallery/content, `fixture-album`): adding from the library, from
 * files and from a YouTube link (the poster taken for you, by the server's stand-in: no provider is reached),
 * moving by keyboard and undoing it, Sort by date taken, an item's caption and Up front, each saved at once.
 * Part of the "editor" project, on the fixture server (port 4330), never the real content/.
 *
 *   node scripts/test-run.mjs --by agent --purpose "album items" -- --project=editor tests/e2e/editor-albums.spec.ts
 */
import { expect, test, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { FIXTURE, reset } from '../../scripts/editor-test-server.mjs';

const ALBUM = 'fixture-album';
const albumFile = () => join(FIXTURE, 'content/articles', `${ALBUM}.json`);
const readJson = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const items = (): { id: string; media?: string; embed?: { provider: string; id: string }; poster?: string; title?: string; caption?: string }[] => readJson(albumFile()).album.items;
const ids = () => items().map((i) => i.id);
const status = (page: Page) => page.locator('[data-editor-status]');
const saved = (page: Page) => expect(status(page)).toHaveText(/^Saved\b/, { timeout: 15_000 });
const cards = (page: Page) => page.locator('[data-album-items] [data-album-card]');
const pick = (page: Page, id: string) => page.locator(`[data-album-pick="${id}"]`);
const FIRST = ['p01', 'p02', 'p03', 'anim', 'p04'];

/** The album's Items view, its cards drawn. */
async function openItems(page: Page, item?: string) {
  await page.goto(`/_edit/articles/${ALBUM}/?view=items${item ? `&item=${item}` : ''}`);
  await expect(page.locator('[data-editor-album]')).toBeVisible();
  await expect(cards(page)).toHaveCount(21);
}

test.describe('editor: albums', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(() => reset());
  test.afterAll(() => reset());

  test('the Items view: every item in album order, numbered, its kind and words shown, the first chosen', async ({ page }) => {
    await openItems(page);
    await expect(page.locator('[data-album-view="items"]')).toHaveAttribute('aria-current', /page|true/);
    const order = await cards(page).evaluateAll((li) => li.map((l) => l.getAttribute('data-album-card')));
    expect(order).toEqual(ids());
    await expect(cards(page).first().locator('.album-card-n')).toHaveText('1');
    await expect(page.locator('[data-album-card="clip"]')).toHaveAttribute('data-album-kind', 'video');
    await expect(page.locator('[data-album-card="talk"]')).toHaveAttribute('data-album-kind', 'embed');
    await expect(page.locator('[data-album-card="plan"]')).toHaveAttribute('data-album-kind', 'drawing');
    // a caption in the album shows as is; without one, the alt text, dimmed
    await expect(page.locator('[data-album-card="p02"] .album-card-words')).toHaveText('Oranges, just in.');
    await expect(page.locator('[data-album-card="p03"] .album-card-words')).toHaveAttribute('data-dimmed', '');
    await expect(page.locator('[data-album-card="p01"] [data-album-upfront-mark]')).toBeVisible();
    await expect(pick(page, 'p01')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-album-details="p01"]')).toBeVisible();
    await expect(page.locator('[data-album-weight]')).not.toBeEmpty();
  });

  test('adding from the library: the chosen pictures join after the chosen card, saved at once', async ({ page }) => {
    await openItems(page, 'p02');
    await page.locator('[data-album-add="library"]').click();
    const picker = page.locator('#editor-picker');
    await expect(picker).toBeVisible();
    const media = picker.locator('[data-editor-media-grid] [data-editor-media]');
    await expect(media.first()).toBeVisible({ timeout: 30_000 });
    await media.nth(0).click();
    await media.nth(1).click();
    await expect(picker.locator('[data-editor-media-use]')).toBeEnabled();
    await picker.locator('[data-editor-media-use]').click();
    await expect(picker).toBeHidden();
    await expect(cards(page)).toHaveCount(23);
    await saved(page);
    const now = items();
    expect(now).toHaveLength(23);
    // after p02, the last added chosen
    expect(now[0].id).toBe('p01');
    expect(now[1].id).toBe('p02');
    expect(now[2].media).toBeTruthy();
    expect(now[3].media).toBeTruthy();
    await expect(pick(page, now[3].id)).toHaveAttribute('aria-pressed', 'true');
  });

  test('adding from files: each gets its alt text, is uploaded to the album and added', async ({ page }) => {
    await openItems(page, 'short');
    const png = await sharp({ create: { width: 900, height: 600, channels: 3, background: { r: 200, g: 120, b: 80 } } }).png().toBuffer();
    await page.locator('[data-album-add="upload"]').click();
    const dialog = page.locator('#album-upload');
    await expect(dialog).toBeVisible();
    await dialog.locator('input[type="file"]').setInputFiles({ name: 'kiln.png', mimeType: 'image/png', buffer: png });
    const row = dialog.locator('[data-album-batch] li');
    await expect(row).toHaveCount(1);
    await expect(row.locator('[data-album-batch-name]')).toHaveText('kiln.png');
    await row.getByLabel('Alt text').fill('A kiln, glowing.');
    await dialog.locator('[data-album-upload-go]').click();
    await expect(dialog).toBeHidden({ timeout: 30_000 });
    await expect(cards(page)).toHaveCount(22);
    await saved(page);
    const last = items().at(-1)!;
    expect(last.media).toMatch(/^articles\/fixture-album\//);
    const sidecar = join(FIXTURE, 'content/media', `${last.media}.json`);
    expect(existsSync(sidecar)).toBe(true);
    expect(readJson(sidecar).alt).toBe('A kiln, glowing.');
  });

  test('a YouTube link: its title and poster are taken, and the video is added', async ({ page }) => {
    await openItems(page, 'short');
    await page.locator('[data-album-add="link"]').click();
    const dialog = page.locator('#album-link');
    await expect(dialog).toBeVisible();
    // an address that isn't a video says so
    await dialog.getByLabel('Address').fill('https://example.com/not-a-video');
    await dialog.getByRole('button', { name: 'Add the video' }).click();
    await expect(dialog.locator('[data-album-form-issue]')).toContainText('YouTube or Vimeo');
    await dialog.getByLabel('Address').fill('https://youtu.be/aBcDeFgHiJk');
    await dialog.getByRole('button', { name: 'Add the video' }).click();
    await expect(dialog).toBeHidden({ timeout: 30_000 });
    await expect(cards(page)).toHaveCount(22);
    await saved(page);
    const added = items().at(-1)!;
    expect(added.embed).toEqual(expect.objectContaining({ provider: 'youtube', id: 'aBcDeFgHiJk' }));
    expect(added.title).toBe('A stand-in video');
    expect(added.poster).toMatch(/^articles\/fixture-album\//);
    expect(existsSync(join(FIXTURE, 'content/media', `${added.poster}.json`))).toBe(true);
    await expect(page.locator(`[data-album-card="${added.id}"]`)).toHaveAttribute('data-album-kind', 'embed');
    await expect(page.locator(`[data-album-details="${added.id}"]`).getByLabel('Title')).toHaveValue('A stand-in video');
  });

  test('moving by keyboard is shown at once and saved; Undo puts it back', async ({ page }) => {
    await openItems(page);
    await pick(page, 'p01').focus();
    await page.keyboard.press('Alt+ArrowDown');
    // shown before the save answers
    await expect(cards(page).nth(1)).toHaveAttribute('data-album-card', 'p01');
    await expect(cards(page).nth(1).locator('.album-card-n')).toHaveText('2');
    await saved(page);
    expect(ids().slice(0, 2)).toEqual(['p02', 'p01']);
    await page.keyboard.press('Alt+End');
    await saved(page);
    expect(ids().at(-1)).toBe('p01');
    await page.locator('[data-editor-undo]').click();
    await saved(page);
    expect(ids().slice(0, 2)).toEqual(['p02', 'p01']);
    await page.keyboard.press('Control+z');
    await saved(page);
    expect(ids().slice(0, FIRST.length)).toEqual(FIRST);
    await expect(cards(page).first()).toHaveAttribute('data-album-card', 'p01');
  });

  test('Sort by date taken: dated items oldest first, the rest after them in their order, and undoable', async ({ page }) => {
    await openItems(page);
    const sort = page.locator('[data-album-sort]');
    await expect(sort).toBeEnabled();
    await sort.click();
    await saved(page);
    const sorted = ids();
    expect(sorted).toEqual(['p01', 'p02', 'p03', 'p04', 'p05', 'p06', 'p12', 'p13', 'anim', 'plan', 'p07', 'clip', 'p08', 'p09', 'p10', 'p11', 'p14', 'p15', 'p16', 'talk', 'short']);
    await expect(cards(page).nth(6)).toHaveAttribute('data-album-card', 'p12');
    await expect(sort).toBeDisabled();
    await page.locator('[data-editor-undo]').click();
    await saved(page);
    expect(ids().slice(0, FIRST.length)).toEqual(FIRST);
  });

  test("an item's caption is this album's, saved as it changes; Up front puts it in the band", async ({ page }) => {
    await openItems(page);
    await pick(page, 'p03').click();
    const details = page.locator('[data-album-details="p03"]');
    await expect(details).toBeVisible();
    await details.getByLabel('Caption').fill('A lake, and the rain coming.');
    await details.getByLabel('Caption').press('Tab');
    await saved(page);
    expect(items().find((i) => i.id === 'p03')?.caption).toBe('A lake, and the rain coming.');
    await expect(page.locator('[data-album-card="p03"] .album-card-words')).toHaveText('A lake, and the rain coming.');
    // the picture's own words stay its own: the media file is unchanged
    expect(readJson(join(FIXTURE, 'content/media/articles/fixture-album/p03.json')).caption).toBeUndefined();

    await details.getByLabel('Up front').check();
    await saved(page);
    const band = readJson(albumFile()).album.showcase.tiles as { item: string }[];
    expect(band.map((t) => t.item)).toContain('p03');
    await expect(page.locator('[data-album-card="p03"] [data-album-upfront-mark]')).toBeVisible();
  });

  test('removing an item keeps its file in the library, and the band stays whole', async ({ page }) => {
    await openItems(page, 'clip');
    await pick(page, 'clip').focus();
    await page.keyboard.press('Delete');
    await expect(cards(page)).toHaveCount(20);
    await saved(page);
    expect(ids()).not.toContain('clip');
    const band = readJson(albumFile()).album.showcase?.tiles as { item: string }[] | undefined;
    expect((band ?? []).map((t) => t.item)).not.toContain('clip');
    expect(existsSync(join(FIXTURE, 'content/media/articles/fixture-album/clip.json'))).toBe(true);
    // the next card is chosen
    await expect(page.locator('[data-album-details="p08"]')).toBeVisible();
  });
});
