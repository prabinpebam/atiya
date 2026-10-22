/**
 * The made-up album a test build and the editor's test server add to the real content as public content
 * (documentation/gallery/plan.md, G1 item 9; spec §20): tests/fixtures/gallery/content, read as an overlay by
 * a `--mode test` build only (integrations/roots.mjs, src/site/content/overlay.ts), its media made by
 * scripts/make-gallery-fixture.mjs.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { GALLERY_FIXTURE, overlayRootFor } from '../../integrations/roots.mjs';
import { mediaRootsFor, published, publishedFile } from '../../integrations/content-files.mjs';
import { addGalleryFixture } from '../../scripts/editor-test-server.mjs';
import { loadContent } from '../../src/site/content/load';
import { mergeOverlayStructure, overlayRole } from '../../src/site/content/overlay';
import { measureFacts } from '../../src/site/content/pictureFacts';
import { fileOf, MASTER_FILE, readSnapshot } from '../../src/site/content/source';
import { takenOf } from '../../src/site/editor/model/exif';
import { sanitizeSvg } from '../../src/site/editor/model/svgSanitize';

const ROOT = process.cwd();
const CONTENT = join(ROOT, 'content');
const FIXTURE = join(ROOT, GALLERY_FIXTURE);
const PRIVATE_FIXTURE = join(ROOT, 'tests', 'fixtures', 'private-pages');
const ALBUM = join(FIXTURE, 'media', 'articles', 'fixture-album');
const SCRATCH = join(ROOT, 'tests', 'fixtures', 'gallery', '.scratch-unit');

afterAll(() => rmSync(SCRATCH, { recursive: true, force: true }));

/** Runs `fn` as if Astro had been started with these arguments (and, as a build must be, without PRIVATE_ROOT). */
function withArgv<T>(args: string[], fn: () => T): T {
  const was = process.argv;
  const priv = process.env.PRIVATE_ROOT;
  process.argv = [was[0], 'astro', ...args];
  delete process.env.PRIVATE_ROOT;
  try {
    return fn();
  } finally {
    process.argv = was;
    if (priv !== undefined) process.env.PRIVATE_ROOT = priv;
  }
}

describe('when the overlay applies', () => {
  it('only to a build in test mode: never dev, never a production build', () => {
    expect(withArgv(['build', '--mode', 'test'], () => overlayRootFor(ROOT, 'build'))).toBe(FIXTURE);
    expect(withArgv(['build', '--mode=test'], () => overlayRootFor(ROOT, 'build'))).toBe(FIXTURE);
    expect(withArgv(['dev', '--mode', 'test'], () => overlayRootFor(ROOT, 'dev'))).toBeNull();
    expect(withArgv(['build'], () => overlayRootFor(ROOT, 'build'))).toBeNull();
    expect(withArgv(['build', '--mode', 'production'], () => overlayRootFor(ROOT, 'build'))).toBeNull();
  });

  it('reads articles, media and the structure; nothing else of the fixture', () => {
    expect(overlayRole('articles/fixture-album.json')).toBe('add');
    expect(overlayRole('media/articles/fixture-album/p01.webp')).toBe('add');
    expect(overlayRole('structures/site.json')).toBe('structure');
    for (const rel of ['site.json', 'people/fixture.json', 'structures/ways.json', 'recommendations.json']) expect(overlayRole(rel)).toBe('skip');
  });

  it('appends its pages to the real section of the same ID, and never changes the real structure', () => {
    const real = { home: { id: 'home', kind: 'hub', slug: '', children: [{ id: 'talks', kind: 'hub', slug: 'gallery', view: 'list', children: [{ id: 'a', kind: 'item' }] }] }, menus: { primary: [] } };
    const frozen = JSON.parse(JSON.stringify(real));
    const overlay = { home: { id: 'home', children: [{ id: 'talks', kind: 'hub', slug: 'x', view: 'albums', children: [{ id: 'a', kind: 'item' }, { id: 'b', kind: 'item' }] }, { id: 'new', kind: 'hub', slug: 'new', children: [] }] } };
    const merged = mergeOverlayStructure(real, overlay) as typeof real;
    expect(real).toEqual(frozen);
    expect(merged.menus).toEqual(real.menus);
    const talks = merged.home.children[0];
    expect(talks).toMatchObject({ id: 'talks', slug: 'gallery', view: 'list' });
    expect(talks.children.map((c) => c.id)).toEqual(['a', 'b']);
    expect(merged.home.children.map((c) => c.id)).toEqual(['talks', 'new']);
  });
});

