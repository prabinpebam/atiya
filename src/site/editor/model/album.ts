/**
 * Edit mode's album operations (documentation/gallery/spec.md §9.1 to §9.4, §9.7). Pure: the album editor's script
 * runs them on the album in the browser and saves the result through the store, and the server makes a new album
 * with them. Every operation returns a new album and keeps every field it doesn't touch; a setting at its default is
 * left out of the file (§3.4).
 */
import type { Album, AlbumItem, AlbumMediaItem, AlbumTextItem } from '../../content/schema';
import { albumOrder, isMediaItem, isTextItem, leadTile, takenOf, type MediaLookup } from '../../content/album';
import { slugify, unique } from './ids';

/** A sorted order: by the day the items were taken. */
export type SortedOrder = 'oldest' | 'newest';

/** The album's settings as the Settings sheet shows them: every one stated (§9.2). */
export interface AlbumSettings {
  order: NonNullable<Album['order']>;
  layout: NonNullable<Album['layout']>;
  captions: boolean;
  dates: boolean;
  download: boolean;
  large: boolean;
}

/** An operation that may be refused: the album after it, or why not. */
export type Outcome = { ok: true; album: Album; note?: string } | { ok: false; why: string };

/** The ID of a new album from its title, unique among the albums and articles (V43). */
export function albumIdFrom(title: string, taken: Set<string>): string {
  const base = slugify(title);
  return unique(base === 'untitled' ? 'untitled-album' : base, taken);
}

/** A new, empty draft album (§9.1): no settings, so every one is its default. */
export function newAlbum(id: string, title: string, now: string): Album {
  return { id, type: 'album', slug: id, title: title.trim() || 'Untitled album', status: 'draft', createdAt: now, updatedAt: now, items: [] };
}

/** The album's words: its title (never empty: an empty one keeps the old), summary and description (empty: left out). */
export function setWords(album: Album, words: { title?: string; summary?: string; description?: string }): Album {
  const next: Album = { ...album };
  if (words.title !== undefined && words.title.trim()) next.title = words.title.trim();
  for (const k of ['summary', 'description'] as const) {
    if (words[k] === undefined) continue;
    const v = words[k]!.trim();
    if (v) next[k] = v;
    else delete next[k];
  }
  return next;
}

/** Every setting stated, the defaults filled in (§3.4). */
export const settingsOf = (album: Album): AlbumSettings => ({
  order: album.order ?? 'oldest',
  layout: album.layout ?? 'grid',
  captions: !!album.captions,
  dates: album.dates !== false,
  download: !!album.download,
  large: !!album.large,
});

/**
 * Changes settings: each one at its default is left out of the file. A story shows every item's words, so captions
 * under the pictures go with it (V49). An order is changed through {@link sortAlbum}, which may refuse.
 */
export function setSettings(album: Album, change: Partial<Omit<AlbumSettings, 'order'>>): Album {
  const s = { ...settingsOf(album), ...change };
  const { layout: _l, captions: _c, dates: _d, download: _w, large: _g, ...rest } = album;
  const next: Album = { ...rest };
  if (s.layout !== 'grid') next.layout = s.layout;
  if (s.captions && s.layout !== 'story') next.captions = true;
  if (!s.dates) next.dates = false;
  if (s.download) next.download = true;
  if (s.large) next.large = true;
  return orderedKeys(next);
}

/**
 * Sorts the album (§9.3, Sort): by the day taken, oldest or newest first, or the owner's own order, which starts as
 * the order on screen. Text cards keep the owner's order (V53): sorting by date with text cards is refused.
 */
export function sortAlbum(album: Album, order: NonNullable<Album['order']>, lookup: MediaLookup): Outcome {
  if (order === 'custom') return { ok: true, album: inOwnOrder(album, lookup) };
  const text = album.items.filter(isTextItem).length;
  if (text) return { ok: false, why: `The album has ${text === 1 ? 'a text card' : `${text} text cards`}: they stay where you put them, so its order stays your own. Remove them to sort by date.` };
  const { order: _o, ...rest } = album;
  return { ok: true, album: orderedKeys(order === 'oldest' ? { ...rest } : { ...rest, order }) };
}

/** The album in the owner's own order, starting from the order on screen (a move or a text card in a sorted album, §9.3). */
export function inOwnOrder(album: Album, lookup: MediaLookup): Album {
  if (album.order === 'custom') return album;
  return orderedKeys({ ...album, order: 'custom', items: albumOrder(album, lookup) });
}

// ---------- items ----------

/** An item's ID from its library item's name, unique in the album (V38). */
export function itemIdFor(mediaId: string, taken: Set<string>): string {
  const base = slugify(mediaId.split('/').pop() ?? '').slice(0, 56).replace(/-+$/, '') || 'item';
  return unique(base === 'untitled' ? 'item' : base, taken);
}

/**
 * Adds library items (§9.4): each once (one already in the album is skipped). In a sorted order they go in by the
 * day they were taken (the order shows them there); in the owner's order, before the item `before`, or at the end.
 */
