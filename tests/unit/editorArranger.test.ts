/**
 * Up front's arranger (documentation/gallery/spec.md §9.3, §18; plan G6, DoD rows 20 to 22): moves and resizes on
 * square cells that never overlap (a swap with a tile of the same size, a push down otherwise, refused past 12
 * rows), the keyboard's steps and their reasons, Close gaps, the presets, the tray, the phone's own arrangement
 * kept in step, and every override the arranger owns with its way back to automatic leaving the file exactly as
 * it was.
 */
import { describe, expect, it } from 'vitest';
import type { Album, AlbumTile } from '../../src/site/content/schema';
import { defaultShowcase, overlaps, phoneTiles, rowsOf, tileProblems, phoneProblems } from '../../src/site/content/album';
import type { AlbumCard, Edit } from '../../src/site/editor/model/album';
import {
  PHONE,
  PRESETS,
  WIDE,
  arrangeForPhones,
  arrangeKey,
  arrangerView,
  arrangerWarnings,
  backToAutomatic,
  closeGaps,
  closeGapsIn,
  focusAt,
  grow,
  moveTo,
  nudge,
  nudgeFocus,
  phoneJoined,
  place,
  placeWords,
  putUpFront,
  resizeTo,
  setDisplay,
  setOnPhones,
  setPlay,
  setTileFocus,
  takeOut,
  useDefault,
  usePreset,
} from '../../src/site/editor/model/arranger';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `i${i + 1}`);
const items = (list: string[]) => list.map((id) => ({ id, media: `m/${id}` }));
// the fixture album's band (tests/fixtures/gallery/content/articles/fixture-album.json)
const BAND: AlbumTile[] = [
  { item: 'p01', x: 0, y: 0, w: 8, h: 4, focus: '50% 40%' },
  { item: 'clip', x: 8, y: 0, w: 4, h: 2, play: true },
  { item: 'anim', x: 8, y: 2, w: 4, h: 2, play: true },
  { item: 'plan', x: 0, y: 4, w: 4, h: 3 },
  { item: 'p02', x: 4, y: 4, w: 4, h: 3 },
  { item: 'talk', x: 8, y: 4, w: 4, h: 3, onPhones: false },
];
const arranged = (): Album => ({ items: items(['p01', 'p02', 'p03', 'anim', 'plan', 'clip', 'talk', 'p04']), showcase: { tiles: structuredClone(BAND) }, layout: 'grid' } as Album);
const plain = (n = 8): Album => ({ items: items(ids(n)), dates: false } as Album);
const ok = (e: Edit): Album => {
  if (!e.ok) throw new Error(`refused: ${e.reason}`);
  return e.album;
};
const reason = (e: Edit) => (e.ok ? '' : e.reason);
const tile = (a: Album, item: string) => a.showcase!.tiles.find((t) => t.item === item)!;
const sound = (a: Album) => expect([...tileProblems(a), ...phoneProblems(a)]).toEqual([]);
const same = (a: Album, b: Album) => expect(JSON.stringify(a)).toBe(JSON.stringify(b));

