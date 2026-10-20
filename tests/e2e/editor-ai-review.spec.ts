/**
 * The Review tab (documentation/editor/ai-editing.md §8; plan: ai-plan.md P2.3, P2.4): Ask about section on a
 * heading keeps a proposal on the server, and the inspector reviews it change by change. Against the tests'
 * stand-in AI service (scripts/lib/ai-stand-in.mjs), which cuts each paragraph of the section to its first
 * sentence and adds one paragraph at its end; never a real model.
 *
 *   npx playwright test --project=editor tests/e2e/editor-ai-review.spec.ts
 */
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURE, reset } from '../../scripts/editor-test-server.mjs';
import { ADDED } from '../../scripts/lib/ai-stand-in.mjs';

const ARTICLE = 'do-what-makes-you-proud';
const FILE = join(FIXTURE, 'content/articles', `${ARTICLE}.json`);
const PROPOSALS = join(FIXTURE, '.atiya', 'proposals');
type Block = { type: string; key?: string; markdown?: string; level?: number };
const article = () => JSON.parse(readFileSync(FILE, 'utf8'));
const blocks = (): Block[] => article().body;
const frame = (page: Page) => page.frameLocator('[data-editor-frame]');
const firstSentence = (s: string) => (/^[\s\S]*?[.!?](?=\s|$)/.exec(s)?.[0] ?? s).trim();
/** The first heading, and the paragraphs of its section the stand-in cuts. */
function section() {
  const body = blocks();
  const at = body.findIndex((b) => b.type === 'heading');
  let end = at + 1;
  while (end < body.length && !(body[end].type === 'heading' && body[end].level! <= body[at].level!)) end++;
  const cut = body.slice(at + 1, end).filter((b) => b.type === 'text' && firstSentence(b.markdown!) !== b.markdown!.trim());
  return { at, end, cut };
}
const proposals = () => (existsSync(PROPOSALS) ? readdirSync(PROPOSALS).filter((f) => f.endsWith('.json')) : []);

/** Opens the article; the review's region, if any. */
async function open(page: Page) {
  await page.goto(`/_edit/articles/${ARTICLE}/`);
  await expect(frame(page).locator('[data-editor-editable]').first()).toBeVisible({ timeout: 30_000 });
  return page.locator('[data-ai-review]');
}
/** Asks about the section under the heading at `at` with Make shorter; the review, its head focused. */
async function askSection(page: Page, at: number) {
  await page.locator(`[data-editor-select="${at}"]`).click();
  await frame(page).locator('[data-chrome-op="ai"]').click();
  const prompt = frame(page).locator('[data-editor-ai-prompt]');
  await expect(prompt.locator('[data-ai-title]')).toHaveText('Ask about section');
  await prompt.locator('[data-ai-action="shorten"]').click();
  const review = page.locator('[data-ai-review]');
  await expect(review.locator('[data-ai-review-head]')).toBeFocused({ timeout: 30_000 });
  await expect(prompt).toBeHidden();
  return review;
}
const row = (page: Page, key: string) => page.locator(`[data-ai-review-row="${key}"]`);
const decide = (page: Page, key: string, d: 'accept' | 'reject') => row(page, key).locator(`[data-ai-review-decide="${d}"]`);