export function addItems(album: Album, mediaIds: readonly string[], opts: { before?: string | null } = {}): { album: Album; added: string[]; skipped: string[] } {
  const inAlbum = new Set(album.items.filter(isMediaItem).map((i) => i.media));
  const taken = new Set(album.items.map((i) => i.id));
  const fresh: AlbumMediaItem[] = [];
  const skipped: string[] = [];
  for (const media of mediaIds) {
    if (inAlbum.has(media)) {
      skipped.push(media);
      continue;
    }
    inAlbum.add(media);
    const id = itemIdFor(media, taken);
    taken.add(id);
    fresh.push({ id, media });
  }
  const items = [...album.items];
  const at = album.order === 'custom' && opts.before ? items.findIndex((i) => i.id === opts.before) : -1;
  if (at >= 0) items.splice(at, 0, ...fresh);
  else items.push(...fresh);
  return { album: { ...album, items }, added: fresh.map((i) => i.id), skipped };
}

/** Takes items out of the album (§9.3, Remove from album): their library items stay. A cover that showed one forgets it. */
export function removeItems(album: Album, ids: readonly string[]): Album {
  const gone = new Set(ids);
  const next: Album = { ...album, items: album.items.filter((i) => !gone.has(i.id)) };
  if (!album.cover) return next;
  if ('lead' in album.cover) {
    if (gone.has(album.cover.lead)) delete next.cover;
    return next;
  }
  const tiles = album.cover.tiles.filter((t) => !gone.has(t.item));
  if (!tiles.length) {
    delete next.cover;
    return next;
  }
  const phone = album.cover.phone?.tiles.filter((t) => !gone.has(t.item));
  next.cover = phone?.length ? { tiles, phone: { tiles: phone } } : { tiles };
  return next;
}

/**
 * Moves items (§9.3, drag, Move to start or end): together, in the order shown, to just before the item `before` (null:
 * the end). A sorted album becomes the owner's order, starting from the order on screen.
 */
export function moveItems(album: Album, ids: readonly string[], before: string | null, lookup: MediaLookup): Album {
  const moving = new Set(ids);
  const shown = albumOrder(album, lookup);
  const picked = shown.filter((i) => moving.has(i.id));
  if (!picked.length) return album;
  const rest = shown.filter((i) => !moving.has(i.id));
  let at = before ? rest.findIndex((i) => i.id === before) : rest.length;
  if (at < 0) at = rest.length;
  return orderedKeys({ ...album, order: 'custom', items: [...rest.slice(0, at), ...picked, ...rest.slice(at)] });
}

/** Moves items to the start of the album. */
export const moveToStart = (album: Album, ids: readonly string[], lookup: MediaLookup): Album => {
  const first = albumOrder(album, lookup).find((i) => !ids.includes(i.id));
  return moveItems(album, ids, first?.id ?? null, lookup);
};

/** Moves items to the end of the album. */
export const moveToEnd = (album: Album, ids: readonly string[], lookup: MediaLookup): Album => moveItems(album, ids, null, lookup);

/** Moves items one place earlier (-1) or later (+1) with the keyboard (Alt+arrow), past the next item not moved. */
export function moveBy(album: Album, ids: readonly string[], step: -1 | 1, lookup: MediaLookup): Album {
  const moving = new Set(ids);
  const shown = albumOrder(album, lookup);
  const rest = shown.filter((i) => !moving.has(i.id));
  const first = shown.findIndex((i) => moving.has(i.id));
  if (first < 0) return album;
  // how many items not moved come before the first moved one, moved on by one
  const before = shown.slice(0, first).length;
  const at = Math.max(0, Math.min(rest.length, before + step));
  return moveItems(album, ids, rest[at]?.id ?? null, lookup);
}

// ---------- text cards ----------

/** A new text card's ID: the first free text-1, text-2… */
export function nextTextId(album: Pick<Album, 'items'>): string {
  const taken = new Set(album.items.map((i) => i.id));
  let n = 1;
  while (taken.has(`text-${n}`)) n++;
  return `text-${n}`;
}

/**
 * Adds a text card (§9.4): words between the pictures, before the item `before` (else at the end). Text cards keep
 * the owner's order (V53), so a sorted album becomes the owner's order, starting from the order on screen.
 */
export function addText(album: Album, text: string, lookup: MediaLookup, opts: { before?: string | null } = {}): { album: Album; id: string } {
  const own = inOwnOrder(album, lookup);
  const card: AlbumTextItem = { id: nextTextId(album), text: text.trim() };
  const items = [...own.items];
  const at = opts.before ? items.findIndex((i) => i.id === opts.before) : -1;
  if (at >= 0) items.splice(at, 0, card);
  else items.push(card);
  return { album: { ...own, items }, id: card.id };
}

/** A text card's words changed; empty words take it out. */
export function editText(album: Album, id: string, text: string): Album {
  if (!text.trim()) return removeItems(album, [id]);
  return { ...album, items: album.items.map((i) => (i.id === id && isTextItem(i) ? { ...i, text: text.trim() } : i)) };
}

// ---------- an item's own settings (§9.3 Downloads, §9.5) ----------

