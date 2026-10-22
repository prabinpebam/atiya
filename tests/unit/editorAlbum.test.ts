/**
 * Edit mode's album operations (documentation/gallery/spec.md §9.1 to §9.4): pure, each keeping every field it
 * doesn't touch, each result held to the album contract.
 */
import { describe, expect, it } from 'vitest';
import { album as albumSchema, type Album } from '../../src/site/content/schema';
import { albumProblems, type AlbumMedia, type MediaLookup } from '../../src/site/content/album';
import {
  addItems,
  addText,
  albumIdFrom,
  dayGroups,
  editText,
  inOwnOrder,
  itemIdFor,
  moveBy,
  moveItems,
  moveToEnd,
  moveToStart,
  newAlbum,
  nextTextId,
  pickRange,
  pickToggle,
  removeItems,
  setCoverLead,
  setItemDownload,
  setItemPlay,
  setSettings,
  setWords,
  settingsOf,
  sortAlbum,
} from '../../src/site/editor/model/album';

const MEDIA: Record<string, AlbumMedia> = {
  'albums/trip/a': { kind: 'image', file: 'a.webp', alt: 'A', taken: '2026-05-02' },
  'albums/trip/b': { kind: 'image', file: 'b.webp', alt: 'B', taken: '2026-05-01' },
  'albums/trip/c': { kind: 'image', file: 'c.webp', alt: 'C', taken: '2026-05-02' },
  'albums/trip/d': { kind: 'image', file: 'd.webp', alt: 'D' },
  'library/e': { kind: 'image', file: 'e.webp', alt: 'E', taken: '2026-04-30' },
};
const lookup: MediaLookup = (id) => MEDIA[id];

const base = (): Album => ({
  id: 'trip',
  type: 'album',
  slug: 'trip',
  title: 'A trip',
  summary: 'Three days by the sea.',
  status: 'draft',
  createdAt: '2026-05-03',
  updatedAt: '2026-05-03',
  topics: ['travel'],
  items: [
    { id: 'a', media: 'albums/trip/a' },
    { id: 'b', media: 'albums/trip/b' },
    { id: 'c', media: 'albums/trip/c' },
    { id: 'd', media: 'albums/trip/d' },
  ],
});
const ids = (a: Album) => a.items.map((i) => i.id);
const valid = (a: Album) => {
  const parsed = albumSchema.safeParse(a);
  expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
  expect(albumProblems(a, lookup, { published: false })).toEqual([]);
};

describe('a new album (§9.1)', () => {
  it('takes its ID from its title, unique among albums and articles', () => {
    expect(albumIdFrom('Summer in Goa', new Set())).toBe('summer-in-goa');
    expect(albumIdFrom('Summer in Goa', new Set(['summer-in-goa']))).toBe('summer-in-goa-2');
    expect(albumIdFrom('', new Set())).toBe('untitled-album');
    expect(albumIdFrom('Untitled album', new Set(['untitled-album']))).toBe('untitled-album-2');
  });
  it('is an empty draft with every setting at its default, so none is written', () => {
    const a = newAlbum('untitled-album', 'Untitled album', '2026-10-24');
    expect(a).toEqual({ id: 'untitled-album', type: 'album', slug: 'untitled-album', title: 'Untitled album', status: 'draft', createdAt: '2026-10-24', updatedAt: '2026-10-24', items: [] });
    valid(a);
  });
});

describe('words and settings (§9.2)', () => {
  it('changes the words, never empties the title, and leaves out empty words', () => {
    const a = setWords(base(), { title: '  By the sea ', summary: '', description: 'We walked.' });
    expect(a.title).toBe('By the sea');
    expect(a.summary).toBeUndefined();
    expect(a.description).toBe('We walked.');
    expect(a.topics).toEqual(['travel']);
    expect(setWords(base(), { title: '   ' }).title).toBe('A trip');
    valid(a);
  });
  it('writes only the settings away from their defaults', () => {
    const a = setSettings(base(), { download: true, dates: false, large: true });
    expect(a).toMatchObject({ download: true, dates: false, large: true });
    expect(settingsOf(a)).toEqual({ order: 'oldest', layout: 'grid', captions: false, dates: false, download: true, large: true });
    const back = setSettings(a, { download: false, dates: true, large: false });
    expect(back).toEqual(base());
    valid(a);
  });
  it('drops captions under the pictures with the story layout (V49)', () => {
    const a = setSettings(setSettings(base(), { captions: true }), { layout: 'story' });
    expect(a.layout).toBe('story');
    expect(a.captions).toBeUndefined();
    valid(a);
  });
});

