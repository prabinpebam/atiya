import { test, expect, type Page } from '@playwright/test';
import { GALLERY_VIEWS } from '../../src/game/gallery/views';

/**
 * Screenshot tests of the game UI's gallery (documentation/site-ui/design-system-review.md WS1 and DS2-05;
 * documentation/game-ui/design-system.md §9.1): every view of /play/gallery/ (the primitives, the HUD and the wood
 * panels, drawn by the real components from sample data), on the paper and the wood surface, at three widths,
 * compared with committed baselines (tests/e2e/__screenshots__/). The gallery exists in the test build only, never in
 * production. Its own project, `visual`: `npm run visual` checks, `npm run visual:update` rewrites the baselines.
 * The game has no light and dark of its own to compare: paper is the light surface, and wood is shown dark, its own look.
 */

const WIDTHS = [360, 768, 1280] as const;
const SURFACES = ['paper', 'wood'] as const;

async function settle(page: Page, view: string, surface: (typeof SURFACES)[number], width: number) {
  await page.setViewportSize({ width, height: 900 });
  const response = await page.goto(`/play/gallery/?view=${view}&surface=${surface}`);
  expect(response?.ok(), `the gallery's ${view} view answers`).toBe(true);
  await page.locator(`[data-view="${view}"]`).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete || i.loading === 'lazy'));
  // the screens that load on demand (the backpack, Chopper's card) and the crafting book's measured cells
  await page.waitForTimeout(view === 'chopper' || view === 'reading' ? 1500 : 500);
}

const shot = { animations: 'disabled' as const, caret: 'hide' as const, maxDiffPixelRatio: 0.002, fullPage: true };

test.describe('visual: game gallery', () => {
  for (const v of GALLERY_VIEWS) {
    test(`game ${v.id}`, async ({ page }) => {
      test.setTimeout(120_000);
      for (const surface of SURFACES) {
        for (const width of WIDTHS) {
          await settle(page, v.id, surface, width);
          // the 3D views (Chopper's little stage) and the framed site page are never the same twice
          await expect.soft(page).toHaveScreenshot(`game-${v.id}-${surface}-${width}.png`, { ...shot, mask: [page.locator('canvas, iframe')] });
        }
      }
    });
  }
});
