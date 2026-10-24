/**
 * What the Albums screen and the album editor draw (documentation/gallery/spec.md §9.1, §9.2): each album's card,
 * the editor's cells in the order shown and the cover band as it stands, with their thumbnails.
 */
import type { Album } from '../../content/schema';
import type { ContentIndex } from '../../content/load';
import { albumCounts, albumDates, albumOrder, albumsOrder, aspectOf, coverLead, coverOf, coverPicture, countWords, dateSpan, isMediaItem, isTextItem, itemKind, type ItemKind } from '../../content/album';
import type { CoverItem } from '../model/cover';
import { embedPoster, picture, video } from '../../content/pictures';
import { findHub, hubs } from '../model/structure';
import { withBase } from '../../design/meta';
import { lookupOf } from './albums';
// ---------- what the screens draw ----------

/** A thumbnail: a picture's card size, a video's or linked video's poster. */
export async function thumbOf(index: ContentIndex, media: string): Promise<{ thumb: string; alt: string; bg?: string; drawing?: boolean; width: number; height: number; dark?: { src: string; width: number; height: number } }> {
  try {
    if (index.media.has(media)) {
      const p = await picture(media, 'card');
      return { thumb: p.thumb, alt: p.alt, bg: p.bg, width: p.width, height: p.height, ...(p.drawing ? { drawing: true } : {}), ...(p.dark ? { dark: { src: p.dark.thumb, width: p.dark.width, height: p.dark.height } } : {}) };
    }
    if (index.videos.has(media)) {
      const v = await video(media, 'card');
      const m = index.videos.get(media)!;
      return { thumb: v.poster?.thumb ?? '', alt: v.title, width: m.width, height: m.height };
    }
    if (index.embeds.has(media)) {
      const e = await embedPoster(media, 'card');
      return { thumb: e.thumb, alt: index.embeds.get(media)?.title ?? '', width: 16, height: 9 };
    }
  } catch {
    // a broken master shows as an empty tile, never stops the screen
  }
  return { thumb: '', alt: '', width: 1, height: 1 };
}

/** An album as the Albums screen shows it (§9.1). */
export interface AlbumCard {
  id: string;
  title: string;
  href: string;
  /** Its page on the site (published), else null. */
  path: string | null;
  cover: { thumb: string; alt: string; bg?: string; width: number; height: number } | null;
  count: string;
  dates?: string;
  draft: boolean;
  private: boolean;
  section: { id: string; title: string } | null;
  /** Its section isn't the gallery (the section whose view is Albums). */
  elsewhere: boolean;
  updatedAt: string;
}

/** Every album, drafts first, then in the gallery's order (§9.1). */
export async function albumCards(index: ContentIndex): Promise<AlbumCard[]> {
  const lookup = lookupOf(index);
  const gallery = hubs(index.structure).find((h) => h.depth === 1 && findHub(index.structure, h.id)?.view === 'albums');
  const order = gallery ? findHub(index.structure, gallery.id)?.albumOrder : undefined;
  const all = [...index.albums.values()];
  const drafts = all.filter((a) => a.status !== 'published').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title));
  const published = albumsOrder(all.filter((a) => a.status === 'published'), order, lookup);
  return Promise.all(
    [...drafts, ...published].map(async (a): Promise<AlbumCard> => {
      const route = index.routes.find((r) => r.node.kind === 'item' && r.node.item.type === 'album' && r.node.item.id === a.id);
      const sectionId = route?.parent?.id ?? null;
      const cp = coverPicture(a, lookup);
      const cover = cp ? await thumbOf(index, cp.media) : null;
      const span = dateSpan(albumDates(a, lookup));
      return {
        id: a.id,
        title: a.title,
        href: withBase(`/_edit/albums/${a.id}/`),
        path: route?.published ? route.path : null,
        cover: cover && cover.thumb ? cover : null,
        count: countWords(albumCounts(a.items, lookup)),
        ...(span ? { dates: span } : {}),
        draft: a.status !== 'published',
        private: index.origins.get(a.id) === 'private',
        section: route?.parent ? { id: route.parent.id, title: route.parent.title } : null,
        elsewhere: !!sectionId && sectionId !== gallery?.id,
        updatedAt: a.updatedAt,
      };
    }),
  );
}

