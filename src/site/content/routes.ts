/**
 * The route table, derived from the site structure (documentation/content/ia.md §3): a node's path is
 * the chain of slugs from the home hub down; an item's canonical path is the path of the node that
 * places it. Every node is resolved and checked, drafts included (so two drafts can't claim one address),
 * and each route says whether it's published: only those are built. The site is three levels, home,
 * sections and pages (V22), and every node's ID is unique (V21: the navigation refers to nodes by ID;
 * documentation/sections/spec.md §3.1, §4.1). Pure, so the rules are unit-tested.
 */
import type { HubNode, ItemNode, Overlay, SiteNode, SiteStructure } from './schema';

export interface Crumb {
  label: string;
  path: string;
}

/** Who can open a page (documentation/access/spec.md §2): everyone, a signed-in visitor its grant covers, or a magic link. */
export type Access = 'open' | 'locked' | 'private';

export interface Route {
  /** The path without the base: `/leadership/do-what-makes-you-proud/`. */
  path: string;
  node: SiteNode;
  /** The hub above this node (none for the home hub, or a private page). */
  parent?: HubNode;
  /** The hubs from the home page down to this node's parent. */
  ancestors: Crumb[];
  /** The page's title: a hub's own, or the item's. */
  title: string;
  /** Its label in the navigation and the breadcrumbs: the node's navLabel, else the item's, else the title. */
  label: string;
  /** Built and public: a hub, or an item whose content is published. A draft's route exists only for the editor's canvas. */
  published: boolean;
  /** Open, or sealed for its grants (a locked page in its section, a private page at /p/<token>/). */
  access: Access;
}

/** Paths the code owns: a node may not claim them. `classic` stays until the IA replaces it. */
export const RESERVED = ['play', 'design', 'docs', '_astro', 'media', 'classic', '_edit', 'p', 'sign-in', '_sealed', '_access'];

export type ItemTitle = (type: string, id: string) => { slug: string; title: string; navLabel?: string; published: boolean } | undefined;

/**
 * The site structure with the private overlay's locked pages placed in their open sections (documentation/
 * access/spec.md §2.1): each at its token, in the section's full order (the overlay's `order`, then any page
 * it leaves out: open ones in their order, then locked ones in theirs). The public structure is untouched.
 * Returns the merged structure, the locked nodes' IDs, and what's wrong.
 */
export function withOverlay(structure: SiteStructure, overlay: Overlay | null): { structure: SiteStructure; locked: Set<string>; errors: string[]; warnings: string[] } {
  const locked = new Set<string>();
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!overlay?.sections.length) return { structure, locked, errors, warnings };
  const sections = new Map<string, HubNode>();
  const children = (structure.home.children ?? []).map((c) => {
    if (c.kind !== 'hub') return c;
    const copy: HubNode = { ...c, children: [...(c.children ?? [])] };
    sections.set(c.id, copy);
    return copy;
  });
  overlay.sections.forEach((s, i) => {
    const hub = sections.get(s.section);
    if (!hub) return void errors.push(`sections.${i}: "${s.section}" isn't a section of the site`);
    const added: ItemNode[] = s.pages.map((p) => ({ id: p.id, kind: 'item', slug: p.token, item: p.item }));
    for (const n of added) locked.add(n.id);
    const all = [...(hub.children ?? []), ...added];
    const byId = new Map(all.map((n) => [n.id, n]));
    const ordered: SiteNode[] = [];
    for (const id of s.order ?? []) {
      const n = byId.get(id);
      if (!n) warnings.push(`the overlay's order for "${s.section}" names "${id}", which isn't a page of it: skipped`);
      else if (!ordered.includes(n)) ordered.push(n);
    }
    hub.children = [...ordered, ...all.filter((n) => !ordered.includes(n))];
  });
  return { structure: { ...structure, home: { ...structure.home, children } }, locked, errors, warnings };
}

/** A private page's route: at /p/<token>/, in no section (documentation/access/spec.md §2.2). */
export function privateRoutes(pages: Overlay['private'], lookup: ItemTitle, home: { label: string }): { routes: Route[]; errors: string[] } {
  const routes: Route[] = [];
  const errors: string[] = [];
  pages.forEach((p, i) => {
    const item = lookup(p.item.type, p.item.id);
    if (!item) return void errors.push(`private.${i}: places ${p.item.type} "${p.item.id}", which doesn't exist`);
    const node: ItemNode = { id: p.id, kind: 'item', slug: p.token, item: p.item };
    routes.push({ path: `/p/${p.token}/`, node, ancestors: [{ label: home.label, path: '/' }], title: item.title, label: item.navLabel ?? item.title, published: item.published, access: 'private' });
  });
  return { routes, errors };
}

export function buildRoutes(structure: SiteStructure, lookup: ItemTitle, locked: Set<string> = new Set()): { routes: Route[]; errors: string[] } {
  const routes: Route[] = [];
  const errors: string[] = [];
  const placed = new Map<string, string>();
  const ids = new Set<string>();

  const visit = (node: SiteNode, parentPath: string, parent: HubNode | undefined, ancestors: Crumb[], depth: number) => {
    if (ids.has(node.id)) errors.push(`node ${node.id}: another node has this ID; every node's ID is unique (V21)`);
    ids.add(node.id);
    if (depth === 1 && node.kind === 'item') errors.push(`node ${node.id}: a page belongs in a section, not directly under the home page (V22)`);
    if (depth === 2 && node.kind === 'hub') errors.push(`node ${node.id}: a section can't hold another section (V22)`);
    if (depth > 2) return;
    let slug: string;
    let title: string;
    let label: string;
    let published = true;
    if (node.kind === 'item') {
      const item = lookup(node.item.type, node.item.id);
      if (!item) {
        errors.push(`node ${node.id}: places ${node.item.type} "${node.item.id}", which doesn't exist`);
        return;
      }
      const key = `${node.item.type}/${node.item.id}`;
      if (placed.has(key)) errors.push(`${key} is placed twice (nodes ${placed.get(key)} and ${node.id}): an item has one canonical page (V12)`);
      placed.set(key, node.id);
      slug = node.slug ?? item.slug;
      title = item.title;
      label = node.navLabel ?? item.navLabel ?? item.title;
      published = item.published;
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
    routes.push({ path, node, parent, ancestors, title, label, published, access: locked.has(node.id) ? 'locked' : 'open' });
    if (node.kind === 'hub') for (const child of node.children ?? []) visit(child, path, node, [...ancestors, { label, path }], depth + 1);
  };

  visit(structure.home, '', undefined, [], 0);
  return { routes, errors };
}

/** The canonical path of each placed and published item, keyed `type/id`. */
export function canonicalPaths(routes: Route[]): Map<string, string> {
  return new Map(routes.flatMap((r) => (r.node.kind === 'item' && r.published ? [[`${r.node.item.type}/${r.node.item.id}`, r.path] as const] : [])));
}
