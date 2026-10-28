/**
 * Suggested alt text (documentation/gallery/spec.md §9.6; plan G10, DoD row 29): when the writer chosen on the AI
 * screen sees pictures, a new picture's alt text is suggested, shown in the field's muted style and marked
 * Suggested, with Accept and Edit; until one is pressed nothing is saved and the field doesn't count as alt text.
 * A picture already uploaded gets Suggest in its details. The AI screen's Pictures row holds the switch, and its
 * Test finds whether the model sees pictures. Against the tests' stand-in AI service (scripts/lib/ai-stand-in.mjs),
 * never a real model: it answers every picture with STAND_IN_ALT, and its `blind` model refuses pictures.
 *
 *   node scripts/test-run.mjs --by agent --purpose "suggested alt text" -- --project=editor tests/e2e/editor-alt-text.spec.ts
 */
import { expect, test, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { FIXTURE, reset } from '../../scripts/editor-test-server.mjs';
import { STAND_IN_ALT, STAND_IN_CAPTION, STAND_IN_DESCRIPTION } from '../../scripts/lib/ai-stand-in.mjs';

const ARTICLE = 'do-what-makes-you-proud';
const readJson = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const upload = (page: Page) => page.locator('[data-editor-upload]');
const details = (page: Page) => page.locator('[data-editor-media-details]');
const offer = (scope: ReturnType<Page['locator']>) => scope.locator('[data-alt-kind="alt"] [data-alt-offer]');
const altField = (scope: ReturnType<Page['locator']>) => scope.locator('textarea[name="alt"]');

type AiFile = { services: { model: string; privatePages: boolean; pictures?: boolean }[]; writer: string | null; alt?: { suggest: boolean } };
/** Changes the fixture's AI settings in place (each reset writes them again, without `pictures`). */
function setAi(change: (s: AiFile) => void) {
  const file = join(FIXTURE, '.atiya', 'ai.json');
  const s = JSON.parse(readFileSync(file, 'utf8'));
  change(s);
  writeFileSync(file, JSON.stringify(s));
}
const aiFile = (): AiFile => readJson(join(FIXTURE, '.atiya', 'ai.json'));
/** The stand-in writer, its model tested and seeing pictures. */
const seesPictures = () => setAi((s) => (s.services[0].pictures = true));

const picture = () => sharp({ create: { width: 1800, height: 1200, channels: 3, background: { r: 30, g: 120, b: 200 } } }).jpeg().toBuffer();

/** The media screen with its upload form open, and a picture chosen under a name that mustn't leave the page. */
async function chooseToUpload(page: Page, name = 'Secret Street Number 12.jpg') {
  await page.goto('/_edit/media/?view=list');
  await page.getByText('Upload a picture or a video').click();
  await expect(upload(page).locator('input[type="file"]')).toBeAttached();
  const sent = page.waitForRequest((r) => r.method() === 'POST' && /\/_edit\/api\/ai\/alt$/.test(r.url()));
  await upload(page).locator('input[type="file"]').setInputFiles({ name, mimeType: 'image/jpeg', buffer: await picture() });
  return sent;
}

test.describe('editor: suggested alt text', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120_000);
  test.beforeEach(() => reset());
  test.afterAll(() => reset());

  test('a new picture: the suggestion is shown, never saved until accepted, and Accept fills the field', async ({ page }) => {
    seesPictures();
    const sent = await chooseToUpload(page);
    // only the bytes go, under a made-up name
    const body = (await sent).postDataBuffer()?.toString('latin1') ?? '';
    expect(body).not.toMatch(/Secret|Street|Number/);

    const form = upload(page);
    await expect(offer(form)).toBeVisible({ timeout: 30_000 });
    await expect(offer(form)).toContainText('Suggested');
    await expect(altField(form)).toHaveAttribute('placeholder', STAND_IN_ALT);
    await expect(altField(form)).toHaveValue('');
    await expect(form.locator('[data-alt-said]')).toHaveText(`Suggested alt text: ${STAND_IN_ALT}`);

    // unaccepted, it isn't alt text: the upload asks for some
    await form.getByRole('button', { name: 'Upload it' }).click();
    await expect(form.locator('[data-editor-form-issue]')).toContainText('alt text');
    await expect(page).not.toHaveURL(/[?&]id=shared\//);

    await form.getByRole('button', { name: 'Accept' }).click();
    await expect(altField(form)).toHaveValue(STAND_IN_ALT);
    await expect(offer(form)).toBeHidden();
    await form.getByRole('button', { name: 'Upload it' }).click();
    await expect(page).toHaveURL(/[?&]id=shared\/secret-street-number-12$/, { timeout: 30_000 });
    expect(readJson(join(FIXTURE, 'content/media/shared/secret-street-number-12.json')).alt).toBe(STAND_IN_ALT);
  });

  test('Edit puts the suggestion in the field to change; typing first puts the suggestion away', async ({ page }) => {
    seesPictures();
    await chooseToUpload(page);
    const form = upload(page);
    await expect(offer(form)).toBeVisible({ timeout: 30_000 });
    await form.getByRole('button', { name: 'Edit' }).click();
    await expect(altField(form)).toHaveValue(STAND_IN_ALT);
    await expect(altField(form)).toBeFocused();

    // a new picture, typed into before Accept: the owner's words win and the suggestion goes
    await chooseToUpload(page, 'Another.jpg');
    await expect(offer(form)).toBeVisible({ timeout: 30_000 });
    await altField(form).fill('A blue sky');
    await expect(offer(form)).toBeHidden();
    await expect(altField(form)).toHaveValue('A blue sky');
  });

  test("a picture already uploaded: Suggest in its details, once its alt text is emptied, and Accept saves with the details", async ({ page }) => {
    seesPictures();
    await page.goto(`/_edit/media/?view=list&id=articles/${ARTICLE}/tshirt`);
    const pane = details(page);
    const ask = pane.locator('[data-alt-kind="alt"] [data-alt-ask]');
    await expect(altField(pane)).toBeVisible();
    await altField(pane).fill('');
    await expect(ask).toBeVisible({ timeout: 30_000 });
    await ask.click();
    await expect(offer(pane)).toBeVisible({ timeout: 30_000 });
    await expect(altField(pane)).toHaveValue('');
    await pane.getByRole('button', { name: 'Accept' }).click();
    await expect(altField(pane)).toHaveValue(STAND_IN_ALT);
    await pane.getByRole('button', { name: 'Save the details' }).first().click();
    await expect(page.locator('[data-editor-status]')).toContainText(/Saved/i, { timeout: 30_000 });
    expect(readJson(join(FIXTURE, `content/media/articles/${ARTICLE}/tshirt.json`)).alt).toBe(STAND_IN_ALT);
  });

  test('a caption (§9.8.1): Suggest caption only on asking and only while it is empty; Edit fills and focuses it; saved with the details', async ({ page }) => {
    seesPictures();
    let asked = 0;
    page.on('request', (r) => r.method() === 'POST' && /\/_edit\/api\/ai\/caption$/.test(r.url()) && asked++);
    await page.goto(`/_edit/media/?view=list&id=articles/${ARTICLE}/tshirt`);
    const pane = details(page);
    const box = pane.locator('[data-alt-kind="caption"]');
    const caption = pane.locator('textarea[name="caption"]');
    const ask = box.getByRole('button', { name: 'Suggest caption' });
    // beside a caption already written there's nothing to suggest, and nothing is asked for on its own
    await expect(caption).toHaveValue('The team T-shirt, at work.');
    await expect(ask).toBeHidden();
    await caption.fill('');
    await expect(ask).toBeVisible({ timeout: 30_000 });
    expect(asked).toBe(0);
    await ask.click();
    await expect(box.locator('[data-alt-offer]')).toBeVisible({ timeout: 30_000 });
    await expect(caption).toHaveAttribute('placeholder', STAND_IN_CAPTION);
    await expect(caption).toHaveValue('');
    await expect(box.locator('[data-alt-said]')).toHaveText(`Suggested caption: ${STAND_IN_CAPTION}`);
    // the alt text's suggestion is untouched
    await expect(offer(pane)).toBeHidden();
    await box.getByRole('button', { name: 'Edit' }).click();
    await expect(caption).toHaveValue(STAND_IN_CAPTION);
    await expect(caption).toBeFocused();
    await pane.getByRole('button', { name: 'Save the details' }).first().click();
    await expect(page.locator('[data-editor-status]')).toContainText(/Saved/i, { timeout: 30_000 });
    expect(readJson(join(FIXTURE, `content/media/articles/${ARTICLE}/tshirt.json`)).caption).toBe(STAND_IN_CAPTION);
  });

  test('turned off on the AI screen, nothing is suggested and no picture is sent', async ({ page }) => {
    seesPictures();
    await page.goto('/_edit/ai/');
    const row = page.locator('[data-ai-pictures]');
    await expect(row).toHaveAttribute('data-ai-pictures', 'yes');
    const sw = row.getByRole('switch', { name: 'Suggest alt text for new pictures' });
    await expect(sw).toBeChecked();
    await sw.uncheck();
    await expect.poll(() => aiFile().alt).toEqual({ suggest: false });

    let posted = false;
    page.on('request', (r) => {
      if (r.method() === 'POST' && /\/_edit\/api\/ai\/alt$/.test(r.url())) posted = true;
    });
    await page.goto('/_edit/media/?view=list');
    await page.getByText('Upload a picture or a video').click();
    const asked = page.waitForResponse((r) => /\/_edit\/api\/ai\/alt\?/.test(r.url()));
    await upload(page).locator('input[type="file"]').setInputFiles({ name: 'Off.jpg', mimeType: 'image/jpeg', buffer: await picture() });
    expect(await (await asked).json()).toEqual({ ok: true, on: false, why: 'off' });
    await expect(offer(upload(page))).toBeHidden();
    expect(posted).toBe(false);
  });

  test("the Pictures row: untested until Test, then whether the model sees pictures; a blind one offers no switch", async ({ page }) => {
    await page.goto('/_edit/ai/');
    const row = page.locator('[data-ai-pictures]');
    await expect(row).toHaveAttribute('data-ai-pictures', 'untested');
    await expect(row).toContainText('Test the writer');
    const card = page.locator('[data-ai-card="ollama"]');
    await card.getByRole('button', { name: 'Test' }).click();
    await expect(row).toHaveAttribute('data-ai-pictures', 'yes', { timeout: 30_000 });
    await expect(row.getByRole('switch', { name: 'Suggest alt text for new pictures' })).toBeVisible();
    expect(aiFile().services[0].pictures).toBe(true);

    setAi((s) => {
      s.services[0].model = 'blind';
      delete s.services[0].pictures;
    });
    await page.reload();
    await page.locator('[data-ai-card="ollama"]').getByRole('button', { name: 'Test' }).click();
    await expect(row).toHaveAttribute('data-ai-pictures', 'no', { timeout: 30_000 });
    await expect(row).toContainText("This model can't see pictures.");
    await expect(row.getByRole('switch')).toHaveCount(0);
    expect(aiFile().services[0].pictures).toBe(false);
  });
});

