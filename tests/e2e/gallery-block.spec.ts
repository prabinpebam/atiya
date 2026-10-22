/**
 * The album block in the browser (docs: documentation/gallery/spec.md §7.2; plan G9, DoD row 28): an album's
 * band inside another page, on the test build's fixture (`tests/fixtures/gallery/`): the page
 * `/gallery/fixture-album-note/` carries the album `fixture-album` as a full-width album block after an h2.
 * Edit mode's side is `editor-album-block.spec.ts`; the lightbox's own tests are `gallery.spec.ts`.
 *
 *   node scripts/test-run.mjs --by agent --purpose "the album block" -- tests/e2e/gallery-block.spec.ts
 */
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGE = '/gallery/fixture-album-note/';
const block = (page: Page) => page.locator('[data-album-block="fixture-album"]');
const band = (page: Page) => block(page).locator('[data-album-band][data-album-id="fixture-album"]');

test.describe('gallery', () => {
  test('an album in another page: its band at the block width, its heading under the page heading, See all to the album', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(PAGE);
    await expect(block(page)).toHaveAttribute('data-breakout', 'full');
    const b = band(page);
    await expect(b).toBeVisible();
    // the last heading before the block is an h2, so the band's heading is an h3
    const heading = b.locator('h3', { hasText: 'A spring in the hills' });
    await expect(heading).toBeVisible();
    await expect(heading.getByRole('link')).toHaveAttribute('href', /\/gallery\/fixture-album\/$/);
    await expect(b.locator('[data-band-counts]')).toContainText(/\d+ pictures?/);
    await expect(b.locator('[data-see-all]')).toHaveAttribute('href', /\/gallery\/fixture-album\/$/);
    expect(await b.locator('[data-tile]').count()).toBeGreaterThan(0);
    // no rule above it: the page's own spacing sets it apart
    await expect(block(page).locator('hr')).toHaveCount(0);
    // full width: as wide as the page, wider than the reading column
    const [blockWidth, textWidth] = await Promise.all([
      block(page).evaluate((el) => el.getBoundingClientRect().width),
      page.locator('.prose > p').first().evaluate((el) => el.getBoundingClientRect().width),
    ]);
    expect(blockWidth).toBeGreaterThan(textWidth);
    const serious = (await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => v.id)).toEqual([]);
  });

  test('an album in another page: no sideways scroll on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(PAGE);
    await expect(band(page)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  });

  // The lightbox opens a band's tile on its whole album; wiring it for an album block is the lightbox's phase
  // (gallery.spec.ts holds its own behaviour). Turn this on with it.
  test('an album in another page: a tile opens the lightbox on the whole album', async ({ page }) => {
    await page.goto(PAGE);
    const first = band(page).locator('[data-tile] a').first();
    await first.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/1 of \d+/);
  });
});
