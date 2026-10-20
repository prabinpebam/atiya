/**
 * Ask AI in the article editor (documentation/editor/ai-editing.md §4; plan: ai-plan.md S5): against the tests'
 * stand-in AI service (scripts/lib/ai-stand-in.mjs, which the fixture server starts and sets up as the writer),
 * never a real model. The stand-in cuts the block to its first sentence.
 *
 *   npx playwright test --project=editor tests/e2e/editor-ai.spec.ts
 */
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURE, reset } from '../../scripts/editor-test-server.mjs';

const ARTICLE = 'do-what-makes-you-proud';
type Block = { type: string; key?: string; markdown?: string };
const blocks = (): Block[] => JSON.parse(readFileSync(join(FIXTURE, 'content/articles', `${ARTICLE}.json`), 'utf8')).body;
const frame = (page: Page) => page.frameLocator('[data-editor-frame]');
const firstSentence = (s: string) => (/^[\s\S]*?[.!?](?=\s|$)/.exec(s)?.[0] ?? s).trim();
// a plain paragraph of more than one sentence
const paragraph = () => blocks().findIndex((b) => b.type === 'text' && !/[*_[\]-]/.test(b.markdown!) && firstSentence(b.markdown!) !== b.markdown!.trim());
/** Changes the writer's model in the fixture's AI settings (each reset writes them again). */
function useModel(model: string) {
  setAi((s) => (s.services[0].model = model));
}
/** Changes the fixture's AI settings in place. */
function setAi(change: (s: { services: { model: string; privatePages: boolean }[]; writer: string | null }) => void) {
  const file = join(FIXTURE, '.atiya', 'ai.json');
  const s = JSON.parse(readFileSync(file, 'utf8'));
  change(s);
  writeFileSync(file, JSON.stringify(s));
}

/** Opens an article and Ask AI on its block at p; the prompt. */
async function openOn(page: Page, p: number, article = ARTICLE) {
  await page.goto(`/_edit/articles/${article}/`);
  await expect(frame(page).locator('[data-editor-editable]').first()).toBeVisible({ timeout: 30_000 });
  await page.locator(`[data-editor-select="${p}"]`).click();
  await frame(page).locator('[data-chrome-op="ai"]').click();
  return frame(page).locator('[data-editor-ai-prompt]');
}
/** Opens the article and Ask AI on the paragraph; the prompt, its field focused. */
async function askOn(page: Page, p: number) {
  const prompt = await openOn(page, p);
  await expect(prompt.locator('[data-ai-field] textarea')).toBeFocused();
  return prompt;
}

