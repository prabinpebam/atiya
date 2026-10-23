/**
 * Home highlights on the isolated editor fixture: four trusted kinds, options, stable ordering,
 * removal, waiting sources, failed saves and cross-tab version conflicts. Never writes real content.
 */
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURE, reset } from '../../scripts/editor-test-server.mjs';
import type { Highlights } from '../../src/site/content/highlights';

const base = (): Highlights => ({
  label: 'Highlights', enabled: true, peek: false, arrows: true, pager: 'dots',
  display: 'fill', background: false, rounded: true, shadow: false, items: [],
});
const file = () => join(FIXTURE, 'content', 'highlights.json');
const saved = (): Highlights => JSON.parse(readFileSync(file(), 'utf8'));
const screen = (page: Page) => page.locator('[data-editor-highlights]');
const rows = (page: Page) => screen(page).locator('[data-highlight-row]');
const status = (page: Page) => page.locator('[data-editor-status]');
const issue = (page: Page) => screen(page).locator('[data-editor-form-issue]');
const select = async (page: Page, label: string, option: string) => {
  await screen(page).getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: new RegExp(`^${option.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|\\s)`) }).click();
};
const addSource = async (page: Page, key: string) => {
  const title = await screen(page).locator('[data-highlights-state]').evaluate((element, key) => {
    return JSON.parse(element.textContent!).choices.find((c: { key: string }) => c.key === key)?.title as string | undefined;
  }, key);
  expect(title, `Fixture source ${key} is offered`).toBeTruthy();
  await select(page, 'Add a source', title!);
  await screen(page).getByRole('button', { name: 'Add slide', exact: true }).click();
};
const save = async (page: Page) => {
  await screen(page).getByRole('button', { name: 'Save highlights', exact: true }).click();
  await expect(status(page)).toContainText('Saved home highlights', { timeout: 30_000 });
  await expect(screen(page).getByRole('button', { name: 'Save highlights' })).toBeEnabled();
};

