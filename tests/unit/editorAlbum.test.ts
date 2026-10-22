import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  addItems,
  albumCards,
  albumWeight,
  lengthWords,
  parseLength,
  applyAlbumField,
  dropBefore,
  embedItem,
  embedShape,
  emptyAlbum,
  firstFree,
  isUpFront,
  mediaItems,
  moveBy,
  moveToEnd,
  moveToStart,
  newItemId,
  pickRange,
  pickToggle,
  refreshEmbed,
  removeItems,
  setAlbumSetting,
  setEmbedShape,
  setItemField,
  setUpFront,
  sortByTaken,
  sortChanges,
  weightWords,
  type Edit,
} from '../../src/site/editor/model/album';
import { album as albumSchema, type Album, type Article } from '../../src/site/content/schema';
import { defaultShowcase, showcaseOf } from '../../src/site/content/album';

const FIXTURE = join(process.cwd(), 'tests/fixtures/gallery/content/articles/fixture-album.json');
const fixture = (): Article => JSON.parse(readFileSync(FIXTURE, 'utf8'));
const ids = (a: Album) => a.items.map((i) => i.id);
const ok = (e: Edit): Album => {
  if (!e.ok) throw new Error(e.reason);
  return e.album;
};
const small = (): Album => ({ items: ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, media: `articles/x/${id}` })) });
/** The album as it's saved: valid, and its JSON. */
const file = (a: Album) => JSON.stringify(albumSchema.parse(a));