describe('a test build reads the real content and the fixture album as one', () => {
  const snap = readSnapshot(CONTENT, PRIVATE_FIXTURE, FIXTURE);
  const c = loadContent(snap.docs, snap.masters, snap.errors, new Set(), snap.sizes);

  it('with no problem, the album placed in the Gallery section at /gallery/fixture-album/', () => {
    expect(snap.errors).toEqual([]);
    expect(c.articles.get('fixture-album')?.kind).toBe('gallery');
    const route = c.routes.find((r) => r.node.kind === 'item' && r.node.item.id === 'fixture-album');
    expect(route?.path).toBe('/gallery/fixture-album/');
    expect(route?.access).toBe('open');
    expect(c.media.get('articles/fixture-album/plan')?.master).toBe('/content/media/articles/fixture-album/plan.svg');
    expect(c.videos.get('articles/fixture-album/clip')?.captions).toHaveLength(1);
  });

  it('with its masters keyed as public content, sized, and found in the fixture', () => {
    expect(snap.masters.has('/content/media/articles/fixture-album/clip.en.vtt')).toBe(true);
    expect(snap.sizes?.get('/content/media/articles/fixture-album/plan.svg')).toBe(readFileSync(join(ALBUM, 'plan.svg')).length);
    expect(snap.sizes?.get('/content/media/articles/fixture-album/clip.mp4')).toBeGreaterThan(0);
    // the fixture's own site settings, people and ways are never read
    expect(snap.docs['/content/site.json']).toEqual(JSON.parse(readFileSync(join(CONTENT, 'site.json'), 'utf8')));
    expect(fileOf('/content/media/articles/fixture-album/p01.webp', CONTENT, PRIVATE_FIXTURE, FIXTURE)).toBe(join(ALBUM, 'p01.webp'));
    expect(fileOf('/content/site.json', CONTENT, PRIVATE_FIXTURE, FIXTURE)).toBe(join(CONTENT, 'site.json'));
    expect(fileOf('/content/media/articles/fixture-album/p01.webp', CONTENT, PRIVATE_FIXTURE, null)).toBe(join(CONTENT, 'media', 'articles', 'fixture-album', 'p01.webp'));
  });

  it('and without the overlay, the real content alone', () => {
    const real = readSnapshot(CONTENT, PRIVATE_FIXTURE, null);
    expect(Object.keys(real.docs).some((k) => k.includes('fixture-album'))).toBe(false);
    expect(Object.keys(snap.docs).length).toBeGreaterThan(Object.keys(real.docs).length);
  });

  it('refuses an overlay file that has the same key as a real one', () => {
    const real = readdirSync(join(CONTENT, 'articles')).find((f) => f.endsWith('.json'))!;
    mkdirSync(join(SCRATCH, 'overlay', 'articles'), { recursive: true });
    writeFileSync(join(SCRATCH, 'overlay', 'articles', real), '{}');
    const s = readSnapshot(CONTENT, null, join(SCRATCH, 'overlay'));
    expect(s.errors.join('\n')).toContain(`content/articles/${real}: in both the content and the test overlay`);
  });
});

