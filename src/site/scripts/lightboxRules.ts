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

/** An album item's words for the info panel, from its template (`template[data-album-words]`). */
export interface ItemWords {
  /** The description, as HTML (the album's Markdown, rendered at build). */
  description?: string;
  credit?: string;
  /** The day taken, in words, and as an ISO date. */
  taken?: string;
  takenIso?: string;
  place?: string;
}

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
  /** That cell's `data-width` and `data-height`: the item's own size. */
  cellWidth?: string;
  cellHeight?: string;
  /** Its words, from the cell's template. */
  words?: ItemWords;
}

/** A video file's caption track. */
export interface Track {
  src: string;
  srclang: string;
  label: string;
  default?: boolean;
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
  /** The size the stage shows when `href` is the larger one kept for zooming (`data-stage`). */
  stage?: string;
  /** An animated picture's still first frame, and its dark version (`data-still`, `data-still-dark`). */
  still?: string;
  stillDark?: string;
  /** A video's or an embed's poster, and its dark version (`data-poster`, `data-poster-dark`). */
  poster?: string;
  posterDark?: string;
  /** A video file's type (`data-video-type`), its caption tracks (`data-tracks`, JSON) and whether it loops (`data-loop`). */
  videoType?: string;
  tracks?: Track[];
  loop?: boolean;
  /** An embed's player address, made only after a press (`data-embed-src`). */
  embedSrc?: string;
  /** The file Download gives, when it's allowed (`data-download`). */
  download?: string;
  /** A video's or an embed's length, in seconds (`data-duration`). */
  duration?: number;
  /** Its own width in px (its cell's `data-width`): how far it can be zoomed. */
  width?: number;
  /** Its own height in px (its cell's `data-height`). */
  height?: number;
  /** Its words for the info panel. */
  words?: ItemWords;
  /** Not known yet: a band's group waiting for its album page. */
  pending?: boolean;
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
    stage: d.stage || undefined,
    still: d.still || undefined,
    stillDark: d.stillDark || undefined,
    poster: d.poster || undefined,
    posterDark: d.posterDark || undefined,
    videoType: d.videoType || undefined,
    tracks: tracksFrom(d.tracks),
    loop: d.loop !== undefined || undefined,
    embedSrc: d.embedSrc || undefined,
    download: d.download || undefined,
    duration: Number(d.duration) > 0 ? Number(d.duration) : undefined,
    width: Number(link.cellWidth) > 0 ? Number(link.cellWidth) : undefined,
    height: Number(link.cellHeight) > 0 ? Number(link.cellHeight) : undefined,
    words: link.words,
  };
}

/** A video's caption tracks from `data-tracks` (JSON); none when it's missing or isn't a list of tracks. */
export function tracksFrom(json: string | undefined): Track[] | undefined {
  if (!json) return undefined;
  try {
    const list: unknown = JSON.parse(json);
    if (!Array.isArray(list)) return undefined;
    const tracks = list.filter((t): t is Track => !!t && typeof t === 'object' && typeof t.src === 'string' && typeof t.srclang === 'string' && typeof t.label === 'string');
    return tracks.length ? tracks : undefined;
  } catch {
    return undefined;
  }
}

/** The group a link opens: every link in the same `data-lightbox` group, in page order, and where it is among them. */
export function groupFrom<T extends { group: string }>(links: readonly T[], opened: T): { members: T[]; index: number } {
  const members = links.filter((l) => l.group === opened.group);
  return { members, index: Math.max(0, members.indexOf(opened)) };
}

/** The full size to show: the dark version while the page is dark, if it has one. */
export const fullOf = (item: LightboxItem, dark: boolean): string => (item.hrefDark && dark ? item.hrefDark : item.href);

/**
 * What the stage shows of an item: its dark version while the page is dark; else the stage's size when
 * the link's is the larger one kept for zooming (fetched only when zooming starts, spec §8.7).
 */
export const stageOf = (item: LightboxItem, dark: boolean): string => (item.hrefDark && dark ? item.hrefDark : (item.stage ?? item.href));

/** A video's or an embed's poster, by the same rule. */
export const posterOf = (item: LightboxItem, dark: boolean): string | undefined => (item.posterDark && dark ? item.posterDark : item.poster);

/** An animated picture's still (shown paused), by the same rule. */
export const stillOf = (item: LightboxItem, dark: boolean): string | undefined => (item.stillDark && dark ? item.stillDark : item.still);

/** How the stage shows an item: a video or an embed it can't play (a band's, before its album arrives) shows its poster as a picture. */
export function stageKind(item: LightboxItem): ItemKind | 'pending' {
  if (item.pending) return 'pending';
  if (item.kind === 'video' && !item.videoType) return 'picture';
  if (item.kind === 'embed' && !item.embedSrc) return 'picture';
  return item.kind;
}

