/**
 * The repository: the only way pages and layouts read content (documentation/content/spec.md §5). It
 * reads and validates the content folder, and reads it again whenever the content generation moves (a
 * save in the editor, or a file changed by hand, in dev); a build reads it once.
 */
import { generation, readSnapshot } from './source';
import { loadContent, type ContentIndex, type MediaRecord } from './load';
import type { Route } from './routes';

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
export const getArticle = (id: string) => content().articles.get(id);
export const getPerson = (id: string) => content().people.get(id);
/** The routes the site builds: hubs and published items. */
export const getRoutes = (): Route[] => content().routes.filter((r) => r.published);
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