describe("the fixture's media (scripts/make-gallery-fixture.mjs)", () => {
  const sidecars = readdirSync(ALBUM)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ name: f, doc: JSON.parse(readFileSync(join(ALBUM, f), 'utf8')) }));

  it('are every file their sidecars name, and the sidecars name every file', () => {
    const named = new Set<string>();
    for (const { name, doc } of sidecars) {
      named.add(name);
      for (const f of [doc.file, doc.dark?.file, doc.animation?.poster, doc.poster?.file, ...(doc.captions ?? []).map((x: { file: string }) => x.file)]) if (f) named.add(f);
    }
    expect(new Set(readdirSync(ALBUM))).toEqual(named);
    for (const f of named) if (!f.endsWith('.json')) expect(MASTER_FILE.test(f), f).toBe(true);
  });

  it("measure as their sidecars' facts say", async () => {
    for (const { name, doc } of sidecars.filter((s) => s.doc.kind === 'image')) {
      expect(await measureFacts(readFileSync(join(ALBUM, doc.file))), name).toEqual(doc.facts);
      if (doc.dark) expect(await measureFacts(readFileSync(join(ALBUM, doc.dark.file))), `${name} dark`).toEqual(doc.dark.facts);
    }
  });

  it('carry their dates, and the drawings pass the sanitizer untouched', () => {
    for (const { name, doc } of sidecars.filter((s) => s.doc.taken && /\.(webp|jpe?g)$/.test(s.doc.file))) expect(takenOf(readFileSync(join(ALBUM, doc.file))), name).toBe(doc.taken);
    for (const f of ['plan.svg', 'plan.dark.svg']) {
      const text = readFileSync(join(ALBUM, f), 'utf8');
      const r = sanitizeSvg(text);
      expect(r.ok && r.removed, f).toEqual([]);
      expect(r.ok && r.svg).toBe(text);
    }
  });

  it('give the upload tests pictures with and without dates, and one large', () => {
    const up = (f: string) => readFileSync(join(ROOT, 'tests', 'fixtures', 'gallery', 'uploads', f));
    expect(takenOf(up('taken-original.jpg'))).toBe('2026-03-21');
    expect(takenOf(up('taken-modified.jpg'))).toBe('2026-04-02');
    expect(takenOf(up('undated.jpg'))).toBeNull();
    expect(takenOf(up('large.jpg'))).toBe('2026-05-09');
  });
});

describe("a test build publishes the fixture's video and its captions", () => {
  it('beside the real content, and never in another build', () => {
    const roots = withArgv(['build', '--mode', 'test'], () => mediaRootsFor(ROOT, 'build', CONTENT));
    expect(roots.some((r) => r.root === join(FIXTURE, 'media'))).toBe(true);
    const files = published(roots).filter((p) => p.id === 'articles/fixture-album/clip');
    expect(files).toEqual([{ id: 'articles/fixture-album/clip', ext: 'mp4' }, { id: 'articles/fixture-album/clip', ext: 'en.vtt' }]);
    expect(publishedFile(roots, 'articles/fixture-album/clip', 'en.vtt')?.file).toBe(join(ALBUM, 'clip.en.vtt'));
    expect(publishedFile(roots, 'articles/fixture-album/clip', 'fr.vtt')).toBeNull();
    expect(publishedFile(roots, 'articles/fixture-album/p01', 'en.vtt')).toBeNull();
    const prod = withArgv(['build'], () => mediaRootsFor(ROOT, 'build', CONTENT));
    expect(prod.some((r) => r.root === join(FIXTURE, 'media'))).toBe(false);
  });
});

describe("the editor's test server adds the fixture to its copy of the content", () => {
  it('its articles and media copied in, its pages appended to the Gallery section', () => {
    const copy = join(SCRATCH, 'content');
    mkdirSync(join(copy, 'articles'), { recursive: true });
    mkdirSync(join(copy, 'media'), { recursive: true });
    cpSync(join(CONTENT, 'structures', 'site.json'), join(copy, 'structures', 'site.json'));
    addGalleryFixture(copy);
    expect(existsSync(join(copy, 'articles', 'fixture-album.json'))).toBe(true);
    expect(existsSync(join(copy, 'media', 'articles', 'fixture-album', 'clip.en.vtt'))).toBe(true);
    const site = JSON.parse(readFileSync(join(copy, 'structures', 'site.json'), 'utf8'));
    const talks = site.home.children.find((n: { id: string }) => n.id === 'talks');
    expect(talks.children.map((n: { id: string }) => n.id)).toContain('fixture-album');
    // a second time, it's already there: refused, never doubled
    expect(() => addGalleryFixture(copy)).toThrow(/in the content too/);
  });
});
