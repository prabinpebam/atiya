import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/site/content/load';
import {
  PRESET_IDS,
  albumCounts,
  albumDates,
  albumDay,
  albumOrder,
  albumProblems,
  albumWarnings,
  albumsOrder,
  applyPreset,
  countWords,
  coverOf,
  coverPicture,
  coverProblems,
  dateSpan,
  defaultCover,
  displayFor,
  fingerprintClashes,
  holes,
  itemKind,
  keepPhoneInStep,
  leadTile,
  overlaps,
  phoneOf,
  phoneProblems,
  phoneTiles,
  playProblems,
  presetRects,
  readingOrder,
  resolveAlbum,
  rowsOf,
  type AlbumMedia,
  type MediaLookup,
  type Rect,
} from '../../src/site/content/album';
import { GRID_COLUMNS, GRID_ROWS_MAX, PHONE_COLUMNS, PHONE_TILE_H_MAX, album as albumSchema, type Album, type AlbumCover, type AlbumItem, type AlbumTile } from '../../src/site/content/schema';

const MB = 1024 * 1024;
const MEDIA: Record<string, AlbumMedia> = {
  'a/photo': { kind: 'image', file: 'photo.webp', alt: 'A photo', facts: { width: 3000, height: 2000, bytes: 400_000 }, taken: '2026-03-12' },
  'a/tall': { kind: 'image', file: 'tall.webp', alt: 'A tall photo', facts: { width: 1000, height: 2000, bytes: 300_000 }, taken: '2026-05-02' },
  'a/early': { kind: 'image', file: 'early.webp', alt: 'An early photo', facts: { width: 3000, height: 2000, bytes: 300_000 }, taken: '2026-01-05' },
  'a/same': { kind: 'image', file: 'same.webp', alt: 'Taken the same day', facts: { width: 3000, height: 2000, bytes: 300_000 }, taken: '2026-03-12' },
  'a/gif': { kind: 'image', file: 'gif.gif', alt: 'A loop', animation: { poster: 'gif.poster.webp' }, facts: { width: 800, height: 600, bytes: 5 * MB } },
  'a/huge-gif': { kind: 'image', file: 'huge-gif.gif', alt: 'A long loop', animation: { poster: 'huge-gif.poster.webp' }, facts: { width: 800, height: 600, bytes: 12 * MB } },
  'a/plan': { kind: 'image', file: 'plan.svg', alt: 'A floor plan', facts: { width: 1200, height: 800, bytes: 20_000 } },
  'a/clip': { kind: 'video', file: 'clip.mp4', width: 1920, height: 1080, captions: [{}], bytes: 3 * MB, taken: '2026-04-01' },
  'a/mute': { kind: 'video', file: 'mute.mp4', width: 1080, height: 1920 },
  'a/talk': { kind: 'embed', provider: 'youtube' },
  'a/bare': { kind: 'image', file: 'bare.webp', decorative: true },
  'a/noalt': { kind: 'image', file: 'noalt.webp', facts: { width: 3000, height: 2000, bytes: 300_000 } },
  'a/wordy': { kind: 'image', file: 'wordy.webp', alt: 'Wordy', caption: 'x'.repeat(201) },
};
const lookup: MediaLookup = (id) => MEDIA[id];
const item = (id: string, media: string, extra: Partial<AlbumItem> = {}): AlbumItem => ({ id, media, ...extra }) as AlbumItem;
const text = (id: string, words: string): AlbumItem => ({ id, text: words });
const tile = (it: string, x: number, y: number, w: number, h: number, extra: Partial<AlbumTile> = {}): AlbumTile => ({ item: it, x, y, w, h, ...extra });
/** What the rules read of an album: its items, its cover and its order. */
const covered = (items: AlbumItem[], cover?: AlbumCover, order?: Album['order']) => ({ items, cover, order });
/** A whole album file, for the schema. */
const albumFile = (items: AlbumItem[], extra: Partial<Album> = {}) => ({ id: 'a', type: 'album', slug: 'a', title: 'An album', status: 'draft', createdAt: '2026-01-01', updatedAt: '2026-01-01', items, ...extra });
const ids = (items: readonly AlbumItem[]) => items.map((i) => i.id);

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

/** A random valid cover: tiles dropped where they fit, never overlapping, 1 to 12 of them. */
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

