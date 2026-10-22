/**
 * The album block (documentation/gallery/spec.md §7.2, V51; plan G9): its band's heading level in the page's
 * outline, the editor's chooser of albums (never the page itself, never a private one, never a draft on a
 * published page, each said with why), and the refusals that keep a placed album shown: made private, back
 * to draft or deleted while a page shows it, refused with the pages' names, from edit mode's server.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { albumHeadingLevel } from '../../src/site/content/albumBlock';
import { ALBUM_WIDTHS, albumChoices, albumLifecycleRefusal, albumUnavailable, showingPages, titles, type AlbumFacts } from '../../src/site/editor/model/albumBlock';
import { albumRefusal, deleteArticle, saveArticle } from '../../src/site/editor/server/articles';
import { setPageAccess } from '../../src/site/editor/server/access';
import { jsonBytes, readDoc } from '../../src/site/editor/server/store';
import type { Block } from '../../src/site/content/schema';

const h = (level: 2 | 3 | 4): Block => ({ type: 'heading', level, text: 'H' });
const text: Block = { type: 'text', markdown: 'Words.' };
const album = (id = 'trip'): Block => ({ type: 'album', album: id });
const SCRATCH = join(__dirname, '../../test-results');

describe('the band’s heading level (§7.2: one below the heading it follows)', () => {
  it('is a heading 2 with no heading before it, under the page’s title', () => {
    expect(albumHeadingLevel([album()], 0)).toBe(2);
    expect(albumHeadingLevel([text, album()], 1)).toBe(2);
  });
  it('is one below the last heading before it, whatever comes between', () => {
    expect(albumHeadingLevel([h(2), text, album()], 2)).toBe(3);
    expect(albumHeadingLevel([h(2), h(3), text, album()], 3)).toBe(4);
    expect(albumHeadingLevel([h(4), album()], 1)).toBe(5);
    expect(albumHeadingLevel([h(3), album(), h(2)], 1)).toBe(4);
  });
});

describe('the chooser (V51’s three cases, each said)', () => {
  const ALBUMS: AlbumFacts[] = [
    { id: 'walks', title: 'Walks', published: true, private: false, items: 12 },
    { id: 'garden', title: 'Garden', published: false, private: false, items: 1 },
    { id: 'family', title: 'Family', published: true, private: true, items: 30 },
    { id: 'here', title: 'Here', published: true, private: false, items: 0 },
  ];

  it('never the page itself, never a private album, never a draft on a published page', () => {
    const page = { id: 'here', published: true };
    expect(albumUnavailable(ALBUMS[0]!, page)).toBeUndefined();
    expect(albumUnavailable(ALBUMS[1]!, page)).toMatch(/draft.*publish the album first/i);
    expect(albumUnavailable(ALBUMS[2]!, page)).toMatch(/^Private: .*seal/);
    expect(albumUnavailable(ALBUMS[3]!, page)).toMatch(/^This page: its album is already on it/);
  });

  it('a draft page can show a draft album; a private album stays out, whatever the page', () => {
    const page = { id: 'notes', published: false };
    expect(albumUnavailable(ALBUMS[1]!, page)).toBeUndefined();
    expect(albumUnavailable(ALBUMS[2]!, page)).toMatch(/^Private/);
  });

  it('lists every album by title, each disabled with its reason or with what it holds', () => {
    const list = albumChoices(ALBUMS, { id: 'here', published: true });
    expect(list.map((c) => c.id)).toEqual(['family', 'garden', 'here', 'walks']);
    expect(list.find((c) => c.id === 'walks')).toEqual({ id: 'walks', title: 'Walks', detail: '12 items, published', disabled: false });
    expect(list.filter((c) => c.disabled).map((c) => c.id)).toEqual(['family', 'garden', 'here']);
    expect(albumChoices([{ ...ALBUMS[1]!, items: 1 }], { id: 'x', published: false })[0]!.detail).toBe('1 item, a draft');
    expect(albumChoices([{ ...ALBUMS[0]!, items: 0 }], { id: 'x', published: false })[0]!.detail).toMatch(/^Empty/);
  });

  it('offers the band’s widths: wide and full, never in the column', () => {
    expect(ALBUM_WIDTHS.map((w) => w.value)).toEqual(['wide', 'full']);
  });
});

describe('a placed album’s lifecycle (§7.2: refused with the pages that show it)', () => {
  const pages = [
    { id: 'trip', title: 'The trip', published: true, body: [] as Block[] },
    { id: 'essay', title: 'An essay', published: true, body: [text, album('trip')] },
    { id: 'notes', title: 'Notes', published: false, body: [album('trip')] },
    { id: 'other', title: 'Other', published: true, body: [album('walks')] },
  ];

  it('finds the pages whose album block shows it', () => {
    expect(showingPages(pages, 'trip').map((p) => p.id)).toEqual(['essay', 'notes']);
    expect(showingPages(pages, 'none')).toEqual([]);
  });

  it('names one, two or more pages in words', () => {
    expect(titles([{ title: 'A' }])).toBe('"A"');
    expect(titles([{ title: 'A' }, { title: 'B' }])).toBe('"A" and "B"');
    expect(titles([{ title: 'A' }, { title: 'B' }, { title: 'C' }])).toBe('"A", "B" and "C"');
  });

  it('back to draft is refused while a published page shows it; private and delete while any page does', () => {
    const showing = showingPages(pages, 'trip');
    expect(albumLifecycleRefusal('draft', showing)).toMatch(/can't go back to a draft: "An essay" is published and shows it\. Take its album block out of it first/);
    expect(albumLifecycleRefusal('private', showing)).toMatch(/can't be made private: "An essay" and "Notes" show it/);
    expect(albumLifecycleRefusal('delete', showing)).toMatch(/can't be deleted: "An essay" and "Notes" show it\. Take its album block out of them first/);
    expect(albumLifecycleRefusal('draft', showing.filter((p) => !p.published))).toBeUndefined();
    expect(albumLifecycleRefusal('delete', [])).toBeUndefined();
  });
});

// ---------- edit mode's server: the refusals said from the album's own editor ----------
describe('edit mode’s server keeps a placed album shown', () => {
  let dir: string;
  let content: string;
  const saved = { content: process.env.CONTENT_ROOT, priv: process.env.PRIVATE_ROOT };
  const put = (key: string, value: unknown) => {
    const abs = join(content, ...key.replace(/^\/content\//, '').split('/'));
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, jsonBytes(value));
  };
  const page = (id: string, over: Record<string, unknown> = {}) => ({ id, type: 'article', kind: 'note', slug: id, title: id.toUpperCase(), summary: 'S', status: 'published', visibility: 'public', updatedAt: '2026-09-30', publishedAt: '2026-09-30', locale: 'en', body: [], ...over });
  const node = (id: string) => ({ id, kind: 'item', item: { type: 'article', id } });

  beforeEach(() => {
    // a scratch folder in the repository's gitignored test-results/, removed after each test
    mkdirSync(SCRATCH, { recursive: true });
    dir = mkdtempSync(join(SCRATCH, 'album-block-'));
    content = join(dir, 'content');
    process.env.CONTENT_ROOT = content;
    process.env.PRIVATE_ROOT = join(dir, 'private-pages');
    put('/content/site.json', { name: 'N', description: 'D', owner: 'p', locale: 'en' });
    put('/content/people/p.json', { id: 'p', name: 'P' });
    put('/content/structures/site.json', { home: { id: 'home', kind: 'hub', slug: '', title: 'Home', children: [{ id: 's', kind: 'hub', slug: 's', title: 'S', children: [node('trip'), node('essay'), node('spare')] }] } });
    put('/content/articles/trip.json', page('trip', { kind: 'gallery', title: 'The trip', album: { items: [] } }));
    put('/content/articles/spare.json', page('spare', { kind: 'gallery', title: 'Spare', status: 'draft', album: { items: [] } }));
    put('/content/articles/essay.json', page('essay', { title: 'An essay', body: [{ type: 'text', markdown: 'Words.' }, { type: 'album', album: 'trip' }] }));
  });
  afterEach(() => {
    for (const [k, v] of [['CONTENT_ROOT', saved.content], ['PRIVATE_ROOT', saved.priv]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    rmSync(dir, { recursive: true, force: true });
  });

  it('names the pages that show an album, and nothing for one no page shows or a page that isn’t an album', () => {
    expect(albumRefusal('trip', 'delete')).toMatch(/"An essay" shows it/);
    expect(albumRefusal('spare', 'delete')).toBeUndefined();
    expect(albumRefusal('essay', 'delete')).toBeUndefined();
  });

  it('refuses taking it back to draft, with the page, on its status', async () => {
    const key = '/content/articles/trip.json';
    const a = readDoc<Record<string, unknown>>(key)!;
    const r = await saveArticle({ id: 'trip', article: { ...a.value, status: 'draft' } as never, ifMatch: { [key]: a.version } });
    expect(r).toMatchObject({ ok: false, status: 422, issues: [{ file: 'content/articles/trip.json', path: 'status' }] });
    expect(r.ok ? '' : r.issues[0]!.message).toMatch(/can't go back to a draft: "An essay" is published and shows it/);
    expect(readDoc<{ status: string }>(key)!.value.status).toBe('published');
  });

  it('refuses making it private, with the page, on its access', async () => {
    const r = await setPageAccess('trip', 'private');
    expect(r).toMatchObject({ ok: false, status: 422, issues: [{ path: 'access' }] });
    expect(r.ok ? '' : r.issues[0]!.message).toMatch(/can't be made private: "An essay" shows it/);
  });

  it('refuses deleting a draft album a draft page shows, with the page', async () => {
    put('/content/articles/essay.json', page('essay', { title: 'An essay', status: 'draft', body: [{ type: 'album', album: 'spare' }] }));
    const r = await deleteArticle('spare', false, {});
    expect(r).toMatchObject({ ok: false, status: 422 });
    expect(r.ok ? '' : r.issues[0]!.message).toMatch(/can't be deleted: "An essay" shows it\. Take its album block out of it first/);
  });
});
