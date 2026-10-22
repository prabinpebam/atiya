/**
 * Edit mode's album operations (documentation/gallery/spec.md §9.2, §9.4, §18): adding, removing and moving
 * items, sorting them by the day they were taken, their fields, the album's settings and putting an item up
 * front or taking it out. Pure: each takes an album and answers a new one (never changing what it's given),
 * so the Items view applies one, draws it at once and saves it, and Undo is the album before it. An override
 * set back to its automatic answer is removed from the file, so it's left exactly as it was (§18).
 */
import {
  ALBUM_MAX_ITEMS,
  CAPTION_MAX,
  GRID_COLUMNS,
  GRID_ROWS_MAX,
  PLACE_MAX,
  PRIVATE_VIDEO_MAX_BYTES,
  SHOWCASE_MAX_TILES,
  type Album,
  type AlbumEmbed,
  type AlbumItem,
  type AlbumTile,
  type Article,
} from '../../content/schema';
import { keepPhoneInStep, overlaps, showcaseOf, type ItemKind } from '../../content/album';

export { albumCounts, countWords, dateSpan, itemKind, showcaseOf, type ItemKind, type MediaLookup } from '../../content/album';

/** An operation's answer: the new album, or why it can't be done (said in the status line, nothing changed). */
export type Edit = { ok: true; album: Album } | { ok: false; reason: string };

const done = (album: Album): Edit => ({ ok: true, album });
const refused = (reason: string): Edit => ({ ok: false, reason });

/** An empty album: a new gallery page's. */
export const emptyAlbum = (): Album => ({ items: [] });

// ---------- items ----------

/** An item's ID, unique in its album, from a name (a media ID's last part, a provider's video ID): never changed after. */
export function newItemId(base: string, taken: Iterable<string>): string {
  const have = new Set(taken);
  const slug =
    base
      .slice(base.lastIndexOf('/') + 1)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 56)
      .replace(/-+$/, '') || 'item';
  if (!have.has(slug)) return slug;
  for (let n = 2; ; n++) if (!have.has(`${slug}-${n}`)) return `${slug}-${n}`;
}

/** Items for pieces of media (from the library, or just uploaded), in the order given, with IDs new to the album. */
export function mediaItems(album: Album, media: readonly string[]): AlbumItem[] {
  const taken = new Set(album.items.map((i) => i.id));
  return media.map((m) => {
    const id = newItemId(m, taken);
    taken.add(id);
    return { id, media: m };
  });
}

/** What a provider said of a YouTube or Vimeo video when its address was pasted (§9.2): its poster already kept as the site's own picture. */
export interface EmbedFacts {
  embed: AlbumEmbed;
  title: string;
  /** The poster picture's media ID. */
  poster: string;
  /** Its length in seconds, when the provider says (Vimeo). */
  duration?: number;
}

/** An embed's item, from what its provider said. */
export function embedItem(album: Album, facts: EmbedFacts): AlbumItem {
  return { id: newItemId(`${facts.embed.provider}-${facts.embed.id}`, album.items.map((i) => i.id)), ...embedFields(facts) };
}

const embedFields = (f: EmbedFacts) => ({ embed: { ...f.embed }, title: f.title, poster: f.poster, ...(f.duration ? { duration: Math.round(f.duration) } : {}) });

/** Items added at the end, or after `after` (the chosen one): refused past the album's limit (V38). */
export function addItems(album: Album, items: readonly AlbumItem[], after?: string | null): Edit {
  if (!items.length) return done(album);
  const total = album.items.length + items.length;
  if (total > ALBUM_MAX_ITEMS) return refused(`An album holds at most ${ALBUM_MAX_ITEMS} items, and this would make ${total}: add fewer, or remove some first.`);
  const ids = new Set(album.items.map((i) => i.id));
  if (items.some((i) => ids.has(i.id))) return refused('An item with that ID is already in the album.');
  const at = after ? album.items.findIndex((i) => i.id === after) + 1 : 0;
  const pos = at > 0 ? at : album.items.length;
  return done({ ...album, items: [...album.items.slice(0, pos), ...items, ...album.items.slice(pos)] });
}

/**
 * Items taken out of the album (their files stay in the library), with their tiles up front and on the
 * phone. A band left with no tile goes back to the default, and a phone arrangement left empty to the rule.
 */
