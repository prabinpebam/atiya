/**
 * Edit cover (documentation/gallery/spec.md §9.6), pure: the cover's tiles on the band's grid of square cells (12
 * columns and at most 12 rows; 6 columns on a phone), moved and resized by whole cells, by pointer and by keyboard,
 * never overlapping. A tile dropped on one of the same size swaps with it; anywhere else it takes the place and the
 * tiles it would overlap are pushed down, in reading order, and a change that would push the cover past 12 rows is
 * refused, saying why. Arranging starts from the cover as shown (`coverOf`: the automatic cover made concrete on the
 * first change), and every way back (Use automatic cover, the phone's Back to automatic) removes what it stands for.
 * Every change returns a new album or a refusal (model/album.ts `Outcome`); scripts/albumCover.ts only wires them.
 */
import type { Album, AlbumTile, PhoneTile, TileDisplay } from '../../content/schema';
import { COVER_MAX_TILES, GRID_COLUMNS, GRID_ROWS_MAX, PHONE_COLUMNS, PHONE_ROWS_WARN, PHONE_TILE_H_MAX, PLAY_MAX_BYTES, PLAY_MAX_TILES, PLAY_WARN_BYTES, ROWS_WARN, TILE_MIN } from '../../content/schema';
import {
  PRESETS,
  applyPreset,
  arrangedTiles,
  coverLead,
  coverOf,
  displayFor,
  holes,
  isMediaItem,
  keepPhoneInStep,
  overlaps,
  phoneOf,
  phoneTiles,
  presetRects,
  readingOrder,
  rowsOf,
  shownOnPhones,
  type ItemKind,
  type MediaLookup,
  type PresetId,
  type Rect,
} from '../../content/album';
import { setCoverLead, type Outcome } from './album';

export { PRESETS, setCoverLead as setLead, type PresetId, type Rect };

const done = (album: Album, note?: string): Outcome => ({ ok: true, album, ...(note ? { note } : {}) });
const refused = (why: string): Outcome => ({ ok: false, why });

// ---------- the grids ----------

/** Which band: the wide one, or the phone's. */
export type Show = 'wide' | 'phone';

/** A grid's bounds: its columns, a tile's least and most size, and its most rows. */
export interface Grid {
  columns: number;
  minW: number;
  maxW: number;
  minH: number;
  maxH: number;
  rows: number;
}
export const WIDE: Grid = { columns: GRID_COLUMNS, minW: TILE_MIN, maxW: GRID_COLUMNS, minH: TILE_MIN, maxH: GRID_ROWS_MAX, rows: GRID_ROWS_MAX };
export const PHONE: Grid = { columns: PHONE_COLUMNS, minW: TILE_MIN, maxW: PHONE_COLUMNS, minH: TILE_MIN, maxH: PHONE_TILE_H_MAX, rows: Infinity };
export const gridOf = (show: Show): Grid => (show === 'phone' ? PHONE : WIDE);

/** A tile added from the strip: 3 columns by 2 rows (§9.6). */
export const NEW_TILE = { w: 3, h: 2 } as const;

type Placed = Rect & { item: string };
/** A placement: the tiles after it, or a refusal with its reason. */
export type Placement<T> = { ok: true; tiles: T[] } | { ok: false; why: string };

/** A place in words, as the live region reads it: "columns 7 to 12, rows 1 to 2". */
export const placeWords = (r: Rect): string => `columns ${r.x + 1} to ${r.x + r.w}, rows ${r.y + 1} to ${r.y + r.h}`;

const TOO_TALL = (rows: number) => `That would push the cover past ${rows} rows: close a gap, make a tile smaller or take one out first.`;
const GONE = 'That tile is no longer in the cover.';

/** Why a rect doesn't fit the grid, or null. */
function outOfBounds(r: Rect, g: Grid): string | null {
  if (r.w < g.minW) return `A tile is at least ${g.minW} columns wide.`;
  if (r.h < g.minH) return `A tile is at least ${g.minH} rows tall.`;
  if (r.w > g.maxW) return `A tile is at most ${g.maxW} columns wide.`;
  if (r.h > g.maxH) return `A tile is at most ${g.maxH} rows tall${g === PHONE ? ' on phones' : ''}.`;
  if (r.x < 0) return "It's already in the first column.";
  if (r.y < 0) return "It's already in the top row.";
  if (r.x + r.w > g.columns) return 'It already reaches the last column.';
  if (r.y + r.h > g.rows) return TOO_TALL(g.rows);
  return null;
}

