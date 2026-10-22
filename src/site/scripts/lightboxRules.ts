/**
 * The lightbox's rules (tier 0; docs: documentation/gallery/spec.md §8): what an item is, read from its
 * link, which pictures are warmed and in what order, what the lightbox does to history, and its words
 * (its name, the counter, the filmstrip's names, Download's label and file name). Pure and unit-tested
 * (`tests/unit/lightboxRules.test.ts`); `lightbox.ts` does the DOM.
 *
 * A link opens the lightbox when it carries `data-lightbox="<group>"`; the rest is optional:
 * `data-thumb` (the filmstrip's picture), `data-full-dark` / `data-thumb-dark` (its dark version),
 * `data-caption`, `data-alt`, `data-shadow` (its drop shadow is on), `data-kind` (picture, animated,
 * drawing, video, embed; a picture when missing), `data-album-title` (the lightbox's name) and the
 * album item's ID: `data-item-id`, or the cell's `id="item-<id>"` on the link or round it.
 */
import { counter } from './media';

/** What an item is, which decides how the stage shows it (spec §8.2). */
export type ItemKind = 'picture' | 'animated' | 'drawing' | 'video' | 'embed';

const KINDS: readonly ItemKind[] = ['picture', 'animated', 'drawing', 'video', 'embed'];

/** What the lightbox needs of a link, read from the DOM by `lightbox.ts`. */
export interface LinkFacts {
  /** The link's resolved href: the item's full size. */
  href: string;
  /** Its `data-*` attributes (the element's dataset). */
  data: Readonly<Record<string, string | undefined>>;
  /** The picture inside the link: what it shows now and its alt text, as fallbacks. */
  img?: { src?: string; alt?: string };
  /** The id of the link or of the nearest element round it whose id starts `item-` (an album's cell). */
  cellId?: string;
}

/** One item of the open group. */
export interface LightboxItem {
  href: string;
  thumb: string;
  /** Its dark mode version's full size and thumbnail, if it has one. */
  hrefDark?: string;
  thumbDark?: string;
  caption: string;
  alt: string;
  /** Whether its drop shadow option is on. */
  shadow: boolean;
  kind: ItemKind;
  /** The album item's ID, when it's in an album. */
  id?: string;
  /** The album's title, when the link names it. */
  albumTitle?: string;
}

/** The album item's ID: `data-item-id`, else the cell's `item-<id>`. */
export function itemIdOf(dataId: string | undefined, cellId: string | undefined): string | undefined {
  if (dataId) return dataId;
  const m = cellId ? /^item-(.+)$/.exec(cellId) : null;
  return m ? m[1] : undefined;
}

/** An item from its link's facts. */
export function itemFrom(link: LinkFacts): LightboxItem {
  const d = link.data;
  const kind = KINDS.includes(d.kind as ItemKind) ? (d.kind as ItemKind) : 'picture';
  return {
    href: link.href,
    thumb: d.thumb || link.img?.src || link.href,
    hrefDark: d.fullDark || undefined,
    thumbDark: d.thumbDark || undefined,
    caption: d.caption || '',
    alt: d.alt || link.img?.alt || '',
    shadow: d.shadow !== undefined,
    kind,
    id: itemIdOf(d.itemId, link.cellId),
    albumTitle: d.albumTitle || undefined,
  };
}

/** The group a link opens: every link in the same `data-lightbox` group, in page order, and where it is among them. */
export function groupFrom<T extends { group: string }>(links: readonly T[], opened: T): { members: T[]; index: number } {
  const members = links.filter((l) => l.group === opened.group);
  return { members, index: Math.max(0, members.indexOf(opened)) };
}

/** The full size to show: the dark version while the page is dark, if it has one. */
export const fullOf = (item: LightboxItem, dark: boolean): string => (item.hrefDark && dark ? item.hrefDark : item.href);

/** The filmstrip's thumbnail, by the same rule. */
export const thumbOf = (item: LightboxItem, dark: boolean): string => (item.thumbDark && dark ? item.thumbDark : item.thumb);

// ---------- warming (spec §8.7) ----------

/** A group this size or smaller is warmed whole when the lightbox opens. */
export const WARM_WHOLE = 24;
/** A larger one warms this many items either side of the one shown, again after every move. */
export const WARM_REACH = 4;

/** How far apart two places are in a set that wraps round. */
export const ring = (a: number, b: number, n: number): number => Math.min(Math.abs(a - b), n - Math.abs(a - b));

/**
 * The places to warm, nearest the one shown first (itself first): the whole group up to `WARM_WHOLE`
 * items, else `WARM_REACH` either side (wrapping, as moving does). Ties keep the next one first.
 */
