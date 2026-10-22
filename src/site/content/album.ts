/**
 * An album's rules and worked-out answers (documentation/gallery/spec.md §3, §5, §6, §7, §16, §18): the checks
 * the content check runs on an album (V38, V39, V40's warnings, V45, V47, V48), the band's reading order, the
 * counts and the span of dates in words, the six presets and the default arrangement, the phone's band
 * (`phoneTiles`) and keeping the owner's own phone arrangement in step, how a tile shows its item and the
 * album's card picture. Pure: no Astro, nothing read; media comes in through a lookup.
 */
import { isProvider, isProviderId } from './providers';
import {
  GRID_COLUMNS,
  GRID_ROWS_MAX,
  PHONE_COLUMNS,
  PHONE_ROWS_WARN,
  PHONE_TILE_H_MAX,
  PLAY_MAX_BYTES,
  PLAY_MAX_TILES,
  PLAY_WARN_BYTES,
  ROWS_WARN,
  TILE_MIN,
  isDrawingFile,
  type Album,
  type AlbumItem,
  type AlbumTile,
  type PhoneTile,
  type TileDisplay,
} from './schema';

/** What an item is, for its tile, its counts and its rules. An animated picture counts as a picture; an embed as a video. */
export type ItemKind = 'picture' | 'animated' | 'drawing' | 'video' | 'embed';

/** What an album needs to know of a piece of media: the loader's MediaRecord and VideoRecord fit it. */
export type AlbumMedia =
  | {
      kind: 'image';
      file: string;
      alt?: string;
      decorative?: boolean;
      animation?: unknown;
      facts?: { width: number; height: number; bytes: number };
      taken?: string;
      /** Its master's size in bytes, when known beyond its facts. */
      bytes?: number;
    }
  | { kind: 'video'; file: string; width: number; height: number; captions?: readonly unknown[]; bytes?: number };

/** Finds a piece of media by its ID (undefined: no such picture or video file). */
export type MediaLookup = (id: string) => AlbumMedia | undefined;

/** One thing wrong with an album, at its path under `album`. */
export interface AlbumIssue {
  path: string;
  message: string;
}

/** A tile's place: its first column and row, its width and height, in cells. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ---------- kinds ----------

/** A piece of media's kind, or undefined for a file the album can't hold. */
export function mediaKind(m: AlbumMedia | undefined): ItemKind | undefined {
  if (!m) return undefined;
  if (m.kind === 'video') return 'video';
  if (isDrawingFile(m.file)) return 'drawing';
  return m.animation ? 'animated' : 'picture';
}

/** An item's kind (undefined: its media doesn't exist). */
export const itemKind = (item: AlbumItem, lookup: MediaLookup): ItemKind | undefined => (item.embed ? 'embed' : mediaKind(lookup(item.media!)));

/** Whether a kind is a raster picture (a card's or a social image's, a poster's). */
export const isRaster = (k: ItemKind | undefined): boolean => k === 'picture' || k === 'animated';

/** How a tile shows its item (§6.5): its own `display`, else fit for a drawing and fill for everything else. */
export const displayFor = (tile: { display?: TileDisplay }, kind: ItemKind | undefined): TileDisplay => tile.display ?? (kind === 'drawing' ? 'fit' : 'fill');

/** A piece of media's shape (width over height), when it's known. */
export function aspectOf(m: AlbumMedia | undefined): number | undefined {
  if (!m) return undefined;
  const [w, h] = m.kind === 'video' ? [m.width, m.height] : [m.facts?.width, m.facts?.height];
  return w && h ? w / h : undefined;
}

/** An item's shape: its media's, or an embed's own (16:9 when left out). */
export const itemAspect = (item: AlbumItem, lookup: MediaLookup): number | undefined =>
  item.embed ? (item.embed.width && item.embed.height ? item.embed.width / item.embed.height : 16 / 9) : aspectOf(lookup(item.media!));

/** A piece of media's size in bytes, when known. */
const bytesOf = (m: AlbumMedia | undefined): number | undefined => m?.bytes ?? (m?.kind === 'image' ? m.facts?.bytes : undefined);

// ---------- the grid ----------

