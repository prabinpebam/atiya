/**
 * Up front's arranger (documentation/gallery/spec.md §9.3), pure: the band's tiles on a grid of square cells (12
 * columns and at most 12 rows wide; 6 columns on phones), moved and resized by whole cells, by pointer and by
 * keyboard, never overlapping: a tile dropped on one of the same size swaps with it, anywhere else it pushes the
 * tiles it would cover down, in reading order, and a change that would push the band past 12 rows is refused with
 * its reason. The presets, Close gaps, the tray (put up front, take out), the phone's own arrangement (kept in
 * step when tiles join or leave the wide band) and every override §18 gives the arranger, each with its way back
 * to automatic, which leaves the file exactly as it was. Every change returns a new album or a refusal (model/album.ts
 * `Edit`); the script only wires them to the page.
 */
import type { Album, AlbumTile, TileDisplay } from '../../content/schema';
import { GRID_COLUMNS, GRID_ROWS_MAX, PHONE_COLUMNS, PHONE_ROWS_WARN, PHONE_TILE_H_MAX, PLAY_MAX_BYTES, PLAY_MAX_TILES, PLAY_WARN_BYTES, ROWS_WARN, SHOWCASE_MAX_TILES, TILE_MIN } from '../../content/schema';
import { PRESETS, applyPreset, defaultShowcase, displayFor, holes, keepPhoneInStep, overlaps, phoneOf, phoneTiles, presetRects, readingOrder, rowsOf, showcaseOf, shownOnPhones, type PresetId, type Rect } from '../../content/album';
import { UP_FRONT_TILE, setUpFront, type AlbumCard, type Edit } from './album';

export { PRESETS, type PresetId, type Rect };

const done = (album: Album): Edit => ({ ok: true, album });
const refused = (reason: string): Edit => ({ ok: false, reason });

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

type Placed = Rect & { item: string };
/** A placement: the tiles after it, or a refusal with its reason. */
export type Placement<T> = { ok: true; tiles: T[] } | { ok: false; reason: string };

/** A place in words, as the live region reads it: "columns 7 to 12, rows 1 to 2". */
export const placeWords = (r: Rect): string => `columns ${r.x + 1} to ${r.x + r.w}, rows ${r.y + 1} to ${r.y + r.h}`;

const TOO_TALL = (rows: number) => `That would push the band past ${rows} rows: close a gap, make a tile smaller or take one out first.`;

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

/** The tiles with one moved to `to` (the same object when nothing changed), in their own order. */
const withRect = <T extends Placed>(t: T, r: Rect): T => (t.x === r.x && t.y === r.y && t.w === r.w && t.h === r.h ? t : { ...t, x: r.x, y: r.y, w: r.w, h: r.h });

/**
 * A tile put at `rect` (§9.3): on a tile of the same size (its origin, the tile keeping its size), the two swap
 * and nothing else moves; anywhere else it takes the place and the tiles it would overlap are pushed down, in
 * reading order, until nothing overlaps. Refused past the grid's rows, or out of its bounds, saying why.
 */
export function place<T extends Placed>(tiles: readonly T[], item: string, rect: Rect, grid: Grid): Placement<T> {
  const me = tiles.find((t) => t.item === item);
  if (!me) return { ok: false, reason: 'That tile is no longer up front.' };
  const why = outOfBounds(rect, grid);
  if (why) return { ok: false, reason: why };
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
  if (rowsOf(settled) > grid.rows) return { ok: false, reason: TOO_TALL(grid.rows) };
  return { ok: true, tiles: tiles.map((t) => withRect(t, moved.get(t)!)) };
}

/** A direction, for the arrow keys and the inspector's buttons. */
export type Dir = 'left' | 'right' | 'up' | 'down';
const STEP: Record<Dir, [number, number]> = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