export function removeItems(album: Album, ids: Iterable<string>): Album {
  const gone = new Set(ids);
  const next: Album = { ...album, items: album.items.filter((i) => !gone.has(i.id)) };
  if (!album.showcase) return next;
  const tiles = album.showcase.tiles.filter((t) => !gone.has(t.item));
  if (!tiles.length) {
    delete next.showcase;
    return next;
  }
  return withTiles(next, tiles);
}

/** The band set to `tiles`, the phone's own arrangement (when there is one) kept in step (§6.3). */
function withTiles(album: Album, tiles: AlbumTile[]): Album {
  const phone = album.showcase?.phone ? keepPhoneInStep(album.showcase.phone.tiles, tiles) : null;
  return { ...album, showcase: { tiles, ...(phone?.length ? { phone: { tiles: phone } } : {}) } };
}

/** The chosen items, in album order. */
const inOrder = (album: Album, ids: Iterable<string>) => {
  const set = new Set(ids);
  return album.items.filter((i) => set.has(i.id));
};

/** The chosen items moved together to a place among the others (0: first; the others' count: last). */
function placeAt(album: Album, ids: Iterable<string>, pos: number): Album {
  const group = inOrder(album, ids);
  if (!group.length) return album;
  const moving = new Set(group.map((i) => i.id));
  const rest = album.items.filter((i) => !moving.has(i.id));
  const at = Math.max(0, Math.min(rest.length, pos));
  return { ...album, items: [...rest.slice(0, at), ...group, ...rest.slice(at)] };
}

/** Where the chosen items start among the others: how many of the others are before the first of them. */
const startOf = (album: Album, ids: Iterable<string>) => {
  const set = new Set(ids);
  const first = album.items.findIndex((i) => set.has(i.id));
  return first < 0 ? 0 : album.items.slice(0, first).filter((i) => !set.has(i.id)).length;
};

/** The chosen items moved one place earlier (-1) or later (1), together (Alt with an arrow key). */
export const moveBy = (album: Album, ids: Iterable<string>, by: -1 | 1): Album => placeAt(album, ids, startOf(album, ids) + by);
/** Move to start. */
export const moveToStart = (album: Album, ids: Iterable<string>): Album => placeAt(album, ids, 0);
/** Move to end. */
export const moveToEnd = (album: Album, ids: Iterable<string>): Album => placeAt(album, ids, album.items.length);

/** The chosen items dropped before another item (a drag), or at the end (null). */
export function dropBefore(album: Album, ids: Iterable<string>, before: string | null): Album {
  const set = new Set(ids);
  if (before && set.has(before)) return album;
  const rest = album.items.filter((i) => !set.has(i.id));
  const at = before ? rest.findIndex((i) => i.id === before) : rest.length;
  return placeAt(album, set, at < 0 ? rest.length : at);
}

/** The album ordered by the day its items were taken, oldest first; those without a day keep their order after them (one change). */
export function sortByTaken(album: Album, takenOf: (item: AlbumItem) => string | undefined): Album {
  const dated = album.items.map((item, at) => ({ item, at, day: takenOf(item) }));
  const sorted = [...dated.filter((d) => d.day).sort((a, b) => a.day!.localeCompare(b.day!) || a.at - b.at), ...dated.filter((d) => !d.day)];
  return { ...album, items: sorted.map((d) => d.item) };
}

/** Whether sorting would change anything (Sort by date taken is offered only then). */
export const sortChanges = (album: Album, takenOf: (item: AlbumItem) => string | undefined): boolean => sortByTaken(album, takenOf).items.some((i, n) => i !== album.items[n]);

// ---------- choosing several (Shift and Ctrl or Cmd, as in the outline) ----------

/** The items from the anchor to `to`, in album order (Shift + click). */
export function pickRange(order: readonly string[], anchor: string, to: string): string[] {
  const a = order.indexOf(anchor);
  const b = order.indexOf(to);
  if (a < 0 || b < 0) return [to];
  return order.slice(Math.min(a, b), Math.max(a, b) + 1);
}

/** One more item chosen, or one less (Ctrl or Cmd + click). */
export const pickToggle = (picked: readonly string[], id: string): string[] => (picked.includes(id) ? picked.filter((p) => p !== id) : [...picked, id]);

// ---------- an item's fields ----------