/** Tiles in reading order: by row, then by column. */
export const readingOrder = <T extends { x: number; y: number }>(tiles: readonly T[]): T[] => [...tiles].sort((a, b) => a.y - b.y || a.x - b.x);

export const overlaps = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** How many rows tall a set of tiles is. */
export const rowsOf = (tiles: readonly Rect[]): number => tiles.reduce((n, t) => Math.max(n, t.y + t.h), 0);

/** The cells no tile covers, above the band's last row. */
export function holes(tiles: readonly Rect[], columns = GRID_COLUMNS): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < rowsOf(tiles); y++)
    for (let x = 0; x < columns; x++) if (!tiles.some((t) => x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h)) out.push({ x, y });
  return out;
}

/** The pairs of tiles (their indices) that overlap. */
function overlapping(tiles: readonly Rect[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) if (overlaps(tiles[i], tiles[j])) out.push([i, j]);
  return out;
}

/** The band an album shows: its own tiles, or the default arrangement. */
export const showcaseOf = (album: Pick<Album, 'items' | 'showcase'>): AlbumTile[] => album.showcase?.tiles ?? defaultShowcase(album.items);

/** The tiles shown on phones. */
export const shownOnPhones = <T extends { onPhones?: false }>(tiles: readonly T[]): T[] => tiles.filter((t) => t.onPhones !== false);

/** The phone's band: the owner's own arrangement, or the rule's. */
export const phoneOf = (album: Pick<Album, 'items' | 'showcase'>): PhoneTile[] => album.showcase?.phone?.tiles ?? phoneTiles(showcaseOf(album));

// ---------- checks ----------