/** An arrow key: the tile moves a cell; into a tile of its size lined up with it, the two swap. */
export function nudge<T extends Placed>(tiles: readonly T[], item: string, dir: Dir, grid: Grid): Placement<T> {
  const me = tiles.find((t) => t.item === item);
  if (!me) return { ok: false, reason: 'That tile is no longer up front.' };
  const [dx, dy] = STEP[dir];
  const to = { x: me.x + dx, y: me.y + dy, w: me.w, h: me.h };
  if (to.x < 0) return { ok: false, reason: "It's already in the first column." };
  if (to.x + to.w > grid.columns) return { ok: false, reason: 'It already reaches the last column.' };
  if (to.y < 0) return { ok: false, reason: "It's already in the top row." };
  const twin = tiles.find((t) => t !== me && t.w === me.w && t.h === me.h && overlaps(t, to) && (dx ? t.y === me.y : t.x === me.x));
  if (twin) return { ok: true, tiles: tiles.map((t) => (t === me ? withRect(t, twin) : t === twin ? withRect(t, me) : t)) };
  return place(tiles, item, to, grid);
}

/** Shift with an arrow key: right and down make the tile a cell wider or taller, left and up a cell narrower or shorter. */
export function grow<T extends Placed>(tiles: readonly T[], item: string, dir: Dir, grid: Grid): Placement<T> {
  const me = tiles.find((t) => t.item === item);
  if (!me) return { ok: false, reason: 'That tile is no longer up front.' };
  const r = { x: me.x, y: me.y, w: me.w + (dir === 'right' ? 1 : dir === 'left' ? -1 : 0), h: me.h + (dir === 'down' ? 1 : dir === 'up' ? -1 : 0) };
  if (dir === 'right' && r.x + r.w > grid.columns) return { ok: false, reason: 'It already reaches the last column.' };
  return place(tiles, item, r, grid);
}

/** Close gaps (§9.3): every tile moves up as far as it goes, in reading order, keeping its column. */
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

// ---------- the album's changes ----------

/** The wide band set to `tiles`, the phone's own arrangement (when there is one) kept in step (§6.3). */
function withWide(album: Album, tiles: AlbumTile[]): Album {
  const { phone: own, ...sc } = album.showcase ?? { tiles };
  const phone = own ? keepPhoneInStep(own.tiles, tiles) : null;
  return { ...album, showcase: { ...sc, tiles, ...(phone?.length ? { phone: { tiles: phone } } : {}) } };
}

/**
 * After a way back to automatic: a band with no phone arrangement left whose tiles are the default's again is
 * the default, so it's no longer stored (an override made on the default band, then undone, leaves the file as it was).
 */
function settle(album: Album): Album {
  const sc = album.showcase;
  if (!sc || sc.phone || JSON.stringify(sc.tiles) !== JSON.stringify(defaultShowcase(album.items))) return album;
  const { showcase: _, ...rest } = album;
  return rest;
}

const PHONE_FIRST = "Arrange for phones first: until then the phone's band is worked out from the wide one.";

/** A placement of the shown band's tiles applied to the album. */
function arrange(album: Album, show: Show, fn: <T extends Placed>(tiles: readonly T[], grid: Grid) => Placement<T>): Edit {
  if (show === 'phone') {
    const own = album.showcase?.phone?.tiles;
    if (!own) return refused(PHONE_FIRST);
    const r = fn(own, PHONE);
    return r.ok ? done({ ...album, showcase: { ...album.showcase!, phone: { tiles: r.tiles } } }) : refused(r.reason);
  }
  const r = fn(showcaseOf(album), WIDE);
  return r.ok ? done(withWide(album, r.tiles)) : refused(r.reason);
}

/** A tile dragged to a cell (its top-left corner). */
export const moveTo = (album: Album, show: Show, item: string, at: { x: number; y: number }): Edit =>
  arrange(album, show, (tiles, g) => {
    const me = tiles.find((t) => t.item === item);
    return me ? place(tiles, item, { ...at, w: me.w, h: me.h }, g) : { ok: false, reason: 'That tile is no longer up front.' };
  });

