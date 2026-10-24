/**
 * Edit mode's performance work, end to end (documentation/editor/spec.md §2.2 and §3.6; documentation/
 * engineering/performance-report.md R5, R6, R12): changes show at once and the save only confirms them,
 * a refused change is put back, typing is never redrawn under the person, the canvas never blanks, and no
 * wait is silent (the API is held back by the test, so each wait is long enough to see).
 */
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURE, reset } from '../../scripts/editor-test-server.mjs';

const ARTICLE = 'do-what-makes-you-proud';
const frame = (page: Page) => page.frameLocator('[data-editor-frame]');
const status = (page: Page) => page.locator('[data-editor-status]');
const task = (page: Page) => page.locator('[data-editor-task]');
const rows = (page: Page) => page.locator('[data-editor-outline] [data-editor-rows] > [data-row] [data-editor-select]');
const labelsOf = (page: Page) => rows(page).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
const articleFile = () => join(FIXTURE, 'content/articles', `${ARTICLE}.json`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function openArticle(page: Page) {
  await page.goto(`/_edit/articles/${ARTICLE}/`);
  await expect(frame(page).locator('[data-editor-editable]').first()).toBeVisible({ timeout: 30_000 });
}

/** The canvas's blocks, in order: the first words of each element after a block's comment. */
const canvasBlocks = (page: Page) =>
  page.evaluate(() => {
    const prose = document.querySelector<HTMLIFrameElement>('[data-editor-frame]')?.contentDocument?.querySelector('.prose');
    const out: string[] = [];
    let mark = false;
    for (const n of prose ? [...prose.childNodes] : []) {
      if (n.nodeType === Node.COMMENT_NODE && /^editor-block:\d+$/.test((n as Comment).data.trim())) mark = true;
      else if (n.nodeType === Node.ELEMENT_NODE && mark) {
        out.push(((n as Element).textContent ?? '').trim().slice(0, 30));
        mark = false;
      }
    }
    return out;
  });

/** The article's saves held back by `ms`: the save is slow, the screen mustn't be. */
const slowSaves = (page: Page, ms = 2000) =>
  page.route(`**/_edit/api/articles/${ARTICLE}`, async (route) => {
    if (route.request().method() === 'PUT') await sleep(ms);
    await route.continue();
  });

test.describe('editor: optimistic edits', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120_000);
  test.beforeEach(() => reset());
  test.afterAll(() => reset());

  test('a move shows at once in the outline and the canvas, and stays once saved', async ({ page }) => {
    await openArticle(page);
    await slowSaves(page);
    const labels = await labelsOf(page);
    const before = await canvasBlocks(page);
    await rows(page).nth(2).click();
    await page.locator('[data-editor-outline] [data-editor-move="down"][data-index="2"]').click();
    // at once: well before the held-back save comes back
    await expect(rows(page).nth(3)).toHaveAttribute('aria-label', labels[2]!, { timeout: 400 });
    await expect(rows(page).nth(2)).toHaveAttribute('aria-label', labels[3]!, { timeout: 400 });
    await expect.poll(async () => (await canvasBlocks(page)).slice(2, 4), { timeout: 400, intervals: [50] }).toEqual([before[3], before[2]]);
    await expect(status(page)).toHaveText(/Saving/);
    await expect(status(page)).toHaveText(/^Saved\b/, { timeout: 15_000 });
    await sleep(1500);
    await expect(rows(page).nth(3)).toHaveAttribute('aria-label', labels[2]!);
    expect((await canvasBlocks(page)).slice(2, 4)).toEqual([before[3], before[2]]);
    const saved = JSON.parse(readFileSync(articleFile(), 'utf8'));
    expect(saved.body[3].type).toBe('heading');
  });

  test('a delete and a new block show at once; the new one is named until the canvas draws it', async ({ page }) => {
    await openArticle(page);
    await slowSaves(page);
    const n = await rows(page).count();
    await rows(page).nth(4).click();
    await page.keyboard.press('Delete');
    await expect(rows(page)).toHaveCount(n - 1, { timeout: 400 });
    await expect.poll(async () => (await canvasBlocks(page)).length, { timeout: 400, intervals: [50] }).toBe(n - 1);
    await expect(status(page)).toHaveText(/^Saved\b/, { timeout: 15_000 });
    await page.locator('[data-editor-outline] [data-editor-add-at]').click();
    await page.locator('#editor-palette [data-editor-add="table"]').click();
    await expect(rows(page)).toHaveCount(n, { timeout: 400 });
    await expect(frame(page).locator('[data-editor-arriving]')).toHaveText(/Adding a table/, { timeout: 400 });
    await expect(status(page)).toHaveText(/^Saved\b/, { timeout: 15_000 });
    // the canvas drawn again with it replaces the placeholder
    await expect(frame(page).locator('[data-editor-arriving]')).toHaveCount(0, { timeout: 30_000 });
    await expect(frame(page).locator('.prose table')).not.toHaveCount(0);
  });

  test('a refused save puts the change back, and says why', async ({ page }) => {
    await openArticle(page);
    const labels = await labelsOf(page);
    await page.route(`**/_edit/api/articles/${ARTICLE}`, async (route) => {
      if (route.request().method() !== 'PUT') return route.continue();
      // refused a moment later, so the change is seen first
      await sleep(800);
      await route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ ok: false, issues: [{ file: `content/articles/${ARTICLE}.json`, message: 'refused by the test' }] }) });
    });
    await rows(page).nth(2).click();
    await page.locator('[data-editor-outline] [data-editor-move="down"][data-index="2"]').click();
    await expect(rows(page).nth(3)).toHaveAttribute('aria-label', labels[2]!, { timeout: 400 });
    await expect(status(page)).toHaveText(/refused by the test.*The change was put back/, { timeout: 15_000 });
    await expect(rows(page).nth(2)).toHaveAttribute('aria-label', labels[2]!);
    await expect(rows(page).nth(3)).toHaveAttribute('aria-label', labels[3]!);
  });

  test('typing in the canvas is never redrawn: the page it was typed in stays', async ({ page }) => {
    await openArticle(page);
    const canvas = page.frames().find((f) => f.url().includes('/_edit/canvas/'))!;
    await canvas.evaluate(() => ((window as unknown as { __kept: number }).__kept = 1));
    await frame(page).locator('.prose > p').first().click();
    await page.keyboard.press('End');
    await page.keyboard.type(' still here');
    await expect(status(page)).toHaveText(/^Saved\b/, { timeout: 15_000 });
    await sleep(2000);
    expect(await canvas.evaluate(() => (window as unknown as { __kept?: number }).__kept)).toBe(1);
    await expect(frame(page).locator('.prose > p').first()).toContainText('still here');
  });

  test("a redraw that lands late keeps the inspector's tab", async ({ page }) => {
    await openArticle(page);
    await slowSaves(page, 1500);
    await rows(page).nth(2).click();
    await page.locator('[data-editor-outline] [data-editor-move="down"][data-index="2"]').click();
    await page.getByRole('tab', { name: 'Page', exact: true }).click();
    await expect(status(page)).toHaveText(/^Saved\b/, { timeout: 15_000 });
    await sleep(2500);
    await expect(page.getByRole('tab', { name: 'Page', exact: true })).toHaveAttribute('aria-selected', 'true');
  });

  test('the canvas is never blank while it is drawn again', async ({ page }, info) => {
    await openArticle(page);
    // the new canvas takes a while: the old one must stay in view, whole, until it's ready
    await page.route('**/_edit/canvas/articles/**', async (route) => {
      await sleep(1500);
      await route.continue();
    });
    await page.getByRole('tab', { name: 'Page', exact: true }).click();
    const summary = page.locator('#page-summary');
    await summary.focus();
    await page.keyboard.press('End');
    await page.keyboard.type('.');
    await page.keyboard.press('Tab');
    const watch = page.evaluate(
      () =>
        new Promise<{ blank: number; both: number }>((resolve) => {
          let blank = 0;
          let both = 0;
          const end = performance.now() + 5000;
          const tick = () => {
            const shown = document.querySelector<HTMLIFrameElement>('[data-editor-frame]');
            const blocks = shown?.contentDocument?.querySelectorAll('.prose > *').length ?? 0;
            if (!blocks) blank++;
            if (document.querySelector('[data-editor-incoming]')) both++;
            if (performance.now() < end) requestAnimationFrame(tick);
            else resolve({ blank, both });
          };
          tick();
        }),
    );
    await expect(page.locator('[data-editor-canvas-pill]')).toHaveAttribute('data-busy', 'on', { timeout: 2000 });
    await info.attach('canvas-during-redraw', { body: await page.screenshot(), contentType: 'image/png' });
    const seen = await watch;
    expect(seen.both).toBeGreaterThan(0);
    expect(seen.blank).toBe(0);
    await expect(page.locator('[data-editor-incoming]')).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator('[data-editor-canvas-pill]')).not.toHaveAttribute('data-busy', 'on');
  });
});