/** One cell of the album editor's grid (§9.2). */
export interface AlbumCell {
  id: string;
  kind: ItemKind | 'missing';
  /** A media item's library ID. */
  media?: string;
  thumb?: string;
  alt?: string;
  bg?: string;
  /** Its thumbnail's shape (px). */
  width?: number;
  height?: number;
  /** A picture without alt text (and not decorative). */
  needsAlt?: boolean;
  /** A text card's words. */
  text?: string;
  /** The day it was taken (YYYY-MM-DD), for the day headers. */
  taken?: string;
  /** It's the cover picture. */
  cover?: boolean;
  /** Its downloads, when it differs from the album's. */
  download?: boolean;
}

/** What a client-side lookup needs of a library item: its kind, date and shape (the album model's ops read only these). */
export type LookupFacts = Record<string, { kind: 'image'; file: ''; taken?: string } | { kind: 'video'; file: ''; width: number; height: number; taken?: string } | { kind: 'embed'; provider: string; taken?: string }>;

/** The album editor's cells, in the order shown, with the facts its script's lookup needs. */
export async function albumCells(index: ContentIndex, album: Album): Promise<{ cells: AlbumCell[]; facts: LookupFacts }> {
  const lookup = lookupOf(index);
  const lead = coverPicture(album, lookup)?.item.id ?? coverLead(album);
  const facts: LookupFacts = {};
  const cells = await Promise.all(
    albumOrder(album, lookup).map(async (item): Promise<AlbumCell> => {
      if (isTextItem(item)) return { id: item.id, kind: 'text', text: item.text };
      const m = lookup(item.media);
      if (!m) return { id: item.id, kind: 'missing', media: item.media };
      const taken = m.taken?.slice(0, 10);
      facts[item.media] = m.kind === 'image' ? { kind: 'image', file: '', ...(m.taken ? { taken: m.taken } : {}) } : m.kind === 'video' ? { kind: 'video', file: '', width: m.width, height: m.height, ...(m.taken ? { taken: m.taken } : {}) } : { kind: 'embed', provider: m.provider, ...(m.taken ? { taken: m.taken } : {}) };
      const t = await thumbOf(index, item.media);
      return {
        id: item.id,
        kind: itemKind(item, lookup) ?? 'missing',
        media: item.media,
        thumb: t.thumb,
        alt: t.alt,
        ...(t.bg ? { bg: t.bg } : {}),
        width: t.width,
        height: t.height,
        ...(m.kind === 'image' && !m.alt && !m.decorative ? { needsAlt: true } : {}),
        ...(taken ? { taken } : {}),
        ...(item.id === lead ? { cover: true } : {}),
        ...(item.download !== undefined ? { download: item.download } : {}),
      };
    }),
  );
  return { cells, facts };
}

/** The cover band as it stands: its tiles with their thumbnails, whether it's arranged, and the album's pictures and videos as Edit cover draws them (§9.6). */
export async function coverBand(
  index: ContentIndex,
  album: Album,
): Promise<{ arranged: boolean; tiles: { item: string; x: number; y: number; w: number; h: number; thumb: string; alt: string; bg?: string; width: number; height: number }[]; items: CoverItem[] }> {
  const lookup = lookupOf(index);
  const byId = new Map(album.items.map((i) => [i.id, i]));
  const tiles = await Promise.all(
    coverOf(album, lookup).map(async (t) => {
      const item = byId.get(t.item);
      const shown = item && !isTextItem(item) ? await thumbOf(index, item.media) : { thumb: '', alt: '', width: 1, height: 1 };
      return { item: t.item, x: t.x, y: t.y, w: t.w, h: t.h, ...shown };
    }),
  );
  const items = await Promise.all(
    albumOrder(album, lookup)
      .filter(isMediaItem)
      .filter((i) => lookup(i.media))
      .map(async (i): Promise<CoverItem> => {
        const m = lookup(i.media)!;
        const t = await thumbOf(index, i.media);
        const bytes = m.kind === 'embed' ? undefined : (m.bytes ?? (m.kind === 'image' ? m.facts?.bytes : undefined));
        const aspect = aspectOf(m);
        const focus = index.media.get(i.media)?.focus;
        return {
          id: i.id,
          label: t.alt || i.media.split('/').pop() || i.id,
          kind: itemKind(i, lookup),
          thumb: t.thumb,
          ...(t.bg ? { bg: t.bg } : {}),
          width: t.width,
          height: t.height,
          ...(bytes !== undefined ? { bytes } : {}),
          ...(aspect ? { aspect } : {}),
          ...(focus ? { focus } : {}),
        };
      }),
  );
  return { arranged: !!album.cover && 'tiles' in album.cover, tiles, items };
}