/** V38 and V45, and the item options that need its media: what's wrong with the album's items. Existence and visibility are the loader's (needMedia). */
export function itemProblems(album: Album, lookup: MediaLookup, opts: { published: boolean }): AlbumIssue[] {
  const out: AlbumIssue[] = [];
  if (opts.published && album.items.length === 0) out.push({ path: 'items', message: 'a published album has at least one item: add one, or set the page back to draft (V38)' });
  const ids = new Set<string>();
  album.items.forEach((item, i) => {
    const at = `items.${i}`;
    if (ids.has(item.id)) out.push({ path: `${at}.id`, message: `two items have the ID "${item.id}": an item's ID is unique in its album (V38)` });
    ids.add(item.id);
    if (item.embed) {
      if (!isProvider(item.embed.provider)) out.push({ path: `${at}.embed.provider`, message: `"${item.embed.provider}" isn't a provider the site embeds (V45)` });
      else if (!isProviderId(item.embed.provider, item.embed.id)) out.push({ path: `${at}.embed.id`, message: `"${item.embed.id}" isn't a ${item.embed.provider} video's ID (V45)` });
      if (item.poster) {
        const p = lookup(item.poster);
        if (p && !isRaster(mediaKind(p))) out.push({ path: `${at}.poster`, message: "an embed's poster is a picture (not a drawing or a video file) (V45)" });
      }
      return;
    }
    const m = lookup(item.media!);
    if (!m) return;
    if (m.kind === 'image' && (m.decorative || !m.alt)) out.push({ path: `${at}.media`, message: `the picture "${item.media}" needs alt text: in an album a picture is the content, never decorative (V38)` });
    if ((item.autoplay !== undefined || item.loop !== undefined) && m.kind !== 'video') out.push({ path: at, message: 'autoplay and loop are for a video file, not a picture (V49)' });
  });
  // the album's words may link to its own items (#item-<id>), and only to items it has
  const links = (md: string | undefined, path: string) => {
    for (const [, href] of (md ?? '').matchAll(/\]\((#[^)\s]*)\)/g))
      if (!(href.startsWith('#item-') && ids.has(href.slice('#item-'.length)))) out.push({ path, message: `the link "${href}" goes nowhere: in an album's words a link on the page goes to one of its items, #item-<id> (V41)` });
  };
  links(album.description, 'description');
  album.items.forEach((item, i) => links(item.description, `items.${i}.description`));
  return out;
}

/** V39: each tile names an item of the album once, and no two overlap (their bounds are the schema's). */
export function tileProblems(album: Album): AlbumIssue[] {
  const tiles = album.showcase?.tiles ?? [];
  const out: AlbumIssue[] = [];
  const items = new Set(album.items.map((i) => i.id));
  const seen = new Set<string>();
  tiles.forEach((t, i) => {
    if (!items.has(t.item)) out.push({ path: `showcase.tiles.${i}.item`, message: `"${t.item}" isn't an item of the album (V39)` });
    else if (seen.has(t.item)) out.push({ path: `showcase.tiles.${i}.item`, message: `"${t.item}" has two tiles: an item is up front once (V39)` });
    seen.add(t.item);
  });
  for (const [i, j] of overlapping(tiles)) out.push({ path: `showcase.tiles.${j}`, message: `the tiles of "${tiles[i].item}" and "${tiles[j].item}" overlap (V39)` });
  return out;
}

/** V47: the phone's band. Its own arrangement names exactly the tiles shown on phones, once each, never overlapping; at least one tile is shown. */
export function phoneProblems(album: Album): AlbumIssue[] {
  const tiles = album.showcase?.tiles;
  if (!tiles) return [];
  const out: AlbumIssue[] = [];
  const shown = shownOnPhones(tiles);
  if (!shown.length) out.push({ path: 'showcase.tiles', message: 'at least one tile is shown on phones (V47)' });
  const phone = album.showcase?.phone?.tiles;
  if (!phone) return out;
  const want = new Set(shown.map((t) => t.item));
  const seen = new Set<string>();
  phone.forEach((p, i) => {
    const at = `showcase.phone.tiles.${i}`;
    if (!want.has(p.item))
      out.push({ path: `${at}.item`, message: tiles.some((t) => t.item === p.item) ? `"${p.item}" is hidden on phones, so it has no place there (V47)` : `"${p.item}" isn't up front (V47)` });
    else if (seen.has(p.item)) out.push({ path: `${at}.item`, message: `"${p.item}" is in the phone's band twice (V47)` });
    seen.add(p.item);
  });
  for (const t of shown) if (!seen.has(t.item)) out.push({ path: 'showcase.phone.tiles', message: `"${t.item}" is shown on phones but has no place there (V47)` });
  for (const [i, j] of overlapping(phone)) out.push({ path: `showcase.phone.tiles.${j}`, message: `the phone tiles of "${phone[i].item}" and "${phone[j].item}" overlap (V47)` });
  return out;
}

/** V48: a tile's focus (two percentages, a filled tile only) and playing (a video file or an animated picture of at most 10 MB, on at most 2 tiles). */
export function playProblems(album: Album, lookup: MediaLookup): AlbumIssue[] {
  const tiles = album.showcase?.tiles ?? [];
  const out: AlbumIssue[] = [];
  const byId = new Map(album.items.map((i) => [i.id, i]));
  tiles.forEach((t, i) => {
    const at = `showcase.tiles.${i}`;
    const item = byId.get(t.item);
    const kind = item && itemKind(item, lookup);
    if (t.focus) {
      if (t.focus.split(' ').some((p) => parseInt(p, 10) > 100)) out.push({ path: `${at}.focus`, message: 'a focus point is two percentages from 0% to 100% (V48)' });
      if (displayFor(t, kind) !== 'fill') out.push({ path: `${at}.focus`, message: "a focus point is for a filled tile: a fitted one shows its item whole (V48)" });
    }
    if (t.play && item) {
      if (kind !== 'video' && kind !== 'animated') out.push({ path: `${at}.play`, message: 'only a video file or an animated picture can play in the band (V48)' });
      else {
        const bytes = bytesOf(lookup(item.media!));
        if (bytes !== undefined && bytes > PLAY_MAX_BYTES) out.push({ path: `${at}.play`, message: `"${t.item}" is ${mb(bytes)}: a tile plays only a file of at most ${mb(PLAY_MAX_BYTES)} (V48)` });
      }
    }
  });
  const playing = tiles.filter((t) => t.play).length;
  if (playing > PLAY_MAX_TILES) out.push({ path: 'showcase.tiles', message: `${playing} tiles play: at most ${PLAY_MAX_TILES} play in a band (V48)` });
  return out;
}

/** Every refusal of an album's own (V38, V39, V45, V47, V48). */
export const albumProblems = (album: Album, lookup: MediaLookup, opts: { published: boolean }): AlbumIssue[] => [
  ...itemProblems(album, lookup, opts),
  ...tileProblems(album),
  ...phoneProblems(album),
  ...playProblems(album, lookup),
];

/** V40: warnings, never refusals (a hole in the band, a tall band or phone band, a heavy playing tile, a video file without captions). */
export function albumWarnings(album: Album, lookup: MediaLookup): string[] {
  const out: string[] = [];
  const tiles = album.showcase?.tiles;
  if (tiles) {
    const gaps = holes(tiles);
    if (gaps.length) out.push(`the band has ${gaps.length} empty cell${gaps.length === 1 ? '' : 's'}, the first at row ${gaps[0].y + 1}, column ${gaps[0].x + 1}: move or resize a tile to fill it (V40)`);
    const rows = rowsOf(tiles);
    if (rows > ROWS_WARN) out.push(`the band is ${rows} rows tall: past ${ROWS_WARN}, it's taller than a screen (V40)`);
    const phoneRows = rowsOf(phoneOf(album));
    if (phoneRows > PHONE_ROWS_WARN) out.push(`the band on phones is ${phoneRows} rows tall: past ${PHONE_ROWS_WARN}, hide a tile on phones (V40)`);
    const byId = new Map(album.items.map((i) => [i.id, i]));
    for (const t of tiles) {
      const item = byId.get(t.item);
      const bytes = t.play && item?.media ? bytesOf(lookup(item.media)) : undefined;
      if (bytes !== undefined && bytes > PLAY_WARN_BYTES && bytes <= PLAY_MAX_BYTES) out.push(`"${t.item}" plays in the band and is ${mb(bytes)}: past ${mb(PLAY_WARN_BYTES)}, it's slow on a phone's connection (V40)`);
    }
  }
  for (const item of album.items) {
    const m = item.media ? lookup(item.media) : undefined;
    if (m?.kind === 'video' && !m.captions?.length) out.push(`the video "${item.media}" has no captions: a video with speech needs them (V40)`);
  }
  return out;
}

const mb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;

// ---------- the counts and the dates ----------

export interface AlbumCounts {
  /** Pictures, animated ones included. */
  pictures: number;
  /** Video files and embeds. */
  videos: number;
  drawings: number;
}

/** What an album holds, by kind (§5): an item whose media doesn't exist isn't counted. */
export function albumCounts(items: readonly AlbumItem[], lookup: MediaLookup): AlbumCounts {
  const counts: AlbumCounts = { pictures: 0, videos: 0, drawings: 0 };
  for (const item of items) {
    const k = itemKind(item, lookup);
    if (k === 'picture' || k === 'animated') counts.pictures++;
    else if (k === 'video' || k === 'embed') counts.videos++;
    else if (k === 'drawing') counts.drawings++;
  }
  return counts;
}

/** The counts in words: "18 pictures, 2 videos, 1 drawing", only the kinds there are ('' for none). */
export function countWords(c: AlbumCounts): string {
  const part = (n: number, one: string) => (n ? [`${n} ${one}${n === 1 ? '' : 's'}`] : []);
  return [...part(c.pictures, 'picture'), ...part(c.videos, 'video'), ...part(c.drawings, 'drawing')].join(', ');
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A day in words: "12 March 2026". */
export function dayWords(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/**
 * The span of the dates the items were taken, in words (§7): "12 March 2026", "12 to 20 March 2026",
 * "March to May 2026", "2019 to 2024"; undefined when none is known.
 */
export function dateSpan(dates: readonly string[]): string | undefined {
  const days = dates.filter((d) => /^\d{4}-\d{2}-\d{2}/.test(d)).map((d) => d.slice(0, 10)).sort();
  if (!days.length) return undefined;
  const [first, last] = [days[0], days[days.length - 1]];
  if (first === last) return dayWords(first);
  const [y1, m1, d1] = first.split('-').map(Number);
  const [y2, m2, d2] = last.split('-').map(Number);
  if (y1 !== y2) return `${y1} to ${y2}`;
  if (m1 !== m2) return `${MONTHS[m1 - 1]} to ${MONTHS[m2 - 1]} ${y1}`;
  return `${d1} to ${d2} ${MONTHS[m1 - 1]} ${y1}`;
}

/** The dates an album's items were taken, as known (none when the album hides them). */
export const albumDates = (album: Pick<Album, 'items' | 'dates'>, lookup: MediaLookup): string[] =>
  album.dates === false
    ? []
    : album.items.flatMap((i) => {
        const m = i.media ? lookup(i.media) : undefined;
        return m?.kind === 'image' && m.taken ? [m.taken] : [];
      });

// ---------- presets and the default ----------

export const PRESET_IDS = ['single', 'lead-two', 'lead-four', 'pairs', 'even-rows', 'fit'] as const;
export type PresetId = (typeof PRESET_IDS)[number];

/** The presets' names, as the arranger lists them (§6.4). */
export const PRESETS: readonly { id: PresetId; name: string; best: string }[] = [
  { id: 'single', name: 'Single', best: 'One picture that carries the album' },
  { id: 'lead-two', name: 'Lead and two', best: 'Three items with a clear lead' },
  { id: 'lead-four', name: 'Lead and four', best: 'Five items with a clear lead' },
  { id: 'pairs', name: 'Pairs', best: 'Equals' },
  { id: 'even-rows', name: 'Even rows', best: 'Many equals' },
  { id: 'fit', name: 'Fit to pictures', best: 'Pictures whose shapes matter' },
];

const C = GRID_COLUMNS;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Widths sharing a row of `columns` between `n` tiles, the last ones taking what's left. */
function share(n: number, columns = C): number[] {
  const base = Math.floor(columns / n);
  const extra = columns - base * n;
  return Array.from({ length: n }, (_, i) => base + (i >= n - extra ? 1 : 0));
}

/** Full rows of `perRow` tiles of `w` by `h`, the last row's tiles sharing its width. */
function rowsOfTiles(n: number, perRow: number, h: number, top = 0): Rect[] {
  const out: Rect[] = [];
  for (let start = 0, y = top; start < n; start += perRow, y += h) {
    const count = Math.min(perRow, n - start);
    let x = 0;
    for (const w of share(count)) {
      out.push({ x, y, w, h });
      x += w;
    }
  }
  return out;
}

/** The tiles a preset doesn't place, below it in the rows left, as large as fit; null when they can't. */
function fillBelow(n: number, top: number): Rect[] | null {
  if (!n) return [];
  const rows = GRID_ROWS_MAX - top;
  for (const [w, h] of [[4, 3], [3, 3], [4, 2], [3, 2], [2, 2]] as const) {
    const perRow = C / w;
    if (Math.ceil(n / perRow) * h <= rows) return rowsOfTiles(n, perRow, h, top);
  }
  return null;
}

/** Fit to pictures' rows, `h` cells tall: each tile as wide as its shape asks, the last in a row taking what's left. */
function fitRows(aspects: readonly (number | undefined)[], h: number): Rect[] {
  const out: Rect[] = [];
  let row: Rect[] = [];
  let y = 0;
  const close = () => {
    if (!row.length) return;
    const last = row[row.length - 1];
    last.w = C - last.x;
    out.push(...row);
    row = [];
    y += h;
  };
  for (const a of aspects) {
    const w = clamp(Math.round(h * (a ?? 3 / 2)), TILE_MIN, C);
    const used = row.length ? row[row.length - 1].x + row[row.length - 1].w : 0;
    if (used + w > C) close();
    const x = row.length ? row[row.length - 1].x + row[row.length - 1].w : 0;
    row.push({ x, y, w, h });
    // too little room left for another tile: this one takes it
    if (C - (x + w) < TILE_MIN) close();
  }
  close();
  return out;
}

/** The places a preset gives its first `k` tiles (of `n`), or null when it has no arrangement for them. */
function head(preset: PresetId, k: number, n: number, aspects: readonly (number | undefined)[]): Rect[] | null {
  switch (preset) {
    case 'single':
      return k === 1 ? [{ x: 0, y: 0, w: 12, h: 6 }] : null;
    case 'lead-two':
      if (k === 1) return [{ x: 0, y: 0, w: 12, h: 6 }];
      if (k === 2) return [{ x: 0, y: 0, w: 8, h: 6 }, { x: 8, y: 0, w: 4, h: 6 }];
      return k === 3 ? [{ x: 0, y: 0, w: 8, h: 6 }, { x: 8, y: 0, w: 4, h: 3 }, { x: 8, y: 3, w: 4, h: 3 }] : null;
    case 'lead-four': {
      const lead = { x: 0, y: 0, w: 6, h: 4 };
      if (k === 1) return [{ x: 0, y: 0, w: 12, h: 4 }];
      if (k === 2) return [lead, { x: 6, y: 0, w: 6, h: 4 }];
      if (k === 3) return [lead, { x: 6, y: 0, w: 6, h: 2 }, { x: 6, y: 2, w: 6, h: 2 }];
      if (k === 4) return [lead, { x: 6, y: 0, w: 3, h: 2 }, { x: 9, y: 0, w: 3, h: 2 }, { x: 6, y: 2, w: 6, h: 2 }];
      return k === 5 ? [lead, { x: 6, y: 0, w: 3, h: 2 }, { x: 9, y: 0, w: 3, h: 2 }, { x: 6, y: 2, w: 3, h: 2 }, { x: 9, y: 2, w: 3, h: 2 }] : null;
    }
    case 'pairs': {
      // a lone last one only when it's the last of all
      if (k % 2 && k < n) return null;
      const out: Rect[] = [];
      for (let i = 0; i + 1 < k; i += 2) out.push({ x: 0, y: (i / 2) * 4, w: 6, h: 4 }, { x: 6, y: (i / 2) * 4, w: 6, h: 4 });
      if (k % 2) out.push({ x: 0, y: Math.floor(k / 2) * 4, w: 12, h: 6 });
      return out;
    }
    case 'even-rows':
      return rowsOfTiles(k, 3, 3);
    case 'fit':
      for (const h of [4, 3]) {
        const rects = fitRows(aspects.slice(0, k), h);
        if (rowsOf(rects) <= GRID_ROWS_MAX) return rects;
      }
      return null;
  }
}

/**
 * The places a preset gives `n` tiles in band order (§6.4): its own arrangement for as many as it has room for,
 * the rest below as large as fit, everything within the 12 rows and with no hole. `aspects` are the items'
 * shapes (width over height), for Fit to pictures.
 */
export function presetRects(preset: PresetId, n: number, aspects: readonly (number | undefined)[] = []): Rect[] {
  for (let k = n; k >= 1; k--) {
    const top = head(preset, k, n, aspects);
    if (!top || rowsOf(top) > GRID_ROWS_MAX) continue;
    const rest = fillBelow(n - k, rowsOf(top));
    if (rest) return [...top, ...rest];
  }
  return [];
}

/**
 * A preset applied to the band (§6.4): the same items, in their band order (reading order), with new places;
 * each keeps its own display, focus, play and phone setting. `aspect` gives an item's shape, for Fit to pictures.
 */
export function applyPreset(preset: PresetId, tiles: readonly AlbumTile[], aspect: (item: string) => number | undefined = () => undefined): AlbumTile[] {
  const ordered = readingOrder(tiles);
  const rects = presetRects(preset, ordered.length, ordered.map((t) => aspect(t.item)));
  return ordered.map((t, i) => ({ ...t, ...rects[i] }));
}

/** The preset the default arrangement uses for an album of `n` items, and how many it puts up front. */
export function defaultPreset(n: number): { preset: PresetId; count: number } | null {
  if (n <= 0) return null;
  if (n >= 5) return { preset: 'lead-four', count: 5 };
  return { preset: n === 3 ? 'lead-two' : n === 1 ? 'single' : 'pairs', count: n };
}

/** The default band (§6.4), worked out, never saved: the album's first items in the preset that fits their number. */
export function defaultShowcase(items: readonly Pick<AlbumItem, 'id'>[]): AlbumTile[] {
  const d = defaultPreset(items.length);
  if (!d) return [];
  const rects = presetRects(d.preset, d.count);
  return items.slice(0, d.count).map((item, i) => ({ item: item.id, ...rects[i] }));
}

// ---------- on a phone ----------

/**
 * The phone's band worked out from the wide one (§6.3): over the tiles shown on phones, in reading order, on 6
 * columns. A tile 6 or more columns wide becomes full width, every other half; its height keeps its shape
 * (rounded, 2 to 8); halves pair side by side taking the taller height; a lone half widens to full, its height
 * doubled (at most 8); rows follow reading order.
 */
export function phoneTiles(tiles: readonly AlbumTile[]): PhoneTile[] {
  const half = PHONE_COLUMNS / 2;
  const sized = readingOrder(shownOnPhones(tiles)).map((t) => {
    const w = t.w >= PHONE_COLUMNS ? PHONE_COLUMNS : half;
    return { item: t.item, w, h: clamp(Math.round((w * t.h) / t.w), TILE_MIN, PHONE_TILE_H_MAX) };
  });
  const out: PhoneTile[] = [];
  let y = 0;
  for (let i = 0; i < sized.length; i++) {
    const s = sized[i];
    const next = sized[i + 1];
    if (s.w === PHONE_COLUMNS) {
      out.push({ item: s.item, x: 0, y, w: PHONE_COLUMNS, h: s.h });
      y += s.h;
    } else if (next && next.w === half) {
      const h = Math.max(s.h, next.h);
      out.push({ item: s.item, x: 0, y, w: half, h }, { item: next.item, x: half, y, w: half, h });
      y += h;
      i++;
    } else {
      const h = Math.min(PHONE_TILE_H_MAX, s.h * 2);
      out.push({ item: s.item, x: 0, y, w: PHONE_COLUMNS, h });
      y += h;
    }
  }
  return out;
}

/**
 * The owner's phone arrangement kept in step with the wide band (§6.3): a tile taken out of the band (or hidden
 * on phones) leaves it; a tile added (or shown again) joins it at its end, placed by the rule; the rest stay
 * where he put them.
 */
export function keepPhoneInStep(phone: readonly PhoneTile[], tiles: readonly AlbumTile[]): PhoneTile[] {
  const shown = shownOnPhones(tiles);
  const want = new Set(shown.map((t) => t.item));
  const kept = phone.filter((p) => want.has(p.item));
  const have = new Set(kept.map((p) => p.item));
  const bottom = rowsOf(kept);
  const added = phoneTiles(shown.filter((t) => !have.has(t.item))).map((p) => ({ ...p, y: p.y + bottom }));
  return [...kept, ...added];
}

// ---------- the card ----------

/**
 * The album's card picture (§18): the page's thumbnail, else its first raster picture up front (in reading
 * order), else its first raster picture in the album; undefined when it has none.
 */
export function cardPicture(page: { thumbnail?: string; album?: Album }, lookup: MediaLookup): string | undefined {
  if (page.thumbnail) return page.thumbnail;
  const album = page.album;
  if (!album) return undefined;
  const raster = (item: AlbumItem | undefined) => !!item?.media && isRaster(mediaKind(lookup(item.media)));
  const byId = new Map(album.items.map((i) => [i.id, i]));
  const upFront = readingOrder(showcaseOf(album)).map((t) => byId.get(t.item)).find(raster);
  return (upFront ?? album.items.find(raster))?.media;
}


// ---------- an album with its media ----------

/** An item with what it shows: its kind, its picture or video file (from the index) and an embed's poster. */
export interface ResolvedItem<I, V> {
  item: AlbumItem;
  kind: ItemKind | undefined;
  /** Its picture, animated picture or drawing. */
  image?: I;
  /** Its video file. */
  video?: V;
  /** An embed's poster picture. */
  poster?: I;
}

/** An album with every item's media looked up in the loader's maps (`media`, `videos`), for the layouts. */
export function resolveAlbum<I extends AlbumMedia, V extends AlbumMedia>(
  album: Album,
  images: ReadonlyMap<string, I>,
  videos: ReadonlyMap<string, V>,
): { album: Album; items: ResolvedItem<I, V>[] } {
  const lookup: MediaLookup = (id) => images.get(id) ?? videos.get(id);
  const items = album.items.map((item) => ({
    item,
    kind: itemKind(item, lookup),
    image: item.media ? images.get(item.media) : undefined,
    video: item.media ? videos.get(item.media) : undefined,
    poster: item.poster ? images.get(item.poster) : undefined,
  }));
  return { album, items };
}