describe('the grid: whole cells, never overlapping (§9.3)', () => {
  it('reads a place as columns and rows, from 1', () => {
    expect(placeWords({ x: 6, y: 0, w: 6, h: 2 })).toBe('columns 7 to 12, rows 1 to 2');
  });

  it('a tile dropped on one of the same size swaps with it, and nothing else moves', () => {
    const r = place(BAND, 'clip', { x: 8, y: 2, w: 4, h: 2 }, WIDE);
    expect(r.ok && r.tiles.map((t) => [t.item, t.x, t.y])).toEqual([['p01', 0, 0], ['clip', 8, 2], ['anim', 8, 0], ['plan', 0, 4], ['p02', 4, 4], ['talk', 8, 4]]);
  });

  it('dropped anywhere else, it takes the place and pushes the tiles it would cover down, in reading order', () => {
    const r = place(BAND, 'clip', { x: 0, y: 4, w: 4, h: 2 }, WIDE);
    if (!r.ok) throw new Error(r.reason);
    expect(r.tiles.find((t) => t.item === 'clip')).toMatchObject({ x: 0, y: 4 });
    expect(r.tiles.find((t) => t.item === 'plan')).toMatchObject({ x: 0, y: 6 });
    expect(r.tiles.find((t) => t.item === 'p02')).toMatchObject({ x: 4, y: 4 });
    for (let i = 0; i < r.tiles.length; i++) for (let j = i + 1; j < r.tiles.length; j++) expect(overlaps(r.tiles[i], r.tiles[j])).toBe(false);
  });

  it('refuses a change that would push the band past 12 rows, saying why', () => {
    const r = place(BAND, 'p01', { x: 0, y: 0, w: 12, h: 8 }, WIDE);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(/past 12 rows/);
  });

  it('keeps a tile 2 to 12 cells each way, and inside the columns', () => {
    expect(place(BAND, 'clip', { x: 8, y: 0, w: 1, h: 2 }, WIDE)).toMatchObject({ ok: false, reason: 'A tile is at least 2 columns wide.' });
    expect(place(BAND, 'clip', { x: 10, y: 0, w: 4, h: 2 }, WIDE)).toMatchObject({ ok: false, reason: 'It already reaches the last column.' });
    expect(place(BAND, 'clip', { x: 0, y: 0, w: 4, h: 9 }, PHONE)).toMatchObject({ ok: false, reason: 'A tile is at most 8 rows tall on phones.' });
  });

  it('an arrow key moves a cell, swaps with a lined-up twin, and says why at an edge', () => {
    const down = nudge(BAND, 'clip', 'down', WIDE);
    expect(down.ok && down.tiles.find((t) => t.item === 'anim')).toMatchObject({ x: 8, y: 0 });
    expect(nudge(BAND, 'clip', 'right', WIDE)).toMatchObject({ ok: false, reason: 'It already reaches the last column.' });
    expect(nudge(BAND, 'p01', 'left', WIDE)).toMatchObject({ ok: false, reason: "It's already in the first column." });
    expect(nudge(BAND, 'p01', 'up', WIDE)).toMatchObject({ ok: false, reason: "It's already in the top row." });
    const left = nudge(BAND, 'p02', 'left', WIDE);
    expect(left.ok && left.tiles.find((t) => t.item === 'plan')).toMatchObject({ x: 4, y: 4 });
  });

  it('Shift with an arrow key resizes a cell, pushing what it covers down, with the reasons at the limits', () => {
    const taller = grow(BAND, 'clip', 'down', WIDE);
    expect(taller.ok && taller.tiles.find((t) => t.item === 'clip')).toMatchObject({ w: 4, h: 3 });
    expect(taller.ok && taller.tiles.find((t) => t.item === 'anim')).toMatchObject({ y: 3 });
    expect(grow(BAND, 'clip', 'up', WIDE)).toMatchObject({ ok: false, reason: 'A tile is at least 2 rows tall.' });
    expect(grow(BAND, 'clip', 'right', WIDE)).toMatchObject({ ok: false, reason: 'It already reaches the last column.' });
    const narrower = grow(BAND, 'p01', 'left', WIDE);
    expect(narrower.ok && narrower.tiles.find((t) => t.item === 'p01')).toMatchObject({ w: 7 });
  });

  it('Close gaps moves every tile up as far as it goes, keeping its column', () => {
    const gappy = [
      { item: 'a', x: 0, y: 0, w: 4, h: 2 },
      { item: 'b', x: 4, y: 3, w: 4, h: 2 },
      { item: 'c', x: 0, y: 5, w: 4, h: 2 },
    ];
    expect(closeGaps(gappy).map((t) => [t.item, t.x, t.y])).toEqual([['a', 0, 0], ['b', 4, 0], ['c', 0, 2]]);
  });
});

