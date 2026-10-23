/**
 * Edit cover (documentation/gallery/spec.md §9.6): the arranger's model, pure. Tiles snap to whole cells, swap with
 * a same-size tile, push the rest down, never pass 12 rows, and every result is held to the album contract
 * (coverProblems, phoneProblems, the schema).
 */
import { describe, expect, it } from 'vitest';
import { album as albumSchema, type Album, type AlbumTile } from '../../src/site/content/schema';
import { albumProblems, coverOf, coverProblems, overlaps, phoneOf, phoneProblems, type AlbumMedia, type MediaLookup } from '../../src/site/content/album';
import { addText } from '../../src/site/editor/model/album';
import {
  PHONE,
  WIDE,
  arrangeForPhones,
  arrangeKey,
  canvasRows,
  cellAt,
  closeGaps,
  closeGapsIn,
  coverState,
  coverWarnings,
  firstFit,
  grow,
  moveTo,
  nudge,
  phoneJoined,
  phoneToAutomatic,
  place,
  placeWords,
  playRefusal,
  putInCover,
  resizeTo,
  setDisplay,
  setBackground,
  setLead,
  setOnPhones,
  setPlay,
  takeOut,
  useAutomatic,
  usePictureFocus,
  usePreset,
  type CoverFacts,
} from '../../src/site/editor/model/cover';
import type { Outcome } from '../../src/site/editor/model/album';

const MEDIA: Record<string, AlbumMedia> = Object.fromEntries(
  'abcdefghijklmn'.split('').map((k) => [`lib/${k}`, { kind: 'image', file: `${k}.webp`, alt: k.toUpperCase() } as AlbumMedia]),
);
MEDIA['lib/v'] = { kind: 'video', file: 'v.mp4', alt: 'V' } as unknown as AlbumMedia;
const lookup: MediaLookup = (id) => MEDIA[id];

const base = (n = 5, extra: Partial<Album> = {}): Album => ({
  id: 'trip',
  type: 'album',
  slug: 'trip',
  title: 'A trip',
  status: 'draft',
  createdAt: '2026-05-03',
  updatedAt: '2026-05-03',
  items: 'abcdefghijklmn'
    .slice(0, n)
    .split('')
    .map((k) => ({ id: k, media: `lib/${k}` })),
  ...extra,
});
const tiles = (...t: [string, number, number, number, number][]): AlbumTile[] => t.map(([item, x, y, w, h]) => ({ item, x, y, w, h }));
const arranged = (t: AlbumTile[], n = 5): Album => base(n, { cover: { tiles: t } });

const valid = (a: Album) => {
  const parsed = albumSchema.safeParse(a);
  expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
  expect(coverProblems(a)).toEqual([]);
  expect(phoneProblems(a)).toEqual([]);
  expect(albumProblems(a, lookup, { published: false })).toEqual([]);
};
const ok = (r: Outcome): Album => {
  if (!r.ok) throw new Error(r.why);
  valid(r.album);
  return r.album;
};
const why = (r: Outcome): string => {
  if (r.ok) throw new Error('expected a refusal');
  return r.why;
};
const at = (a: Album, item: string) => coverOf(a, lookup).find((t) => t.item === item);
const noOverlap = (t: readonly { x: number; y: number; w: number; h: number }[]) => {
  for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) expect(overlaps(t[i], t[j])).toBe(false);
};