/** The tile at `r` (the same object when nothing changed). */
const withRect = <T extends Placed>(t: T, r: Rect): T => (t.x === r.x && t.y === r.y && t.w === r.w && t.h === r.h ? t : { ...t, x: r.x, y: r.y, w: r.w, h: r.h });

/**
 * A tile put at `rect` (§9.6): on a tile of the same size (at its origin), the two swap and nothing else moves;
 * anywhere else it takes the place and the tiles it would overlap are pushed down, in reading order, until nothing
 * overlaps. Refused out of the grid's bounds or past its rows, saying why.
 */
export function place<T extends Placed>(tiles: readonly T[], item: string, rect: Rect, grid: Grid): Placement<T> {
  const me = tiles.find((t) => t.item === item);
  if (!me) return { ok: false, why: GONE };
  const why = outOfBounds(rect, grid);
  if (why) return { ok: false, why };
  if (withRect(me, rect) === me) return { ok: true, tiles: [...tiles] };
  const same = rect.w === me.w && rect.h === me.h;
  const other = same ? tiles.find((t) => t !== me && t.x === rect.x && t.y === rect.y && t.w === me.w && t.h === me.h) : undefined;
  if (other) return { ok: true, tiles: tiles.map((t) => (t === me ? withRect(t, rect) : t === other ? withRect(t, me) : t)) };
  return pushDown(tiles, me, rect, grid);
}

/** `me` at `rect`, and the tiles it would overlap pushed down, in reading order; refused past the grid's rows. */
function pushDown<T extends Placed>(tiles: readonly T[], me: T, rect: Rect, grid: Grid): Placement<T> {
  const settled: Rect[] = [rect];
  const moved = new Map<T, Rect>([[me, rect]]);
  for (const t of readingOrder(tiles.filter((x) => x !== me))) {
    let y = t.y;
    while (settled.some((s) => overlaps(s, { ...t, y }))) y++;
    const r = { x: t.x, y, w: t.w, h: t.h };
    settled.push(r);
    moved.set(t, r);
  }
  if (rowsOf(settled) > grid.rows) return { ok: false, why: TOO_TALL(grid.rows) };
  return { ok: true, tiles: tiles.map((t) => withRect(t, moved.get(t)!)) };
}

/** A direction, for the arrow keys and the tile bar's buttons. */
export type Dir = 'left' | 'right' | 'up' | 'down';
const STEP: Record<Dir, [number, number]> = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

/** An arrow key: the tile moves a cell; into a tile of its size lined up with it, the two swap. */
export function nudge<T extends Placed>(tiles: readonly T[], item: string, dir: Dir, grid: Grid): Placement<T> {
  const me = tiles.find((t) => t.item === item);
  if (!me) return { ok: false, why: GONE };
  const [dx, dy] = STEP[dir];
  const to = { x: me.x + dx, y: me.y + dy, w: me.w, h: me.h };
  if (to.x < 0) return { ok: false, why: "It's already in the first column." };
  if (to.x + to.w > grid.columns) return { ok: false, why: 'It already reaches the last column.' };
  if (to.y < 0) return { ok: false, why: "It's already in the top row." };
  const twin = tiles.find((t) => t !== me && t.w === me.w && t.h === me.h && overlaps(t, to) && (dx ? t.y === me.y : t.x === me.x));
  if (twin) return { ok: true, tiles: tiles.map((t) => (t === me ? withRect(t, twin) : t === twin ? withRect(t, me) : t)) };
  return place(tiles, item, to, grid);
}

/** Shift with an arrow key: right and down make the tile a cell wider or taller, left and up a cell narrower or shorter. */
export function grow<T extends Placed>(tiles: readonly T[], item: string, dir: Dir, grid: Grid): Placement<T> {
  const me = tiles.find((t) => t.item === item);
  if (!me) return { ok: false, why: GONE };
  const r = { x: me.x, y: me.y, w: me.w + (dir === 'right' ? 1 : dir === 'left' ? -1 : 0), h: me.h + (dir === 'down' ? 1 : dir === 'up' ? -1 : 0) };
  return place(tiles, item, r, grid);
}

