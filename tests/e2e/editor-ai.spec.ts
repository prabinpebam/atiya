/**
 * Ask AI in the article editor (documentation/editor/ai-editing.md §4; plan: ai-plan.md S5): against the tests'
 * stand-in AI service (scripts/lib/ai-stand-in.mjs, which the fixture server starts and sets up as the writer),
 * never a real model. The stand-in cuts the block to its first sentence.
 *
 *   npx playwright test --project=editor tests/e2e/editor-ai.spec.ts
 */
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURE, reset } from '../../scripts/editor-test-server.mjs';

const ARTICLE = 'do-what-makes-you-proud';
type Block = { type: string; key?: string; markdown?: string };
const blocks = (): Block[] => JSON.parse(readFileSync(join(FIXTURE, 'content/articles', `${ARTICLE}.json`), 'utf8')).body;
const frame = (page: Page) => page.frameLocator('[data-editor-frame]');
const firstSentence = (s: string) => (/^[\s\S]*?[.!?](?=\s|$)/.exec(s)?.[0] ?? s).trim();
// a plain paragraph of more than one sentence
const paragraph = () => blocks().findIndex((b) => b.type === 'text' && !/[*_[\]-]/.test(b.markdown!) && firstSentence(b.markdown!) !== b.markdown!.trim());

/** Opens the article and Ask AI on the paragraph; the prompt. */
async function askOn(page: Page, p: number) {
  await page.goto(`/_edit/articles/${ARTICLE}/`);
  await expect(frame(page).locator('[data-editor-editable]').first()).toBeVisible({ timeout: 30_000 });
  await page.locator(`[data-editor-select="${p}"]`).click();
  await frame(page).locator('[data-chrome-op="ai"]').click();
  const prompt = frame(page).locator('[data-editor-ai-prompt]');
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
});
