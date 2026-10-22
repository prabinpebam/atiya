/**
 * Edit mode's server, against temporary folders (documentation/editor/plan.md §4): uploads through sharp
 * (WebP within the budgets, metadata stripped, the sidecar in the same transaction; a GIF kept byte for byte), a picture's details,
 * Replace and Delete; publishing with git against a temporary repository and a bare remote (only the
 * content folder is committed, staged code stays staged, a failed push is reported, Discard restores);
 * and the integration (nothing for a build, CONTENT_ROOT refused in one).
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { jsonBytes, readDoc } from '../../src/site/editor/server/store';
import { createArticle, deleteArticle, saveArticle } from '../../src/site/editor/server/articles';
import { cropMedia, cropSource, deleteMedia, findFocus, makeStandard, MAX_BYTES, MAX_SIDE, MAX_UPLOAD, parseUploadCrop, removeDark, replaceMaster, saveSidecar, setDark, upload, uploadVideo } from '../../src/site/editor/server/media';
import { MAX_GIF_BYTES, MAX_VIDEO_BYTES } from '../../src/site/editor/model/upload';
import { addLinkedVideo, ONLY_PROVIDERS, standInFetch } from '../../src/site/editor/server/albumEmbed';
import { byteRange } from '../../integrations/content-files.mjs';
import { asCommitted, changes, committedJson, discard, pendingCount, publish, push } from '../../src/site/editor/server/git';
import { chosenFiles, messageFor, pageOf, pageScope, privateNote, saveLabel } from '../../src/site/editor/model/selection';
import editor from '../../integrations/editor.mjs';

const ROOT = join(__dirname, '../..');
let dir: string;
let content: string;
const put = (key: string, value: unknown) => {
  const abs = join(content, ...key.replace(/^\/content\//, '').split('/'));
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, jsonBytes(value));
};
const article = (over: Record<string, unknown> = {}) => ({ id: 'a', type: 'article', kind: 'note', slug: 'a', title: 'A', summary: 'S', status: 'draft', visibility: 'public', updatedAt: '2026-09-30', locale: 'en', body: [], ...over });
const seed = () => {
  put('/content/site.json', { name: 'N', description: 'D', owner: 'p', locale: 'en' });
  put('/content/people/p.json', { id: 'p', name: 'P' });
  put('/content/structures/site.json', { home: { id: 'home', kind: 'hub', slug: '', title: 'Home', children: [{ id: 's', kind: 'hub', slug: 's', title: 'S', children: [{ id: 'a', kind: 'item', item: { type: 'article', id: 'a' } }] }] } });
  put('/content/articles/a.json', article());
};
const png = (w: number, h: number, alpha = false) => sharp({ create: { width: w, height: h, channels: alpha ? 4 : 3, background: alpha ? { r: 10, g: 120, b: 200, alpha: 0.5 } : { r: 200, g: 120, b: 60 } } }).png().toBuffer();
const animatedGif = Buffer.from(
  '47494638396101000100800000000000ffffff21ff0b4e45545343415045322e30030100000021f90400080000002c000000000100010000020244010021f90400100000002c00000000010001000002024c01003b',
  'hex',
);
const saved = process.env.CONTENT_ROOT;
const savedPrivate = process.env.PRIVATE_ROOT;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'editor-server-'));
  content = join(dir, 'content');
  process.env.CONTENT_ROOT = content;
  // its own private folder, absent: these tests are about the public content alone
  process.env.PRIVATE_ROOT = join(dir, 'private-pages');
  seed();
});
afterEach(() => {
  if (saved === undefined) delete process.env.CONTENT_ROOT;
  else process.env.CONTENT_ROOT = saved;
  if (savedPrivate === undefined) delete process.env.PRIVATE_ROOT;
  else process.env.PRIVATE_ROOT = savedPrivate;
  rmSync(dir, { recursive: true, force: true });
});

// ---------- a page's building follows its section (documentation/sections/spec.md §5.2, §7.6) ----------
describe("a page's building", () => {
  const PLACES = ['workshop', 'town-hall', 'lighthouse', 'library', 'amphitheater', 'greenhouse', 'post-office'];
  const PLANET = join('structures', 'modes', 'little-planet.json');
  const seedPlanet = () => {
    put('/content/structures/site.json', { home: { id: 'home', kind: 'hub', slug: '', title: 'Home', children: PLACES.map((id, n) => ({ id: `s${n}`, kind: 'hub', slug: `s${n}`, title: id, children: n === 0 ? [{ id: 'a', kind: 'item', item: { type: 'article', id: 'a' } }] : [] })) } });
    put('/content/structures/modes/little-planet.json', { places: PLACES.map((id, n) => ({ id, title: id, kicker: 'K', summary: 'S', site: `s${n}` })) });
  };
  const save = (over: { section?: string | null }) => {
    const a = readDoc<Record<string, unknown>>('/content/articles/a.json')!;
    return saveArticle({ id: 'a', article: a.value as never, ifMatch: { '/content/articles/a.json': a.version }, ...over });
  };

  it('creating, moving and deleting a page never writes the planet: its building is the one showing its section', async () => {
    seedPlanet();
    const before = readFileSync(join(content, PLANET), 'utf8');
    expect(await createArticle({ title: 'New one', summary: 'S', kind: 'note', section: 's3' })).toMatchObject({ ok: true, id: 'new-one' });
    expect(await save({ section: 's3' })).toMatchObject({ ok: true });
    expect(await save({ section: null })).toMatchObject({ ok: true });
    expect(await deleteArticle('a', false, {})).toMatchObject({ ok: true });
    expect(readFileSync(join(content, PLANET), 'utf8')).toBe(before);
  });
});

describe('block keys on save (documentation/editor/ai-editing.md §3)', () => {
  it('fills missing keys, re-keys a copy, keeps the rest, and a key alone leaves the updated date', async () => {
    const key = '/content/articles/a.json';
    type Doc = { updatedAt: string; body: { key?: string }[] };
    put(key, article({ body: [{ type: 'text', markdown: 'One' }] }));
    let a = readDoc<Doc>(key)!;
    expect(await saveArticle({ id: 'a', article: a.value as never, ifMatch: { [key]: a.version } })).toMatchObject({ ok: true });
    a = readDoc<Doc>(key)!;
    const [first] = a.value.body;
    expect(first.key).toMatch(/^[a-z0-9]{6}$/);
    expect(a.value.updatedAt).toBe('2026-09-30');
    const body = [first, { ...first }, { type: 'divider' }];
    expect(await saveArticle({ id: 'a', article: { ...a.value, body } as never, ifMatch: { [key]: a.version } })).toMatchObject({ ok: true });
    const keys = readDoc<Doc>(key)!.value.body.map((b) => b.key);
    expect(keys[0]).toBe(first.key);
    expect(new Set(keys).size).toBe(3);
    expect(keys.every((k) => /^[a-z0-9]{6}$/.test(k ?? ''))).toBe(true);
  });
});

describe('a published page moves freely: its old address simply goes (documentation/sections/spec.md §7.2)', () => {
  const structure = (section: string) => ({ home: { id: 'home', kind: 'hub', slug: '', title: 'Home', children: [{ id: 's', kind: 'hub', slug: 's', title: 'S', children: section === 's' ? [{ id: 'a', kind: 'item', item: { type: 'article', id: 'a' } }] : [] }, { id: 't', kind: 'hub', slug: 't', title: 'T', children: section === 't' ? [{ id: 'a', kind: 'item', item: { type: 'article', id: 'a' } }] : [] }] } });
  const save = (over: { section?: string | null; status?: string }) => {
    const a = readDoc<Record<string, unknown>>('/content/articles/a.json')!;
    const s = readDoc('/content/structures/site.json')!;
    const { status, ...rest } = over;
    return saveArticle({ id: 'a', article: { ...(a.value as object), ...(status ? { status } : {}) } as never, ifMatch: { '/content/articles/a.json': a.version, '/content/structures/site.json': s.version }, ...rest });
  };
  const site = () => readFileSync(join(content, 'structures', 'site.json'), 'utf8');

  it('to another section, off the site and back to a draft, with no redirect written', async () => {
    put('/content/structures/site.json', structure('s'));
    put('/content/articles/a.json', article({ status: 'published', publishedAt: '2026-09-30' }));
    expect(await save({ section: 't' })).toMatchObject({ ok: true });
    expect(JSON.parse(site()).home.children[1].children).toEqual([{ id: 'a', kind: 'item', item: { type: 'article', id: 'a' } }]);
    expect(await save({ section: null })).toMatchObject({ ok: true });
    expect(await save({ status: 'draft' })).toMatchObject({ ok: true });
    expect(existsSync(join(content, 'redirects.json'))).toBe(false);
  });
});

describe('unpublishing a page pinned on the home page', () => {
  it('saves Draft and Published without rewriting the Questions answer or its proof', async () => {
    const key = '/content/articles/a.json';
    const showcase = '/content/showcase.json';
    put(key, article({ status: 'published', publishedAt: '2026-09-30' }));
    put(showcase, {
      capabilities: [{ id: 'design', name: 'Design', short: 'Design', line: 'Builds useful things', proof: [{ ref: 'ref:article/a' }] }],
      questions: [{ id: 'q', question: 'What do you do?', answer: 'I build useful things.', capabilities: ['design'], proof: [{ ref: 'ref:article/a' }] }],
    });
    const before = readFileSync(join(content, 'showcase.json'), 'utf8');
    for (const status of ['draft', 'published'] as const) {
      const current = readDoc<import('../../src/site/content/schema').Article>(key)!;
      const result = await saveArticle({ id: 'a', article: { ...current.value, status }, ifMatch: { [key]: current.version } });
      expect(result).toMatchObject({ ok: true, article: { status } });
      expect(readDoc<typeof current.value>(key)?.value.status).toBe(status);
      expect(readFileSync(join(content, 'showcase.json'), 'utf8')).toBe(before);
    }
  });
});

// ---------- media ----------
describe('uploads', () => {
  it('make a WebP master within the budgets, without metadata, named from the file, with its sidecar', async () => {
    const big = await sharp(await png(3200, 1800)).jpeg().withMetadata({ exif: { IFD0: { Copyright: 'someone', Artist: 'someone' } } }).toBuffer();
    const r = await upload({ file: { name: 'My Photo.JPG', bytes: big }, owner: 'shared', alt: 'An orange field' });
    expect(r).toMatchObject({ ok: true, id: 'shared/my-photo' });
    const master = readFileSync(join(content, 'media/shared/my-photo.webp'));
    const meta = await sharp(master).metadata();
    expect(meta.format).toBe('webp');
    expect(Math.max(meta.width!, meta.height!)).toBe(MAX_SIDE);
    expect(master.length).toBeLessThanOrEqual(MAX_BYTES);
    expect(meta.exif).toBeUndefined();
    expect(readDoc('/content/media/shared/my-photo.json')?.value).toEqual({
      kind: 'image',
      file: 'my-photo.webp',
      alt: 'An orange field',
      // its size and background, measured as it's saved (documentation/content/media.md §9.3)
      facts: { width: meta.width, height: meta.height, bg: expect.stringMatching(/^rgb\(\d+ \d+ \d+\)$/), bytes: master.length },
      // the SHA-256 of the file as uploaded, before it was converted (gallery spec §3.8)
      fingerprint: createHash('sha256').update(big).digest('hex'),
      visibility: 'public',
    });
  });

  it('keep transparency (lossless), never overwrite a name in use, and take decorative in place of alt text', async () => {
    const first = await upload({ file: { name: 'logo.png', bytes: await png(400, 300, true) }, owner: 'shared', decorative: true });
    const second = await upload({ file: { name: 'logo.png', bytes: await png(401, 300, true) }, owner: 'shared', decorative: true });
    expect(first).toMatchObject({ ok: true, id: 'shared/logo' });
    expect(second).toMatchObject({ ok: true, id: 'shared/logo-2' });
    expect((await sharp(readFileSync(join(content, 'media/shared/logo.webp'))).metadata()).hasAlpha).toBe(true);
    expect(readDoc('/content/media/shared/logo.json')?.value).toMatchObject({ decorative: true });
  });

  it('refuse a picture without alt text (unless decorative), a folder outside the model and a file that is not a picture, and write nothing', async () => {
    const bytes = await png(100, 100);
    expect(await upload({ file: { name: 'x.png', bytes }, owner: 'shared', alt: '' })).toMatchObject({ ok: false, status: 422 });
    expect(await upload({ file: { name: 'x.png', bytes }, owner: '../outside', alt: 'x' })).toMatchObject({ ok: false, status: 422 });
    expect(await upload({ file: { name: 'x.png', bytes: Buffer.from('not a picture') }, owner: 'shared', alt: 'x' })).toMatchObject({ ok: false, status: 422 });
    expect(existsSync(join(content, 'media/shared/x.webp'))).toBe(false);
    expect(existsSync(join(content, 'media/shared/x.json'))).toBe(false);
  });

  it('cut a crop chosen before the upload, scaled from the size the browser showed, keeping transparency', async () => {
    // a 1000 × 500 transparent picture, cropped in a 500 × 250 view of it to its right half
    const r = await upload({ file: { name: 'wide.png', bytes: await png(1000, 500, true) }, owner: 'shared', alt: 'Wide', crop: { x: 250, y: 0, width: 250, height: 250, of: { width: 500, height: 250 } } });
    expect(r).toMatchObject({ ok: true, id: 'shared/wide' });
    const meta = await sharp(readFileSync(join(content, 'media/shared/wide.webp'))).metadata();
    expect([meta.width, meta.height, meta.hasAlpha]).toEqual([500, 500, true]);
  });

  it('take SVG (drawn at the size a master can be), GIF and TIFF', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32" viewBox="0 0 64 32"><circle cx="16" cy="16" r="12" fill="#c33"/></svg>');
    expect(await upload({ file: { name: 'mark.svg', bytes: svg }, owner: 'shared', alt: 'A red dot' })).toMatchObject({ ok: true, id: 'shared/mark' });
    const drawn = await sharp(readFileSync(join(content, 'media/shared/mark.webp'))).metadata();
    expect([drawn.width, drawn.hasAlpha]).toEqual([MAX_SIDE, true]);
    const gif = await sharp(await png(40, 30)).gif().toBuffer();
    const tiff = await sharp(await png(40, 30)).tiff().toBuffer();
    expect(await upload({ file: { name: 'anim.gif', bytes: gif }, owner: 'shared', alt: 'G' })).toMatchObject({ ok: true });
    expect(readFileSync(join(content, 'media/shared/anim.gif')).equals(gif)).toBe(true);
    expect(await upload({ file: { name: 'scan.tiff', bytes: tiff }, owner: 'shared', alt: 'T' })).toMatchObject({ ok: true });
    expect((await sharp(readFileSync(join(content, 'media/shared/scan.webp'))).metadata()).width).toBe(40);
  });

  it('keeps a GIF exactly as it is (never re-encoded), with a still reduced-motion poster when it moves', async () => {
    expect(await upload({ file: { name: 'motion.gif', bytes: animatedGif }, owner: 'shared', alt: 'Two changing pixels' })).toMatchObject({ ok: true, id: 'shared/motion' });
    const master = readFileSync(join(content, 'media/shared/motion.gif'));
    expect(master.equals(animatedGif)).toBe(true);
    expect(existsSync(join(content, 'media/shared/motion.webp'))).toBe(false);
    const poster = await sharp(readFileSync(join(content, 'media/shared/motion.poster.webp'))).metadata();
    expect(poster.format).toBe('webp');
    expect(poster.pages ?? 1).toBe(1);
    expect(readDoc('/content/media/shared/motion.json')?.value).toMatchObject({ file: 'motion.gif', animation: { poster: 'motion.poster.webp' } });
  });

  it('takes a GIF far over the 1.5 MB budget (kept as it is), up to GitHub’s limit for a file', async () => {
    // a still GIF of noise: big, and nothing a re-encode would keep under 1.5 MB
    const noise = Buffer.alloc(1600 * 1600 * 3);
    let s = 1;
    for (let i = 0; i < noise.length; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      noise[i] = s >>> 24;
    }
    const big = await sharp(noise, { raw: { width: 1600, height: 1600, channels: 3 } }).gif({ effort: 1 }).toBuffer();
    expect(big.length).toBeGreaterThan(MAX_BYTES);
    expect(await upload({ file: { name: 'big.gif', bytes: big }, owner: 'shared', alt: 'Noise' })).toMatchObject({ ok: true, id: 'shared/big' });
    expect(readFileSync(join(content, 'media/shared/big.gif')).equals(big)).toBe(true);
    expect(readDoc('/content/media/shared/big.json')?.value).not.toHaveProperty('animation');
    const huge = Buffer.concat([animatedGif.subarray(0, 6), Buffer.alloc(MAX_GIF_BYTES)]);
    expect(JSON.stringify(await upload({ file: { name: 'huge.gif', bytes: huge }, owner: 'shared', alt: 'Huge' }))).toMatch(/under 100 MB, GitHub's limit/);
    expect(JSON.stringify(await upload({ file: { name: 'huge.png', bytes: Buffer.alloc(MAX_UPLOAD + 1) }, owner: 'shared', alt: 'Huge' }))).toMatch(/up to 20 MB/);
  });

  it('refuses a GIF wider than a master can be, rather than resizing it', async () => {
    const wide = await sharp(await png(MAX_SIDE + 1, 10)).gif().toBuffer();
    expect(JSON.stringify(await upload({ file: { name: 'wide.gif', bytes: wide }, owner: 'shared', alt: 'Wide' }))).toMatch(/at most 2560 px/);
    expect(existsSync(join(content, 'media/shared/wide.gif'))).toBe(false);
  });

  it('refuses a destructive crop of an animation, or of any GIF, instead of re-encoding it', async () => {
    const crop = { x: 0, y: 0, width: 1, height: 1, of: { width: 1, height: 1 } };
    expect(await upload({ file: { name: 'motion.gif', bytes: animatedGif }, owner: 'shared', alt: 'Two changing pixels', crop })).toMatchObject({ ok: false, status: 422 });
    const added = (await upload({ file: { name: 'motion.gif', bytes: animatedGif }, owner: 'shared', alt: 'Two changing pixels' })) as { id: string };
    expect(await cropMedia(added.id, { x: 0, y: 0, width: 1, height: 1 })).toMatchObject({ ok: false, status: 422 });
    const still = (await upload({ file: { name: 'still.gif', bytes: await sharp(await png(40, 30)).gif().toBuffer() }, owner: 'shared', alt: 'Still' })) as { id: string };
    expect(JSON.stringify(await cropMedia(still.id, { x: 0, y: 0, width: 10, height: 10 }))).toMatch(/GIF is kept exactly as it is/);
  });

  it("read the form's crop only when it's a rectangle in a size", () => {
    expect(parseUploadCrop(JSON.stringify({ x: 1, y: 2, width: 3, height: 4, of: { width: 10, height: 10 } }))).toEqual({ x: 1, y: 2, width: 3, height: 4, of: { width: 10, height: 10 } });
    for (const bad of [null, '', 'nope', JSON.stringify({ x: 1, y: 2, width: 0, height: 4, of: { width: 10, height: 10 } }), JSON.stringify({ x: -1, y: 0, width: 3, height: 4, of: { width: 10, height: 10 } }), JSON.stringify({ x: 0, y: 0, width: 3, height: 4 })]) expect(parseUploadCrop(bad)).toBeNull();
  });
});

describe('gallery uploads: drawings, refused formats, the date taken, the focus point, kept large (gallery spec §4)', () => {
  const svg = (inner: string) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32" viewBox="0 0 64 32">${inner}</svg>`);
  const noise = (w: number, h: number) => {
    const raw = Buffer.alloc(w * h * 3);
    let s = 7;
    for (let i = 0; i < raw.length; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      raw[i] = s >>> 24;
    }
    return sharp(raw, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
  };

  it('keeps an SVG as a drawing when asked: cleaned, with what was removed, no focus or date, and never cropped', async () => {
    const r = await upload({ file: { name: 'Mark.svg', bytes: svg('<script>alert(1)</script><circle cx="16" cy="16" r="12" fill="#c33" onclick="x()"/>') }, owner: 'shared', alt: 'A red dot', svgAs: 'drawing' });
    expect(r).toMatchObject({ ok: true, id: 'shared/mark', removed: ['scripts', 'event handlers'] });
    const kept = readFileSync(join(content, 'media/shared/mark.svg'), 'utf8');
    expect(kept).toContain('<circle cx="16" cy="16" r="12" fill="#c33"/>');
    expect(kept).not.toMatch(/script|onclick/);
    expect(existsSync(join(content, 'media/shared/mark.webp'))).toBe(false);
    const sc = readDoc<Record<string, unknown>>('/content/media/shared/mark.json')!.value;
    expect(sc).toMatchObject({ file: 'mark.svg', facts: { width: 64, height: 32 } });
    expect(sc).not.toHaveProperty('focus');
    expect(sc).not.toHaveProperty('large');
    expect(JSON.stringify(await cropMedia('shared/mark', { x: 0, y: 0, width: 10, height: 10 }))).toMatch(/drawing/);
    expect(JSON.stringify(await findFocus('shared/mark'))).toMatch(/set by hand/);
    // its dark version is a drawing too
    expect(await setDark('shared/mark', await png(64, 32))).toMatchObject({ ok: false, status: 422 });
    expect(await setDark('shared/mark', svg('<circle cx="16" cy="16" r="12" fill="#fcc"/>'))).toMatchObject({ ok: true });
    expect(readDoc<Record<string, { file: string }>>('/content/media/shared/mark.json')!.value.dark.file).toBe('mark.dark.svg');
  });

  it('refuses a drawing it can\'t make safe, or a crop of one, and writes nothing; a picture can still be made of it', async () => {
    const outside = svg('<image href="https://evil.example/x.png" width="10" height="10"/>');
    expect(JSON.stringify(await upload({ file: { name: 'x.svg', bytes: outside }, owner: 'shared', alt: 'X', svgAs: 'drawing' }))).toMatch(/outside its own file/);
    const crop = { x: 0, y: 0, width: 10, height: 10, of: { width: 64, height: 32 } };
    expect(await upload({ file: { name: 'y.svg', bytes: svg('<rect width="5" height="5"/>') }, owner: 'shared', alt: 'Y', svgAs: 'drawing', crop })).toMatchObject({ ok: false, status: 422 });
    expect(JSON.stringify(await upload({ file: { name: 'z.png', bytes: await png(10, 10) }, owner: 'shared', alt: 'Z', svgAs: 'drawing' }))).toMatch(/only an SVG/);
    expect(existsSync(join(content, 'media/shared/x.svg'))).toBe(false);
    expect(existsSync(join(content, 'media/shared/y.svg'))).toBe(false);
    expect(await upload({ file: { name: 'y.svg', bytes: svg('<rect width="5" height="5"/>') }, owner: 'shared', alt: 'Y', svgAs: 'picture' })).toMatchObject({ ok: true });
    expect(readDoc<{ file: string }>('/content/media/shared/y.json')!.value.file).toBe('y.webp');
  });

  it('refuses JPEG XL, camera RAW and Photoshop files by name or by their own bytes, saying what to do', async () => {
    const psd = Buffer.concat([Buffer.from('8BPS'), Buffer.alloc(40)]);
    const jxl = Buffer.from([0xff, 0x0a, 0, 0, 0, 0, 0, 0]);
    expect(JSON.stringify(await upload({ file: { name: 'layers.bin', bytes: psd }, owner: 'shared', alt: 'P' }))).toMatch(/Photoshop file.*Export it as PNG or JPEG/);
    expect(JSON.stringify(await upload({ file: { name: 'new', bytes: jxl }, owner: 'shared', alt: 'J' }))).toMatch(/JPEG XL/);
    expect(JSON.stringify(await upload({ file: { name: 'DSC_1.NEF', bytes: await png(10, 10) }, owner: 'shared', alt: 'R' }))).toMatch(/camera RAW/);
    expect(existsSync(join(content, 'media/shared'))).toBe(false);
  });

  it('reads the day it was taken from its EXIF, else takes the one the browser read, never a day after today', async () => {
    const photo = await sharp(await noise(64, 48)).jpeg().withExif({ IFD0: { DateTime: '2022:05:06 07:08:09' }, IFD2: { DateTimeOriginal: '2018:09:10 11:12:13' } }).toBuffer();
    await upload({ file: { name: 'camera.jpg', bytes: photo }, owner: 'shared', alt: 'C', taken: '2001-01-01' });
    expect(readDoc<{ taken?: string }>('/content/media/shared/camera.json')!.value.taken).toBe('2018-09-10');
    // a HEIC turned into a PNG in the browser: the browser read the date first
    await upload({ file: { name: 'phone.png', bytes: await png(20, 20) }, owner: 'shared', alt: 'P', taken: '2020-01-02' });
    expect(readDoc<{ taken?: string }>('/content/media/shared/phone.json')!.value.taken).toBe('2020-01-02');
    await upload({ file: { name: 'later.png', bytes: await png(21, 20) }, owner: 'shared', alt: 'L', taken: '2999-01-01' });
    await upload({ file: { name: 'nonsense.png', bytes: await png(22, 20) }, owner: 'shared', alt: 'N', taken: '2023-02-30' });
    expect(readDoc('/content/media/shared/later.json')!.value).not.toHaveProperty('taken');
    expect(readDoc('/content/media/shared/nonsense.json')!.value).not.toHaveProperty('taken');
  });

  it('finds the focus point of a new upload where its detail is, none for one flat colour, and again on asking without saving', async () => {
    const detail = await sharp({ create: { width: 800, height: 400, channels: 3, background: '#777' } })
      .composite([{ input: await noise(150, 150), left: 600, top: 220 }])
      .png()
      .toBuffer();
    await upload({ file: { name: 'detail.png', bytes: detail }, owner: 'shared', alt: 'D' });
    const focus = readDoc<{ focus?: string }>('/content/media/shared/detail.json')!.value.focus!;
    const [x, y] = focus.split(' ').map((v) => Number.parseFloat(v));
    expect(focus).toMatch(/^\d+% \d+%$/);
    expect(x).toBeGreaterThan(60);
    expect(y).toBeGreaterThan(50);
    await upload({ file: { name: 'flat.png', bytes: await png(800, 400) }, owner: 'shared', alt: 'F' });
    expect(readDoc('/content/media/shared/flat.json')!.value).not.toHaveProperty('focus');
    const before = readFileSync(join(content, 'media/shared/detail.json'), 'utf8');
    expect(await findFocus('shared/detail')).toEqual({ ok: true, versions: {}, focus });
    expect(readFileSync(join(content, 'media/shared/detail.json'), 'utf8')).toBe(before);
    expect(await findFocus('shared/none')).toMatchObject({ ok: false, status: 422 });
  });

  it('keeps a picture large when asked (up to 3840 px), only when it is bigger than 2560, and Make it standard saves it again at 2560', async () => {
    const big = await png(4800, 2400);
    expect(await upload({ file: { name: 'panorama.png', bytes: big }, owner: 'shared', alt: 'P', large: true })).toMatchObject({ ok: true });
    let meta = await sharp(readFileSync(join(content, 'media/shared/panorama.webp'))).metadata();
    expect([meta.width, meta.height]).toEqual([3840, 1920]);
    expect(readDoc('/content/media/shared/panorama.json')!.value).toMatchObject({ large: true, facts: { width: 3840, height: 1920 } });
    // a picture no bigger than a standard one isn't kept large, whatever was asked
    await upload({ file: { name: 'small.png', bytes: await png(2000, 1000) }, owner: 'shared', alt: 'S', large: true });
    expect(readDoc('/content/media/shared/small.json')!.value).not.toHaveProperty('large');
    // the details form can't make it large: only an upload or a Replace with the original can
    const sc = readDoc<Record<string, unknown>>('/content/media/shared/small.json')!;
    expect(await saveSidecar('shared/small', { ...sc.value, large: true } as never, { '/content/media/shared/small.json': sc.version })).toMatchObject({ ok: true });
    expect(readDoc('/content/media/shared/small.json')!.value).not.toHaveProperty('large');

    expect(await makeStandard('shared/panorama')).toMatchObject({ ok: true });
    meta = await sharp(readFileSync(join(content, 'media/shared/panorama.webp'))).metadata();
    expect([meta.width, meta.height]).toEqual([2560, 1280]);
    const after = readDoc<Record<string, unknown>>('/content/media/shared/panorama.json')!.value;
    expect(after).not.toHaveProperty('large');
    expect(after).toMatchObject({ alt: 'P', facts: { width: 2560, height: 1280 } });
    expect(JSON.stringify(await makeStandard('shared/panorama'))).toMatch(/already a standard picture/);

    // Replace with the original, kept large, makes it large again
    expect(await replaceMaster('shared/panorama', big, { name: 'panorama.png', large: true })).toMatchObject({ ok: true });
    expect(readDoc('/content/media/shared/panorama.json')!.value).toMatchObject({ large: true, facts: { width: 3840 } });
  });
});

describe('the crop: a copy, never the original (documentation/editor/spec.md §6.1)', () => {
  const add = async () => (await upload({ file: { name: 'mark.png', bytes: await png(1024, 576, true) }, owner: 'articles/a', alt: 'The mark' })) as { id: string };
  const size = async (file: string) => {
    const m = await sharp(readFileSync(join(content, 'media/articles/a', file))).metadata();
    return [m.width, m.height, m.hasAlpha];
  };

  it('makes a copy of an original, named after its shape, with its details and where it came from; the original stays as it was', async () => {
    const { id } = await add();
    const before = readFileSync(join(content, 'media/articles/a/mark.webp'));
    put('/content/media/articles/a/mark.json', { ...readDoc('/content/media/articles/a/mark.json')!.value as object, focus: '20% 30%', credit: 'Me' });
    const r = await cropMedia(id, { x: 0, y: 69, width: 1024, height: 439 });
    expect(r).toMatchObject({ ok: true, id: 'articles/a/mark-21x9', width: 1024, height: 439 });
    expect(await size('mark-21x9.webp')).toEqual([1024, 439, true]);
    // the copy's own facts, never its original's
    const copyBytes = readFileSync(join(content, 'media/articles/a/mark-21x9.webp')).length;
    expect(readDoc('/content/media/articles/a/mark-21x9.json')?.value).toEqual({ kind: 'image', file: 'mark-21x9.webp', alt: 'The mark', credit: 'Me', visibility: 'public', crop: { from: id, x: 0, y: 69, width: 1024, height: 439 }, facts: { width: 1024, height: 439, bg: expect.stringMatching(/^rgb\(/), bytes: copyBytes } });
    expect(readFileSync(join(content, 'media/articles/a/mark.webp')).equals(before)).toBe(true);
    // a second copy of the same shape takes the next name
    expect(await cropMedia(id, { x: 10, y: 60, width: 1000, height: 429 })).toMatchObject({ ok: true, id: 'articles/a/mark-21x9-2' });
  });

  it('cuts a copy again from its original (so it can grow back), or makes another copy when asked', async () => {
    const { id } = await add();
    const small = (await cropMedia(id, { x: 400, y: 200, width: 150, height: 100 })) as { id: string };
    expect(small.id).toBe('articles/a/mark-3x2');
    expect(await cropSource(small.id)).toMatchObject({ id, width: 1024, height: 576, rect: { x: 400, y: 200, width: 150, height: 100 }, isCopy: true });
    expect(await cropMedia(small.id, { x: 0, y: 0, width: 864, height: 576 })).toMatchObject({ ok: true, id: small.id, width: 864, height: 576 });
    expect(await size('mark-3x2.webp')).toEqual([864, 576, true]);
    expect(readDoc(`/content/media/${small.id}.json`)?.value).toMatchObject({ crop: { from: id, x: 0, y: 0, width: 864, height: 576 } });
    const other = await cropMedia(small.id, { x: 224, y: 0, width: 576, height: 576 }, { copy: true });
    expect(other).toMatchObject({ ok: true, id: 'articles/a/mark-1x1' });
    expect(readDoc('/content/media/articles/a/mark-1x1.json')?.value).toMatchObject({ crop: { from: id } });
  });

  it("a picture's dark version: added beside it, kept by its details' save, carried into a crop, removed, and deleted with it", async () => {
    const { id } = await add();
    const sidecar = () => readDoc<Record<string, unknown>>(`/content/media/${id}.json`)!;
    // a dark version of another size (its crops scale to it), transparency kept
    const r = await setDark(id, await png(512, 288, true));
    expect(r).toMatchObject({ ok: true, width: 512, height: 288, lightWidth: 1024, lightHeight: 576 });
    expect(sidecar().value).toMatchObject({ dark: { file: 'mark.dark.webp', facts: { width: 512, height: 288 } } });
    expect(await size('mark.dark.webp')).toEqual([512, 288, true]);
    // the details form can't change it, or the facts measured of its masters
    const facts = sidecar().value.facts;
    expect(facts).toMatchObject({ width: 1024, height: 576 });
    expect(await saveSidecar(id, { kind: 'image', file: 'mark.webp', alt: 'The mark, again', facts: { width: 1, height: 1, bg: 'rgb(0 0 0)', bytes: 1 }, visibility: 'public' }, { [`/content/media/${id}.json`]: sidecar().version })).toMatchObject({ ok: true });
    expect(sidecar().value).toMatchObject({ alt: 'The mark, again', dark: { file: 'mark.dark.webp', facts: { width: 512 } }, facts });
    // a crop cuts it too, from the same place in its own pixels
    const copy = (await cropMedia(id, { x: 0, y: 0, width: 512, height: 576 })) as { id: string };
    expect(readDoc(`/content/media/${copy.id}.json`)?.value).toMatchObject({ dark: { file: `${copy.id.split('/').pop()}.dark.webp` } });
    expect(await size(`${copy.id.split('/').pop()}.dark.webp`)).toEqual([256, 288, true]);
    // replacing it keeps one file; removing it takes it off the picture
    expect(await setDark(id, await png(1024, 576))).toMatchObject({ ok: true });
    expect(await size('mark.dark.webp')).toEqual([1024, 576, false]);
    expect(await removeDark(id)).toMatchObject({ ok: true });
    expect(sidecar().value).not.toHaveProperty('dark');
    expect(existsSync(join(content, 'media/articles/a/mark.dark.webp'))).toBe(false);
    expect(await removeDark(id)).toMatchObject({ ok: false, status: 422 });
    // deleting a picture deletes its dark version with it
    await setDark(copy.id, await png(512, 576));
    expect(await deleteMedia(copy.id)).toMatchObject({ ok: true });
    expect(existsSync(join(content, `media/${copy.id}.dark.webp`))).toBe(false);
    expect(existsSync(join(content, `media/${copy.id}.webp`))).toBe(false);
  });

  it("an animated GIF dark version is kept as it is, with its poster, then removes both", async () => {
    const { id } = await add();
    const darkResult = await setDark(id, animatedGif);
    expect(darkResult).toMatchObject({ ok: true, width: 1, height: 1 });
    expect(readDoc(`/content/media/${id}.json`)?.value).toMatchObject({ dark: { file: 'mark.dark.gif', animation: { poster: 'mark.dark.poster.webp' } } });
    expect(readFileSync(join(content, 'media/articles/a/mark.dark.gif')).equals(animatedGif)).toBe(true);
    expect(existsSync(join(content, 'media/articles/a/mark.dark.poster.webp'))).toBe(true);
    expect(await removeDark(id)).toMatchObject({ ok: true });
    expect(existsSync(join(content, 'media/articles/a/mark.dark.gif'))).toBe(false);
    expect(existsSync(join(content, 'media/articles/a/mark.dark.poster.webp'))).toBe(false);
  });

  it('refuses a rectangle outside the picture or in part pixels, and writes nothing', async () => {
    const { id } = await add();
    expect(await cropMedia(id, { x: 900, y: 0, width: 200, height: 100 })).toMatchObject({ ok: false, status: 422 });
    expect(await cropMedia(id, { x: 0.5, y: 0, width: 200, height: 100 })).toMatchObject({ ok: false, status: 422 });
    expect(await cropMedia('articles/a/none', { x: 0, y: 0, width: 10, height: 10 })).toMatchObject({ ok: false, status: 422 });
    expect(existsSync(join(content, 'media/articles/a/mark-2x1.webp'))).toBe(false);
  });

  it("a page's thumbnail must be a picture that exists", async () => {
    const { id } = await add();
    const key = '/content/articles/a.json';
    expect(await saveArticle({ id: 'a', article: article({ thumbnail: id }) as never, ifMatch: { [key]: readDoc(key)!.version } })).toMatchObject({ ok: true });
    expect(await saveArticle({ id: 'a', article: article({ thumbnail: 'articles/a/gone' }) as never, ifMatch: { [key]: readDoc(key)!.version } })).toMatchObject({ ok: false, status: 422 });
  });
});

describe('video files (documentation/content/media.md §12)', () => {
  const article = (over: Record<string, unknown> = {}) => ({ id: 'a', type: 'article', kind: 'note', slug: 'a', title: 'A', summary: 'S', status: 'draft', visibility: 'public', updatedAt: '2026-09-30', locale: 'en', body: [], ...over });
  const webm = Buffer.from('1a45dfa3', 'hex');

  it('a WebM is kept as it is, with its poster (a frame the browser took) as a WebP and its sidecar, in one write', async () => {
    const r = await uploadVideo({ file: { name: 'Product Demo.webm', bytes: webm }, owner: 'articles/a', title: 'The product demo', caption: 'Shot in Hyderabad.', width: 1280, height: 720, duration: 12.345, poster: await png(1280, 720) });
    expect(r).toMatchObject({ ok: true, id: 'articles/a/product-demo' });
    expect(readFileSync(join(content, 'media/articles/a/product-demo.webm'))).toEqual(webm);
    expect((await sharp(readFileSync(join(content, 'media/articles/a/product-demo.poster.webp'))).metadata()).format).toBe('webp');
    expect(JSON.parse(readFileSync(join(content, 'media/articles/a/product-demo.json'), 'utf8'))).toEqual({ kind: 'video', file: 'product-demo.webm', title: 'The product demo', width: 1280, height: 720, duration: 12.35, poster: { file: 'product-demo.poster.webp' }, caption: 'Shot in Hyderabad.', fingerprint: createHash('sha256').update(webm).digest('hex'), visibility: 'public' });
    // a video block shows it, and while it does it can't be deleted; its details save, its files and size kept
    put('/content/articles/a.json', article({ body: [{ type: 'video', media: 'articles/a/product-demo' }] }));
    const v = readDoc<Record<string, unknown>>('/content/media/articles/a/product-demo.json')!;
    expect(await saveSidecar('articles/a/product-demo', { ...(v.value as object), title: 'The demo', width: 1, file: 'evil.webm', caption: '' } as never, { '/content/media/articles/a/product-demo.json': v.version })).toMatchObject({ ok: true });
    expect(JSON.parse(readFileSync(join(content, 'media/articles/a/product-demo.json'), 'utf8'))).toMatchObject({ title: 'The demo', width: 1280, file: 'product-demo.webm' });
    expect(JSON.parse(readFileSync(join(content, 'media/articles/a/product-demo.json'), 'utf8')).caption).toBeUndefined();
    expect(await deleteMedia('articles/a/product-demo')).toMatchObject({ ok: false });
    put('/content/articles/a.json', article());
    expect(await deleteMedia('articles/a/product-demo')).toMatchObject({ ok: true });
    for (const f of ['product-demo.webm', 'product-demo.poster.webp', 'product-demo.json']) expect(existsSync(join(content, 'media/articles/a', f))).toBe(false);
  });

  it('refuses a video of 100 MB or more before anything is written, and what the site can\u2019t show', async () => {
    const big = Buffer.alloc(MAX_VIDEO_BYTES);
    const r = await uploadVideo({ file: { name: 'long.webm', bytes: big }, owner: 'shared', title: 'Long', width: 640, height: 360 });
    expect(r).toMatchObject({ ok: false, status: 422 });
    expect(JSON.stringify(r)).toMatch(/under 100 MB, GitHub's limit/);
    expect(existsSync(join(content, 'media/shared'))).toBe(false);
    expect(await uploadVideo({ file: { name: 'clip.mkv', bytes: webm }, owner: 'shared', title: 'C', width: 640, height: 360 })).toMatchObject({ ok: false });
    expect(await uploadVideo({ file: { name: 'clip.webm', bytes: webm }, owner: 'shared', title: '', width: 640, height: 360 })).toMatchObject({ ok: false });
    expect(await uploadVideo({ file: { name: 'clip.webm', bytes: webm }, owner: 'shared', title: 'C', width: 0, height: 0 })).toMatchObject({ ok: false });
  });

  it('serves a byte range, as a video seeking asks for', () => {
    expect(byteRange(undefined, 1000)).toBeNull();
    expect(byteRange('bytes=0-', 1000)).toEqual({ start: 0, end: 999 });
    expect(byteRange('bytes=100-199', 1000)).toEqual({ start: 100, end: 199 });
    expect(byteRange('bytes=-200', 1000)).toEqual({ start: 800, end: 999 });
    expect(byteRange('bytes=900-5000', 1000)).toEqual({ start: 900, end: 999 });
    expect(byteRange('bytes=1000-', 1000)).toBe(false);
  });
});

describe('the library: one item per file, a video file\u2019s date and linked videos (gallery spec §3.8, §4.2, §9.4, V45, V50, V55)', () => {
  const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
  const MAC_EPOCH = 2082844800;
  const mp4 = (iso: string) => {
    const box = (type: string, body: Buffer) => {
      const head = Buffer.alloc(8);
      head.writeUInt32BE(8 + body.length);
      head.write(type, 4, 'latin1');
      return Buffer.concat([head, body]);
    };
    const t = Buffer.alloc(8);
    t.writeUInt32BE(Date.parse(`${iso}T10:00:00Z`) / 1000 + MAC_EPOCH, 4);
    return Buffer.concat([box('ftyp', Buffer.from('isom\0\0\0\0isom', 'latin1')), box('moov', box('mvhd', Buffer.concat([t, Buffer.alloc(92)])))]);
  };

  it('dropping the same file again answers the item already there, wherever it is, and writes nothing', async () => {
    const bytes = await png(300, 200);
    expect(await upload({ file: { name: 'beach.png', bytes }, owner: 'shared', alt: 'A beach' })).toMatchObject({ ok: true, id: 'shared/beach' });
    expect(readDoc<{ fingerprint?: string }>('/content/media/shared/beach.json')!.value.fingerprint).toBe(sha(bytes));
    const again = await upload({ file: { name: 'beach again.png', bytes }, owner: 'library' });
    expect(again).toEqual({ ok: true, versions: {}, id: 'shared/beach', existing: true, origin: 'public', kind: 'image' });
    expect(existsSync(join(content, 'media/library'))).toBe(false);
    // a video file the same way
    const clip = mp4('2021-07-14');
    expect(await uploadVideo({ file: { name: 'clip.mp4', bytes: clip }, owner: 'library', title: 'A clip', width: 640, height: 360 })).toMatchObject({ ok: true, id: 'library/clip' });
    expect(await uploadVideo({ file: { name: 'other.mp4', bytes: clip }, owner: 'albums/trip', title: 'Again', width: 640, height: 360 })).toMatchObject({ ok: true, id: 'library/clip', existing: true, kind: 'video' });
    expect(existsSync(join(content, 'media/albums/trip'))).toBe(false);
  });

  it('a crop copy carries no fingerprint (it isn\u2019t the file as uploaded), and Replace takes the new file\u2019s', async () => {
    const first = await png(400, 300);
    await upload({ file: { name: 'cover.png', bytes: first }, owner: 'shared', alt: 'A cover' });
    const r = await cropMedia('shared/cover', { x: 0, y: 0, width: 200, height: 200 }, { copy: true });
    expect(r).toMatchObject({ ok: true });
    expect(readDoc(`/content/media/${r.id}.json`)!.value).not.toHaveProperty('fingerprint');
    const next = await png(500, 300);
    expect(await replaceMaster('shared/cover', next, { name: 'cover.png' })).toMatchObject({ ok: true });
    expect(readDoc<{ fingerprint?: string }>('/content/media/shared/cover.json')!.value.fingerprint).toBe(sha(next));
    // a new file another item was made from isn't fingerprinted twice (V55)
    const other = await png(600, 300);
    await upload({ file: { name: 'other.png', bytes: other }, owner: 'shared', alt: 'Other' });
    expect(await replaceMaster('shared/cover', other, { name: 'cover.png' })).toMatchObject({ ok: true });
    expect(readDoc('/content/media/shared/cover.json')!.value).not.toHaveProperty('fingerprint');
  });

  it('a picture for the library or an album may wait for its words; one for a page may not', async () => {
    expect(await upload({ file: { name: 'a.png', bytes: await png(30, 20) }, owner: 'library' })).toMatchObject({ ok: true, id: 'library/a' });
    expect(readDoc('/content/media/library/a.json')!.value).not.toHaveProperty('alt');
    expect(await upload({ file: { name: 'b.png', bytes: await png(31, 20) }, owner: 'albums/trip' })).toMatchObject({ ok: true, id: 'albums/trip/b' });
    expect(existsSync(join(content, 'media/albums/trip/b.webp'))).toBe(true);
    expect(await upload({ file: { name: 'c.png', bytes: await png(32, 20) }, owner: 'articles/a' })).toMatchObject({ ok: false, status: 422 });
    expect(await upload({ file: { name: 'd.png', bytes: await png(33, 20) }, owner: 'albums/Not An Id' })).toMatchObject({ ok: false, status: 422 });
  });

  it('reads the day an MP4 was made from its movie header, never a day after today', async () => {
    await uploadVideo({ file: { name: 'made.mp4', bytes: mp4('2021-07-14') }, owner: 'library', title: 'Made', width: 640, height: 360 });
    expect(readDoc<{ taken?: string; fingerprint?: string }>('/content/media/library/made.json')!.value).toMatchObject({ taken: '2021-07-14', fingerprint: sha(mp4('2021-07-14')) });
    // a v0 header holds 32 bits: 2039 is as far as it reaches
    await uploadVideo({ file: { name: 'later.mp4', bytes: mp4('2039-01-01') }, owner: 'library', title: 'Later', width: 640, height: 360 });
    expect(readDoc('/content/media/library/later.json')!.value).not.toHaveProperty('taken');
  });

  it('links a YouTube or Vimeo video as a library item with a poster of its own, asking the provider once', async () => {
    const get = vi.fn((u: string | URL | Request) => standInFetch(String(u))) as unknown as typeof fetch;
    const r = await addLinkedVideo({ url: 'https://youtu.be/dQw4w9WgXcQ' }, get);
    expect(r).toMatchObject({ ok: true, id: 'library/a-stand-in-video', existing: false, title: 'A stand-in video' });
    expect(readDoc('/content/media/library/a-stand-in-video.json')!.value).toEqual({ kind: 'embed', provider: 'youtube', id: 'dQw4w9WgXcQ', title: 'A stand-in video', shape: { width: 1280, height: 720 }, poster: { file: 'a-stand-in-video.poster.webp' }, visibility: 'public' });
    expect((await sharp(readFileSync(join(content, 'media/library/a-stand-in-video.poster.webp'))).metadata()).format).toBe('webp');
    const asked = (get as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => new URL(String(c[0])).hostname);
    expect(asked.every((h) => ['www.youtube.com', 'youtube.com', 'i.ytimg.com'].includes(h))).toBe(true);
    // the same video again, by another address: the item already there, nothing asked
    const calls = (get as unknown as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(await addLinkedVideo({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', album: 'trip' }, get)).toEqual({ ok: true, versions: {}, id: 'library/a-stand-in-video', existing: true, title: 'A stand-in video' });
    expect((get as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(calls);
    // a Vimeo one for an album goes in the album's folder, with its length
    expect(await addLinkedVideo({ url: 'https://vimeo.com/76979871', album: 'trip' }, get)).toMatchObject({ ok: true, id: 'albums/trip/a-stand-in-video', existing: false });
    expect(readDoc('/content/media/albums/trip/a-stand-in-video.json')!.value).toMatchObject({ provider: 'vimeo', id: '76979871', duration: 90 });
    // and a linked video is deleted with its poster
    expect(await deleteMedia('albums/trip/a-stand-in-video')).toMatchObject({ ok: true });
    for (const f of ['a-stand-in-video.json', 'a-stand-in-video.poster.webp']) expect(existsSync(join(content, 'media/albums/trip', f))).toBe(false);
  });

  it('refuses any other address, and a provider that fails, saying what to do and writing nothing', async () => {
    const get = vi.fn(standInFetch) as unknown as typeof fetch;
    for (const url of ['https://example.com/video.mp4', 'https://www.dailymotion.com/video/x7tgad0', 'not an address', '']) {
      expect(await addLinkedVideo({ url }, get)).toEqual({ ok: false, status: 422, issues: [{ file: 'content/media', path: 'url', message: ONLY_PROVIDERS }] });
    }
    expect((get as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
    expect(await addLinkedVideo({ url: 'https://youtu.be/dQw4w9WgXcQ', album: '../x' }, get)).toMatchObject({ ok: false, status: 422 });
    const down = (async () => new Response('', { status: 404 })) as unknown as typeof fetch;
    expect(JSON.stringify(await addLinkedVideo({ url: 'https://youtu.be/dQw4w9WgXcQ' }, down))).toMatch(/YouTube didn't answer for that video \(404\)/);
    expect(existsSync(join(content, 'media/library'))).toBe(false);
  });
});

describe("a picture's details, Replace and Delete", () => {
  const add = async () => (await upload({ file: { name: 'cover.png', bytes: await png(800, 600) }, owner: 'articles/a', alt: 'A cover' })) as { id: string };

  it('save its details (keeping its file), and refuse alt text that starts "image of"', async () => {
    const { id } = await add();
    const key = `/content/media/${id}.json`;
    const v = readDoc(key)!.version;
    expect(await saveSidecar(id, { kind: 'image', file: 'something-else.webp', alt: 'A cover', focus: '30% 40%', credit: 'Me', visibility: 'public' }, { [key]: v })).toMatchObject({ ok: true });
    expect(readDoc(key)?.value).toMatchObject({ file: 'cover.webp', focus: '30% 40%', credit: 'Me' });
    expect(await saveSidecar(id, { kind: 'image', file: 'cover.webp', alt: 'Image of a cover', visibility: 'public' }, { [key]: readDoc(key)!.version })).toMatchObject({ ok: false, status: 422 });
  });

  it('replace the master, keeping its ID and details', async () => {
    const { id } = await add();
    expect(await replaceMaster(id, await png(1000, 1000))).toMatchObject({ ok: true });
    expect((await sharp(readFileSync(join(content, 'media/articles/a/cover.webp'))).metadata()).width).toBe(1000);
    // its facts are the new master's
    expect(readDoc(`/content/media/${id}.json`)?.value).toMatchObject({ alt: 'A cover', facts: { width: 1000, height: 1000, bytes: readFileSync(join(content, 'media/articles/a/cover.webp')).length } });
  });

  it('replace a static master with a GIF (kept as it is) and back, without leaving its poster or old file behind', async () => {
    const { id } = await add();
    expect(await replaceMaster(id, animatedGif)).toMatchObject({ ok: true });
    expect(readDoc(`/content/media/${id}.json`)?.value).toMatchObject({ file: 'cover.gif', animation: { poster: 'cover.poster.webp' }, alt: 'A cover' });
    expect(readFileSync(join(content, 'media/articles/a/cover.gif')).equals(animatedGif)).toBe(true);
    expect(existsSync(join(content, 'media/articles/a/cover.webp'))).toBe(false);
    expect(existsSync(join(content, 'media/articles/a/cover.poster.webp'))).toBe(true);
    expect(await replaceMaster(id, await png(100, 100))).toMatchObject({ ok: true });
    expect(readDoc(`/content/media/${id}.json`)?.value).toMatchObject({ file: 'cover.webp' });
    expect(readDoc(`/content/media/${id}.json`)?.value).not.toHaveProperty('animation');
    expect(existsSync(join(content, 'media/articles/a/cover.gif'))).toBe(false);
    expect(existsSync(join(content, 'media/articles/a/cover.poster.webp'))).toBe(false);
  });

  it('delete a picture nothing uses, and refuse one an article uses (a draft included)', async () => {
    const { id } = await add();
    const used = (await upload({ file: { name: 'used.png', bytes: await png(200, 200) }, owner: 'shared', alt: 'Used' })) as { id: string };
    put('/content/articles/a.json', article({ hero: { media: used.id } }));
    const refused = await deleteMedia(used.id);
    expect(refused).toMatchObject({ ok: false, status: 422 });
    expect(existsSync(join(content, 'media/shared/used.webp'))).toBe(true);
    expect(await deleteMedia(id)).toMatchObject({ ok: true });
    expect(existsSync(join(content, 'media/articles/a/cover.webp'))).toBe(false);
    expect(existsSync(join(content, 'media/articles/a/cover.json'))).toBe(false);
  });

  it("refuse deleting the site's social image (the site settings refer to it)", async () => {
    const pic = (await upload({ file: { name: 'social.png', bytes: await png(1200, 630) }, owner: 'site', alt: 'The site' })) as { id: string };
    put('/content/site.json', { name: 'N', description: 'D', owner: 'p', locale: 'en', socialImage: pic.id });
    expect(await deleteMedia(pic.id)).toMatchObject({ ok: false, status: 422 });
  });
});

// ---------- publishing ----------
const run = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }).trim();
let remote: string;
const setupRepo = (withRemote = true) => {
  writeFileSync(join(dir, '.gitattributes'), 'content/**/*.json text eol=lf\n');
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src/code.ts'), 'export const x = 1;\n');
  run(dir, 'init', '-q', '-b', 'main');
  run(dir, 'config', 'user.email', 'test@example.com');
  run(dir, 'config', 'user.name', 'Test');
  run(dir, 'config', 'core.autocrlf', 'false');
  run(dir, 'add', '-A');
  run(dir, 'commit', '-q', '-m', 'first');
  if (!withRemote) return;
  remote = `${dir}-remote.git`;
  run(tmpdir(), 'init', '-q', '--bare', '-b', 'main', remote);
  run(dir, 'remote', 'add', 'origin', remote);
  run(dir, 'push', '-q', '-u', 'origin', 'main');
};
const removeRemote = () => remote && rmSync(remote, { recursive: true, force: true });

