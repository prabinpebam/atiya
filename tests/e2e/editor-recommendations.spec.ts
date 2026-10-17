/**
 * Recommendations (documentation/sections/recommendations.md, R2 to R6): edit mode's Recommendations screen adds,
 * edits, hides and orders them and chooses where a section shows them; the section's page shows the visible ones
 * there in its layout, long ones opening in a dialog or expanding in place, with no sideways scroll on a phone and
 * axe clean in light and dark; a building that shows the section shows them too. The editor project, on the
 * fixture server (port 4330). The people are made up for the test.
 *
 *   npx playwright test --project=editor -g "editor: recommendations"
 */
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURE, reset } from '../../scripts/editor-test-server.mjs';

const LONG =
  'A made-up recommendation for the test, long enough to be cut short in every layout so that its card shows the control. It goes on about what working together was like, the projects shared and the problems solved along the way.\n\nA second paragraph follows the first, as a recommendation often has one: what the person brought to the team, how they led, and what everyone learned from them over the years together.\n\nA third paragraph makes sure of it even in the widest layout: how the work changed the product, the people who joined because of it, the habits the team still keeps, and a closing line that says the writer would gladly work with them again on anything at all.';
const PEOPLE = [
  { id: 'test-person-one', name: 'Test Person One', title: 'Design Director, Example Co', link: 'https://www.linkedin.com/in/example', relationship: 'Managed me at Example Co', date: '2025-03', text: LONG },
  { id: 'test-person-two', name: 'Test Person Two', title: 'Engineering Manager, Example Studio', text: 'A short one: it fits.' },
  { id: 'test-person-three', name: 'Test Person Three', title: 'Product Lead, Example Team', text: 'Hidden from the site.', hidden: true },
];
const recsFile = () => JSON.parse(readFileSync(join(FIXTURE, 'content/recommendations.json'), 'utf8')) as { items: { id: string; name: string; hidden?: boolean }[] };
const siteTree = () => JSON.parse(readFileSync(join(FIXTURE, 'content/structures/site.json'), 'utf8'));
const status = (page: Page) => page.locator('[data-editor-status]');

/**
 * The fixture is a copy of content/ as it is on disk, which may hold the owner's own recommendations: every test
 * starts from none, and no section showing them (the fixture only, never content/).
 */
function startEmpty() {
  reset();
  rmSync(join(FIXTURE, 'content/recommendations.json'), { force: true });
  const tree = siteTree();
  for (const n of tree.home.children) delete n.recommendations;
  // whole, never half-written: the dev server's watcher reads it the moment it changes
  const file = join(FIXTURE, 'content/structures/site.json');
  writeFileSync(`${file}.tmp`, `${JSON.stringify(tree, null, 2)}\n`);
  renameSync(`${file}.tmp`, file);
}
const band = (page: Page) => page.locator('#recommendations');

/** The list and About's settings, saved through the editor's API as the screen saves them. */
async function seed(page: Page, settings: Record<string, unknown>) {
  await page.goto('/_edit/recommendations/');
  const codes = await page.evaluate(
    async ({ items, settings }) => {
      const headers = { 'X-Editor': '1', 'Content-Type': 'application/json' };
      const state = JSON.parse(document.querySelector('[data-recs-state]')!.textContent!);
      const a = await fetch('/_edit/api/recommendations', { method: 'PUT', headers, body: JSON.stringify({ items, ifMatch: { [state.listKey]: state.listVersion } }) });
      const b = await fetch('/_edit/api/recommendations/section', { method: 'PUT', headers, body: JSON.stringify({ section: 'about', settings, ifMatch: { [state.structureKey]: state.structureVersion } }) });
      return [a.status, b.status];
    },
    { items: PEOPLE, settings },
  );
  expect(codes).toEqual([200, 200]);
  // the dev server pushes the change to open pages a moment later (and they reload): let it pass first
  await page.waitForTimeout(1500);
}