test.describe('editor: AI review', () => {
  test.setTimeout(150_000);
  test.beforeEach(() => reset());
  test.afterAll(() => reset());

  test('Ask about section keeps a proposal: the Review tab opens on it, the canvas marks it, and Apply makes the accepted changes as one save and one undo step', async ({ page }) => {
    const before = blocks();
    const { at, end, cut } = section();
    expect(cut.length).toBeGreaterThanOrEqual(2);
    const [keep, leave] = cut;

    // no proposal, no Review tab
    await open(page);
    await expect(page.locator('#inspector-tabs [data-tab="review"]')).toHaveCount(0);

    // the review: its head says who and why, a row per change, the Review tab chosen, the proposal kept
    const review = await askSection(page, at);
    await expect(review.locator('[data-ai-review-head]')).toHaveText(/proposed \d+ changes: Tightened the section/);
    await expect(page.locator('#inspector-tabs [data-tab="review"]')).toHaveAttribute('aria-selected', 'true');
    const rows = review.locator('[data-ai-review-row]');
    await expect(rows).toHaveCount(cut.length + 1);
    const added = review.locator('[data-ai-review-row][data-kind="added"]');
    await expect(added).toHaveCount(1);
    await expect(added).toContainText(ADDED);
    expect(proposals()).toHaveLength(1);
    // the canvas marks each changed block still in the article; nothing is saved yet
    await expect(frame(page).locator('[data-ai-mark]')).toHaveCount(cut.length);
    expect(blocks()).toEqual(before);

    // accept two, reject one: Apply counts what's accepted
    const apply = review.locator('[data-ai-review-apply]');
    await expect(apply).toBeDisabled();
    await decide(page, keep.key!, 'accept').click();
    await added.locator('[data-ai-review-decide="accept"]').click();
    await decide(page, leave.key!, 'reject').click();
    await expect(decide(page, keep.key!, 'accept')).toHaveAttribute('aria-pressed', 'true');
    await expect(row(page, leave.key!)).toHaveAttribute('data-decision', 'reject');
    await expect(apply).toHaveText('Apply 2 changes');

    // Apply: one save, keys kept, the added paragraph at the section's end; the proposal and its tab go
    await apply.click();
    await expect.poll(() => blocks().find((b) => b.key === keep.key)?.markdown, { timeout: 15_000 }).toBe(firstSentence(keep.markdown!));
    const now = blocks();
    expect(now.find((b) => b.key === leave.key)?.markdown).toBe(leave.markdown);
    expect(now[end]).toMatchObject({ type: 'text', markdown: ADDED });
    expect(now[end].key).toMatch(/^[a-z0-9]{6}$/);
    await expect(page.locator('[data-ai-review]')).toHaveCount(0);
    await expect(page.locator('#inspector-tabs [data-tab="review"]')).toHaveCount(0);
    expect(proposals()).toHaveLength(0);

    // one undo step brings the whole article back
    await page.locator('[data-editor-undo]').click();
    await expect.poll(() => blocks(), { timeout: 15_000 }).toEqual(before);
  });

  test('decisions are kept across a reload; a block changed since asks Use mine or Use AI\'s, a removed one can only be rejected; Discard asks first', async ({ page }) => {
    const { at, cut } = section();
    const [mine, gone] = cut;
    await open(page);
    await askSection(page, at);
    await decide(page, mine.key!, 'accept').click();
    await expect(row(page, mine.key!)).toHaveAttribute('data-decision', 'accept');
    // the choice is kept on the server before the reload
    await expect.poll(() => JSON.parse(readFileSync(join(PROPOSALS, proposals()[0]), 'utf8')).decisions?.[mine.key!]).toBe('accept');

    // a reload reopens the review, on its tab, with the decision
    let review = await open(page);
    await expect(page.locator('#inspector-tabs [data-tab="review"]')).toHaveAttribute('aria-selected', 'true');
    await expect(decide(page, mine.key!, 'accept')).toHaveAttribute('aria-pressed', 'true');

    // change one block and remove another elsewhere: the review says so
    const doc = article();
    doc.body = doc.body.filter((b: Block) => b.key !== gone.key).map((b: Block) => (b.key === mine.key ? { ...b, markdown: 'Changed by hand since.' } : b));
    writeFileSync(FILE, `${JSON.stringify(doc, null, 2)}\n`);
    review = await open(page);
    await expect(row(page, mine.key!)).toHaveAttribute('data-conflict', 'mine');
    await expect(row(page, mine.key!).locator('.why')).toHaveText("You've changed this block since.");
    await expect(decide(page, mine.key!, 'accept')).toContainText("Use AI's");
    await expect(decide(page, mine.key!, 'reject')).toContainText('Use mine');
    await expect(row(page, gone.key!)).toHaveAttribute('data-conflict', 'removed');
    await expect(decide(page, gone.key!, 'accept')).toBeDisabled();

    // Accept all can't accept the removed one: it's rejected
    await review.locator('[data-ai-review-all="accept"]').click();
    await expect(decide(page, gone.key!, 'reject')).toHaveAttribute('aria-pressed', 'true');
    await expect(review.locator('[data-ai-review-apply]')).toHaveText(`Apply ${cut.length} changes`);

    // Discard asks first (changes are accepted), then drops the proposal and changes nothing
    const saved = blocks();
    let asked = '';
    page.once('dialog', (d) => {
      asked = d.message();
      void d.accept();
    });
    await review.locator('[data-ai-review-discard]').click();
    await expect(page.locator('[data-ai-review]')).toHaveCount(0, { timeout: 15_000 });
    expect(asked).toMatch(/Discard this proposal/);
    expect(proposals()).toHaveLength(0);
    expect(blocks()).toEqual(saved);
  });

  test('the review works by keyboard alone, its marks have text twins, and axe passes in light and dark', async ({ page }) => {
    const { at, cut } = section();
    const heading = (blocks()[at] as Block & { text: string }).text;
    await open(page);
    // the heading's words, as Tab reaches them; no pointer from here on
    await frame(page).locator('[data-editor-editable]').filter({ hasText: heading.slice(0, 30) }).first().focus();
    await page.keyboard.press('Control+Shift+Space');
    const prompt = frame(page).locator('[data-editor-ai-prompt]');
    await expect(prompt.locator('[data-ai-title]')).toHaveText('Ask about section');
    await expect(prompt.locator('[data-ai-field] textarea')).toBeFocused();
    await page.keyboard.type('Make this shorter');
    await page.keyboard.press('Enter');
    const review = page.locator('[data-ai-review]');
    await expect(review.locator('[data-ai-review-head]')).toBeFocused({ timeout: 30_000 });

    // Tab reaches Accept all, Reject all, then the first row's name and its choices
    await page.keyboard.press('Tab');
    await expect(review.locator('[data-ai-review-all="accept"]')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(review.locator('[data-ai-review-all="reject"]')).toBeFocused();
    await page.keyboard.press('Tab');
    const first = review.locator('[data-ai-review-row]').first();
    await expect(first.locator('[data-ai-review-go]')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(first.locator('[data-ai-review-decide="accept"]')).toBeFocused();
    await page.keyboard.press('Space');
    await expect(first.locator('[data-ai-review-decide="accept"]')).toHaveAttribute('aria-pressed', 'true');
    // again clears it; once more decides it
    await page.keyboard.press('Space');
    await expect(first).toHaveAttribute('data-decision', '');
    await page.keyboard.press('Space');
    await expect(first).toHaveAttribute('data-decision', 'accept');
    const key = (await first.getAttribute('data-ai-review-row'))!;

    // each mark reads as what it is, in the review and in the canvas
    for (const t of await review.locator('del .sr-only').allTextContents()) expect(t).toBe('removed: ');
    for (const t of await review.locator('ins .sr-only').allTextContents()) expect(t).toBe('added: ');
    const marks = frame(page).locator('[data-ai-mark]');
    await expect(marks).toHaveCount(cut.length);
    for (const d of await marks.evaluateAll((els) => els.map((el) => el.getAttribute('aria-description')))) expect(d).toMatch(/in the proposal under review$/);

    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      const axe = await new AxeBuilder({ page }).include('[data-ai-review]').analyze();
      expect(axe.violations.map((v) => `${scheme} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    }

    // Tab on to Apply, and Enter applies
    const apply = review.locator('[data-ai-review-apply]');
    for (let i = 0; i < 30 && !(await apply.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
    await expect(apply).toBeFocused();
    await page.keyboard.press('Enter');
    const was = cut.find((b) => b.key === key)!;
    await expect.poll(() => blocks().find((b) => b.key === key)?.markdown, { timeout: 15_000 }).toBe(firstSentence(was.markdown!));
    await expect(page.locator('[data-ai-review]')).toHaveCount(0);
  });
});
