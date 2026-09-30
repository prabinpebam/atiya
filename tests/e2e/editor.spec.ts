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

  test('a new draft renders in the editor, not on the site; published, it is on the site at once and its address is fixed', async ({ page, request }) => {
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
    await expect(page.locator('#page-slug')).toBeDisabled();
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

  test('sections: a new section, reordered with the keys, saved to the structure; a published page keeps its address', async ({ page }) => {
    await page.goto('/_edit/sections/');
    await page.locator('[data-dialog-open="new-section"]').click();
    await page.locator('#new-section').getByLabel('Title').fill('Field notes');
    await page.locator('#new-section').getByRole('button', { name: 'Add the section' }).click();
    const item = page.locator('[role="treeitem"][data-node="field-notes"]');
    await expect(item).toBeFocused({ timeout: 15_000 });
    await page.keyboard.press('Alt+ArrowUp');
    await expect(page.locator('[role="treeitem"][data-node="field-notes"]')).toHaveAttribute('data-position', '0', { timeout: 15_000 });
    const home = readJson(join(FIXTURE, 'content/structures/site.json')).home;
    expect(home.children[0]).toMatchObject({ id: 'field-notes', slug: 'field-notes', title: 'Field notes' });
    await page.locator('[role="treeitem"][data-node="leadership"] .name').click();
    await expect(page.locator('[data-sections-hub="leadership"] input[name="slug"]')).toBeDisabled();
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
    const screens = ['/_edit/', '/_edit/articles/', `/_edit/articles/${ARTICLE}/`, '/_edit/sections/', `/_edit/media/?id=articles/${ARTICLE}/tshirt`, '/_edit/settings/', '/_edit/publish/'];
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