describe('the album file', () => {
  it('is its own resource: a type, a title, a status and its days', () => {
    expect(albumSchema.safeParse(albumFile([item('p', 'a/photo'), text('t', 'Words between pictures.')], { order: 'custom' })).success).toBe(true);
    expect(albumSchema.safeParse({ ...albumFile([]), type: 'article' }).success).toBe(false);
    expect(albumSchema.safeParse({ ...albumFile([]), title: 'x'.repeat(121) }).success).toBe(false);
    expect(albumSchema.safeParse({ ...albumFile([]), createdAt: undefined }).success).toBe(false);
  });
  it("holds a library item or a text card, never an item's own words or a linked video of its own", () => {
    expect(albumSchema.safeParse(albumFile([{ id: 'p', media: 'a/photo', caption: 'Mine' } as unknown as AlbumItem])).success).toBe(false);
    expect(albumSchema.safeParse(albumFile([{ id: 'e', embed: { provider: 'youtube', id: 'dQw4w9WgXcQ' } } as unknown as AlbumItem])).success).toBe(false);
    expect(albumSchema.safeParse(albumFile([{ id: 'x', media: 'a/photo', text: 'Both' } as unknown as AlbumItem])).success).toBe(false);
    expect(albumSchema.safeParse(albumFile([text('t', 'One.\n\nTwo.\n\nThree.\n\nFour.\n\nFive.')])).success).toBe(false);
  });
  it('has a cover of a lead or of tiles, never both', () => {
    expect(albumSchema.safeParse(albumFile([item('p', 'a/photo')], { cover: { lead: 'p' } })).success).toBe(true);
    expect(albumSchema.safeParse(albumFile([item('p', 'a/photo')], { cover: { tiles: [tile('p', 0, 0, 12, 6)] } })).success).toBe(true);
    expect(albumSchema.safeParse(albumFile([item('p', 'a/photo')], { cover: { lead: 'p', tiles: [tile('p', 0, 0, 12, 6)] } as unknown as AlbumCover })).success).toBe(false);
  });
});