/** The fields the details pane sets on an item: in this album only (a picture's own words are its sidecar's). */
export type ItemField = 'caption' | 'description' | 'place' | 'download' | 'autoplay' | 'loop' | 'title' | 'duration' | 'poster';

/**
 * An item's field set, or removed when it's empty or its automatic answer (§18): a caption or a place
 * cleared, Download back to Follow the album (undefined), Play by itself and Loop off. Refused, with the
 * reason, when the album couldn't be saved with it.
 */
export function setItemField(album: Album, id: string, field: ItemField, value: string | number | boolean | undefined): Edit {
  const at = album.items.findIndex((i) => i.id === id);
  if (at < 0) return refused('That item is no longer in the album.');
  const item = album.items[at];
  let v = typeof value === 'string' ? value.trim() : value;
  if (v === '' || v === null) v = undefined;
  if ((field === 'autoplay' || field === 'loop') && v === false) v = undefined;
  if (item.embed) {
    if (field === 'download' && v !== undefined) return refused("An embedded video can't be downloaded: its file is the provider's.");
    if ((field === 'autoplay' || field === 'loop') && v !== undefined) return refused('Play by itself and Loop are for a video file: an embed starts when the reader presses play.');
    if (field === 'title' && v === undefined) return refused('An embedded video needs its title: type one, or paste its address again.');
    if (field === 'poster' && v === undefined) return refused('An embedded video needs a poster: choose another, or paste its address again.');
  } else if (field === 'title' || field === 'duration' || field === 'poster') {
    if (field !== 'title' && v !== undefined) return refused('A poster and a length are for an embed: a video file has its own.');
  }
  if (field === 'caption' && typeof v === 'string' && v.length > CAPTION_MAX) return refused(`A caption is at most ${CAPTION_MAX} characters: this is ${v.length}.`);
  if (field === 'place' && typeof v === 'string') {
    if (/[\r\n]/.test(v)) return refused('A place is one line of plain text.');
    if (v.length > PLACE_MAX) return refused(`A place is at most ${PLACE_MAX} characters: this is ${v.length}.`);
  }
  if (field === 'duration' && v !== undefined && !(typeof v === 'number' && Number.isFinite(v) && v > 0)) return refused('Write the length as minutes and seconds (2:20).');
  const next: AlbumItem = { ...item };
  if (v === undefined) delete next[field];
  else (next as Record<string, unknown>)[field] = field === 'duration' ? Math.round(v as number) : v;
  return done({ ...album, items: album.items.map((i, n) => (n === at ? next : i)) });
}

/** The shapes an embed can be given when its provider didn't say (§9.2): 16:9 is what one without a shape shows. */
export const EMBED_SHAPES = [
  { value: '16:9', label: '16:9, wide', width: 16, height: 9 },
  { value: '9:16', label: '9:16, tall', width: 9, height: 16 },
  { value: '4:3', label: '4:3', width: 4, height: 3 },
  { value: '1:1', label: '1:1, square', width: 1, height: 1 },
] as const;

/** An embed's shape as one of the choices, or `provider` for a shape the provider gave that isn't one of them. */
export function embedShape(embed: AlbumEmbed): string {
  if (!embed.width || !embed.height) return '16:9';
  const r = embed.width / embed.height;
  return EMBED_SHAPES.find((s) => Math.abs(s.width / s.height - r) < 0.01)?.value ?? 'provider';
}

/** An embed given a shape: 16:9 is the default, so it removes the size. */
export function setEmbedShape(album: Album, id: string, shape: string): Edit {
  const item = album.items.find((i) => i.id === id);
  if (!item?.embed) return refused('Only an embedded video has a shape to choose.');
  if (shape === 'provider' || shape === embedShape(item.embed)) return done(album);
  const s = EMBED_SHAPES.find((x) => x.value === shape);
  if (!s) return refused('Choose 16:9, 9:16, 4:3 or 1:1.');
  const { width: _w, height: _h, ...rest } = item.embed;
  const embed: AlbumEmbed = s.value === '16:9' ? rest : { ...rest, width: s.width, height: s.height };
  return done({ ...album, items: album.items.map((i) => (i.id === id ? { ...i, embed } : i)) });
}