describe('placing on the grid', () => {
  const two = tiles(['a', 0, 0, 6, 4], ['b', 6, 0, 6, 4], ['c', 0, 4, 4, 2]);

  it('swaps a tile dropped on one of its size, and moves nothing else', () => {
    const r = place(two, 'a', { x: 6, y: 0, w: 6, h: 4 }, WIDE);
    expect(r.ok && r.tiles).toEqual(tiles(['a', 6, 0, 6, 4], ['b', 0, 0, 6, 4], ['c', 0, 4, 4, 2]));
  });

  it('pushes the tiles it would overlap down, in reading order', () => {
    const r = place(two, 'c', { x: 4, y: 0, w: 4, h: 2 }, WIDE);
    if (!r.ok) throw new Error(r.why);
    expect(r.tiles.find((t) => t.item === 'c')).toMatchObject({ x: 4, y: 0 });
    expect(r.tiles.find((t) => t.item === 'a')).toMatchObject({ x: 0, y: 2 });
    expect(r.tiles.find((t) => t.item === 'b')).toMatchObject({ x: 6, y: 2 });
    noOverlap(r.tiles);
  });

  it('refuses past 12 rows, out of bounds, and outside the sizes, saying why', () => {
    const tall = tiles(['a', 0, 0, 12, 6], ['b', 0, 6, 12, 6]);
    expect(place(tall, 'b', { x: 0, y: 2, w: 12, h: 6 }, WIDE)).toMatchObject({ ok: false, why: expect.stringContaining('past 12 rows') });
    expect(place(two, 'c', { x: 0, y: 4, w: 1, h: 2 }, WIDE)).toMatchObject({ ok: false, why: expect.stringContaining('at least 2 columns') });
    expect(place(two, 'c', { x: 10, y: 4, w: 4, h: 2 }, WIDE)).toMatchObject({ ok: false, why: expect.stringContaining('last column') });
    expect(place(two, 'c', { x: 0, y: 4, w: 6, h: 9 }, PHONE)).toMatchObject({ ok: false, why: expect.stringContaining('on phones') });
    expect(place(two, 'gone', { x: 0, y: 0, w: 2, h: 2 }, WIDE).ok).toBe(false);
  });

  it('moves a cell at a time with the arrow keys, swapping with a lined-up twin', () => {
    const r = nudge(two, 'a', 'right', WIDE);
    expect(r.ok && r.tiles.slice(0, 2)).toEqual(tiles(['a', 6, 0, 6, 4], ['b', 0, 0, 6, 4]));
    expect(nudge(two, 'a', 'left', WIDE)).toMatchObject({ ok: false, why: expect.stringContaining('first column') });
    expect(nudge(two, 'a', 'up', WIDE)).toMatchObject({ ok: false, why: expect.stringContaining('top row') });
    const down = nudge(two, 'c', 'down', WIDE);
    expect(down.ok && down.tiles[2]).toMatchObject({ y: 5 });
  });

  it('resizes a cell at a time with Shift and the arrows, within the sizes', () => {
    const wider = grow(two, 'c', 'right', WIDE);
    expect(wider.ok && wider.tiles[2]).toMatchObject({ w: 5, h: 2 });
    expect(grow(two, 'c', 'up', WIDE)).toMatchObject({ ok: false, why: expect.stringContaining('at least 2 rows') });
    const taller = grow(two, 'a', 'down', WIDE);
    if (!taller.ok) throw new Error(taller.why);
    expect(taller.tiles[0]).toMatchObject({ h: 5 });
    expect(taller.tiles[2]).toMatchObject({ y: 5 });
    noOverlap(taller.tiles);
  });

  it('closes gaps: every tile moves up as far as it goes, keeping its column', () => {
    expect(closeGaps(tiles(['a', 0, 2, 6, 2], ['b', 6, 0, 6, 2], ['c', 6, 5, 6, 2]))).toEqual(tiles(['a', 0, 0, 6, 2], ['b', 6, 0, 6, 2], ['c', 6, 2, 6, 2]));
  });

  it('finds the first fit, the cell under a point, and says a place in words', () => {
    expect(firstFit(tiles(['a', 0, 0, 6, 4]), { w: 3, h: 2 })).toEqual({ x: 6, y: 0, w: 3, h: 2 });
    expect(firstFit(tiles(['a', 0, 0, 12, 12]), { w: 3, h: 2 })).toBeNull();
    expect(cellAt({ x: 95, y: -4 }, 30, 12)).toEqual({ x: 3, y: 0 });
    expect(cellAt({ x: 9999, y: 61 }, 30, 12)).toEqual({ x: 11, y: 2 });
    expect(placeWords({ x: 6, y: 0, w: 6, h: 2 })).toBe('columns 7 to 12, rows 1 to 2');
  });

  it('leaves room below the band to drop into, never past 12 wide rows', () => {
    expect(canvasRows(tiles(['a', 0, 0, 12, 4]), 'wide', true)).toBe(6);
    expect(canvasRows(tiles(['a', 0, 0, 12, 12]), 'wide', true)).toBe(12);
    expect(canvasRows(tiles(['a', 0, 0, 12, 4]), 'wide', false)).toBe(4);
  });
});