describe("the album's changes (§9.3)", () => {
  it('moving a tile of the default band makes it the owner\'s; every result passes the content check', () => {
    const a = ok(moveTo(plain(), 'wide', 'i5', { x: 0, y: 8 }));
    expect(a.showcase?.tiles).toHaveLength(5);
    expect(tile(a, 'i5')).toMatchObject({ x: 0, y: 8 });
    sound(a);
  });

  it('resizing and the keyboard save the same way', () => {
    sound(ok(resizeTo(arranged(), 'wide', 'clip', { w: 4, h: 4 })));
    expect(tile(ok(arrangeKey(arranged(), 'wide', 'plan', 'right', true)), 'plan')).toMatchObject({ w: 5 });
    expect(reason(arrangeKey(arranged(), 'wide', 'p01', 'up', false))).toBe("It's already in the top row.");
  });

  it('Close gaps moves the tiles up, on the wide band and on an arranged phone band', () => {
    const gappy = ok(moveTo(arranged(), 'wide', 'plan', { x: 0, y: 6 }));
    const closed = ok(closeGapsIn(gappy, 'wide'));
    expect(tile(closed, 'plan')).toMatchObject({ x: 0, y: 4 });
    sound(closed);
    sound(ok(closeGapsIn(ok(arrangeForPhones(arranged())), 'phone')));
  });

  it('the tray puts an item up front at 3 by 2, where it is dropped or where it fits first; dragged out, it leaves', () => {
    const dropped = ok(putUpFront(arranged(), 'p03', { x: 0, y: 4 }));
    expect(tile(dropped, 'p03')).toMatchObject({ x: 0, y: 4, w: 3, h: 2 });
    sound(dropped);
    expect(tile(ok(putUpFront(arranged(), 'p03')), 'p03')).toMatchObject({ x: 0, y: 7, w: 3, h: 2 });
    expect(ok(takeOut(arranged(), 'talk')).showcase!.tiles.map((t) => t.item)).not.toContain('talk');
  });

  it('refuses a 13th tile, and the band\'s last one leaving', () => {
    const full: Album = { items: items(ids(13)), showcase: { tiles: ids(12).map((item, i) => ({ item, x: (i % 6) * 2, y: Math.floor(i / 6) * 2, w: 2, h: 2 })) } };
    expect(reason(putUpFront(full, 'i13'))).toMatch(/at most 12 tiles/);
    const one: Album = { items: items(['a', 'b']), showcase: { tiles: [{ item: 'a', x: 0, y: 0, w: 4, h: 2 }] } };
    expect(reason(takeOut(one, 'a'))).toMatch(/at least one tile/);
  });

  it('a preset arranges the tiles up front, keeping their settings; every preset holds 12 tiles within 12 rows', () => {
    const a = ok(usePreset(arranged(), 'pairs'));
    expect(a.showcase!.tiles).toHaveLength(6);
    expect(tile(a, 'talk').onPhones).toBe(false);
    sound(a);
    const twelve: Album = { items: items(ids(12)), showcase: { tiles: ids(12).map((item, i) => ({ item, x: (i % 6) * 2, y: Math.floor(i / 6) * 2, w: 2, h: 2 })) } };
    // the contract's presets step down their head until the rest fits, so the refusal is only a safety net
    for (const p of PRESETS) sound(ok(usePreset(twelve, p.id, () => (p.id === 'fit' ? 0.5 : undefined))));
  });

  it("the phone's moves need its own arrangement, on 6 columns", () => {
    expect(reason(moveTo(arranged(), 'phone', 'p01', { x: 0, y: 2 }))).toMatch(/Arrange for phones first/);
    const a = ok(arrangeForPhones(arranged()));
    expect(a.showcase!.phone!.tiles).toEqual(phoneTiles(BAND));
    const moved = ok(arrangeKey(a, 'phone', 'clip', 'right', false));
    expect(reason(arrangeKey(a, 'phone', 'p01', 'right', false))).toBe('It already reaches the last column.');
    expect(moved.showcase!.tiles).toEqual(a.showcase!.tiles);
    sound(moved);
  });

  it('a tile put up front wide joins the end of the phone\'s own arrangement, and one taken out leaves it', () => {
    const a = ok(arrangeForPhones(arranged()));
    const added = ok(putUpFront(a, 'p03'));
    expect(phoneJoined(a, added)).toEqual(['p03']);
    const p = added.showcase!.phone!.tiles;
    expect(p.at(-1)).toMatchObject({ item: 'p03', y: rowsOf(a.showcase!.phone!.tiles) });
    sound(added);
    const gone = ok(takeOut(added, 'clip'));
    expect(gone.showcase!.phone!.tiles.map((t) => t.item)).not.toContain('clip');
    sound(gone);
  });

  it('play is refused for a still picture, a file over 10 MB and a third tile, each with its reason', () => {
    const a = ok(putUpFront(arranged(), 'p03'));
    expect(reason(setPlay(a, 'p03', true, { kind: 'picture' }))).toMatch(/Only a video file or an animated picture/);
    const b = ok(setPlay(arranged(), 'clip', false, { kind: 'video' }));
    expect(reason(setPlay(b, 'clip', true, { kind: 'video', bytes: 11 * 1024 * 1024 }))).toMatch(/at most 10 MB/);
    const c = ok(putUpFront(arranged(), 'p04'));
    expect(reason(setPlay(c, 'p04', true, { kind: 'animated' }))).toMatch(/At most 2 tiles play/);
  });

  it('focus and display refuse what the content check would', () => {
    expect(reason(setTileFocus(arranged(), 'p02', '30% 60%', 'drawing'))).toMatch(/a filled tile/);
    expect(reason(setDisplay(arranged(), 'p01', 'fit', 'picture'))).toMatch(/own focus point/);
    expect(reason(setTileFocus(arranged(), 'p02', '130% 60%', 'picture'))).toMatch(/0% to 100%/);
    expect(focusAt(0.333, 1.4)).toBe('33% 100%');
    expect(nudgeFocus('50% 40%', 'right')).toBe('55% 40%');
  });

  it('hiding the last tile shown on phones is refused', () => {
    const one: Album = { items: items(['a', 'b']), showcase: { tiles: [{ item: 'a', x: 0, y: 0, w: 4, h: 2 }, { item: 'b', x: 4, y: 0, w: 4, h: 2, onPhones: false }] } };
    expect(reason(setOnPhones(one, 'a', false))).toMatch(/At least one tile is shown on phones/);
  });
});