describe('order (§3.3, §9.3)', () => {
  it('sorts by the day taken, oldest by default (left out) or newest', () => {
    const newest = sortAlbum(base(), 'newest', lookup);
    expect(newest.ok && newest.album.order).toBe('newest');
    const oldest = sortAlbum({ ...base(), order: 'newest' }, 'oldest', lookup);
    expect(oldest.ok && 'order' in oldest.album).toBe(false);
  });
  it('the own order starts from the order on screen', () => {
    const own = sortAlbum(base(), 'custom', lookup);
    expect(own.ok && ids(own.album)).toEqual(['b', 'a', 'c', 'd']);
    expect(own.ok && own.album.order).toBe('custom');
  });
  it('refuses to sort by date while the album has text cards (V53)', () => {
    const withText = addText(base(), 'Day two', lookup).album;
    const r = sortAlbum(withText, 'oldest', lookup);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.why).toMatch(/text card/);
  });
});

describe('adding (§9.4)', () => {
  it('adds library items once each, with IDs from their names', () => {
    const r = addItems(base(), ['library/e', 'albums/trip/a', 'library/e']);
    expect(r.added).toEqual(['e']);
    expect(r.skipped).toEqual(['albums/trip/a', 'library/e']);
    expect(r.album.items.at(-1)).toEqual({ id: 'e', media: 'library/e' });
    // in a sorted order, the order shows it by its day
    expect(dayGroups(r.album, lookup)[0]).toEqual({ day: '2026-04-30', items: [{ id: 'e', media: 'library/e' }] });
    valid(r.album);
  });
  it('makes item IDs unique', () => {
    expect(itemIdFor('albums/other/a', new Set(['a']))).toBe('a-2');
    expect(itemIdFor('library/IMG_0001', new Set())).toBe('img-0001');
  });
  it('in the own order, inserts before an item or appends', () => {
    const own = inOwnOrder(base(), lookup);
    expect(ids(addItems(own, ['library/e'], { before: 'c' }).album)).toEqual(['b', 'a', 'e', 'c', 'd']);
    expect(ids(addItems(own, ['library/e']).album)).toEqual(['b', 'a', 'c', 'd', 'e']);
  });
  it('adds a text card, which makes the order the own one, then edits and removes it', () => {
    const r = addText(base(), 'Day two', lookup, { before: 'c' });
    expect(r.id).toBe('text-1');
    expect(r.album.order).toBe('custom');
    expect(ids(r.album)).toEqual(['b', 'a', 'text-1', 'c', 'd']);
    valid(r.album);
    expect(nextTextId(r.album)).toBe('text-2');
    expect(editText(r.album, 'text-1', 'Day 2').items[2]).toEqual({ id: 'text-1', text: 'Day 2' });
    expect(ids(editText(r.album, 'text-1', '  '))).toEqual(['b', 'a', 'c', 'd']);
  });
});

describe('removing and moving (§9.3)', () => {
  it('removes items and a cover lead that was one of them', () => {
    const led = { ...base(), cover: { lead: 'c' } };
    const a = removeItems(led, ['c', 'd']);
    expect(ids(a)).toEqual(['a', 'b']);
    expect(a.cover).toBeUndefined();
    expect(removeItems(led, ['a']).cover).toEqual({ lead: 'c' });
  });
  it("removes the owner's cover tiles that showed them", () => {
    const tiled: Album = { ...base(), cover: { tiles: [{ item: 'a', x: 0, y: 0, w: 6, h: 4 }, { item: 'b', x: 6, y: 0, w: 6, h: 4 }] } };
    const a = removeItems(tiled, ['a']);
    expect(a.cover).toEqual({ tiles: [{ item: 'b', x: 6, y: 0, w: 6, h: 4 }] });
    expect(removeItems(tiled, ['a', 'b']).cover).toBeUndefined();
  });
  it('moves items together before another, switching a sorted album to the own order on screen', () => {
    const a = moveItems(base(), ['d', 'b'], 'c', lookup);
    expect(a.order).toBe('custom');
    // on screen: b a c d; b and d move together, in the order shown, before c
    expect(ids(a)).toEqual(['a', 'b', 'd', 'c']);
    expect(a.summary).toBe('Three days by the sea.');
    valid(a);
  });
  it('moves to the start, the end, and one place with the keyboard', () => {
    const own = inOwnOrder(base(), lookup);
    expect(ids(moveToStart(own, ['c'], lookup))).toEqual(['c', 'b', 'a', 'd']);
    expect(ids(moveToEnd(own, ['b'], lookup))).toEqual(['a', 'c', 'd', 'b']);
    expect(ids(moveBy(own, ['a'], 1, lookup))).toEqual(['b', 'c', 'a', 'd']);
    expect(ids(moveBy(own, ['a'], -1, lookup))).toEqual(['a', 'b', 'c', 'd']);
    expect(ids(moveBy(own, ['b'], -1, lookup))).toEqual(['b', 'a', 'c', 'd']);
    expect(ids(moveBy(own, ['d'], 1, lookup))).toEqual(['b', 'a', 'c', 'd']);
  });
});

