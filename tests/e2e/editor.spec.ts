/**
 * Edit mode in the browser (documentation/editor/plan.md §3, §4): the E2E group "editor", its own
 * Playwright project against the fixture dev server (scripts/editor-test-server.mjs, port 4330), which
 * edits a git copy of content/ with a bare remote, never the real content/ or GitHub. Every test that
 * changes the fixture starts from it as prepared (reset()).
 *
 *   npx playwright test --project=editor
 */
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { FIXTURE, REMOTE, reset } from '../../scripts/editor-test-server.mjs';

const ARTICLE = 'do-what-makes-you-proud';
const articleFile = (id = ARTICLE) => join(FIXTURE, 'content/articles', `${id}.json`);
const readJson = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const status = (page: Page) => page.locator('[data-editor-status]');
const saved = (page: Page) => expect(status(page)).toHaveText('Saved', { timeout: 15_000 });
const outlineRows = (page: Page) => page.locator('[data-editor-outline] [data-row]');
const frame = (page: Page) => page.frameLocator('[data-editor-frame]');
const git = (...args: string[]) => execFileSync('git', args, { cwd: FIXTURE, encoding: 'utf8' }).trim();

const noSeriousViolations = async (page: Page, what: string) => {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${what}: ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
};

/** The article editor, with its canvas ready (the page's blocks marked editable). */
async function openArticle(page: Page, id = ARTICLE) {
  await page.goto(`/_edit/articles/${id}/`);
  await expect(frame(page).locator('[data-editor-editable]').first()).toBeVisible({ timeout: 30_000 });
}