async function axe(page: Page, scope: string) {
  const r = await new AxeBuilder({ page }).include(scope).analyze();
  return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

test.describe('editor: recommendations', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(240_000);
  test.beforeEach(async () => {
    startEmpty();
    // the dev server notices files changed by hand a moment later
    await new Promise((r) => setTimeout(r, 1500));
  });
  test.afterAll(() => reset());

  test('the screen lists them beside the chosen one: adds, edits, hides, orders and deletes them, and turns them on for About', async ({ page }) => {
    await page.goto('/_edit/recommendations/');
    const list = page.getByRole('navigation', { name: 'Recommendations' });
    const detail = page.locator('[data-editor-recs] .detail');
    const row = (id: string) => list.locator(`[data-rec-row="${id}"]`);
    const save = (name: string) => detail.getByRole('button', { name, exact: true }).click();
    // with none yet, the details are a new one's form
    await expect(detail.getByRole('heading', { name: 'Add recommendation' })).toBeVisible();

    for (const p of PEOPLE.slice(0, 2)) {
      await list.getByRole('link', { name: 'Add recommendation' }).click();
      await expect(detail.getByRole('heading', { name: 'Add recommendation' })).toBeVisible();
      await expect(page.locator('input[name="name"]')).toBeFocused();
      await detail.locator('input[name="name"]').fill(p.name);
      await detail.locator('input[name="title"]').fill(p.title);
      if (p.link) await detail.locator('input[name="link"]').fill(p.link);
      await detail.locator('textarea[name="text"]').fill(p.text);
      await save('Add recommendation');
      // chosen in the list, its details beside it
      await expect(row(p.id).getByRole('link')).toHaveAttribute('aria-current', 'true', { timeout: 30_000 });
      await expect(detail.getByRole('heading', { level: 2, name: p.name })).toBeVisible();
      await expect(row(p.id).getByRole('link')).toBeFocused();
    }
    expect(recsFile().items.map((r) => r.id)).toEqual(['test-person-one', 'test-person-two']);

    // a photo uploaded: kept as a picture of the site's, shown in the list and the details (the fixture server never asks LinkedIn)
    await row('test-person-one').getByRole('link').click();
    await expect(detail.getByRole('heading', { level: 2, name: 'Test Person One' })).toBeVisible();
    await detail.locator('input[name="file"]').setInputFiles(join(process.cwd(), 'public/avatars/skater.webp'));
    await save('Save recommendation');
    await expect(row('test-person-one').locator('img')).toBeVisible({ timeout: 30_000 });
    await expect(detail.locator('.head img')).toBeVisible();
    expect((recsFile().items[0] as { photo?: string }).photo).toMatch(/^shared\/test-person-one-photo/);

    // a link that isn't https is refused in the form, said in words; then hidden
    await row('test-person-two').getByRole('link').click();
    await expect(detail.getByRole('heading', { level: 2, name: 'Test Person Two' })).toBeVisible();
    await detail.locator('input[name="link"]').fill('example.com');
    await save('Save recommendation');
    await expect(detail.locator('[data-editor-form-issue]')).toContainText('https://');
    await detail.locator('input[name="link"]').fill('');
    await detail.getByRole('checkbox', { name: 'Hide from the site' }).check();
    await save('Save recommendation');
    await expect(row('test-person-two')).toContainText('Hidden', { timeout: 30_000 });
    expect(recsFile().items[1].hidden).toBe(true);

    // ordered: two up to the top
    await detail.getByRole('button', { name: 'Move up' }).click();
    await expect(list.locator('[data-rec-row]').first()).toHaveAttribute('data-rec-row', 'test-person-two', { timeout: 30_000 });
    expect(recsFile().items.map((r) => r.id)).toEqual(['test-person-two', 'test-person-one']);

    // where they show: About first, off; on, after its pages, as a wall, the rest of the section kept
    await list.getByRole('link', { name: /Where they show/ }).click();
    await expect(page.locator('[data-recs-place] input[name="section"]')).toHaveValue('about');
    await expect(page.getByRole('switch', { name: 'Show on this section' })).not.toBeChecked();
    // the layouts are tiles in one row
    const layouts = page.locator('[data-recs-place] fieldset', { has: page.getByText('Layout', { exact: true }) }).locator('.choice-card');
    const tops = await layouts.evaluateAll((cards) => cards.map((c) => Math.round(c.getBoundingClientRect().top)));
    expect(new Set(tops).size, JSON.stringify(tops)).toBe(1);
    const before = siteTree().home.children.find((n: { id: string }) => n.id === 'about');
    await page.getByRole('switch', { name: 'Show on this section' }).check();
    await page.locator('[data-recs-place]').getByRole('radio', { name: /^Wall/ }).check();
    await page.getByRole('button', { name: 'Save where they show' }).click();
    await expect(status(page)).toContainText('Saved where recommendations show', { timeout: 30_000 });
    await expect(list.getByRole('link', { name: /Where they show/ })).toContainText('About, after the pages, as a wall');
    const about = siteTree().home.children.find((n: { id: string }) => n.id === 'about');
    expect(about.recommendations).toEqual({ show: true, at: 'end', layout: 'wall', open: 'dialog' });
    expect({ ...about, recommendations: undefined }).toEqual({ ...before, recommendations: undefined });

    // expanding in place can't be chosen for tiles
    await page.locator('[data-recs-place]').getByRole('radio', { name: /^Tiles/ }).check();
    await expect(page.getByRole('radio', { name: 'Expand in place' })).toBeDisabled();
    await page.locator('[data-recs-place]').getByRole('radio', { name: /^Wall/ }).check();

    // deleted, after asking: the next one is chosen (leaving the unsaved layout change asks first)
    const asked = page.waitForEvent('dialog').then(async (d) => {
      expect(d.message()).toContain('without saving');
      await d.accept();
    });
    await row('test-person-one').getByRole('link').click();
    await asked;
    await expect(detail.getByRole('heading', { level: 2, name: 'Test Person One' })).toBeVisible();
    await detail.getByRole('button', { name: 'Delete', exact: true }).click();
    await detail.getByRole('button', { name: 'Delete for good' }).click();
    await expect(row('test-person-one')).toHaveCount(0, { timeout: 30_000 });
    await expect(detail.getByRole('heading', { level: 2, name: 'Test Person Two' })).toBeVisible();

    for (const scheme of ['light', 'dark'] as const) {
      for (const rec of ['test-person-two', 'place']) {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(`/_edit/recommendations/?rec=${rec}`);
        await expect(page.locator('[data-editor-recs]')).toBeVisible();
        expect(await axe(page, '[data-editor-recs]'), `${scheme} ${rec}`).toEqual([]);
      }
    }
  });
  test('About shows the visible ones after its pages as tiles, long ones read in full in a dialog', async ({ page }) => {
    await seed(page, { show: true, at: 'end', layout: 'tiles', open: 'inline' });
    await page.goto('/about/');
    await expect(band(page)).toBeVisible();
    await expect(band(page).getByRole('heading', { level: 2, name: 'Recommendations' })).toBeVisible();
    // the hidden one isn't there; the band follows the pages
    await expect(band(page).locator('article')).toHaveCount(2);
    // the tiles' anatomy: the same height, their person sections level and the same height (the owner's ask)
    const boxes = await band(page).locator('article').evaluateAll((cards) =>
      cards.map((c) => {
        const card = c.getBoundingClientRect();
        const person = c.querySelector('[data-person]')!.getBoundingClientRect();
        const words = c.querySelector('blockquote')!.getBoundingClientRect();
        return { h: Math.round(card.height), top: Math.round(person.top), ph: Math.round(person.height), wordsTop: Math.round(words.top) };
      }),
    );
    expect(new Set(boxes.map((b) => b.h)).size, JSON.stringify(boxes)).toBe(1);
    expect(new Set(boxes.map((b) => b.top)).size, JSON.stringify(boxes)).toBe(1);
    expect(new Set(boxes.map((b) => b.ph)).size, JSON.stringify(boxes)).toBe(1);
    expect(new Set(boxes.map((b) => b.wordsTop)).size, JSON.stringify(boxes)).toBe(1);
    await expect(band(page)).not.toContainText('Test Person Three');
    expect(await page.evaluate(() => !!(document.querySelector('main .list[data-view]')!.compareDocumentPosition(document.querySelector('#recommendations')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
    // each card: the person's name, title and profile link
    const one = band(page).getByRole('article', { name: 'Test Person One' });
    await expect(one).toContainText('Design Director, Example Co');
    await expect(one).toContainText('Managed me at Example Co · March 2025');
    await expect(one.getByRole('link', { name: /LinkedIn profile/ })).toHaveAttribute('href', 'https://www.linkedin.com/in/example');
    // tiles never expand in place: the long one opens in the dialog, the short one has no control
    await expect(band(page).getByRole('article', { name: 'Test Person Two' }).getByRole('button')).toHaveCount(0);
    const read = one.getByRole('button', { name: 'Read in full' });
    await read.click();
    const dialog = page.getByRole('dialog', { name: 'Test Person One' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('A second paragraph follows the first');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(read).toBeFocused();

    for (const scheme of ['light', 'dark'] as const) {
      // drawn in the scheme (switched in place, the colours would be caught mid-transition)
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/about/');
      await expect(band(page)).toBeVisible();
      expect(await axe(page, '#recommendations'), scheme).toEqual([]);
    }

    // a building that shows About shows them too
    const planet = await (await page.request.get('/play/town-hall/')).text();
    expect(planet).toContain('data-recommendations');
    expect(planet).toContain('Test Person One');
  });

  test('rows expand in place, before the pages; after a page, across the list', async ({ page }) => {
    await seed(page, { show: true, at: 'start', layout: 'rows', open: 'inline', heading: 'What people say' });
    await page.goto('/about/');
    await expect(band(page).getByRole('heading', { name: 'What people say' })).toBeVisible();
    expect(await page.evaluate(() => !!(document.querySelector('#recommendations')!.compareDocumentPosition(document.querySelector('main .list[data-view]')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
    // found by its card: its name changes to Show less
    const more = band(page).getByRole('article', { name: 'Test Person One' }).locator('[data-more-button]');
    await expect(more).toHaveText('Show it all');
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    const words = band(page).locator('#recommendations-test-person-one-words');
    const short = (await words.boundingBox())!.height;
    await more.click();
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await expect(more).toHaveText('Show less');
    expect((await words.boundingBox())!.height).toBeGreaterThan(short);

    await seed(page, { show: true, at: 'after', after: 'my-journey-with-designup', layout: 'spotlight', open: 'dialog' });
    await page.goto('/about/');
    // inside the list, right after that page's card
    await expect(page.locator('[data-cards] > [data-node="my-journey-with-designup"] + .band #recommendations')).toBeVisible();
  });

  test('every layout fits a phone without scrolling sideways', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    for (const layout of ['tiles', 'rows', 'wall', 'spotlight']) {
      await seed(page, { show: true, at: 'end', layout, open: 'dialog' });
      await page.goto('/about/');
      await expect(band(page)).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), layout).toBeLessThanOrEqual(0);
    }
  });
});
