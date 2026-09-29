/**
 * The route table, derived from the site structure (documentation/content/ia.md §3): a node's path is
 * the chain of slugs from the home hub down; an item's canonical path is the path of the node that
 * places it. Pure, so the rules are unit-tested without a build.
 */
import type { HubNode, SiteNode, SiteStructure } from './schema';

export interface Crumb {
  label: string;
  path: string;
}

export interface Route {
  /** The path without the base: `/leadership/do-what-makes-you-proud/`. */
  path: string;
  node: SiteNode;
  /** The hub above this node (none for the home hub). */
  parent?: HubNode;
  /** The hubs from the home page down to this node's parent. */
  ancestors: Crumb[];
  /** The page's title: a hub's own, or the item's. */
  title: string;
}

/** Paths the code owns: a node may not claim them. `classic` stays until the IA replaces it. */
export const RESERVED = ['play', 'design', 'docs', '_astro', 'media', 'classic'];

export type ItemTitle = (type: string, id: string) => { slug: string; title: string; navLabel?: string } | undefined;

export function buildRoutes(structure: SiteStructure, lookup: ItemTitle): { routes: Route[]; errors: string[] } {
  const routes: Route[] = [];
  const errors: string[] = [];
  const placed = new Map<string, string>();

  const visit = (node: SiteNode, parentPath: string, parent: HubNode | undefined, ancestors: Crumb[], depth: number) => {
    let slug: string;
    let title: string;
    let label: string;
    if (node.kind === 'item') {
      const item = lookup(node.item.type, node.item.id);
      if (!item) {
        errors.push(`node ${node.id}: places ${node.item.type} "${node.item.id}", which doesn't exist or isn't published`);
        return;
      }
      const key = `${node.item.type}/${node.item.id}`;
      if (placed.has(key)) errors.push(`${key} is placed twice (nodes ${placed.get(key)} and ${node.id}): an item has one canonical page (V12)`);
      placed.set(key, node.id);
      slug = node.slug ?? item.slug;
      title = item.title;
      label = node.navLabel ?? item.navLabel ?? item.title;
    } else {
      slug = node.slug;
      title = node.title;
      label = node.navLabel ?? node.title;
    }
    if (depth === 0 && slug !== '') errors.push(`the home hub's slug must be empty (got "${slug}")`);
    if (depth > 0 && slug === '') errors.push(`node ${node.id}: only the home hub has an empty slug`);
    if (depth === 1 && RESERVED.includes(slug)) errors.push(`node ${node.id}: /${slug}/ is reserved for the code`);
    const path = depth === 0 ? '/' : `${parentPath}${slug}/`;
    if (routes.some((r) => r.path === path)) errors.push(`node ${node.id}: ${path} is already taken`);
    routes.push({ path, node, parent, ancestors, title });
    if (node.kind === 'hub') for (const child of node.children ?? []) visit(child, path, node, [...ancestors, { label, path }], depth + 1);
  };

  visit(structure.home, '', undefined, [], 0);
  return { routes, errors };
}

/** The canonical path of each placed item, keyed `type/id`. */
export function canonicalPaths(routes: Route[]): Map<string, string> {
  return new Map(routes.flatMap((r) => (r.node.kind === 'item' ? [[`${r.node.item.type}/${r.node.item.id}`, r.path] as const] : [])));
}
