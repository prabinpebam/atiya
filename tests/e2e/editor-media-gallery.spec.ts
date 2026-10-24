/**
 * Edit mode's uploads for the Gallery (documentation/gallery/spec.md §4, §4.1, §4.3; plan G1): an SVG kept as
 * a drawing (cleaned, with what was taken out said) or turned into a picture, the formats the site can't keep
 * refused with what to do, the animated PNG note, Keep it large and Make it standard, the date taken and
 * Find the focus. Part of the "editor" project, on the fixture server (port 4330), never the real content/.
 *
 *   node scripts/test-run.mjs --by agent --purpose "gallery uploads" -- --project=editor tests/e2e/editor-media-gallery.spec.ts
 */
import { expect, test, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { FIXTURE, reset } from '../../scripts/editor-test-server.mjs';

const ARTICLE = 'do-what-makes-you-proud';
const readJson = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const shared = (name: string) => join(FIXTURE, 'content/media/shared', name);
const status = (page: Page) => page.locator('[data-editor-status]');
const upload = (page: Page) => page.locator('[data-editor-upload]');

/** The media screen with its upload form open. */
async function openUpload(page: Page) {
  await page.goto('/_edit/media/?view=list');
  await page.getByText('Upload a picture or a video').click();
  await expect(upload(page).locator('input[type="file"]')).toBeAttached();
}

const HOSTILE_SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" onload="alert(1)">' +
    '<script>alert(2)</script>' +
    '<rect x="10" y="10" width="100" height="60" rx="8" fill="#3a6" onclick="alert(3)"/>' +
    '<circle cx="60" cy="40" r="18" fill="#fd5"/>' +
    '</svg>',
);