const albumSidecar = (id: string) => readJson(join(FIXTURE, 'content', 'media', 'articles', 'fixture-album', `${id}.json`)) as { description?: string; caption?: string; place?: string; alt?: string };

test.describe('editor: suggested words (§9.8.2)', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120_000);
  test.beforeEach(() => reset());
  test.afterAll(() => reset());

  test('one picture: Suggest description beside its empty field in the inspector; Accept saves it as its own words', async ({ page }) => {
    seesPictures();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/_edit/albums/fixture-album/?selected=p01');
    const box = page.locator('[data-album-selection="one"] [data-alt-kind="description"]');
    const ask = box.getByRole('button', { name: 'Suggest description' });
    await expect(ask).toBeVisible({ timeout: 30_000 });
    // a caption already written offers nothing
    await expect(page.locator('[data-album-selection="one"]').getByRole('button', { name: 'Suggest caption' })).toBeHidden();
    await ask.click();
    await expect(box.locator('[data-alt-offer]')).toBeVisible({ timeout: 30_000 });
    await expect(box.locator('[data-alt-said]')).toHaveText(`Suggested description: ${STAND_IN_DESCRIPTION}`);
    expect(albumSidecar('p01').description).toBeUndefined();
    await box.getByRole('button', { name: 'Accept' }).click();
    await page.keyboard.press('Tab');
    await expect.poll(() => albumSidecar('p01').description, { timeout: 30_000 }).toBe(STAND_IN_DESCRIPTION);
  });

  test('several in an album: choose what to suggest, see how many need it, run, review, and save only what was kept', async ({ page }) => {
    seesPictures();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/_edit/albums/fixture-album/?selected=p01,p02');
    await page.locator('[data-album-selection="many"]').getByRole('button', { name: 'Suggest words with AI…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Suggest words with AI' });
    await expect(dialog).toBeVisible();
    const kind = (name: string) => dialog.getByRole('checkbox', { name: new RegExp(`^${name}`) });
    // both have a caption and alt text: nothing to ask until Description is ticked
    await expect(dialog.locator('[data-suggest-kind="caption"] [data-field-part="hint"]')).toHaveText('All have one', { timeout: 30_000 });
    await expect(dialog.locator('[data-suggest-kind="description"] [data-field-part="hint"]')).toHaveText('2 of 2 need one');
    const run = dialog.locator('[data-suggest-run]');
    await expect(run).toBeDisabled();
    await kind('Description').check();
    await expect(run).toHaveText('Suggest for 2 pictures');
    await run.click();

    const rows = dialog.locator('[data-suggest-media]');
    await expect(rows).toHaveCount(2, { timeout: 30_000 });
    await expect(dialog.locator('[data-suggest-status]')).toContainText('ready to review', { timeout: 30_000 });
    const descriptions = dialog.locator('[data-suggest-media] textarea[name="description"]');
    await expect(descriptions.nth(0)).toHaveValue(STAND_IN_DESCRIPTION);
    // nothing is saved before the review
    expect(albumSidecar('p01').description).toBeUndefined();
    await descriptions.nth(1).fill('Oranges piled high on a market stall.');
    await dialog.getByRole('button', { name: 'Save these words' }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => [albumSidecar('p01').description, albumSidecar('p02').description], { timeout: 30_000 }).toEqual([STAND_IN_DESCRIPTION, 'Oranges piled high on a market stall.']);
    // the words it had are untouched
    expect(albumSidecar('p02').caption).toBe('Oranges, just in.');
  });

  test("several in an album: their words shown, 'Multiple values' where they differ, set on all, and a field's own Suggest", async ({ page }) => {
    seesPictures();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/_edit/albums/fixture-album/?selected=p01,p02');
    const selection = page.locator('[data-album-selection="many"]');
    await expect(selection.getByLabel('Caption')).toHaveAttribute('placeholder', 'Multiple values');
    await expect(selection.getByLabel('Caption')).toHaveValue('');
    const description = selection.getByLabel('Description');
    await description.fill('A morning at the market.');
    await description.press('Tab');
    await expect.poll(() => [albumSidecar('p01').description, albumSidecar('p02').description], { timeout: 30_000 }).toEqual(['A morning at the market.', 'A morning at the market.']);
    expect(albumSidecar('p02').caption).toBe('Oranges, just in.');

    // a caption over their different ones asks first: Keep their own puts the field back and saves nothing
    const caption = selection.getByLabel('Caption', { exact: true });
    const confirm = selection.locator('[data-shared-confirm]');
    await caption.fill('Market day.');
    await caption.press('Tab');
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText('They have different captions. Set this one on all 2?');
    await expect(confirm.getByRole('button', { name: 'Set on all' })).toBeFocused();
    await confirm.getByRole('button', { name: 'Keep their own' }).click();
    await expect(confirm).toBeHidden();
    await expect(caption).toHaveValue('');
    expect(albumSidecar('p02').caption).toBe('Oranges, just in.');
    // Set on all sets it on both
    await caption.fill('Market day.');
    await caption.press('Tab');
    await confirm.getByRole('button', { name: 'Set on all' }).click();
    await expect.poll(() => [albumSidecar('p01').caption, albumSidecar('p02').caption], { timeout: 30_000 }).toEqual(['Market day.', 'Market day.']);
    await page.locator('[data-album-selection="many"]').getByRole('button', { name: 'Suggest captions' }).click();
    const dialog = page.getByRole('dialog', { name: 'Suggest words with AI' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('checkbox', { name: /^Caption/ })).toBeChecked({ timeout: 30_000 });
    for (const other of ['Description', 'Alt text', 'Date taken']) await expect(dialog.getByRole('checkbox', { name: new RegExp(`^${other}`) })).not.toBeChecked();
  });

  test('one picture, on a writer never tested for pictures: Suggest words with AI… in its details tests it on the way, then runs the same batch', async ({ page }) => {
    expect(aiFile().services[0].pictures).toBeUndefined();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/_edit/albums/fixture-album/?selected=p01');
    await page.locator('[data-album-selection="one"]').getByRole('button', { name: 'Suggest words with AI…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Suggest words with AI' });
    await expect(dialog.locator('[data-suggest-count]')).toHaveText('For 1 selected item');
    await dialog.getByRole('checkbox', { name: /^Description/ }).check();
    const run = dialog.locator('[data-suggest-run]');
    await expect(run).toHaveText('Suggest for 1 picture');
    await run.click();
    await expect(dialog.locator('[data-suggest-media] textarea[name="description"]')).toHaveValue(STAND_IN_DESCRIPTION, { timeout: 30_000 });
    expect(aiFile().services[0].pictures).toBe(true);
    await dialog.getByRole('button', { name: 'Save these words' }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => albumSidecar('p01').description, { timeout: 30_000 }).toBe(STAND_IN_DESCRIPTION);
  });

  test("the Media screen's selection bar opens the same batch; Discard keeps nothing", async ({ page }) => {
    seesPictures();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/_edit/media/');
    const library = page.locator('[data-media-library]');
    await library.locator('li[data-item="articles/fixture-album/p01"]').click({ modifiers: ['Control'] });
    await library.locator('li[data-item="articles/fixture-album/p02"]').click({ modifiers: ['Control'] });
    await page.getByRole('group', { name: 'Selected items' }).getByRole('button', { name: 'Suggest words' }).click();
    const dialog = page.getByRole('dialog', { name: 'Suggest words with AI' });
    await expect(dialog.locator('[data-suggest-count]')).toHaveText('For 2 selected items');
    await dialog.getByRole('checkbox', { name: /^Description/ }).check();
    await dialog.locator('[data-suggest-run]').click();
    await expect(dialog.locator('[data-suggest-media]')).toHaveCount(2, { timeout: 30_000 });
    await expect(dialog.getByRole('button', { name: 'Discard' })).toBeVisible({ timeout: 30_000 });
    await dialog.getByRole('button', { name: 'Discard' }).click();
    await expect(dialog).toBeHidden();
    expect(albumSidecar('p01').description).toBeUndefined();
  });

  test("the Media screen with several picked: their words beside the grid, one alt text for all asks first, and a field's own Suggest", async ({ page }) => {
    seesPictures();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/_edit/media/');
    const library = page.locator('[data-media-library]');
    await library.locator('li[data-item="articles/fixture-album/p01"]').click();
    await library.locator('li[data-item="articles/fixture-album/p02"]').click({ modifiers: ['Control'] });
    const panel = page.locator('[data-media-selection]');
    await expect(panel.getByRole('heading', { name: '2 selected' })).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/[?&]selected=/);
    await expect(panel.getByLabel('Place', { exact: true })).toHaveAttribute('placeholder', 'Multiple values');

    // one alt text for two pictures asks, even to write it
    const alt = panel.getByLabel('Alt text', { exact: true });
    await alt.fill('Something seen on the way.');
    await alt.press('Tab');
    const confirm = panel.locator('[data-shared-confirm]');
    await expect(confirm).toContainText('screen reader hears the same words');
    await confirm.getByRole('button', { name: 'Keep their own' }).click();
    expect(albumSidecar('p01').alt).toBe('A hill path at dawn.');

    // a place over their different ones, confirmed, is set on both
    const place = panel.getByLabel('Place', { exact: true });
    await place.fill('Manipur');
    await place.press('Tab');
    await confirm.getByRole('button', { name: 'Set on all' }).click();
    await expect.poll(() => [albumSidecar('p01').place, albumSidecar('p02').place], { timeout: 30_000 }).toEqual(['Manipur', 'Manipur']);

    // a reload keeps the selection's panel
    await page.reload();
    await expect(page.locator('[data-media-selection]').getByLabel('Place', { exact: true })).toHaveValue('Manipur', { timeout: 30_000 });

    await page.locator('[data-media-selection]').getByRole('button', { name: 'Suggest places' }).click();
    const dialog = page.getByRole('dialog', { name: 'Suggest words with AI' });
    await expect(dialog.locator('[data-suggest-count]')).toHaveText('For 2 selected items');
    await expect(dialog.getByRole('checkbox', { name: /^Place/ })).toBeChecked({ timeout: 30_000 });
    for (const other of ['Caption', 'Description', 'Alt text', 'Date taken']) await expect(dialog.getByRole('checkbox', { name: new RegExp(`^${other}`) })).not.toBeChecked();
  });

  test("an album's Suggest words… opens the batch for every item in it", async ({ page }) => {
    seesPictures();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/_edit/albums/fixture-album/');
    await page.getByRole('tab', { name: 'Album' }).click();
    await page.locator('[data-album-form]').getByRole('button', { name: 'Suggest words…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Suggest words with AI' });
    await expect(dialog.locator('[data-suggest-count]')).toHaveText('For 21 selected items');
    // 16 of the album's pictures have no caption yet
    await expect(dialog.locator('[data-suggest-kind="caption"] [data-field-part="hint"]')).toContainText('need one', { timeout: 30_000 });
  });
});