test.describe('editor: home highlights', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(180_000);
  test.beforeEach(async () => {
    reset();
    writeFileSync(`${file()}.tmp`, `${JSON.stringify(base(), null, 2)}\n`);
    renameSync(`${file()}.tmp`, file());
    // Wait for the fixture server's file watcher before opening an editable screen.
    await new Promise((resolve) => setTimeout(resolve, 1500));
  });
  test.afterAll(() => reset());

  test('adds every kind, edits settings and verbatim text, orders with buttons, saves, reopens and removes without deleting sources', async ({ page }) => {
    await page.goto('/_edit/highlights/');
    await expect(page.getByRole('heading', { level: 1, name: 'Home highlights' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Edit mode' }).getByRole('link', { name: /Home highlights/ })).toHaveCount(1);
    await expect(screen(page).getByRole('button', { name: 'Add slide', exact: true })).toBeDisabled();
    await addSource(page, 'custom:github');
    await expect(screen(page).getByRole('button', { name: 'Add slide', exact: true })).toBeDisabled();
    await addSource(page, 'article:fixture-album-note');
    await expect(rows(page).nth(1)).toContainText('Waiting: Add a lead picture');
    await rows(page).nth(1).getByRole('textbox', { name: 'Page excerpt' }).fill('A few words before the pictures.');
    await addSource(page, 'album:fixture-album');
    await addSource(page, 'image:articles/fixture-album/p02');
    const ids = await rows(page).evaluateAll((elements) => elements.map((e) => (e as HTMLElement).dataset.highlightRow));
    expect(new Set(ids).size).toBe(4);
    await expect(rows(page).first().getByRole('button', { name: 'Move up', exact: true })).toBeDisabled();
    await expect(rows(page).last().getByRole('button', { name: 'Move down', exact: true })).toBeDisabled();
    await rows(page).last().getByRole('button', { name: 'Move up', exact: true }).click();
    await expect(rows(page).nth(2).getByRole('button', { name: 'Move up', exact: true })).toBeFocused();
    await rows(page).nth(2).getByRole('button', { name: 'Move up', exact: true }).click();
    await screen(page).getByRole('textbox', { name: 'Carousel label' }).fill('From the fixture');
    await screen(page).getByRole('switch', { name: 'Show home highlights' }).uncheck();
    await screen(page).getByRole('checkbox', { name: 'Peek at neighbours' }).check();
    await screen(page).getByRole('checkbox', { name: 'Show arrow buttons' }).uncheck();
    await screen(page).getByRole('checkbox', { name: 'Use automatic background' }).check();
    await screen(page).getByRole('checkbox', { name: 'Round picture corners' }).uncheck();
    await screen(page).getByRole('checkbox', { name: 'Show picture shadow' }).check();
    await select(page, 'Pager', 'Wrapping filmstrip');
    await select(page, 'Picture display', 'Tile');
    await save(page);
    expect(saved()).toMatchObject({
      label: 'From the fixture', enabled: false, peek: true, arrows: false, pager: 'filmstrip-wrap',
      display: 'tile', background: true, rounded: false, shadow: true,
    });
    expect(saved().items.map((i) => i.id)).toEqual([ids[0], ids[3], ids[1], ids[2]]);
    expect(saved().items[2]).toMatchObject({ type: 'article', text: 'A few words before the pictures.' });
    await page.reload();
    await expect(screen(page).getByRole('textbox', { name: 'Carousel label' })).toHaveValue('From the fixture');
    await expect(screen(page).getByRole('switch', { name: 'Show home highlights' })).not.toBeChecked();
    await expect(screen(page).getByRole('combobox', { name: 'Pager', exact: true })).toContainText('Wrapping filmstrip');
    await expect(rows(page).nth(2).getByRole('textbox', { name: 'Page excerpt' })).toHaveValue('A few words before the pictures.');
    await rows(page).last().getByRole('button', { name: 'Remove slide', exact: true }).click();
    await save(page);
    expect(saved().items).toHaveLength(3);
    expect(JSON.parse(readFileSync(join(FIXTURE, 'content', 'albums', 'fixture-album.json'), 'utf8')).id).toBe('fixture-album');
    await select(page, 'Pager', 'Filmstrip');
    await select(page, 'Picture display', 'Fit');
    await save(page);
    expect(saved()).toMatchObject({ pager: 'filmstrip', display: 'fit' });
    await select(page, 'Pager', 'Dots');
    await select(page, 'Picture display', 'Actual');
    await save(page);
    expect(saved()).toMatchObject({ pager: 'dots', display: 'actual', arrows: false });
  });

  test('refuses an invented excerpt with failed-save feedback, keeps the input, and saves intentional empty highlights', async ({ page }) => {
    await page.goto('/_edit/highlights/');
    await addSource(page, 'article:fixture-album-note');
    const excerpt = () => rows(page).first().getByRole('textbox', { name: 'Page excerpt' });
    await excerpt().fill('These invented words do not belong to the page.');
    const refused = page.waitForResponse((r) => r.url().includes('/_edit/api/highlights') && r.request().method() === 'PUT');
    await screen(page).getByRole('button', { name: 'Save highlights' }).click();
    expect((await refused).status()).toBe(422);
    await expect(issue(page)).toContainText('word for word');
    await expect(status(page)).toContainText('Not saved');
    await expect(excerpt()).toHaveValue('These invented words do not belong to the page.');
    expect(saved().items).toEqual([]);
    await excerpt().fill('A few words before the pictures.');
    await save(page);
    await rows(page).first().getByRole('button', { name: 'Remove slide' }).click();
    await save(page);
    await page.reload();
    await expect(rows(page)).toHaveCount(0);
    await expect(screen(page).locator('[data-highlight-empty]')).toBeVisible();
    expect(saved()).toMatchObject({ enabled: true, items: [] });
  });

  test('preserves dirty input on cross-tab updates and a 409, while clean screens follow changes', async ({ page, context }) => {
    await page.goto('/_edit/highlights/');
    const other = await context.newPage();
    await other.goto('/_edit/highlights/');
    await screen(other).getByRole('textbox', { name: 'Carousel label' }).fill('A shared change');
    await save(other);
    await expect(screen(page).getByRole('textbox', { name: 'Carousel label' })).toHaveValue('A shared change', { timeout: 30_000 });
    await screen(page).getByRole('textbox', { name: 'Carousel label' }).fill('My unsaved words');
    await screen(other).getByRole('textbox', { name: 'Carousel label' }).fill('The newer saved words');
    await save(other);
    await expect(issue(page)).toContainText('Content changed elsewhere', { timeout: 30_000 });
    await expect(screen(page).getByRole('textbox', { name: 'Carousel label' })).toHaveValue('My unsaved words');
    const conflict = page.waitForResponse((r) => r.url().includes('/_edit/api/highlights') && r.request().method() === 'PUT');
    await screen(page).getByRole('button', { name: 'Save highlights' }).click();
    expect((await conflict).status()).toBe(409);
    await expect(issue(page)).toContainText('Your unsaved input is kept');
    await expect(status(page)).toContainText('Not saved');
    expect(saved().label).toBe('The newer saved words');
    await expect(screen(page).getByRole('textbox', { name: 'Carousel label' })).toHaveValue('My unsaved words');
    await other.close();
  });

  test('resolves real fixture sources on the home page, and hiding, drafts, republication and empty settings leave no stale slides or fallback', async ({ page }) => {
    const content = join(FIXTURE, 'content');
    const read = (name: string) => JSON.parse(readFileSync(join(content, ...name.split('/')), 'utf8'));
    const write = (name: string, value: unknown) => {
      const target = join(content, ...name.split('/'));
      writeFileSync(`${target}.tmp`, `${JSON.stringify(value, null, 2)}\n`);
      renameSync(`${target}.tmp`, target);
    };
    const articleFile = 'articles/fixture-album-note.json';
    const albumFile = 'albums/fixture-album.json';
    const article = { ...read(articleFile), status: 'published', hero: { media: 'articles/fixture-album/p02' } };
    const album = { ...read(albumFile), status: 'published' };
    write(articleFile, article);
    write(albumFile, album);
    const tree = read('structures/site.json');
    const address = (id: string, slug: string) => {
      const section = tree.home.children.find((n: { children?: { item?: { id: string } }[] }) => n.children?.some((p) => p.item?.id === id));
      expect(section, `Fixture ${id} is placed`).toBeTruthy();
      return `/${section.slug}/${slug}/`;
    };
    const articleHref = address(article.id, article.slug);
    const albumHref = address(album.id, album.slug);
    const lead = read('media/articles/fixture-album/p02.json');
    const cover = read('media/articles/fixture-album/p01.json');
    const image = read('media/articles/fixture-album/p03.json');
    const excerpt = 'A few words before the pictures.';
    const mixed: Highlights = { ...base(), label: 'Fixture home highlights', items: [
      { id: 'resolved-github', type: 'custom', custom: 'github' },
      { id: 'resolved-page', type: 'article', article: article.id, text: excerpt },
      { id: 'resolved-album', type: 'album', album: album.id },
      { id: 'resolved-image', type: 'image', media: 'articles/fixture-album/p03' },
    ] };
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/_edit/highlights/');
    const put = async (highlights: Highlights) => {
      const current = await (await page.request.get('/_edit/api/highlights', { headers: { 'X-Editor': '1' } })).json();
      const reply = await page.request.put('/_edit/api/highlights', {
        headers: { 'X-Editor': '1', 'X-Editor-Tab': 'fixture-highlights-resolution', Origin: new URL(page.url()).origin, 'Sec-Fetch-Site': 'same-origin' },
        data: { highlights, ifMatch: { '/content/highlights.json': current.version } },
      });
      expect(reply.status(), JSON.stringify(await reply.json())).toBe(200);
    };
    await put(mixed);
    const eligibility = async (): Promise<Record<string, { reason?: string }>> =>
      (await (await page.request.get('/_edit/api/highlights', { headers: { 'X-Editor': '1' } })).json()).details;
    await expect.poll(async () => {
      const details = await eligibility();
      return [details['resolved-page']?.reason ?? '', details['resolved-album']?.reason ?? ''];
    }).toEqual(['', '']);
    const carousel = () => page.locator('#home-highlights');
    const slides = () => carousel().locator('[data-carousel-slide]');
    const noFallback = async () => expect(page.locator('main img[src*="/poster/landing-"]')).toHaveCount(0);
    const openHome = async (count: number) => {
      await page.goto('/');
      await expect(slides()).toHaveCount(count);
      if (count) await expect(carousel()).toHaveAttribute('data-ready', '');
      else await expect(carousel()).toHaveCount(0);
      await noFallback();
    };
    await openHome(4);
    await expect(slides().first().locator('[data-contributions]')).toHaveAttribute('data-embedded', '');
    await carousel().getByRole('button', { name: 'Show slide 2', exact: true }).click();
    const pageSlide = slides().nth(1);
    await expect(pageSlide.getByRole('heading', { name: article.title, exact: true })).toBeVisible();
    await expect(pageSlide.getByText(excerpt, { exact: true })).toBeVisible();
    await expect(pageSlide.getByRole('link', { name: article.title, exact: true })).toHaveAttribute('href', articleHref);
    await expect(pageSlide.getByRole('img', { name: lead.alt, exact: true })).toBeVisible();
    await expect(pageSlide.getByRole('img', { name: lead.alt, exact: true })).toHaveAttribute('src', /p02/);
    await expect.poll(() => pageSlide.getByRole('img', { name: lead.alt, exact: true }).evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await carousel().getByRole('button', { name: 'Show slide 3', exact: true }).click();
    const albumSlide = slides().nth(2);
    await expect(albumSlide.getByRole('link', { name: album.title, exact: true })).toHaveAttribute('href', albumHref);
    await expect(albumSlide.getByRole('img', { name: cover.alt, exact: true })).toBeVisible();
    await expect(albumSlide.getByRole('img', { name: cover.alt, exact: true })).toHaveAttribute('src', /p01/);
    await expect.poll(() => albumSlide.getByRole('img', { name: cover.alt, exact: true }).evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await carousel().getByRole('button', { name: 'Show slide 4', exact: true }).click();
    const imageSlide = slides().last();
    await expect(imageSlide.getByRole('img', { name: image.alt, exact: true })).toBeVisible();
    await imageSlide.locator('[data-lightbox="home-highlights"]').click();
    await expect(page.locator('dialog[open]')).toHaveCount(1);
    await page.locator('dialog[open]').getByRole('button', { name: 'Close', exact: true }).click();

    await put({ ...mixed, enabled: false });
    await openHome(0);
    await expect(page.locator('[data-contributions]')).toHaveCount(0);
    await put(mixed);
    await openHome(4);
    write(articleFile, { ...article, status: 'draft' });
    write(albumFile, { ...album, status: 'draft' });
    await expect.poll(async () => {
      const details = await eligibility();
      return [details['resolved-page']?.reason ?? '', details['resolved-album']?.reason ?? ''];
    }).toEqual(['Publish it to show it.', 'Publish it to show it.']);
    await openHome(2);
    await expect(carousel().getByRole('heading', { name: article.title, exact: true })).toHaveCount(0);
    await expect(carousel().getByRole('link', { name: album.title, exact: true })).toHaveCount(0);
    expect(saved().items.map((item) => item.id)).toEqual(mixed.items.map((item) => item.id));
    write(articleFile, article);
    write(albumFile, album);
    await expect.poll(async () => {
      const details = await eligibility();
      return [details['resolved-page']?.reason ?? '', details['resolved-album']?.reason ?? ''];
    }).toEqual(['', '']);
    await openHome(4);
    await expect(slides().nth(1).locator('h2')).toHaveText(article.title);
    await expect(slides().nth(2).locator('h2')).toHaveText(album.title);
    await put({ ...mixed, items: [] });
    await openHome(0);
    await expect(page.locator('[data-contributions]')).toHaveCount(0);
    await expect(page.locator('h1')).toHaveCount(1);
  });

  test('has no image preload on the screen path and keeps labelled, accessible controls at phone widths in both themes', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/_edit/highlights/');
    await addSource(page, 'article:fixture-album-note');
    await addSource(page, 'album:fixture-album');
    await expect(screen(page).locator('img')).toHaveCount(0);
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => document.documentElement.dataset.theme = value, theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const results = await new AxeBuilder({ page }).include('[data-editor-highlights]').analyze();
      expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
    }
  });
});
