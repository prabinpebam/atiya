/**
 * The repository: the only way pages and layouts read content (documentation/content/spec.md §5). It
 * reads and validates the content folder, and reads it again whenever the content generation moves (a
 * save in the editor, or a file changed by hand, in dev); a build reads it once.
 */
import { generation, readSnapshot } from './source';
import { loadContent, type ContentIndex, type MediaRecord, type VideoRecord } from './load';
import { withBase } from '../design/meta';
import type { Route } from './routes';
import type { Article, PlaceId } from './schema';

let cached: { generation: number; index: ContentIndex } | undefined;

/** Everything in the content folder, validated; throws a ContentError that lists every problem. */
export function content(): ContentIndex {
  const now = generation();
  if (!cached || cached.generation !== now) {
    const snap = readSnapshot();
    const index = loadContent(snap.docs, snap.masters, snap.errors);
    for (const w of index.warnings) console.warn(`[content] ${w}`);
    cached = { generation: now, index };
  }
  return cached.index;
}

export const getSite = () => content().site;
/** The site structure: the tree of sections and pages, and the navigation. */
export const getStructure = () => content().structure;
/** Old addresses and where they now lead. */
export const getRedirects = () => content().redirects;
/** The planet's buildings and what each holds (null without content/structures/planet.json). */
export const getPlanet = () => content().planet;

/** The building a page is in on the planet, if it's on it. */
export const placeOf = (pageId: string): PlaceId | undefined => content().planet?.places.find((p) => p.pages.some((r) => r.id === pageId))?.id;

/** A building's published pages, in its order, each with its page on the site. */
export function placePages(placeId: string): { article: Article; route: Route }[] {
  const place = content().planet?.places.find((p) => p.id === placeId);
  return (place?.pages ?? []).flatMap((ref) => {
    const article = getArticle(ref.id);
    const route = getPlacement('article', ref.id);
    return article && route?.published ? [{ article, route }] : [];
  });
}
export const getArticle = (id: string) => content().articles.get(id);
export const getPerson = (id: string) => content().people.get(id);
/** The routes the site builds: hubs and published items, locked and private ones included (they're built sealed). */
export const getRoutes = (): Route[] => content().routes.filter((r) => r.published);
/** The routes anyone may be shown a link to: everything built but locked and private pages (V25, V32). */
export const getOpenRoutes = (): Route[] => getRoutes().filter((r) => r.access === 'open');
/** A page's access: open, locked or private (documentation/access/spec.md §2). */
export const getAccess = (articleId: string) => content().access.get(articleId) ?? 'open';
/** The grants (private-pages/access.json), the overlay and the message offered with a new grant. */
export const getGrants = () => content().grants;
export const getOverlay = () => content().overlay;
export const getAccessMessage = () => content().accessMessage;
export const getRoute = (path: string): Route | undefined => getRoutes().find((r) => r.path === path);
/** Where an item is placed, published or not (the editor's canvas previews a draft in its section). */
export const getPlacement = (type: string, id: string): Route | undefined =>
  content().routes.find((r) => r.node.kind === 'item' && r.node.item.type === type && r.node.item.id === id);

export function getMedia(id: string): MediaRecord {
  const m = content().media.get(id);
  if (!m) throw new Error(`unknown media "${id}"`);
  return m;
}

/** An item's canonical path (without the base), for `ref:` links and cards: published items only. */
export function canonicalPath(type: string, id: string): string | undefined {
  return content().canonical.get(`${type}/${id}`);
}

/**
 * Where a file to download is published (with the base): `<base>/media/<id>.pdf`, which the content-files
 * integration serves in dev and copies there at build. Public files only.
 */
export function documentHref(id: string): string | undefined {
  const d = content().documents.get(id);
  if (!d || !['public', 'publicRedacted', 'summaryOnly'].includes(d.visibility)) return undefined;
  return withBase(`/media/${id}.pdf`);
}

export function getVideo(id: string): VideoRecord {
  const v = content().videos.get(id);
  if (!v) throw new Error(`unknown video "${id}"`);
  return v;
}

/**
 * Where a video file is published (with the base): `<base>/media/<id>.<mp4|webm>`, which the content-files
 * integration serves in dev (with ranges, so it seeks) and copies there at build.
 */
export function videoHref(id: string): string {
  const v = getVideo(id);
  return withBase(`/media/${id}.${v.file.split('.').pop()}`);
}