test.describe('editor: AI', () => {
  test.setTimeout(120_000);
  test.beforeEach(() => reset());
  test.afterAll(() => reset());

  test('ask AI on a paragraph: Make shorter shows a tracked change in the block, Keep saves it, and one undo brings it back', async ({ page }) => {
    const p = paragraph();
    const original = blocks()[p].markdown!;
    await page.goto(`/_edit/articles/${ARTICLE}/`);
    await expect(frame(page).locator('[data-editor-editable]').first()).toBeVisible({ timeout: 30_000 });

    // select it, then Ask AI on its toolbar: the prompt opens under it, its field focused, naming the service
    await page.locator(`[data-editor-select="${p}"]`).click();
    await frame(page).locator('[data-chrome-op="ai"]').click();
    const prompt = frame(page).locator('[data-editor-ai-prompt]');
    await expect(prompt).toBeVisible();
    await expect(prompt.locator('[data-ai-field] textarea')).toBeFocused();
    await expect(prompt.locator('[data-ai-service]')).toHaveText(/Sends this article to Ollama, stand-in/);

    // Make shorter: the block shows what goes as a tracked change, and the result bar offers Keep
    await prompt.locator('[data-ai-action="shorten"]').click();
    await expect(prompt).toHaveAttribute('data-state', 'proposed', { timeout: 30_000 });
    await expect(frame(page).locator('[data-ai-change] del').first()).toBeVisible();
    await expect(prompt.locator('[data-ai-summary]')).toHaveText('Shortened the paragraph');
    await expect(prompt.locator('[data-ai-keep]')).toBeFocused();
    expect(blocks()[p].markdown).toBe(original);

    // Keep: the change is made as an edit, saved, and the block keeps its key
    await prompt.locator('[data-ai-keep]').click();
    await expect.poll(() => blocks()[p].markdown, { timeout: 15_000 }).toBe(firstSentence(original));
    expect(blocks()[p].key).toMatch(/^[a-z0-9]{6}$/);
    await expect(frame(page).locator('[data-editor-ai-prompt]')).toBeHidden();

    // one undo step brings the block back
    await page.locator('[data-editor-undo]').click();
    await expect.poll(() => blocks()[p].markdown, { timeout: 15_000 }).toBe(original);
  });

  test('Try again keeps both tries, Ask for more adds one, stepping between them redraws the change, and Discard puts the block back (S5.2)', async ({ page }) => {
    const p = paragraph();
    const original = blocks()[p].markdown!;
    const prompt = await askOn(page, p);
    const tries = prompt.locator('[data-ai-tries-text]');
    const added = frame(page).locator('[data-ai-change] ins');
    // the word diff marks each added word: the longer try's "little" is one
    const longer = added.filter({ hasText: 'little' });

    // one try: no tries line
    await prompt.locator('[data-ai-action="shorten"]').click();
    await expect(prompt).toHaveAttribute('data-state', 'proposed', { timeout: 30_000 });
    await expect(prompt.locator('[data-ai-tries]')).toBeHidden();

    // Try again: a second try, the first kept
    await prompt.locator('[data-ai-again]').click();
    await expect(tries).toHaveText('2 of 2', { timeout: 30_000 });
    await expect(prompt.locator('[data-ai-keep]')).toBeFocused();

    // Ask for more starts from the try shown: a third, which adds a sentence
    await prompt.locator('[data-ai-more-field] textarea').fill('Make it longer');
    await prompt.locator('[data-ai-more-field] textarea').press('Enter');
    await expect(tries).toHaveText('3 of 3', { timeout: 30_000 });
    await expect(prompt.locator('[data-ai-summary]')).toHaveText('Lengthened the paragraph');
    await expect(longer).toBeVisible();
    await expect(prompt.locator('[data-ai-next]')).toBeDisabled();

    // stepping back redraws the change: the second try only cuts
    await prompt.locator('[data-ai-prev]').click();
    await expect(tries).toHaveText('2 of 3');
    await expect(prompt.locator('[data-ai-summary]')).toHaveText('Shortened the paragraph');
    await expect(added).toHaveCount(0);
    await prompt.locator('[data-ai-next]').click();
    await expect(longer).toBeVisible();

    // Discard: every try goes, the block is as it was, and nothing was saved
    await prompt.locator('[data-ai-discard]').click();
    await expect(prompt).toHaveAttribute('data-state', 'ready');
    await expect(frame(page).locator('[data-ai-change]')).toHaveCount(0);
    await expect(frame(page).getByText(original.trim())).toBeVisible();
    expect(blocks()[p].markdown).toBe(original);
  });

  test('Stop while writing keeps what arrived as a try, and Esc stops (S5.3)', async ({ page }) => {
    const p = paragraph();
    const original = blocks()[p].markdown!;
    const prompt = await askOn(page, p);

    // the stand-in writes slowly when asked to; Stop has the focus while it does
    await prompt.locator('[data-ai-field] textarea').fill('Make it shorter, slowly');
    await prompt.locator('[data-ai-field] textarea').press('Enter');
    await expect(prompt).toHaveAttribute('data-state', 'working');
    await expect(prompt.locator('[data-ai-stop]')).toBeFocused();
    await expect(frame(page).locator('[data-ai-change]')).toHaveText(/\S/, { timeout: 30_000 });

    // Esc stops: what arrived is a try to keep
    await page.keyboard.press('Escape');
    await expect(prompt).toHaveAttribute('data-state', 'proposed');
    await expect(prompt.locator('[data-ai-summary]')).toHaveText('Stopped part way');
    await prompt.locator('[data-ai-keep]').click();
    await expect.poll(() => blocks()[p].markdown, { timeout: 15_000 }).not.toBe(original);
    const kept = blocks()[p].markdown!;
    expect(kept.length).toBeGreaterThan(0);
    expect(firstSentence(original).startsWith(kept)).toBe(true);
  });

  test('an answer refused twice by the check shows the first reason and changes nothing (S5.4)', async ({ page }) => {
    // the stand-in's "no-shape" model answers words, never the edit answer's shape
    useModel('no-shape');
    const p = paragraph();
    const original = blocks()[p].markdown!;
    const prompt = await askOn(page, p);
    await prompt.locator('[data-ai-action="shorten"]').click();
    await expect(prompt).toHaveAttribute('data-state', 'note', { timeout: 30_000 });
    await expect(prompt.locator('[data-ai-note-text]')).toHaveText(/^The answer didn't fit the site: .+\. Nothing changed\.$/);
    await expect(prompt.locator('[data-ai-choice]:not([hidden])')).toHaveText(['Try again']);
    await expect(prompt.locator('[data-ai-choice="retry"] button')).toBeFocused();
    await expect(frame(page).locator('[data-ai-change]')).toHaveCount(0);
    expect(blocks()[p].markdown).toBe(original);
  });

  test('a request for the latest numbers stops at Decide: Copy for your agent copies its prompt, Cancel keeps your words, Ask anyway writes without research (S5.5)', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const p = paragraph();
    const original = blocks()[p].markdown!;
    const prompt = await askOn(page, p);
    const field = prompt.locator('[data-ai-field] textarea');
    const note = prompt.locator('[data-ai-note-text]');
    const choice = (c: string) => prompt.locator(`[data-ai-choice="${c}"] button`);

    // the rules catch it before any service is asked
    await field.fill('Add the latest numbers to this');
    await field.press('Enter');
    await expect(prompt).toHaveAttribute('data-state', 'note', { timeout: 30_000 });
    await expect(note).toHaveText(/^This needs research from the web\. /);
    await expect(prompt.locator('[data-ai-choice]:not([hidden])')).toHaveText(['Copy for your agent', 'Ask anyway', 'Cancel']);
    await expect(choice('copy')).toBeFocused();

    // Copy for your agent: a prompt naming the MCP server, the article, the block and the words
    await choice('copy').click();
    await expect(note).toHaveText('Copied. Paste it into your agent.');
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toMatch(/\/_edit\/mcp\b/);
    expect(copied).toContain(`(ID ${ARTICLE})`);
    expect(copied).toMatch(/Block: key [a-z0-9]{6}/);
    expect(copied).toContain('Request: Add the latest numbers to this');
    expect(copied).toContain('propose_changes');

    // Cancel: back to the field, the words kept
    await choice('cancel').click();
    await expect(prompt).toHaveAttribute('data-state', 'ready');
    await expect(field).toHaveValue('Add the latest numbers to this');

    // Ask anyway: the writer gets it, and the proposal says it wasn't researched
    await field.press('Enter');
    await expect(prompt).toHaveAttribute('data-state', 'note', { timeout: 30_000 });
    await choice('anyway').click();
    await expect(prompt).toHaveAttribute('data-state', 'proposed', { timeout: 30_000 });
    await expect(prompt.locator('[data-ai-summary]')).toHaveText(/\. Written without research: check every number\.$/);
    expect(blocks()[p].markdown).toBe(original);
  });

  test('the whole flow works by keyboard alone, the change has text twins, and axe passes (S5.8)', async ({ page }) => {
    const p = paragraph();
    const original = blocks()[p].markdown!;
    await page.goto(`/_edit/articles/${ARTICLE}/`);
    await expect(frame(page).locator('[data-editor-editable]').first()).toBeVisible({ timeout: 30_000 });
    // the paragraph's words, as Tab reaches them; no pointer from here on
    await frame(page).locator('[data-editor-editable]').filter({ hasText: original.slice(0, 40) }).first().focus();
    await page.keyboard.press('Control+Shift+Space');
    const prompt = frame(page).locator('[data-editor-ai-prompt]');
    const field = prompt.locator('[data-ai-field] textarea');
    await expect(field).toBeFocused();

    // Escape closes it; asking again opens it, focused
    await page.keyboard.press('Escape');
    await expect(prompt).toBeHidden();
    await frame(page).locator('[data-editor-editable]').filter({ hasText: original.slice(0, 40) }).first().focus();
    await page.keyboard.press('Control+Shift+Space');
    await expect(field).toBeFocused();

    // words and Enter: the proposal takes the focus to Keep, and Tab moves on through the result bar
    await page.keyboard.type('Make this shorter');
    await page.keyboard.press('Enter');
    await expect(prompt).toHaveAttribute('data-state', 'proposed', { timeout: 30_000 });
    const keep = prompt.locator('[data-ai-keep]');
    await expect(keep).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(keep).not.toBeFocused();
    expect(await prompt.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Shift+Tab');
    await expect(keep).toBeFocused();

    // each mark reads as what it is
    const change = frame(page).locator('[data-ai-change]');
    const removed = change.locator('del');
    expect(await removed.count()).toBeGreaterThan(0);
    for (const t of await removed.locator('.sr-only').allTextContents()) expect(t).toBe('removed: ');
    for (const t of await change.locator('ins .sr-only').allTextContents()) expect(t).toBe('added: ');
    const axe = await new AxeBuilder({ page }).include(['[data-editor-frame]', '[data-editor-ai-prompt]']).include(['[data-editor-frame]', '[data-ai-change]']).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);

    // Enter keeps it
    await page.keyboard.press('Enter');
    await expect(prompt).toBeHidden();
    await expect.poll(() => blocks()[p].markdown, { timeout: 15_000 }).toBe(firstSentence(original));
  });

  test('with no service set up, the prompt says so at once and Set up AI opens the AI screen (S5.6)', async ({ page }) => {
    setAi((s) => {
      s.services = [];
      s.writer = null;
    });
    const prompt = await openOn(page, paragraph());
    await expect(prompt).toHaveAttribute('data-state', 'note', { timeout: 30_000 });
    await expect(prompt.locator('[data-ai-note-text]')).toHaveText('Set up an AI service to use this.');
    await expect(prompt.locator('[data-ai-choice]:not([hidden])')).toHaveText(['Set up AI']);
    const setup = prompt.locator('[data-ai-choice="setup"] button');
    await expect(setup).toBeFocused();
    await setup.click();
    await expect(page).toHaveURL(/\/_edit\/ai\/$/);
  });

  test('on a private page, with the service set not to get private pages, the prompt says so and sends nothing (S5.7)', async ({ page }) => {
    setAi((s) => (s.services[0].privatePages = false));
    const file = join(FIXTURE, 'private-pages', 'articles', 'fx-private-alpha.json');
    const before = readFileSync(file, 'utf8');
    const prompt = await openOn(page, 0, 'fx-private-alpha');
    await expect(prompt).toHaveAttribute('data-state', 'note', { timeout: 30_000 });
    await expect(prompt.locator('[data-ai-note-text]')).toHaveText('This page is private, and no service is set to get private pages.');
    await expect(prompt.locator('[data-ai-choice]:not([hidden])')).toHaveText(['Change on the AI screen']);
    await expect(prompt.locator('[data-ai-choice="setup"] button')).toBeFocused();
    // words sent anyway are refused by the connector before any service is asked
    const field = prompt.locator('[data-ai-field] textarea');
    await field.fill('Make this shorter');
    const answered = page.waitForResponse((r) => r.url().endsWith('/_edit/api/ai/propose'));
    await field.press('Enter');
    const text = await (await answered).text();
    expect(text.match(/^event: .+$/gm)).toEqual(['event: status', 'event: error']);
    expect(text).toContain('"code":"private"');
    await expect(prompt).toHaveAttribute('data-state', 'note', { timeout: 30_000 });
    await expect(prompt.locator('[data-ai-note-text]')).toHaveText('This page is private, and no service is set to get private pages.');
    await expect(frame(page).locator('[data-ai-change]')).toHaveCount(0);
    expect(readFileSync(file, 'utf8')).toBe(before);
  });

  test('Turn into, Adapt with AI: a paragraph is proposed as a table under it, Keep retypes it keeping its key, and one undo brings it back (P2.5)', async ({ page }) => {
    const p = paragraph();
    const original = blocks()[p];
    const sentences = original.markdown!.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]*/g)!.map((s) => s.trim());
    await page.goto(`/_edit/articles/${ARTICLE}/`);
    await expect(frame(page).locator('[data-editor-editable]').first()).toBeVisible({ timeout: 30_000 });
    await page.locator(`[data-editor-select="${p}"]`).click();

    // Turn into offers it for a paragraph, under its own heading
    await page.locator(`[data-block-form="${p}"] [data-editor-turn-open]`).click();
    const adapt = page.locator('#editor-turn [data-editor-turn-to="ai-table"]');
    await expect(adapt).toBeVisible();
    await adapt.click();

    // the prompt asks by itself: the block stays as it is, and the table is shown under the summary
    const prompt = frame(page).locator('[data-editor-ai-prompt]');
    await expect(prompt).toHaveAttribute('data-state', 'proposed', { timeout: 30_000 });
    await expect(prompt.locator('[data-ai-summary]')).toHaveText('Turned the paragraph into a table');
    const after = prompt.locator('[data-ai-after]');
    await expect(after.locator('[data-ai-after-line]')).toHaveText('Retyped from Paragraph to Table');
    await expect(after.locator('th')).toHaveText(['Point', 'What it says']);
    await expect(after.locator('tbody tr')).toHaveCount(sentences.length);
    await expect(frame(page).locator('[data-ai-change]')).toHaveCount(0);
    await expect(prompt.locator('[data-ai-keep]')).toBeFocused();
    expect(blocks()[p]).toEqual(original);
    const axe = await new AxeBuilder({ page }).include(['[data-editor-frame]', '[data-editor-ai-prompt]']).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);

    // Keep: a table in its place, with its key
    await prompt.locator('[data-ai-keep]').click();
    await expect.poll(() => blocks()[p].type, { timeout: 15_000 }).toBe('table');
    expect(blocks()[p]).toMatchObject({ key: original.key, columns: ['Point', 'What it says'], rows: sentences.map((s, i) => [String(i + 1), s]) });
    await expect(prompt).toBeHidden();

    // one undo step brings the paragraph back
    await page.locator('[data-editor-undo]').click();
    await expect.poll(() => blocks()[p], { timeout: 15_000 }).toEqual(original);
  });
});