test.describe('editor: no silent wait', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120_000);
  test.beforeEach(() => reset());
  test.afterAll(() => reset());

  test("opening a picture's details: its card at once, the details marked updating, words in the status", async ({ page }) => {
    await page.goto('/_edit/media/?view=list');
    const card = page.locator('[data-editor-media-grid] [data-editor-media]').nth(2);
    const id = (await card.getAttribute('data-editor-media'))!;
    await page.route('**/_edit/media/**', async (route) => {
      if (route.request().headers()['x-editor-regions']) await sleep(2000);
      await route.continue();
    });
    await card.click();
    await expect(card).toHaveAttribute('aria-current', 'true', { timeout: 100 });
    await expect(page.locator('[data-region="media-details"]')).toHaveAttribute('data-busy', 'on', { timeout: 700 });
    await expect(task(page)).toHaveText(new RegExp(`Showing ${id.split('/').pop()}`), { timeout: 700 });
    await expect(page.locator(`[data-editor-media-details="${id}"]`)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-region="media-details"]')).not.toHaveAttribute('data-busy', /.+/);
    await expect(task(page)).toBeHidden();
  });

  test("saving a picture's details: the button busy, then Saved at once; the card changed in place", async ({ page }) => {
    await page.goto('/_edit/media/?view=list&id=articles/do-what-makes-you-proud/tshirt');
    await page.route('**/_edit/api/media/**', async (route) => {
      if (route.request().method() === 'PUT') await sleep(2000);
      await route.continue();
    });
    const alt = page.locator('[data-editor-media-form] textarea[name="alt"]');
    await alt.fill('A T-shirt with the new lettering, laid flat');
    // the button's own label says what it's doing past the delay, so it's found by its place, not its name
    const save = page.locator('[data-editor-media-form] button[type="submit"]');
    await save.click();
    await expect(save).toHaveAttribute('aria-busy', 'true', { timeout: 100 });
    await expect(save).toHaveAttribute('data-busy', 'on', { timeout: 700 });
    await expect(save).toHaveText(/Saving the details/);
    await expect(status(page)).toHaveText(/Saving/);
    await expect(status(page)).toHaveText(/^Saved the details/, { timeout: 15_000 });
    await expect(page.locator('[data-editor-media-grid] [data-editor-media="articles/do-what-makes-you-proud/tshirt"]')).toHaveAttribute('aria-label', 'A T-shirt with the new lettering, laid flat');
  });

  test('a setting the canvas shows: the canvas marked as updating, with words', async ({ page }) => {
    await openArticle(page);
    await page.route('**/_edit/canvas/articles/**', async (route) => {
      await sleep(2000);
      await route.continue();
    });
    await page.getByRole('tab', { name: 'Page', exact: true }).click();
    await page.locator('#page-summary').focus();
    await page.keyboard.press('End');
    await page.keyboard.type('!');
    await page.keyboard.press('Tab');
    const pill = page.locator('[data-editor-canvas-pill]');
    await expect(pill).toHaveAttribute('data-busy', 'on', { timeout: 2000 });
    await expect(pill).toHaveAttribute('data-busy-text', /Updating the canvas/);
    await expect(task(page)).toHaveText(/Updating the canvas/);
    await expect(pill).not.toHaveAttribute('data-busy', 'on', { timeout: 15_000 });
    await expect(task(page)).toBeHidden();
  });

  test('the picker fills as it opens, a page at a time, saying how far it has got', async ({ page }) => {
    await openArticle(page);
    await expect(page.locator('#editor-picker [data-picker-pending]')).toHaveCount(1);
    await page.getByRole('tab', { name: 'Page', exact: true }).click();
    await page.locator('[data-editor-pick="thumbnail"]').click();
    const picker = page.locator('#editor-picker');
    await expect(picker.locator('[data-editor-media]').first()).toBeVisible({ timeout: 30_000 });
    // every picture and video, once the last page has landed
    const words = (await picker.locator('[data-editor-media-found]').getAttribute('data-total')) ?? '';
    const all = Number(/^(\d+) pictures?/.exec(words)?.[1] ?? 0) + Number(/(\d+) videos?/.exec(words)?.[1] ?? 0);
    await expect(picker.locator('[data-media-preparing]')).toHaveCount(0, { timeout: 60_000 });
    await expect(picker.locator('[data-editor-media]')).toHaveCount(all);
    await expect(picker.locator('[data-picker-pending]')).toHaveCount(0);
  });

  test('the first start: a plain page that says what it waits for, then the screen', async ({ page }) => {
    const r = await page.request.get('/_edit/__starting?to=/_edit/media/');
    expect(await r.text()).toContain('Starting edit mode');
    const warm = await (await page.request.get('/_edit/__warm')).json();
    expect(warm).toMatchObject({ running: false });
    await page.goto('/_edit/__starting?to=/_edit/media/');
    await expect(page).toHaveURL(/\/_edit\/media\/$/, { timeout: 15_000 });
    await expect(page.locator('[data-editor-app]')).toBeVisible();
  });
});
