/**
 * An album's band on a section's Albums view (documentation/gallery/spec.md §5, §6), worked out from the album page
 * for the AlbumBand compound: its counts and dates in words, its tiles up front in reading order with their
 * places on the wide and the phone grid, their pictures, posters and names, and which of them play.
 * An album with nothing to show has no band (§5: it's never shown).
 */
import { albumCounts, albumDates, countWords, dateSpan, displayFor, phoneOf, readingOrder, showcaseOf, type AlbumMedia, type MediaLookup } from './album';
import { getAlbum, getArticle } from './repository';
import { picture, video, type Picture } from './pictures';
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
 * The band of the album page `pageId` (its address `href`, and on the site `site`), or undefined when it isn't an
 * album or holds nothing it can show.
 */
export async function bandOf(pageId: string, href: string, site = href): Promise<Band | undefined> {
  const article = getArticle(pageId);
  const resolved = getAlbum(pageId);
  if (!article || !resolved) return undefined;
  const { album, items } = resolved;
  const shown = items.filter((r) => r.kind);
  if (shown.length === 0) return undefined;
  const byId = new Map(shown.map((r) => [r.item.id, r]));
  const media = new Map<string, AlbumMedia>();
  for (const r of items) {
    const m = r.image ?? r.video;
    if (r.item.media && m) media.set(r.item.media, m);
  }
  const lookup: MediaLookup = (id) => media.get(id);
  const phone = new Map(phoneOf(album).map((p) => [p.item, p]));
  const up = readingOrder(showcaseOf(album)).filter((t) => byId.has(t.item));
  const plays = playing(
    up.map((t) => {
      const r = byId.get(t.item)!;
      const m = r.image ?? r.video;
      return { kind: r.kind, play: t.play, bytes: m?.bytes ?? (r.image?.facts?.bytes) };
    }),
  );

  const tiles = await Promise.all(
    up.map(async (t, i): Promise<BandTile> => {
      const r = byId.get(t.item)!;
      const kind = r.kind!;
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
        const v = await video(r.item.media!, 'gallery');
        const duration = v.duration;
        return {
          ...base,
          name: tileName({ kind, title: r.item.title ?? v.title, duration }),
          still: v.poster ? source(v.poster) : undefined,
          motion: plays.has(i) ? { kind: 'video', src: v.src, type: v.type } : undefined,
          length: lengthOf(duration)?.clock,
        };
      }
      if (kind === 'embed') {
        const poster = r.item.poster ? await picture(r.item.poster, 'gallery') : undefined;
        return {
          ...base,
          name: tileName({ kind, title: r.item.title, duration: r.item.duration }),
          focus: t.focus ?? poster?.focus,
          still: poster ? stillOf(poster, false) : undefined,
          length: lengthOf(r.item.duration)?.clock,
        };
      }
      const pic = await picture(r.item.media!, 'gallery');
      const animated = kind === 'animated';
      return {
        ...base,
        name: tileName({ kind, alt: pic.alt, title: r.item.title }),
        focus: t.focus ?? pic.focus,
        still: stillOf(pic, animated),
        motion: animated && plays.has(i) ? { kind: 'animated', src: pic.src, srcset: pic.srcset, dark: pic.dark ? pic.dark.srcset || pic.dark.src : undefined } : undefined,
        full: { src: pic.full, dark: pic.dark?.full, thumb: pic.thumb, thumbDark: pic.dark?.thumb, caption: r.item.caption ?? pic.caption, alt: pic.alt },
      };
    }),
  );

  return {
    id: pageId,
    title: article.title,
    href,
    site,
    counts: countWords(albumCounts(album.items, lookup)),
    dates: dateSpan(albumDates(album, lookup)),
    summary: article.summary,
    tiles,
    total: shown.length,
  };
}

/**
 * A section's bands for its Albums view, by node (§5), from its pages' routes and their addresses: and the
 * album pages with nothing to show, which are drafts and never shown.
 */
export async function bandsOf(pages: readonly { node: string; page: string; href: string; site?: string }[]): Promise<{ bands: Record<string, Band>; hidden: Set<string> }> {
  const bands: Record<string, Band> = {};
  const hidden = new Set<string>();
  for (const p of pages) {
    if (!getArticle(p.page)?.album) continue;
    const band = await bandOf(p.page, p.href, p.site);
    if (band) bands[p.node] = band;
    else hidden.add(p.node);
  }
  return { bands, hidden };
}