test.describe('editor', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120_000);
  test.beforeEach(() => reset());
  test.afterAll(() => reset());

  test('the guard: writes from another origin or without the header are refused, and no screen can be framed elsewhere', async ({ request }) => {
    const json = { 'Content-Type': 'application/json' };
    expect((await request.put('/_edit/api/structure', { headers: { ...json, 'X-Editor': '1', Origin: 'http://evil.localhost:4330' }, data: {} })).status()).toBe(403);
    expect((await request.put('/_edit/api/structure', { headers: { ...json, Origin: 'http://localhost:4330' }, data: {} })).status()).toBe(403);
    expect((await request.put('/_edit/api/structure', { headers: { ...json, 'X-Editor': '1' }, data: {} })).status()).toBe(403);
    expect((await request.put('/_edit/api/structure', { headers: { ...json, 'X-Editor': '1', Origin: 'http://localhost:4330', 'Sec-Fetch-Site': 'cross-site' }, data: {} })).status()).toBe(403);
    for (const path of ['/_edit/', `/_edit/articles/${ARTICLE}/`, '/_edit/api/changes']) {
      const r = await request.get(path);
      expect(r.headers()['x-frame-options'], path).toBe('SAMEORIGIN');
      expect(r.headers()['content-security-policy'], path).toContain("frame-ancestors 'self'");
    }
  });

  test('the way in: a page on the site offers "Edit this page", which opens its article', async ({ page }) => {
    await page.goto(`/leadership/${ARTICLE}/`);
    const launch = page.getByRole('link', { name: 'Edit this page' });
    await expect(launch).toBeVisible();
    await launch.click();
    await expect(page).toHaveURL(new RegExp(`/_edit/articles/${ARTICLE}/$`));
    await page.goto('/leadership/');
    await expect(page.getByRole('link', { name: 'Edit this section' })).toHaveAttribute('href', /\/_edit\/sections\/$/);
  });

  test('text typed on the page saves as Markdown, shows on the site, and reloads no open page; a hand edit does', async ({ page, context }) => {
    const site = await context.newPage();
    await site.goto(`/leadership/${ARTICLE}/`);
    await site.evaluate(() => ((window as unknown as { __kept: number }).__kept = 1));

    await openArticle(page);
    const para = frame(page).locator('[data-editor-editable="rich"]').first();
    await para.click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' Typed ');
    await page.keyboard.press('Control+b');
    await page.keyboard.type('boldly');
    await page.keyboard.press('Control+b');
    await page.keyboard.type(' here.');
    await saved(page);
    const body = readJson(articleFile()).body as { type: string; markdown?: string }[];
    expect(body.find((b) => b.markdown?.includes('Typed'))?.markdown).toMatch(/ Typed \*\*boldly\*\* here\.$/);

    // the open page on the site wasn't reloaded by the save; loading it shows the change
    expect(await site.evaluate(() => (window as unknown as { __kept?: number }).__kept)).toBe(1);
    await site.reload();
    await expect(site.locator('strong', { hasText: 'boldly' })).toBeVisible();

    // a change made outside the editor (by hand) reloads the open page on the site
    await site.evaluate(() => ((window as unknown as { __kept: number }).__kept = 1));
    const doc = readJson(articleFile());
    doc.title = 'Edited by hand';
    writeFileSync(articleFile(), `${JSON.stringify(doc, null, 2)}\n`);
    await expect(site.locator('h1')).toHaveText('Edited by hand', { timeout: 15_000 });
    expect(await site.evaluate(() => (window as unknown as { __kept?: number }).__kept)).toBeUndefined();
  });

  test('the canvas is the public page: the same elements in the same order, apart from the overlay', async ({ page, context }) => {
    await openArticle(page);
    const canvas = page.frame({ url: /\/_edit\/canvas\// });
    expect(canvas).not.toBeNull();
    const shape = () => [...document.querySelectorAll('main *')].filter((e) => !e.closest('[data-editor-chrome]')).map((e) => e.tagName.toLowerCase()).join(' ');
    const site = await context.newPage();
    await site.goto(`/leadership/${ARTICLE}/`);
    const [a, b] = [await canvas!.evaluate(shape), await site.evaluate(shape)];
    expect(a.length).toBeGreaterThan(200);
    expect(a).toBe(b);
  });

  test('a change made elsewhere to an open article stops its saves and says so, and nothing is written over it', async ({ page }) => {
    await openArticle(page);
    const doc = readJson(articleFile());
    writeFileSync(articleFile(), `${JSON.stringify({ ...doc, title: 'Changed elsewhere' }, null, 2)}\n`);
    await frame(page).locator('[data-editor-editable="rich"]').first().click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' Typed after.');
    await expect(page.locator('#editor-conflict')).toBeVisible({ timeout: 15_000 });
    await expect(status(page)).toHaveText('This article changed elsewhere');
    const now = readJson(articleFile());
    expect(now.title).toBe('Changed elsewhere');
    expect(JSON.stringify(now)).not.toContain('Typed after.');
  });

  test('blocks: add from the palette, move, duplicate and delete, and undo brings a deletion back', async ({ page }) => {
    await openArticle(page);
    const count = await outlineRows(page).count();
    const bodyLength = () => (readJson(articleFile()).body as unknown[]).length;

    await page.locator('[data-editor-outline] [data-editor-add-at]').click();
    await page.locator('#editor-palette [data-editor-add="divider"]').click();
    await expect(outlineRows(page)).toHaveCount(count + 1);
    await saved(page);
    expect(bodyLength()).toBe(count + 1);

    await page.locator(`[data-editor-move="up"][data-index="${count}"]`).click();
    await expect(page.locator(`[data-editor-select="${count - 1}"]`)).toHaveAttribute('aria-label', /^Divider/);
    await saved(page);

    await page.locator(`[data-editor-select="${count - 1}"]`).click();
    await frame(page).locator('[data-chrome-op="duplicate"]').click();
    await expect(outlineRows(page)).toHaveCount(count + 2);
    await frame(page).locator('[data-chrome-op="delete"]').click();
    await expect(outlineRows(page)).toHaveCount(count + 1);
    await saved(page);
    await page.locator('[data-editor-undo]').click();
    await expect(outlineRows(page)).toHaveCount(count + 2);
    await saved(page);
    expect(bodyLength()).toBe(count + 2);
  });

  test('tiles: added from the palette with two statements, shown on the page, and a third added in the inspector', async ({ page }) => {
    await openArticle(page);
    const count = await outlineRows(page).count();
    await page.locator('[data-editor-outline] [data-editor-add-at]').click();
    await page.locator('#editor-palette [data-editor-add="tiles"]').click();
    const form = page.locator('#editor-insert-tiles');
    await form.getByLabel('Tile 1: label').fill('Challenge');
    await form.getByLabel('Tile 1: text').fill('Re-energize the team.');
    await form.getByLabel('Tile 2: label').fill('Core idea');
    await form.getByLabel('Tile 2: text').fill('**Do what makes you proud.** A standard chosen from within.');
    await form.getByRole('button', { name: 'Add the tiles' }).click();
    await expect(outlineRows(page)).toHaveCount(count + 1);
    await saved(page);
    const last = () => (readJson(articleFile()).body as { type: string; items?: { label: string }[] }[]).at(-1)!;
    expect(last()).toMatchObject({ type: 'tiles', items: [{ label: 'Challenge' }, { label: 'Core idea' }] });
    const grid = frame(page).locator('[data-tiles]').last();
    await expect(grid.locator('dt')).toHaveText(['Challenge', 'Core idea']);
    await expect(grid.locator('dd strong')).toHaveText('Do what makes you proud.');

    await page.locator(`[data-editor-select="${count}"]`).click();
    await page.locator('[data-editor-tiles="add"]').last().click();
    await saved(page);
    expect(last().items).toHaveLength(3);
  });

  test('the outline: several blocks selected (Shift, Ctrl), moved together by the bar and the keys, deleted together, and undone', async ({ page }) => {
    await openArticle(page);
    const shape = () => (readJson(articleFile()).body as { type: string; markdown?: string; text?: string }[]).map((b) => `${b.type}:${(b.markdown ?? b.text ?? '').slice(0, 24)}`);
    const before = shape();
    // Shift + click: a range (positions 4 and 5)
    await page.locator('[data-editor-select="3"]').click();
    await page.locator('[data-editor-select="4"]').click({ modifiers: ['Shift'] });
    await expect(page.locator('[data-editor-multicount]')).toHaveText('2 blocks selected');
    await page.locator('[data-editor-group="up"]').click();
    await saved(page);
    expect(shape()).toEqual([...before.slice(0, 2), before[3], before[4], before[2], ...before.slice(5)]);
    // the selection follows the blocks, and Alt + Down moves them back together
    await expect(page.locator('[data-editor-select="2"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-editor-select="3"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-editor-select="2"]').focus();
    await page.keyboard.press('Alt+ArrowDown');
    await saved(page);
    expect(shape()).toEqual(before);
    // Ctrl + click adds one apart; Delete deletes the three; Undo brings them back
    await page.locator('[data-editor-select="0"]').click({ modifiers: ['Control'] });
    await expect(page.locator('[data-editor-multicount]')).toHaveText('3 blocks selected');
    await page.locator('[data-editor-select="0"]').focus();
    await page.keyboard.press('Delete');
    await saved(page);
    expect(shape()).toHaveLength(before.length - 3);
    await page.locator('[data-editor-undo]').click();
    await saved(page);
    expect(shape()).toEqual(before);
    await expect(page.locator('[data-editor-multibar]')).toBeHidden();
  });

  test('turn into: a paragraph becomes a list and a heading and back, and tiles become headings and paragraphs and back', async ({ page }) => {
    await openArticle(page);
    const blocks = () => readJson(articleFile()).body as { type: string; markdown?: string; level?: number; items?: unknown[] }[];
    const p = blocks().findIndex((b) => b.type === 'text' && !b.markdown!.startsWith('- '));
    const original = blocks()[p];

    // the inspector's Turn into: a bulleted list (Escape closes the choices without a change)
    await page.locator(`[data-editor-select="${p}"]`).click();
    await page.locator(`[data-block-form="${p}"] [data-editor-turn-open]`).click();
    await expect(page.locator('#editor-turn')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#editor-turn')).toBeHidden();
    await page.locator(`[data-block-form="${p}"] [data-editor-turn-open]`).click();
    await expect(page.locator('#editor-turn [data-editor-turn-to="paragraph"]')).toHaveAttribute('aria-current', 'true');
    await page.locator('#editor-turn [data-editor-turn-to="bulleted"]').click();
    await expect.poll(() => blocks()[p].markdown ?? '').toMatch(/^- /);
    // the keys, on the outline: a heading 3, then a paragraph again
    await page.locator(`[data-editor-select="${p}"]`).focus();
    await page.keyboard.press('Control+Alt+3');
    await expect.poll(() => blocks()[p]).toMatchObject({ type: 'heading', level: 3 });
    await page.locator(`[data-editor-select="${p}"]`).focus();
    // the change reloads the canvas: mark the page it shows now, so the next step waits for the new one
    const canvas = () => page.frames().find((f) => f.url().includes('/_edit/canvas/'))!;
    await canvas().evaluate(() => ((window as unknown as { stale: boolean }).stale = true));
    await page.keyboard.press('Control+Alt+0');
    await expect.poll(() => blocks()[p].type).toBe('text');
    await expect.poll(() => canvas().evaluate(() => !!(window as unknown as { stale?: boolean }).stale).catch(() => true)).toBe(false);

    // on the canvas, while its words are being edited: the keys, and the toolbar offers Turn into
    const words = frame(page).locator('[data-editor-editable="rich"]').first();
    await words.click();
    await expect(frame(page).locator('[data-chrome-turn]')).toBeVisible();
    await page.keyboard.press('Control+Alt+2');
    await expect.poll(() => blocks()[p]).toMatchObject({ type: 'heading', level: 2 });
    await page.locator(`[data-editor-select="${p}"]`).focus();
    await page.keyboard.press('Control+Alt+0');
    await expect.poll(() => blocks()[p].type).toBe('text');

    // tiles into headings and paragraphs, and those, selected, back into the same tiles
    const t = blocks().findIndex((b) => b.type === 'tiles');
    const tiles = blocks()[t];
    const n = (tiles.items as unknown[]).length;
    await page.locator(`[data-editor-select="${t}"]`).click();
    await page.locator(`[data-block-form="${t}"] [data-editor-turn-open]`).click();
    await page.locator('#editor-turn [data-editor-turn-to="untile"]').click();
    await expect.poll(() => blocks().slice(t, t + 2 * n).map((b) => b.type)).toEqual(Array.from({ length: n }, () => ['heading', 'text']).flat());
    await page.locator(`[data-editor-select="${t}"]`).click();
    await page.locator(`[data-editor-select="${t + 2 * n - 1}"]`).click({ modifiers: ['Shift'] });
    await page.locator('[data-editor-group="turn"]').click();
    await page.locator('#editor-turn [data-editor-turn-to="tiles"]').click();
    await expect.poll(() => blocks()[t]).toEqual(tiles);
    expect(original.type).toBe('text');
  });

  test('pasted Markdown becomes its blocks, and its label and text pairs, selected, turn into tiles', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openArticle(page);
    const blocks = () => readJson(articleFile()).body as { type: string; markdown?: string; level?: number; text?: string }[];
    const count = blocks().length;
    const p = blocks().findIndex((b) => b.type === 'text');
    const words = frame(page).locator('[data-editor-editable="rich"]').first();
    await words.click();
    await page.keyboard.press('Control+End');
    await page.evaluate((md) => navigator.clipboard.writeText(md), '### **Constraint**\n\nA team spread over two\ncities.\n\n### Outcome\n\nA **shared** standard.');
    await page.keyboard.press('Control+V');
    await expect.poll(() => blocks().length).toBe(count + 4);
    expect(blocks()[p].type).toBe('text');
    expect(blocks().slice(p + 1, p + 5)).toEqual([
      { type: 'heading', level: 3, text: 'Constraint' },
      { type: 'text', markdown: 'A team spread over two cities.' },
      { type: 'heading', level: 3, text: 'Outcome' },
      { type: 'text', markdown: 'A **shared** standard.' },
    ]);

    await page.locator(`[data-editor-select="${p + 1}"]`).click();
    await page.locator(`[data-editor-select="${p + 4}"]`).click({ modifiers: ['Shift'] });
    await page.locator('[data-editor-group="turn"]').click();
    await page.locator('#editor-turn [data-editor-turn-to="tiles"]').click();
    await expect.poll(() => blocks()[p + 1]).toEqual({
      type: 'tiles',
      items: [
        { label: 'Constraint', text: 'A team spread over two cities.' },
        { label: 'Outcome', text: 'A **shared** standard.' },
      ],
    });
    const grid = frame(page).locator('[data-tiles]', { hasText: 'Constraint' });
    await expect(grid.locator('dt')).toHaveText(['Constraint', 'Outcome']);
    await expect(grid.locator('dd strong')).toHaveText('shared');
  });

  test("a picture's caption can be hidden completely, credit and all, and shown again", async ({ page }) => {
    await openArticle(page);
    const blocks = () => readJson(articleFile()).body as { type: string; showCaption?: boolean }[];
    const i = blocks().findIndex((b) => b.type === 'figure');
    await page.locator(`[data-editor-select="${i}"]`).click();
    const figures = () => frame(page).locator('article figure').filter({ has: frame(page).locator('img') });
    const toggle = page.locator(`[data-block-form="${i}"]`).getByLabel('Show the caption and credit');
    await expect(toggle).toBeChecked();
    const captions = await frame(page).locator('article figcaption').count();
    await toggle.click();
    await expect.poll(() => blocks()[i].showCaption).toBe(false);
    await expect.poll(() => frame(page).locator('article figcaption').count()).toBe(captions - 1);
    await page.locator(`[data-block-form="${i}"]`).getByLabel('Show the caption and credit').click();
    await expect.poll(() => blocks()[i]).not.toHaveProperty('showCaption');
    await expect.poll(() => frame(page).locator('article figcaption').count()).toBe(captions);
    expect(await figures().count()).toBeGreaterThan(0);
  });

  test('a dropdown in a dialog opens over it, never clipped: every option can be clicked where it shows', async ({ page }) => {
    await openArticle(page);
    await page.locator('[data-editor-outline] [data-editor-add-at]').click();
    await page.locator('#editor-palette [data-editor-add="quote"]').click();
    const dialog = page.locator('#editor-insert-quote');
    const style = dialog.getByRole('combobox', { name: 'Style' });
    await style.click();
    const options = dialog.getByRole('option');
    await expect(options.last()).toBeVisible();
    // nothing in the dialog scrolls to make room, and the whole list shows, its bottom edge included
    const layout = await dialog.evaluate((d) => {
      const list = d.querySelector('[role="listbox"]')!;
      const r = list.getBoundingClientRect();
      const at = document.elementFromPoint(r.left + 12, r.bottom - 3);
      return { scrolled: [...d.querySelectorAll('*')].filter((e) => e !== list && e.scrollTop > 0).length, bottomShows: !!at && list.contains(at) };
    });
    expect(layout).toEqual({ scrolled: 0, bottomShows: true });
    for (const o of await options.all()) {
      const hit = await o.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!at && el.contains(at);
      });
      expect(hit).toBe(true);
    }
    await options.last().click();
    await expect(style).toContainText('In the column');
    await expect(style).toHaveAttribute('aria-expanded', 'false');
  });

  test("the page's settings save; a value the contract refuses says why and isn't written", async ({ page }) => {
    await openArticle(page);
    await page.getByRole('tab', { name: 'Page' }).click();
    const summary = page.locator('#page-summary');
    const before = readJson(articleFile()).summary;
    await summary.fill('x'.repeat(200));
    await summary.press('Tab');
    await expect(status(page)).toHaveText(/^Not saved/, { timeout: 15_000 });
    expect(readJson(articleFile()).summary).toBe(before);
    await summary.fill('A shorter summary, set in the test.');
    await summary.press('Tab');
    await saved(page);
    expect(readJson(articleFile()).summary).toBe('A shorter summary, set in the test.');
  });

  test('a new draft renders in the editor, not on the site; published, it is on the site at once, and renamed, its old address simply goes', async ({ page, request }) => {
    await page.goto('/_edit/articles/');
    await page.locator('[data-dialog-open="new-article"]').click();
    const dialog = page.locator('#new-article');
    await dialog.getByLabel('Title').fill('A test story');
    await dialog.getByLabel('Summary').fill('A story the editor test writes.');
    await dialog.getByRole('combobox', { name: 'Section' }).click();
    await dialog.getByRole('option', { name: /Leadership/ }).click();
    await dialog.getByRole('button', { name: 'Create the draft' }).click();
    await expect(page).toHaveURL(/\/_edit\/articles\/a-test-story\/$/);
    await expect(frame(page).locator('h1')).toHaveText('A test story', { timeout: 30_000 });
    expect((await request.get('/leadership/a-test-story/')).status()).toBe(404);

    await page.getByRole('tab', { name: 'Page' }).click();
    await page.getByRole('combobox', { name: 'Status' }).click();
    await page.getByRole('option', { name: /^Published/ }).click();
    await saved(page);
    expect((await request.get('/leadership/a-test-story/')).status()).toBe(200);
    await page.reload();
    await page.getByRole('tab', { name: 'Page' }).click();
    await expect(page.locator('#page-slug')).toBeEditable();
    await page.locator('#page-slug').fill('a-renamed-story');
    await page.locator('#page-slug').press('Tab');
    await saved(page);
    expect((await request.get('/leadership/a-renamed-story/')).status()).toBe(200);
    expect((await request.get('/leadership/a-test-story/')).status()).toBe(404);
  });

  test('duplicate makes a draft copy in the same section; delete removes a draft and its place on the site', async ({ page }) => {
    const copy = `${ARTICLE}-copy`;
    await page.goto('/_edit/articles/');
    await page.locator(`[data-editor-duplicate="${ARTICLE}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/_edit/articles/${copy}/$`));
    expect(readJson(articleFile(copy))).toMatchObject({ id: copy, status: 'draft', title: 'Do what makes you proud (copy)' });
    expect(readJson(articleFile(copy))).not.toHaveProperty('publishedAt');
    expect(JSON.stringify(readJson(join(FIXTURE, 'content/structures/site.json')))).toContain(`"id":"${copy}"`);

    await page.goto('/_edit/articles/');
    await expect(page.locator(`[data-editor-delete="${ARTICLE}"]`)).toHaveCount(0);
    await page.locator(`[data-editor-delete="${copy}"]`).click();
    await page.locator('#delete-article').getByRole('button', { name: 'Delete the draft' }).click();
    await expect(page).toHaveURL(/\/_edit\/articles\/$/);
    await expect(page.locator(`[data-editor-duplicate="${copy}"]`)).toHaveCount(0);
    expect(() => readFileSync(articleFile(copy))).toThrow();
    expect(JSON.stringify(readJson(join(FIXTURE, 'content/structures/site.json')))).not.toContain(copy);
  });

  test('planet: pages put in buildings, moved and taken off, apart from the site; a page\'s own "On the planet"; the rules refuse, and a delete takes a page off', async ({ page }) => {
    const planet = () => readJson(join(FIXTURE, 'content/structures/planet.json')).places as { id: string; kicker: string; pages: { id: string }[] }[];
    const pagesOf = (id: string) => planet().find((p) => p.id === id)!.pages.map((r) => r.id);
    const site = () => JSON.stringify(readJson(join(FIXTURE, 'content/structures/site.json')));
    const before = site();
    expect(pagesOf('lighthouse')).toEqual([ARTICLE]);

    // the same two columns as Sections: off the Lighthouse with Move, then into the Workshop from the pages not on the planet; the site doesn't change
    await page.goto('/_edit/planet/?building=lighthouse');
    await expect(page.locator('[data-manager-section]')).toHaveCount(8);
    const move = async (id: string, to: string) => {
      await page.locator(`[data-manager-grip="${id}"]`).click();
      await page.locator('#manager-move').getByRole('button', { name: to, exact: true }).click();
    };
    await move(ARTICLE, 'Not on the planet');
    await expect.poll(() => pagesOf('lighthouse')).toEqual([]);
    await page.goto('/_edit/planet/?building=_off');
    await move(ARTICLE, 'Workshop');
    await expect.poll(() => pagesOf('workshop')).toEqual([ARTICLE]);
    expect(site()).toBe(before);

    // a building's own words, in its Settings tab
    await page.goto('/_edit/planet/?building=workshop&tab=settings');
    const form = page.locator('[data-planet-place="workshop"]');
    await form.getByLabel('What it holds').fill('Case studies');
    await form.getByRole('button', { name: 'Save the building' }).click();
    await expect.poll(() => planet().find((p) => p.id === 'workshop')!.kicker).toBe('Case studies');

    // the page's settings: back to the Lighthouse, saved with the page
    await openArticle(page);
    await page.getByRole('tab', { name: 'Page' }).click();
    await page.getByRole('combobox', { name: 'On the planet' }).click();
    await page.getByRole('option', { name: /^Lighthouse/ }).click();
    await expect.poll(() => pagesOf('lighthouse')).toEqual([ARTICLE]);
    expect(pagesOf('workshop')).toEqual([]);

    // a draft on the planet can't leave the site (V13), and deleting it takes it off the planet
    const copy = `${ARTICLE}-copy`;
    await page.goto('/_edit/articles/');
    await page.locator(`[data-editor-duplicate="${ARTICLE}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/_edit/articles/${copy}/$`));
    await page.goto('/_edit/planet/?building=_off');
    await move(copy, 'Library');
    await expect.poll(() => pagesOf('library')).toEqual([copy]);
    await page.goto('/_edit/sections/?section=leadership');
    await move(copy, 'Not on the site');
    await expect(page.locator('[data-manager-issue]')).toContainText("isn't on the site; a page on the planet needs its page on the site");
    expect(site()).toContain(`"id":"${copy}"`);
    await page.goto('/_edit/articles/');
    await page.locator(`[data-editor-delete="${copy}"]`).click();
    await page.locator('#delete-article').getByRole('button', { name: 'Delete the draft' }).click();
    await expect(page).toHaveURL(/\/_edit\/articles\/$/);
    await expect.poll(() => pagesOf('library')).toEqual([]);
  });

  test("crop: a picture's tip and note; the lead picture cropped to 21:9 into a copy (the original kept), a 3:2 thumbnail cut from it, the copy cut again in place; the library's crop; a card shows its thumbnail whole", async ({ page }) => {
    const ORIGINAL = `articles/${ARTICLE}/mark-sculpted-clay`;
    const media = join(FIXTURE, 'content/media');
    const sidecar = (id: string) => readJson(join(media, `${id}.json`));
    const dims = async (id: string) => {
      const m = await sharp(readFileSync(join(media, `${id}.webp`))).metadata();
      return [m.width, m.height];
    };
    const original = readFileSync(join(media, `${ORIGINAL}.webp`));
    expect(readJson(articleFile()).hero.media).toBe(ORIGINAL);

    await openArticle(page);
    await page.getByRole('tab', { name: 'Page' }).click();
    const lead = page.locator('[data-editor-picture="lead"]');
    await expect(lead).toContainText('Best at 21:9, at least 2400 × 1029 px.');
    await expect(lead).toContainText('This one is 1024 × 576 px (16:9). The page crops it to 21:9');

    // the lead picture at its shape, 21:9: the keys and a handle move the box, and Save makes a copy
    await lead.getByRole('button', { name: 'Crop' }).click();
    const dialog = page.locator('#crop');
    const readout = dialog.locator('[data-crop-readout]');
    const shape = dialog.getByRole('combobox', { name: 'Shape' });
    const save = dialog.getByRole('button', { name: 'Save the crop' });
    await expect(shape).toContainText('21:9');
    await expect(readout).toHaveText('1024 × 439 px (21:9), from 1024 × 576');
    await expect(dialog.locator('[data-crop-warn]')).toBeVisible();
    await expect(dialog.getByRole('group', { name: 'Crop area' })).toBeFocused();
    await page.keyboard.press('-');
    await expect(readout).not.toContainText('1024 × 439');
    await expect(readout).toContainText('(21:9)');
    const h = (await dialog.locator('[data-handle="se"]').boundingBox())!;
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(h.x + h.width / 2 - 80, h.y + h.height / 2 - 40, { steps: 6 });
    await page.mouse.up();
    await expect(readout).toContainText('(21:9)');
    await page.keyboard.press('Home');
    await save.click();
    await expect(dialog).toBeHidden();
    const COPY = `${ORIGINAL}-21x9`;
    await expect.poll(() => readJson(articleFile()).hero.media, { timeout: 15_000 }).toBe(COPY);
    const cut = sidecar(COPY);
    expect(cut).toMatchObject({ alt: sidecar(ORIGINAL).alt, crop: { from: ORIGINAL } });
    expect(await dims(COPY)).toEqual([cut.crop.width, cut.crop.height]);
    expect(Math.abs(cut.crop.width / cut.crop.height - 21 / 9)).toBeLessThan(0.01);
    expect(readFileSync(join(media, `${ORIGINAL}.webp`)).equals(original)).toBe(true);

    // the thumbnail, left empty, cropped from the lead picture: a 3:2 copy of the original, its own
    const thumb = page.locator('[data-editor-picture="thumbnail"]');
    await expect(thumb).toContainText('The lead picture');
    await expect(thumb).toContainText('Best at 3:2, at least 960 × 640 px.');
    await thumb.getByRole('button', { name: 'Crop' }).click();
    await expect(shape).toContainText('3:2');
    await expect(readout).toHaveText('864 × 576 px (3:2), from 1024 × 576');
    await expect(dialog.locator('[data-crop-note]')).toContainText('makes a cropped copy');
    await save.click();
    const THUMB = `${ORIGINAL}-3x2`;
    await expect.poll(() => readJson(articleFile()).thumbnail, { timeout: 15_000 }).toBe(THUMB);
    expect(readJson(articleFile()).hero.media).toBe(COPY);
    expect(sidecar(THUMB).crop).toMatchObject({ from: ORIGINAL, width: 864, height: 576 });

    // the lead's copy, cut again from its original: the same picture, updated
    await lead.getByRole('button', { name: 'Crop' }).click();
    await expect(dialog.locator('[data-crop-note]')).toContainText('cuts this cropped copy again');
    await dialog.getByRole('button', { name: 'Reset' }).click();
    await expect(readout).toHaveText('1024 × 439 px (21:9), from 1024 × 576');
    await save.click();
    await expect.poll(() => sidecar(COPY).crop.width, { timeout: 15_000 }).toBe(1024);
    expect(await dims(COPY)).toEqual([1024, 439]);
    expect(readJson(articleFile()).hero.media).toBe(COPY);

    // the library: the original lists its copies, and a crop there (any shape) makes another and opens it
    await page.goto(`/_edit/media/?id=${ORIGINAL}`);
    await expect(page.getByRole('list', { name: 'Cropped copies' }).getByRole('link')).toHaveCount(2);
    await page.getByRole('button', { name: 'Crop the picture' }).click();
    await expect(shape).toContainText('Free');
    await expect(readout).toHaveText('1024 × 576 px (16:9), from 1024 × 576');
    // (once the dialog has faded in: mid-fade, small text reads as low contrast)
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
    await noSeriousViolations(page, 'the crop');
    await page.keyboard.press('-');
    await save.click();
    await expect(page).toHaveURL(new RegExp(`id=${ORIGINAL}-16x9$`), { timeout: 15_000 });
    await expect(page.locator('[data-editor-media-details]')).toContainText('A cropped copy of mark-sculpted-clay');

    // on the site, the section's card shows the thumbnail, whole
    await page.goto('/leadership/');
    const img = page.locator('main article.card img').first();
    await expect(img).toHaveCSS('object-fit', 'contain');
    expect(decodeURIComponent((await img.getAttribute('src')) ?? '')).toContain('mark-sculpted-clay-3x2');
  });

  test('media: an upload becomes a WebP master with its alt text, usable at once; its details save; a used picture cannot be deleted', async ({ page }) => {
    await page.goto('/_edit/media/');
    await page.getByText('Upload a picture').click();
    const buffer = await sharp({ create: { width: 900, height: 600, channels: 3, background: { r: 30, g: 140, b: 90 } } }).png().toBuffer();
    await page.locator('[data-editor-upload] input[type="file"]').setInputFiles({ name: 'E2E Swatch.png', mimeType: 'image/png', buffer });
    await page.locator('[data-editor-upload]').getByLabel('Alt text').fill('A green swatch');
    await page.locator('[data-editor-upload]').getByRole('button', { name: 'Upload it' }).click();
    await expect(page).toHaveURL(/\?id=shared\/e2e-swatch$/, { timeout: 30_000 });
    // from the bytes: a path would keep the file open, and Windows would refuse the reset's delete
    expect((await sharp(readFileSync(join(FIXTURE, 'content/media/shared/e2e-swatch.webp'))).metadata()).format).toBe('webp');

    const details = page.locator('[data-editor-media-form]');
    await details.getByLabel('Caption').fill('A swatch, uploaded by the test.');
    await details.getByRole('button', { name: 'Save the details' }).click();
    await saved(page);
    expect(readJson(join(FIXTURE, 'content/media/shared/e2e-swatch.json'))).toMatchObject({ alt: 'A green swatch', caption: 'A swatch, uploaded by the test.' });
    await expect(page.getByRole('button', { name: 'Delete the picture' })).toBeEnabled();

    await page.goto(`/_edit/media/?id=articles/${ARTICLE}/tshirt`);
    await expect(page.locator('[data-editor-media-details]').getByRole('link', { name: /Article: Do what makes you proud/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete the picture' })).toBeDisabled();
  });

  test('sections: the sections beside the chosen one\'s pages and settings; a new section moved up; a published page dragged onto another section, back with Move, its old address simply gone; the keys; a selection moved together; Find and Show', async ({ page }) => {
    const structure = () => readJson(join(FIXTURE, 'content/structures/site.json'));
    const ids = () => structure().home.children.map((c: { id: string }) => c.id) as string[];
    const pagesOf = (id: string) => (structure().home.children.find((c: { id: string }) => c.id === id).children ?? []).map((c: { item: { id: string } }) => c.item.id);
    const redirects = () => JSON.stringify(readJson(join(FIXTURE, 'content/redirects.json')));
    const before = redirects();
    const section = (id: string) => page.locator(`[data-manager-section="${id}"]`);
    const grip = (id: string) => page.locator(`[data-manager-grip="${id}"]`);
    const moveTo = async (name: string) => page.locator('#manager-move').getByRole('button', { name, exact: true }).click();
    /** Drags a page's handle onto `at` (a section in the list, or a row: its top half). */
    const drag = async (id: string, at: import('@playwright/test').Locator, top = false) => {
      const a = (await grip(id).boundingBox())!;
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await page.mouse.down();
      const b = (await at.boundingBox())!;
      await page.mouse.move(b.x + b.width / 2, top ? b.y + 4 : b.y + b.height / 2, { steps: 12 });
      await expect(page.locator('[data-manager-ghost]')).toBeVisible();
      await page.mouse.up();
    };
    await page.goto('/_edit/sections/');
    const count = ids().length;
    // the home page, each section, and the pages in none
    await expect(page.locator('[data-manager-section]')).toHaveCount(count + 2);

    // a new section goes last and opens; Move up, in its settings, moves it
    await page.locator('[data-dialog-open="new-section"]').click();
    await page.locator('#new-section').getByLabel('Title').fill('Field notes');
    await page.locator('#new-section').getByRole('button', { name: 'Add the section' }).click();
    await expect(page).toHaveURL(/[?&]section=field-notes$/);
    expect(ids().at(-1)).toBe('field-notes');
    expect(structure().home.children.at(-1)).toMatchObject({ id: 'field-notes', kind: 'hub', slug: 'field-notes', title: 'Field notes', view: 'tiles' });
    await expect(section('field-notes')).toHaveAttribute('aria-current', 'true');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/tab=settings/);
    await page.locator('[data-sections-hub="field-notes"]').getByRole('button', { name: 'Move up' }).click();
    await expect.poll(() => ids().indexOf('field-notes')).toBe(count - 1);
    // and back down with the keys, on its place in the list
    await expect(page.locator('[data-sections-hub="field-notes"]')).toBeVisible({ timeout: 15_000 });
    await section('field-notes').focus();
    await page.keyboard.press('Alt+ArrowDown');
    await expect.poll(() => ids().at(-1)).toBe('field-notes');

    // the published page, dragged from Leadership onto Field notes in the list: it moves, and no redirect is written
    await page.goto('/_edit/sections/?section=leadership');
    await drag(ARTICLE, section('field-notes'));
    await expect.poll(() => pagesOf('field-notes')).toEqual([ARTICLE]);
    expect(pagesOf('leadership')).toEqual([]);
    expect(redirects()).toBe(before);
    expect((await page.request.get(`/field-notes/${ARTICLE}/`)).status()).toBe(200);
    expect((await page.request.get(`/leadership/${ARTICLE}/`)).status()).toBe(404);
    await expect(section('field-notes')).toBeFocused({ timeout: 15_000 });

    // back to Leadership with Move: the handle's click, in Field notes
    await section('field-notes').click();
    await expect(page).toHaveURL(/section=field-notes/);
    await grip(ARTICLE).click();
    await moveTo('Leadership');
    await expect.poll(() => pagesOf('leadership')).toEqual([ARTICLE]);

    // two copies (drafts, in Leadership too): the keys move one; the two, selected, move together
    for (let i = 0; i < 2; i++) {
      await page.goto('/_edit/articles/');
      await page.locator(`[data-editor-duplicate="${ARTICLE}"]`).click();
      await expect(page).toHaveURL(/\/_edit\/articles\/.+-copy(-2)?\/$/);
    }
    const [one, two] = [`${ARTICLE}-copy`, `${ARTICLE}-copy-2`];
    expect(pagesOf('leadership')).toEqual([ARTICLE, one, two]);
    await page.goto('/_edit/sections/?section=leadership');
    await grip(two).focus();
    await page.keyboard.press('Alt+ArrowUp');
    await expect.poll(() => pagesOf('leadership')).toEqual([ARTICLE, two, one]);
    await expect(grip(two)).toBeFocused({ timeout: 15_000 });
    // and a drag within the list: the last to the top
    await drag(one, page.locator(`[data-manager-row="${ARTICLE}"]`), true);
    await expect.poll(() => pagesOf('leadership')).toEqual([one, ARTICLE, two]);

    // Find and Show narrow the list
    const panel = page.locator('[data-manager-pages="leadership"]');
    const shown = panel.locator('[data-manager-row]:visible');
    await expect(shown).toHaveCount(3);
    await panel.getByLabel('Find a page').fill('copy');
    await expect(shown).toHaveCount(2);
    await expect(panel.locator('[data-manager-count]')).toHaveText('2 of 3 pages');
    await panel.getByLabel('Find a page').fill('');
    await panel.getByRole('combobox', { name: 'Show' }).click();
    await page.getByRole('option', { name: 'Published', exact: true }).click();
    await expect(shown).toHaveCount(1);
    await panel.getByRole('combobox', { name: 'Show' }).click();
    await page.getByRole('option', { name: 'Every status' }).click();
    await expect(shown).toHaveCount(3);

    // select the two copies, and move them to Writing in one go, in their order
    await panel.locator(`[data-manager-pick="${two}"]`).click();
    await panel.locator(`[data-manager-pick="${one}"]`).click();
    await expect(panel.locator('[data-manager-count]')).toHaveText('2 selected');
    await panel.getByRole('button', { name: 'Move selected' }).click();
    await expect(page.locator('[data-manager-move-name]')).toHaveText('2 pages, in Leadership');
    await moveTo('Writing');
    await expect.poll(() => pagesOf('writing')).toEqual([one, two]);
    expect(pagesOf('leadership')).toEqual([ARTICLE]);

    // a selection dragged onto a section goes with it: all of it, in its order
    await page.goto('/_edit/sections/?section=writing');
    const writing = page.locator('[data-manager-pages="writing"]');
    await writing.getByText('Select all').click();
    await expect(writing.locator('[data-manager-count]')).toHaveText('2 selected');
    await drag(two, section('talks'));
    await expect.poll(() => pagesOf('talks')).toEqual([one, two]);
    expect(pagesOf('writing')).toEqual([]);
  });

  test('navigation: a section in and out from Sections and from Navigation; a link added, renamed, moved and removed; the header follows', async ({ page }) => {
    const menu = () => (readJson(join(FIXTURE, 'content/structures/site.json')).menus?.primary ?? []) as { node?: string; label?: string; href?: string }[];
    const nodes = () => menu().map((e) => e.node ?? e.label);
    const count = menu().length;
    expect(nodes()).toContain('contact');

    // from Sections: Contact's switch off takes it out of the navigation, and nothing else changes
    await page.goto('/_edit/sections/?section=contact');
    await page.getByRole('tab', { name: 'Settings' }).click();
    const form = page.locator('[data-sections-hub="contact"]');
    await form.getByRole('switch', { name: 'In the navigation' }).uncheck();
    await form.getByRole('button', { name: 'Save the section' }).click();
    await expect.poll(nodes).not.toContain('contact');
    expect(menu()).toHaveLength(count - 1);

    // from Navigation: back in, at the end
    await page.goto('/_edit/navigation/');
    await expect(page.locator('[data-nav-entry]')).toHaveCount(count - 1);
    const add = page.locator('[data-nav-add="section"]');
    await add.getByRole('combobox', { name: 'Section' }).click();
    await page.getByRole('option', { name: /^Contact/ }).click();
    await add.getByRole('button', { name: 'Add section' }).click();
    await expect.poll(() => nodes().at(-1)).toBe('contact');

    // a custom link: added at the end, renamed, moved up one, then removed
    const link = page.locator('[data-nav-add="link"]');
    await link.getByLabel('Link label').fill('GitHub');
    await link.getByLabel('Address').fill('https://github.com/prabinpebam');
    await link.getByRole('button', { name: 'Add link' }).click();
    await expect.poll(() => menu().at(-1)).toEqual({ label: 'GitHub', href: 'https://github.com/prabinpebam' });
    expect(menu()).toHaveLength(count + 1);
    const last = count;
    const label = page.locator(`[data-nav-label="${last}"] input`);
    await label.fill('Code');
    await label.press('Enter');
    await expect.poll(() => menu().at(-1)?.label).toBe('Code');
    await page.locator(`[data-nav-move="up"][data-index="${last}"]`).click();
    await expect.poll(() => menu().at(-2)?.label).toBe('Code');
    await expect(page.locator(`[data-nav-move="up"][data-index="${last - 1}"]`)).toBeFocused();

    // the site's header follows, on its pages
    await page.goto('/');
    const header = page.getByRole('navigation', { name: 'Sections' });
    await expect(header.getByRole('link', { name: 'Code' })).toHaveAttribute('href', 'https://github.com/prabinpebam');
    await expect(header.getByRole('link').filter({ hasNotText: 'Explore in 3D' }).last()).toHaveText('Contact');

    await page.goto('/_edit/navigation/');
    await page.getByRole('button', { name: 'Remove Code from the navigation' }).click();
    await expect.poll(() => menu().some((e) => e.label === 'Code')).toBe(false);
    expect(menu()).toHaveLength(count);
  });

  test('publish: commits content/ only, pushes it to the remote, and discard puts a change back', async ({ page }) => {
    // two changes: one to publish, one to discard
    const site = readJson(join(FIXTURE, 'content/site.json'));
    writeFileSync(join(FIXTURE, 'content/site.json'), `${JSON.stringify({ ...site, positioning: 'Set by the publish test.' }, null, 2)}\n`);
    const person = readJson(join(FIXTURE, 'content/people/prabin.json'));
    writeFileSync(join(FIXTURE, 'content/people/prabin.json'), `${JSON.stringify({ ...person, role: 'Discarded' }, null, 2)}\n`);
    await page.goto('/_edit/publish/');
    await expect(page.getByRole('heading', { name: '2 changes to publish' })).toBeVisible();

    await page.locator('[data-publish-discard][data-name^="Person"]').click();
    await page.locator('#publish-discard').getByRole('button', { name: 'Discard it' }).click();
    await expect(page.getByRole('heading', { name: '1 change to publish' })).toBeVisible({ timeout: 15_000 });
    expect(readJson(join(FIXTURE, 'content/people/prabin.json')).role).toBe(person.role);

    await expect(page.getByLabel('Message')).toHaveValue('Content: the site settings');
    await page.getByRole('button', { name: 'Publish', exact: true }).last().click();
    await expect(page.getByRole('heading', { name: 'Published' })).toBeVisible({ timeout: 30_000 });
    expect(git('show', '--name-only', '--format=%s', 'HEAD').split('\n')).toEqual(['Content: the site settings', '', 'content/site.json']);
    expect(execFileSync('git', [`--git-dir=${REMOTE}`, 'log', '-1', '--format=%s', 'main'], { encoding: 'utf8' }).trim()).toBe('Content: the site settings');
    await expect(page.getByRole('button', { name: 'Publish', exact: true }).last()).toBeDisabled();
  });

  test('a push the remote refuses keeps the commit, says why, and Push again sends it once the branch is up to date', async ({ page }) => {
    // someone else pushed first: the remote is ahead
    const other = join(tmpdir(), `editor-e2e-other-${Date.now()}`);
    execFileSync('git', ['clone', '-q', REMOTE, other]);
    execFileSync('git', ['-c', 'user.name=O', '-c', 'user.email=o@localhost', 'commit', '-q', '--allow-empty', '-m', 'elsewhere'], { cwd: other });
    execFileSync('git', ['push', '-q'], { cwd: other });
    rmSync(other, { recursive: true, force: true });

    const site = readJson(join(FIXTURE, 'content/site.json'));
    writeFileSync(join(FIXTURE, 'content/site.json'), `${JSON.stringify({ ...site, positioning: 'Pushed later.' }, null, 2)}\n`);
    await page.goto('/_edit/publish/');
    await page.getByRole('button', { name: 'Publish', exact: true }).last().click();
    await expect(page.getByRole('heading', { name: '1 commit not on GitHub yet' })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-publish-push-issue]')).toContainText('newer commits');

    git('pull', '-q', '--rebase');
    await page.getByRole('button', { name: 'Push again' }).click();
    await expect(page.getByRole('heading', { name: 'Published' })).toBeVisible({ timeout: 30_000 });
    expect(execFileSync('git', [`--git-dir=${REMOTE}`, 'log', '-1', '--format=%s', 'main'], { encoding: 'utf8' }).trim()).toBe('Content: the site settings');
  });

  test('the theme switch changes the whole of edit mode, its canvas with it, and every other open page of the site', async ({ page, context }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await openArticle(page);
    const site = await context.newPage();
    await site.goto(`/leadership/${ARTICLE}/`);
    const background = () => [document.querySelector('[data-editor-app]'), document.body, document.documentElement].map((el) => (el ? getComputedStyle(el).backgroundColor : '')).find((c) => c && c !== 'rgba(0, 0, 0, 0)') ?? '';
    const light = await page.evaluate(background);
    const canvasLight = await page.frame({ url: /\/_edit\/canvas\// })!.evaluate(background);

    const theme = page.getByRole('combobox', { name: 'Colour theme' });
    await theme.click();
    await page.getByRole('option', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(frame(page).locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(site.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(background)).not.toBe(light);
    expect(await page.frame({ url: /\/_edit\/canvas\// })!.evaluate(background)).not.toBe(canvasLight);

    // it's the site's choice: kept on the next screen, from its first paint
    await page.goto('/_edit/media/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('combobox', { name: 'Colour theme' }).click();
    await expect(page.getByRole('option', { name: 'Dark' })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('option', { name: 'Match system' }).click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./);
    await expect(site.locator('html')).not.toHaveAttribute('data-theme', /./);
  });

  test('every screen passes axe, in light and in dark', async ({ page }) => {
    const screens = ['/_edit/', '/_edit/articles/', `/_edit/articles/${ARTICLE}/`, '/_edit/sections/', '/_edit/navigation/', '/_edit/planet/', `/_edit/media/?id=articles/${ARTICLE}/tshirt`, '/_edit/settings/', '/_edit/publish/'];
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const path of screens) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        await noSeriousViolations(page, `${scheme} ${path}`);
      }
    }
  });
});