/** Close gaps (§9.6): every tile moves up as far as it goes, in reading order, keeping its column. */
export function closeGaps<T extends Placed>(tiles: readonly T[]): T[] {
  const at = new Map<T, Rect>(tiles.map((t) => [t, t]));
  for (const t of readingOrder(tiles)) {
    let y = t.y;
    const free = (yy: number) => ![...at].some(([o, r]) => o !== t && overlaps(r, { ...t, y: yy }));
    while (y > 0 && free(y - 1)) y--;
    at.set(t, { x: t.x, y, w: t.w, h: t.h });
  }
  return tiles.map((t) => withRect(t, at.get(t)!));
}

/** The first place a `w` by `h` tile fits among `tiles` (reading order), or null. */
export function firstFit(tiles: readonly Rect[], size: { w: number; h: number }, grid: Grid = WIDE): Rect | null {
  const last = Number.isFinite(grid.rows) ? grid.rows - size.h : rowsOf(tiles);
  for (let y = 0; y <= last; y++)
    for (let x = 0; x + size.w <= grid.columns; x++) {
      const r = { x, y, ...size };
      if (!tiles.some((t) => overlaps(t, r))) return r;
    }
  return null;
}

/** The cell under a point on the canvas (its offset from the canvas's start, in px), within the grid's columns. */
export function cellAt(offset: { x: number; y: number }, pitch: number, columns: number): { x: number; y: number } {
  const c = (n: number) => Math.floor(n / Math.max(1, pitch));
  return { x: Math.min(columns - 1, Math.max(0, c(offset.x))), y: Math.max(0, c(offset.y)) };
}

// ---------- the album's changes ----------

/** The wide cover set to `tiles`, the phone's own arrangement (when there is one) kept in step. */
function withWide(album: Album, tiles: AlbumTile[]): Album {
  const own = album.cover && 'tiles' in album.cover ? album.cover.phone?.tiles : undefined;
  const phone = own ? keepPhoneInStep(own, tiles) : null;
  return { ...album, cover: { tiles, ...(phone?.length ? { phone: { tiles: phone } } : {}) } };
}

const PHONE_FIRST = "Arrange for phones first: until then the phone's cover is worked out from the wide one.";

/** A placement of the shown band's tiles applied to the album (an automatic cover becomes concrete tiles). */
function arrange(album: Album, show: Show, lookup: MediaLookup, fn: <T extends Placed>(tiles: readonly T[], grid: Grid) => Placement<T>): Outcome {
  if (show === 'phone') {
    const cover = album.cover && 'tiles' in album.cover ? album.cover : undefined;
    if (!cover?.phone) return refused(PHONE_FIRST);
    const r = fn(cover.phone.tiles, PHONE);
    return r.ok ? done({ ...album, cover: { ...cover, phone: { tiles: r.tiles } } }) : refused(r.why);
  }
  const r = fn(coverOf(album, lookup), WIDE);
  return r.ok ? done(withWide(album, r.tiles)) : refused(r.why);
}

/** The tiles of the band shown. */
export const shownTiles = (album: Album, show: Show, lookup: MediaLookup): (AlbumTile | PhoneTile)[] => (show === 'phone' ? phoneOf(album, lookup) : coverOf(album, lookup));

/** A tile dragged to a cell (its top-left corner). */
export const moveTo = (album: Album, show: Show, item: string, at: { x: number; y: number }, lookup: MediaLookup): Outcome =>
  arrange(album, show, lookup, (tiles, g) => {
    const me = tiles.find((t) => t.item === item);
    return me ? place(tiles, item, { ...at, w: me.w, h: me.h }, g) : { ok: false, why: GONE };
  });

/** A tile resized by its handles (its top-left corner stays). */
export const resizeTo = (album: Album, show: Show, item: string, size: { w: number; h: number }, lookup: MediaLookup): Outcome =>
  arrange(album, show, lookup, (tiles, g) => {
    const me = tiles.find((t) => t.item === item);
    return me ? place(tiles, item, { x: me.x, y: me.y, ...size }, g) : { ok: false, why: GONE };
  });

