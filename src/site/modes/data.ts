/**
 * Mode data (documentation/desktop/modes.md §5.2): what the host gives a mode, built from the content.
 * Only published, open pages enter it (V28, for every mode: V36); a section with private pages says only
 * that it has some, never which or how many.
 */
import type { ContentIndex } from '../content/load';
import { placeRoutes } from '../content/routes';
import type { ModeData, ModePage, ModeStructure } from './contract';

export interface ModeDataOptions {
  id: string;
  mount: string;
  structure: ModeStructure;
  /** The site's base path (`/` or `/atiya/`). */
  base: string;
  entry?: ModeData['entry'];
}

/** @param index the validated content @param o the mode, its structure and the site's base */
export function buildModeData(index: ContentIndex, o: ModeDataOptions): ModeData {
  const at = (path: string) => `${o.base.replace(/\/+$/, '')}${path}`;
  const sections = (index.structure.home.children ?? []).flatMap((node) => {
    if (node.kind !== 'hub') return [];
    const route = index.routes.find((r) => r.node.kind === 'hub' && r.node.id === node.id);
    if (!route) return [];
    const pages: ModePage[] = placeRoutes(index.routes, node.id).flatMap((r) => {
      if (r.node.kind !== 'item') return [];
      const article = index.articles.get(r.node.item.id);
      // placeRoutes keeps only published, open pages; checked again here, since this is what leaves the build
      if (!article || r.access !== 'open' || !r.published) return [];
      return [{ id: article.id, title: article.title, summary: article.summary, kind: article.kind, url: at(r.path) }];
    });
    const hasPrivate = index.routes.some((r) => r.parent?.id === node.id && r.access === 'private' && r.published);
    return [{ id: node.id, title: node.title, summary: node.summary ?? '', view: node.view ?? 'list', url: at(route.path), hasPrivate, pages }];
  });
  const owner = index.people.get(index.site.owner);
  const contact = index.site.contactPage ? index.routes.find((r) => r.node.id === index.site.contactPage && r.published && r.access === 'open') : undefined;
  return {
    api: 1,
    mode: { id: o.id, mount: o.mount, settings: o.structure.settings ?? {} },
    site: {
      name: index.site.name,
      description: index.site.description,
      locale: index.site.locale,
      base: o.base,
      owner: { name: owner?.name ?? index.site.name, ...(owner?.role ? { role: owner.role } : {}) },
    },
    sections,
    slots: o.structure.slots.map((s) => ({ id: s.id, section: s.section, words: { ...s.words } })),
    entry: o.entry ?? {},
    links: { home: at('/'), signIn: at('/sign-in/'), ...(contact ? { contact: at(contact.path) } : {}) },
  };
}