describe('edit mode: an album (model/album.ts)', () => {
  it('works on the fixture album and never changes what it is given', () => {
    const a = fixture().album!;
    const before = JSON.stringify(a);
    removeItems(a, ['p01']);
    moveToEnd(a, ['p02']);
    sortByTaken(a, () => '2020-01-01');
    ok(setItemField(a, 'p01', 'caption', 'New'));
    ok(setUpFront(a, 'p09', true));
    expect(JSON.stringify(a)).toBe(before);
  });

  describe('adding', () => {
    it('makes item IDs from the media, unique in the album', () => {
      expect(newItemId('articles/x/Sunset Over Hills', [])).toBe('sunset-over-hills');
      expect(newItemId('articles/x/a', ['a', 'a-2'])).toBe('a-3');
      expect(newItemId('***', [])).toBe('item');
      expect(newItemId('x'.repeat(100), [])).toMatch(/^[a-z0-9-]{1,64}$/);
      const items = mediaItems(small(), ['articles/y/a', 'articles/y/a', 'articles/y/g']);
      expect(items.map((i) => i.id)).toEqual(['a-2', 'a-3', 'g']);
    });

    it('adds at the end, or after the chosen item, in the order chosen', () => {
      const a = small();
      expect(ids(ok(addItems(a, mediaItems(a, ['m/g', 'm/h']))))).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
      expect(ids(ok(addItems(a, mediaItems(a, ['m/g', 'm/h']), 'b')))).toEqual(['a', 'b', 'g', 'h', 'c', 'd', 'e', 'f']);
      expect(ids(ok(addItems(a, mediaItems(a, ['m/g']), 'gone')))).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    });

    it('refuses past 200 items, saying why', () => {
      const a: Album = { items: Array.from({ length: 199 }, (_, n) => ({ id: `i${n}`, media: `m/i${n}` })) };
      expect(addItems(a, mediaItems(a, ['m/x'])).ok).toBe(true);
      const r = addItems(a, mediaItems(a, ['m/x', 'm/y']));
      expect(r.ok).toBe(false);
      expect(!r.ok && r.reason).toMatch(/at most 200 items, and this would make 201/);
    });

    it('makes an embed item that passes the check, from what its provider said', () => {
      const a = emptyAlbum();
      const item = embedItem(a, { embed: { provider: 'youtube', id: 'aqz-KE-bpKQ', width: 1280, height: 720 }, title: 'A talk', poster: 'articles/x/youtube-aqz-ke-bpkq-poster', duration: 633.6 });
      expect(item).toEqual({ id: 'youtube-aqz-ke-bpkq', embed: { provider: 'youtube', id: 'aqz-KE-bpKQ', width: 1280, height: 720 }, title: 'A talk', poster: 'articles/x/youtube-aqz-ke-bpkq-poster', duration: 634 });
      expect(() => file(ok(addItems(a, [item])))).not.toThrow();
    });
  });

  describe('removing', () => {
    it('takes the items and their tiles out; a band left with none goes back to the default', () => {
      const a = fixture().album!;
      const r = removeItems(a, ['p01', 'talk']);
      expect(ids(r)).not.toContain('p01');
      expect(r.showcase!.tiles.map((t) => t.item)).toEqual(['clip', 'anim', 'plan', 'p02']);
      const all = removeItems(a, ['p01', 'clip', 'anim', 'plan', 'p02', 'talk']);
      expect(all.showcase).toBeUndefined();
      expect(() => file(all)).not.toThrow();
    });

    it("keeps the phone's own arrangement in step", () => {
      const a = fixture().album!;
      const withPhone: Album = { ...a, showcase: { ...a.showcase!, phone: { tiles: [{ item: 'p01', x: 0, y: 0, w: 6, h: 4 }, { item: 'clip', x: 0, y: 4, w: 3, h: 3 }] } } };
      const r = removeItems(withPhone, ['clip']);
      expect(r.showcase!.phone!.tiles.map((t) => t.item)).toEqual(['p01', 'anim', 'plan', 'p02']);
      const r2 = removeItems({ ...withPhone, showcase: { tiles: [{ item: 'p01', x: 0, y: 0, w: 8, h: 4 }], phone: { tiles: [{ item: 'p01', x: 0, y: 0, w: 6, h: 4 }] } } }, ['p01']);
      expect(r2.showcase).toBeUndefined();
    });
  });

  describe('ordering', () => {
    it('moves one or several together, a place at a time, to the start or the end', () => {
      const a = small();
      expect(ids(moveBy(a, ['c'], -1))).toEqual(['a', 'c', 'b', 'd', 'e', 'f']);
      expect(ids(moveBy(a, ['c'], 1))).toEqual(['a', 'b', 'd', 'c', 'e', 'f']);
      expect(ids(moveBy(a, ['a'], -1))).toEqual(ids(a));
      expect(ids(moveBy(a, ['f'], 1))).toEqual(ids(a));
      expect(ids(moveBy(a, ['b', 'c'], 1))).toEqual(['a', 'd', 'b', 'c', 'e', 'f']);
      expect(ids(moveBy(a, ['b', 'e'], -1))).toEqual(['b', 'e', 'a', 'c', 'd', 'f']);
      expect(ids(moveToStart(a, ['d', 'f']))).toEqual(['d', 'f', 'a', 'b', 'c', 'e']);
      expect(ids(moveToEnd(a, ['a', 'c']))).toEqual(['b', 'd', 'e', 'f', 'a', 'c']);
    });

    it('drops a dragged group before an item, or at the end', () => {
      const a = small();
      expect(ids(dropBefore(a, ['e'], 'b'))).toEqual(['a', 'e', 'b', 'c', 'd', 'f']);
      expect(ids(dropBefore(a, ['a', 'b'], 'e'))).toEqual(['c', 'd', 'a', 'b', 'e', 'f']);
      expect(ids(dropBefore(a, ['a'], null))).toEqual(['b', 'c', 'd', 'e', 'f', 'a']);
      expect(ids(dropBefore(a, ['a', 'b'], 'b'))).toEqual(ids(a));
    });

    it('sorts by date taken, oldest first, undated items after in their order, as one change', () => {
      const a = small();
      const days: Record<string, string> = { b: '2026-03-02', d: '2025-12-31', f: '2026-03-02' };
      const sorted = sortByTaken(a, (i) => days[i.id]);
      expect(ids(sorted)).toEqual(['d', 'b', 'f', 'a', 'c', 'e']);
      expect(sortChanges(a, (i) => days[i.id])).toBe(true);
      expect(sortChanges(sorted, (i) => days[i.id])).toBe(false);
      expect(ids(sortByTaken(a, () => undefined))).toEqual(ids(a));
    });

    it('chooses a range and one more, as the outline does', () => {
      const order = ['a', 'b', 'c', 'd'];
      expect(pickRange(order, 'd', 'b')).toEqual(['b', 'c', 'd']);
      expect(pickRange(order, 'x', 'b')).toEqual(['b']);
      expect(pickToggle(['a'], 'c')).toEqual(['a', 'c']);
      expect(pickToggle(['a', 'c'], 'a')).toEqual(['c']);
    });
  });

  describe('up front', () => {
    it('puts an item up front at 3 by 2 where it fits first, from the default band', () => {
      const a = small();
      expect(a.showcase).toBeUndefined();
      expect(isUpFront(a, 'f')).toBe(false);
      const r = ok(setUpFront(a, 'f', true));
      expect(r.showcase!.tiles.slice(0, 5)).toEqual(defaultShowcase(a.items));
      const tile = r.showcase!.tiles.find((t) => t.item === 'f')!;
      expect(tile).toMatchObject({ w: 3, h: 2 });
      expect(firstFree(defaultShowcase(a.items))).toEqual({ x: tile.x, y: tile.y });
      expect(isUpFront(r, 'f')).toBe(true);
      expect(() => file(r)).not.toThrow();
    });

    it('takes one out, refusing the last, past 12 tiles or with no room', () => {
      const a = fixture().album!;
      const out = ok(setUpFront(a, 'talk', false));
      expect(showcaseOf(out).map((t) => t.item)).not.toContain('talk');
      const one: Album = { ...small(), showcase: { tiles: [{ item: 'a', x: 0, y: 0, w: 4, h: 2 }] } };
      expect(setUpFront(one, 'a', false)).toEqual({ ok: false, reason: expect.stringMatching(/at least one tile/) });
      const twelve: Album = { items: Array.from({ length: 13 }, (_, n) => ({ id: `i${n}`, media: `m/${n}` })), showcase: { tiles: Array.from({ length: 12 }, (_, n) => ({ item: `i${n}`, x: (n % 4) * 3, y: Math.floor(n / 4) * 2, w: 3, h: 2 })) } };
      expect(setUpFront(twelve, 'i12', true)).toEqual({ ok: false, reason: expect.stringMatching(/at most 12 tiles/) });
      const full: Album = { ...small(), showcase: { tiles: [{ item: 'a', x: 0, y: 0, w: 12, h: 12 }] } };
      expect(setUpFront(full, 'b', true)).toEqual({ ok: false, reason: expect.stringMatching(/no room/) });
    });

    it("keeps the phone's own arrangement in step when one goes up front", () => {
      const a = fixture().album!;
      const withPhone: Album = { ...a, showcase: { ...a.showcase!, phone: { tiles: [{ item: 'p01', x: 0, y: 0, w: 6, h: 4 }] } } };
      const r = ok(setUpFront(withPhone, 'p09', true));
      expect(r.showcase!.phone!.tiles.map((t) => t.item)).toContain('p09');
    });
  });

  // documentation/gallery/plan.md DoD 22: each override of spec §18 that edit mode's Items and settings make,
  // set and then put back, leaves the file exactly as it was
  describe('every override is stored only where it applies, and Back to automatic leaves the file as it was (§18)', () => {
    const back = (a: Album, set: (a: Album) => Album, unset: (a: Album) => Album) => {
      const before = file(a);
      const changed = set(a);
      expect(file(changed)).not.toBe(before);
      expect(file(unset(changed))).toBe(before);
    };
    const a = fixture().album!;

    it("an item's caption: cleared", () => back(a, (x) => ok(setItemField(x, 'p04', 'caption', 'Mine')), (x) => ok(setItemField(x, 'p04', 'caption', ''))));
    it('the place: cleared', () => back(a, (x) => ok(setItemField(x, 'p04', 'place', 'Shillong')), (x) => ok(setItemField(x, 'p04', 'place', '  '))));
    it("an item's description: cleared", () => back(a, (x) => ok(setItemField(x, 'p04', 'description', 'Some **words**.')), (x) => ok(setItemField(x, 'p04', 'description', undefined))));
    it('dates on the album: turned back on', () => back(a, (x) => setAlbumSetting(x, 'dates', false), (x) => setAlbumSetting(x, 'dates', true)));
    it("the album page's layout: Grid", () => back(a, (x) => setAlbumSetting(x, 'layout', 'story'), (x) => setAlbumSetting(x, 'layout', 'grid')));
    it('captions under the cells: turned off', () => back(a, (x) => setAlbumSetting(x, 'captions', true), (x) => setAlbumSetting(x, 'captions', false)));
    it('downloads, for the album: turned off', () => back({ ...a, download: undefined }, (x) => setAlbumSetting(x, 'download', true), (x) => setAlbumSetting(x, 'download', false)));
    it('downloads, for an item: Follow the album', () => {
      back(a, (x) => ok(setItemField(x, 'p04', 'download', false)), (x) => ok(setItemField(x, 'p04', 'download', undefined)));
      back(a, (x) => ok(setItemField(x, 'p04', 'download', true)), (x) => ok(setItemField(x, 'p04', 'download', undefined)));
    });
    it("an embed's title, shape, length and poster: pasting the address again", () => {
      const talk = a.items.find((i) => i.id === 'talk')!;
      const facts = { embed: talk.embed!, title: talk.title!, poster: talk.poster!, duration: talk.duration };
      back(
        a,
        (x) => ok(setEmbedShape(ok(setItemField(ok(setItemField(ok(setItemField(x, 'talk', 'title', 'Renamed')), 'talk', 'duration', 99)), 'talk', 'poster', 'articles/fixture-album/p01')), 'talk', '1:1')),
        (x) => ok(refreshEmbed(x, 'talk', facts)),
      );
    });
    it('a video file: Play by itself and Loop turned off', () => back(a, (x) => ok(setItemField(ok(setItemField(x, 'p04', 'autoplay', true)), 'p04', 'loop', true)), (x) => ok(setItemField(ok(setItemField(x, 'p04', 'autoplay', false)), 'p04', 'loop', false))));
  });

  describe('the album settings', () => {
    it('a story takes Captions under pictures off, and refuses it while it is one', () => {
      const a = setAlbumSetting({ ...small(), captions: true }, 'layout', 'story');
      expect(a).toEqual({ ...small(), layout: 'story' });
      expect(setAlbumSetting(a, 'captions', true).captions).toBeUndefined();
    });

    it("applies the Page view's Album group fields to the page", () => {
      const p = fixture();
      expect(applyAlbumField(p, 'album.layout', 'story').album!.layout).toBe('story');
      expect(applyAlbumField(applyAlbumField(p, 'album.layout', 'story'), 'album.layout', undefined).album!.layout).toBeUndefined();
      expect(applyAlbumField(p, 'album.dates', false).album!.dates).toBe(false);
      expect(applyAlbumField(p, 'album.dates', undefined).album!.dates).toBeUndefined();
      expect(applyAlbumField(p, 'album.download', undefined).album!.download).toBeUndefined();
      expect(applyAlbumField(p, 'album.description', 'An intro.').album!.description).toBe('An intro.');
      expect(applyAlbumField(p, 'album.description', '').album!.description).toBeUndefined();
    });
  });

  describe("an item's fields", () => {
    const a = fixture().album!;
    it('refuses what the check would, saying why', () => {
      expect(setItemField(a, 'p04', 'caption', 'x'.repeat(201))).toMatchObject({ ok: false, reason: expect.stringMatching(/at most 200/) });
      expect(setItemField(a, 'p04', 'place', 'a\nb')).toMatchObject({ ok: false });
      expect(setItemField(a, 'talk', 'download', true)).toMatchObject({ ok: false, reason: expect.stringMatching(/can't be downloaded/) });
      expect(setItemField(a, 'talk', 'title', '')).toMatchObject({ ok: false });
      expect(setItemField(a, 'talk', 'poster', undefined)).toMatchObject({ ok: false });
      expect(setItemField(a, 'talk', 'autoplay', true)).toMatchObject({ ok: false });
      expect(setItemField(a, 'p04', 'poster', 'articles/x/y')).toMatchObject({ ok: false });
      expect(setItemField(a, 'gone', 'caption', 'x')).toMatchObject({ ok: false });
    });

    it("reads an embed's shape as one of the choices", () => {
      expect(embedShape({ provider: 'youtube', id: 'x' })).toBe('16:9');
      expect(embedShape({ provider: 'youtube', id: 'x', width: 1280, height: 720 })).toBe('16:9');
      expect(embedShape({ provider: 'youtube', id: 'x', width: 1080, height: 1920 })).toBe('9:16');
      expect(embedShape({ provider: 'vimeo', id: '1', width: 1000, height: 420 })).toBe('provider');
      expect(ok(setEmbedShape(a, 'talk', '16:9')).items.find((i) => i.id === 'talk')!.embed).toEqual(a.items.find((i) => i.id === 'talk')!.embed);
      expect(ok(setEmbedShape(a, 'talk', '4:3')).items.find((i) => i.id === 'talk')!.embed).toMatchObject({ width: 4, height: 3 });
    });
  });

  it("weighs the album's files, once each, with a private album's sealed budget", () => {
    const a: Album = { items: [{ id: 'a', media: 'm/a' }, { id: 'b', media: 'm/a' }, { id: 'c', media: 'm/c' }, { id: 'e', embed: { provider: 'vimeo', id: '1' }, title: 'T', poster: 'm/p' }] };
    const sizes: Record<string, number> = { 'm/a': 1024 * 1024, 'm/p': 512 * 1024 };
    const w = albumWeight(a.items, (m) => sizes[m]);
    expect(w).toEqual({ bytes: 1.5 * 1024 * 1024, unknown: 1 });
    expect(weightWords(w)).toBe('Its files weigh 1.5 MB, and 1 more not measured yet.');
    expect(weightWords(w, true)).toMatch(/sealed: each video file is at most 10 MB/);
  });
});

describe('the Items view', () => {
  it("draws a card per item: its caption, else its media's, else its alt dimmed; an embed's poster and title; a missing file says so", () => {
    const album = {
      items: [
        { id: 'a', media: 'm/a', caption: 'Mine' },
        { id: 'b', media: 'm/b' },
        { id: 'c', media: 'm/c' },
        { id: 'v', embed: { provider: 'youtube' as const, id: 'x' }, title: 'A talk', poster: 'm/p' },
        { id: 'gone', media: 'm/gone' },
      ],
      showcase: { tiles: [{ item: 'b', x: 0, y: 0, w: 6, h: 4 }] },
    };
    const facts = (m: string) =>
      m === 'm/gone' ? undefined : { kind: 'picture' as const, thumb: `/${m}.webp`, width: 3, height: 2, alt: `alt ${m}`, ...(m === 'm/b' ? { caption: 'Its own' } : {}) };
    const cards = albumCards(album, facts);
    expect(cards.map((c) => [c.id, c.kind, c.label, c.dimmed, c.upFront])).toEqual([
      ['a', 'picture', 'Mine', false, false],
      ['b', 'picture', 'Its own', false, true],
      ['c', 'picture', 'alt m/c', true, false],
      ['v', 'embed', 'A talk', false, false],
      ['gone', 'missing', 'gone', true, false],
    ]);
    expect(cards[3].thumb).toBe('/m/p.webp');
  });

  it('reads a length as minutes and seconds, and writes it back', () => {
    expect(parseLength('2:20')).toBe(140);
    expect(parseLength('1:02:03')).toBe(3723);
    expect(parseLength('95')).toBe(95);
    expect(parseLength('two')).toBeNaN();
    expect(parseLength('')).toBeNaN();
    expect(lengthWords(140)).toBe('2:20');
  });
});