describe("the album's cover", () => {
  it('makes the automatic cover concrete on the first change', () => {
    const a = base();
    expect(a.cover).toBeUndefined();
    const auto = coverOf(a, lookup);
    const lead = auto[0];
    const r = ok(arrangeKey(a, 'wide', auto[1].item, 'down', true, lookup));
    expect(r.cover && 'tiles' in r.cover).toBe(true);
    expect(at(r, lead.item)).toEqual(lead);
    expect(coverState(r)).toEqual({ arranged: true, phoneArranged: false, count: auto.length });
  });

  it('moves and resizes by drag, refusing past 12 rows', () => {
    const a = arranged(tiles(['a', 0, 0, 6, 4], ['b', 6, 0, 6, 4]));
    expect(at(ok(moveTo(a, 'wide', 'a', { x: 0, y: 4 }, lookup)), 'a')).toMatchObject({ x: 0, y: 4 });
    expect(at(ok(resizeTo(a, 'wide', 'b', { w: 6, h: 8 }, lookup)), 'b')).toMatchObject({ w: 6, h: 8 });
    expect(why(resizeTo(a, 'wide', 'b', { w: 6, h: 13 }, lookup))).toContain('at most 12 rows');
    expect(why(moveTo(a, 'wide', 'a', { x: 0, y: 9 }, lookup))).toContain('past 12 rows');
  });

  it('closes the gaps of the band shown', () => {
    const r = ok(closeGapsIn(arranged(tiles(['a', 0, 3, 6, 4], ['b', 6, 0, 6, 4])), 'wide', lookup));
    expect(at(r, 'a')).toMatchObject({ y: 0 });
  });

  it('puts a picture in at 3 by 2, where it fits first or where it is dropped', () => {
    const a = arranged(tiles(['a', 0, 0, 6, 4]));
    expect(at(ok(putInCover(a, 'b', lookup)), 'b')).toEqual({ item: 'b', x: 6, y: 0, w: 3, h: 2 });
    const dropped = ok(putInCover(a, 'b', lookup, { x: 2, y: 1 }));
    expect(at(dropped, 'b')).toEqual({ item: 'b', x: 2, y: 1, w: 3, h: 2 });
    expect(at(dropped, 'a')).toMatchObject({ y: 3 });
    expect(at(ok(putInCover(a, 'b', lookup, { x: 11, y: 0 })), 'b')).toMatchObject({ x: 9 });
  });

  it('refuses a text card, a 13th tile, and a full grid', () => {
    const withText = addText(arranged(tiles(['a', 0, 0, 6, 4])), 'Day two', lookup);
    const text = withText.id;
    expect(why(putInCover(withText.album, text, lookup))).toContain('text card');
    const twelve = arranged(
      'abcdefghijkl'.split('').map((k, i) => ({ item: k, x: (i % 6) * 2, y: Math.floor(i / 6) * 2, w: 2, h: 2 })),
      13,
    );
    expect(why(putInCover(twelve, 'm', lookup))).toContain('at most 12 tiles');
    const full = arranged(tiles(['a', 0, 0, 12, 12]));
    expect(why(putInCover(full, 'b', lookup))).toContain('no room');
  });

  it('takes a tile out, never the last, keeping the phone in step', () => {
    const a = ok(arrangeForPhones(arranged(tiles(['a', 0, 0, 6, 4], ['b', 6, 0, 6, 4])), lookup));
    const r = ok(takeOut(a, 'b', lookup));
    expect(coverOf(r, lookup).map((t) => t.item)).toEqual(['a']);
    expect(phoneOf(r, lookup).map((t) => t.item)).toEqual(['a']);
    expect(why(takeOut(r, 'a', lookup))).toContain('at least one tile');
  });

  it('applies a preset to the tiles in the cover', () => {
    const r = ok(usePreset(arranged(tiles(['a', 0, 0, 2, 2], ['b', 4, 4, 2, 2], ['c', 8, 0, 2, 2])), 'lead-two', lookup));
    expect(coverOf(r, lookup)).toHaveLength(3);
  });

  it('goes back to the automatic cover, keeping the lead chosen before', () => {
    const a = arranged(tiles(['a', 0, 0, 6, 4]));
    expect(ok(useAutomatic(a)).cover).toBeUndefined();
    expect(ok(useAutomatic(a, 'c')).cover).toEqual({ lead: 'c' });
  });

  it('sets the lead by swapping with the lead tile', () => {
    const r = ok(setLead(arranged(tiles(['a', 0, 0, 8, 4], ['b', 8, 0, 4, 4])), 'b'));
    expect(at(r, 'b')).toMatchObject({ w: 8 });
  });
});

