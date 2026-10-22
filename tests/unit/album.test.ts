import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/site/content/load';
import {
  PRESET_IDS,
  albumCounts,
  albumDates,
  albumProblems,
  albumWarnings,
  applyPreset,
  cardPicture,
  countWords,
  dateSpan,
  defaultShowcase,
  displayFor,
  holes,
  itemKind,
  keepPhoneInStep,
  overlaps,
  phoneOf,
  phoneProblems,
  phoneTiles,
  playProblems,
  presetRects,
  readingOrder,
  resolveAlbum,
  rowsOf,
  tileProblems,
  type AlbumMedia,
  type MediaLookup,
  type Rect,
} from '../../src/site/content/album';
import { GRID_COLUMNS, GRID_ROWS_MAX, PHONE_COLUMNS, PHONE_TILE_H_MAX, album as albumSchema, type Album, type AlbumItem, type AlbumTile } from '../../src/site/content/schema';

const MB = 1024 * 1024;
const MEDIA: Record<string, AlbumMedia> = {
  'a/photo': { kind: 'image', file: 'photo.webp', alt: 'A photo', facts: { width: 3000, height: 2000, bytes: 400_000 }, taken: '2026-03-12' },
  'a/tall': { kind: 'image', file: 'tall.webp', alt: 'A tall photo', facts: { width: 1000, height: 2000, bytes: 300_000 }, taken: '2026-05-02' },
  'a/gif': { kind: 'image', file: 'gif.gif', alt: 'A loop', animation: { poster: 'gif.poster.webp' }, facts: { width: 800, height: 600, bytes: 5 * MB } },
  'a/huge-gif': { kind: 'image', file: 'huge-gif.gif', alt: 'A long loop', animation: { poster: 'huge-gif.poster.webp' }, facts: { width: 800, height: 600, bytes: 12 * MB } },
  'a/plan': { kind: 'image', file: 'plan.svg', alt: 'A floor plan', facts: { width: 1200, height: 800, bytes: 20_000 } },
  'a/clip': { kind: 'video', file: 'clip.mp4', width: 1920, height: 1080, captions: [{}], bytes: 3 * MB },
  'a/mute': { kind: 'video', file: 'mute.mp4', width: 1080, height: 1920 },
  'a/bare': { kind: 'image', file: 'bare.webp', decorative: true },
};
const lookup: MediaLookup = (id) => MEDIA[id];
const item = (id: string, media: string, extra: Partial<AlbumItem> = {}): AlbumItem => ({ id, media, ...extra });
const embed = (id: string): AlbumItem => ({ id, embed: { provider: 'youtube', id: 'dQw4w9WgXcQ' }, title: 'A talk', poster: 'a/photo' });
const tile = (it: string, x: number, y: number, w: number, h: number, extra: Partial<AlbumTile> = {}): AlbumTile => ({ item: it, x, y, w, h, ...extra });

/** A seeded random number generator (mulberry32), so a failing case can be found again. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const between = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));

/** A random valid band: tiles dropped where they fit, never overlapping, 1 to 12 of them. */
function randomBand(r: () => number): AlbumTile[] {
  const tiles: AlbumTile[] = [];
  for (let tries = 0; tries < 200 && tiles.length < 12; tries++) {
    const w = between(r, 2, 12);
    const h = between(r, 2, 12);
    const x = between(r, 0, GRID_COLUMNS - w);
    const y = between(r, 0, GRID_ROWS_MAX - h);
    const t = tile(`i${tiles.length}`, x, y, w, h, r() < 0.15 ? { onPhones: false } : {});
    if (!tiles.some((o) => overlaps(o, t))) tiles.push(t);
  }
  return tiles;
}

const inGrid = (rects: Rect[], columns: number) => rects.every((t) => t.x >= 0 && t.y >= 0 && t.x + t.w <= columns && t.w >= 2 && t.h >= 2);
const noOverlap = (rects: Rect[]) => rects.every((a, i) => rects.every((b, j) => i === j || !overlaps(a, b)));