/** An arrow key (or the tile bar's button): moves the tile a cell, or with `resize` changes its size a cell. */
export const arrangeKey = (album: Album, show: Show, item: string, dir: Dir, resize: boolean, lookup: MediaLookup): Outcome =>
  arrange(album, show, lookup, (tiles, g) => (resize ? grow(tiles, item, dir, g) : nudge(tiles, item, dir, g)));

/** Close gaps, on the band shown. */
export const closeGapsIn = (album: Album, show: Show, lookup: MediaLookup): Outcome => arrange(album, show, lookup, (tiles) => ({ ok: true, tiles: closeGaps(tiles) }));

/** An item put in the cover (§9.6) at 3 by 2: where it's dropped (pushing tiles down), or where it fits first. */
export function putInCover(album: Album, item: string, lookup: MediaLookup, at?: { x: number; y: number }): Outcome {
  const it = album.items.find((i) => i.id === item);
  if (!it) return refused('That item is no longer in the album.');
  if (!isMediaItem(it)) return refused('A text card can’t be in the cover: choose a picture or a video.');
  const tiles = coverOf(album, lookup);
  if (tiles.some((t) => t.item === item)) return at ? moveTo(album, 'wide', item, at, lookup) : done(album);
  if (tiles.length >= COVER_MAX_TILES) return refused(`The cover holds at most ${COVER_MAX_TILES} tiles: take one out first.`);
  if (!at) {
    const fit = firstFit(tiles, NEW_TILE);
    if (!fit) return refused(`There's no room for a ${NEW_TILE.w} by ${NEW_TILE.h} tile within ${GRID_ROWS_MAX} rows: close a gap or make a tile smaller first.`);
    return done(withWide(album, [...tiles, { item, ...fit }]));
  }
  const rect = { x: Math.max(0, Math.min(GRID_COLUMNS - NEW_TILE.w, at.x)), y: Math.max(0, at.y), ...NEW_TILE };
  const why = outOfBounds(rect, WIDE);
  if (why) return refused(why);
  const added: AlbumTile = { item, ...rect };
  const r = pushDown([...tiles, added], added, rect, WIDE);
  return r.ok ? done(withWide(album, r.tiles)) : refused(r.why);
}

/** Remove from cover (or dragged to the strip): the tile leaves the cover, never its last. */
export function takeOut(album: Album, item: string, lookup: MediaLookup): Outcome {
  const tiles = coverOf(album, lookup);
  if (!tiles.some((t) => t.item === item)) return done(album);
  if (tiles.length === 1) return refused('The cover keeps at least one tile: put another in first, or use the automatic cover.');
  const rest = tiles.filter((t) => t.item !== item);
  if (!shownOnPhones(rest).length) return refused('At least one tile is shown on phones: show another there first.');
  return done(withWide(album, rest));
}

/** A preset (§6.4) applied to the tiles in the cover, refused when it can't hold them within 12 rows. */
export function usePreset(album: Album, preset: PresetId, lookup: MediaLookup, aspect: (item: string) => number | undefined = () => undefined): Outcome {
  const tiles = coverOf(album, lookup);
  const ordered = readingOrder(tiles);
  if (presetRects(preset, ordered.length, ordered.map((t) => aspect(t.item))).length < ordered.length)
    return refused(`${PRESETS.find((p) => p.id === preset)?.name ?? 'That preset'} can't hold ${ordered.length} tiles within ${GRID_ROWS_MAX} rows: take some out first.`);
  return done(withWide(album, applyPreset(preset, tiles, aspect)));
}

/**
 * Use automatic cover (§9.6): the arrangement (and the phone's) removed, so the cover is worked out from the album
 * again. `lead`, the cover picture chosen before arranging, is kept when it's still a picture or video of the album.
 */
export function useAutomatic(album: Album, lead?: string): Outcome {
  const { cover: _, ...rest } = album;
  const item = lead ? album.items.find((i) => i.id === lead) : undefined;
  return done(item && isMediaItem(item) ? { ...rest, cover: { lead: item.id } } : rest);
}