export function warmOrder(index: number, n: number): number[] {
  if (n <= 0) return [];
  if (n <= WARM_WHOLE) {
    const all = Array.from({ length: n }, (_, k) => k);
    return all.sort((a, b) => ring(a, index, n) - ring(b, index, n) || ((a - index + n) % n) - ((b - index + n) % n));
  }
  const out = [index];
  for (let d = 1; d <= WARM_REACH; d++) out.push((index + d) % n, (index - d + n) % n);
  return out;
}

/** Whether an item's full size is fetched ahead: pictures only (a video loads when shown, an embed on Play), never a sealed file (decrypted when shown). */
export function warmable(item: LightboxItem, url: string): boolean {
  return !!url && !url.includes('/_sealed/') && (item.kind === 'picture' || item.kind === 'drawing' || item.kind === 'animated');
}

// ---------- history (spec §8.6) ----------

/** What opening the lightbox does to history: an `#item-<id>` entry, a state entry, or nothing. */
export type HistoryMode = 'hash' | 'state' | 'none';

/** The album page's group: its cells, each `id="item-<id>"`. */
export const ALBUM_GROUP = 'album';

/**
 * In the planet's frame, nothing (the frame keeps its own history); on the album page, the item's
 * address (`#item-<id>`); anywhere else, an entry that keeps the address, so Back closes it everywhere.
 */
export function historyMode(where: { inFrame: boolean; group: string; id?: string }): HistoryMode {
  if (where.inFrame) return 'none';
  return where.group === ALBUM_GROUP && where.id ? 'hash' : 'state';
}

/** An album item's address on its page. */
export const itemHash = (id: string): string => `#item-${id}`;

/** The item an address names (`#item-<id>`), or null. */
export function idFromHash(hash: string): string | null {
  const m = /^#item-(.+)$/.exec(hash);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

/** The key the lightbox marks its own history entries with. */
export const HISTORY_KEY = 'siteLightbox';

/** The state for the lightbox's entry: the current one's (the router's index and scroll) plus its mark. */
export function entryState(current: unknown): Record<string, unknown> {
  const base = current && typeof current === 'object' ? (current as Record<string, unknown>) : {};
  return { ...base, [HISTORY_KEY]: true };
}

/** Whether a history state is one of the lightbox's entries. */
export const isEntry = (state: unknown): boolean => !!state && typeof state === 'object' && (state as Record<string, unknown>)[HISTORY_KEY] === true;

// ---------- words ----------

/** The dialog's name: the album's ("Summer sketches, album viewer"), else "Image viewer". */
export const viewerName = (albumTitle?: string): string => (albumTitle ? `${albumTitle}, album viewer` : 'Image viewer');

/** The counter's text: "3 of 21". */
export const counterText = (index: number, n: number): string => counter(index, n);

const KIND_NOTE: Partial<Record<ItemKind, string>> = { video: ' (video)', embed: ' (video)', animated: ' (animated)' };

/**
 * A filmstrip thumbnail's name. In an album: "Show 7: The harbour at low tide", with "(video)" or
 * "(animated)" when it's one; any other group keeps "Show picture 7: …".
 */
export function thumbName(index: number, item: Pick<LightboxItem, 'alt' | 'kind'>, album: boolean): string {
  const n = index + 1;
  const head = album ? `Show ${n}` : `Show picture ${n}`;
  return `${item.alt ? `${head}: ${item.alt}` : head}${album ? (KIND_NOTE[item.kind] ?? '') : ''}`;
}

/** A file's weight in words: "2.1 MB", "640 KB". */
export function weight(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(bytes < 10_000_000 ? 1 : 0)} MB`;
  return `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

const KIND_WORD: Record<ItemKind, string> = { picture: 'picture', animated: 'animated picture', drawing: 'drawing', video: 'video', embed: 'video' };

/** Download's label, naming the file's kind and weight: "Download picture, 2.1 MB". */
export const downloadLabel = (kind: ItemKind, bytes?: number): string => `Download ${KIND_WORD[kind]}${bytes ? `, ${weight(bytes)}` : ''}`;

/** A file's extension from its address (no query or fragment), lower case; '' when it has none. */
export function extOf(url: string): string {
  const path = url.split(/[?#]/)[0];
  const last = path.slice(path.lastIndexOf('/') + 1);
  const dot = last.lastIndexOf('.');
  return dot > 0 ? last.slice(dot + 1).toLowerCase() : '';
}

/** Whether an item can be downloaded: never an embed; else the item's own choice, else the album's (spec §8.3). */
export const downloadable = (kind: ItemKind, album: boolean | undefined, own: boolean | undefined): boolean => kind !== 'embed' && (own ?? album ?? false);

/** The downloaded file's name: `<album slug>-<item id>.<ext>`, the extension the published file's (or given, for a decrypted `blob:` file). */
export function downloadName(albumSlug: string, itemId: string, url: string, ext = extOf(url)): string {
  return `${albumSlug}-${itemId}${ext ? `.${ext}` : ''}`;
}