/** The kept-large size's width (3840 px) and the full size's (2560 px), the zoom's limits (spec §8.8). */
export const LARGEST_WIDTH = 3840;
export const FULL_WIDTH = 2560;

/**
 * The width of the largest size zooming can show: the item's own width, up to 3840 px when it's kept
 * large (its link's size is the larger one), else up to 2560; 0 when its width isn't known.
 */
export function largestWidth(item: Pick<LightboxItem, 'width' | 'stage'>): number {
  if (!item.width) return 0;
  return Math.min(item.width, item.stage ? LARGEST_WIDTH : FULL_WIDTH);
}

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
  return !item.pending && !!url && !url.includes('/_sealed/') && (item.kind === 'picture' || item.kind === 'drawing' || item.kind === 'animated');
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

// ---------- a band's group (spec §8.1) ----------

/** A band's tiles open the lightbox on their album: the group `band`. */
export const BAND_GROUP = 'band';

/** A band's tile, as the lightbox reads it: its item and its place in the album (`data-index`). */
export interface BandMember {
  item: LightboxItem;
  index?: number;
}

/** A place in the album not known yet: a placeholder in the filmstrip until the album page arrives. */
export const pendingItem = (albumTitle?: string): LightboxItem => ({ href: '', thumb: '', caption: '', alt: '', shadow: false, kind: 'picture', pending: true, albumTitle });

/**
 * The group a band opens before its album page arrives: the whole album's places (`count`, the band's
 * `data-count`), its tiles at theirs and placeholders between, so the counter reads "7 of 21" at once.
 * Without a count or a tile's place, it's the tiles in album order (bandFallback).
 */
export function bandGroup(members: readonly BandMember[], opened: number, count: number | undefined): { items: LightboxItem[]; index: number } {
  const placed = members.every((m) => m.index !== undefined && m.index >= 0);
  if (!count || !placed || members.some((m) => m.index! >= count)) return bandFallback(members, opened);
  const items = Array.from({ length: count }, () => pendingItem(members[0]?.item.albumTitle));
  for (const m of members) items[m.index!] = m.item;
  return { items, index: members[opened]?.index ?? 0 };
}

/** The group when the album page can't be fetched: the band's tiles, in album order. */
export function bandFallback(members: readonly BandMember[], opened: number): { items: LightboxItem[]; index: number } {
  const order = members.map((m, i) => ({ m, i })).sort((a, b) => (a.m.index ?? a.i) - (b.m.index ?? b.i) || a.i - b.i);
  return { items: order.map((o) => o.m.item), index: Math.max(0, order.findIndex((o) => o.i === opened)) };
}

/** The album page's address from a band tile's link (`<album>#item-<id>`): without its fragment. */
export const albumUrlOf = (href: string): string => href.split('#')[0];

/**
 * The album's part of Download's file name: its title as a slug ("A spring in the hills" → "a-spring-in-the-hills"),
 * else "album". Never its address: a private album's is its secret token.
 */
export function fileSlug(albumTitle: string | undefined): string {
  const slug = (albumTitle ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return slug || 'album';
}

/** An item's canonical address: the album page's, on the site, plus `#item-<id>` (spec §8.6). */
export const itemAddress = (albumUrl: string, id: string): string => `${albumUrlOf(albumUrl)}${itemHash(id)}`;

/** The filmstrip's last link when the album couldn't be fetched: "See all 21 in the album". */
export const seeAllWords = (count: number): string => `See all ${count} in the album`;

// ---------- the info panel's words (spec §8.3) ----------

/** The key the info panel's choice is kept under, for the visit. */
export const INFO_KEY = 'site.lightboxInfo';

/** Whether the info panel opens, from what's kept: open only when the reader left it open. */
export const infoKept = (raw: string | null): boolean => raw === 'open';

/** The date taken and the place: "Taken 12 March 2026, Shillong", each when known ('' when neither is). */
export function takenLine(takenWords: string | undefined, place: string | undefined): string {
  if (takenWords) return `Taken ${takenWords}${place ? `, ${place}` : ''}`;
  return place ? `Taken in ${place}` : '';
}

/** "From the album: Summer sketches". */
export const fromAlbum = (title: string): string => `From the album: ${title}`;

/** An embed's link to its page at the provider: "Watch on YouTube" (or Vimeo), from the page's address. */
export function watchOn(url: string): string {
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  })();
  if (/(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/.test(host)) return 'Watch on YouTube';
  if (/(^|\.)vimeo\.com$/.test(host)) return 'Watch on Vimeo';
  return 'Watch at the source';
}

/** A video's length in the panel: "Length 10:34". */
export function lengthWords(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) return '';
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return `Length ${h ? `${h}:${String(m).padStart(2, '0')}` : m}:${sec}`;
}
