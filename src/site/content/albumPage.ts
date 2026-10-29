/**
 * An album's page (documentation/gallery/spec.md §7): its items as the page's cells and its text cards, and its
 * opening's counts and dates. An item's words (caption, description, place, the day it was taken, credit) are its
 * library item's, read from its sidecar (§3.3): an album holds none. Pure: the pictures, the video files, the
 * linked videos' posters and the ref resolver are handed in (opening.ts `albumOf` wires the real ones), so it's
 * unit-tested (`tests/unit/albumPage.test.ts`).
 */
import { albumCounts, albumDates, countWords, dateSpan, dayWords, type AlbumMedia, type MediaLookup, type ResolvedItem } from './album';
import { renderMarkdown, type MarkdownOptions } from './markdown';
import type { Picture, VideoFile } from './pictures';
import type { Album } from './schema';
import type { AlbumCell, AlbumCellPicture, AlbumEntry } from '../scripts/albumGrid';

/** A linked video's shape when its sidecar gives none (§4.2): 16:9. */
export const EMBED_SHAPE = { width: 1600, height: 900 } as const;

/** The words a library item's sidecar holds for it (§3.3). */
interface SidecarWords {
  caption?: string;
  description?: string;
  place?: string;
  taken?: string;
  credit?: string;
}

/** A picture's record, as the cells read it (the loader's MediaRecord fits it). */
export type CellImage = Extract<AlbumMedia, { kind: 'image' }> & SidecarWords;
/** A video file's record (the loader's VideoRecord fits it). */
export type CellVideo = Extract<AlbumMedia, { kind: 'video' }> & SidecarWords & { title?: string; duration?: number };
/** A linked video's record (the loader's EmbedRecord fits it): `video` is the provider's ID for it. */
export type CellEmbed = Extract<AlbumMedia, { kind: 'embed' }> & SidecarWords & { provider: 'youtube' | 'vimeo'; video: string; title?: string; duration?: number };

/** What the page needs to draw its cells: a picture, a video file and a linked video's poster at the layout's slot, and a ref's address. */
export interface CellSources {
  pictureOf: (id: string) => Promise<Picture>;
  videoOf: (id: string) => Promise<VideoFile>;
  /** A linked video's poster, by its media ID. */
  posterOf: (id: string) => Promise<Picture>;
  /** Turns a `ref:` link in a description into an address (or an address with its link's data). */
  resolveRef?: MarkdownOptions['resolveRef'];
  /** A video file's caption tracks, for the lightbox's player (repository.ts `captionHrefs`). */
  tracksOf?: (id: string) => { src: string; srclang: string; label: string; default?: boolean }[];
}

/** A picture as a cell shows it (a poster has no alt: its link is named by the video's title). */
export function cellPicture(p: Picture, alt = p.alt): AlbumCellPicture {
  const d = p.dark;
  return {
    src: p.src,
    srcset: p.srcset || undefined,
    width: p.width,
    height: p.height,
    bg: p.bg,
    alt,
    full: p.largest?.src ?? p.full,
    ...(p.largest && p.largest.src !== p.full ? { stage: p.full } : {}),
    thumb: p.thumb,
    ...(p.poster ? { poster: p.poster } : {}),
    ...(p.focus ? { focus: p.focus } : {}),
    ...(p.drawing ? { drawing: true } : {}),
    ...(d ? { dark: { src: d.src, srcset: d.srcset || undefined, width: d.width, height: d.height, bg: d.bg, full: d.full, thumb: d.thumb, ...(d.poster ? { poster: d.poster } : {}) } } : {}),
  };
}

/** An album's words may link to its own items (`#item-<id>`), and only to items it has. */
export const itemFragment = (album: Pick<Album, 'items'>) => {
  const ids = new Set(album.items.map((i) => `item-${i.id}`));
  return (fragment: string) => ids.has(fragment);
};

/**
 * Every item of an album as its page's entries, in album order: a library item's cell (its picture or poster,
 * its sidecar's words and its link's target), and a text card's words. An item whose library item isn't there
 * is left out (the content check refuses it on a published album). The dates are left out when the album hides
 * them; a download is offered when the item, else the album, allows it, never for a linked video.
 */
export async function albumCells<I extends CellImage, V extends CellVideo, E extends CellEmbed>(album: Album, items: readonly ResolvedItem<I, V, E>[], from: CellSources): Promise<AlbumEntry[]> {
  const words = (md: string | undefined) => (md ? renderMarkdown(md, { resolveRef: from.resolveRef, fragment: itemFragment(album) }) : undefined);
  const cells = await Promise.all(
    items.map(async ({ item, kind, image, video, embed, text }): Promise<AlbumEntry | undefined> => {
      if (kind === 'text') return { id: item.id, kind: 'text', html: words(text) ?? '' };
      if (!kind || !('media' in item)) return undefined;
      const sidecar: SidecarWords | undefined = image ?? video ?? embed;
      if (!sidecar) return undefined;
      const download = item.download ?? album.download === true;
      const taken = album.dates !== false ? sidecar.taken : undefined;
      const description = words(sidecar.description);
      const common = {
        id: item.id,
        kind,
        ...(sidecar.caption ? { caption: sidecar.caption } : {}),
        ...(description ? { description } : {}),
        ...(sidecar.credit ? { credit: sidecar.credit } : {}),
        ...(sidecar.place ? { place: sidecar.place } : {}),
        ...(taken ? { taken, takenWords: dayWords(taken) } : {}),
      };
      if (kind === 'embed' && embed) {
        const poster = await from.posterOf(item.media);
        return {
          ...common,
          width: embed.shape?.width ?? EMBED_SHAPE.width,
          height: embed.shape?.height ?? EMBED_SHAPE.height,
          embed: { provider: embed.provider, id: embed.video },
          ...(embed.title ? { title: embed.title } : {}),
          ...(embed.duration ? { duration: embed.duration } : {}),
          picture: cellPicture(poster, ''),
        };
      }
      if (kind === 'video') {
        const v = await from.videoOf(item.media);
        const p = v.poster;
        const tracks = from.tracksOf?.(item.media) ?? [];
        return {
          ...common,
          width: v.width,
          height: v.height,
          video: { src: v.src, type: v.type, ...(tracks.length ? { tracks } : {}), ...(item.loop ? { loop: true } : {}) },
          title: v.title,
          ...(v.duration ? { duration: v.duration } : {}),
          ...(p ? { picture: { src: p.src, srcset: p.srcset || undefined, width: p.width, height: p.height, alt: '', full: p.src, thumb: p.thumb } } : {}),
          ...(download ? { download: v.src } : {}),
        };
      }
      const p = await from.pictureOf(item.media);
      const picture = cellPicture(p);
      return {
        ...common,
        width: p.width,
        height: p.height,
        picture,
        ...(download ? { download: picture.full } : {}),
      } satisfies AlbumCell;
    }),
  );
  return cells.filter((c): c is AlbumEntry => !!c);
}

/** The album's measure in its opening and on its cards: "18 pictures, 2 videos" ('' for an empty album). */
export const albumMeasure = (album: Pick<Album, 'items'>, lookup: MediaLookup): string => countWords(albumCounts(album.items, lookup));

/**
 * The date in the album's opening (§7): the span of the days its items were taken, or the album's own day
 * (published, else made) when none is known or the album hides them.
 */
export const albumDateWords = (album: Pick<Album, 'items' | 'dates'>, lookup: MediaLookup, day?: string): string | undefined =>
  dateSpan(albumDates(album, lookup)) ?? (day ? dayWords(day) : undefined);
