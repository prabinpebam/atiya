/**
 * Home highlights on the isolated editor fixture, a list beside the chosen one's details
 * (documentation/editor/list-and-details.md): the four trusted kinds, the carousel's settings, stable
 * ordering, two-press removal, waiting sources, refused saves and cross-tab version conflicts. Every action
 * saves on its own. Never writes real content.
 */
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { copyFileSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
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
const list = (page: Page) => screen(page).locator('[data-highlights-list]');
const rows = (page: Page) => list(page).locator('[data-highlight-row]');
const go = (page: Page, id: string) => screen(page).locator(`[data-highlights-go="${id}"]`);
const status = (page: Page) => page.locator('[data-editor-status]');
const issue = (page: Page) => screen(page).locator('[data-editor-form-issue]');
const select = async (page: Page, label: string, option: string) => {
  await screen(page).getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: new RegExp(`^${option.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|\\s)`) }).click();
};
const said = async (page: Page, what: string) => expect(status(page)).toContainText(what, { timeout: 30_000 });
const ids = (page: Page) => rows(page).evaluateAll((elements) => elements.map((e) => (e as HTMLElement).dataset.highlightRow!));
/** Opens Add slide, chooses the fixture source `key` by its tile, sees its preview and adds it (with `excerpt` for a page); the details then show the new slide. */
const addSource = async (page: Page, key: string, excerpt?: string) => {
  const before = await rows(page).count();
  await go(page, 'new').click();
  await expect(screen(page).locator('[data-slide-sources]')).toBeVisible();
  await screen(page).locator(`[data-highlight-source="${key}"]`).click();
  await expect(screen(page).locator(`[data-highlight-preview="${key}"]`)).toBeVisible();
  await expect(screen(page).locator('[data-highlights-back]')).toBeFocused();
  if (excerpt !== undefined) await screen(page).getByRole('textbox', { name: 'Page excerpt' }).fill(excerpt);
  await screen(page).locator('[data-highlights-new]').getByRole('button', { name: 'Add slide', exact: true }).click();
  await said(page, 'Added slide');
  await expect(rows(page)).toHaveCount(before + 1);
  await expect(screen(page).locator('[data-highlights-slide]')).toBeVisible();
};
/** Chooses a slide (or `settings`, `new`) in the list. */
const choose = async (page: Page, id: string) => {
  await go(page, id).click();
  await expect(page).toHaveURL(new RegExp(`[?&]slide=${id}`));
  await expect(go(page, id)).toHaveAttribute('aria-current', 'true');
};
const removeChosen = async (page: Page) => {
  const remove = screen(page).locator('[data-highlight-remove]');
  await remove.click();
  await expect(remove).toHaveText(/Remove for good/);
  await remove.click();
  await said(page, 'Removed slide');
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

  test('chooses independent slide pictures and presentation on add and edit, and restores automatic body pictures without changing the page', async ({ page }) => {
    const articleFile = join(FIXTURE, 'content', 'articles', 'fixture-album-note.json');
    const original = JSON.parse(readFileSync(articleFile, 'utf8'));
    const article = { ...original, status: 'published', hero: undefined, body: [
      ...original.body, { type: 'figure', media: 'articles/fixture-album/p01', width: 'content' },
    ] };
    writeFileSync(`${articleFile}.tmp`, JSON.stringify(article));
    renameSync(`${articleFile}.tmp`, articleFile);
    const sourceBytes = readFileSync(articleFile, 'utf8');
    const chosenMedia = 'articles/fixture-album/p02';
    const chosenAlt = JSON.parse(readFileSync(join(FIXTURE, 'content', 'media', 'articles', 'fixture-album', 'p02.json'), 'utf8')).alt;
    const autoAlt = JSON.parse(readFileSync(join(FIXTURE, 'content', 'media', 'articles', 'fixture-album', 'p01.json'), 'utf8')).alt;
    await page.goto('/_edit/highlights/?slide=new&source=article%3Afixture-album-note');
    const picture = () => screen(page).locator('[data-slide-picture]');
    await expect(picture()).toContainText('Automatic picture');
    // the look is always shown, following the carousel until one is changed
    await expect(picture()).toContainText('Following the carousel settings');
    await expect(picture().getByRole('combobox', { name: 'Picture display', exact: true })).toBeVisible();
    await expect(picture().getByRole('button', { name: 'Use carousel settings', exact: true })).toBeDisabled();
    await expect(picture().locator('[data-slide-picture-colour]')).toBeHidden();
    await picture().getByRole('button', { name: 'Choose picture', exact: true }).click();
    const picker = page.getByRole('dialog', { name: 'Choose a slide picture' });
    await expect(picker).toBeVisible();
    await picker.locator(`[data-editor-media="${chosenMedia}"]`).click();
    await expect(picker).not.toBeVisible();
    await expect(picture().locator('input[name="picture"]')).toHaveValue(chosenMedia);
    const livePreview = () => screen(page).locator('[data-region="highlight-preview"]');
    await expect(livePreview().getByRole('img', { name: chosenAlt, exact: true })).toHaveCount(1);
    await expect(livePreview()).toContainText('A picture chosen for this slide');
    await select(page, 'Picture display', 'Stretch');
    await expect(picture()).toContainText('This slide has its own picture settings.');
    await expect(picture().getByRole('button', { name: 'Use carousel settings', exact: true })).toBeEnabled();
    await picture().getByRole('checkbox', { name: 'Round picture corners' }).uncheck();
    await select(page, 'Picture background', 'Colour');
    await expect(picture().locator('[data-slide-picture-colour]')).toBeVisible();
    await picture().getByLabel('Background colour').fill('#204060');
    await picture().getByRole('checkbox', { name: 'Show picture shadow' }).check();
    for (const shown of [livePreview(), picture().locator('[data-region="slide-picture"]')]) {
      await expect(shown.locator('img')).toHaveAttribute('data-fit', 'stretch');
      await expect(shown.locator('img')).toHaveAttribute('data-radius', 'none');
      await expect(shown.locator('img')).toHaveAttribute('style', /--picture-bg: #204060/);
      await expect(shown.locator('img')).toHaveAttribute('data-shadow', '');
    }
    await screen(page).locator('[data-highlights-new]').getByRole('button', { name: 'Add slide', exact: true }).click();
    await said(page, 'Added slide');
    expect(saved().items[0]).toMatchObject({ type: 'article', picture: chosenMedia, pictureStyle: { display: 'stretch', background: '#204060', rounded: false, shadow: true } });
    expect(readFileSync(articleFile, 'utf8')).toBe(sourceBytes);
    const id = saved().items[0].id;
    await page.reload();
    await expect(picture().locator('input[name="picture"]')).toHaveValue(chosenMedia);
    await expect(picture().getByRole('checkbox', { name: 'Round picture corners' })).not.toBeChecked();
    await expect(picture().getByLabel('Background colour')).toHaveValue('#204060');
    await page.goto('/views/classic/');
    const image = page.locator('#home-highlights [data-highlight-card]').getByRole('img', { name: chosenAlt, exact: true });
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute('data-fit', 'stretch');
    await expect(image).toHaveAttribute('data-radius', 'none');
    await expect(image).toHaveAttribute('style', /--picture-bg: #204060/);
    await expect(image).toHaveAttribute('data-shadow', '');
    await page.goto(`/_edit/highlights/?slide=${id}`);
    await picture().getByRole('button', { name: 'Use automatic', exact: true }).click();
    // a saved slide's picture preview follows its unsaved look too
    await select(page, 'Picture display', 'Fit');
    await expect(picture().locator('[data-region="slide-picture"] img[data-mode="fit"]')).toHaveCount(1);
    await picture().getByRole('button', { name: 'Use carousel settings', exact: true }).click();
    await expect(picture()).toContainText('Following the carousel settings');
    await expect(picture().getByRole('button', { name: 'Use carousel settings', exact: true })).toBeDisabled();
    await expect(picture().getByRole('combobox', { name: 'Picture display', exact: true })).toContainText('Fill');
    await expect(picture().locator('[data-slide-picture-colour]')).toBeHidden();
    await screen(page).getByRole('button', { name: 'Save slide', exact: true }).click();
    await said(page, 'Saved slide');
    expect(saved().items[0]).not.toHaveProperty('picture');
    expect(saved().items[0]).not.toHaveProperty('pictureStyle');
    expect(readFileSync(articleFile, 'utf8')).toBe(sourceBytes);
    await page.goto('/views/classic/');
    await expect(page.locator('#home-highlights [data-highlight-card]').getByRole('img', { name: autoAlt, exact: true })).toBeVisible();

    // More than a page of shared pictures sorts ahead of the upload: selection must wait for its card.
    const shared = join(FIXTURE, 'content', 'media', 'shared');
    mkdirSync(shared, { recursive: true });
    for (let n = 0; n < 41; n++) {
      const name = `a-highlight-${String(n).padStart(2, '0')}`;
      copyFileSync(join(FIXTURE, 'content', 'media', 'articles', 'fixture-album', 'p01.webp'), join(shared, `${name}.webp`));
      writeFileSync(join(shared, `${name}.json`), JSON.stringify({ kind: 'image', file: `${name}.webp`, alt: `Fixture image ${n}`, visibility: 'public' }));
    }
    await page.goto(`/_edit/highlights/?slide=${id}`);
    await picture().getByRole('button', { name: 'Choose picture', exact: true }).click();
    await expect(picker).toBeVisible();
    await picker.getByText('Upload a picture or a video', { exact: true }).click();
    await picker.getByLabel('Picture or video', { exact: true }).setInputFiles({
      name: 'highlight-upload.svg', mimeType: 'image/svg+xml',
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="360" height="180"><rect width="360" height="180" fill="#4361a5"/><circle cx="90" cy="90" r="55" fill="#efc556"/></svg>'),
    });
    await picker.getByRole('textbox', { name: 'Alt text', exact: true }).fill('A gold circle on a blue field');
    await picker.getByRole('button', { name: 'Upload it', exact: true }).click();
    await expect(picker).not.toBeVisible({ timeout: 30_000 });
    await expect(picture().locator('input[name="picture"]')).not.toHaveValue('');
    await screen(page).getByRole('button', { name: 'Save slide', exact: true }).click();
    await said(page, 'Saved slide');
    expect(saved().items[0]).toMatchObject({ picture: expect.stringMatching(/^shared\//) });
    expect(readFileSync(articleFile, 'utf8')).toBe(sourceBytes);
    await page.goto('/views/classic/');
    await expect(page.locator('#home-highlights [data-highlight-card]').getByRole('img', { name: 'A gold circle on a blue field', exact: true })).toBeVisible();
  });

  test('is list and details: adds every kind, saves verbatim text and settings, orders and removes without deleting sources', async ({ page }) => {
    await page.goto('/_edit/highlights/');
    await expect(page.getByRole('heading', { level: 1, name: 'Home highlights' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Edit mode' }).getByRole('link', { name: /Home highlights/ })).toHaveCount(1);
    // empty: the list says so, and the details offer the sources
    await expect(list(page)).toContainText('No slides yet');
    await expect(screen(page).locator('[data-slide-sources]')).toBeVisible();
    await expect(go(page, 'settings')).toContainText('Shown · 0 slides · dots');

    await addSource(page, 'custom:github');
    // a page's excerpt is set in its preview, as it's added
    await addSource(page, 'article:fixture-album-note', 'A few words before the pictures.');
    await expect(rows(page).nth(1)).toContainText('Waiting: Choose a slide picture');
    await expect(screen(page).getByRole('textbox', { name: 'Page excerpt' })).toHaveValue('A few words before the pictures.');
    await addSource(page, 'album:fixture-album');
    await addSource(page, 'image:articles/fixture-album/p02');
    const added = await ids(page);
    expect(new Set(added).size).toBe(4);
    // the list's count, and what each slide says it is
    await expect(list(page)).toContainText('4 of');
    await expect(rows(page).first()).toContainText('GitHub');

    // ordering in the chosen one's details: the ends are disabled, the focus stays on the move
    await choose(page, added[0]);
    await expect(screen(page).getByRole('button', { name: 'Move up', exact: true })).toBeDisabled();
    await choose(page, added[3]);
    await expect(screen(page).getByRole('button', { name: 'Move down', exact: true })).toBeDisabled();
    await screen(page).getByRole('button', { name: 'Move up', exact: true }).click();
    await said(page, 'Moved slide to place 3');
    await expect(screen(page).getByRole('button', { name: 'Move up', exact: true })).toBeFocused();
    await screen(page).getByRole('button', { name: 'Move up', exact: true }).click();
    await said(page, 'Moved slide to place 2');
    expect(await ids(page)).toEqual([added[0], added[3], added[1], added[2]]);

    // the carousel's settings are the list's first row
    await choose(page, 'settings');
    await screen(page).getByRole('textbox', { name: 'Carousel label' }).fill('From the fixture');
    await screen(page).getByRole('switch', { name: 'Show home highlights' }).uncheck();
    await screen(page).getByRole('checkbox', { name: 'Peek at neighbours' }).check();
    await screen(page).getByRole('checkbox', { name: 'Show arrow buttons' }).uncheck();
    await screen(page).getByRole('checkbox', { name: 'Use automatic background' }).check();
    await screen(page).getByRole('checkbox', { name: 'Round picture corners' }).uncheck();
    await screen(page).getByRole('checkbox', { name: 'Show picture shadow' }).check();
    await select(page, 'Pager', 'Wrapping filmstrip');
    await select(page, 'Picture display', 'Tile');
    await screen(page).getByRole('button', { name: 'Save carousel settings', exact: true }).click();
    await said(page, 'Saved carousel settings');
    expect(saved()).toMatchObject({
      label: 'From the fixture', enabled: false, peek: true, arrows: false, pager: 'filmstrip-wrap',
      display: 'tile', background: true, rounded: false, shadow: true,
    });
    expect(saved().items.map((i) => i.id)).toEqual([added[0], added[3], added[1], added[2]]);
    expect(saved().items[2]).toMatchObject({ type: 'article', text: 'A few words before the pictures.' });
    await expect(go(page, 'settings')).toContainText('Hidden · 4 slides · wrapping filmstrip');

    // reopened by its address
    await page.goto(`/_edit/highlights/?slide=${added[1]}`);
    await expect(screen(page).getByRole('textbox', { name: 'Page excerpt' })).toHaveValue('A few words before the pictures.');
    await page.goto('/_edit/highlights/?slide=settings');
    await expect(screen(page).getByRole('textbox', { name: 'Carousel label' })).toHaveValue('From the fixture');
    await expect(screen(page).getByRole('combobox', { name: 'Pager', exact: true })).toContainText('Wrapping filmstrip');

    // removing takes two presses, chooses the slide that took its place, and never deletes the source
    await choose(page, added[2]);
    await removeChosen(page);
    expect(saved().items.map((i) => i.id)).toEqual([added[0], added[3], added[1]]);
    await expect(go(page, added[1])).toHaveAttribute('aria-current', 'true');
    expect(JSON.parse(readFileSync(join(FIXTURE, 'content', 'albums', 'fixture-album.json'), 'utf8')).id).toBe('fixture-album');
  });

  test("shows an album slide by its arranged cover, on add and edit, and switches back to one picture (§2.3, HC12)", async ({ page }) => {
    const album = JSON.parse(readFileSync(join(FIXTURE, 'content', 'albums', 'fixture-album.json'), 'utf8'));
    writeFileSync(join(FIXTURE, 'content', 'albums', 'fixture-album.json.tmp'), `${JSON.stringify({ ...album, status: 'published' }, null, 2)}\n`);
    renameSync(join(FIXTURE, 'content', 'albums', 'fixture-album.json.tmp'), join(FIXTURE, 'content', 'albums', 'fixture-album.json'));
    await page.goto('/_edit/highlights/?slide=new&kind=album&source=album%3Afixture-album');
    const preview = screen(page).locator('[data-highlight-preview="album:fixture-album"]');
    await expect(preview).toBeVisible();
    const show = preview.getByRole('radiogroup', { name: 'Show' }).or(preview.getByRole('group', { name: 'Show' }));
    await expect(show.getByRole('radio', { name: /^One picture/ })).toBeChecked();
    await expect(preview.locator('[data-highlight-cover]')).toHaveCount(0);
    await show.getByText('Album cover', { exact: true }).click();
    await expect(preview.locator('.stage [data-highlight-cover] li').first()).toBeVisible();
    await expect(preview.locator('[data-slide-picture-one]')).toBeHidden();
    await expect(preview.getByRole('link', { name: 'Arrange album cover' })).toHaveAttribute('href', /\/_edit\/albums\/fixture-album\/$/);
    await screen(page).locator('[data-highlights-new]').getByRole('button', { name: 'Add slide', exact: true }).click();
    await said(page, 'Added slide');
    const item = saved().items[0]!;
    expect(item).toMatchObject({ type: 'album', album: 'fixture-album', show: 'cover' });
    expect(item).not.toHaveProperty('picture');
    expect(item).not.toHaveProperty('pictureStyle');

    // the saved slide: its cover in the part, one picture back, and the cover again on reload
    const part = screen(page).locator('[data-slide-picture]');
    await expect(part.locator('[data-highlight-cover] li').first()).toBeVisible();
    await expect(part.getByRole('radio', { name: /^Album cover/ })).toBeChecked();
    await part.getByText('One picture', { exact: true }).click();
    await expect(part.locator('[data-slide-picture-cover]')).toBeHidden();
    await expect(part.getByRole('button', { name: 'Choose picture' })).toBeVisible();
    await screen(page).getByRole('button', { name: 'Save slide', exact: true }).click();
    await said(page, 'Saved slide');
    expect(saved().items[0]).not.toHaveProperty('show');
    await part.getByText('Album cover', { exact: true }).click();
    await screen(page).getByRole('button', { name: 'Save slide', exact: true }).click();
    await said(page, 'Saved slide');
    expect(saved().items[0]).toMatchObject({ show: 'cover' });
    await page.reload();
    await expect(screen(page).locator('[data-slide-picture] [data-highlight-cover] li').first()).toBeVisible();

    // the home draws the same cover, its tiles named, none a link but the title
    await page.goto('/');
    const slide = page.locator('#home-highlights [data-carousel-slide]').first();
    await expect(slide.locator('[data-highlight-cover] li').first()).toBeVisible();
    await expect(slide.getByRole('link', { name: album.title, exact: true })).toBeVisible();
    await expect(slide.locator('[data-highlight-cover] a')).toHaveCount(0);
    await expect.poll(() => slide.locator('[data-highlight-cover] img').first().evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  });

  test('refuses an invented excerpt with failed-save feedback, keeps the input, and saves intentional empty highlights', async ({ page }) => {
    await page.goto('/_edit/highlights/');
    // refused as it's added: the preview stays, with what was typed
    await screen(page).locator('[data-highlight-source="article:fixture-album-note"]').click();
    const excerpt = () => screen(page).getByRole('textbox', { name: 'Page excerpt' });
    await excerpt().fill('These invented words do not belong to the page.');
    const refusedAdd = page.waitForResponse((r) => r.url().includes('/_edit/api/highlights') && r.request().method() === 'PUT');
    await screen(page).getByRole('button', { name: 'Add slide', exact: true }).click();
    expect((await refusedAdd).status()).toBe(422);
    await expect(issue(page)).toContainText('word for word');
    await expect(screen(page).locator('[data-highlight-preview="article:fixture-album-note"]')).toBeVisible();
    await expect(excerpt()).toHaveValue('These invented words do not belong to the page.');
    await expect(rows(page)).toHaveCount(0);
    await excerpt().fill('');
    await screen(page).getByRole('button', { name: 'Add slide', exact: true }).click();
    await said(page, 'Added slide');
    // refused on the slide itself
    await excerpt().fill('These invented words do not belong to the page.');
    const refused = page.waitForResponse((r) => r.url().includes('/_edit/api/highlights') && r.request().method() === 'PUT');
    await screen(page).getByRole('button', { name: 'Save slide' }).click();
    expect((await refused).status()).toBe(422);
    await expect(issue(page)).toContainText('word for word');
    await expect(status(page)).toContainText('Not saved');
    await expect(excerpt()).toHaveValue('These invented words do not belong to the page.');
    expect(saved().items[0]).not.toHaveProperty('text', 'These invented words do not belong to the page.');
    await excerpt().fill('A few words before the pictures.');
    await screen(page).getByRole('button', { name: 'Save slide' }).click();
    await said(page, 'Saved slide');
    await removeChosen(page);
    await expect(rows(page)).toHaveCount(0);
    await expect(screen(page).locator('[data-slide-sources]')).toBeVisible();
    await page.reload();
    await expect(rows(page)).toHaveCount(0);
    await expect(list(page)).toContainText('No slides yet');
    expect(saved()).toMatchObject({ enabled: true, items: [] });
  });

  test('preserves dirty input on cross-tab updates and a 409, while clean screens follow changes', async ({ page, context }) => {
    await page.goto('/_edit/highlights/?slide=settings');
    const other = await context.newPage();
    await other.goto('/_edit/highlights/?slide=settings');
    const label = (p: Page) => screen(p).getByRole('textbox', { name: 'Carousel label' });
    const saveSettings = async (p: Page) => {
      await screen(p).getByRole('button', { name: 'Save carousel settings' }).click();
      await said(p, 'Saved carousel settings');
    };
    await label(other).fill('A shared change');
    await saveSettings(other);
    await expect(label(page)).toHaveValue('A shared change', { timeout: 30_000 });
    await label(page).fill('My unsaved words');
    await label(other).fill('The newer saved words');
    await saveSettings(other);
    // a change made elsewhere never draws over what's typed here
    await page.waitForTimeout(1500);
    await expect(label(page)).toHaveValue('My unsaved words');
    const conflict = page.waitForResponse((r) => r.url().includes('/_edit/api/highlights') && r.request().method() === 'PUT');
    await screen(page).getByRole('button', { name: 'Save carousel settings' }).click();
    expect((await conflict).status()).toBe(409);
    await expect(issue(page)).toContainText('What you typed is kept');
    await expect(status(page)).toContainText('Not saved');
    expect(saved().label).toBe('The newer saved words');
    await expect(label(page)).toHaveValue('My unsaved words');
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

  test('adds by seeing: kinds, search, a preview of each kind, waiting and fixes, a source already a slide, back and reload', async ({ page }) => {
    // the step's first draw has no picture: they come as their own region after it shows
    const html = await (await page.request.get('/_edit/highlights/?slide=new')).text();
    const region = html.slice(html.indexOf('data-region="highlight-sources"'));
    expect(region.slice(0, region.indexOf('</ul>'))).not.toContain('<img');
    await page.goto('/_edit/highlights/?slide=new');
    const sources = screen(page).locator('[data-slide-sources]');
    await expect.poll(() => sources.locator('[data-region="highlight-sources"]').getAttribute('data-sources-pending')).toBeNull();
    await expect(sources.locator('img').first()).toBeVisible();

    // a kind narrows the tiles, says what it shows and is kept in the address
    await sources.locator('[data-source-kind="album"]').click();
    await expect(sources.locator('[data-source-kind="album"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(sources.locator('[data-source-kind-line]')).toContainText("An album's cover");
    await expect(page).toHaveURL(/[?&]kind=album/);
    const shownKinds = () => sources.locator('[data-source-tile]:not([hidden])').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.kind));
    expect(new Set(await shownKinds())).toEqual(new Set(['album']));
    // a search narrows by name, and says when nothing matches
    const search = sources.getByRole('searchbox', { name: 'Find a source' });
    await search.fill('no such source anywhere');
    await expect(sources.locator('[data-source-count]')).toContainText('No album matches');
    const name = await sources.locator('[data-source-tile="album:fixture-album"]').getAttribute('data-name');
    const word = name!.split(/\s+/)[0];
    await search.fill(word);
    await expect(sources.locator('[data-source-tile="album:fixture-album"]')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`[?&]q=${encodeURIComponent(word)}`));

    // the album's preview, then Back to the same kind, search and tile
    await sources.locator('[data-highlight-source="album:fixture-album"]').click();
    const preview = screen(page).locator('[data-highlight-preview="album:fixture-album"]');
    await expect(preview).toBeVisible();
    await expect(preview.locator('.facts')).toContainText('Album');
    await expect(preview.locator('.stage img')).toBeVisible();
    await screen(page).locator('[data-highlights-back]').click();
    await expect(sources.locator('[data-highlight-source="album:fixture-album"]')).toBeFocused();
    // the pictures arriving keep the focus on that tile
    await expect.poll(() => sources.locator('[data-region="highlight-sources"]').getAttribute('data-sources-pending')).toBeNull();
    await expect(sources.locator('[data-highlight-source="album:fixture-album"]')).toBeFocused();
    // a tile is a link to its preview, named by its name, its status line describing it
    const tile = sources.getByRole('link', { name: name!, exact: true });
    await expect(tile).toHaveAttribute('href', /[?&]source=album%3Afixture-album/);
    await expect(tile).toHaveAccessibleDescription(/Album · /);
    await expect(page).toHaveURL(/[?&]kind=album/);
    await expect(sources.getByRole('searchbox', { name: 'Find a source' })).toHaveValue(word);
    // the browser's back moves between the steps too (Back to sources is a link, so it's an entry of its own)
    await page.goBack();
    await expect(preview).toBeVisible();
    await page.goBack();
    await expect(sources.locator('[data-source-tile="album:fixture-album"]')).toBeVisible();
    await expect(page).toHaveURL(/[?&]kind=album/);

    // a waiting page says what it needs and links to fix it
    await page.goto('/_edit/highlights/?slide=new&source=article:fixture-album-note');
    const page1 = screen(page).locator('[data-highlight-preview="article:fixture-album-note"]');
    await expect(page1.locator('.facts')).toContainText('Waiting');
    await expect(page1.locator('[data-source-waiting]')).toContainText('Choose a slide picture');
    await expect(page1.getByRole('link', { name: 'Edit page' })).toHaveAttribute('href', /\/_edit\/articles\/fixture-album-note\//);
    // a picture and the chart, each as the home would show it
    await page.goto('/_edit/highlights/?slide=new&source=image:articles/fixture-album/p02');
    await expect(screen(page).locator('[data-highlight-preview="image:articles/fixture-album/p02"] .stage img')).toBeVisible();
    await page.goto('/_edit/highlights/?slide=new&source=custom:github');
    const chart = screen(page).locator('[data-highlight-preview="custom:github"]');
    await expect(chart.locator('.facts')).toContainText('Chart');
    await expect(chart.locator('.stage [data-contributions]')).toHaveCount(1);
    await chart.getByRole('button', { name: 'Add slide', exact: true }).click();
    await said(page, 'Added slide');
    const [github] = await ids(page);

    // a source already a slide goes to that slide
    await go(page, 'new').click();
    await screen(page).locator(`[data-source-tile="custom:github"] [data-highlights-go="${github}"]`).click();
    await expect(page).toHaveURL(new RegExp(`[?&]slide=${github}`));
    await expect(screen(page).locator('[data-slide-sources]')).toHaveCount(0);
    await expect(go(page, github)).toHaveAttribute('aria-current', 'true');
  });

  test('prepares only the selected slide picture, and keeps labelled, accessible controls at phone widths in both themes on every step', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/_edit/highlights/');
    await addSource(page, 'article:fixture-album-note');
    await addSource(page, 'album:fixture-album');
    await expect(screen(page).locator('[data-slide-picture-preview] img')).toHaveCount(1);
    await expect(list(page).locator('img')).toHaveCount(0);
    const checkBothThemes = async () => {
      for (const theme of ['light', 'dark']) {
        await page.evaluate((value) => document.documentElement.dataset.theme = value, theme);
        // the theme's colour transitions settle before contrast is measured
        await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const results = await new AxeBuilder({ page }).include('[data-editor-highlights]').analyze();
        expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
      }
    };
    await checkBothThemes();
    // the sources, once their pictures are in, and a preview
    await page.goto('/_edit/highlights/?slide=new');
    await expect.poll(() => screen(page).locator('[data-region="highlight-sources"]').getAttribute('data-sources-pending')).toBeNull();
    await checkBothThemes();
    await page.goto('/_edit/highlights/?slide=new&source=image:articles/fixture-album/p02');
    await expect(screen(page).locator('[data-highlight-preview]')).toBeVisible();
    await checkBothThemes();
  });
});
