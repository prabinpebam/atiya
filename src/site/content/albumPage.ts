/**
 * An album's page (documentation/gallery/spec.md §7): its items as the page's cells, and its opening's
 * counts and dates. Pure: the pictures, the video files and the ref resolver are handed in (opening.ts
 * `albumOf` wires the real ones), so it's unit-tested (`tests/unit/albumPage.test.ts`).
 */
import { albumCounts, albumDates, countWords, dateSpan, dayWords, type AlbumMedia, type MediaLookup, type ResolvedItem } from './album';
import { renderMarkdown } from './markdown';
import type { Picture, VideoFile } from './pictures';
import type { Album } from './schema';
import type { AlbumCell, AlbumCellPicture } from '../scripts/albumGrid';

/** An embed's shape when the provider's isn't known (§3.3): 16:9. */
export const EMBED_SHAPE = { width: 1600, height: 900 } as const;

/** What the page needs to draw its cells: a picture and a video file at the layout's slot, and a ref's address. */
export interface CellSources {
  pictureOf: (id: string) => Promise<Picture>;
  videoOf: (id: string) => Promise<VideoFile>;
  /** Turns a `ref:` link in a description into an address. */
  resolveRef?: (ref: string) => string | undefined;
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
export const itemFragment = (album: Album) => {
  const ids = new Set(album.items.map((i) => `item-${i.id}`));
  return (fragment: string) => ids.has(fragment);
};

/**
 * Every item of an album as its page's cells, in album order: its picture (or poster), its words and its
 * link's target. An item whose media isn't there is left out (the content check refuses it on a published
 * page). The dates are left out when the album hides them.
 */
export async function albumCells<I extends AlbumMedia, V extends AlbumMedia>(album: Album, items: readonly ResolvedItem<I, V>[], from: CellSources): Promise<AlbumCell[]> {
  const words = (md: string | undefined) => (md ? renderMarkdown(md, { resolveRef: from.resolveRef, fragment: itemFragment(album) }) : undefined);
  const cells = await Promise.all(
    items.map(async ({ item, kind, image }): Promise<AlbumCell | undefined> => {
      if (!kind) return undefined;
      const download = item.download ?? album.download === true;
      const taken = album.dates !== false && image?.kind === 'image' ? image.taken : undefined;
      const common = {
        id: item.id,
        kind,
        ...(item.description ? { description: words(item.description) } : {}),
        ...(item.place ? { place: item.place } : {}),
        ...(taken ? { taken, takenWords: dayWords(taken) } : {}),
      };
      if (kind === 'embed') {
        const e = item.embed!;
        const poster = item.poster ? await from.pictureOf(item.poster) : undefined;
        return {
          ...common,
          width: e.width ?? EMBED_SHAPE.width,
          height: e.height ?? EMBED_SHAPE.height,
          embed: { provider: e.provider, id: e.id },
          title: item.title,
          ...(item.duration ? { duration: item.duration } : {}),
          ...(item.caption ? { caption: item.caption } : {}),
          ...(poster ? { picture: cellPicture(poster, '') } : {}),
        };
      }
      if (kind === 'video') {
        const v = await from.videoOf(item.media!);
        const p = v.poster;
        return {
          ...common,
          width: v.width,
          height: v.height,
          video: { src: v.src, type: v.type, ...(from.tracksOf?.(item.media!).length ? { tracks: from.tracksOf(item.media!) } : {}), ...(item.loop ? { loop: true } : {}) },
          title: item.title ?? v.title,
          ...(v.duration ? { duration: v.duration } : {}),
          ...((item.caption ?? v.caption) ? { caption: item.caption ?? v.caption } : {}),
          ...(v.credit ? { credit: v.credit } : {}),
          ...(p ? { picture: { src: p.src, srcset: p.srcset || undefined, width: p.width, height: p.height, alt: '', full: p.src, thumb: p.thumb } } : {}),
          ...(download ? { download: v.src } : {}),
        };
      }
      const p = await from.pictureOf(item.media!);
      const picture = cellPicture(p);
      return {
        ...common,
        width: p.width,
        height: p.height,
        picture,
        ...((item.caption ?? p.caption) ? { caption: item.caption ?? p.caption } : {}),
        ...(p.credit ? { credit: p.credit } : {}),
        ...(download ? { download: picture.full } : {}),
      };
    }),
  );
  return cells.filter((c): c is AlbumCell => !!c);
}

/** The album's measure in its opening and on its cards: "18 pictures, 2 videos" ('' for an empty album). */
export const albumMeasure = (album: Pick<Album, 'items'>, lookup: MediaLookup): string => countWords(albumCounts(album.items, lookup));

/**
 * The date in the album's opening (§7): the span of the days its items were taken, or the page's own day
 * when none is known or the album hides them.
 */
export const albumDateWords = (album: Pick<Album, 'items' | 'dates'>, lookup: MediaLookup, publishedAt?: string): string | undefined =>
  dateSpan(albumDates(album, lookup)) ?? (publishedAt ? dayWords(publishedAt) : undefined);