describe('kinds and display', () => {
  it('knows each kind of item', () => {
    expect(itemKind(item('p', 'a/photo'), lookup)).toBe('picture');
    expect(itemKind(item('g', 'a/gif'), lookup)).toBe('animated');
    expect(itemKind(item('d', 'a/plan'), lookup)).toBe('drawing');
    expect(itemKind(item('v', 'a/clip'), lookup)).toBe('video');
    expect(itemKind(embed('e'), lookup)).toBe('embed');
    expect(itemKind(item('x', 'a/none'), lookup)).toBeUndefined();
  });
  it('fills a tile by default and fits a drawing', () => {
    expect(displayFor({}, 'picture')).toBe('fill');
    expect(displayFor({}, 'drawing')).toBe('fit');
    expect(displayFor({ display: 'fill' }, 'drawing')).toBe('fill');
    expect(displayFor({ display: 'fit' }, 'video')).toBe('fit');
  });
  it('reads tiles by row, then by column', () => {
    const order = readingOrder([tile('c', 0, 6, 12, 2), tile('b', 6, 0, 6, 3), tile('a', 0, 0, 6, 6), tile('d', 6, 3, 6, 3)]);
    expect(order.map((t) => t.item)).toEqual(['a', 'b', 'd', 'c']);
  });
});

describe('counts and dates', () => {
  it('counts animated pictures as pictures and embeds as videos', () => {
    const items = [item('p', 'a/photo'), item('t', 'a/tall'), item('g', 'a/gif'), item('d', 'a/plan'), item('v', 'a/clip'), embed('e'), item('x', 'a/none')];
    expect(albumCounts(items, lookup)).toEqual({ pictures: 3, videos: 2, drawings: 1 });
    expect(countWords(albumCounts(items, lookup))).toBe('3 pictures, 2 videos, 1 drawing');
  });
  it('says only the kinds there are, in the singular for one', () => {
    expect(countWords({ pictures: 18, videos: 2, drawings: 0 })).toBe('18 pictures, 2 videos');
    expect(countWords({ pictures: 0, videos: 0, drawings: 1 })).toBe('1 drawing');
    expect(countWords({ pictures: 1, videos: 1, drawings: 2 })).toBe('1 picture, 1 video, 2 drawings');
    expect(countWords({ pictures: 0, videos: 0, drawings: 0 })).toBe('');
  });
  it('says the span of the dates in words', () => {
    expect(dateSpan([])).toBeUndefined();
    expect(dateSpan(['2026-03-12'])).toBe('12 March 2026');
    expect(dateSpan(['2026-03-12', '2026-03-12'])).toBe('12 March 2026');
    expect(dateSpan(['2026-03-20', '2026-03-12'])).toBe('12 to 20 March 2026');
    expect(dateSpan(['2026-05-02', '2026-03-12', '2026-04-01'])).toBe('March to May 2026');
    expect(dateSpan(['2024-01-01', '2019-07-04'])).toBe('2019 to 2024');
  });
  it("reads the items' dates unless the album hides them", () => {
    const items = [item('p', 'a/photo'), item('t', 'a/tall'), item('g', 'a/gif'), embed('e')];
    expect(albumDates({ items }, lookup)).toEqual(['2026-03-12', '2026-05-02']);
    expect(albumDates({ items, dates: false }, lookup)).toEqual([]);
  });
});