/** A tile resized by its handles (its top-left corner stays). */
export const resizeTo = (album: Album, show: Show, item: string, size: { w: number; h: number }): Edit =>
  arrange(album, show, (tiles, g) => {
    const me = tiles.find((t) => t.item === item);
    return me ? place(tiles, item, { x: me.x, y: me.y, ...size }, g) : { ok: false, reason: 'That tile is no longer up front.' };
  });

/** An arrow key (or the inspector's button): moves the tile a cell, or with `resize` changes its size a cell. */
export const arrangeKey = (album: Album, show: Show, item: string, dir: Dir, resize: boolean): Edit => arrange(album, show, (tiles, g) => (resize ? grow(tiles, item, dir, g) : nudge(tiles, item, dir, g)));

/** Close gaps, on the shown band. */
export const closeGapsIn = (album: Album, show: Show): Edit => arrange(album, show, (tiles) => ({ ok: true, tiles: closeGaps(tiles) }));

/** The tray (§9.3): an item put up front at 3 by 2, where it's dropped (pushing tiles down) or where it fits first. */
export function putUpFront(album: Album, item: string, at?: { x: number; y: number }): Edit {
  if (!album.items.some((i) => i.id === item)) return refused('That item is no longer in the album.');
  const tiles = showcaseOf(album);
  if (tiles.some((t) => t.item === item)) return at ? moveTo(album, 'wide', item, at) : done(album);
  if (tiles.length >= SHOWCASE_MAX_TILES) return refused(`The band holds at most ${SHOWCASE_MAX_TILES} tiles: take one out first.`);
  if (!at) return setUpFront(album, item, true);
  const rect = { x: Math.max(0, Math.min(GRID_COLUMNS - UP_FRONT_TILE.w, at.x)), y: Math.max(0, at.y), ...UP_FRONT_TILE };
  const why = outOfBounds(rect, WIDE);
  if (why) return refused(why);
  const added: AlbumTile = { item, ...rect };
  const r = pushDown([...tiles, added], added, rect, WIDE);
  return r.ok ? done(withWide(album, r.tiles)) : refused(r.reason);
}

/** Dragged to the tray, or Remove from the band: the tile leaves the band (never its last). */
export const takeOut = (album: Album, item: string): Edit => setUpFront(album, item, false);

/** A preset (§6.4) applied to the tiles up front, refused when it can't hold them within 12 rows. */
export function usePreset(album: Album, preset: PresetId, aspect: (item: string) => number | undefined = () => undefined): Edit {
  const tiles = showcaseOf(album);
  const ordered = readingOrder(tiles);
  if (presetRects(preset, ordered.length, ordered.map((t) => aspect(t.item))).length < ordered.length) {
    return refused(`${PRESETS.find((p) => p.id === preset)?.name ?? 'That preset'} can't hold ${ordered.length} tiles within ${GRID_ROWS_MAX} rows: take some out first.`);
  }
  return done(withWide(album, applyPreset(preset, tiles, aspect)));
}

/** Use the default (§18): the owner's arrangement (and the phone's) removed, so the band is worked out again. */
export function useDefault(album: Album): Edit {
  if (!album.showcase) return done(album);
  const { showcase: _, ...rest } = album;
  return done(rest);
}

/** Arrange for phones (§9.3): the phone's band as the rule works it out, copied into the owner's own arrangement. */
export function arrangeForPhones(album: Album): Edit {
  if (album.showcase?.phone) return done(album);
  const tiles = showcaseOf(album);
  return done({ ...album, showcase: { ...(album.showcase ?? { tiles }), phone: { tiles: phoneTiles(tiles) } } });
}

/** Back to automatic (§18): the phone's own arrangement removed. */
export function backToAutomatic(album: Album): Edit {
  if (!album.showcase?.phone) return done(album);
  const { phone: _, ...sc } = album.showcase;
  return done(settle({ ...album, showcase: sc }));
}

