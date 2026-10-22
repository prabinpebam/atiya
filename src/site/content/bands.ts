/**
 * An album's band (documentation/gallery/spec.md §5, §6), worked out for the AlbumBand compound: its counts and
 * dates in words, its cover's tiles in reading order with their places on the wide and the phone grid, their
 * pictures, posters and names (from the library items' sidecars), and which of them play. An album with nothing
 * to show has no band (§5: it's never shown).
 */
import { albumCounts, albumDates, countWords, coverOf, dateSpan, displayFor, phoneOf, readingOrder } from './album';
import { albumLookup, getAlbum } from './repository';
import { embedPoster, picture, video, type Picture } from './pictures';
import { lengthOf, playing, tileName, type BandTile } from '../scripts/albumBandRules';
import type { PictureSource } from '../design/pictures';

/** A band's props, but where the page places it (its break, its priority, its heading level). */
export interface Band {
  id: string;
  title: string;
  href: string;
  /** The album page's address on the site (its href may be a building's on the planet): what Copy link gives. */
  site: string;
  counts: string;
  dates?: string;
  summary?: string;
  tiles: BandTile[];
  total: number;
}

const source = (p: { src: string; srcset?: string; width: number; height: number; bg?: string }, still?: string): PictureSource => ({
  src: still ?? p.src,
  srcset: still ? undefined : p.srcset,
  width: p.width,
  height: p.height,
  bg: p.bg,
});

/** A picture as a tile's still: an animated picture's still poster, else the picture itself; and its dark version. */
const stillOf = (pic: Picture, animated: boolean): BandTile['still'] => ({
  ...source(pic, animated ? pic.poster : undefined),
  dark: pic.dark ? source(pic.dark, animated ? pic.dark.poster : undefined) : undefined,
});

/**
 * The band of the album `albumId` (its page's address `href`, and on the site `site`), or undefined when there's
 * no such album or it holds nothing it can show. Text cards are never in a band, nor counted in its items.
 */
export async function bandOf(albumId: string, href: string, site = href): Promise<Band | undefined> {
  const resolved = getAlbum(albumId);
  if (!resolved) return undefined;
  const { album, items } = resolved;
  const shown = items.filter((r) => r.kind && r.kind !== 'text' && 'media' in r.item);
  if (shown.length === 0) return undefined;
  const lookup = albumLookup();
  const byId = new Map(shown.map((r) => [r.item.id, r]));
  const phone = new Map(phoneOf(album, lookup).map((p) => [p.item, p]));
  const up = readingOrder(coverOf(album, lookup)).filter((t) => byId.has(t.item));
  const plays = playing(
    up.map((t) => {
      const r = byId.get(t.item)!;
      return { kind: r.kind as BandTile['kind'], play: t.play, bytes: r.image?.bytes ?? r.image?.facts?.bytes ?? r.video?.bytes };
    }),
  );

  const tiles = await Promise.all(
    up.map(async (t, i): Promise<BandTile> => {
      const r = byId.get(t.item)!;
      const kind = r.kind as BandTile['kind'];
      const media = 'media' in r.item ? r.item.media : '';
      const p = phone.get(t.item);
      const base = {
        id: r.item.id,
        index: shown.indexOf(r),
        kind,
        href: `${href}#item-${r.item.id}`,
        place: { x: t.x, y: t.y, w: t.w, h: t.h },
        phone: p && t.onPhones !== false ? { x: p.x, y: p.y, w: p.w, h: p.h } : undefined,
        display: displayFor(t, kind),
      };
      if (kind === 'video') {
        const v = await video(media, 'gallery');
        return {
          ...base,
          name: tileName({ kind, title: v.title, duration: v.duration }),
          still: v.poster ? source(v.poster) : undefined,
          motion: plays.has(i) ? { kind: 'video', src: v.src, type: v.type } : undefined,
          length: lengthOf(v.duration)?.clock,
        };
      }
      if (kind === 'embed') {
        const e = r.embed!;
        const poster = await embedPoster(media, 'gallery');
        return {
          ...base,
          name: tileName({ kind, title: e.title, duration: e.duration }),
          focus: t.focus ?? poster.focus,
          still: stillOf(poster, false),
          length: lengthOf(e.duration)?.clock,
        };
      }
      const pic = await picture(media, 'gallery');
      const animated = kind === 'animated';
      return {
        ...base,
        name: tileName({ kind, alt: pic.alt }),
        focus: t.focus ?? pic.focus,
        still: stillOf(pic, animated),
        motion: animated && plays.has(i) ? { kind: 'animated', src: pic.src, srcset: pic.srcset, dark: pic.dark ? pic.dark.srcset || pic.dark.src : undefined } : undefined,
        full: { src: pic.full, dark: pic.dark?.full, thumb: pic.thumb, thumbDark: pic.dark?.thumb, caption: pic.caption, alt: pic.alt },
      };
    }),
  );

  return {
    id: album.id,
    title: album.title,
    href,
    site,
    counts: countWords(albumCounts(album.items, lookup)),
    dates: dateSpan(albumDates(album, lookup)),
    summary: album.summary,
    tiles,
    total: shown.length,
  };
}

/**
 * A section's bands for its Albums view, by node (§5), from its albums' routes and their addresses: and the
 * albums with nothing to show, which are never shown.
 */
export async function bandsOf(albums: readonly { node: string; album: string; href: string; site?: string }[]): Promise<{ bands: Record<string, Band>; hidden: Set<string> }> {
  const bands: Record<string, Band> = {};
  const hidden = new Set<string>();
  for (const a of albums) {
    const band = await bandOf(a.album, a.href, a.site);
    if (band) bands[a.node] = band;
    else hidden.add(a.node);
  }
  return { bands, hidden };
}