describe('presets and the default', () => {
  it('lays out each preset as the spec draws it', () => {
    expect(presetRects('single', 1)).toEqual([{ x: 0, y: 0, w: 12, h: 6 }]);
    expect(presetRects('lead-two', 3)).toEqual([
      { x: 0, y: 0, w: 8, h: 6 },
      { x: 8, y: 0, w: 4, h: 3 },
      { x: 8, y: 3, w: 4, h: 3 },
    ]);
    expect(presetRects('lead-four', 5)).toEqual([
      { x: 0, y: 0, w: 6, h: 4 },
      { x: 6, y: 0, w: 3, h: 2 },
      { x: 9, y: 0, w: 3, h: 2 },
      { x: 6, y: 2, w: 3, h: 2 },
      { x: 9, y: 2, w: 3, h: 2 },
    ]);
    expect(presetRects('pairs', 3)).toEqual([
      { x: 0, y: 0, w: 6, h: 4 },
      { x: 6, y: 0, w: 6, h: 4 },
      { x: 0, y: 4, w: 12, h: 6 },
    ]);
    expect(presetRects('even-rows', 5)).toEqual([
      { x: 0, y: 0, w: 4, h: 3 },
      { x: 4, y: 0, w: 4, h: 3 },
      { x: 8, y: 0, w: 4, h: 3 },
      { x: 0, y: 3, w: 6, h: 3 },
      { x: 6, y: 3, w: 6, h: 3 },
    ]);
  });
  it("fits pictures to their shapes, each row ending at the grid's edge", () => {
    const rects = presetRects('fit', 3, [1.5, 0.5, 1.5]);
    expect(rects).toEqual([
      { x: 0, y: 0, w: 6, h: 4 },
      { x: 6, y: 0, w: 6, h: 4 },
      { x: 0, y: 4, w: 12, h: 4 },
    ]);
  });
  it('puts every preset within 12 rows, inside the grid, with no overlap and no hole, for 1 to 12 tiles', () => {
    const r = rng(7);
    for (const preset of PRESET_IDS)
      for (let n = 1; n <= 12; n++) {
        const aspects = Array.from({ length: n }, () => (r() < 0.2 ? undefined : 0.4 + r() * 2.6));
        const rects = presetRects(preset, n, aspects);
        expect(rects, `${preset} ${n}`).toHaveLength(n);
        expect(rowsOf(rects), `${preset} ${n}`).toBeLessThanOrEqual(GRID_ROWS_MAX);
        expect(inGrid(rects, GRID_COLUMNS), `${preset} ${n}`).toBe(true);
        expect(noOverlap(rects), `${preset} ${n}`).toBe(true);
        expect(holes(rects), `${preset} ${n}`).toEqual([]);
        // and each is a valid showcase
        const items = rects.map((_, i) => ({ id: `i${i}`, media: 'a/photo' }));
        expect(albumSchema.safeParse({ items, showcase: { tiles: rects.map((t, i) => ({ item: `i${i}`, ...t })) } }).success, `${preset} ${n}`).toBe(true);
      }
  });
  it('keeps the tiles, their order and their settings when a preset is applied', () => {
    const tiles = [tile('b', 6, 0, 6, 6, { play: true }), tile('a', 0, 0, 6, 6, { display: 'fit', onPhones: false })];
    const out = applyPreset('lead-two', tiles);
    expect(out).toEqual([
      { item: 'a', x: 0, y: 0, w: 8, h: 6, display: 'fit', onPhones: false },
      { item: 'b', x: 8, y: 0, w: 4, h: 6, play: true },
    ]);
  });
  it('works out the default from the number of items', () => {
    const items = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `i${i}` }));
    expect(defaultShowcase(items(0))).toEqual([]);
    expect(defaultShowcase(items(1))).toEqual([tile('i0', 0, 0, 12, 6)]);
    expect(defaultShowcase(items(2)).map((t) => [t.w, t.h])).toEqual([[6, 4], [6, 4]]);
    expect(defaultShowcase(items(3)).map((t) => [t.w, t.h])).toEqual([[8, 6], [4, 3], [4, 3]]);
    expect(defaultShowcase(items(4)).map((t) => [t.w, t.h])).toEqual([[6, 4], [6, 4], [6, 4], [6, 4]]);
    for (const n of [5, 6, 21, 200]) {
      const d = defaultShowcase(items(n));
      expect(d.map((t) => t.item)).toEqual(['i0', 'i1', 'i2', 'i3', 'i4']);
      expect(d[0]).toEqual(tile('i0', 0, 0, 6, 4));
    }
  });
});