describe('kinds and display', () => {
  it('knows each kind of item, from its library item', () => {
    expect(itemKind(item('p', 'a/photo'), lookup)).toBe('picture');
    expect(itemKind(item('g', 'a/gif'), lookup)).toBe('animated');
    expect(itemKind(item('d', 'a/plan'), lookup)).toBe('drawing');
    expect(itemKind(item('v', 'a/clip'), lookup)).toBe('video');
    expect(itemKind(item('e', 'a/talk'), lookup)).toBe('embed');
    expect(itemKind(text('t', 'Words.'), lookup)).toBe('text');
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

describe("an album's order (§3.3)", () => {
  const items = [item('undated1', 'a/plan'), item('may', 'a/tall'), item('march', 'a/photo'), item('undated2', 'a/gif'), item('jan', 'a/early'), item('march2', 'a/same'), item('april', 'a/clip')];
  it('is oldest first by the day taken when left out, the undated after in the order they were added', () => {
    expect(ids(albumOrder({ items }, lookup))).toEqual(['jan', 'march', 'march2', 'april', 'may', 'undated1', 'undated2']);
    expect(ids(albumOrder({ items, order: 'oldest' }, lookup))).toEqual(ids(albumOrder({ items }, lookup)));
  });
  it('is newest first when asked, items of the same day still in the order they were added', () => {
    expect(ids(albumOrder({ items, order: 'newest' }, lookup))).toEqual(['may', 'april', 'march', 'march2', 'jan', 'undated1', 'undated2']);
  });
  it("is the owner's own exactly as listed, text cards where he put them", () => {
    const own = [text('t', 'First words.'), ...items];
    expect(ids(albumOrder({ items: own, order: 'custom' }, lookup))).toEqual(ids(own));
  });
  it('puts a text card last when sorted (V53 asks for the custom order)', () => {
    expect(ids(albumOrder({ items: [text('t', 'Words.'), item('may', 'a/tall'), item('jan', 'a/early')] }, lookup))).toEqual(['jan', 'may', 't']);
  });
});

describe("a gallery's order of its albums (§5)", () => {
  const a = (createdAt: string, ...media: string[]) => ({ createdAt, publishedAt: undefined, items: media.map((m, i) => item(`i${i}`, m)) });
  const may = a('2025-01-01', 'a/photo', 'a/tall');
  const jan = a('2026-06-01', 'a/early');
  const made = a('2026-02-01', 'a/plan');
  const tie = a('2024-01-01', 'a/tall');
  it('dates an album by its latest picture, else the day it was made', () => {
    expect(albumDay(may, lookup)).toBe('2026-05-02');
    expect(albumDay(made, lookup)).toBe('2026-02-01');
    expect(albumDay({ createdAt: '2026-02-01T10:00:00Z', items: [] }, lookup)).toBe('2026-02-01');
  });
  it('is newest first by default, ties in the order given', () => {
    expect(albumsOrder([jan, made, may, tie], undefined, lookup)).toEqual([may, tie, made, jan]);
    expect(albumsOrder([jan, made, may, tie], 'newest', lookup)).toEqual([may, tie, made, jan]);
  });
  it("is oldest first when asked, and the structure's own order when custom", () => {
    expect(albumsOrder([jan, made, may, tie], 'oldest', lookup)).toEqual([jan, made, may, tie]);
    expect(albumsOrder([jan, made, may, tie], 'custom', lookup)).toEqual([jan, made, may, tie]);
  });
});

describe('counts and dates', () => {
  it('counts animated pictures as pictures and linked videos as videos, and no text card', () => {
    const items = [item('p', 'a/photo'), item('t', 'a/tall'), item('g', 'a/gif'), item('d', 'a/plan'), item('v', 'a/clip'), item('e', 'a/talk'), item('x', 'a/none'), text('w', 'Words.')];
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
  it("reads the items' dates from their library items unless the album hides them", () => {
    const items = [item('p', 'a/photo'), item('t', 'a/tall'), item('g', 'a/gif'), item('v', 'a/clip'), item('e', 'a/talk'), text('w', 'Words.')];
    expect(albumDates({ items }, lookup)).toEqual(['2026-03-12', '2026-05-02', '2026-04-01']);
    expect(albumDates({ items, dates: false }, lookup)).toEqual([]);
  });
});

describe('presets and the automatic cover', () => {
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
    expect(presetRects('fit', 3, [1.5, 0.5, 1.5])).toEqual([
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
        // and each is a valid cover
        const items = rects.map((_, i) => item(`i${i}`, `a/p${i}`));
        expect(albumSchema.safeParse(albumFile(items, { cover: { tiles: rects.map((t, i) => ({ item: `i${i}`, ...t })) } })).success, `${preset} ${n}`).toBe(true);
      }
  });
  it('keeps the tiles, their order and their settings when a preset is applied', () => {
    const tiles = [tile('b', 6, 0, 6, 6, { play: true }), tile('a', 0, 0, 6, 6, { display: 'fit', onPhones: false })];
    expect(applyPreset('lead-two', tiles)).toEqual([
      { item: 'a', x: 0, y: 0, w: 8, h: 6, display: 'fit', onPhones: false },
      { item: 'b', x: 8, y: 0, w: 4, h: 6, play: true },
    ]);
  });
  it('works out the automatic cover from the number of items', () => {
    // undated library items keep the order they were added
    const items = (n: number) => Array.from({ length: n }, (_, i) => item(`i${i}`, `x/${i}`));
    const cover = (n: number) => defaultCover(covered(items(n)), lookup);
    expect(cover(0)).toEqual([]);
    expect(cover(1)).toEqual([tile('i0', 0, 0, 12, 6)]);
    expect(cover(2).map((t) => [t.w, t.h])).toEqual([[6, 4], [6, 4]]);
    expect(cover(3).map((t) => [t.w, t.h])).toEqual([[8, 6], [4, 3], [4, 3]]);
    expect(cover(4).map((t) => [t.w, t.h])).toEqual([[6, 4], [6, 4], [6, 4], [6, 4]]);
    for (const n of [5, 6, 21, 200]) {
      const d = cover(n);
      expect(d.map((t) => t.item)).toEqual(['i0', 'i1', 'i2', 'i3', 'i4']);
      expect(d[0]).toEqual(tile('i0', 0, 0, 6, 4));
    }
  });
  it("follows the album's order, leaves out text cards and puts the chosen lead first", () => {
    const items = [text('w', 'Words.'), item('may', 'a/tall'), item('jan', 'a/early'), item('march', 'a/photo')];
    expect(defaultCover(covered(items), lookup).map((t) => t.item)).toEqual(['jan', 'march', 'may']);
    expect(defaultCover(covered(items, undefined, 'newest'), lookup).map((t) => t.item)).toEqual(['may', 'march', 'jan']);
    const led = defaultCover(covered(items, { lead: 'may' }), lookup);
    expect(led.map((t) => t.item)).toEqual(['may', 'jan', 'march']);
    expect(led[0]).toEqual(tile('may', 0, 0, 8, 6));
    expect(coverOf(covered(items, { lead: 'may' }), lookup)).toEqual(led);
    const tiles = [tile('jan', 0, 0, 12, 6)];
    expect(coverOf(covered(items, { tiles }), lookup)).toBe(tiles);
  });
});

describe('the cover on a phone', () => {
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
  it('never overlaps, stays inside 6 columns and 2 to 8 rows a tile, and names every tile shown (300 random covers)', () => {
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
  it("keeps the owner's phone arrangement in step with the cover", () => {
    const band = [tile('a', 0, 0, 6, 4), tile('b', 6, 0, 6, 4), tile('c', 0, 4, 12, 4)];
    const own = [
      { item: 'c', x: 0, y: 0, w: 6, h: 3 },
      { item: 'a', x: 0, y: 3, w: 3, h: 3 },
      { item: 'b', x: 3, y: 3, w: 3, h: 3 },
    ];
    expect(keepPhoneInStep(own, [band[0], band[2]])).toEqual([own[0], own[1]]);
    expect(keepPhoneInStep(own, [...band, tile('d', 0, 8, 12, 4)])).toEqual([...own, { item: 'd', x: 0, y: 6, w: 6, h: 2 }]);
    expect(keepPhoneInStep(own, [band[0], { ...band[1], onPhones: false }, band[2]]).map((t) => t.item)).toEqual(['c', 'a']);
  });
  it("uses the owner's arrangement when there is one, else the rule's", () => {
    const tiles = [tile('a', 0, 0, 12, 6)];
    expect(phoneOf(covered([item('a', 'a/photo')], { tiles }), lookup)).toEqual(phoneTiles(tiles));
    const phone = [{ item: 'a', x: 0, y: 0, w: 6, h: 8 }];
    expect(phoneOf(covered([item('a', 'a/photo')], { tiles, phone: { tiles: phone } }), lookup)).toEqual(phone);
    expect(phoneOf(covered([item('a', 'a/photo')]), lookup)).toEqual(phoneTiles(defaultCover(covered([item('a', 'a/photo')]), lookup)));
  });
});

describe('the cover picture (§3.6)', () => {
  const items = [item('d', 'a/plan'), item('v', 'a/clip'), item('t', 'a/tall'), item('p', 'a/photo')];
  it('is the lead tile: the largest, the first in reading order of equals', () => {
    expect(leadTile([tile('a', 0, 0, 4, 4), tile('b', 4, 0, 8, 4), tile('c', 0, 4, 8, 4)])?.item).toBe('b');
    expect(leadTile([])).toBeUndefined();
    const album = covered(items, { tiles: [tile('p', 0, 0, 6, 4), tile('t', 6, 0, 6, 6)] });
    expect(coverPicture(album, lookup)).toEqual({ item: items[2], media: 'a/tall', kind: 'picture', poster: false });
  });
  it('is the chosen lead of the automatic cover, else its first item; a video gives its poster', () => {
    expect(coverPicture(covered(items, { lead: 'v' }), lookup)).toEqual({ item: items[1], media: 'a/clip', kind: 'video', poster: true });
    expect(coverPicture(covered([item('e', 'a/talk'), item('d', 'a/plan')]), lookup)).toMatchObject({ media: 'a/talk', kind: 'embed', poster: true });
    // oldest first: the photo (12 March) leads the tall one (2 May); the drawing and the video are undated or later
    expect(coverPicture(covered(items), lookup)?.media).toBe('a/photo');
  });
  it("skips a drawing for a social card (V46): the cover's next item, else the album's first", () => {
    const album = covered(items, { tiles: [tile('d', 0, 0, 8, 6), tile('t', 8, 0, 4, 3), tile('p', 8, 3, 4, 3)] });
    expect(coverPicture(album, lookup)?.media).toBe('a/plan');
    expect(coverPicture(album, lookup, { social: true })?.media).toBe('a/tall');
    expect(coverPicture(covered(items, { tiles: [tile('d', 0, 0, 12, 6)] }), lookup, { social: true })?.media).toBe('a/photo');
    expect(coverPicture(covered([item('d', 'a/plan'), text('w', 'Words.')]), lookup, { social: true })).toBeUndefined();
    expect(coverPicture(covered([]), lookup)).toBeUndefined();
  });
});

describe('the checks', () => {
  const base = covered([item('p', 'a/photo'), item('t', 'a/tall'), item('g', 'a/gif'), item('v', 'a/clip'), item('d', 'a/plan')]);
  const withTiles = (tiles: AlbumTile[], phone?: { tiles: { item: string; x: number; y: number; w: number; h: number }[] }) => ({ ...base, cover: phone ? { tiles, phone } : { tiles } });
  const msgs = (issues: { message: string }[]) => issues.map((i) => i.message).join('\n');
  const published = { published: true };

  it('passes a good album', () => {
    const album = withTiles([tile('p', 0, 0, 6, 4, { focus: '30% 40%' }), tile('v', 6, 0, 6, 4, { play: true }), tile('g', 0, 4, 12, 4, { play: true })]);
    expect(albumProblems(album, lookup, published)).toEqual([]);
  });
  it('V38: a published album has a picture or video, unique IDs, and each library item once', () => {
    expect(msgs(albumProblems(covered([]), lookup, published))).toMatch(/V38/);
    expect(msgs(albumProblems(covered([text('w', 'Only words.')], undefined, 'custom'), lookup, published))).toMatch(/at least one picture or video.*V38/);
    expect(albumProblems(covered([]), lookup, { published: false })).toEqual([]);
    expect(msgs(albumProblems(covered([item('p', 'a/photo'), item('p', 'a/tall')]), lookup, published))).toMatch(/two items have the ID "p".*V38/);
    expect(msgs(albumProblems(covered([item('p', 'a/photo'), item('q', 'a/photo')]), lookup, published))).toMatch(/in the album twice.*V38/);
  });
  it('V54: a published album warns of a picture without alt text (or decorative), never refuses it; a draft is not warned', () => {
    expect(albumProblems(covered([item('n', 'a/noalt')]), lookup, published)).toEqual([]);
    expect(albumProblems(covered([item('b', 'a/bare')]), lookup, published)).toEqual([]);
    expect(albumWarnings(covered([item('n', 'a/noalt')]), lookup, published).join('\n')).toMatch(/"a\/noalt" has no alt text.*V54/);
    expect(albumWarnings(covered([item('b', 'a/bare')]), lookup, published).join('\n')).toMatch(/"a\/bare" has no alt text.*V54/);
    expect(albumWarnings(covered([item('n', 'a/noalt')]), lookup, { published: false }).join('\n')).not.toMatch(/V54/);
  });
  it('V39: the lead and each tile name an item that is not a text card, once, and tiles never overlap', () => {
    const words = { ...base, items: [...base.items, text('w', 'Words.')] };
    expect(msgs(coverProblems({ ...base, cover: { lead: 'nope' } }))).toMatch(/isn't an item.*V39/);
    expect(msgs(coverProblems({ ...words, cover: { lead: 'w' } }))).toMatch(/text card.*V39/);
    expect(msgs(coverProblems(withTiles([tile('nope', 0, 0, 6, 4)])))).toMatch(/isn't an item.*V39/);
    expect(msgs(coverProblems({ ...words, cover: { tiles: [tile('w', 0, 0, 6, 4)] } }))).toMatch(/text card.*V39/);
    expect(msgs(coverProblems(withTiles([tile('p', 0, 0, 6, 4), tile('p', 6, 0, 6, 4)])))).toMatch(/two tiles.*V39/);
    expect(msgs(coverProblems(withTiles([tile('p', 0, 0, 6, 4), tile('t', 4, 2, 6, 4)])))).toMatch(/overlap.*V39/);
    expect(coverProblems({ ...base, cover: { lead: 'p' } })).toEqual([]);
  });
  it('V40: warns about holes, tall covers, heavy playing tiles and videos without captions', () => {
    const album = covered([...base.items, item('m', 'a/mute')], { tiles: [tile('p', 0, 0, 6, 10), tile('g', 6, 0, 4, 2, { play: true })] });
    const w = albumWarnings(album, lookup).join('\n');
    expect(w).toMatch(/empty cell.*V40/);
    expect(w).toMatch(/10 rows tall.*V40/);
    expect(w).toMatch(/"g" plays in the cover and is 5 MB.*V40/);
    expect(w).toMatch(/"a\/mute" has no captions.*V40/);
    expect(albumWarnings(withTiles([tile('p', 0, 0, 12, 6)]), lookup)).toEqual([]);
  });
  it("V41: a caption is at most 200 characters in a published album, and the album's words link only to its items", () => {
    expect(msgs(albumProblems(covered([item('w', 'a/wordy')]), lookup, published))).toMatch(/201 characters.*V41/);
    expect(albumProblems(covered([item('w', 'a/wordy')]), lookup, { published: false })).toEqual([]);
    const linked = (md: string) => albumProblems({ ...covered([item('p', 'a/photo'), text('w', md)], undefined, 'custom'), description: 'See [the photo](#item-p).' }, lookup, published);
    expect(linked('See [the photo](#item-p).')).toEqual([]);
    expect(msgs(linked('See [nothing](#item-nope).'))).toMatch(/goes nowhere.*V41/);
    expect(msgs(linked('See [the top](#top).'))).toMatch(/goes nowhere.*V41/);
  });
  it('V47: the phone arrangement names exactly the tiles shown on phones, without overlap', () => {
    const tiles = [tile('p', 0, 0, 6, 4), tile('t', 6, 0, 6, 4, { onPhones: false })];
    const p = { item: 'p', x: 0, y: 0, w: 6, h: 4 };
    expect(phoneProblems(withTiles(tiles, { tiles: [p] }))).toEqual([]);
    expect(msgs(phoneProblems(withTiles(tiles, { tiles: [p, { item: 't', x: 0, y: 4, w: 6, h: 4 }] })))).toMatch(/hidden on phones.*V47/);
    expect(msgs(phoneProblems(withTiles([tiles[0], { ...tiles[1], onPhones: undefined }], { tiles: [p] })))).toMatch(/"t" is shown on phones but has no place.*V47/);
    expect(msgs(phoneProblems(withTiles([tiles[0], { ...tiles[1], onPhones: undefined }], { tiles: [p, { item: 't', x: 0, y: 2, w: 6, h: 4 }] })))).toMatch(/overlap.*V47/);
    expect(msgs(phoneProblems(withTiles([{ ...tiles[0], onPhones: false }])))).toMatch(/at least one tile.*V47/);
  });
  it('V48: focus on a filled tile only, play on a light enough video or animation, two at most', () => {
    expect(msgs(playProblems(withTiles([tile('d', 0, 0, 6, 4, { focus: '50% 50%' })]), lookup))).toMatch(/filled tile.*V48/);
    expect(msgs(playProblems(withTiles([tile('p', 0, 0, 6, 4, { focus: '150% 50%' })]), lookup))).toMatch(/0% to 100%.*V48/);
    expect(msgs(playProblems(withTiles([tile('p', 0, 0, 6, 4, { play: true })]), lookup))).toMatch(/only a video file or an animated picture.*V48/);
    expect(msgs(playProblems(covered([item('h', 'a/huge-gif')], { tiles: [tile('h', 0, 0, 6, 4, { play: true })] }), lookup))).toMatch(/12 MB.*V48/);
    const three = covered([item('g', 'a/gif'), item('v', 'a/clip'), item('m', 'a/mute')], { tiles: [tile('g', 0, 0, 4, 4, { play: true }), tile('v', 4, 0, 4, 4, { play: true }), tile('m', 8, 0, 4, 4, { play: true })] });
    expect(msgs(playProblems(three, lookup))).toMatch(/3 tiles play.*V48/);
    expect(msgs(playProblems(covered([item('e', 'a/talk')], { tiles: [tile('e', 0, 0, 6, 4, { play: true })] }), lookup))).toMatch(/only a video file.*V48/);
  });
  it("V49: autoplay and loop are a video file's, and a linked video can't be downloaded", () => {
    expect(msgs(albumProblems(covered([item('p', 'a/photo', { autoplay: true })]), lookup, published))).toMatch(/autoplay and loop.*V49/);
    expect(msgs(albumProblems(covered([item('e', 'a/talk', { loop: true })]), lookup, published))).toMatch(/linked video.*V49/);
    expect(msgs(albumProblems(covered([item('e', 'a/talk', { download: true })]), lookup, published))).toMatch(/can't be downloaded.*V49/);
    expect(albumProblems(covered([item('v', 'a/clip', { autoplay: true, loop: true, download: false })]), lookup, published)).toEqual([]);
  });
  it("V53: an album with a text card is in the owner's order", () => {
    const items = [item('p', 'a/photo'), text('w', 'Words.')];
    expect(msgs(albumProblems(covered(items), lookup, published))).toMatch(/"custom".*V53/);
    expect(msgs(albumProblems(covered(items, undefined, 'newest'), lookup, published))).toMatch(/V53/);
    expect(albumProblems(covered(items, undefined, 'custom'), lookup, published)).toEqual([]);
  });
  it('V55: a fingerprint names one library item', () => {
    const f = (c: string) => c.repeat(64);
    expect(fingerprintClashes([{ id: 'a', fingerprint: f('a') }, { id: 'b', fingerprint: f('b') }, { id: 'c' }])).toEqual([]);
    expect(fingerprintClashes([{ id: 'a', fingerprint: f('a') }, { id: 'b', fingerprint: f('b') }, { id: 'c', fingerprint: f('a') }])).toEqual([{ fingerprint: f('a'), ids: ['a', 'c'] }]);
  });
});

describe('the fixture albums (tests/fixtures/gallery/content)', () => {
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
  const g = c.albums.get('fixture-album')!;
  const lookup: MediaLookup = (id) => c.media.get(id) ?? c.videos.get(id) ?? c.embeds.get(id);

  it('loads with no problem and no warning: 21 items of every kind', () => {
    expect(c.warnings).toEqual([]);
    expect([...c.albums.keys()].sort()).toEqual(['fixture-album', 'fixture-captions', 'fixture-story']);
    expect(g.items).toHaveLength(21);
    const kinds = new Set(g.items.map((i) => itemKind(i, lookup)));
    expect([...kinds].sort()).toEqual(['animated', 'drawing', 'embed', 'picture', 'video']);
    expect(new Set([...c.embeds.values()].map((e) => e.provider))).toEqual(new Set(['youtube', 'vimeo']));
    expect(c.embeds.get('articles/fixture-album/talk')).toMatchObject({ video: 'aqz-KE-bpKQ', posterMaster: expect.stringMatching(/talk\.poster\.webp$/) });
    expect(c.media.get('articles/fixture-album/plan')?.darkMaster).toMatch(/plan\.dark\.svg$/);
    expect(c.media.get('articles/fixture-album/p01')?.large).toBe(true);
    expect(c.videos.get('articles/fixture-album/clip')?.captions).toHaveLength(1);
  });

  it("keeps each picture's words on its sidecar", () => {
    expect(c.media.get('articles/fixture-album/p02')).toMatchObject({ caption: 'Oranges, just in.', place: 'Imphal' });
    expect(c.media.get('articles/fixture-album/p03')?.description).toMatch(/^The cloud sat on the water/);
  });

  it('reads as its words, its dates, its order and its cover picture', () => {
    expect(countWords(albumCounts(g.items, lookup))).toBe('17 pictures, 3 videos, 1 drawing');
    expect(dateSpan(albumDates(g, lookup))).toBe('March to May 2026');
    expect(ids(albumOrder(g, lookup)).slice(0, 9)).toEqual(['p01', 'p02', 'p03', 'p04', 'p05', 'p06', 'p12', 'p13', 'anim']);
    expect(coverPicture(g, lookup)?.media).toBe('articles/fixture-album/p01');
    const story = c.albums.get('fixture-story')!;
    expect(story.order).toBe('custom');
    expect(ids(albumOrder(story, lookup))).toEqual(['cloud', 'flags', 'words', 'map']);
  });

  it('resolves for the layouts, and works out its phone arrangement', () => {
    const r = resolveAlbum(g, c.media, c.videos, c.embeds);
    expect(r.items.find((i) => i.item.id === 'talk')?.embed?.id).toBe('articles/fixture-album/talk');
    expect(r.items.find((i) => i.item.id === 'clip')?.video?.id).toBe('articles/fixture-album/clip');
    const phone = phoneOf(g, lookup);
    expect(phone.map((t) => t.item)).toEqual(['p01', 'clip', 'anim', 'plan', 'p02']);
    expect(phoneProblems({ cover: { tiles: (g.cover as { tiles: AlbumTile[] }).tiles, phone: { tiles: phone } } })).toEqual([]);
  });
});