/** The items a wide change put at the end of the phone's own arrangement (the view says so). */
export function phoneJoined(before: Album, after: Album): string[] {
  const was = before.showcase?.phone?.tiles;
  const now = after.showcase?.phone?.tiles;
  if (!was || !now) return [];
  const had = new Set(was.map((p) => p.item));
  return now.filter((p) => !had.has(p.item)).map((p) => p.item);
}

// ---------- the chosen tile's overrides (§18) ----------

/** One wide tile changed; refused when the item isn't up front. */
function onTile(album: Album, item: string, fn: (t: AlbumTile) => AlbumTile | string): Edit {
  const tiles = showcaseOf(album);
  const t = tiles.find((x) => x.item === item);
  if (!t) return refused("That item isn't up front.");
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
export function setDisplay(album: Album, item: string, choice: 'kind' | TileDisplay, kind: AlbumCard['kind']): Edit {
  const r = onTile(album, item, (t) => {
    const next = choice === 'kind' ? without(t, 'display') : t.display === choice ? t : { ...t, display: choice };
    if (next.focus && displayFor(next, kind === 'missing' ? undefined : kind) === 'fit') return "This tile has its own focus point, and a fitted tile shows its item whole: use the picture's focus first.";
    return next;
  });
  return r.ok && choice === 'kind' ? done(settle(r.album)) : r;
}

/** A focus point from a place on the preview (0 to 1 each way), in whole percentages. */
export const focusAt = (fx: number, fy: number): string => `${Math.round(Math.min(1, Math.max(0, fx)) * 100)}% ${Math.round(Math.min(1, Math.max(0, fy)) * 100)}%`;

/** A focus point moved 5% by an arrow key. */
export function nudgeFocus(focus: string | undefined, dir: Dir): string {
  const [x, y] = (focus ?? '50% 50%').split(' ').map((p) => parseInt(p, 10) / 100);
  const [dx, dy] = STEP[dir];
  return focusAt(x + dx * 0.05, y + dy * 0.05);
}

/** Its own focus here (a filled tile only); undefined: Use the picture's focus, which removes it. */
export function setTileFocus(album: Album, item: string, focus: string | undefined, kind: AlbumCard['kind']): Edit {
  if (focus !== undefined && (!/^\d{1,3}% \d{1,3}%$/.test(focus) || focus.split(' ').some((p) => parseInt(p, 10) > 100))) return refused('A focus point is two percentages from 0% to 100%.');
  const r = onTile(album, item, (t) => {
    if (focus === undefined) return without(t, 'focus');
    if (displayFor(t, kind === 'missing' ? undefined : kind) !== 'fill') return 'A focus point is for a filled tile: a fitted one shows its item whole.';
    return t.focus === focus ? t : { ...t, focus };
  });
  return r.ok && focus === undefined ? done(settle(r.album)) : r;
}

const mb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;

/** Why a tile can't play in the band, or null when it can (§4.3): a video file or an animated picture of at most 10 MB, on at most 2 tiles. */
export function playRefusal(album: Album, item: string, facts: { kind: AlbumCard['kind']; bytes?: number }): string | null {
  if (facts.kind !== 'video' && facts.kind !== 'animated') return 'Only a video file or an animated picture can play in the band.';
  if (facts.bytes !== undefined && facts.bytes > PLAY_MAX_BYTES) return `It's ${mb(facts.bytes)}: a tile plays only a file of at most ${mb(PLAY_MAX_BYTES)}.`;
  if (showcaseOf(album).filter((t) => t.play && t.item !== item).length >= PLAY_MAX_TILES) return `At most ${PLAY_MAX_TILES} tiles play in a band: turn one off first.`;
  return null;
}

/** Play in the band, on (within its limits) or off (removes `play`). */
export function setPlay(album: Album, item: string, on: boolean, facts: { kind: AlbumCard['kind']; bytes?: number }): Edit {
  if (!on) {
    const r = onTile(album, item, (t) => without(t, 'play'));
    return r.ok ? done(settle(r.album)) : r;
  }
  const why = playRefusal(album, item, facts);
  return why ? refused(why) : onTile(album, item, (t) => (t.play ? t : { ...t, play: true }));
}

/** Hide on phones (`onPhones: false`, never for the last tile shown there), or Show on phones (removes it). */
export function setOnPhones(album: Album, item: string, show: boolean): Edit {
  if (show) {
    const r = onTile(album, item, (t) => without(t, 'onPhones'));
    return r.ok ? done(settle(r.album)) : r;
  }
  if (!shownOnPhones(showcaseOf(album)).some((t) => t.item !== item)) return refused('At least one tile is shown on phones: show another there first.');
  return onTile(album, item, (t) => (t.onPhones === false ? t : { ...t, onPhones: false }));
}

// ---------- warnings ----------

/** What the arranger knows of an item (the Items view's card, and its file's size). */
export interface ArrangerFacts {
  card?: AlbumCard;
  bytes?: number;
}

/** The warnings beside the canvas while they apply (§9.3): never refusals. */
export function arrangerWarnings(album: Album, show: Show, factsOf: (item: string) => ArrangerFacts): string[] {
  const out: string[] = [];
  const name = (item: string) => `"${factsOf(item).card?.label ?? item}"`;
  const tiles = show === 'phone' ? phoneOf(album) : showcaseOf(album);
  const grid = gridOf(show);
  const gaps = holes(tiles, grid.columns);
  if (gaps.length) out.push(`The band has ${gaps.length} empty cell${gaps.length === 1 ? '' : 's'} (hatched): move or resize a tile into them, or Close gaps.`);
  const rows = rowsOf(tiles);
  const most = show === 'phone' ? PHONE_ROWS_WARN : ROWS_WARN;
  if (rows > most) out.push(`The band is ${rows} rows tall: past ${most}, it's taller than a screen.`);
  if (show === 'phone') return out;
  for (const t of showcaseOf(album)) {
    const f = factsOf(t.item);
    const c = f.card;
    if (t.play && f.bytes !== undefined && f.bytes > PLAY_WARN_BYTES && f.bytes <= PLAY_MAX_BYTES) out.push(`${name(t.item)} plays in the band and is ${mb(f.bytes)}: past ${mb(PLAY_WARN_BYTES)}, it's slow on a phone's connection.`);
    if (!c || c.kind === 'missing' || displayFor(t, c.kind) !== 'fill') continue;
    const shape = c.width / c.height;
    if (shape >= 2.5 && t.w <= 4) out.push(`${name(t.item)} is a wide panorama in a small tile: make the tile wider, or Fit it.`);
    else if (!t.focus && !c.facts?.focus && shape / (t.w / t.h) >= 2) out.push(`${name(t.item)} has no focus point and fills a tile much narrower than it: set its focus here, so the right part shows.`);
  }
  return out;
}

// ---------- what the arranger draws ----------

/** A tile on the canvas. */
export interface ArrangerTile extends Rect {
  item: string;
  label: string;
  thumb?: string;
  /** Its picture's own size (px), for its shape. */
  width: number;
  height: number;
  kind: AlbumCard['kind'];
  display: TileDisplay;
  focus?: string;
  play: boolean;
  /** Hidden on phones. */
  hidden: boolean;
  /** Its place in words. */
  place: string;
  /** Its file's size (for Play in the band's limit), when it has a file. */
  bytes?: number;
}

/** The chosen tile, for the inspector. */
export interface ArrangerChosen extends ArrangerTile {
  /** The display choice: By kind, Fill or Fit. */
  choice: 'kind' | TileDisplay;
  /** What By kind gives. */
  byKind: TileDisplay;
  /** The tile has its own focus (otherwise `focus` is the picture's). */
  ownFocus: boolean;
  /** Why it can't play (null: it can). */
  noPlay: string | null;
}

/** An item not up front, in the tray. */
export interface TrayItem {
  item: string;
  label: string;
  thumb?: string;
  width: number;
  height: number;
  kind: AlbumCard['kind'];
}

/** Everything the arranger draws, for the band shown. */
export interface ArrangerView {
  show: Show;
  /** The wide band is the owner's (Use the default is offered). */
  arranged: boolean;
  /** The phone has its own arrangement (Back to automatic is offered). */
  phoneArranged: boolean;
  columns: number;
  /** The canvas's rows: the band's, and room below it to drop into. */
  rows: number;
  tiles: ArrangerTile[];
  holes: { x: number; y: number }[];
  tray: TrayItem[];
  /** The band holds 12 tiles. */
  full: boolean;
  warnings: string[];
  chosen?: ArrangerChosen;
}

/** The arranger's view of an album: the band shown, its tiles in reading order (Tab's order), the tray and the chosen tile. */
export function arrangerView(album: Album, cards: readonly AlbumCard[], bytesOf: (item: string) => number | undefined, show: Show, chosenId?: string | null): ArrangerView {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const wide = showcaseOf(album);
  const wideOf = new Map(wide.map((t) => [t.item, t]));
  const own = album.showcase?.phone?.tiles;
  const shown: Placed[] = show === 'phone' ? phoneOf(album) : wide;
  const grid = gridOf(show);
  const tiles = readingOrder(shown).map((r): ArrangerTile => {
    const t = wideOf.get(r.item)!;
    const c = byId.get(r.item);
    const kind = c?.kind ?? 'missing';
    const focus = t.focus ?? c?.facts?.focus;
    const bytes = bytesOf(r.item);
    return {
      item: r.item,
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
      label: c?.label ?? r.item,
      ...(c?.thumb ? { thumb: c.thumb } : {}),
      width: c?.width ?? 4,
      height: c?.height ?? 3,
      kind,
      display: displayFor(t, kind === 'missing' ? undefined : kind),
      ...(focus ? { focus } : {}),
      play: !!t.play,
      hidden: t.onPhones === false,
      place: placeWords(r),
      ...(bytes !== undefined ? { bytes } : {}),
    };
  });
  const pick = chosenId ? tiles.find((t) => t.item === chosenId) : undefined;
  const t = pick && wideOf.get(pick.item)!;
  const chosen: ArrangerChosen | undefined =
    pick && t
      ? {
          ...pick,
          choice: t.display ?? 'kind',
          byKind: pick.kind === 'drawing' ? 'fit' : 'fill',
          ownFocus: !!t.focus,
          noPlay: t.play ? null : playRefusal(album, pick.item, { kind: pick.kind, bytes: bytesOf(pick.item) }),
        }
      : undefined;
  const up = new Set(wide.map((x) => x.item));
  const rows = rowsOf(shown);
  return {
    show,
    arranged: !!album.showcase,
    phoneArranged: !!own,
    columns: grid.columns,
    rows: show === 'phone' && !own ? Math.max(rows, 1) : Math.min(grid.rows, rows + 2),
    tiles,
    holes: holes(shown, grid.columns),
    tray: album.items.filter((i) => !up.has(i.id)).map((i) => {
      const c = byId.get(i.id);
      return { item: i.id, label: c?.label ?? i.id, ...(c?.thumb ? { thumb: c.thumb } : {}), width: c?.width ?? 4, height: c?.height ?? 3, kind: c?.kind ?? 'missing' };
    }),
    full: wide.length >= SHOWCASE_MAX_TILES,
    warnings: arrangerWarnings(album, show, (item) => ({ card: byId.get(item), bytes: bytesOf(item) })),
    ...(chosen ? { chosen } : {}),
  };
}
