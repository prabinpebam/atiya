/**
 * The gallery as edit mode sets it up (documentation/gallery/spec.md §9.1, §9.2): a section whose view is Albums,
 * its title, its short description and the order of its albums, and the owner's own order made by dragging an
 * album in the albums list. Pure: the server reads and writes the files.
 */
import type { HubNode, SiteNode, SiteStructure } from '../../content/schema';
import { SECTION_ALBUM_ORDERS } from '../../content/schema';

export type GalleryOrder = (typeof SECTION_ALBUM_ORDERS)[number];

/** A gallery: a top section whose view is Albums. */
export interface Gallery {
  id: string;
  title: string;
  summary?: string;
  path: string;
  /** Its order of albums (left out in the file: newest first). */
  order: GalleryOrder;
  /** Its covers' pictures with rounded corners (left out in the file: rounded). */
  rounded: boolean;
}

/** What the gallery setup changes. */
export interface GallerySettings {
  title: string;
  summary?: string;
  order: GalleryOrder;
  /** Rounded corners on every picture in its albums' covers; false squares them. Left out, kept as it is. */
  rounded?: boolean;
}

export const ORDER_WORDS: Record<GalleryOrder, string> = { newest: 'Newest first', oldest: 'Oldest first', custom: 'Your own order' };

/** The Albums screen's line while the albums list shows: the same over the gallery's setup and over an album, so nothing moves as you choose. */
export const ALBUMS_LIST_INTRO = 'Your albums in the gallery’s order, beside the gallery’s own setup. Drag an album by its handle to put them in your own order.';

/** An album as a row of the albums list shows it. */
export interface AlbumRow {
  /** The album's ID. */
  id: string;
  /** Its title. */
  title: string;
  /** Its editor. */
  href: string;
  /** Its cover picture's thumbnail, or none yet. */
  cover: { thumb: string; width: number; height: number; bg?: string } | null;
  /** The line under its title ("Draft · 12 pictures"). */
  line: string;
}

/** The line under an album's title in the list: Draft and Private first, then what it holds. */
export function rowLine(a: { draft: boolean; private: boolean; count: string }): string {
  return [a.draft ? 'Draft' : '', a.private ? 'Private' : '', a.count || 'Empty'].filter(Boolean).join(' · ');
}

/** The gallery's entry's line: its order and how many albums it shows. */
export function galleryLine(g: Gallery, albums: number): string {
  return `${ORDER_WORDS[g.order]} · ${albums === 1 ? '1 album' : `${albums} albums`}`;
}

const topHubs = (structure: SiteStructure): HubNode[] => (structure.home.children ?? []).filter((c): c is HubNode => c.kind === 'hub');

/** The site's galleries, in the structure's order. */
export function galleries(structure: SiteStructure): Gallery[] {
  return topHubs(structure)
    .filter((h) => h.view === 'albums')
    .map((h) => ({ id: h.id, title: h.title, ...(h.summary ? { summary: h.summary } : {}), path: `/${h.slug}/`, order: h.albumOrder ?? 'newest', rounded: h.albumCorners !== 'square' }));
}

/** The gallery asked for, else the first; undefined when no section shows albums. */
export const chosenGallery = (all: readonly Gallery[], asked?: string | null): Gallery | undefined => all.find((g) => g.id === asked) ?? all[0];

/**
 * A section's full order (its pages' and albums' nodes) with its albums put in `albums`' order, in the places
 * albums held, every other node where it was. `albums` must name exactly the albums' nodes in `full`.
 */
export function withAlbumsInOrder(full: readonly string[], albums: readonly string[]): string[] | undefined {
  const isAlbum = new Set(albums);
  const held = full.filter((n) => isAlbum.has(n));
  if (held.length !== albums.length || albums.some((a) => !held.includes(a))) return undefined;
  let next = 0;
  return full.map((n) => (isAlbum.has(n) ? albums[next++]! : n));
}

/** One album moved by `by` places among `order` (Alt with Up or Down); unchanged at either end. */
export function nudged(order: readonly string[], id: string, by: -1 | 1): string[] {
  const at = order.indexOf(id);
  const to = at + by;
  if (at < 0 || to < 0 || to >= order.length) return [...order];
  const out = [...order];
  [out[at], out[to]] = [out[to]!, out[at]!];
  return out;
}

const changeHub = (structure: SiteStructure, id: string, fn: (h: HubNode) => HubNode): SiteStructure | undefined => {
  let found = false;
  const children = (structure.home.children ?? []).map((c): SiteNode => {
    if (c.kind !== 'hub' || c.id !== id) return c;
    found = true;
    return fn(c);
  });
  return found ? { ...structure, home: { ...structure.home, children } } : undefined;
};

/** The gallery `id` with its settings (newest first and rounded corners are left out of the file: the defaults); every other field kept. */
export function withGallerySettings(structure: SiteStructure, id: string, s: GallerySettings): SiteStructure | undefined {
  return changeHub(structure, id, (h) => {
    const { summary: _s, albumOrder: _o, albumCorners: _c, ...rest } = h;
    const summary = s.summary?.trim();
    const square = s.rounded === undefined ? h.albumCorners === 'square' : !s.rounded;
    return { ...rest, title: s.title.trim() || h.title, ...(summary ? { summary } : {}), ...(s.order !== 'newest' ? { albumOrder: s.order } : {}), ...(square ? { albumCorners: 'square' as const } : {}) };
  });
}

/** The gallery `id` set to the owner's own order (a drag in the albums list makes it so). */
export const withOwnOrder = (structure: SiteStructure, id: string): SiteStructure | undefined => changeHub(structure, id, (h) => ({ ...h, albumOrder: 'custom' }));
