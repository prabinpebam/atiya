/**
 * The Gallery's albums view and an album's page in the browser (docs: documentation/gallery/spec.md §5, §7;
 * plan DoD rows 7 to 12), on the test build's fixture album (`tests/fixtures/gallery/`, public at
 * `/gallery/fixture-album/` in test builds only). The lightbox's own tests are `gallery.spec.ts`.
 */
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';

const ALBUM = JSON.parse(readFileSync('tests/fixtures/gallery/content/articles/fixture-album.json', 'utf8')) as {
  album: { items: { id: string }[]; showcase: { tiles: { item: string; x: number; y: number; w: number; h: number; onPhones?: boolean }[] } };
};
const TILES = ALBUM.album.showcase.tiles;
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
    await expect(cells).toHaveCount(ALBUM.album.items.length);
    expect(await cells.evaluateAll((els) => els.map((e) => e.id))).toEqual(ALBUM.album.items.map((i) => `item-${i.id}`));
    for (const link of await page.locator('li[data-album-cell] a[data-lightbox="album"]').all()) await expect(link).toHaveAccessibleName(/\S/);
    await expect(page.locator('main header').first()).toContainText(/\d+ pictures?/);
    await expect(page.locator('main header').first()).toContainText(/20\d\d/);
    await noSeriousViolations(page);
  });
});

test.describe('gallery: without scripts', () => {
  test.use({ javaScriptEnabled: false });
  test('without scripts every album item is a working link: a picture to its file, a video to its file, an embed to its page', async ({ page, request }) => {
    await page.goto('/gallery/fixture-album/');
    const links = page.locator('li[data-album-cell] a[data-lightbox="album"]');
    await expect(links).toHaveCount(ALBUM.album.items.length);
    const hrefs = await links.evaluateAll((els) => els.map((e) => ({ kind: (e as HTMLElement).dataset.kind, href: (e as HTMLAnchorElement).href })));
    for (const { kind, href } of hrefs) {
      expect(href, `${kind} has a link`).not.toMatch(/#$/);
      if (kind === 'embed') expect(href).toMatch(/^https:\/\/(www\.youtube\.com|youtu\.be|vimeo\.com)\//);
      else expect((await request.head(href)).ok(), `${href} is served`).toBe(true);
    }
  });
});
