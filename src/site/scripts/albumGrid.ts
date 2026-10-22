/**
 * An album's items on its page (documentation/gallery/spec.md §7): what each cell shows and says, the names
 * of its links, a video's length, and the grid's rows kept level when captions sit under the cells. Pure
 * and unit-tested (`tests/unit/albumPage.test.ts`); the `AlbumGrid` compound draws them.
 */
import type { PictureSource } from '../design/pictures';
import type { GalleryBox } from './justifiedGallery';

/** What an item is: it decides its cell's badge, its link's name and how the lightbox shows it (spec §8.2). */
export type AlbumItemKind = 'picture' | 'animated' | 'drawing' | 'video' | 'embed';

/** A cell's picture: the item's own, or a video's or an embed's poster. */
export interface AlbumCellPicture extends PictureSource {
  /** What it shows ('' for a poster: the link is named by the video's title). */
  alt: string;
  /** Its full size, which the link opens without scripts (a picture's) and the lightbox shows. */
  full: string;
  /** The size the lightbox's stage shows when `full` is the larger one kept for zooming (a picture kept large). */
  stage?: string;
  /** Its thumbnail, for the lightbox's filmstrip. */
  thumb: string;
  /** An animated picture's still first frame, shown under reduced motion. */
  poster?: string;
  /** Which part stays in a crop ("50% 30%"). */
  focus?: string;
  /** A drawing (an SVG kept as a vector): shown whole. */
  drawing?: boolean;
  /** Its dark mode version. */
  dark?: PictureSource & { full: string; thumb: string; poster?: string };
}

/** One of an album's items, as its page shows it. */
export interface AlbumCell {
  /** The item's ID: its address on the page (`#item-<id>`). */
  id: string;
  /** What it is. */
  kind: AlbumItemKind;
  /** Its own size (px), for its shape. */
  width: number;
  /** Its own height (px). */
  height: number;
  /** What the cell shows: the picture, or a video's or an embed's poster (none: a quiet placeholder of its shape). */
  picture?: AlbumCellPicture;
  /** A video file: its address (the link's target without scripts). */
  video?: { src: string; type: 'video/mp4' | 'video/webm'; tracks?: { src: string; srclang: string; label: string; default?: boolean }[]; loop?: boolean };
  /** A YouTube or Vimeo video. */
  embed?: { provider: 'youtube' | 'vimeo'; id: string };
  /** A video's or an embed's title. */
  title?: string;
  /** A video's or an embed's length, in seconds. */
  duration?: number;
  /** Its caption (plain text). */
  caption?: string;
  /** Its description, as HTML (the album's Markdown, rendered). */
  description?: string;
  /** Who made it. */
  credit?: string;
  /** The day it was taken (ISO), when the album shows dates. */
  taken?: string;
  /** The day it was taken, in words ("12 March 2026"). */
  takenWords?: string;
  /** Where it was made. */
  place?: string;
  /** The file a reader may download from the lightbox, when the album or the item allows it. */
  download?: string;
}

/** A length on a poster: 140 → "2:20", 3725 → "1:02:05". */
export function clockOf(seconds: number | undefined): string | undefined {
  if (!seconds || seconds < 0) return undefined;
  const s = Math.round(seconds);
  const [h, m, r] = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60];
  const two = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${two(m)}:${two(r)}` : `${m}:${two(r)}`;
}

/** A length in words, for a link's name: 140 → "2 minutes 20 seconds". */
export function spokenLength(seconds: number | undefined): string | undefined {
  if (!seconds || seconds < 0) return undefined;
  const s = Math.round(seconds);
  const unit = (n: number, one: string) => (n ? [`${n} ${one}${n === 1 ? '' : 's'}`] : []);
  return [...unit(Math.floor(s / 3600), 'hour'), ...unit(Math.floor((s % 3600) / 60), 'minute'), ...unit(s % 60, 'second')].join(' ') || undefined;
}

/**
 * A cell's link's name (spec §12): a picture's alt text (", animated" after an animated one's), a video's or
 * an embed's "Video: <title>" and its length; an item with neither falls back to its caption, then its place
 * in the album ("Item 3 of 12").
 */
export function cellName(cell: Pick<AlbumCell, 'kind' | 'picture' | 'title' | 'duration' | 'caption'>, index: number, count: number): string {
  if (cell.kind === 'video' || cell.kind === 'embed') {
    const length = spokenLength(cell.duration);
    return `Video: ${cell.title || cell.caption || `item ${index + 1} of ${count}`}${length ? `, ${length}` : ''}`;
  }
  const words = cell.picture?.alt || cell.caption || `Item ${index + 1} of ${count}`;
  return cell.kind === 'animated' ? `${words}, animated` : words;
}

/** The providers' names on an embed's badge (the same as providers.ts names them: a unit test holds them equal). */
export const PROVIDER_NAMES: Record<'youtube' | 'vimeo', string> = { youtube: 'YouTube', vimeo: 'Vimeo' };

/** A cell's badge: Play (a video or an embed, with its length and an embed's provider), Animated, or none. */
export function badgeOf(cell: Pick<AlbumCell, 'kind' | 'embed' | 'duration'>): { icon: 'play' | 'animated'; words?: string } | undefined {
  if (cell.kind === 'animated') return { icon: 'animated' };
  if (cell.kind !== 'video' && cell.kind !== 'embed') return undefined;
  const words = [cell.embed && PROVIDER_NAMES[cell.embed.provider], clockOf(cell.duration)].filter(Boolean).join(' · ');
  return { icon: 'play', ...(words ? { words } : {}) };
}

/** A cell's place, its picture's height and its whole height (with the caption under it), in px. */
export interface LevelBox {
  index: number;
  left: number;
  top: number;
  width: number;
  /** The picture's height. */
  height: number;
  /** The cell's height: the picture and the room for its caption. */
  block: number;
}

/**
 * The justified grid's boxes with room under each for a caption (spec §7: at most two lines, the space kept
 * where there's none), so every row stays level: each row moves down by the room the rows above took.
 * `room` 0 leaves the boxes as they are.
 */
export function levelRows(boxes: readonly GalleryBox[], rows: number, height: number, room: number): { boxes: LevelBox[]; height: number } {
  return {
    boxes: boxes.map((b) => ({ index: b.index, left: b.left, top: b.top + b.row * room, width: b.width, height: b.height + (b.rows - 1) * room, block: b.height + b.rows * room })),
    height: height + rows * room,
  };
}

/** Where a cell's link goes without scripts (§7): a picture's full size, a video's file, an embed's page at its provider. */
export function cellHref(cell: Pick<AlbumCell, 'kind' | 'picture' | 'video' | 'embed'>, pageOf: (provider: 'youtube' | 'vimeo', id: string) => string): string {
  if (cell.embed) return pageOf(cell.embed.provider, cell.embed.id);
  if (cell.video) return cell.video.src;
  return cell.picture?.full ?? '';
}
