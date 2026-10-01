/**
 * Edit mode's server, against temporary folders (documentation/editor/plan.md §4): uploads through sharp
 * (WebP within the budgets, metadata stripped, the sidecar in the same transaction), a picture's details,
 * Replace and Delete; publishing with git against a temporary repository and a bare remote (only the
 * content folder is committed, staged code stays staged, a failed push is reported, Discard restores);
 * and the integration (nothing for a build, CONTENT_ROOT refused in one).
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { jsonBytes, readDoc } from '../../src/site/editor/server/store';
import { deleteArticle, saveArticle } from '../../src/site/editor/server/articles';
import { cropMedia, cropSource, deleteMedia, MAX_BYTES, MAX_SIDE, parseUploadCrop, replaceMaster, saveSidecar, upload } from '../../src/site/editor/server/media';
import { changes, discard, publish, push } from '../../src/site/editor/server/git';
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
const saved = process.env.CONTENT_ROOT;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'editor-server-'));
  content = join(dir, 'content');
  process.env.CONTENT_ROOT = content;
  seed();
});
afterEach(() => {
  if (saved === undefined) delete process.env.CONTENT_ROOT;
  else process.env.CONTENT_ROOT = saved;
  rmSync(dir, { recursive: true, force: true });
});

// ---------- a page's places, on the site and the planet, in one transaction (documentation/sections/spec.md §7.6) ----------
describe("a page's building", () => {
  const PLACES = ['workshop', 'town-hall', 'lighthouse', 'library', 'amphitheater', 'greenhouse', 'post-office'];
  const planet = () => JSON.parse(readFileSync(join(content, 'structures', 'planet.json'), 'utf8')) as { places: { id: string; pages: { id: string }[] }[] };
  const pagesOf = (id: string) => planet().places.find((p) => p.id === id)!.pages.map((r) => r.id);
  const seedPlanet = () => put('/content/structures/planet.json', { places: PLACES.map((id) => ({ id, title: id, kicker: 'K', summary: 'S', pages: [] })) });

  /** A save of the page as it is, with its version (as the editor sends it), and a change to its places. */
  const save = (over: { place?: string | null; section?: string | null }) => {
    const a = readDoc<Record<string, unknown>>('/content/articles/a.json')!;
    return saveArticle({ id: 'a', article: a.value as never, ifMatch: { '/content/articles/a.json': a.version }, ...over });
  };

  it('saves with the page, moves between buildings, and comes off', async () => {
    seedPlanet();
    expect(await save({ place: 'workshop' })).toMatchObject({ ok: true });
    expect(pagesOf('workshop')).toEqual(['a']);
    expect(await save({ place: 'library' })).toMatchObject({ ok: true });
    expect([pagesOf('workshop'), pagesOf('library')]).toEqual([[], ['a']]);
    expect(await save({ place: null })).toMatchObject({ ok: true });
    expect(pagesOf('library')).toEqual([]);
  });

  it('refuses a page on the planet without its page on the site (V13), and changes nothing', async () => {
    seedPlanet();
    const r = await save({ section: null, place: 'workshop' });
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).toMatch(/isn't on the site; a page on the planet needs its page on the site/);
    expect(pagesOf('workshop')).toEqual([]);
    expect(readFileSync(join(content, 'structures', 'site.json'), 'utf8')).toContain('"id": "a"');
    // an unknown building is refused before anything is written
    expect(await save({ place: 'castle' })).toMatchObject({ ok: false });
  });

  it('deleting a draft takes it off the planet in the same transaction', async () => {
    seedPlanet();
    await save({ place: 'greenhouse' });
    expect(pagesOf('greenhouse')).toEqual(['a']);
    expect(await deleteArticle('a', false, {})).toMatchObject({ ok: true });
    expect(pagesOf('greenhouse')).toEqual([]);
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
    expect(readDoc('/content/media/shared/my-photo.json')?.value).toEqual({ kind: 'image', file: 'my-photo.webp', alt: 'An orange field', visibility: 'public' });
  });

  it('keep transparency (lossless), never overwrite a name in use, and take decorative in place of alt text', async () => {
    const first = await upload({ file: { name: 'logo.png', bytes: await png(400, 300, true) }, owner: 'shared', decorative: true });
    const second = await upload({ file: { name: 'logo.png', bytes: await png(400, 300, true) }, owner: 'shared', decorative: true });
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
    expect(await upload({ file: { name: 'scan.tiff', bytes: tiff }, owner: 'shared', alt: 'T' })).toMatchObject({ ok: true });
    expect((await sharp(readFileSync(join(content, 'media/shared/scan.webp'))).metadata()).width).toBe(40);
  });

  it("read the form's crop only when it's a rectangle in a size", () => {
    expect(parseUploadCrop(JSON.stringify({ x: 1, y: 2, width: 3, height: 4, of: { width: 10, height: 10 } }))).toEqual({ x: 1, y: 2, width: 3, height: 4, of: { width: 10, height: 10 } });
    for (const bad of [null, '', 'nope', JSON.stringify({ x: 1, y: 2, width: 0, height: 4, of: { width: 10, height: 10 } }), JSON.stringify({ x: -1, y: 0, width: 3, height: 4, of: { width: 10, height: 10 } }), JSON.stringify({ x: 0, y: 0, width: 3, height: 4 })]) expect(parseUploadCrop(bad)).toBeNull();
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
    expect(readDoc('/content/media/articles/a/mark-21x9.json')?.value).toEqual({ kind: 'image', file: 'mark-21x9.webp', alt: 'The mark', credit: 'Me', visibility: 'public', crop: { from: id, x: 0, y: 69, width: 1024, height: 439 } });
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
    expect(readDoc(`/content/media/${id}.json`)?.value).toMatchObject({ alt: 'A cover' });
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
    expect(c).toMatchObject({ branch: 'main', upstream: 'origin/main', ahead: 0 });
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
    expect(await publish('x')).toMatchObject({ ok: false, reason: expect.stringMatching(/nothing to publish/) });
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
  const env = { CONTENT_ROOT: process.env.CONTENT_ROOT, SITE_EDITOR: process.env.SITE_EDITOR };
  beforeAll(() => {
    delete process.env.SITE_EDITOR;
  });
  afterAll(() => Object.assign(process.env, env));

  it('injects nothing for a build or a preview, and still points the build at the real content/', () => {
    delete process.env.CONTENT_ROOT;
    for (const command of ['build', 'preview'] as const) {
      const c = setup(command);
      expect(c).toMatchObject({ routes: [], scripts: 0, middleware: 0 });
      expect(c.define).toEqual({ __SITE_CONTENT_ROOT__: JSON.stringify(join(ROOT, 'content')) });
    }
  });

  it('refuses CONTENT_ROOT in a build, so a build always reads the real content', () => {
    process.env.CONTENT_ROOT = join(tmpdir(), 'elsewhere');
    expect(() => setup('build')).toThrow(/CONTENT_ROOT/);
  });

  it('injects the screens, the API, the guard and the launcher in dev, unless SITE_EDITOR is off', () => {
    delete process.env.CONTENT_ROOT;
    const c = setup('dev');
    expect(c.routes).toEqual(expect.arrayContaining(['/_edit', '/_edit/articles/[id]', '/_edit/media', '/_edit/publish', '/_edit/api/[...path]']));
    expect(c).toMatchObject({ scripts: 1, middleware: 1 });
    process.env.SITE_EDITOR = 'off';
    expect(setup('dev')).toMatchObject({ routes: [], scripts: 0, middleware: 0 });
    delete process.env.SITE_EDITOR;
  });
});