describe('the band on a phone', () => {
  it('makes wide tiles full width, pairs the rest in halves and widens a lone half', () => {
    const band = [tile('lead', 0, 0, 8, 6), tile('b', 8, 0, 4, 3), tile('c', 8, 3, 4, 3), tile('d', 0, 6, 4, 3)];
    expect(phoneTiles(band)).toEqual([
      { item: 'lead', x: 0, y: 0, w: 6, h: 5 },
      { item: 'b', x: 0, y: 5, w: 3, h: 2 },
      { item: 'c', x: 3, y: 5, w: 3, h: 2 },
      { item: 'd', x: 0, y: 7, w: 6, h: 4 },
    ]);
  });
  it('pairs halves with the taller height, and leaves out a tile hidden on phones', () => {
    const band = [tile('a', 0, 0, 4, 2), tile('b', 4, 0, 4, 6), tile('hidden', 8, 0, 4, 6, { onPhones: false })];
    expect(phoneTiles(band)).toEqual([
      { item: 'a', x: 0, y: 0, w: 3, h: 5 },
      { item: 'b', x: 3, y: 0, w: 3, h: 5 },
    ]);
  });
  it('never overlaps, stays inside 6 columns and 2 to 8 rows a tile, and names every tile shown (300 random bands)', () => {
    const r = rng(42);
    for (let n = 0; n < 300; n++) {
      const band = randomBand(r);
      const phone = phoneTiles(band);
      expect(noOverlap(phone)).toBe(true);
      expect(inGrid(phone, PHONE_COLUMNS)).toBe(true);
      expect(phone.every((t) => t.h <= PHONE_TILE_H_MAX)).toBe(true);
      expect(phone.map((t) => t.item).sort()).toEqual(band.filter((t) => t.onPhones !== false).map((t) => t.item).sort());
      expect(holes(phone, PHONE_COLUMNS)).toEqual([]);
    }
  });
  it("keeps the owner's phone arrangement in step with the band", () => {
    const band = [tile('a', 0, 0, 6, 4), tile('b', 6, 0, 6, 4), tile('c', 0, 4, 12, 4)];
    const own = [
      { item: 'c', x: 0, y: 0, w: 6, h: 3 },
      { item: 'a', x: 0, y: 3, w: 3, h: 3 },
      { item: 'b', x: 3, y: 3, w: 3, h: 3 },
    ];
    // b taken out: it leaves; the rest stay where he put them
    expect(keepPhoneInStep(own, [band[0], band[2]])).toEqual([own[0], own[1]]);
    // d added: it goes at the end, by the rule
    expect(keepPhoneInStep(own, [...band, tile('d', 0, 8, 12, 4)])).toEqual([...own, { item: 'd', x: 0, y: 6, w: 6, h: 2 }]);
    // b hidden on phones: it leaves
    expect(keepPhoneInStep(own, [band[0], { ...band[1], onPhones: false }, band[2]]).map((t) => t.item)).toEqual(['c', 'a']);
  });
  it("uses the owner's arrangement when there is one, else the rule's", () => {
    const tiles = [tile('a', 0, 0, 12, 6)];
    expect(phoneOf({ items: [item('a', 'a/photo')], showcase: { tiles } })).toEqual(phoneTiles(tiles));
    const phone = [{ item: 'a', x: 0, y: 0, w: 6, h: 8 }];
    expect(phoneOf({ items: [item('a', 'a/photo')], showcase: { tiles, phone: { tiles: phone } } })).toEqual(phone);
  });
});

describe('the card picture', () => {
  const items = [item('d', 'a/plan'), item('v', 'a/clip'), item('t', 'a/tall'), item('p', 'a/photo')];
  it("is the page's thumbnail when it has one", () => {
    expect(cardPicture({ thumbnail: 'a/gif', album: { items } }, lookup)).toBe('a/gif');
  });
  it('is the first raster picture up front, in reading order', () => {
    const album: Album = { items, showcase: { tiles: [tile('d', 0, 0, 6, 4), tile('p', 6, 2, 6, 2), tile('t', 6, 0, 6, 2)] } };
    expect(cardPicture({ album }, lookup)).toBe('a/tall');
  });
  it('is the first raster item when nothing up front is one, and nothing without one', () => {
    expect(cardPicture({ album: { items, showcase: { tiles: [tile('d', 0, 0, 12, 6)] } } }, lookup)).toBe('a/tall');
    expect(cardPicture({ album: { items: [item('d', 'a/plan'), embed('e')] } }, lookup)).toBeUndefined();
    expect(cardPicture({}, lookup)).toBeUndefined();
  });
});

