/**
 * The Gallery's albums view and an album's page in the browser (docs: documentation/gallery/spec.md §5, §7;
 * plan DoD rows 7 to 12), on the test build's fixture album (`tests/fixtures/gallery/`, public at
 * `/gallery/fixture-album/` in test builds only). The lightbox's own tests are `gallery.spec.ts`.
 */
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';

const ALBUM = JSON.parse(readFileSync('tests/fixtures/gallery/content/albums/fixture-album.json', 'utf8')) as {
  items: { id: string; media: string }[];
  cover: { tiles: { item: string; x: number; y: number; w: number; h: number; onPhones?: boolean }[] };
};
const TILES = ALBUM.cover.tiles;
/** The album's items as its page shows them: its default order, oldest taken first (from the sidecars), the undated after. */
const takenOf = (media: string) => (JSON.parse(readFileSync(`tests/fixtures/gallery/content/media/${media}.json`, 'utf8')) as { taken?: string }).taken;
const ORDER = [...ALBUM.items.filter((i) => takenOf(i.media)).sort((a, b) => takenOf(a.media)!.localeCompare(takenOf(b.media)!)), ...ALBUM.items.filter((i) => !takenOf(i.media))];
const band = (page: Page) => page.locator('[data-album-band][data-album-id="fixture-album"]');