describe('on phones', () => {
  const a = arranged(tiles(['a', 0, 0, 12, 4], ['b', 0, 4, 4, 4], ['c', 4, 4, 4, 4]));

  it('is read-only until arranged, then arranged on 6 columns', () => {
    expect(why(arrangeKey(a, 'phone', 'a', 'down', false, lookup))).toContain('Arrange for phones first');
    const p = ok(arrangeForPhones(a, lookup));
    expect(coverState(p).phoneArranged).toBe(true);
    const moved = ok(arrangeKey(p, 'phone', 'b', 'right', false, lookup));
    expect(phoneOf(moved, lookup).find((t) => t.item === 'b')).toMatchObject({ x: 3 });
    expect(phoneOf(moved, lookup).find((t) => t.item === 'c')).toMatchObject({ x: 0 });
    expect(ok(phoneToAutomatic(moved)).cover).toEqual({ tiles: a.cover && 'tiles' in a.cover ? a.cover.tiles : [] });
  });

  it('notes a tile added to the wide band since', () => {
    const p = ok(arrangeForPhones(a, lookup));
    const next = ok(putInCover(p, 'd', lookup));
    expect(phoneJoined(p, next)).toEqual(['d']);
  });

  it('hides a tile on phones, never the last shown there', () => {
    const p = ok(arrangeForPhones(a, lookup));
    const hidden = ok(setOnPhones(p, 'b', false, lookup));
    expect(phoneOf(hidden, lookup).map((t) => t.item)).not.toContain('b');
    const shown = ok(setOnPhones(hidden, 'b', true, lookup));
    expect(phoneOf(shown, lookup).map((t) => t.item)).toContain('b');
    const one = arranged(tiles(['a', 0, 0, 12, 4]));
    expect(why(setOnPhones(one, 'a', false, lookup))).toContain('At least one tile');
  });
});

describe("a tile's options", () => {
  const a = base(5, { items: [...base(5).items, { id: 'v', media: 'lib/v' }], cover: { tiles: tiles(['a', 0, 0, 6, 4], ['v', 6, 0, 6, 4]) } });

  it('sets how a tile shows its item, refusing Fit over its own focus', () => {
    const fit = ok(setDisplay(a, 'a', 'fit', 'picture', lookup));
    expect(at(fit, 'a')).toMatchObject({ display: 'fit' });
    expect(at(ok(setDisplay(fit, 'a', 'kind', 'picture', lookup)), 'a')).not.toHaveProperty('display');
    const focused: Album = { ...a, cover: { tiles: tiles(['a', 0, 0, 6, 4], ['v', 6, 0, 6, 4]).map((t) => (t.item === 'a' ? { ...t, focus: '20% 30%' } : t)) } };
    expect(why(setDisplay(focused, 'a', 'fit', 'picture', lookup))).toContain('own focus');
    expect(at(ok(usePictureFocus(focused, 'a', lookup)), 'a')).not.toHaveProperty('focus');
  });

  it('sets a colour behind a tile’s picture, lowercase, and Auto removes it', () => {
    const own = ok(setBackground(a, 'a', '#1F2A44', lookup));
    expect(at(own, 'a')).toMatchObject({ bg: '#1f2a44' });
    expect(albumSchema.safeParse(own).success).toBe(true);
    expect(at(ok(setBackground(own, 'a', null, lookup)), 'a')).not.toHaveProperty('bg');
    expect(why(setBackground(a, 'a', 'red', lookup))).toContain('#1f2a44');
    expect(why(setBackground(a, 'x', '#ffffff', lookup))).toContain("isn't in the cover");
  });

  it('plays a video file within the limits', () => {
    expect(playRefusal(a, 'a', { kind: 'picture' }, lookup)).toContain('Only a video file');
    expect(playRefusal(a, 'v', { kind: 'video', bytes: 11 * 1024 * 1024 }, lookup)).toContain('11 MB');
    const on = ok(setPlay(a, 'v', true, { kind: 'video', bytes: 1024 }, lookup));
    expect(at(on, 'v')).toMatchObject({ play: true });
    expect(at(ok(setPlay(on, 'v', false, { kind: 'video' }, lookup)), 'v')).not.toHaveProperty('play');
  });

  it('warns of holes, height, panoramas, a missing focus and a heavy play tile', () => {
    const facts = (item: string): CoverFacts | undefined =>
      (({ a: { label: 'Sea', kind: 'picture', aspect: 4 }, v: { label: 'Waves', kind: 'video', aspect: 1, bytes: 5 * 1024 * 1024 } }) as Record<string, CoverFacts>)[item];
    const w = coverWarnings(
      { ...a, cover: { tiles: [{ item: 'a', x: 0, y: 0, w: 4, h: 2 }, { item: 'v', x: 6, y: 7, w: 4, h: 2, play: true }] } },
      'wide',
      lookup,
      facts,
    );
    expect(w.some((s) => s.includes('empty cell'))).toBe(true);
    expect(w.some((s) => s.includes('9 rows'))).toBe(true);
    expect(w.some((s) => s.includes('"Sea" is a wide panorama'))).toBe(true);
    expect(w.some((s) => s.includes('"Waves" plays'))).toBe(true);
    const narrow = coverWarnings({ ...a, cover: { tiles: [{ item: 'a', x: 0, y: 0, w: 6, h: 6 }] } }, 'wide', () => undefined, (i) => (i === 'a' ? { label: 'Sea', kind: 'picture', aspect: 2.2 } : undefined));
    expect(narrow.some((s) => s.includes('no focus point'))).toBe(true);
  });
});