describe('the cover lead (§9.3)', () => {
  it('sets the lead, refusing a text card', () => {
    const r = setCoverLead(base(), 'c');
    expect(r.ok && r.album.cover).toEqual({ lead: 'c' });
    const withText = addText(base(), 'Hello', lookup).album;
    expect(setCoverLead(withText, 'text-1').ok).toBe(false);
  });
  it("puts it in the owner's lead tile, swapping with the tile that showed it", () => {
    const tiled: Album = { ...base(), cover: { tiles: [{ item: 'a', x: 0, y: 0, w: 8, h: 6 }, { item: 'b', x: 8, y: 0, w: 4, h: 3 }] } };
    const r = setCoverLead(tiled, 'b');
    expect(r.ok && r.album.cover && 'tiles' in r.album.cover && r.album.cover.tiles.map((t) => t.item)).toEqual(['b', 'a']);
  });
});

describe('the grid (§9.2)', () => {
  it('groups by day in a sorted order, undated last, and in one run in the own order', () => {
    const g = dayGroups(base(), lookup);
    expect(g.map((x) => [x.day, x.items.map((i) => i.id)])).toEqual([
      ['2026-05-01', ['b']],
      ['2026-05-02', ['a', 'c']],
      [undefined, ['d']],
    ]);
    expect(dayGroups(inOwnOrder(base(), lookup), lookup)).toHaveLength(1);
    expect(dayGroups({ items: [] }, lookup)).toEqual([]);
  });
  it('selects a range and toggles, in the order shown', () => {
    const order = ['b', 'a', 'c', 'd'];
    expect(pickRange(order, 'a', 'd')).toEqual(['a', 'c', 'd']);
    expect(pickRange(order, 'd', 'b')).toEqual(['b', 'a', 'c', 'd']);
    expect(pickRange(order, null, 'c')).toEqual(['c']);
    expect(pickToggle(order, ['c'], 'b')).toEqual(['b', 'c']);
    expect(pickToggle(order, ['b', 'c'], 'b')).toEqual(['c']);
  });
});

describe("an item's own settings in this album (§9.3 Downloads, §9.5 Play by itself and Loop, V49)", () => {
  const more: MediaLookup = (id) => (id === 'library/v' ? ({ kind: 'video', file: 'v.mp4', title: 'V' } as unknown as AlbumMedia) : id === 'library/y' ? ({ kind: 'embed', provider: 'youtube', id: 'x', title: 'Y' } as unknown as AlbumMedia) : MEDIA[id]);
  const withAv = (): Album => ({ ...base(), items: [...base().items, { id: 'v', media: 'library/v' }, { id: 'y', media: 'library/y' }] });

  it('sets, then follows the album again (the field taken out), never on a linked video', () => {
    const allowed = setItemDownload(withAv(), ['a', 'b', 'y'], true, more);
    expect(allowed.items.filter((i) => 'download' in i).map((i) => i.id)).toEqual(['a', 'b']);
    const denied = setItemDownload(allowed, ['a'], false, more);
    expect(denied.items.find((i) => i.id === 'a')).toEqual({ id: 'a', media: 'albums/trip/a', download: false });
    const follows = setItemDownload(denied, ['a', 'b'], undefined, more);
    expect(follows.items.some((i) => 'download' in i)).toBe(false);
    expect(follows.title).toBe('A trip');
  });

  it('returns the same album when nothing changes', () => {
    const a = withAv();
    expect(setItemDownload(a, ['a'], undefined, more)).toBe(a);
    expect(setItemPlay(a, 'a', { autoplay: true }, more)).toBe(a);
  });

  it('plays a video file by itself and loops it; off takes the field out; one setting leaves the other', () => {
    const on = setItemPlay(withAv(), 'v', { autoplay: true, loop: true }, more);
    expect(on.items.find((i) => i.id === 'v')).toEqual({ id: 'v', media: 'library/v', autoplay: true, loop: true });
    const off = setItemPlay(on, 'v', { autoplay: false }, more);
    expect(off.items.find((i) => i.id === 'v')).toEqual({ id: 'v', media: 'library/v', loop: true });
    expect(setItemPlay(off, 'y', { loop: true }, more).items.find((i) => i.id === 'y')).toEqual({ id: 'y', media: 'library/y' });
  });
});