describe('§18: each override the arranger owns, and its way back leaving the file exactly as it was', () => {
  // the fixture's item on the arranged band, else the default band's
  const pick = (a: Album, fixture: string, def: string) => (a.items.some((i) => i.id === 'p01') ? fixture : def);
  // the fixture band already plays on 2 tiles: one is turned off before playing another
  const twoPlaying = (a: Album) => (a.items.some((i) => i.id === 'p01') ? ok(setPlay(a, 'anim', false, { kind: 'animated' })) : a);
  // [row, override, back, the key it stores, what the band was before (an arranged band, by default)]
  const ROWS: [string, (a: Album) => Edit, (a: Album) => Edit, string, ((a: Album) => Album)?][] = [
    ['which items are up front: Use the default', (a) => moveTo(a, 'wide', pick(a, 'plan', 'i5'), { x: 4, y: 9 }), useDefault, 'showcase'],
    ["the phone's band: Back to automatic", arrangeForPhones, backToAutomatic, 'phone'],
    ['a tile on phones: Show on phones', (a) => setOnPhones(a, pick(a, 'p02', 'i2'), false), (a) => setOnPhones(a, pick(a, 'p02', 'i2'), true), 'onPhones'],
    ['how a tile shows its item: By kind', (a) => setDisplay(a, pick(a, 'plan', 'i3'), 'fit', 'picture'), (a) => setDisplay(a, pick(a, 'plan', 'i3'), 'kind', 'picture'), 'display'],
    ["where a tile is cropped: Use the picture's focus", (a) => setTileFocus(a, pick(a, 'p02', 'i1'), '20% 70%', 'picture'), (a) => setTileFocus(a, pick(a, 'p02', 'i1'), undefined, 'picture'), 'focus'],
    ['a tile that plays: turning it off', (a) => setPlay(a, pick(a, 'anim', 'i4'), true, { kind: 'animated', bytes: 1024 }), (a) => setPlay(a, pick(a, 'anim', 'i4'), false, { kind: 'animated' }), 'play', twoPlaying],
  ];

  it.each(ROWS)('%s, on an arranged band', (_, override, back, key, prep) => {
    const before = prep ? prep(arranged()) : arranged();
    const changed = ok(override(before));
    expect(JSON.stringify(changed)).not.toBe(JSON.stringify(before));
    expect(JSON.stringify(changed)).toContain(`"${key}"`);
    sound(changed);
    const after = ok(back(changed));
    // Use the default goes further than the file was: it removes the arrangement itself
    if (key === 'showcase') expect(after.showcase).toBeUndefined();
    else same(after, before);
  });

  it.each(ROWS)('%s, on the default band', (_, override, back, key) => {
    const before = plain();
    const changed = ok(override(before));
    expect(JSON.stringify(changed)).toContain(`"${key}"`);
    sound(changed);
    same(ok(back(changed)), before);
  });

  it('a hidden tile shown again on phones, with a phone arrangement, rejoins at its end (§6.3)', () => {
    const a = ok(arrangeForPhones(arranged()));
    const hidden = ok(setOnPhones(a, 'plan', false));
    expect(hidden.showcase!.phone!.tiles.map((t) => t.item)).not.toContain('plan');
    const shown = ok(setOnPhones(hidden, 'plan', true));
    expect(shown.showcase!.phone!.tiles.at(-1)?.item).toBe('plan');
    sound(shown);
  });

  it('Use the default on a band arranged for phones removes both', () => {
    const a = ok(useDefault(ok(arrangeForPhones(arranged()))));
    expect(a.showcase).toBeUndefined();
    expect(Object.keys(a)).toEqual(['items', 'layout']);
  });
});

