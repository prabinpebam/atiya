/**
 * The album block in edit mode (documentation/gallery/spec.md §7.2; plan G9, DoD row 28): Album in the block
 * inserter, the chooser of the site's albums (an album this page can't show is there, disabled, with its
 * reason), the band on the canvas, the inspector's album and width, and an album a page shows refused a
 * change that would break it, with the pages that show it. Part of the "editor" project, on the fixture
 * server (port 4330, with the gallery fixture's `fixture-album`, which `fixture-album-note` already shows),
 * never the real content/.
 *
 *   node scripts/test-run.mjs --by agent --purpose "the album block" -- --project=editor tests/e2e/editor-album-block.spec.ts
 */
import { expect, test, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURE, reset } from '../../scripts/editor-test-server.mjs';

const ARTICLE = 'do-what-makes-you-proud';
const ALBUM = 'fixture-album';
const DRAFT_ALBUM = 'fixture-draft-album';
const WRITE = { 'content-type': 'application/json', 'X-Editor': '1', Origin: 'http://localhost:4330' };
const articleFile = (id: string) => join(FIXTURE, 'content/articles', `${id}.json`);
const readJson = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const lastBlock = () => (readJson(articleFile(ARTICLE)).body as { type: string; album?: string; width?: string }[]).at(-1)!;
const status = (page: Page) => page.locator('[data-editor-status]');
const saved = (page: Page) => expect(status(page)).toHaveText(/^Saved\b/, { timeout: 15_000 });
const outlineRows = (page: Page) => page.locator('[data-editor-outline] [data-row]');
const frame = (page: Page) => page.frameLocator('[data-editor-frame]');

/** A draft album of no pages, which a published page can't show yet. */
const writeDraftAlbum = () =>
  writeFileSync(
    articleFile(DRAFT_ALBUM),
    `${JSON.stringify(
      {
        id: DRAFT_ALBUM,
        type: 'article',
        kind: 'gallery',
        slug: DRAFT_ALBUM,
        title: 'A draft of an album',
        summary: 'Made up for the album block test.',
        status: 'draft',
        visibility: 'public',
        updatedAt: '2026-06-03',
        locale: 'en',
        body: [],
        album: { items: [] },
      },
      null,
      2,
    )}\n`,
  );

async function openArticle(page: Page, id = ARTICLE) {
  await page.goto(`/_edit/articles/${id}/`);
  await expect(frame(page).locator('[data-editor-editable]').first()).toBeVisible({ timeout: 30_000 });
}

test.describe('editor: albums: the album block', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120_000);
  test.beforeEach(() => reset());
  test.afterAll(() => reset());

  test('the album block: added from the palette, an album it cannot show said why, its band on the page, its width in the inspector', async ({ page }) => {
    writeDraftAlbum();
    await openArticle(page);
    const count = await outlineRows(page).count();
    await page.locator('[data-editor-outline] [data-editor-add-at]').click();
    await page.locator('#editor-palette [data-editor-add="album"]').click();
    const form = page.locator('#editor-insert-album');
    await expect(form).toBeVisible();
    // the site's albums only: a page that isn't an album isn't offered
    await expect(form.locator('[data-insert-album="fixture-album-note"]')).toHaveCount(0);
    const open = form.locator(`[data-insert-album="${ALBUM}"]`);
    await expect(open).not.toHaveAttribute('data-unavailable', /.*/);
    // a draft album in a published page: there, disabled, with what to do
    const draft = form.locator(`[data-insert-album="${DRAFT_ALBUM}"]`);
    await expect(draft).toHaveAttribute('data-unavailable', '');
    await expect(draft).toContainText('publish the album first');
    await expect(draft.getByRole('radio')).toBeDisabled();
    // nothing chosen: said, and nothing added
    await form.getByRole('button', { name: 'Add the album' }).click();
    await expect(form.locator('[data-editor-form-issue]')).toHaveText('Choose an album.');
    await open.click();
    await form.getByRole('combobox', { name: 'Width' }).click();
    await page.getByRole('option', { name: /^Full bleed/ }).click();
    await form.getByRole('button', { name: 'Add the album' }).click();
    await expect(outlineRows(page)).toHaveCount(count + 1);
    await saved(page);
    expect(lastBlock()).toMatchObject({ type: 'album', album: ALBUM, width: 'full' });

    // the band on the canvas, at its width, See all to the album
    const shown = frame(page).locator(`[data-album-block="${ALBUM}"]`).last();
    await expect(shown).toHaveAttribute('data-breakout', 'full');
    await expect(shown.locator(`[data-album-band][data-album-id="${ALBUM}"]`)).toBeVisible();
    await expect(shown.locator('[data-see-all]')).toHaveAttribute('href', new RegExp(`/gallery/${ALBUM}/$`));

    // the inspector: the album (the draft disabled there too) and the width
    await page.locator(`[data-editor-select="${count}"]`).click();
    const settings = page.locator(`[data-block-form="${count}"]`);
    await expect(settings.locator('[data-album-choice]')).toBeVisible();
    await expect(settings.locator('[data-album-edit]')).toHaveAttribute('href', new RegExp(`/_edit/articles/${ALBUM}/$`));
    await settings.getByRole('combobox', { name: 'Album' }).click();
    await expect(page.getByRole('option', { name: /A draft of an album/ })).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Escape');
    await settings.getByRole('combobox', { name: 'Width' }).click();
    await page.getByRole('option', { name: /^Wide/ }).click();
    await saved(page);
    expect(lastBlock()).toMatchObject({ type: 'album', album: ALBUM, width: 'wide' });
    await expect(frame(page).locator(`[data-album-block="${ALBUM}"]`).last()).toHaveAttribute('data-breakout', 'wide');
  });

  test('the album block: an album a page shows is refused private or a draft, with the pages that show it', async ({ page }) => {
    const request = page.request;
    // made private: refused, naming the page that shows it
    const priv = await request.put(`/_edit/api/articles/${ALBUM}/access`, { headers: WRITE, data: { access: 'private' } });
    expect(priv.status()).toBe(422);
    expect(JSON.stringify(await priv.json())).toContain('Notes from the hills');
    expect(readFileSync(articleFile(ALBUM), 'utf8')).toContain('"status": "published"');

    // back to a draft from its own editor (the album editor, which has the same Page tab): refused, said where the status is
    await page.goto(`/_edit/articles/${ALBUM}/`);
    await page.getByRole('tab', { name: 'Page', exact: true }).click();
    await page.getByRole('combobox', { name: 'Status', exact: true }).click();
    await page.getByRole('option', { name: /^Draft/ }).click();
    await expect(page.locator('[data-editor-issue]').getByText(/can't go back to a draft: "Notes from the hills" is published and shows it/)).toBeVisible({ timeout: 15_000 });
    expect(readJson(articleFile(ALBUM)).status).toBe('published');
  });
});
