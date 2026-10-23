/** Home highlights: immutable curation, public text-only choices, usage and checked/versioned fixture saves. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { loadContent } from '../../src/site/content/load';
import { addHighlight, excerptHighlight, highlightsView, highlightSource, HighlightEdits, HIGHLIGHT_MAX, HIGHLIGHT_REGIONS, moveHighlight, removeHighlight, type Highlights, type HighlightItem } from '../../src/site/editor/model/highlights';
import { liveRegions } from '../../src/site/editor/model/live';
import { regionsAsked, regionsHeader, wants } from '../../src/site/editor/model/regions';
import { references } from '../../src/site/editor/model/references';
import { editScreens } from '../../src/site/editor/model/find';
import { HIGHLIGHTS_KEY, saveHighlights } from '../../src/site/editor/server/highlights';
import { asTab, commit, jsonBytes, readDoc } from '../../src/site/editor/server/store';
import { contentState } from '../../src/site/content/source';

const base = (): Highlights => ({
  label: 'Highlights', enabled: true, peek: false, arrows: true, pager: 'dots',
  display: 'fill', background: false, rounded: true, shadow: false, items: [],
});
const ARTICLE = {
  id: 'a', type: 'article', kind: 'note', slug: 'a', title: 'A public page', summary: 'A short summary.',
  status: 'draft', visibility: 'public', updatedAt: '2026-10-24', locale: 'en',
  hero: { media: 'shared/page-lead' }, body: [{ type: 'text', markdown: 'A short passage from the page itself.' }],
};
const ALBUM = {
  id: 'trip', type: 'album', slug: 'trip', title: 'A public album', status: 'draft',
  createdAt: '2026-10-24', updatedAt: '2026-10-24',
  items: [{ id: 'one', media: 'shared/album-cover' }],
};
const picture = (file: string) => ({ kind: 'image', file, alt: 'A small fixture square', visibility: 'public' });
const docs = (): Record<string, unknown> => ({
  '/content/site.json': { name: 'Fixture site', description: 'Made-up fixture.', owner: 'p', locale: 'en' },
  '/content/people/p.json': { id: 'p', name: 'Fixture Person' },
  '/content/structures/site.json': { home: { id: 'home', kind: 'hub', slug: '', title: 'Home', children: [
    { id: 'section', kind: 'hub', slug: 'section', title: 'Section', children: [
      { id: 'page-node', kind: 'item', item: { type: 'article', id: 'a' } },
      { id: 'album-node', kind: 'item', item: { type: 'album', id: 'trip' } },
    ] },
  ] } },
  '/content/articles/a.json': ARTICLE,
  '/content/albums/trip.json': ALBUM,
  '/content/media/shared/page-lead.json': picture('page-lead.webp'),
  '/content/media/shared/album-cover.json': picture('album-cover.webp'),
  '/content/media/shared/picture.json': picture('picture.webp'),
});
const masters = new Set(['page-lead', 'album-cover', 'picture'].map((id) => `/content/media/shared/${id}.webp`));
const mixed: HighlightItem[] = [
  { id: 'github', type: 'custom', custom: 'github' },
  { id: 'page', type: 'article', article: 'a', text: 'A short passage from the page itself.' },
  { id: 'album', type: 'album', album: 'trip' },
  { id: 'image', type: 'image', media: 'shared/picture' },
];

describe('home highlights curation', () => {
  it('renders the form for both its own redraw and the generic whole-screen cross-tab refresh, but not chrome-only requests', () => {
    const redraws = [liveRegions('highlights', ['/content/highlights.json']), ['highlights']];
    for (const names of redraws) expect(wants(regionsAsked(regionsHeader(names)), ...HIGHLIGHT_REGIONS)).toBe(true);
    expect(wants(null, ...HIGHLIGHT_REGIONS)).toBe(true);
    expect(wants(regionsAsked(regionsHeader([])), ...HIGHLIGHT_REGIONS)).toBe(false);
  });

  it('keeps dirty input through cross-tab refreshes, conflicts and saves completing after newer typing', () => {
    const edits = new HighlightEdits();
    expect(edits.keep).toBe(false);
    edits.change();
    expect(edits.dirty).toBe(true);
    expect(edits.keep).toBe(true);
    const sent = edits.begin();
    edits.change();
    edits.saved(sent);
    edits.end();
    expect(edits.dirty).toBe(true);
    expect(edits.keep).toBe(true);
    edits.begin();
    edits.failed();
    edits.end();
    expect(edits.dirty).toBe(true);
    const retried = edits.begin();
    edits.saved(retried);
    expect(edits.dirty).toBe(false);
    expect(edits.keep).toBe(true);
    edits.end();
    expect(edits.keep).toBe(false);
    // Even a refused first save (with no edits yet) must not be redrawn away.
    const first = new HighlightEdits();
    first.begin();
    first.failed();
    first.end();
    expect(first.keep).toBe(true);
  });

  it('keeps IDs and references through add, order, remove and verbatim excerpt changes without mutating its input', () => {
    const initial = [mixed[0], mixed[1]];
    const withAlbum = addHighlight(initial, mixed[2], 'stable-album');
    expect(withAlbum.map((i) => i.id)).toEqual(['github', 'page', 'stable-album']);
    expect(initial).toEqual([mixed[0], mixed[1]]);
    const moved = moveHighlight(withAlbum, 'stable-album', -1);
    expect(moved.map((i) => i.id)).toEqual(['github', 'stable-album', 'page']);
    expect(moveHighlight(moved, 'github', -1)).toBe(moved);
    expect(moveHighlight(moved, 'page', 1)).toBe(moved);
    expect(moveHighlight(moved, 'missing', -1)).toBe(moved);
    expect(removeHighlight(moved, 'stable-album')).toEqual(initial);
    const excerpt = '  A short passage\nfrom the page itself.  ';
    expect(excerptHighlight(initial, 'page', excerpt)[1]).toMatchObject({ id: 'page', article: 'a', text: excerpt });
    expect(excerptHighlight(initial, 'page', '')[1]).not.toHaveProperty('text');
    expect(excerptHighlight(initial, 'github', excerpt)[0]).toEqual(mixed[0]);
  });

  it('refuses duplicate source/ID additions and a thirteenth slide', () => {
    expect(addHighlight(mixed, { ...mixed[0], id: 'other' }, 'other')).toBe(mixed);
    expect(addHighlight(mixed, { id: 'new', type: 'image', media: 'shared/new' }, 'github')).toBe(mixed);
    const full: HighlightItem[] = Array.from({ length: HIGHLIGHT_MAX }, (_, i) => ({ id: `slide-${i}`, type: 'image', media: `shared/image-${i}` }));
    expect(addHighlight(full, mixed[0], 'new')).toBe(full);
    expect(new Set(mixed.map(highlightSource)).size).toBe(4);
  });

  it('offers public sources only, including waiting draft pages/albums; absent config never invents picks', () => {
    const index = loadContent(docs(), masters);
    let view = highlightsView(index);
    expect(view.highlights.items).toEqual([]);
    expect(view.choices.some((c) => c.key === 'article:a' && c.reason)).toBe(true);
    expect(view.choices.some((c) => c.key === 'album:trip' && c.reason)).toBe(true);
    index.highlights = { ...base(), enabled: false, items: mixed };
    view = highlightsView(index);
    expect(view.details.page.title).toBe('Page: A public page');
    expect(view.details.page.reason).toMatch(/Publish/i);
    expect(view.details.github.reason).toMatch(/snapshot/i);
    expect(view.highlights.enabled).toBe(false);
    index.origins.set('a', 'private');
    index.origins.set('trip', 'private');
    index.media.get('shared/picture')!.origin = 'private';
    expect(highlightsView(index).choices.map((c) => c.key)).not.toContain('article:a');
    expect(highlightsView(index).choices.map((c) => c.key)).not.toContain('album:trip');
    expect(highlightsView(index).choices.map((c) => c.key)).not.toContain('image:shared/picture');
  });

  it('counts direct images, the current page lead and the current album cover as used even when hidden or waiting', () => {
    const index = loadContent(docs(), masters);
    index.highlights = { ...base(), enabled: false, items: mixed };
    const refs = references(index);
    for (const id of ['shared/page-lead', 'shared/album-cover', 'shared/picture']) {
      expect(refs.get(id)).toContainEqual({ label: 'Home highlights', href: 'highlights/' });
    }
    expect(editScreens({ planet: false, managed: true }).find((s) => s.id === 'highlights')).toMatchObject({ label: 'Home highlights', path: 'highlights/' });
  });
});

describe('home highlights through the versioned store', () => {
  let dir: string;
  let root: string;
  const saved = { CONTENT_ROOT: process.env.CONTENT_ROOT, PRIVATE_ROOT: process.env.PRIVATE_ROOT };
  const put = (key: string, value: unknown) => {
    const file = join(root, ...key.replace('/content/', '').split('/'));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, jsonBytes(value));
  };
  beforeEach(async () => {
    dir = join(process.cwd(), `.editor-highlights-unit-${randomUUID()}`);
    root = join(dir, 'content');
    process.env.CONTENT_ROOT = root;
    process.env.PRIVATE_ROOT = join(dir, 'private-pages');
    for (const [key, value] of Object.entries(docs())) put(key, value);
    const bytes = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#808080' } }).webp().toBuffer();
    for (const key of masters) writeFileSync(join(root, ...key.replace('/content/', '').split('/')), bytes);
  });
  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(dir, { recursive: true, force: true });
  });

  it('creates, reopens and changes every setting and all four kinds while preserving slide IDs and order', async () => {
    const next: Highlights = { ...base(), label: 'From the studio', enabled: false, peek: true, arrows: false, pager: 'filmstrip-wrap', display: 'tile', background: true, rounded: false, shadow: true, items: mixed };
    expect(await asTab('highlights-unit', () => saveHighlights(next, null))).toMatchObject({ ok: true });
    const first = readDoc<Highlights>(HIGHLIGHTS_KEY)!;
    expect(first.value).toEqual(next);
    for (const pager of ['dots', 'filmstrip', 'filmstrip-wrap'] as const) {
      const was = readDoc<Highlights>(HIGHLIGHTS_KEY)!;
      expect(await saveHighlights({ ...was.value, pager, display: 'actual', items: moveHighlight(was.value.items, 'image', -1) }, was.version)).toMatchObject({ ok: true });
    }
    expect(readDoc<Highlights>(HIGHLIGHTS_KEY)!.value.items.map((i) => i.id)).toEqual(['image', 'github', 'page', 'album']);
    const was = readDoc(HIGHLIGHTS_KEY)!;
    expect(await saveHighlights({ ...base(), enabled: false }, was.version)).toMatchObject({ ok: true });
    expect(readDoc<Highlights>(HIGHLIGHTS_KEY)!.value).toEqual({ ...base(), enabled: false });
  });

  it('returns 409 for stale or absent versions and never overwrites a newer save', async () => {
    expect(await saveHighlights(base(), null)).toMatchObject({ ok: true });
    const stale = readDoc<Highlights>(HIGHLIGHTS_KEY)!;
    expect(await saveHighlights({ ...base(), label: 'Other tab' }, stale.version)).toMatchObject({ ok: true });
    expect(await saveHighlights({ ...base(), label: 'My unsaved input' }, stale.version)).toMatchObject({ ok: false, status: 409 });
    expect(await saveHighlights({ ...base(), label: 'No version' }, null)).toMatchObject({ ok: false, status: 409 });
    expect(readDoc<Highlights>(HIGHLIGHTS_KEY)!.value.label).toBe('Other tab');
  });

  it('refuses malformed settings, duplicates, fabricated references and non-verbatim excerpts without writing bytes', async () => {
    expect(await saveHighlights({ ...base(), items: mixed }, null)).toMatchObject({ ok: true });
    const was = readDoc<Highlights>(HIGHLIGHTS_KEY)!;
    const bytes = readFileSync(join(root, 'highlights.json'), 'utf8');
    for (const next of [
      { ...base(), label: '' },
      { ...base(), html: '<script>alert(1)</script>' },
      { ...base(), items: [mixed[0], { ...mixed[0], id: 'duplicate' }] },
      { ...base(), items: [{ id: 'missing', type: 'image', media: 'shared/missing' }] },
      { ...base(), items: [{ id: 'missing', type: 'article', article: 'missing' }] },
      { ...base(), items: [{ ...mixed[1], text: 'Words that were never in this page.' }] },
      { ...base(), items: [{ ...mixed[1], text: 'x'.repeat(281) }] },
    ]) expect(await saveHighlights(next, was.version)).toMatchObject({ ok: false, status: 422 });
    expect(readFileSync(join(root, 'highlights.json'), 'utf8')).toBe(bytes);
  });

  it('the content transaction refuses deleting or privatizing a highlighted page, album or image', async () => {
    expect(await saveHighlights({ ...base(), items: mixed }, null)).toMatchObject({ ok: true });
    for (const key of ['/content/articles/a.json', '/content/albums/trip.json', '/content/media/shared/picture.json']) {
      const was = readDoc(key)!;
      const result = await commit({ changes: [{ key, bytes: null }], ifMatch: { [key]: was.version } });
      expect(result).toMatchObject({ ok: false, status: 422 });
      if (!result.ok) expect(result.issues.some((i) => i.file.includes('highlights.json'))).toBe(true);
      expect(readDoc(key)).not.toBeNull();
      const privateKey = key.replace('/content/', '/private/');
      const moved = await commit({
        changes: [{ key, bytes: null }, { key: privateKey, bytes: jsonBytes(was.value) }],
        ifMatch: { [key]: was.version, [privateKey]: null },
      });
      expect(moved).toMatchObject({ ok: false, status: 422 });
      if (!moved.ok) expect(moved.issues.some((i) => i.file.includes('highlights.json'))).toBe(true);
      expect(readDoc(key)).not.toBeNull();
      expect(readDoc(privateKey)).toBeNull();
    }
    const key = '/content/articles/a.json';
    const was = readDoc<typeof ARTICLE>(key)!;
    expect(await commit({ changes: [{ key, bytes: jsonBytes({ ...was.value, visibility: 'privateDiscussionOnly' }) }], ifMatch: { [key]: was.version } })).toMatchObject({ ok: false, status: 422 });
    const mediaKey = '/content/media/shared/picture.json';
    const media = readDoc<Record<string, unknown>>(mediaKey)!;
    expect(await commit({ changes: [{ key: mediaKey, bytes: jsonBytes({ ...media.value, visibility: 'notPublishable' }) }], ifMatch: { [mediaKey]: media.version } })).toMatchObject({ ok: false, status: 422 });
    expect(contentState().generation).toBeGreaterThan(0);
  });
});
