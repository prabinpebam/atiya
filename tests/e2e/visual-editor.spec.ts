import { test, expect, type Page } from '@playwright/test';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Screenshot tests for edit mode's parts and kit pieces (documentation/site-ui/design-system-review.md WS1):
 * every example of every story on the dev-only parts library (/_edit/library/<slug>/), in light and dark, at
 * a laptop's width (1024) and a desktop's (1440) and, for the list-and-details screens, a phone's (390). On the editor's fixture
 * server (scripts/editor-test-server.mjs, port 4330), which the `visual` project starts. `npm run visual:update`
 * rewrites the baselines.
 */

const ROOT = process.cwd();
const EDITOR = 'http://localhost:4330';
const MODES = ['light', 'dark'] as const;
/** The screens that change layout on a phone: the list and its details side by side, or one above the other. */
const NARROW = new Set(['AccessManager', 'SectionManager', 'RecommendationsManager', 'HighlightsManager']);
/** Pieces whose examples are live (the test runs, the canvas's frame) or decorative noise (the empty-state pattern). */
const SKIP = new Set(['CanvasFrame', 'IconPattern', 'TestRuns', 'TestStatus']);
const slug = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

const pieces = ['src/site/editor/kit', 'src/site/editor/components']
  .flatMap((dir) => readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.astro')).map((f) => f.replace('.astro', '')))
  .filter((name) => !SKIP.has(name) && existsSync(join(ROOT, 'src/site/editor/stories', `${name}.stories.astro`)));

/**
 * Opens a page fresh for one mode and width: the theme set before the first paint and the width before the page lays
 * out, so no theme transition or resize handler is caught half-way.
 */
async function open(page: Page, url: string, mode: (typeof MODES)[number], width: number) {
  await page.setViewportSize({ width, height: 900 });
  // init scripts run in the order they're added, so the last one sets the mode
  await page.addInitScript((m) => localStorage.setItem('site.theme', m), mode);
  const response = await page.goto(url);
  expect(response?.ok(), `${url} answers`).toBe(true);
  await expect(page.locator('[data-canvas]').first()).toBeVisible();
  // a picture's pixels are content, not the design system (and would make the baselines hundreds of MB): its box,
  // corners, shadow and place stay, filled with one flat colour. Edit mode is an app shell one screen tall whose main
  // area scrolls: here it flows as a page, so a tall example is never clipped or overlapped by the top bar
  await page.addStyleTag({ content: 'img, video { object-position: -99999px -99999px !important; background: #8a8a8a !important; } .sb-thumb { visibility: hidden !important; } .editor { block-size: auto !important; grid-template-rows: auto auto !important; } .editor > * { overflow: visible !important; max-block-size: none !important; }' });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach((i) => ((i as HTMLImageElement).loading = 'eager')));
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), undefined, { timeout: 30_000 });
  await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
  // inside an example, anything sticky (a place bar, a form's foot, a list's pane) is placed by the page's scroll,
  // not by the example: hold it in the flow, so it's drawn where the example puts it
  await page.evaluate(() => {
    for (const canvas of document.querySelectorAll('[data-canvas]')) for (const el of canvas.querySelectorAll('*')) if (getComputedStyle(el).position === 'sticky') (el as HTMLElement).style.setProperty('position', 'static', 'important');
  });
  // every theme switch on the page shows the theme chosen (a Select shows its value once its script is ready)
  await page.waitForFunction(() => [...document.querySelectorAll('[data-theme-switch]')].every((sw) => (sw as HTMLElement).dataset.ready !== undefined));
  // the page's own stylesheets are all in: a picture taken while one is still arriving shows bare HTML
  await page.waitForFunction(() => [...document.styleSheets].length > 0 && [...document.querySelectorAll('link[rel="stylesheet"]')].every((l) => (l as HTMLLinkElement).sheet));
  // two frames for layout, the snapping and the scroll to settle
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
}

/**
 * Moves an example onto whole pixels: an example's place on its page depends on everything above it (a new entry in
 * the library's navigation moves every example by a fraction of a pixel), and text drawn a fraction of a pixel
 * lower is rasterised differently. Snapped, an example is compared only with itself.
 */
async function snap(el: import('@playwright/test').Locator) {
  await el.evaluate((node) => {
    const e = node as HTMLElement;
    e.style.translate = '';
    const r = e.getBoundingClientRect();
    const x = r.left + window.scrollX;
    const y = r.top + window.scrollY;
    e.style.translate = `${Math.ceil(x) - x}px ${Math.ceil(y) - y}px`;
  });
}

const shot = { animations: 'disabled' as const, caret: 'hide' as const, maxDiffPixelRatio: 0.002 };

test.describe('visual: edit mode parts', () => {
  for (const name of pieces) {
    test(name, async ({ page }) => {
      test.setTimeout(180_000);
      const canvases = page.locator('[data-canvas]');
      for (const mode of MODES) {
        for (const width of NARROW.has(name) ? [390, 1024, 1440] : [1024, 1440]) {
          await open(page, `${EDITOR}/_edit/library/${slug(name)}/`, mode, width);
          const count = await canvases.count();
          for (let i = 0; i < count; i++) {
            const canvas = canvases.nth(i);
            await canvas.scrollIntoViewIfNeeded();
            await snap(canvas);
            await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
            // live status (saving, test runs) is never the same twice
            await expect.soft(canvas).toHaveScreenshot(`editor-${slug(name)}-${i + 1}-${mode}-${width}.png`, {
              ...shot,
              mask: [canvas.locator('iframe, video, [data-save-status], [data-test-status], time')],
            });
          }
        }
      }
    });
  }
});