describe('what the arranger draws', () => {
  const cards: AlbumCard[] = ['p01', 'p02', 'p03', 'anim', 'plan', 'clip', 'talk', 'p04'].map((id) => ({
    id,
    kind: id === 'plan' ? 'drawing' : id === 'clip' ? 'video' : id === 'anim' ? 'animated' : id === 'talk' ? 'embed' : 'picture',
    width: id === 'p02' ? 1200 : 1600,
    height: id === 'p02' ? 400 : 1200,
    label: `The ${id}`,
    dimmed: false,
    upFront: true,
    item: { id, media: id },
  }));

  it('lists the tiles in reading order with their places, the tray, and the chosen tile', () => {
    const v = arrangerView(arranged(), cards, () => 1024, 'wide', 'plan');
    expect(v.tiles.map((t) => t.item)).toEqual(['p01', 'clip', 'anim', 'plan', 'p02', 'talk']);
    expect(v.tiles[0]).toMatchObject({ place: 'columns 1 to 8, rows 1 to 4', display: 'fill', focus: '50% 40%' });
    expect(v.tiles.find((t) => t.item === 'plan')?.display).toBe('fit');
    expect(v.tray.map((t) => t.item)).toEqual(['p03', 'p04']);
    expect(v.chosen).toMatchObject({ item: 'plan', choice: 'kind', byKind: 'fit', ownFocus: false });
    expect(v.chosen?.noPlay).toMatch(/Only a video file/);
    expect(v).toMatchObject({ arranged: true, phoneArranged: false, columns: 12, rows: 9, full: false });
  });

  it("shows the phone's band: worked out, then the owner's", () => {
    const v = arrangerView(arranged(), cards, () => undefined, 'phone');
    expect(v.columns).toBe(6);
    expect(v.tiles.map((t) => t.item)).not.toContain('talk');
    expect(v.phoneArranged).toBe(false);
    expect(arrangerView(ok(arrangeForPhones(arranged())), cards, () => undefined, 'phone').phoneArranged).toBe(true);
  });

  it('warns of a hole, a tall band, a heavy playing tile and a panorama in a small tile, never refusing', () => {
    const a = ok(moveTo(arranged(), 'wide', 'talk', { x: 8, y: 8 }));
    const w = arrangerWarnings(a, 'wide', (item) => ({ card: cards.find((c) => c.id === item), bytes: item === 'clip' ? 5 * 1024 * 1024 : 1024 }));
    expect(w.join('\n')).toMatch(/empty cells/);
    expect(w.join('\n')).toMatch(/11 rows tall/);
    expect(w.join('\n')).toMatch(/"The clip" plays in the band and is 5 MB/);
    expect(w.join('\n')).toMatch(/"The p02" is a wide panorama in a small tile/);
    const narrow: Album = { items: items(['p01', 'p02']), showcase: { tiles: [{ item: 'p01', x: 0, y: 0, w: 2, h: 4 }, { item: 'p02', x: 2, y: 0, w: 10, h: 4 }] } };
    expect(arrangerWarnings(narrow, 'wide', (item) => ({ card: cards.find((c) => c.id === item) }))).toEqual(['"The p01" has no focus point and fills a tile much narrower than it: set its focus here, so the right part shows.']);
  });

  it('the default band is drawn as it will show', () => {
    const v = arrangerView(plain(), [], () => undefined, 'wide');
    expect(v.tiles.map((t) => [t.x, t.y, t.w, t.h])).toEqual(defaultShowcase(plain().items).map((t) => [t.x, t.y, t.w, t.h]));
    expect(v.arranged).toBe(false);
  });
});