/** A plain SVG over 200 KB (a long path): too big to keep as a drawing. */
const bigSvg = () => {
  const points = Array.from({ length: 30_000 }, (_, i) => `L${(i * 7) % 400} ${(i * 13) % 300}`).join(' ');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><path d="M0 0 ${points}" stroke="#333" fill="none"/></svg>`);
};

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (bytes: Buffer) => {
  let c = 0xffffffff;
  for (const b of bytes) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Buffer) => {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([head, body, crc]);
};

/** A one-frame animated PNG: a plain PNG with an acTL and an fcTL before its image data. */
async function apng(width = 64, height = 48) {
  const png = await sharp({ create: { width, height, channels: 3, background: { r: 200, g: 90, b: 40 } } }).png().toBuffer();
  const ihdrEnd = 8 + 4 + 4 + 13 + 4;
  const actl = Buffer.alloc(8);
  actl.writeUInt32BE(1, 0);
  actl.writeUInt32BE(0, 4);
  const fctl = Buffer.alloc(26);
  fctl.writeUInt32BE(0, 0);
  fctl.writeUInt32BE(width, 4);
  fctl.writeUInt32BE(height, 8);
  fctl.writeUInt16BE(1, 20);
  fctl.writeUInt16BE(10, 22);
  return Buffer.concat([png.subarray(0, ihdrEnd), chunk('acTL', actl), chunk('fcTL', fctl), png.subarray(ihdrEnd)]);
}

test.describe('editor: gallery uploads', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120_000);
  test.beforeEach(() => reset());
  test.afterAll(() => reset());

  test('an SVG kept as a drawing is cleaned, says what was taken out, and is shown whole', async ({ page }) => {
    await openUpload(page);
    await upload(page).locator('input[type="file"]').setInputFiles({ name: 'E2E Drawing.svg', mimeType: 'image/svg+xml', buffer: HOSTILE_SVG });
    const choice = upload(page).locator('[data-upload-svg]');
    await expect(choice).toBeVisible();
    await expect(choice.getByLabel('Keep it as a drawing')).toBeChecked();
    await expect(choice.getByLabel('Turn it into a picture')).toBeEnabled();
    await expect(upload(page).locator('[data-upload-large]')).toBeHidden();
    // a drawing is kept whole: nothing to crop
    await expect(upload(page).getByRole('button', { name: 'Crop it' })).toBeHidden();
    await upload(page).getByLabel('Alt text').fill('A green card with a yellow sun');
    await upload(page).getByRole('button', { name: 'Upload it' }).click();
    await expect(page).toHaveURL(/[?&]id=shared\/e2e-drawing$/, { timeout: 30_000 });
    await expect(status(page)).toContainText('Cleaned before saving: took out', { timeout: 15_000 });
    await expect(status(page)).toContainText('scripts');

    const kept = readFileSync(shared('e2e-drawing.svg'), 'utf8');
    expect(kept).not.toMatch(/<script|onload|onclick/i);
    expect(readJson(shared('e2e-drawing.json'))).toMatchObject({ file: 'e2e-drawing.svg', alt: 'A green card with a yellow sun' });

    const details = page.locator('[data-editor-media-details]');
    await expect(details.getByText('Drawing', { exact: true })).toBeVisible();
    await expect(details.getByRole('button', { name: 'Find the focus' })).toHaveCount(0);
    await expect(details.getByRole('button', { name: 'Crop the picture' })).toHaveCount(0);
  });

  test('an SVG turned into a picture is saved as a WebP master', async ({ page }) => {
    await openUpload(page);
    await upload(page).locator('input[type="file"]').setInputFiles({ name: 'E2E Flat.svg', mimeType: 'image/svg+xml', buffer: HOSTILE_SVG });
    await upload(page).locator('[data-upload-svg]').getByLabel('Turn it into a picture').check();
    await expect(upload(page).getByRole('button', { name: 'Crop it' })).toBeVisible();
    await upload(page).getByLabel('Alt text').fill('A green card');
    await upload(page).getByRole('button', { name: 'Upload it' }).click();
    await expect(page).toHaveURL(/[?&]id=shared\/e2e-flat$/, { timeout: 30_000 });
    expect(existsSync(shared('e2e-flat.svg'))).toBe(false);
    expect((await sharp(readFileSync(shared('e2e-flat.webp'))).metadata()).format).toBe('webp');
  });

  test('an SVG over 200 KB can only be turned into a picture, and says why', async ({ page }) => {
    await openUpload(page);
    await upload(page).locator('input[type="file"]').setInputFiles({ name: 'Big Drawing.svg', mimeType: 'image/svg+xml', buffer: bigSvg() });
    const choice = upload(page).locator('[data-upload-svg]');
    await expect(choice.getByLabel('Keep it as a drawing')).toBeDisabled();
    await expect(choice.getByLabel('Turn it into a picture')).toBeChecked();
    await expect(choice.locator('[data-upload-svg-why]')).toBeVisible();
  });

  test('the formats the site can\'t keep are refused with what to do', async ({ page }) => {
    await openUpload(page);
    const issue = upload(page).locator('[data-editor-form-issue]');
    const file = upload(page).locator('input[type="file"]');
    const bytes = Buffer.from('not really this format');
    for (const [name, mimeType, says] of [
      ['photo.jxl', 'image/jxl', 'JPEG XL'],
      ['IMG_0001.CR2', 'image/x-canon-cr2', 'camera RAW'],
      ['layout.psd', 'image/vnd.adobe.photoshop', 'Photoshop'],
      ['holiday.mkv', 'video/x-matroska', 'MP4'],
      ['old.avi', 'video/x-msvideo', 'MP4'],
    ] as const) {
      await file.setInputFiles({ name, mimeType, buffer: bytes });
      await expect(issue, name).toContainText(says);
    }
  });

  test('an animated PNG says before saving that it will be kept still', async ({ page }) => {
    await openUpload(page);
    await upload(page).locator('input[type="file"]').setInputFiles({ name: 'Spinner.png', mimeType: 'image/png', buffer: await apng() });
    const note = upload(page).locator('[data-upload-note]');
    await expect(note).toBeVisible();
    await expect(note).toContainText('kept as a still picture');
    await expect(note).toContainText('GIF or an animated WebP');
    await expect(upload(page).locator('[data-upload-large]')).toBeHidden();
    // a plain picture chosen next clears it
    const plain = await sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 9, g: 9, b: 9 } } }).png().toBuffer();
    await upload(page).locator('input[type="file"]').setInputFiles({ name: 'Plain.png', mimeType: 'image/png', buffer: plain });
    await expect(note).toBeHidden();
  });

  test('Keep it large keeps a master over 2560 px with its date taken; Make it standard saves it again at 2560', async ({ page }) => {
    const big = await sharp({ create: { width: 3200, height: 2000, channels: 3, background: { r: 40, g: 90, b: 160 } } })
      .composite([{ input: { create: { width: 400, height: 400, channels: 3, background: { r: 250, g: 230, b: 60 } } }, left: 2600, top: 200 }])
      .jpeg({ quality: 80 })
      .withExif({ IFD0: { DateTime: '2024:05:06 07:08:09' } })
      .toBuffer();
    await openUpload(page);
    const large = upload(page).locator('[data-upload-large]');
    // a small picture isn't offered it
    const small = await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 9, g: 9, b: 9 } } }).jpeg().toBuffer();
    await upload(page).locator('input[type="file"]').setInputFiles({ name: 'Small.jpg', mimeType: 'image/jpeg', buffer: small });
    await expect(upload(page).locator('[data-upload-facts]')).toContainText('800');
    await expect(large).toBeHidden();

    await upload(page).locator('input[type="file"]').setInputFiles({ name: 'E2E Wide.jpg', mimeType: 'image/jpeg', buffer: big });
    await expect(large).toBeVisible();
    await expect(large.getByLabel(/Keep it large/)).not.toBeChecked();
    await large.getByLabel(/Keep it large/).check();
    await upload(page).getByLabel('Alt text').fill('A blue field with a yellow square');
    await upload(page).getByRole('button', { name: 'Upload it' }).click();
    await expect(page).toHaveURL(/[?&]id=shared\/e2e-wide$/, { timeout: 30_000 });

    const sidecar = readJson(shared('e2e-wide.json'));
    expect(sidecar).toMatchObject({ large: true, taken: '2024-05-06' });
    // a new upload gets its focus point from the attention measure: towards the yellow square, on the right
    expect(parseFloat(String(sidecar.focus).split(' ')[0])).toBeGreaterThan(50);
    expect((await sharp(readFileSync(shared('e2e-wide.webp'))).metadata()).width).toBe(3200);

    const details = page.locator('[data-editor-media-details]');
    const size = details.locator('[data-editor-media-size]');
    await expect(size).toBeVisible();
    await size.getByRole('button', { name: 'Make it standard' }).click();
    await expect(status(page)).toContainText('standard', { timeout: 30_000 });
    await expect(details.locator('[data-editor-media-size]')).toHaveCount(0);
    expect(readJson(shared('e2e-wide.json')).large).toBeUndefined();
    expect((await sharp(readFileSync(shared('e2e-wide.webp'))).metadata()).width).toBe(2560);
  });

  test('Replace offers Keep it large for a big picture, and an SVG its two ways', async ({ page }) => {
    await page.goto(`/_edit/media/?id=articles/${ARTICLE}/tshirt`);
    const replace = page.locator('[data-editor-media-replace]');
    const file = replace.locator('input[type="file"]');
    const big = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 90, g: 90, b: 90 } } }).jpeg().toBuffer();
    await file.setInputFiles({ name: 'big.jpg', mimeType: 'image/jpeg', buffer: big });
    await expect(replace.locator('[data-upload-large]')).toBeVisible();
    await expect(replace.locator('[data-upload-svg]')).toBeHidden();
    await file.setInputFiles({ name: 'mark.svg', mimeType: 'image/svg+xml', buffer: HOSTILE_SVG });
    await expect(replace.locator('[data-upload-svg]')).toBeVisible();
    await expect(replace.locator('[data-upload-large]')).toBeHidden();
    await file.setInputFiles({ name: 'photo.jxl', mimeType: 'image/jxl', buffer: Buffer.from('jxl') });
    await expect(replace).toContainText('JPEG XL');
  });

  test('Find the focus moves the point to the subject; it is kept when the details are saved', async ({ page }) => {
    const id = `articles/${ARTICLE}/tshirt`;
    const file = join(FIXTURE, 'content/media/articles', ARTICLE, 'tshirt.json');
    await page.goto(`/_edit/media/?view=list&id=${id}`);
    const details = page.locator('[data-editor-media-details]');
    await details.getByRole('button', { name: 'Use the centre' }).click();
    await expect(details.locator('input[name="focus"]')).toHaveValue('');
    await details.getByRole('button', { name: 'Find the focus' }).click();
    await expect(status(page)).toContainText('Focus point found', { timeout: 30_000 });
    const found = await details.locator('input[name="focus"]').inputValue();
    expect(found).toMatch(/^\d+(\.\d+)?% \d+(\.\d+)?%$/);
    await details.getByRole('button', { name: 'Save the details' }).click();
    await expect(status(page)).toHaveText(/^Saved\b/, { timeout: 15_000 });
    expect(readJson(file).focus).toBe(found);
  });

  test('the date taken: changed in the details and saved; cleared, it goes from the sidecar', async ({ page }) => {
    const id = 'articles/fixture-album/p01';
    const file = join(FIXTURE, 'content/media/articles/fixture-album/p01.json');
    await page.goto(`/_edit/media/?view=list&id=${id}`);
    const details = page.locator('[data-editor-media-details]');
    const taken = details.getByLabel('Date taken');
    await expect(taken).toHaveValue('2026-03-11');
    await taken.fill('2025-12-24');
    await details.getByRole('button', { name: 'Save the details' }).click();
    await expect(status(page)).toHaveText(/^Saved\b/, { timeout: 15_000 });
    expect(readJson(file).taken).toBe('2025-12-24');
    await taken.fill('');
    await details.getByRole('button', { name: 'Save the details' }).click();
    await expect(status(page)).toHaveText(/^Saved\b/, { timeout: 15_000 });
    await expect.poll(() => 'taken' in readJson(file)).toBe(false);
  });
});