/** The cover picture chosen before arranging (`cover.lead`), to keep for a way back. */
export const leadOf = (album: Album): string | undefined => coverLead(album);

/** Arrange for phones (§9.6): the phone's cover as the rule works it out, copied into the owner's own arrangement. */
export function arrangeForPhones(album: Album, lookup: MediaLookup): Outcome {
  if (album.cover && 'tiles' in album.cover && album.cover.phone) return done(album);
  const tiles = coverOf(album, lookup);
  if (!tiles.length) return refused('The cover is empty: put a picture in it first.');
  return done({ ...album, cover: { tiles, phone: { tiles: phoneTiles(tiles) } } });
}

/** The phone's Back to automatic (§9.6): its own arrangement removed. */
export function phoneToAutomatic(album: Album): Outcome {
  if (!album.cover || !('tiles' in album.cover) || !album.cover.phone) return done(album);
  return done({ ...album, cover: { tiles: album.cover.tiles } });
}

/** The items a wide change put at the end of the phone's own arrangement (the view says so). */
export function phoneJoined(before: Album, after: Album): string[] {
  const of = (a: Album) => (a.cover && 'tiles' in a.cover ? a.cover.phone?.tiles : undefined);
  const was = of(before);
  const now = of(after);
  if (!was || !now) return [];
  const had = new Set(was.map((p) => p.item));
  return now.filter((p) => !had.has(p.item)).map((p) => p.item);
}

// ---------- the chosen tile's options ----------

/** One wide tile changed; refused when the item isn't in the cover. */
function onTile(album: Album, item: string, lookup: MediaLookup, fn: (t: AlbumTile) => AlbumTile | string): Outcome {
  const tiles = coverOf(album, lookup);
  const t = tiles.find((x) => x.item === item);
  if (!t) return refused("That item isn't in the cover.");
  const next = fn(t);
  if (typeof next === 'string') return refused(next);
  return next === t ? done(album) : done(withWide(album, tiles.map((x) => (x === t ? next : x))));
}
const without = <K extends keyof AlbumTile>(t: AlbumTile, key: K): AlbumTile => {
  if (!(key in t)) return t;
  const { [key]: _, ...rest } = t;
  return rest as AlbumTile;
};

/** How a tile shows its item: By kind (the default: removes `display`), Fill or Fit. A tile with its own focus isn't fitted. */
export function setDisplay(album: Album, item: string, choice: 'kind' | TileDisplay, kind: ItemKind | undefined, lookup: MediaLookup): Outcome {
  return onTile(album, item, lookup, (t) => {
    const next = choice === 'kind' ? without(t, 'display') : t.display === choice ? t : { ...t, display: choice };
    if (next.focus && displayFor(next, kind) === 'fit') return "This tile has its own focus point, and a fitted tile shows its item whole: use the picture's focus first.";
    return next;
  });
}

/** Use the picture's focus: the tile's own focus removed. */
export const usePictureFocus = (album: Album, item: string, lookup: MediaLookup): Outcome => onTile(album, item, lookup, (t) => without(t, 'focus'));

const mb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;

/** What the arranger knows of an item: its kind and its file's size. */
export interface TileFacts {
  kind: ItemKind | undefined;
  bytes?: number;
}

/** Why a tile can't play in the cover, or null when it can (§4.3): a video file or an animated picture of at most 10 MB, on at most 2 tiles. */
export function playRefusal(album: Album, item: string, facts: TileFacts, lookup: MediaLookup): string | null {
  if (facts.kind !== 'video' && facts.kind !== 'animated') return 'Only a video file or an animated picture can play in the cover.';
  if (facts.bytes !== undefined && facts.bytes > PLAY_MAX_BYTES) return `It's ${mb(facts.bytes)}: a tile plays only a file of at most ${mb(PLAY_MAX_BYTES)}.`;
  if (coverOf(album, lookup).filter((t) => t.play && t.item !== item).length >= PLAY_MAX_TILES) return `At most ${PLAY_MAX_TILES} tiles play in a cover: turn one off first.`;
  return null;
}

