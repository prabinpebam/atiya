/** Home highlights: immutable curation, public text-only choices, usage and checked/versioned fixture saves. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { loadContent } from '../../src/site/content/load';
import { addHighlight, chosenKind, chosenSlide, chosenSource, excerptHighlight, fixPlace, freeChoices, highlightsView, highlightSource, HIGHLIGHT_MAX, HIGHLIGHT_REGIONS, kindLine, matchesSource, moveHighlight, removeHighlight, settingsLine, shownSources, SLIDE_KIND, slideIcon, slideLine, sourceCounts, sourcesLine, sourceFacts, sourceTiles, type HighlightChoice, type Highlights, type HighlightItem } from '../../src/site/editor/model/highlights';
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

  it('chooses the asked slide, else Add slide or the carousel settings as asked, else the first slide, else Add slide', () => {
    expect(chosenSlide(mixed, 'album')).toBe('album');
    expect(chosenSlide(mixed, 'settings')).toBe('settings');
    expect(chosenSlide(mixed, 'new')).toBe('new');
    expect(chosenSlide(mixed, 'gone')).toBe('github');
    expect(chosenSlide(mixed, null)).toBe('github');
    expect(chosenSlide([], null)).toBe('new');
  });

  it('names each slide by its kind and status, the settings row by what shows, and offers each source once', () => {
    expect(mixed.map(slideIcon)).toEqual(['github', 'article', 'gallery', 'image']);
    expect(slideLine(mixed[1])).toBe('Page · Ready to show');
    expect(slideLine(mixed[2], { reason: 'Publish it to show it.' })).toBe('Album · Waiting: Publish it to show it.');
    expect(settingsLine({ ...base(), items: mixed })).toBe('Shown · 4 slides · dots');
    expect(settingsLine({ ...base(), enabled: false, pager: 'filmstrip-wrap', items: [mixed[0]] })).toBe('Hidden · 1 slide · wrapping filmstrip');
    const choices = mixed.map((item) => ({ key: highlightSource(item), title: item.id, name: item.id, item }));
    expect(freeChoices(choices, [mixed[0], mixed[2]]).map((c) => c.item.id)).toEqual(['page', 'image']);
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
    // the picker, the list and the details name a kind with the same word (SLIDE_KIND)
    for (const c of view.choices) expect(c.title.startsWith(`${SLIDE_KIND[c.item.type].label}: `)).toBe(true);
    expect(view.choices.find((c) => c.key === 'custom:github')?.title).toMatch(/^Chart: /);
    expect(view.details.page.name).toBe('A public page');
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

describe('adding a slide: choosing by seeing (§2.1)', () => {
  const choice = (item: HighlightItem, name: string, extra: Partial<HighlightChoice> = {}): HighlightChoice => ({ key: highlightSource(item), title: name, name, item, ...extra });
  const choices: HighlightChoice[] = [
    choice({ id: 'x', type: 'image', media: 'shared/zebra' }, 'Zebra crossing', { media: 'shared/zebra' }),
    choice({ id: 'x', type: 'article', article: 'b' }, 'Building a café', { media: 'shared/b-lead' }),
    choice({ id: 'x', type: 'article', article: 'a' }, 'A draft page', { reason: 'Publish it to show it.' }),
    choice({ id: 'x', type: 'album', album: 'trip' }, 'A trip', { media: 'shared/cover' }),
    choice({ id: 'x', type: 'custom', custom: 'github' }, 'A year on GitHub'),
    choice({ id: 'x', type: 'image', media: 'shared/apple' }, 'Apple tree', { media: 'shared/apple' }),
  ];
  const slides: HighlightItem[] = [{ id: 's1', type: 'custom', custom: 'github' }, { id: 's2', type: 'image', media: 'shared/apple' }];

  it('orders ready sources first, then waiting ones, then those already slides; by kind, then by name', () => {
    const tiles = sourceTiles(choices, slides);
    expect(tiles.map((t) => t.name)).toEqual(['Building a café', 'A trip', 'Zebra crossing', 'A draft page', 'A year on GitHub', 'Apple tree']);
    expect(tiles.map((t) => t.status)).toEqual(['ready', 'ready', 'ready', 'waiting', 'added', 'added']);
    expect(tiles[0]).toMatchObject({ kind: 'page', icon: 'article', media: 'shared/b-lead', line: 'Page · Ready to show' });
    expect(tiles[3]).toMatchObject({ reason: 'Publish it to show it.', line: 'Page · Waiting: Publish it to show it.' });
    expect(tiles[4]).toMatchObject({ kind: 'chart', icon: 'github', slide: { id: 's1', place: 1 }, line: 'Chart · Already a slide' });
    expect(tiles[5]).toMatchObject({ slide: { id: 's2', place: 2 }, line: 'Picture · Already a slide' });
    expect(tiles[4]).not.toHaveProperty('media');
  });

  it('counts each kind and all, and reads the kind from the address, else all', () => {
    expect(sourceCounts(sourceTiles(choices, slides))).toEqual({ all: 6, chart: 1, page: 2, album: 1, picture: 2 });
    expect(chosenKind('album')).toBe('album');
    expect(chosenKind('custom')).toBe('all');
    expect(chosenKind(null)).toBe('all');
    expect(kindLine('all')).toMatch(/charts, pages, albums and pictures/);
    expect(kindLine('picture')).toBe(SLIDE_KIND.image.what);
  });

  it('finds by every word, in any order, ignoring case and accents, within the chosen kind', () => {
    expect(matchesSource('Building a café', 'CAFE build')).toBe(true);
    expect(matchesSource('Building a café', 'cafe tea')).toBe(false);
    expect(matchesSource('Anything', '   ')).toBe(true);
    const tiles = sourceTiles(choices, slides);
    expect(shownSources(tiles, 'picture', '').map((t) => t.name)).toEqual(['Zebra crossing', 'Apple tree']);
    expect(shownSources(tiles, 'all', 'tr a').map((t) => t.name)).toEqual(['A trip', 'Apple tree']);
  });

  it('says how many are shown, and what to try when none match', () => {
    expect(sourcesLine(6, 'all', '')).toBe('6 sources.');
    expect(sourcesLine(1, 'page', '')).toBe('1 page.');
    expect(sourcesLine(2, 'picture', 'tree')).toBe('2 pictures match “tree”.');
    expect(sourcesLine(0, 'album', 'zzz')).toBe('No album matches “zzz”. Try another name, or All.');
    expect(sourcesLine(0, 'all', 'zzz')).toBe('No source matches “zzz”. Try another name.');
    expect(sourcesLine(0, 'chart', '')).toBe('No charts to show yet.');
  });

  it('previews only a source that is offered and not already a slide', () => {
    expect(chosenSource(choices, slides, 'album:trip')?.name).toBe('A trip');
    expect(chosenSource(choices, slides, 'article:a')?.reason).toMatch(/Publish/);
    expect(chosenSource(choices, slides, 'custom:github')).toBeNull();
    expect(chosenSource(choices, slides, 'article:gone')).toBeNull();
    expect(chosenSource(choices, slides, null)).toBeNull();
  });

  it('points a waiting source to the screen that puts it right; a chart has none', () => {
    expect(fixPlace({ id: 'x', type: 'article', article: 'a' })).toEqual({ path: 'articles/a/', label: 'Edit page' });
    expect(fixPlace({ id: 'x', type: 'album', album: 'trip' })).toEqual({ path: 'albums/trip/', label: 'Edit album' });
    expect(fixPlace({ id: 'x', type: 'image', media: 'shared/a b' })).toEqual({ path: 'media/?id=shared%2Fa%20b', label: 'Edit picture' });
    expect(fixPlace({ id: 'x', type: 'custom', custom: 'github' })).toBeNull();
  });

  it('lists what each kind of slide would use: where it leads, its words, its picture and its place', () => {
    const detail = (f: { term: string; detail: string }[]) => Object.fromEntries(f.map((x) => [x.term, x.detail]));
    expect(detail(sourceFacts({ id: 'x', type: 'article', article: 'a' }, { text: 'Sum', href: '/work/a/', media: 'm' }, 3))).toEqual({
      Kind: 'Page', Opens: 'The page at /work/a/', Words: 'Its title, and its summary or the excerpt below', Picture: 'Its lead picture', Place: 'Slide 3, at the end',
    });
    expect(detail(sourceFacts({ id: 'x', type: 'album', album: 't' }, {}, 1))).toMatchObject({ Opens: "The album, once it's placed in a section", Words: 'Its title (it has no summary)', Picture: 'None yet: choose a cover', Place: 'Slide 1' });
    expect(detail(sourceFacts({ id: 'x', type: 'image', media: 'm' }, { caption: 'At dusk' }, 2))).toMatchObject({ Opens: 'The picture full size', Words: 'Its caption: At dusk', Picture: 'This picture' });
    expect(detail(sourceFacts({ id: 'x', type: 'custom', custom: 'github' }, {}, 2)).Picture).toBe('None: the chart draws itself');
  });
  it('gives every offered source its name and, where it has one, the picture its slide shows', () => {
    const view = highlightsView(loadContent(docs(), masters));
    expect(view.choices.find((c) => c.key === 'article:a')).toMatchObject({ name: 'A public page', media: 'shared/page-lead' });
    expect(view.choices.find((c) => c.key === 'album:trip')).toMatchObject({ name: 'A public album', media: 'shared/album-cover' });
    expect(view.choices.find((c) => c.key === 'custom:github')).not.toHaveProperty('media');
  });
});