/**
 * Sets the selected items' downloads (§9.3): `true` Allow, `false` Don't allow, `undefined` Follow the album (the
 * field goes). Never on a linked video or a text card (V49): they're left as they are. The same album back when
 * nothing changes.
 */
export function setItemDownload(album: Album, ids: readonly string[], download: boolean | undefined, lookup: MediaLookup): Album {
  const on = new Set(ids);
  let changed = false;
  const items = album.items.map((i) => {
    if (!on.has(i.id) || !isMediaItem(i) || lookup(i.media)?.kind === 'embed' || i.download === download) return i;
    changed = true;
    const next: AlbumMediaItem = { ...i };
    if (download === undefined) delete next.download;
    else next.download = download;
    return next;
  });
  return changed ? { ...album, items } : album;
}

/** A video file's Play by itself and Loop in this album (§9.5, V49): off removes the field; only a video file has them. */
export function setItemPlay(album: Album, id: string, play: { autoplay?: boolean; loop?: boolean }, lookup: MediaLookup): Album {
  let changed = false;
  const items = album.items.map((i) => {
    if (i.id !== id || !isMediaItem(i) || lookup(i.media)?.kind !== 'video') return i;
    const next: AlbumMediaItem = { ...i };
    for (const k of ['autoplay', 'loop'] as const) {
      if (!(k in play)) continue;
      if (play[k]) next[k] = true;
      else delete next[k];
    }
    if (next.autoplay === i.autoplay && next.loop === i.loop) return i;
    changed = true;
    return next;
  });
  return changed ? { ...album, items } : album;
}

// ---------- the cover ----------

/**
 * Sets the item the cover leads with (§9.3, Set as cover lead). With the owner's own tiles, the lead tile shows it
 * (and the tile that showed it before shows the old lead). A text card can't lead.
 */
export function setCoverLead(album: Album, id: string): Outcome {
  const item = album.items.find((i) => i.id === id);
  if (!item) return { ok: false, why: 'That item is no longer in the album.' };
  if (!isMediaItem(item)) return { ok: false, why: 'A text card can’t lead the cover: choose a picture or a video.' };
  if (!album.cover || 'lead' in album.cover) return { ok: true, album: { ...album, cover: { lead: id } } };
  const lead = leadTile(album.cover.tiles);
  if (!lead) return { ok: true, album: { ...album, cover: { lead: id } } };
  const old = lead.item;
  const swap = (t: { item: string }) => (t === lead ? id : t.item === id ? old : t.item);
  const tiles = album.cover.tiles.map((t) => ({ ...t, item: swap(t) }));
  const phone = album.cover.phone ? { tiles: album.cover.phone.tiles.map((t) => ({ ...t, item: t.item === old ? id : t.item === id ? old : t.item })) } : undefined;
  return { ok: true, album: { ...album, cover: phone ? { tiles, phone } : { tiles } } };
}

// ---------- the grid ----------

/** A run of items the grid shows under one heading: the day they were taken, or none. */
export interface DayGroup<T> {
  /** The day (YYYY-MM-DD), or undefined: undated items, text cards, or an album in the owner's order. */
  day?: string;
  items: T[];
}

/** The album's items in the order shown, under day headings in a sorted order (§9.2); in the owner's order, one run. */
export function dayGroups<T extends AlbumItem>(album: { items: readonly T[]; order?: Album['order'] }, lookup: MediaLookup): DayGroup<T>[] {
  const shown = albumOrder(album, lookup);
  if (album.order === 'custom') return shown.length ? [{ items: shown }] : [];
  const groups: DayGroup<T>[] = [];
  for (const item of shown) {
    const day = takenOf(item, lookup);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(item);
    else groups.push({ ...(day ? { day } : {}), items: [item] });
  }
  return groups;
}

// ---------- selection ----------

/** Shift-click: every item from the anchor to `to`, in the order shown (§9.3). */
export function pickRange(order: readonly string[], anchor: string | null, to: string): string[] {
  const a = anchor ? order.indexOf(anchor) : -1;
  const b = order.indexOf(to);
  if (b < 0) return [];
  if (a < 0) return [to];
  return order.slice(Math.min(a, b), Math.max(a, b) + 1);
}

/** Ctrl or Cmd-click: `id` in or out of the selection, the rest kept, in the order shown. */
export function pickToggle(order: readonly string[], picked: readonly string[], id: string): string[] {
  const set = new Set(picked);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  return order.filter((x) => set.has(x));
}

// ---------- helpers ----------

/** The album's fields in the order the contract lists them, so a saved file reads the same whatever changed it. */
const KEY_ORDER: (keyof Album)[] = ['id', 'type', 'slug', 'title', 'summary', 'description', 'status', 'createdAt', 'updatedAt', 'publishedAt', 'topics', 'order', 'items', 'cover', 'layout', 'captions', 'dates', 'download', 'large'];

function orderedKeys(next: Album): Album {
  const out: Record<string, unknown> = {};
  for (const k of KEY_ORDER) if (next[k] !== undefined) out[k] = next[k];
  for (const [k, v] of Object.entries(next)) if (!(k in out) && v !== undefined) out[k] = v;
  return out as Album;
}