/** Play in the band, on (within its limits) or off (removes `play`). */
export function setPlay(album: Album, item: string, on: boolean, facts: TileFacts, lookup: MediaLookup): Outcome {
  if (!on) return onTile(album, item, lookup, (t) => without(t, 'play'));
  const why = playRefusal(album, item, facts, lookup);
  return why ? refused(why) : onTile(album, item, lookup, (t) => (t.play ? t : { ...t, play: true }));
}

/** Hide on phones (`onPhones: false`, never for the cover's last tile on phones), or show there again (removes it). */
export function setOnPhones(album: Album, item: string, show: boolean, lookup: MediaLookup): Outcome {
  if (show) return onTile(album, item, lookup, (t) => without(t, 'onPhones'));
  if (!shownOnPhones(coverOf(album, lookup)).some((t) => t.item !== item)) return refused('At least one tile is shown on phones: show another there first.');
  return onTile(album, item, lookup, (t) => (t.onPhones === false ? t : { ...t, onPhones: false }));
}

// ---------- what the arranger shows ----------

/** What the arranger knows of an item: its name, kind, file size and shape. */
export interface CoverFacts extends TileFacts {
  label: string;
  /** Its shape, width over height. */
  aspect?: number;
  /** Its picture's own focus point ("30% 60%"), when it has one. */
  focus?: string;
}

/** A picture or video of the album as the arranger draws it: its facts and its thumbnail. */
export interface CoverItem extends CoverFacts {
  /** Its item's ID in the album. */
  id: string;
  /** Its thumbnail (empty: a plain cell). */
  thumb: string;
  /** The thumbnail's edge colour. */
  bg?: string;
  /** The thumbnail's size (px). */
  width: number;
  height: number;
}

/** The warnings beside the canvas while they apply (§9.6): never refusals. */
export function coverWarnings(album: Album, show: Show, lookup: MediaLookup, factsOf: (item: string) => CoverFacts | undefined): string[] {
  const out: string[] = [];
  const name = (item: string) => `"${factsOf(item)?.label ?? item}"`;
  const tiles = shownTiles(album, show, lookup);
  const gaps = holes(tiles, gridOf(show).columns);
  if (gaps.length) out.push(`The cover has ${gaps.length} empty cell${gaps.length === 1 ? '' : 's'} (hatched): move or resize a tile into them, or Close gaps.`);
  const rows = rowsOf(tiles);
  const most = show === 'phone' ? PHONE_ROWS_WARN : ROWS_WARN;
  if (rows > most) out.push(`The cover is ${rows} rows tall: past ${most}, it's taller than a screen.`);
  if (show === 'phone') return out;
  for (const t of coverOf(album, lookup)) {
    const f = factsOf(t.item);
    if (!f) continue;
    if (t.play && f.bytes !== undefined && f.bytes > PLAY_WARN_BYTES && f.bytes <= PLAY_MAX_BYTES) out.push(`${name(t.item)} plays in the cover and is ${mb(f.bytes)}: past ${mb(PLAY_WARN_BYTES)}, it's slow on a phone's connection.`);
    if (!f.aspect || displayFor(t, f.kind) !== 'fill') continue;
    if (f.aspect >= 2.5 && t.w <= 4) out.push(`${name(t.item)} is a wide panorama in a small tile: make the tile wider, or Fit it.`);
    else if (!t.focus && !f.focus && f.aspect / (t.w / t.h) >= 2) out.push(`${name(t.item)} has no focus point and fills a tile much narrower than it: set its focus, so the right part shows.`);
  }
  return out;
}

/** The arranger's state in words: whether the band shown is the owner's, and the phone's. */
export function coverState(album: Album): { arranged: boolean; phoneArranged: boolean; count: number } {
  const tiles = arrangedTiles(album);
  return { arranged: !!tiles, phoneArranged: !!(album.cover && 'tiles' in album.cover && album.cover.phone), count: tiles?.length ?? 0 };
}

/** The canvas's rows: the band's, and room below it to drop into (the wide grid's 12 at most). */
export const canvasRows = (tiles: readonly Rect[], show: Show, editable: boolean): number => {
  const rows = rowsOf(tiles);
  if (!editable) return Math.max(rows, 1);
  return show === 'phone' ? rows + 2 : Math.min(GRID_ROWS_MAX, rows + 2);
};
