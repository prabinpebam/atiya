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
const saved = (page: Page) => expect(status(page)).toHaveText(/^Saved\b/, { timeout: 15_000 });
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

  test('the minimap works on the page as on the site: a row jumps by click or by key, and the canvas selects nothing for it', async ({ page }) => {
    // wide enough for the canvas to leave the minimap room beside the column
    await page.setViewportSize({ width: 2560, height: 1100 });
    await openArticle(page, 'atiya');
    const f = frame(page);
    const rows = f.locator('[data-minimap] .row');
    await expect(rows.first()).toBeVisible();
    await rows.last().click();
    await expect(rows.last()).toHaveAttribute('aria-current', 'location');
    await expect(f.locator('[data-chrome-selected]')).toBeHidden();
    // with a block selected, Enter on a row is the minimap's: it jumps, and nothing is edited
    await f.locator('.prose > p').first().click();
    await rows.first().focus();
    await page.keyboard.press('Enter');
    await expect(rows.first()).toHaveAttribute('aria-current', 'location');
    await expect(rows.first()).toBeFocused();
  });

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
    const launch = page.getByRole('banner').getByRole('link', { name: 'Edit this page' });
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

  test('a change made elsewhere to an open article comes in at once; with unsaved typing, it stops the saves and says so, and nothing is written over it', async ({ page }) => {
    await openArticle(page);
    const save = page.locator('[data-editor-save]');
    // nothing unsaved here: the change on disk comes in, canvas and all
    writeFileSync(articleFile(), `${JSON.stringify({ ...readJson(articleFile()), title: 'Changed on disk' }, null, 2)}\n`);
    await expect(frame(page).locator('h1')).toHaveText('Changed on disk', { timeout: 15_000 });
    await expect(status(page)).toHaveText('Updated with changes made on disk');
    await expect(page.locator('#editor-conflict')).toBeHidden();

    // typing here, not saved yet, when the file changes again: the saves stop
    await frame(page).locator('[data-editor-editable="rich"]').first().click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' Typed after.');
    await expect(save).toHaveAttribute('data-state', 'dirty');
    writeFileSync(articleFile(), `${JSON.stringify({ ...readJson(articleFile()), title: 'Changed elsewhere' }, null, 2)}\n`);
    await expect(page.locator('#editor-conflict')).toBeVisible({ timeout: 15_000 });
    await expect(status(page)).toHaveText(/^Not saved: this article changed/);
    await expect(save).toHaveAttribute('data-state', 'failed');
    await page.waitForTimeout(1500);
    const now = readJson(articleFile());
    expect(now.title).toBe('Changed elsewhere');
    expect(JSON.stringify(now)).not.toContain('Typed after.');
  });

  test('the save status: all saved on opening, unsaved while typing, then saved and how long ago', async ({ page }) => {
    await openArticle(page);
    const save = page.locator('[data-editor-save]');
    await expect(save).toHaveAttribute('data-state', 'idle');
    await expect(status(page)).toHaveText('All changes saved');
    await frame(page).locator('[data-editor-editable="rich"]').first().click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' Saved as I type.');
    await expect(save).toHaveAttribute('data-state', 'dirty');
    await expect(status(page)).toHaveText('Unsaved changes');
    await expect(save).toHaveAttribute('data-state', 'saved', { timeout: 15_000 });
    await expect(status(page)).toHaveText('Saved');
    await expect(save.locator('time')).toHaveText('just now');
    expect(JSON.stringify(readJson(articleFile()))).toContain('Saved as I type.');
  });

  test("a picture's caption saved in Media shows at once in the open article, in edit mode and on the site", async ({ page, context }) => {
    const blocks = readJson(articleFile()).body as { type: string; media?: string; caption?: string; showCaption?: boolean }[];
    const fig = blocks.find((b) => b.type === 'figure' && !b.caption && b.showCaption !== false)!;
    await openArticle(page);
    const site = await context.newPage();
    await site.goto(`/leadership/${ARTICLE}/`);
    const media = await context.newPage();
    await media.goto(`/_edit/media/?id=${fig.media}`);
    const form = media.locator('[data-editor-media-form]');
    await form.getByLabel('Caption').fill('A caption from the media library.');
    await expect(media.locator('[data-editor-save]')).toHaveAttribute('data-state', 'dirty');
    await expect(status(media)).toHaveText(/^Unsaved changes/);
    await form.getByRole('button', { name: 'Save the details' }).click();
    await expect(status(media)).toHaveText(/^Saved the details of /, { timeout: 15_000 });
    await expect(media.locator('[data-editor-save] time')).toHaveText('just now');
    await expect(frame(page).locator('figcaption', { hasText: 'A caption from the media library.' })).toBeVisible({ timeout: 15_000 });
    await expect(status(page)).toHaveText('Updated with a change made in another tab');
    await expect(site.locator('figcaption', { hasText: 'A caption from the media library.' })).toBeVisible({ timeout: 15_000 });
  });

  test('the same article in two tabs: what one saves shows in the other at once, which then saves after it without a conflict', async ({ page, context }) => {
    const other = await context.newPage();
    await openArticle(page);
    await openArticle(other);
    const words = (p: Page, n: number) => frame(p).locator('[data-editor-editable="rich"]').nth(n);
    await words(page, 0).click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' Written in the first tab.');
    await saved(page);
    await expect(frame(other).locator('[data-editor-editable="rich"]', { hasText: 'Written in the first tab.' })).toBeVisible({ timeout: 15_000 });
    await expect(status(other)).toHaveText('Updated with changes made in another tab');
    await words(other, 1).click();
    await other.keyboard.press('Control+End');
    await other.keyboard.type(' Written in the second tab.');
    await saved(other);
    await expect(other.locator('#editor-conflict')).toBeHidden();
    const text = JSON.stringify(readJson(articleFile()));
    expect(text).toContain('Written in the first tab.');
    expect(text).toContain('Written in the second tab.');
    await expect(frame(page).locator('[data-editor-editable="rich"]', { hasText: 'Written in the second tab.' })).toBeVisible({ timeout: 15_000 });
  });

  test('another screen shows a change made elsewhere at once, and keeps what is being typed in it until that is saved', async ({ page, context }) => {
    const id = `articles/${ARTICLE}/tshirt`;
    await page.goto(`/_edit/media/?id=${id}`);
    const other = await context.newPage();
    await other.goto(`/_edit/media/?id=${id}`);
    const caption = (p: Page) => p.locator('[data-editor-media-form]').getByLabel('Caption');
    const saveIn = async (p: Page, text: string) => {
      await caption(p).fill(text);
      await p.locator('[data-editor-media-form]').getByRole('button', { name: 'Save the details' }).click();
      await saved(p);
    };
    // nothing typed in the other tab: it shows the change
    await saveIn(page, 'First caption.');
    await expect(caption(other)).toHaveValue('First caption.', { timeout: 15_000 });
    await expect(status(other)).toHaveText('Updated with a change made elsewhere');
    // something typed there and not saved: it's kept, and the screen says it's behind
    await caption(other).fill('Typed, not saved.');
    await saveIn(page, 'Second caption.');
    await expect(status(other)).toHaveText(/^Changed elsewhere\. Your unsaved changes here are kept/, { timeout: 15_000 });
    await expect(caption(other)).toHaveValue('Typed, not saved.');
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

  test('a collection: added from the palette with two items, shown on the page, then a third item and a picture added in the inspector', async ({ page }) => {
    await openArticle(page);
    const count = await outlineRows(page).count();
    await page.locator('[data-editor-outline] [data-editor-add-at]').click();
    await page.locator('#editor-palette [data-editor-add="collection"]').click();
    const form = page.locator('#editor-insert-collection');
    const item = (n: number) => form.getByRole('group', { name: `Item ${n}`, exact: true });
    // one item to start; the second is added in the form, and its words are written as they'll read
    await expect(form.getByRole('group', { name: /^Item \d+$/ })).toHaveCount(1);
    await item(1).getByLabel('Heading').fill('Challenge');
    await item(1).getByRole('textbox', { name: 'Words', exact: true }).fill('Re-energize the team.');
    await form.getByRole('button', { name: 'Add an item' }).click();
    await item(2).getByLabel('Heading').fill('Core idea');
    await item(2).getByRole('textbox', { name: 'Words', exact: true }).click();
    await page.keyboard.press('Control+b');
    await page.keyboard.type('Do what makes you proud.');
    await page.keyboard.press('Control+b');
    await page.keyboard.type(' A standard chosen from within.');
    await form.getByRole('button', { name: 'Add the collection' }).click();
    await expect(outlineRows(page)).toHaveCount(count + 1);
    await saved(page);
    const last = () => (readJson(articleFile()).body as { type: string; layout?: string; items?: { heading?: string; media?: string }[] }[]).at(-1)!;
    expect(last()).toMatchObject({ type: 'collection', layout: 'tiles', items: [{ heading: 'Challenge' }, { heading: 'Core idea' }] });
    const shown = frame(page).locator('[data-collection]').last();
    await expect(shown.locator('.heading')).toHaveText(['Challenge', 'Core idea']);
    await expect(shown.locator('.texts strong')).toHaveText('Do what makes you proud.');

    await page.locator(`[data-editor-select="${count}"]`).click();
    await page.locator('[data-editor-collection="add"]').last().click();
    await expect.poll(() => last().items!.length).toBe(3);
    // a picture for the first item, from the library: shown in the collection on the page
    await page.locator(`[data-editor-pick="body.${count}.items.0.media"]`).click();
    await page.locator('#editor-picker [data-editor-media]').first().click();
    await expect.poll(() => last().items![0].media ?? '').not.toBe('');
    await expect(frame(page).locator('[data-collection]').last().locator('.item').first().locator('img')).toHaveCount(1);
    // another layout, the same items: rows, which take no number of columns (that field goes)
    const settings = page.locator(`[data-block-form="${count}"]`);
    await expect(settings.getByRole('combobox', { name: 'Columns' })).toHaveCount(1);
    await settings.getByRole('combobox', { name: 'Layout' }).click();
    await page.getByRole('option', { name: /^Rows/ }).click();
    await expect.poll(() => last().layout).toBe('rows');
    expect(last().items).toHaveLength(3);
    await expect(frame(page).locator('[data-collection]').last()).toHaveAttribute('data-layout', 'rows');
    await expect(page.locator(`[data-block-form="${count}"]`).getByRole('combobox', { name: 'Columns' })).toHaveCount(0);
  });

  test('the inspector: its separator widens it into two columns, the sections listed beside the chosen one; an item dragged in the list moves, and the width is kept', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await openArticle(page);
    await page.evaluate(() => localStorage.removeItem('editor.inspector.width'));
    await openArticle(page);
    await page.locator('[data-editor-select="0"]').click();
    const form = page.locator('[data-block-form="0"]');
    const nav = form.getByRole('navigation', { name: 'Collection settings' });
    const region = (name: string) => form.getByRole('region', { name, exact: true });
    // narrow: every section in turn under its heading, and no list
    await expect(nav).toBeHidden();
    await expect(region('Item 1')).toBeVisible();
    await expect(region('Layout and width')).toBeVisible();
    // widened with the separator's keys (the APG window splitter): two columns
    const sep = page.getByRole('separator', { name: 'Resize the settings' });
    await sep.focus();
    await page.keyboard.press('End');
    await expect.poll(async () => Number(await sep.getAttribute('aria-valuenow'))).toBeGreaterThan(40);
    await expect(nav).toBeVisible();
    await expect(region('Item 1')).toBeVisible();
    await expect(region('Layout and width')).toBeHidden();
    const layout = nav.getByRole('button', { name: /^Layout/ });
    await layout.click();
    await expect(layout).toHaveAttribute('aria-current', 'true');
    await expect(region('Layout and width')).toBeVisible();
    await expect(region('Item 1')).toBeHidden();
    await noSeriousViolations(page, 'the wide inspector');
    // the form fills the inspector: the list's column runs to the footer, and the footer sits at the bottom edge
    const inspector = (await page.locator('[data-editor-inspector]').boundingBox())!;
    const footer = (await form.locator('.block-actions').boundingBox())!;
    const column = (await form.locator('.sections').boundingBox())!;
    expect(inspector.y + inspector.height - (footer.y + footer.height)).toBeLessThanOrEqual(2);
    expect(footer.y - (column.y + column.height)).toBeLessThanOrEqual(24);
    // the third item, dragged by its handle to the top of the list: saved in its new place, and still the one shown
    const headings = () => (readJson(articleFile()).body[0] as { items: { heading?: string }[] }).items.map((i) => i.heading);
    const before = headings();
    await nav.getByRole('button', { name: /^Item 3/ }).click();
    const grip = (await nav.locator('[data-inspector-drag]').nth(2).boundingBox())!;
    const top = (await nav.getByRole('button', { name: /^Item 1/ }).boundingBox())!;
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(top.x + 10, top.y + 4, { steps: 8 });
    await page.mouse.up();
    await expect.poll(headings).toEqual([before[2], before[0], before[1]]);
    await saved(page);
    await expect(region('Item 1')).toBeVisible();
    await expect(form.getByLabel('Item 1: heading')).toHaveValue(before[2]!);
    // the width is kept for the next visit
    await openArticle(page);
    await page.locator('[data-editor-select="0"]').click();
    await expect(nav).toBeVisible();
    // dragged back narrow with the mouse: one column again
    const s = (await sep.boundingBox())!;
    await page.mouse.move(s.x + s.width / 2, s.y + 200);
    await page.mouse.down();
    await page.mouse.move(s.x + 800, s.y + 200, { steps: 6 });
    await page.mouse.up();
    await expect(nav).toBeHidden();
    await expect(sep).toHaveAttribute('aria-valuenow', '24');
  });

  test("a collection item's words are edited as they'll read: paragraphs, marks and nested lists from the toolbar and keys, saved as Markdown", async ({ page }) => {
    await openArticle(page);
    const blocks = () => readJson(articleFile()).body as { type: string; layout?: string; items?: { text?: string }[] }[];
    const t = blocks().findIndex((b) => b.type === 'collection' && b.layout === 'tiles');
    const before = blocks()[t].items![0].text!;
    await page.locator(`[data-editor-select="${t}"]`).click();
    const field = page.locator(`[data-block-form="${t}"] [data-rich-field]`).first();
    const input = field.getByRole('textbox', { name: 'Item 1: words' });
    await expect(field.getByRole('toolbar', { name: 'Item 1: formatting' })).toBeVisible();
    // indents only offered in a list
    await input.click();
    await page.keyboard.press('Control+End');
    await expect(field.locator('[data-rich-op="indent"]')).toBeDisabled();
    await page.keyboard.press('Enter');
    await page.keyboard.type('Then ');
    await page.keyboard.press('Control+b');
    await page.keyboard.type('own');
    await page.keyboard.press('Control+b');
    await page.keyboard.type(' it.');
    await page.keyboard.press('Enter');
    await field.locator('[data-rich-op="bulleted"]').click();
    await expect(field.locator('[data-rich-op="bulleted"]')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.type('First');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Inside');
    await expect(field.locator('[data-rich-op="indent"]')).toBeEnabled();
    await page.keyboard.press('Control+]');
    // leaving the field saves its words
    await page.locator(`[data-block-form="${t}"]`).getByLabel('Item 1: heading').click();
    const words = () => blocks()[t].items![0].text;
    await expect.poll(words).toBe(`${before}\n\nThen **own** it.\n\n- First\n  - Inside`);
    await saved(page);
    // the page shows them as the field did: a paragraph, and a list with a list inside it
    const item = frame(page).locator('[data-collection] .item', { hasText: 'Then own it.' });
    await expect(item.locator('ul > li > ul > li')).toHaveText('Inside');
    await expect(item.locator('p strong')).toHaveText('own');
    // struck through from the toolbar
    await input.locator('p').nth(1).locator('b, strong').dblclick();
    await field.locator('[data-rich-op="strikethrough"]').click();
    await page.locator(`[data-block-form="${t}"]`).getByLabel('Item 1: heading').click();
    await expect.poll(words).toMatch(/Then (~~\*\*own\*\*~~|\*\*~~own~~\*\*) it\./);
    // Shift+Enter in an item: a line break in that item, and the page still shows the list
    await input.locator('li').first().click();
    await page.keyboard.press('End');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('and more');
    await page.locator(`[data-block-form="${t}"]`).getByLabel('Item 1: heading').click();
    await expect.poll(words).toContain('- First\\\n  and more\n  - Inside');
    await expect(frame(page).locator('[data-collection] .item', { hasText: 'and more' }).locator('ul > li').first()).toContainText('and more');
  });

  test('on the canvas, words are struck through (Ctrl+Shift+X) and a list item indents (Ctrl+]) into a list inside the one above', async ({ page }) => {
    await openArticle(page);
    const blocks = () => readJson(articleFile()).body as { type: string; markdown?: string }[];
    const p = blocks().findIndex((b) => b.type === 'text' && !b.markdown!.startsWith('- '));
    const para = frame(page).locator(`[data-editor-editable="rich"]`).first();
    await para.dblclick();
    await page.keyboard.press('Control+Shift+X');
    await page.locator('[data-editor-outline]').click({ position: { x: 5, y: 5 } });
    await expect.poll(() => blocks()[p].markdown).toMatch(/~~\w+~~/);
    // the paragraph as a bulleted list, a second item, indented under the first
    // the change reloads the canvas: mark the page it shows now, so the next step waits for the new one
    const canvas = () => page.frames().find((f) => f.url().includes('/_edit/canvas/'))!;
    await canvas().evaluate(() => ((window as unknown as { stale: boolean }).stale = true));
    await page.locator(`[data-editor-select="${p}"]`).focus();
    await page.keyboard.press('Control+Shift+8');
    await expect.poll(() => blocks()[p].markdown).toMatch(/^- /);
    await expect.poll(() => canvas().evaluate(() => !!(window as unknown as { stale?: boolean }).stale).catch(() => true)).toBe(false);
    const list = frame(page).locator('ul[data-editor-editable="rich"]').first();
    await list.click();
    await page.keyboard.press('Control+End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Inner point');
    await page.keyboard.press('Control+]');
    await page.locator('[data-editor-outline]').click({ position: { x: 5, y: 5 } });
    await expect.poll(() => blocks()[p].markdown).toMatch(/\n {2}- Inner point$/);
  });

  test("the canvas's format bar: a paragraph made a list from its list buttons, and on a phone's width a list's tools under More formatting", async ({ page }) => {
    await openArticle(page);
    const blocks = () => readJson(articleFile()).body as { type: string; markdown?: string }[];
    const p = blocks().findIndex((b) => b.type === 'text' && !b.markdown!.startsWith('- '));
    const canvas = () => page.frames().find((f) => f.url().includes('/_edit/canvas/'))!;
    const bar = frame(page).locator('[data-chrome-format]');
    // no "Add a block below" on the block toolbar: new blocks come in with the "+"
    await expect(frame(page).locator('[data-chrome-op="add"]')).toHaveCount(0);
    await canvas().evaluate(() => ((window as unknown as { stale: boolean }).stale = true));
    await frame(page).locator('[data-editor-editable="rich"]').first().dblclick();
    await expect(bar).toBeVisible();
    await expect(bar.locator('[data-chrome-format-op="bulleted"]')).toHaveAttribute('aria-pressed', 'false');
    await bar.locator('[data-chrome-format-op="bulleted"]').click();
    await expect.poll(() => blocks()[p].markdown).toMatch(/^- /);
    await expect.poll(() => canvas().evaluate(() => !!(window as unknown as { stale?: boolean }).stale).catch(() => true)).toBe(false);
    // a phone's width: the list's tools don't all fit, so the least used go under More formatting, in order
    await page.getByRole('button', { name: 'Phone width' }).click();
    const list = frame(page).locator('ul[data-editor-editable="rich"]').first();
    await list.scrollIntoViewIfNeeded();
    await list.locator('li').first().dblclick();
    await expect(bar.locator('[data-chrome-format-op="bulleted"]')).toHaveAttribute('aria-pressed', 'true');
    const more = bar.getByRole('button', { name: 'More formatting' });
    await expect(more).toBeVisible();
    await more.click();
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    const menu = bar.getByRole('group', { name: 'More formatting' });
    await expect(menu.locator('[data-chrome-format-op]').first()).toHaveAttribute('data-chrome-format-op', 'outdent');
    expect(await bar.evaluate((b) => b.getBoundingClientRect().right <= document.documentElement.clientWidth)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(more).toHaveAttribute('aria-expanded', 'false');
  });

  test('a drop cap is a paragraph’s own choice: off unless switched on in its settings, then drawn on the page', async ({ page }) => {
    await openArticle(page);
    const blocks = () => readJson(articleFile()).body as { type: string; markdown?: string; dropcap?: boolean }[];
    const p = blocks().findIndex((b) => b.type === 'text' && !b.markdown!.startsWith('- '));
    // nothing has one by default: not the opening paragraph either
    await expect(frame(page).locator('p[data-dropcap]')).toHaveCount(0);
    await page.locator(`[data-editor-select="${p}"]`).click();
    await page.locator(`[data-block-form="${p}"]`).getByRole('switch', { name: 'Drop cap' }).click();
    await expect.poll(() => blocks()[p].dropcap).toBe(true);
    await saved(page);
    const cap = frame(page).locator('p[data-dropcap]');
    await expect(cap).toHaveCount(1);
    expect(await cap.evaluate((el) => getComputedStyle(el, '::first-letter').getPropertyValue('initial-letter'))).toMatch(/3/);
  });

  test('a table: rich cells edit in place, keys move through it, simple controls change its shape, and bulk edits stay available', async ({ page }) => {
    await openArticle(page);
    const count = await outlineRows(page).count();
    await page.locator('[data-editor-outline] [data-editor-add-at]').click();
    await page.locator('#editor-palette [data-editor-add="table"]').click();
    await expect(outlineRows(page)).toHaveCount(count + 1);
    await saved(page);
    type T = { type: string; columns?: string[]; rows?: string[][]; rowHeadings?: boolean };
    const last = () => (readJson(articleFile()).body as T[]).at(-1)!;
    expect(last()).toMatchObject({ type: 'table', columns: ['Column 1', 'Column 2'], rows: [['', ''], ['', '']] });

    await page.locator(`[data-editor-select="${count}"]`).click();
    const settings = page.locator(`[data-block-form="${count}"]`);
    await settings.getByText('Bulk edit table', { exact: true }).first().click();
    const cells = settings.getByLabel('Bulk edit table');
    await cells.fill('**Typeface** | Role\nFraunces | **Display**\nFigtree');
    await cells.blur();
    await expect.poll(() => last().rows).toEqual([
      ['Fraunces', '**Display**'],
      ['Figtree', ''],
    ]);
    expect(last().columns).toEqual(['**Typeface**', 'Role']);
    const shown = frame(page).locator('figure.table').last();
    await expect(shown.locator('thead th')).toHaveText(['Typeface', 'Role']);
    await expect(shown.locator('thead strong')).toHaveText('Typeface');
    await expect(shown.locator('tbody strong')).toHaveText('Display');

    // headings and body cells use the same rich editor; Enter and Tab move without adding line breaks
    const heading = (column: number) => shown.locator(`[data-table-row="header"][data-table-column="${column}"] [data-editor-cell-text]`);
    const bodyCell = (row: number, column: number) => shown.locator(`[data-table-row="${row}"][data-table-column="${column}"] [data-editor-cell-text]`);
    await heading(1).click();
    await page.keyboard.press('End');
    await page.keyboard.type(' ');
    await page.keyboard.press('Control+b');
    await page.keyboard.type('work');
    await page.keyboard.press('Control+b');
    await expect.poll(() => last().columns).toEqual(['**Typeface**', 'Role **work**']);
    await page.keyboard.press('Enter');
    await expect(bodyCell(0, 1)).toBeFocused();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Control+i');
    await page.keyboard.type('Visual');
    await page.keyboard.press('Control+i');
    await page.keyboard.press('Tab');
    await expect(bodyCell(1, 0)).toBeFocused();
    await expect.poll(() => last().rows?.[0][1]).toBe('_**Visual**_');

    // Enter on the final row appends one; no permanent row, column or action buttons crowd the table
    await page.keyboard.press('Tab');
    await expect(bodyCell(1, 1)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect.poll(() => last().rows).toHaveLength(3);
    await expect(bodyCell(2, 1)).toBeFocused({ timeout: 15_000 });
    await page.keyboard.press('Tab');
    await expect(frame(page).getByRole('button', { name: 'Add row' })).toHaveCount(0);
    await expect(frame(page).getByRole('button', { name: 'Add column' })).toHaveCount(0);
    await expect(frame(page).getByRole('button', { name: 'Row actions' })).toHaveCount(0);
    await expect(frame(page).getByRole('button', { name: 'Column actions' })).toHaveCount(0);

    // a practical hover band around an internal cell border exposes that exact column or row boundary
    await shown.scrollIntoViewIfNeeded();
    await shown.locator('thead th').nth(1).evaluate((heading) => {
      const rect = heading.getBoundingClientRect();
      heading.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: rect.left + 6, clientY: rect.top + rect.height / 2 }));
    });
    await frame(page).getByRole('button', { name: 'Insert column here' }).click();
    await expect.poll(() => last().columns).toEqual(['**Typeface**', 'Column 1', 'Role **work**']);
    await expect(heading(1)).toBeFocused({ timeout: 15_000 });

    await shown.locator('tbody tr').nth(1).evaluate((row) => {
      const table = row.closest('table')!;
      const tableRect = table.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      row.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: tableRect.left + tableRect.width / 2, clientY: rowRect.top + 6 }));
    });
    await frame(page).getByRole('button', { name: 'Insert row here' }).click();
    await expect.poll(() => last().rows).toHaveLength(4);
    await expect(bodyCell(1, 0)).toBeFocused({ timeout: 15_000 });

    // right click opens one spacious custom menu at the pointer; undo uses the article's existing history
    await bodyCell(0, 1).click({ button: 'right' });
    const menu = frame(page).getByRole('menu', { name: 'Row and column actions' });
    await expect(menu).toBeVisible();
    expect(await menu.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(200);
    await expect(menu.getByText('Row', { exact: true })).toBeVisible();
    await expect(menu.getByText('Column', { exact: true })).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Move column right' }).click();
    await expect.poll(() => last().columns).toEqual(['**Typeface**', 'Role **work**', 'Column 1']);
    await page.locator('[data-editor-undo]').first().click();
    await expect.poll(() => last().columns).toEqual(['**Typeface**', 'Column 1', 'Role **work**']);

    // an invalid empty heading remains local, restores the last valid rich value on leaving, and never reaches the article
    await heading(0).click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Tab');
    await expect(heading(0)).toHaveText('Typeface');
    expect(last().columns?.[0]).toBe('**Typeface**');

    // a row with more cells than columns: refused with the reason, and nothing written
    await settings.getByText('Bulk edit table', { exact: true }).first().click();
    await cells.fill('Typeface | Role\nA | B | C | D');
    await cells.blur();
    await expect(settings.locator('[data-editor-issue]')).toContainText('Row 1 has 4 cells');
    expect(last().rows).toHaveLength(4);

    await settings.getByText('First column names each row').click();
    await expect.poll(() => last().rowHeadings).toBe(true);
    await expect(frame(page).locator('figure.table').last().locator('tbody th[scope="row"]')).toHaveCount(4);
  });

  test('a list: Enter makes a new item, and Enter on an empty last item, or Ctrl + Enter anywhere, starts a paragraph after it', async ({ page }) => {
    await openArticle(page);
    const blocks = () => readJson(articleFile()).body as { type: string; markdown?: string }[];
    const p = blocks().findIndex((b) => b.type === 'text' && !b.markdown!.includes('\n'));
    const first = blocks()[p].markdown!;
    // the paragraph as a bulleted list of one item
    await page.locator(`[data-editor-select="${p}"]`).focus();
    await page.keyboard.press('Control+Shift+8');
    await expect.poll(() => blocks()[p].markdown).toBe(`- ${first}`);
    const list = frame(page).locator('ul[data-editor-editable="rich"]').first();
    await list.locator('li').last().click();
    await page.keyboard.press('End');
    await page.keyboard.press('Control+End');
    // Enter: a new item
    await page.keyboard.press('Enter');
    await expect(list.locator('li')).toHaveCount(2);
    await page.keyboard.type('A second item');
    await expect.poll(() => blocks()[p].markdown).toBe(`- ${first}\n- A second item`);
    // Enter, then Enter on the empty item: the list ends, and a paragraph starts after it
    await page.keyboard.press('Enter');
    await expect(list.locator('li')).toHaveCount(3);
    await page.keyboard.press('Enter');
    // the page is drawn again with the list ended; the new paragraph waits, focused, for its words
    await expect(frame(page).locator('[data-editor-pending]')).toBeFocused({ timeout: 15_000 });
    await page.keyboard.type('After the list.');
    // a new paragraph is kept once it's left
    await page.keyboard.press('Escape');
    await expect.poll(() => blocks()[p + 1]).toEqual({ type: 'text', markdown: 'After the list.' });
    expect(blocks()[p].markdown).toBe(`- ${first}\n- A second item`);
    // Ctrl + Enter in the list's first item: a paragraph after the list, which keeps every item
    await frame(page).locator('ul[data-editor-editable="rich"]').first().locator('li').first().click();
    await page.keyboard.press('Control+Enter');
    await expect(frame(page).locator('[data-editor-pending]')).toBeFocused({ timeout: 15_000 });
    await page.keyboard.type('Between.');
    // a new paragraph is kept once it's left
    await page.keyboard.press('Escape');
    await expect.poll(() => blocks()[p + 1]).toEqual({ type: 'text', markdown: 'Between.' });
    expect(blocks()[p].markdown).toBe(`- ${first}\n- A second item`);
    expect(blocks()[p + 2]).toEqual({ type: 'text', markdown: 'After the list.' });
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

  test('turn into: a paragraph becomes a list and a heading and back, and a collection becomes headings and paragraphs and back', async ({ page }) => {
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

    // a collection (as tiles) into headings and paragraphs, and those, selected, back into the same collection
    const t = blocks().findIndex((b) => b.type === 'collection' && (b as { layout?: string }).layout === 'tiles');
    const tiles = blocks()[t];
    const n = (tiles.items as unknown[]).length;
    await page.locator(`[data-editor-select="${t}"]`).click();
    await page.locator(`[data-block-form="${t}"] [data-editor-turn-open]`).click();
    await page.locator('#editor-turn [data-editor-turn-to="uncollect"]').click();
    await expect.poll(() => blocks().slice(t, t + 2 * n).map((b) => b.type)).toEqual(Array.from({ length: n }, () => ['heading', 'text']).flat());
    await page.locator(`[data-editor-select="${t}"]`).click();
    await page.locator(`[data-editor-select="${t + 2 * n - 1}"]`).click({ modifiers: ['Shift'] });
    await page.locator('[data-editor-group="turn"]').click();
    await page.locator('#editor-turn [data-editor-turn-to="collection"]').click();
    await expect.poll(() => blocks()[t]).toEqual(tiles);
    expect(original.type).toBe('text');
  });

  test('pasted Markdown becomes its blocks, and its heading and text pairs, selected, turn into a collection', async ({ page, context }) => {
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
    await page.locator('#editor-turn [data-editor-turn-to="collection"]').click();
    await expect.poll(() => blocks()[p + 1]).toEqual({
      type: 'collection',
      layout: 'tiles',
      width: 'popout',
      items: [
        { heading: 'Constraint', text: 'A team spread over two cities.' },
        { heading: 'Outcome', text: 'A **shared** standard.' },
      ],
    });
    const shown = frame(page).locator('[data-collection]', { hasText: 'Constraint' });
    await expect(shown.locator('.heading')).toHaveText(['Constraint', 'Outcome']);
    await expect(shown.locator('.texts strong')).toHaveText('shared');
  });

  test('a rich copy keeps its formatting: bold, italic, links, headings and lists, in a paragraph and in a list', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openArticle(page);
    const blocks = () => readJson(articleFile()).body as { type: string; markdown?: string; level?: number; text?: string }[];
    const count = blocks().length;
    const p = blocks().findIndex((b) => b.type === 'text' && !/^(-|\d+\.) /.test(b.markdown ?? ''));
    const copy = (html: string, text: string) =>
      page.evaluate(([h, t]) => navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([h], { type: 'text/html' }), 'text/plain': new Blob([t], { type: 'text/plain' }) })]), [html, text]);
    await frame(page).locator(`[data-editor-editable="rich"]`).nth(blocks().slice(0, p).filter((b) => b.type === 'text').length).click();
    await page.keyboard.press('Control+End');
    // as Google Docs copies it: the marks in styles, inside a bold that isn't bold
    await copy(
      '<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-x"><h2 dir="ltr"><span>Pasted heading</span></h2><p dir="ltr"><span style="font-weight:700">Bold</span><span style="font-weight:400"> and </span><span style="font-style:italic">italic</span><span> with </span><a href="https://example.com/"><span>a link</span></a></p><ul><li><p><span>First </span><span style="font-weight:700">item</span></p></li><li><p><span>Second item</span></p></li></ul></b>',
      'Pasted heading\nBold and italic with a link\nFirst item\nSecond item',
    );
    await page.keyboard.press('Control+V');
    await expect.poll(() => blocks().length).toBe(count + 3);
    expect(blocks().slice(p + 1, p + 4)).toEqual([
      { type: 'heading', level: 2, text: 'Pasted heading' },
      { type: 'text', markdown: '**Bold** and _italic_ with [a link](https://example.com/)' },
      { type: 'text', markdown: '- First **item**\n- Second item' },
    ]);

    // in a list, each pasted line is an item, its marks kept
    await frame(page).locator('li', { hasText: 'Second item' }).click();
    await page.keyboard.press('End');
    await copy('<p>Third, <em>slanted</em></p><p><strong>Fourth</strong></p>', 'Third, slanted\n\nFourth');
    await page.keyboard.press('Control+V');
    await expect.poll(() => blocks()[p + 3]?.markdown, { timeout: 15_000 }).toBe('- First **item**\n- Second itemThird, _slanted_\n- **Fourth**');

    // prose that keeps its white space (a chat's, a mail's) keeps its links, after the space before the caret
    await frame(page).locator('p', { hasText: 'Bold and italic' }).click();
    await page.keyboard.press('End');
    await page.keyboard.type(' see');
    await page.keyboard.press('Space');
    await copy('<div style="white-space: pre-wrap; font-family: Segoe UI, sans-serif;">the <a href="https://designup.io/">DesignUp</a> site\nand <b>more</b></div>', 'the DesignUp site\nand more');
    await page.keyboard.press('Control+V');
    await expect.poll(() => blocks()[p + 2]?.markdown, { timeout: 15_000 }).toBe('**Bold** and _italic_ with [a link](https://example.com/) see the [DesignUp](https://designup.io/) site\\\nand **more**');
  });

  test('text pastes into every kind of text block, headings and quotes as well as paragraphs', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openArticle(page);
    const blocks = () => readJson(articleFile()).body as { type: string; text?: string }[];
    // the first heading and quote in the fixture, whatever they say
    const h = blocks().findIndex((b) => b.type === 'heading');
    const q = blocks().findIndex((b) => b.type === 'quote');
    const was = { h: blocks()[h].text!, q: blocks()[q].text! };
    const exactly = (s: string) => new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
    const pasteAtEnd = async (text: string, words: string) => {
      await frame(page).locator('[data-editor-editable="plain"]', { hasText: exactly(text) }).click();
      await page.keyboard.press('Control+End');
      await page.evaluate((w) => navigator.clipboard.writeText(w), words);
      await page.keyboard.press('Control+V');
    };
    await pasteAtEnd(was.h, ' today');
    await expect.poll(() => blocks()[h].text, { timeout: 15_000 }).toBe(`${was.h} today`);
    await pasteAtEnd(was.q, ' Every day.');
    await expect.poll(() => blocks()[q].text, { timeout: 15_000 }).toBe(`${was.q} Every day.`);
  });

  test("a picture's caption can be hidden completely, credit and all, and shown again", async ({ page }) => {
    await openArticle(page);
    const blocks = () => readJson(articleFile()).body as { type: string; showCaption?: boolean }[];
    // the first figure whose caption shows (the fixture is the owner's content, as it is)
    const i = blocks().findIndex((b) => b.type === 'figure' && b.showCaption !== false);
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
    // a draft has a preview on this computer, but its section doesn't list it
    expect(await (await request.get('/leadership/')).text()).not.toContain('A test story');

    await page.getByRole('tab', { name: 'Page' }).click();
    await page.getByRole('combobox', { name: 'Status' }).click();
    await page.getByRole('option', { name: /^Published/ }).click();
    await saved(page);
    expect((await request.get('/leadership/a-test-story/')).status()).toBe(200);
    expect(await (await request.get('/leadership/')).text()).toContain('A test story');
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

  test('planet: each building shows its section, read-only here; its words and section in Settings, the rules refuse; a page says where it is on the planet', async ({ page }) => {
    const planet = () => readJson(join(FIXTURE, 'content/structures/planet.json')).places as { id: string; kicker: string; site: string }[];
    const before = JSON.stringify(planet());

    // the seven buildings and their sections' pages, which move in Sections, not here
    await page.goto('/_edit/planet/?building=lighthouse');
    await expect(page.locator('[data-manager-section]')).toHaveCount(7);
    await expect(page.locator('[data-manager-section="lighthouse"]')).toContainText('shows Leadership');
    const row = page.locator('[data-manager-pages="lighthouse"]').locator(`[data-manager-row="${ARTICLE}"]`);
    await expect(row).toBeVisible();
    await expect(row.locator(`[data-manager-grip="${ARTICLE}"]`)).toBeDisabled();

    // a building's own words, in its Settings tab
    await page.goto('/_edit/planet/?building=workshop&tab=settings');
    const form = page.locator('[data-planet-place="workshop"]');
    await form.getByLabel('What it holds').fill('Case studies');
    await form.getByRole('button', { name: 'Save the building' }).click();
    await expect.poll(() => planet().find((p) => p.id === 'workshop')!.kicker).toBe('Case studies');

    // a section shown by two buildings is refused (V15), and nothing changes
    await page.goto('/_edit/planet/?building=workshop&tab=settings');
    await form.getByRole('combobox', { name: 'Shows' }).click();
    await page.getByRole('option', { name: /^Writing/ }).click();
    await form.getByRole('button', { name: 'Save the building' }).click();
    await expect(form.locator('[data-editor-form-issue]')).toContainText('a section is shown by one building at most');
    expect(planet().find((p) => p.id === 'workshop')!.site).toBe('work');
    expect(JSON.stringify(planet().map((p) => p.site))).toBe(JSON.stringify(JSON.parse(before).map((p: { site: string }) => p.site)));

    // the page says where it's read on the planet, and the planet's page is there
    await openArticle(page);
    await page.getByRole('tab', { name: 'Page' }).click();
    await expect(page.locator('[data-editor-place]')).toContainText('In the Lighthouse, which shows its section');
    expect((await page.request.get(`/play/lighthouse/${ARTICLE}/`)).status()).toBe(200);
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

  test('the "+" shows in the space between blocks, never over a block, on a line as wide as the blocks, and adds a block there', async ({ page }) => {
    await openArticle(page);
    const canvas = page.frame({ url: /\/_edit\/canvas\// })!;
    const plus = frame(page).locator('[data-chrome-insert]');
    const at = await canvas.evaluate(() => {
      const a = document.querySelector<HTMLElement>('[data-editor-editable="rich"]')!;
      a.scrollIntoView({ block: 'center' });
      const b = a.nextElementSibling!.getBoundingClientRect();
      const r = a.getBoundingClientRect();
      return { x: r.left + r.width / 2, inside: r.top + r.height / 2, topOfNext: b.top + 4, gap: (r.bottom + b.top) / 2, left: r.left, width: Math.min(r.width, b.width) };
    });
    const box = (await page.locator('[data-editor-frame]').boundingBox())!;
    const to = (y: number) => page.mouse.move(box.x + at.x, box.y + y, { steps: 3 });
    await to(at.inside);
    await expect(plus).toBeHidden();
    await to(at.topOfNext);
    await expect(plus).toBeHidden();
    await to(at.gap);
    await expect(plus).toBeVisible();
    // the line marks where the block goes: across the blocks' column, at the middle of the gap
    const line = await canvas.evaluate(async () => {
      const el = document.querySelector('[data-chrome-insert] .insert-line')!;
      // once it has drawn in (it grows from the middle)
      await Promise.all(el.getAnimations().map((a) => a.finished));
      const r = el.getBoundingClientRect();
      return { left: r.left, width: r.width, y: r.top + r.height / 2 };
    });
    expect(Math.abs(line.width - at.width)).toBeLessThan(2);
    expect(Math.abs(line.y - at.gap)).toBeLessThan(2);
    await plus.getByRole('button').click();
    await expect(page.locator('#editor-palette')).toBeVisible();
  });

  test('upload: a picture shows at once (its transparency too), can be cropped before it uploads, and a pasted one fills the form', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/_edit/media/');
    await page.getByText('Upload a picture').click();
    const form = page.locator('[data-editor-upload]');
    const facts = form.locator('[data-upload-facts]');
    const clear = await sharp({ create: { width: 800, height: 400, channels: 4, background: { r: 200, g: 40, b: 40, alpha: 0.4 } } }).png().toBuffer();
    await form.locator('input[type="file"]').setInputFiles({ name: 'Clear Mark.png', mimeType: 'image/png', buffer: clear });
    await expect(facts).toHaveText('800 × 400 px, PNG, transparent.');
    await expect(form.locator('[data-upload-img]')).toBeVisible();

    await form.getByRole('button', { name: 'Crop it' }).click();
    const dialog = page.locator('#crop');
    const readout = dialog.locator('[data-crop-readout]');
    await expect(readout).toHaveText('800 × 400 px (2:1), from 800 × 400');
    await expect(dialog.locator('[data-crop-note]')).toContainText('cut when the picture is uploaded');
    await page.keyboard.press('-');
    await page.keyboard.press('-');
    const [w, h] = /^(\d+) × (\d+) px/.exec((await readout.textContent()) ?? '')!.slice(1).map(Number);
    expect(w).toBeLessThan(800);
    await dialog.getByRole('button', { name: 'Save the crop' }).click();
    await expect(dialog).toBeHidden();
    await expect(facts).toHaveText(`800 × 400 px, PNG, transparent. Cropped to ${w} × ${h} px.`);
    await form.getByLabel('Alt text').fill('A clear red mark');
    await form.getByRole('button', { name: 'Upload it' }).click();
    await expect(page).toHaveURL(/\?id=shared\/clear-mark$/, { timeout: 30_000 });
    const meta = await sharp(readFileSync(join(FIXTURE, 'content/media/shared/clear-mark.webp'))).metadata();
    expect([meta.width, meta.height, meta.hasAlpha]).toEqual([w, h, true]);

    // a copied picture, pasted on the page, goes in the form, previewed
    await page.getByText('Upload a picture').click();
    const shot = await sharp({ create: { width: 320, height: 200, channels: 3, background: { r: 20, g: 90, b: 160 } } }).png().toBuffer();
    await page.evaluate(async (b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': new Blob([bytes], { type: 'image/png' }) })]);
    }, shot.toString('base64'));
    await page.locator('h1').first().click();
    await page.keyboard.press('Control+V');
    await expect(form.locator('[data-upload-facts]')).toHaveText('320 × 200 px, PNG.');
    await expect(form.getByLabel('Alt text')).toBeFocused();
    await expect(form.locator('[data-file-chosen]')).toHaveText(/^pasted-picture-\d{4}-\d{2}-\d{2}\.png$/);
  });

  test('a picture pasted in the article opens the picker with it ready, and becomes a figure after the block', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openArticle(page);
    const blocks = () => readJson(articleFile()).body as { type: string; media?: string }[];
    const count = blocks().length;
    const p = blocks().findIndex((b) => b.type === 'text');
    const shot = await sharp({ create: { width: 640, height: 360, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: { create: { width: 200, height: 200, channels: 4, background: { r: 240, g: 180, b: 20, alpha: 1 } } }, left: 220, top: 80 }])
      .png()
      .toBuffer();
    await page.evaluate(async (b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': new Blob([bytes], { type: 'image/png' }) })]);
    }, shot.toString('base64'));
    await frame(page).locator('[data-editor-editable="rich"]').first().click();
    await page.keyboard.press('Control+V');
    const picker = page.locator('#editor-picker');
    await expect(picker).toBeVisible();
    await expect(picker.locator('[data-upload-facts]')).toHaveText('640 × 360 px, PNG, transparent.');
    await picker.getByLabel('Alt text').fill('A yellow square');
    await picker.getByRole('button', { name: 'Upload it' }).click();
    await expect.poll(() => blocks().length, { timeout: 30_000 }).toBe(count + 1);
    expect(blocks()[p + 1]).toMatchObject({ type: 'figure', media: expect.stringMatching(new RegExp(`^articles/${ARTICLE}/pasted-picture-\\d{4}-\\d{2}-\\d{2}(-\\d+)?$`)) });
  });

  test('a video file: uploaded from the palette (under 100 MB, its poster taken from it), shown on the page with its caption centred under it, playable with seeking, and listed in Media', async ({ page }) => {
    test.setTimeout(120_000);
    await openArticle(page);
    const blocks = () => readJson(articleFile()).body as { type: string; media?: string; width?: string }[];
    const count = blocks().length;
    await page.locator('[data-editor-outline] [data-editor-add-at]').click();
    await page.locator('#editor-palette [data-editor-add="video"]').click();
    const picker = page.locator('#editor-picker');
    await expect(picker).toBeVisible();
    // the picker shows videos only: no picture is offered for a video block
    await expect(picker.locator('[data-media-kind="image"]').first()).toBeHidden();
    await picker.locator('summary', { hasText: 'Upload a picture or a video' }).click();
    await picker.locator('[data-editor-upload] input[type="file"]').setInputFiles(join(process.cwd(), 'tests/e2e/fixtures/clip.webm'));
    await expect(picker.locator('[data-upload-facts]')).toHaveText(/^320 × 180 px, WebM, 0:02, \d+(\.\d)? MB\.$/);
    await expect(picker.locator('[data-upload-video]')).toBeVisible();
    // a video asks for its title, not alt text
    await expect(picker.locator('[data-editor-upload] [name="alt"]')).toBeHidden();
    await picker.getByRole('button', { name: 'Upload it' }).click();
    await expect(picker.locator('[data-editor-form-issue]')).toHaveText(/Give the video a title/);
    await picker.locator('[data-editor-upload] [name="title"]').fill('A test pattern');
    await picker.locator('[data-editor-upload] [name="caption"]').fill('Two seconds of colour bars.');
    await picker.getByRole('button', { name: 'Upload it' }).click();
    await expect.poll(() => blocks().length, { timeout: 30_000 }).toBe(count + 1);
    const id = `articles/${ARTICLE}/clip`;
    expect(blocks().at(-1)).toEqual({ type: 'video', media: id, width: 'wide' });
    const sidecar = readJson(join(FIXTURE, `content/media/${id}.json`));
    expect(sidecar).toMatchObject({ kind: 'video', file: 'clip.webm', title: 'A test pattern', width: 320, height: 180, poster: { file: 'clip.poster.webp' }, caption: 'Two seconds of colour bars.' });
    expect(sidecar.duration).toBeCloseTo(2, 0);

    // on the page (the canvas is the page): a player named by its title, its poster, its caption centred under it
    const player = frame(page).locator('video[aria-label="A test pattern"]');
    await expect(player).toBeVisible({ timeout: 20_000 });
    await expect(player).toHaveAttribute('poster', /.+/);
    const src = await player.locator('source').getAttribute('src');
    expect(src).toMatch(new RegExp(`/media/${id}\\.webm$`));
    const caption = player.locator('xpath=ancestor::figure[1]').locator('figcaption');
    await expect(caption).toHaveText('Two seconds of colour bars.');
    expect(await caption.evaluate((el) => getComputedStyle(el).textAlign)).toBe('center');
    // it plays: the file is served, with ranges (seeking)
    expect(await player.evaluate((v: HTMLVideoElement) => new Promise((ok) => (v.readyState >= 1 ? ok(v.videoWidth) : v.addEventListener('loadedmetadata', () => ok(v.videoWidth)))))).toBe(320);
    const part = await page.request.get(src!, { headers: { Range: 'bytes=0-99' } });
    expect(part.status()).toBe(206);
    expect((await part.body()).length).toBe(100);

    // in Media: a video card, its details (the player, its title) and where it's used
    await page.goto(`/_edit/media/?id=${id}`);
    await expect(page.getByRole('button', { name: 'Video: A test pattern' })).toBeVisible();
    await expect(page.locator('[data-editor-media-details] video')).toBeVisible();
    await expect(page.locator('[data-editor-media-details]').getByLabel('Title')).toHaveValue('A test pattern');
    await expect(page.getByRole('button', { name: 'Delete the video' })).toBeDisabled();
  });

  test("a picture's dark version: added in Media, shown on the site in dark mode (the lightbox too) and not in light, and removed", async ({ page, context }) => {
    const blocks = readJson(articleFile()).body as { type: string; media?: string; lightbox?: boolean }[];
    const fig = blocks.find((b) => b.type === 'figure' && b.lightbox)!;
    const sidecarFile = join(FIXTURE, `content/media/${fig.media}.json`);
    await page.goto(`/_edit/media/?id=${fig.media}`);
    const form = page.locator('[data-editor-media-dark]');
    await expect(form).toContainText('None: the same picture shows in light and dark mode');
    const { width, height } = (await sharp(readFileSync(join(FIXTURE, `content/media/${fig.media}.webp`))).metadata()) as { width: number; height: number };
    const night = await sharp({ create: { width, height, channels: 3, background: { r: 12, g: 16, b: 40 } } }).png().toBuffer();
    await form.locator('input[type="file"]').setInputFiles({ name: 'night.png', mimeType: 'image/png', buffer: night });
    await form.getByRole('button', { name: 'Add it' }).click();
    await expect(status(page)).toHaveText(/^Saved the dark version of /, { timeout: 30_000 });
    const name = fig.media!.split('/').pop();
    expect(readJson(sidecarFile).dark).toEqual({ file: `${name}.dark.webp` });
    await expect(page.locator('[data-editor-media-dark] figure[data-scheme="dark"]')).toBeVisible();
    await expect(page.locator(`[data-editor-media="${fig.media}"]`)).toContainText('Dark version');

    // on the site: the dark version in dark mode, the picture in light mode, and the lightbox follows
    const site = await context.newPage();
    await site.addInitScript(() => localStorage.setItem('site.theme', 'dark'));
    await site.goto(`/leadership/${ARTICLE}/`);
    const img = site.locator(`a[data-full-dark*="${name}.dark"] img`).first();
    await img.scrollIntoViewIfNeeded();
    const shown = () => img.evaluate((i: HTMLImageElement) => decodeURIComponent(i.currentSrc));
    await expect.poll(shown, { timeout: 15_000 }).toContain(`${name}.dark.webp`);
    await img.click();
    await expect.poll(() => site.locator('[data-lightbox-image]').evaluate((i: HTMLImageElement) => decodeURIComponent(i.src))).toContain(`${name}.dark.webp`);
    await site.keyboard.press('Escape');
    await site.evaluate(() => (document.documentElement.dataset.theme = 'light'));
    await expect.poll(shown, { timeout: 15_000 }).not.toContain('.dark.webp');

    // removed: the same picture in both modes
    await page.getByRole('button', { name: 'Remove it' }).click();
    await expect(status(page)).toHaveText(/^Removed the dark version of /, { timeout: 15_000 });
    expect(readJson(sidecarFile)).not.toHaveProperty('dark');
    await expect(form).toContainText('None: the same picture shows in light and dark mode');
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
    expect(structure().home.children.at(-1)).toMatchObject({ id: 'field-notes', kind: 'hub', slug: 'field-notes', title: 'Field notes', view: 'features' });
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
    // on the planet it follows its section: Field notes has no building, so it leaves the Lighthouse
    const inLighthouse = async () => (await page.request.get(`/play/lighthouse/${ARTICLE}/`)).status() === 200;
    expect(await inLighthouse()).toBe(false);

    // back to Leadership with Move: the handle's click, in Field notes
    await section('field-notes').click();
    await expect(page).toHaveURL(/section=field-notes/);
    await grip(ARTICLE).click();
    await moveTo('Leadership');
    await expect.poll(() => pagesOf('leadership')).toEqual([ARTICLE]);
    // and back into the Lighthouse, which shows Leadership
    expect(await inLighthouse()).toBe(true);

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
    const sideBefore = pagesOf('side-projects');
    await moveTo('Side projects');
    await expect.poll(() => pagesOf('side-projects')).toEqual([...sideBefore, one, two]);
    expect(pagesOf('leadership')).toEqual([ARTICLE]);

    // a selection dragged onto a section goes with it: all of it, in its order
    await page.goto('/_edit/sections/?section=side-projects');
    const sideProjects = page.locator('[data-manager-pages="side-projects"]');
    for (const id of [one, two]) await sideProjects.locator(`[data-manager-pick="${id}"]`).click();
    await expect(sideProjects.locator('[data-manager-count]')).toHaveText('2 selected');
    await drag(two, section('talks'));
    await expect.poll(() => pagesOf('talks')).toEqual([one, two]);
    expect(pagesOf('side-projects')).toEqual(sideBefore);
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
    await expect(page.getByRole('heading', { name: '2 changes to save' })).toBeVisible();

    await page.locator('[data-publish-discard][data-name^="Person"]').click();
    await page.locator('#publish-discard').getByRole('button', { name: 'Discard it' }).click();
    await expect(page.getByRole('heading', { name: '1 change to save' })).toBeVisible({ timeout: 15_000 });
    expect(readJson(join(FIXTURE, 'content/people/prabin.json')).role).toBe(person.role);

    await expect(page.getByLabel('Message')).toHaveValue('Content: the site settings');
    await page.getByRole('button', { name: 'Save to remote', exact: true }).last().click();
    await expect(page.getByRole('heading', { name: 'Saved to remote' })).toBeVisible({ timeout: 30_000 });
    expect(git('show', '--name-only', '--format=%s', 'HEAD').split('\n')).toEqual(['Content: the site settings', '', 'content/site.json']);
    expect(execFileSync('git', [`--git-dir=${REMOTE}`, 'log', '-1', '--format=%s', 'main'], { encoding: 'utf8' }).trim()).toBe('Content: the site settings');
    await expect(page.getByRole('button', { name: 'Save to remote', exact: true }).last()).toBeDisabled();
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
    await page.getByRole('button', { name: 'Save to remote', exact: true }).last().click();
    await expect(page.getByRole('heading', { name: '1 commit not on GitHub yet' })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-publish-push-issue]')).toContainText('newer commits');

    git('pull', '-q', '--rebase');
    await page.getByRole('button', { name: 'Push again' }).click();
    await expect(page.getByRole('heading', { name: 'Saved to remote' })).toBeVisible({ timeout: 30_000 });
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

  test('a gallery from the palette: the picker scrolls inside the window, and its Use button stays in the footer, saying what it adds', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openArticle(page);
    const blocks = () => readJson(articleFile()).body as { type: string; items?: { media: string }[] }[];
    const count = blocks().length;
    await page.locator('[data-editor-outline] [data-editor-add-at]').click();
    await page.locator('#editor-palette [data-editor-add="gallery"]').click();
    const picker = page.locator('#editor-picker');
    await expect(picker).toBeVisible();
    // the dialog fits the window and its body scrolls; the footer is always in view
    const box = (await picker.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(720);
    const use = picker.locator('[data-editor-media-use]');
    await expect(use).toBeVisible();
    await expect(use).toBeDisabled();
    await expect(picker.locator('[data-editor-media-count]')).toHaveText('0 chosen: choose at least 2');
    const cards = picker.locator('[data-media-kind="image"]:visible [data-editor-media]');
    await cards.nth(0).click();
    await cards.nth(1).click();
    await expect(use).toBeEnabled();
    await expect(use).toHaveText('Use 2 pictures');
    await expect(use).toBeInViewport();
    await use.click();
    await expect(picker).toBeHidden();
    await expect.poll(() => blocks().length, { timeout: 30_000 }).toBe(count + 1);
    expect(blocks().find((b) => b.type === 'gallery')?.items).toHaveLength(2);
  });

  test("a picture's Shown as, background, corners and drop shadow: chosen in the inspector, saved, and drawn on the page", async ({ page }) => {
    await openArticle(page);
    const blocks = () => readJson(articleFile()).body as { type: string; display?: string; ratio?: string; background?: boolean; rounded?: boolean; shadow?: boolean }[];
    const at = blocks().findIndex((b) => b.type === 'figure');
    test.skip(at < 0, 'the fixture article has no figure');
    await page.locator(`[data-editor-outline] [data-editor-select="${at}"]`).click();
    const form = page.locator(`[data-block-form="${at}"]`);
    const choose = async (label: string, option: RegExp) => {
      await form.getByRole('combobox', { name: label }).click();
      await page.getByRole('option', { name: option }).click();
    };
    await choose('Shape', /^Screen/);
    await choose('Shown as', /^Actual size/);
    await form.locator('label', { hasText: 'Colour behind it' }).click();
    await form.locator('label', { hasText: 'Rounded corners' }).click();
    await form.locator('label', { hasText: 'Drop shadow' }).click();
    await expect.poll(() => blocks()[at]).toMatchObject({ ratio: '16/9', display: 'actual', background: true, rounded: false, shadow: true });
    const frame = page.frameLocator('[data-editor-frame]').locator('figure .frame[data-mode="actual"]').first();
    await expect(frame).toHaveAttribute('data-ratio', '16/9', { timeout: 20_000 });
    await expect(frame).toHaveAttribute('data-bg', '');
    await expect(frame).toHaveAttribute('data-radius', 'none');
    await expect(frame).toHaveAttribute('data-shadow', '');
    expect(await frame.evaluate((el) => getComputedStyle(el).filter)).toMatch(/^drop-shadow/);
    expect(await frame.evaluate((el) => getComputedStyle(el).backgroundColor)).toMatch(/^rgb/);
  });

  test('every screen passes axe, in light and in dark', async ({ page }) => {
    const screens = ['/_edit/', '/_edit/articles/', `/_edit/articles/${ARTICLE}/`, '/_edit/sections/', '/_edit/navigation/', '/_edit/planet/', `/_edit/media/?id=articles/${ARTICLE}/tshirt`, '/_edit/settings/', '/_edit/access/', '/_edit/access/?grant=new', '/_edit/publish/'];
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
