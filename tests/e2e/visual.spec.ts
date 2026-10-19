import { test, expect, type Page } from '@playwright/test';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Screenshot tests (documentation/site-ui/design-system-review.md WS1, DS2-01 and DS2-02): every example of
 * every story in the design library, and the website's key pages, in light and dark at three widths, compared
 * with committed baselines (tests/e2e/__screenshots__/). Its own project, `visual`: `npm run visual` checks,
 * `npm run visual:update` rewrites the baselines on purpose and lists what changed.
 */

const ROOT = process.cwd();
const WIDTHS = [360, 768, 1280] as const;
const MODES = ['light', 'dark'] as const;
const TIERS = { fundamentals: 'src/site/components/fundamentals', compounds: 'src/site/components/compounds', layouts: 'src/site/layouts' } as const;

/** The library's slug for a component: ArticleHeader → article-header (src/site/library/registry.ts). */
const slug = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

const stories = readdirSync(join(ROOT, 'src/site/stories'))
  .filter((f) => f.endsWith('.stories.astro'))
  .map((f) => f.replace('.stories.astro', ''))
  .flatMap((name) => {
    const tier = (Object.keys(TIERS) as (keyof typeof TIERS)[]).find((t) => existsSync(join(ROOT, TIERS[t], `${name}.astro`)));
    return tier ? [{ name, tier, path: `/design/${tier}/${slug(name)}/` }] : [];
  });

/** The pages a visitor sees most: the home hub, a section in each view, an article and the Sign in page. */
const PAGES = [
  { name: 'home', path: '/' },
  { name: 'section-features', path: '/writing/' },
  { name: 'section-list', path: '/contact/' },
  { name: 'article', path: '/writing/the-best-learning-loop-will-win/' },
  { name: 'sign-in', path: '/sign-in/' },
];

/**
 * Opens a page fresh for one mode and width: the theme is set before the first paint (as a returning visitor's
 * would be) and the width before the page lays out, so no theme transition or resize handler is caught half-way.
 */
async function open(page: Page, path: string, mode: (typeof MODES)[number], width: number) {
  await page.setViewportSize({ width, height: 900 });
  // init scripts run in the order they're added, so the last one sets the mode
  await page.addInitScript((m) => localStorage.setItem('site.theme', m), mode);
  const response = await page.goto(path);
  expect(response?.ok(), `${path} answers`).toBe(true);
  // a picture's pixels are content, not the design system (and would make the baselines hundreds of MB): its box,
  // corners, shadow and place stay, filled with one flat colour; the overlay scrollbar's handles fade in and out
  // as things scroll, so they're never part of a picture
  await page.addStyleTag({ content: 'img, video { object-position: -99999px -99999px !important; background: #8a8a8a !important; } .sb-thumb { visibility: hidden !important; }' });
  await page.evaluate(() => document.fonts.ready);
  // every picture loads now, not when it scrolls into view: a box can differ by a fraction of a pixel before and after
  // its picture arrives, which moves everything below it
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
/**
 * Stories allowed more changed pixels, each with its reason. Their layout is identical on every load (measured), but
 * text on a fractional pixel row is rasterised one of two ways between runs: about 1% of the example's pixels.
 */
const NOISY: Record<string, string> = {
  PlaceBar: "its building's name sits on a fractional pixel row (y 64.59 at 360 px)",
};
/** A whole page: long pages show a little anti-aliasing noise; a real layout change moves far more than 1%. */
const page_ = { ...shot, fullPage: true, maxDiffPixelRatio: 0.01 };

test.describe('visual: stories', () => {
  for (const s of stories) {
    test(`${s.tier} ${s.name}`, async ({ page }) => {
      test.setTimeout(180_000);
      if (s.tier === 'layouts') {
        // a layout's story is a whole page, shown on its own at /design/demo/<slug>/
        for (const mode of MODES) {
          for (const width of WIDTHS) {
            await open(page, `/design/demo/${slug(s.name)}/`, mode, width);
            await expect.soft(page).toHaveScreenshot(`${slug(s.name)}-1-${mode}-${width}.png`, { ...page_, mask: [page.locator('iframe, video')] });
          }
        }
        return;
      }
      const canvases = page.locator('[data-canvas]');
      for (const mode of MODES) {
        for (const width of WIDTHS) {
          await open(page, s.path, mode, width);
          const count = await canvases.count();
          expect(count, `${s.name} has examples`).toBeGreaterThan(0);
          // the site's sticky header would float over whichever example it scrolls to: keep it at the top of the page
          await page.addStyleTag({ content: '.site-header { position: static !important; }' });
          for (let i = 0; i < count; i++) {
            const canvas = canvases.nth(i);
            await canvas.scrollIntoViewIfNeeded();
            await snap(canvas);
            await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
            // remote and moving media are masked: a YouTube frame or a playing video is never the same twice
            await expect.soft(canvas).toHaveScreenshot(`${slug(s.name)}-${i + 1}-${mode}-${width}.png`, { ...shot, ...(NOISY[s.name] ? { maxDiffPixelRatio: 0.015 } : {}), mask: [canvas.locator('iframe, video')] });
          }
        }
      }
    });
  }
});

test.describe('visual: key pages', () => {
  for (const p of PAGES) {
    test(p.name, async ({ page }) => {
      test.setTimeout(120_000);
      for (const mode of MODES) {
        for (const width of WIDTHS) {
          await open(page, p.path, mode, width);
          await expect.soft(page).toHaveScreenshot(`page-${p.name}-${mode}-${width}.png`, { ...page_, mask: [page.locator('iframe, video')] });
        }
      }
    });
  }
});
