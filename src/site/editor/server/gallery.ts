/**
 * The gallery's albums list and setup in edit mode (documentation/gallery/spec.md §9.1, §9.2): every album in its
 * gallery's order (drafts and private ones in their places), the albums elsewhere after them, a drag that makes
 * the owner's own order, and the gallery's title, description and order. One store transaction per change.
 */
import type { Album, Overlay, SiteStructure } from '../../content/schema';
import type { ContentIndex } from '../../content/load';
import { albumsOrder } from '../../content/album';
import { commit, jsonBytes, readDoc, type Change, type Result } from './store';
import { OVERLAY, STRUCTURE } from './articles';
import { lookupOf } from './albums';
import { albumCards, type AlbumCard } from './albumScreens';
import { reorderSection, sectionOrder } from '../model/access';
import { chosenGallery, galleries, galleryLine, rowLine, withAlbumsInOrder, withGallerySettings, withOwnOrder, type AlbumRow, type Gallery, type GallerySettings } from '../model/gallery';
import { SECTION_ALBUM_ORDERS } from '../../content/schema';

const refuse = (message: string, path?: string): Result => ({ ok: false, status: 422, issues: [{ file: STRUCTURE.slice(1), message, ...(path ? { path } : {}) }] });

/** A section's albums by their nodes, open and private: node → album. */
function albumNodes(structure: SiteStructure, overlay: Overlay | null, section: string): Map<string, string> {
  const out = new Map<string, string>();
  const hub = (structure.home.children ?? []).find((c) => c.kind === 'hub' && c.id === section);
  for (const c of (hub?.kind === 'hub' && hub.children) || []) if (c.kind === 'item' && c.item.type === 'album') out.set(c.id, c.item.id);
  for (const p of overlay?.sections.find((s) => s.section === section)?.pages ?? []) if (p.item.type === 'album') out.set(p.id, p.item.id);
  return out;
}

/** What the albums list shows (§9.2): the galleries, the chosen one, its albums in its order, and every other album. */
export interface GalleryList {
  galleries: Gallery[];
  gallery?: Gallery;
  /** The gallery's entry's line ("Newest first · 4 albums"). */
  line?: string;
  albums: AlbumRow[];
  elsewhere: AlbumRow[];
  /** The structure's version, for the setup's save. */
  version: string | null;
}

const toRow = (c: AlbumCard): AlbumRow => ({ id: c.id, title: c.title, href: c.href, cover: c.cover ? { thumb: c.cover.thumb, width: c.cover.width, height: c.cover.height, ...(c.cover.bg ? { bg: c.cover.bg } : {}) } : null, line: rowLine(c) });

export async function galleryList(index: ContentIndex, asked?: string | null): Promise<GalleryList> {
  const s = readDoc<SiteStructure>(STRUCTURE);
  const structure = s?.value ?? index.structure;
  const overlay = readDoc<Overlay>(OVERLAY)?.value ?? null;
  const all = galleries(structure);
  const gallery = chosenGallery(all, asked);
  const cards = await albumCards(index);
  const inGallery = gallery ? cards.filter((c) => c.section?.id === gallery.id) : [];
  let albums = inGallery;
  if (gallery?.order === 'custom') {
    const nodes = albumNodes(structure, overlay, gallery.id);
    const rank = new Map(sectionOrder(structure, overlay, gallery.id).flatMap((p, i) => (nodes.has(p.id) ? [[nodes.get(p.id)!, i] as const] : [])));
    albums = [...inGallery].sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9));
  } else if (gallery) {
    const byId = new Map(inGallery.map((c) => [c.id, c]));
    const files = inGallery.map((c) => index.albums.get(c.id)).filter((a): a is Album => !!a);
    albums = albumsOrder(files, gallery.order, lookupOf(index)).map((a) => byId.get(a.id)!);
  }
  const shown = new Set(albums.map((a) => a.id));
  return {
    galleries: all,
    gallery,
    ...(gallery ? { line: galleryLine(gallery, albums.length) } : {}),
    albums: albums.map(toRow),
    elsewhere: cards.filter((c) => !shown.has(c.id)).map(toRow),
    version: s?.version ?? null,
  };
}

/** The gallery `section`'s albums in the order given (a drag in the list): the owner's own order from now on. */
export async function setGalleryOrder(section: string, albums: string[]): Promise<Result> {
  const s = readDoc<SiteStructure>(STRUCTURE);
  const o = readDoc<Overlay>(OVERLAY);
  if (!s) return refuse('missing');
  const nodes = albumNodes(s.value, o?.value ?? null, section);
  const nodeOf = new Map([...nodes].map(([n, a]) => [a, n]));
  if (albums.some((a) => !nodeOf.has(a))) return refuse("An album in the new order isn't in that gallery any more: reload to see it as it is.", 'order');
  const full = sectionOrder(s.value, o?.value ?? null, section).map((p) => p.id);
  const next = withAlbumsInOrder(full, albums.map((a) => nodeOf.get(a)!));
  if (!next) return refuse("The new order isn't the gallery's albums: reload to see it as it is.", 'order');
  const r = reorderSection(s.value, o?.value ?? { sections: [] }, section, next);
  const structure = withOwnOrder(r.structure, section);
  if (!structure) return refuse('That gallery is no longer on the site.');
  const changes: Change[] = [{ key: STRUCTURE, bytes: jsonBytes(structure) }];
  const ifMatch: Record<string, string | null> = { [STRUCTURE]: s.version };
  if (o && o.value.sections.some((x) => x.section === section)) {
    changes.push({ key: OVERLAY, bytes: jsonBytes(r.overlay) });
    ifMatch[OVERLAY] = o.version;
  }
  return commit({ changes, ifMatch });
}

/** The gallery `section`'s title, description and order (§9.1). */
export async function saveGallery(section: string, settings: Partial<GallerySettings>, version: string | null): Promise<Result> {
  const s = readDoc<SiteStructure>(STRUCTURE);
  if (!s) return refuse('missing');
  const order = SECTION_ALBUM_ORDERS.find((x) => x === settings.order) ?? 'newest';
  const title = String(settings.title ?? '').trim();
  if (!title) return refuse('The gallery needs a title.', 'title');
  const next = withGallerySettings(s.value, section, { title, summary: typeof settings.summary === 'string' ? settings.summary : undefined, order });
  if (!next) return refuse('That gallery is no longer on the site.');
  return commit({ changes: [{ key: STRUCTURE, bytes: jsonBytes(next) }], ifMatch: { [STRUCTURE]: version ?? s.version } });
}