/** Pasting the address again (§18): the embed's title, shape, length and poster back to what its provider says. */
export function refreshEmbed(album: Album, id: string, facts: EmbedFacts): Edit {
  const item = album.items.find((i) => i.id === id);
  if (!item?.embed) return refused('Only an embedded video comes from an address.');
  const { title: _t, poster: _p, duration: _d, embed: _e, ...rest } = item;
  return done({ ...album, items: album.items.map((i) => (i.id === id ? { ...rest, ...embedFields(facts) } : i)) });
}

// ---------- the album's settings ----------

/** The album's settings and their automatic answers (§18): left out of the file while they're these. */
export const ALBUM_DEFAULTS = { layout: 'grid', captions: false, dates: true, download: false } as const;
export type AlbumSetting = keyof typeof ALBUM_DEFAULTS;

/**
 * One of the album's settings: removed from the file when it's set back to its default. A story shows every
 * item's words, so choosing it takes Captions under pictures off (V49), and Captions can't be turned on in one.
 */
export function setAlbumSetting(album: Album, key: AlbumSetting, value: unknown): Album {
  const next: Album = { ...album };
  if (key === 'layout') {
    if (value === 'story') {
      next.layout = 'story';
      delete next.captions;
    } else delete next.layout;
  } else if (key === 'captions') {
    if (value === true && next.layout !== 'story') next.captions = true;
    else delete next.captions;
  } else if (key === 'dates') {
    if (value === false) next.dates = false;
    else delete next.dates;
  } else if (key === 'download') {
    if (value === true) next.download = true;
    else delete next.download;
  }
  return next;
}

/** The album's introduction (rich text): removed when it's empty. */
export function setAlbumDescription(album: Album, markdown: string | undefined): Album {
  const next: Album = { ...album };
  if (markdown?.trim()) next.description = markdown.trim();
  else delete next.description;
  return next;
}

/**
 * A field of the Page view's Album group (`album.layout`, `album.captions`, `album.dates`, `album.download`,
 * `album.description`) applied to the page: the inspector's value (a checkbox's true or undefined, Show dates
 * taken's false or undefined, a select's value) through the rules above.
 */
export function applyAlbumField(article: Article, name: string, value: unknown): Article {
  const album = article.album ?? emptyAlbum();
  const key = name.replace(/^album\./, '');
  if (key === 'description') return { ...article, album: setAlbumDescription(album, typeof value === 'string' ? value : undefined) };
  if (key in ALBUM_DEFAULTS) {
    const v = key === 'dates' ? value !== false : key === 'layout' ? value : value === true;
    return { ...article, album: setAlbumSetting(album, key as AlbumSetting, v) };
  }
  return article;
}

// ---------- up front ----------

/** The size an item put up front from its details takes: 3 columns by 2 rows, where it fits first. */
export const UP_FRONT_TILE = { w: 3, h: 2 } as const;

/** Whether an item is up front: in the owner's band, or the default's. */
export const isUpFront = (album: Album, id: string): boolean => showcaseOf(album).some((t) => t.item === id);

/** The first place, in reading order, where a tile of this size fits without overlapping, or null within the 12 rows. */
export function firstFree(tiles: readonly AlbumTile[], w: number = UP_FRONT_TILE.w, h: number = UP_FRONT_TILE.h): { x: number; y: number } | null {
  for (let y = 0; y + h <= GRID_ROWS_MAX; y++) for (let x = 0; x + w <= GRID_COLUMNS; x++) if (!tiles.some((t) => overlaps(t, { x, y, w, h }))) return { x, y };
  return null;
}

/**
 * Up front (§9.2): on adds a 3-by-2 tile where it fits first (the default band becomes the owner's, as it
 * then differs from it); off takes its tile out. Refused, with the reason, past 12 tiles, with no room in the
 * 12 rows, or for the band's last tile (a band has at least one: the default comes back only by Use the default).
 */
export function setUpFront(album: Album, id: string, on: boolean): Edit {
  if (!album.items.some((i) => i.id === id)) return refused('That item is no longer in the album.');
  const tiles = showcaseOf(album);
  const has = tiles.some((t) => t.item === id);
  if (on === has) return done(album);
  if (!on) {
    const left = tiles.filter((t) => t.item !== id);
    if (!left.length) return refused('The band needs at least one tile: put another item up front first.');
    return done(withTiles(album, left));
  }
  if (tiles.length >= SHOWCASE_MAX_TILES) return refused(`The band holds at most ${SHOWCASE_MAX_TILES} tiles: take one out in Up front first.`);
  const at = firstFree(tiles);
  if (!at) return refused(`There's no room for it within ${GRID_ROWS_MAX} rows: make room in Up front first.`);
  return done(withTiles(album, [...tiles, { item: id, ...at, ...UP_FRONT_TILE }]));
}