const noSeriousViolations = async (page: Page) => {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => `${n.target.join(' ')} (${n.any[0]?.message ?? ''}) ${n.html.slice(0, 120)}`).join(', ')}`)).toEqual([]);
};

const tileBoxes = (page: Page) =>
  band(page).locator('[data-tile]').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { id: (el as HTMLElement).dataset.itemId!, x: r.x, y: r.y, w: r.width, h: r.height, shown: r.width > 0 && getComputedStyle(el).display !== 'none' };
    }),
  );

test.describe('gallery', () => {
  test('the albums view: each album a band with its heading, counts, tiles, description and See all, in square cells', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/gallery/');
    const b = band(page);
    await expect(b).toBeVisible();
    const heading = b.getByRole('heading', { name: 'A spring in the hills' });
    await expect(heading).toBeVisible();
    await expect(heading.getByRole('link')).toHaveAttribute('href', /\/gallery\/fixture-album\/$/);
    await expect(b.locator('[data-band-counts]')).toContainText(/\d+ pictures?/);
    await expect(b.locator('[data-see-all]')).toHaveAttribute('href', /\/gallery\/fixture-album\/$/);
    await expect(b.locator('[data-see-all]')).toHaveAccessibleName(/A spring in the hills/);

    const boxes = await tileBoxes(page);
    expect(boxes.map((t) => t.id)).toEqual(TILES.map((t) => t.item));
    // a cell is square: every tile's width per column equals its height per row, and tiles never overlap
    const cells = boxes.map((box) => {
      const t = TILES.find((x) => x.item === box.id)!;
      return { col: box.w / t.w, row: box.h / t.h };
    });
    const cell = cells[0].col;
    for (const c of cells) {
      expect(Math.abs(c.col - cell), 'columns share one width').toBeLessThan(cell * 0.05);
      expect(Math.abs(c.row - cell), 'rows are as tall as columns are wide').toBeLessThan(cell * 0.05);
    }
    for (const [i, a] of boxes.entries())
      for (const z of boxes.slice(i + 1))
        expect(a.x + a.w <= z.x + 1 || z.x + z.w <= a.x + 1 || a.y + a.h <= z.y + 1 || z.y + z.h <= a.y + 1, `${a.id} and ${z.id} don't overlap`).toBe(true);
  });

  test('band keyboard: focus order is reading order, every tile a named link of 44 px or more, and axe passes in both modes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/gallery/');
    const links = band(page).locator('[data-tile] a');
    const n = await links.count();
    expect(n).toBe(TILES.length);
    const order = await band(page).locator('[data-tile]').evaluateAll((els) =>
      els.map((el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top), left: Math.round(r.left) }; }),
    );
    // DOM order (the focus order) is reading order: by row, then left to right
    const sorted = [...order].sort((a, b) => a.top - b.top || a.left - b.left);
    expect(order).toEqual(sorted);
    for (let i = 0; i < n; i++) {
      const link = links.nth(i);
      await expect(link).toHaveAccessibleName(/\S/);
      const box = (await link.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await links.first().focus();
    await page.keyboard.press('Tab');
    await expect(links.nth(1)).toBeFocused();
    await noSeriousViolations(page);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.reload();
    await noSeriousViolations(page);
  });

  test('on a phone the band follows the phone arrangement, leaves out tiles hidden on phones and never scrolls sideways', async ({ page }) => {
    for (const width of [320, 360]) {
      await page.setViewportSize({ width, height: 740 });
      await page.goto('/gallery/');
      const boxes = await tileBoxes(page);
      for (const t of TILES.filter((x) => x.onPhones === false))
        expect(boxes.find((b) => b.id === t.item)!.shown, `${t.item} is hidden on phones`).toBe(false);
      const shown = boxes.filter((b) => b.shown);
      expect(shown.length).toBeGreaterThan(0);
      for (const box of shown) expect(box.x + box.w).toBeLessThanOrEqual(width + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  });

  test('tiles that play: at most 2 at once, only in view, and Pause stops them for the visit; nothing plays under reduced motion', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/gallery/');
    const b = band(page);
    await expect(b).toHaveAttribute('data-plays', '');
    await b.scrollIntoViewIfNeeded();
    await expect.poll(() => b.locator('[data-tile][data-playing]').count(), { timeout: 15_000 }).toBeGreaterThan(0);
    expect(await b.locator('[data-tile][data-playing]').count()).toBeLessThanOrEqual(2);
    const pause = b.locator('[data-band-pause]');
    await expect(pause).toBeVisible();
    await pause.click();
    await expect(pause).toHaveAttribute('aria-pressed', 'true');
    await expect(b.locator('[data-tile][data-playing]')).toHaveCount(0);
    await page.reload();
    await band(page).scrollIntoViewIfNeeded();
    await expect(band(page).locator('[data-band-pause]')).toHaveAttribute('aria-pressed', 'true');
    await page.waitForTimeout(1500);
    await expect(band(page).locator('[data-tile][data-playing]')).toHaveCount(0);

    await page.evaluate(() => sessionStorage.clear());
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await band(page).scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    await expect(band(page).locator('[data-tile][data-playing]')).toHaveCount(0);
    await expect(band(page).locator('[data-band-pause-slot]')).toBeHidden();
  });

  test('the album page shows every item in album order, each at its own address, with the span of dates in its opening', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/gallery/fixture-album/');
    const cells = page.locator('li[data-album-cell]');
    await expect(cells).toHaveCount(ALBUM.items.length);
    expect(await cells.evaluateAll((els) => els.map((e) => e.id))).toEqual(ORDER.map((i) => `item-${i.id}`));
    for (const link of await page.locator('li[data-album-cell] a[data-lightbox="album"]').all()) await expect(link).toHaveAccessibleName(/\S/);
    await expect(page.locator('main header').first()).toContainText(/\d+ pictures?/);
    await expect(page.locator('main header').first()).toContainText(/20\d\d/);
    await noSeriousViolations(page);
  });

  test('captions under the grid\'s cells when the album asks: its picture\'s, under the picture, each row level, room kept for one without', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    // the fixture album doesn't ask: no caption under its cells
    await page.goto('/gallery/fixture-album/');
    await expect(page.locator('.album-grid[data-layout="grid"]')).toBeVisible();
    await expect(page.locator('.album-grid[data-captions]')).toHaveCount(0);
    await expect(page.locator('[data-cell-caption]')).toHaveCount(0);

    await page.goto('/gallery/fixture-captions/');
    await expect(page.locator('.album-grid[data-layout="grid"][data-captions]')).toBeVisible();
    await expect(page.locator('[data-justified][data-ready]')).toBeAttached();
    const cells = page.locator('li[data-album-cell]');
    // in the album's order: oldest taken first
    expect(await cells.evaluateAll((els) => els.map((e) => e.id))).toEqual(['item-top', 'item-door', 'item-noodles']);
    // the picture's caption, from its sidecar; an item without one keeps its room
    await expect(page.locator('#item-door [data-cell-caption]')).toHaveText('A red door, freshly painted.');
    await expect(page.locator('#item-top [data-cell-caption]')).toHaveText('The view from the top, kept large.');
    await expect(page.locator('#item-noodles [data-cell-caption]')).toHaveText('');
    const boxes = await cells.evaluateAll((els) =>
      els.map((el) => {
        const box = (s: string) => el.querySelector(s)!.getBoundingClientRect();
        const [link, caption] = [box('a[data-lightbox="album"]'), box('[data-cell-caption]')];
        return { top: link.top, linkBottom: link.bottom, linkHeight: link.height, captionTop: caption.top, captionHeight: caption.height };
      }),
    );
    for (const b of boxes) {
      expect(b.captionTop, 'the caption is under its picture').toBeGreaterThanOrEqual(b.linkBottom - 1);
      expect(b.captionHeight, 'every caption keeps the same room').toBeCloseTo(boxes[0].captionHeight, 0);
    }
    // cells in a row share their picture's height, so the captions line up
    for (const [i, a] of boxes.entries())
      for (const z of boxes.slice(i + 1)) if (Math.abs(a.top - z.top) < 2) expect(Math.abs(a.linkHeight - z.linkHeight), 'a row is level').toBeLessThan(2);
    await noSeriousViolations(page);
  });

  test('a Story shows every item whole, one after another, with its words under it, and its text card in place; no captions under cells', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/gallery/fixture-story/');
    await expect(page.locator('.album-grid[data-layout="story"]')).toBeVisible();
    await expect(page.locator('[data-justified]')).toHaveCount(0);
    await expect(page.locator('[data-cell-caption]')).toHaveCount(0);
    const cells = page.locator('li[data-album-cell]');
    expect(await cells.evaluateAll((els) => els.map((e) => e.id))).toEqual(['item-cloud', 'item-flags', 'item-map']);
    // every item whole: its picture drawn at its own shape, never cropped to a cell
    for (const cell of await cells.all()) {
      const img = cell.locator('a[data-lightbox="album"] img').first();
      await expect(img).toBeVisible();
      const { w, h, shape, contained } = await img.evaluate((i: HTMLImageElement) => {
        const li = i.closest<HTMLElement>('[data-album-cell]')!;
        const r = i.getBoundingClientRect();
        return { w: r.width, h: r.height, shape: Number(li.dataset.width) / Number(li.dataset.height), contained: getComputedStyle(i).objectFit === 'contain' };
      });
      // a drawing is fitted whole into its box; a picture's box is its own shape, so nothing is cut off
      if (!contained) expect(Math.abs(w / h - shape) / shape, 'drawn whole, at its own shape').toBeLessThan(0.02);
    }
    // one after another, down the page
    const tops = await cells.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ top: r.top, bottom: r.bottom })));
    for (let i = 1; i < tops.length; i++) expect(tops[i].top).toBeGreaterThanOrEqual(tops[i - 1].bottom - 1);
    // its words under it: the description, the caption, when and where it was taken
    const words = (id: string) => page.locator(`#item-${id} figcaption.words`);
    await expect(words('cloud')).toContainText('The cloud sat on the water all morning.');
    await expect(words('cloud')).toContainText('By noon it had lifted, and the islands showed.');
    await expect(words('cloud')).toContainText('Loktak Lake');
    await expect(words('cloud').locator('time')).toContainText(/Taken \w/);
    await expect(words('flags')).toContainText('Prayer flags over the pass on the way down.');
    await expect(words('map')).toContainText('The plan, drawn to scale.');
    for (const id of ['cloud', 'flags', 'map']) {
      const [pic, text] = await Promise.all([page.locator(`#item-${id} a[data-lightbox="album"]`).boundingBox(), words(id).boundingBox()]);
      expect(text!.y, `${id}'s words are under it`).toBeGreaterThanOrEqual(pic!.y + pic!.height - 1);
    }
    // the text card breaks the run where it stands, its words and link drawn; it never opens the lightbox
    const card = page.locator('#item-words[data-album-text]');
    await expect(card).toContainText('Fixture text card: from the pass, the way down to the lake');
    await expect(card.getByRole('link', { name: 'as drawn' })).toHaveAttribute('href', '#item-map');
    await expect(card.locator('[data-lightbox]')).toHaveCount(0);
    const [flags, text, map] = await Promise.all([page.locator('#item-flags').boundingBox(), card.boundingBox(), page.locator('#item-map').boundingBox()]);
    expect(text!.y, 'after the item before it').toBeGreaterThanOrEqual(flags!.y + flags!.height - 1);
    expect(map!.y, 'before the item after it').toBeGreaterThanOrEqual(text!.y + text!.height - 1);
    await noSeriousViolations(page);
  });
});

test.describe('gallery: without scripts', () => {
  test.use({ javaScriptEnabled: false });
  test('without scripts every album item is a working link: a picture to its file, a video to its file, an embed to its page', async ({ page, request }) => {
    await page.goto('/gallery/fixture-album/');
    const links = page.locator('li[data-album-cell] a[data-lightbox="album"]');
    await expect(links).toHaveCount(ALBUM.items.length);
    const hrefs = await links.evaluateAll((els) => els.map((e) => ({ kind: (e as HTMLElement).dataset.kind, href: (e as HTMLAnchorElement).href })));
    for (const { kind, href } of hrefs) {
      expect(href, `${kind} has a link`).not.toMatch(/#$/);
      if (kind === 'embed') expect(href).toMatch(/^https:\/\/(www\.youtube\.com|youtu\.be|vimeo\.com)\//);
      else expect((await request.head(href)).ok(), `${href} is served`).toBe(true);
    }
  });
});
