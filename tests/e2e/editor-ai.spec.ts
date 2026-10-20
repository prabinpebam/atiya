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

test.describe('editor: AI', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120_000);
  test.beforeEach(() => reset());
  test.afterAll(() => reset());

  test('ask AI on a paragraph: Make shorter shows a tracked change in the block, and Keep saves it', async ({ page }) => {
    // a plain paragraph of more than one sentence
    const p = blocks().findIndex((b) => b.type === 'text' && !/[*_[\]-]/.test(b.markdown!) && firstSentence(b.markdown!) !== b.markdown!.trim());
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
  });
});