describe('the checks', () => {
  const base: Album = { items: [item('p', 'a/photo'), item('t', 'a/tall'), item('g', 'a/gif'), item('v', 'a/clip'), item('d', 'a/plan')] };
  const msgs = (issues: { message: string }[]) => issues.map((i) => i.message).join('\n');

  it('passes a good album', () => {
    const album: Album = { ...base, showcase: { tiles: [tile('p', 0, 0, 6, 4, { focus: '30% 40%' }), tile('v', 6, 0, 6, 4, { play: true }), tile('g', 0, 4, 12, 4, { play: true })] } };
    expect(albumProblems(album, lookup, { published: true })).toEqual([]);
  });
  it('V38: a published album has items, unique IDs, and pictures with alt text', () => {
    expect(msgs(albumProblems({ items: [] }, lookup, { published: true }))).toMatch(/V38/);
    expect(albumProblems({ items: [] }, lookup, { published: false })).toEqual([]);
    expect(msgs(albumProblems({ items: [item('p', 'a/photo'), item('p', 'a/tall')] }, lookup, { published: true }))).toMatch(/two items have the ID "p".*V38/);
    expect(msgs(albumProblems({ items: [item('b', 'a/bare')] }, lookup, { published: true }))).toMatch(/alt text.*V38/);
  });
  it('V39: a tile names an item once, and tiles never overlap', () => {
    expect(msgs(tileProblems({ ...base, showcase: { tiles: [tile('nope', 0, 0, 6, 4)] } }))).toMatch(/isn't an item.*V39/);
    expect(msgs(tileProblems({ ...base, showcase: { tiles: [tile('p', 0, 0, 6, 4), tile('p', 6, 0, 6, 4)] } }))).toMatch(/two tiles.*V39/);
    expect(msgs(tileProblems({ ...base, showcase: { tiles: [tile('p', 0, 0, 6, 4), tile('t', 4, 2, 6, 4)] } }))).toMatch(/overlap.*V39/);
  });
  it('V40: warns about holes, tall bands, heavy playing tiles and videos without captions', () => {
    const w = albumWarnings({ items: [...base.items, item('m', 'a/mute')], showcase: { tiles: [tile('p', 0, 0, 6, 10), tile('g', 6, 0, 4, 2, { play: true })] } }, lookup).join('\n');
    expect(w).toMatch(/empty cell.*V40/);
    expect(w).toMatch(/10 rows tall.*V40/);
    expect(w).toMatch(/"g" plays in the band and is 5 MB.*V40/);
    expect(w).toMatch(/"a\/mute" has no captions.*V40/);
    expect(albumWarnings({ ...base, showcase: { tiles: [tile('p', 0, 0, 12, 6)] } }, lookup)).toEqual([]);
  });
  it('V47: the phone arrangement names exactly the tiles shown on phones, without overlap', () => {
    const tiles = [tile('p', 0, 0, 6, 4), tile('t', 6, 0, 6, 4, { onPhones: false })];
    expect(phoneProblems({ ...base, showcase: { tiles, phone: { tiles: [{ item: 'p', x: 0, y: 0, w: 6, h: 4 }] } } })).toEqual([]);
    expect(msgs(phoneProblems({ ...base, showcase: { tiles, phone: { tiles: [{ item: 'p', x: 0, y: 0, w: 6, h: 4 }, { item: 't', x: 0, y: 4, w: 6, h: 4 }] } } }))).toMatch(/hidden on phones.*V47/);
    expect(msgs(phoneProblems({ ...base, showcase: { tiles: [tiles[0], { ...tiles[1], onPhones: undefined }], phone: { tiles: [{ item: 'p', x: 0, y: 0, w: 6, h: 4 }] } } }))).toMatch(/"t" is shown on phones but has no place.*V47/);
    expect(msgs(phoneProblems({ ...base, showcase: { tiles: [tiles[0], { ...tiles[1], onPhones: undefined }], phone: { tiles: [{ item: 'p', x: 0, y: 0, w: 6, h: 4 }, { item: 't', x: 0, y: 2, w: 6, h: 4 }] } } }))).toMatch(/overlap.*V47/);
    expect(msgs(phoneProblems({ ...base, showcase: { tiles: [{ ...tiles[0], onPhones: false }] } }))).toMatch(/at least one tile.*V47/);
  });
  it('V48: focus on a filled tile only, play on a light enough video or animation, two at most', () => {
    expect(msgs(playProblems({ ...base, showcase: { tiles: [tile('d', 0, 0, 6, 4, { focus: '50% 50%' })] } }, lookup))).toMatch(/filled tile.*V48/);
    expect(msgs(playProblems({ ...base, showcase: { tiles: [tile('p', 0, 0, 6, 4, { focus: '150% 50%' })] } }, lookup))).toMatch(/0% to 100%.*V48/);
    expect(msgs(playProblems({ ...base, showcase: { tiles: [tile('p', 0, 0, 6, 4, { play: true })] } }, lookup))).toMatch(/only a video file or an animated picture.*V48/);
    expect(msgs(playProblems({ items: [item('h', 'a/huge-gif')], showcase: { tiles: [tile('h', 0, 0, 6, 4, { play: true })] } }, lookup))).toMatch(/12 MB.*V48/);
    const three = { items: [item('g', 'a/gif'), item('v', 'a/clip'), item('m', 'a/mute')], showcase: { tiles: [tile('g', 0, 0, 4, 4, { play: true }), tile('v', 4, 0, 4, 4, { play: true }), tile('m', 8, 0, 4, 4, { play: true })] } };
    expect(msgs(playProblems(three, lookup))).toMatch(/3 tiles play.*V48/);
  });
  it('V45 and V49: an embed has its provider\'s ID shape and a picture as poster; autoplay is for a video file', () => {
    expect(msgs(albumProblems({ items: [{ ...embed('e'), embed: { provider: 'vimeo', id: 'abc' } }] }, lookup, { published: true }))).toMatch(/vimeo video's ID.*V45/);
    expect(msgs(albumProblems({ items: [{ ...embed('e'), poster: 'a/plan' }] }, lookup, { published: true }))).toMatch(/poster.*V45/);
    expect(msgs(albumProblems({ items: [item('p', 'a/photo', { autoplay: true })] }, lookup, { published: true }))).toMatch(/autoplay and loop/);
    expect(albumProblems({ items: [item('v', 'a/clip', { autoplay: true, loop: true })] }, lookup, { published: true })).toEqual([]);
  });
});


describe('the fixture album (tests/fixtures/gallery/content)', () => {
  const root = join(process.cwd(), 'tests', 'fixtures', 'gallery', 'content');
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
  const docs: Record<string, unknown> = {};
  const masters = new Set<string>();
  for (const f of walk(root)) {
    const key = `/content/${relative(root, f).split(sep).join('/')}`;
    // its masters are made by scripts/make-gallery-fixture.mjs, beside their sidecars
    if (key.endsWith('.json')) docs[key] = JSON.parse(readFileSync(f, 'utf8'));
    else masters.add(key);
  }
  const c = loadContent(docs, masters);
  const g = c.articles.get('fixture-album')!;
  const lookup: MediaLookup = (id) => c.media.get(id) ?? c.videos.get(id);

  it('loads with no problem and no warning: 21 items of every kind', () => {
    expect(c.warnings).toEqual([]);
    expect(g.album?.items).toHaveLength(21);
    const kinds = new Set(g.album!.items.map((i) => itemKind(i, lookup)));
    expect([...kinds].sort()).toEqual(['animated', 'drawing', 'embed', 'picture', 'video']);
    expect(new Set(g.album!.items.filter((i) => i.embed).map((i) => i.embed!.provider))).toEqual(new Set(['youtube', 'vimeo']));
    expect(c.media.get('articles/fixture-album/plan')?.darkMaster).toMatch(/plan\.dark\.svg$/);
    expect(c.media.get('articles/fixture-album/p01')?.large).toBe(true);
    expect(c.videos.get('articles/fixture-album/clip')?.captions).toHaveLength(1);
  });

  it('reads as its words, its dates and its card', () => {
    expect(countWords(albumCounts(g.album!.items, lookup))).toBe('17 pictures, 3 videos, 1 drawing');
    expect(dateSpan(albumDates(g.album!, lookup))).toBe('March to May 2026');
    expect(cardPicture(g, lookup)).toBe('articles/fixture-album/p01');
  });

  it('resolves for the layouts, and works out its phone arrangement', () => {
    const r = resolveAlbum(g.album!, c.media, c.videos);
    expect(r.items.find((i) => i.item.id === 'talk')?.poster?.id).toBe('articles/fixture-album/yt-poster');
    expect(r.items.find((i) => i.item.id === 'clip')?.video?.id).toBe('articles/fixture-album/clip');
    const phone = phoneOf(g.album!);
    expect(phone.map((t) => t.item)).toEqual(['p01', 'clip', 'anim', 'plan', 'p02']);
    expect(phoneProblems({ ...g.album!, showcase: { ...g.album!.showcase!, phone: { tiles: phone } } })).toEqual([]);
  });
});