// ---------- the album's weight ----------

/** How much the album's files weigh (§9.2): the total of the sizes known, and how many aren't known. */
export function albumWeight(items: readonly AlbumItem[], sizeOf: (media: string) => number | undefined): { bytes: number; unknown: number } {
  let bytes = 0;
  let unknown = 0;
  const seen = new Set<string>();
  for (const i of items) {
    for (const m of [i.media, i.poster]) {
      if (!m || seen.has(m)) continue;
      seen.add(m);
      const s = sizeOf(m);
      if (s === undefined) unknown++;
      else bytes += s;
    }
  }
  return { bytes, unknown };
}

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;

/** The weight in words, under the grid: a private album also gets its sealed budget (each video file at most 10 MB). */
export function weightWords(w: { bytes: number; unknown: number }, isPrivate = false): string {
  const total = `Its files weigh ${mb(w.bytes)}${w.unknown ? `, and ${w.unknown} more not measured yet` : ''}.`;
  return isPrivate ? `${total} It's private, so it's sealed: each video file is at most ${mb(PRIVATE_VIDEO_MAX_BYTES)}.` : total;
}

// ---------- what the Items view draws ----------

/** What the Items view knows of an item's media (the server reads it from the content index and the cards). */
export interface ItemFacts {
  /** A picture, an animated picture, a drawing or a video file. */
  kind: ItemKind;
  /** Its thumbnail's address, and its shape. */
  thumb: string;
  width: number;
  height: number;
  /** Its own words, shared with every use: alt text (a video's title), caption, the day it was taken. */
  alt?: string;
  caption?: string;
  taken?: string;
  /** Kept large (up to 3840 px): Make it standard is offered. */
  large?: boolean;
  /** Its focus point ("50% 40%"), when it has one. */
  focus?: string;
}

/** One card of the Items view, and its details. */
export interface AlbumCard {
  /** The item's ID in the album. */
  id: string;
  /** What it is (`missing`: its media isn't in the library any more). */
  kind: ItemKind | 'missing';
  /** Its thumbnail (an embed's poster's), when there is one. */
  thumb?: string;
  width: number;
  height: number;
  /** The card's words: its caption, else its media's, else its alt text (dimmed), else an embed's title. */
  label: string;
  /** The label is the alt text, not a caption: shown dimmed. */
  dimmed: boolean;
  /** In the band up front. */
  upFront: boolean;
  /** The item as the album holds it. */
  item: AlbumItem;
  /** Its media's facts (an embed: its poster's). */
  facts?: ItemFacts;
}

/** The Items view's cards, in album order, from the album and what's known of each piece of media. */
export function albumCards(album: Album, factsOf: (media: string) => ItemFacts | undefined): AlbumCard[] {
  const up = new Set(showcaseOf(album).map((t) => t.item));
  return album.items.map((item) => {
    const facts = factsOf((item.embed ? item.poster : item.media) ?? '');
    const kind: AlbumCard['kind'] = item.embed ? 'embed' : (facts?.kind ?? 'missing');
    const caption = item.caption ?? (item.embed ? item.title : facts?.caption);
    const label = caption || facts?.alt || item.id;
    return {
      id: item.id,
      kind,
      ...(facts?.thumb ? { thumb: facts.thumb } : {}),
      width: facts?.width ?? 4,
      height: facts?.height ?? 3,
      label,
      dimmed: !caption,
      upFront: up.has(item.id),
      item,
      ...(facts ? { facts } : {}),
    };
  });
}

/** A length typed as minutes and seconds ("2:20", "1:02:03") or seconds ("140"): seconds, or NaN when it isn't one. */
export function parseLength(text: string): number {
  const t = text.trim();
  if (!t) return NaN;
  if (!/^\d+(:\d{1,2}){0,2}$/.test(t)) return NaN;
  return t.split(':').reduce((s, part) => s * 60 + Number(part), 0);
}

/** Seconds as minutes and seconds ("2:20"). */
export const lengthWords = (s: number): string => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;