describe('publishing with git', { timeout: 60_000 }, () => {
  afterEach(removeRemote);

  it("lists what changed in content/ only (a new file too), and nothing that isn't content", async () => {
    setupRepo();
    put('/content/site.json', { name: 'New name', description: 'D', owner: 'p', locale: 'en' });
    put('/content/people/q.json', { id: 'q', name: 'Q' });
    writeFileSync(join(dir, 'src/code.ts'), 'export const x = 2;\n');
    const c = await changes();
    expect(c.files).toEqual([
      { key: '/content/people/q.json', status: 'added' },
      { key: '/content/site.json', status: 'changed' },
    ]);
    expect(c).toMatchObject({ branch: 'main', upstream: 'origin/main', ahead: 0, error: null });
    expect(pendingCount(c)).toBe(2);
  });

  it('counts everything that waits to be saved to remote: files, commits not pushed (either repository), a private commit not yet recorded', () => {
    const base = { files: [], head: null, branch: 'main', upstream: 'origin/main', ahead: 0, private: null, pointer: null, error: null };
    expect(pendingCount(base)).toBe(0);
    expect(pendingCount({ ...base, files: [{ key: '/content/site.json', status: 'changed' }] })).toBe(1);
    expect(pendingCount({ ...base, ahead: 2 })).toBe(2);
    expect(pendingCount({ ...base, private: { branch: 'main', upstream: 'origin/main', ahead: 1 } })).toBe(1);
    expect(pendingCount({ ...base, pointer: { path: 'private-pages', moved: true } })).toBe(1);
    expect(pendingCount({ ...base, pointer: { path: 'private-pages', moved: false } })).toBe(0);
  });

  it('reads JSON files as last committed in one batch, leaving out new files (documentation/editor/spec.md §7.2)', async () => {
    setupRepo();
    put('/content/site.json', { name: 'New name', description: 'D', owner: 'p', locale: 'en' });
    put('/content/people/q.json', { id: 'q', name: 'Q' });
    const before = await committedJson(['/content/site.json', '/content/people/q.json', '/content/media/x.webp']);
    expect([...before.keys()]).toEqual(['/content/site.json']);
    expect(before.get('/content/site.json')).toMatchObject({ name: expect.any(String) });
    expect((before.get('/content/site.json') as { name: string }).name).not.toBe('New name');
  });

  it("a git status it couldn't read is said, never taken for nothing changed, and nothing is saved", async () => {
    setupRepo();
    put('/content/site.json', { name: 'New name', description: 'D', owner: 'p', locale: 'en' });
    // a broken index: git status fails
    writeFileSync(join(dir, '.git', 'index'), 'not an index');
    const c = await changes();
    expect(c.error).toMatch(/git couldn't read what changed in content\//);
    expect(await publish('Content: the site settings')).toMatchObject({ ok: false, reason: expect.stringMatching(/couldn't read what changed/) });
  });

  it('commits content/ only, exactly as checked, pushes it, and leaves staged code staged', async () => {
    setupRepo();
    put('/content/site.json', { name: 'New name', description: 'D', owner: 'p', locale: 'en' });
    writeFileSync(join(dir, 'src/code.ts'), 'export const x = 2;\n');
    run(dir, 'add', 'src/code.ts');
    const r = await publish('Content: the site settings');
    expect(r).toMatchObject({ ok: true, pushed: true, files: 1 });
    expect(run(dir, 'show', '--name-only', '--format=%s', 'HEAD').split('\n')).toEqual(['Content: the site settings', '', 'content/site.json']);
    expect(run(dir, 'diff', '--cached', '--name-only')).toBe('src/code.ts');
    expect(run(dir, `--git-dir=${remote}`, 'log', '-1', '--format=%s', 'main')).toBe('Content: the site settings');
    expect((await changes()).files).toEqual([]);
  });

  it('refuses content with problems (and commits nothing), no message, nothing to publish, and a branch without an upstream', async () => {
    setupRepo();
    expect(await publish('x')).toMatchObject({ ok: false, reason: expect.stringMatching(/nothing to save/) });
    put('/content/articles/a.json', article({ summary: 'x'.repeat(300) }));
    const bad = await publish('Broken');
    expect(bad).toMatchObject({ ok: false, reason: expect.stringMatching(/problems/) });
    expect(bad.ok === false && bad.issues?.[0]).toMatchObject({ file: 'content/articles/a.json', path: 'summary' });
    expect(run(dir, 'log', '--format=%s')).toBe('first');
    expect(run(dir, 'diff', '--cached', '--name-only')).toBe('');
    put('/content/articles/a.json', article({ title: 'Fine' }));
    expect(await publish('   ')).toMatchObject({ ok: false, reason: expect.stringMatching(/message/) });
    run(dir, 'branch', '--unset-upstream');
    expect(await publish('Fine')).toMatchObject({ ok: false, reason: expect.stringMatching(/no upstream/) });
  });

  it('keeps the commit when the push fails, says why, counts it as not pushed, and pushes it again later', async () => {
    setupRepo();
    // someone else pushed first: the remote is ahead
    const other = `${dir}-other`;
    run(tmpdir(), 'clone', '-q', remote, other);
    run(other, 'config', 'user.email', 'o@example.com');
    run(other, 'config', 'user.name', 'O');
    writeFileSync(join(other, 'README.md'), 'hi\n');
    run(other, 'add', '-A');
    run(other, 'commit', '-q', '-m', 'elsewhere');
    run(other, 'push', '-q');
    put('/content/site.json', { name: 'Mine', description: 'D', owner: 'p', locale: 'en' });
    const r = await publish('Content: mine');
    expect(r).toMatchObject({ ok: true, pushed: false, pushError: expect.stringMatching(/newer commits/) });
    expect((await changes()).ahead).toBe(1);
    expect(await push()).toMatchObject({ ok: false });
    run(dir, 'pull', '-q', '--rebase');
    expect(await push()).toEqual({ ok: true });
    expect((await changes()).ahead).toBe(0);
    rmSync(other, { recursive: true, force: true });
  });

  it('discards: a changed file goes back as committed, a new picture (master and sidecar) goes together', async () => {
    setupRepo();
    put('/content/articles/a.json', article({ title: 'Changed' }));
    expect(await discard(['/content/articles/a.json'])).toMatchObject({ ok: true });
    expect(readDoc('/content/articles/a.json')?.value).toMatchObject({ title: 'A' });
    const pic = (await upload({ file: { name: 'new.png', bytes: await png(100, 100) }, owner: 'shared', alt: 'New' })) as { id: string };
    expect(await discard([`/content/media/${pic.id}.webp`, `/content/media/${pic.id}.json`])).toMatchObject({ ok: true });
    expect(existsSync(join(content, 'media/shared/new.webp'))).toBe(false);
    expect((await changes()).files).toEqual([]);
    expect(await discard(['/content/../src/code.ts'])).toMatchObject({ ok: false, status: 422 });
  });

  it('refuses to discard a picture something still uses (the check sees the whole result)', async () => {
    setupRepo();
    const pic = (await upload({ file: { name: 'used.png', bytes: await png(100, 100) }, owner: 'shared', alt: 'Used' })) as { id: string };
    put('/content/articles/a.json', article({ hero: { media: pic.id } }));
    expect(await discard([`/content/media/${pic.id}.webp`, `/content/media/${pic.id}.json`])).toMatchObject({ ok: false, status: 422 });
    expect(existsSync(join(content, 'media/shared/used.webp'))).toBe(true);
  });

  it('saves only the changes chosen: the rest stay waiting, and a later save takes them', async () => {
    setupRepo();
    put('/content/site.json', { name: 'New name', description: 'D', owner: 'p', locale: 'en' });
    put('/content/people/q.json', { id: 'q', name: 'Q' });
    put('/content/articles/a.json', article({ title: 'Changed' }));
    // a staged change left out stays staged, uncommitted
    run(dir, 'add', 'content/articles/a.json');
    const r = await publish('Content: the site settings', undefined, { keys: ['/content/site.json'] });
    expect(r).toMatchObject({ ok: true, pushed: true, files: 1 });
    expect(run(dir, 'show', '--name-only', '--format=%s', 'HEAD').split('\n')).toEqual(['Content: the site settings', '', 'content/site.json']);
    expect(run(dir, `--git-dir=${remote}`, 'log', '-1', '--format=%s', 'main')).toBe('Content: the site settings');
    expect((await changes()).files).toEqual([
      { key: '/content/articles/a.json', status: 'changed' },
      { key: '/content/people/q.json', status: 'added' },
    ]);
    expect(readDoc('/content/articles/a.json')?.value).toMatchObject({ title: 'Changed' });
    expect(await publish('The rest')).toMatchObject({ ok: true, files: 2 });
    expect((await changes()).files).toEqual([]);
  });

  it('saves a chosen deletion alone, and refuses a choice nothing waits for', async () => {
    setupRepo();
    put('/content/people/q.json', { id: 'q', name: 'Q' });
    run(dir, 'add', '-A');
    run(dir, 'commit', '-q', '-m', 'q');
    run(dir, 'push', '-q');
    rmSync(join(content, 'people/q.json'));
    put('/content/site.json', { name: 'New name', description: 'D', owner: 'p', locale: 'en' });
    expect(await publish('Gone', undefined, { keys: ['/content/people/zz.json'] })).toMatchObject({ ok: false, reason: expect.stringMatching(/none of the changes you chose/) });
    expect(await publish('People: Q goes', undefined, { keys: ['/content/people/q.json'] })).toMatchObject({ ok: true, files: 1 });
    expect(run(dir, 'show', '--name-status', '--format=%s', 'HEAD').split('\n')).toEqual(['People: Q goes', '', 'D\tcontent/people/q.json']);
    expect((await changes()).files).toEqual([{ key: '/content/site.json', status: 'changed' }]);
  });

  it("refuses a choice that needs a change left out (an article's new picture), and commits nothing", async () => {
    setupRepo();
    const pic = (await upload({ file: { name: 'new.png', bytes: await png(100, 100) }, owner: 'shared', alt: 'New' })) as { id: string };
    put('/content/articles/a.json', article({ hero: { media: pic.id } }));
    const r = await publish('Just the article', undefined, { keys: ['/content/articles/a.json'] });
    expect(r).toMatchObject({ ok: false, reason: expect.stringMatching(/don't stand on their own/) });
    expect(r.ok === false && r.issues?.length).toBeGreaterThan(0);
    expect(run(dir, 'log', '--format=%s')).toBe('first');
    expect(run(dir, 'diff', '--cached', '--name-only')).toBe('');
    // with its picture, it goes
    expect(await publish('The article and its picture', undefined, { keys: ['/content/articles/a.json', `/content/media/${pic.id}.webp`, `/content/media/${pic.id}.json`] })).toMatchObject({ ok: true, files: 3 });
  });
});

describe('the content a partial save commits', () => {
  it('puts back what is left out as last committed, and leaves out what is new', () => {
    const snap = {
      docs: { '/content/a.json': { v: 2 }, '/content/new.json': { v: 1 }, '/content/keep.json': { v: 1 } },
      masters: new Set(['/content/media/x/new.webp', '/content/media/x/old.webp']),
      errors: ['content/broken.json: not valid JSON (x)', 'content/keep.json: fine'],
    };
    const enc = (s: string) => new TextEncoder().encode(s);
    const out = asCommitted(snap, [
      { key: '/content/a.json', bytes: enc('\uFEFF{"v":1}') },
      { key: '/content/new.json', bytes: null },
      { key: '/content/media/x/new.webp', bytes: null },
      { key: '/content/broken.json', bytes: enc('{"v":0}') },
    ]);
    expect(out.docs).toEqual({ '/content/a.json': { v: 1 }, '/content/keep.json': { v: 1 }, '/content/broken.json': { v: 0 } });
    expect([...out.masters]).toEqual(['/content/media/x/old.webp']);
    expect(out.errors).toEqual(['content/keep.json: fine']);
    expect(snap.docs['/content/a.json']).toEqual({ v: 2 });
  });
});

describe('choosing what a save takes (documentation/editor/spec.md §7.1)', () => {
  const files = [{ key: '/content/a.json' }, { key: '/private/b.json' }];
  it('takes every change unless some are named, and only the named ones still waiting', () => {
    expect(chosenFiles(files)).toBe(files);
    expect(chosenFiles(files, ['/private/b.json', '/content/gone.json'])).toEqual([{ key: '/private/b.json' }]);
    expect(chosenFiles(files, [])).toEqual([]);
  });
  it('says what happens to the message when private pages go, from the ticked changes alone', () => {
    expect(privateNote(['/content/a.json'])).toBeNull();
    expect(privateNote(['/private/b.json'])).toMatch(/Only private pages changed/);
    expect(privateNote(['/private/b.json', '/content/a.json'])).toMatch(/Private pages changed too/);
  });
  it('names the button by how many go, and offers a message for the ticked rows', () => {
    expect(saveLabel(3, 3)).toBe('Save to remote');
    expect(saveLabel(0, 3)).toBe('Save to remote');
    expect(saveLabel(1, 3)).toBe('Save 1 of 3 to remote');
    expect(saveLabel(2, 3)).not.toMatch(/publish/i);
    expect(messageFor([])).toBe('');
    expect(messageFor([{ name: 'My article', keys: ['/content/articles/a.json'] }])).toMatch(/My article/);
  });
  it("ticks a page's own changes when opened from its editor: its file in either folder and its media", () => {
    const resources = [
      '/content/articles/a.json',
      '/private/articles/a.json',
      '/content/articles/ab.json',
      '/content/media/articles/a/hero',
      '/private/media/articles/a/sketch',
      '/content/media/articles/ab/hero',
      '/content/site.json',
    ];
    expect(pageScope(resources, 'a')).toEqual(['/content/articles/a.json', '/private/articles/a.json', '/content/media/articles/a/hero', '/private/media/articles/a/sketch']);
    expect(pageScope(['/content/site.json'], 'a')).toEqual([]);
    expect(pageOf('/_edit/articles/a/')).toBe('a');
    expect(pageOf('/atiya/_edit/articles/my-page')).toBe('my-page');
    expect(pageOf('/_edit/publish/')).toBeNull();
    expect(pageOf('/_edit/articles/')).toBeNull();
  });
});

// ---------- the integration ----------
describe('the dev integration', () => {
  const setup = (command: 'dev' | 'build' | 'preview') => {
    const calls = { routes: [] as string[], scripts: 0, middleware: 0, define: undefined as unknown };
    const hook = editor().hooks['astro:config:setup'] as unknown as (o: unknown) => void;
    hook({
      command,
      config: { root: pathToFileURL(`${ROOT}/`) },
      injectRoute: (r: { pattern: string }) => calls.routes.push(r.pattern),
      injectScript: () => calls.scripts++,
      addMiddleware: () => calls.middleware++,
      updateConfig: (c: { vite: { define: unknown } }) => (calls.define = c.vite.define),
      logger: { info: vi.fn() },
    });
    return calls;
  };
  const env = { CONTENT_ROOT: process.env.CONTENT_ROOT, PRIVATE_ROOT: process.env.PRIVATE_ROOT, SITE_EDITOR: process.env.SITE_EDITOR };
  beforeAll(() => {
    delete process.env.SITE_EDITOR;
  });
  afterAll(() => Object.assign(process.env, env));

  it('injects nothing for a build or a preview, and still points the build at the real content/ and private-pages/', () => {
    delete process.env.CONTENT_ROOT;
    delete process.env.PRIVATE_ROOT;
    for (const command of ['build', 'preview'] as const) {
      const c = setup(command);
      expect(c).toMatchObject({ routes: [], scripts: 0, middleware: 0 });
      const define = c.define as Record<string, string>;
      expect(define).toMatchObject({ __SITE_CONTENT_ROOT__: JSON.stringify(join(ROOT, 'content')), __SITE_PRIVATE_ROOT__: JSON.stringify(join(ROOT, 'private-pages')) });
      // the site's own name and features, from its content (documentation/desktop/plan.md, stage 4)
      expect(Object.keys(define).sort()).toEqual(['__GAME_RESIDENTS__', '__SITE_CONTENT_ROOT__', '__SITE_FEATURES__', '__SITE_NAME__', '__SITE_OVERLAY_ROOT__', '__SITE_PARENT_DOMAIN__', '__SITE_PRIVATE_ROOT__']);
      // the gallery fixture is a test build's alone (integrations/roots.mjs)
      expect(define.__SITE_OVERLAY_ROOT__).toBe('null');
      expect(JSON.parse(define.__SITE_NAME__)).toBe(JSON.parse(readFileSync(join(ROOT, 'content', 'site.json'), 'utf8')).name);
      expect(JSON.parse(define.__SITE_FEATURES__)).toMatchObject({ planet: true, managed: false, residents: true });
    expect(define.__GAME_RESIDENTS__).toBe('true');
    }
  });

  it('refuses CONTENT_ROOT or PRIVATE_ROOT in a build, so a build always reads the real folders', () => {
    process.env.CONTENT_ROOT = join(tmpdir(), 'elsewhere');
    expect(() => setup('build')).toThrow(/CONTENT_ROOT/);
    delete process.env.CONTENT_ROOT;
    process.env.PRIVATE_ROOT = join(tmpdir(), 'elsewhere');
    expect(() => setup('build')).toThrow(/PRIVATE_ROOT/);
    delete process.env.PRIVATE_ROOT;
  });

  it('injects the screens, the API, the guard and the launcher in dev, unless SITE_EDITOR is off', () => {
    delete process.env.CONTENT_ROOT;
    const c = setup('dev');
    expect(c.routes).toEqual(expect.arrayContaining(['/_edit', '/_edit/articles/[id]', '/_edit/media', '/_edit/publish', '/_edit/theme', '/_edit/api/[...path]']));
    // the launcher, and the themes panel's live draft (documentation/site-ui/theming.md §7)
    expect(c).toMatchObject({ scripts: 2, middleware: 1 });
    process.env.SITE_EDITOR = 'off';
    expect(setup('dev')).toMatchObject({ routes: [], scripts: 0, middleware: 0 });
    delete process.env.SITE_EDITOR;
  });
});
