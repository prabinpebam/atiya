/**
 * The repository: the only way pages and layouts read content (documentation/content/spec.md §5). It
 * loads and validates content/ once per build (or dev reload) and answers questions about it.
 */
import { docs, masters } from './source';
import { loadContent, type ContentIndex, type MediaRecord } from './load';
import type { Route } from './routes';

let index: ContentIndex | undefined;

/** Everything in content/, validated; throws a ContentError that lists every problem. */
export function content(): ContentIndex {
  if (!index) {
    index = loadContent(docs, masters);
    for (const w of index.warnings) console.warn(`[content] ${w}`);
  }
  return index;
}

export const getSite = () => content().site;
export const getArticle = (id: string) => content().articles.get(id);
export const getPerson = (id: string) => content().people.get(id);
export const getRoutes = (): Route[] => content().routes;
export const getRoute = (path: string): Route | undefined => content().routes.find((r) => r.path === path);

export function getMedia(id: string): MediaRecord {
  const m = content().media.get(id);
  if (!m) throw new Error(`unknown media "${id}"`);
  return m;
}

/** An item's canonical path (without the base), for `ref:` links and cards. */
export function canonicalPath(type: string, id: string): string | undefined {
  return content().canonical.get(`${type}/${id}`);
}
