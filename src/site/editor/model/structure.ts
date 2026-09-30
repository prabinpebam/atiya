/**
 * The site structure, as edit mode changes it (documentation/editor/spec.md §5): the sections and where
 * a page is placed. Pure and immutable: each function returns a new structure, and keeps everything it
 * doesn't change (the navigation, `menus`: documentation/sections/spec.md §7.2). A page that moves keeps its
 * node (its ID, address and label: V21), so the navigation's entry for it still points at it.
 */
import type { HubNode, ItemNode, SiteNode, SiteStructure } from '../../content/schema';

type ItemRef = { type: string; id: string };

export interface HubInfo {
  id: string;
  title: string;
  /** Its path without the base (`/leadership/`). */
  path: string;
  depth: number;
}

/** Every hub, in tree order, with its path. */
export function hubs(structure: SiteStructure): HubInfo[] {
  const out: HubInfo[] = [];
  const visit = (n: HubNode, path: string, depth: number) => {
    out.push({ id: n.id, title: n.title, path, depth });
    for (const c of n.children ?? []) if (c.kind === 'hub') visit(c, `${path}${c.slug}/`, depth + 1);
  };
  visit(structure.home, '/', 0);
  return out;
}

export function findHub(structure: SiteStructure, id: string): HubNode | undefined {
  let found: HubNode | undefined;
  const visit = (n: HubNode) => {
    if (n.id === id) found = n;
    for (const c of n.children ?? []) if (c.kind === 'hub' && !found) visit(c);
  };
  visit(structure.home);
  return found;
}

/** The hub that places an item, if any. */
export function sectionOf(structure: SiteStructure, item: ItemRef): string | null {
  let found: string | null = null;
  const visit = (n: HubNode) => {
    for (const c of n.children ?? []) {
      if (c.kind === 'item' && c.item.type === item.type && c.item.id === item.id) found = n.id;
      else if (c.kind === 'hub') visit(c);
    }
  };
  visit(structure.home);
  return found;
}

/** Every node id in the tree (a new node's id must be new). */
export function nodeIds(structure: SiteStructure): Set<string> {
  const ids = new Set<string>();
  const visit = (n: SiteNode) => {
    ids.add(n.id);
    if (n.kind === 'hub') for (const c of n.children ?? []) visit(c);
  };
  visit(structure.home);
  return ids;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

function mapHubs(structure: SiteStructure, fn: (hub: HubNode) => HubNode): SiteStructure {
  const walk = (n: HubNode): HubNode => {
    const next = fn(n);
    return { ...next, children: next.children?.map((c) => (c.kind === 'hub' ? walk(c) : c)) };
  };
  const copy = clone(structure);
  return { ...copy, home: walk(copy.home) };
}

const isItem = (c: SiteNode, item: ItemRef): c is ItemNode => c.kind === 'item' && c.item.type === item.type && c.item.id === item.id;

/** The node that places an item, if any. */
export function nodeOf(structure: SiteStructure, item: ItemRef): ItemNode | undefined {
  let found: ItemNode | undefined;
  const visit = (n: HubNode) => {
    for (const c of n.children ?? []) {
      if (isItem(c, item)) found = c;
      else if (c.kind === 'hub') visit(c);
    }
  };
  visit(structure.home);
  return found;
}

/** The tree without an item's node (its navigation entry left as it is). */
function detach(structure: SiteStructure, item: ItemRef): SiteStructure {
  return mapHubs(structure, (h) => ({ ...h, children: h.children?.filter((c) => !isItem(c, item)) }));
}

/** Takes an item's node out of the tree, and its entry out of the navigation (the item itself stays in content). */
export function unplace(structure: SiteStructure, item: ItemRef): SiteStructure {
  const node = nodeOf(structure, item);
  const out = detach(structure, item);
  if (node && out.menus) out.menus = { ...out.menus, primary: out.menus.primary.filter((e) => !('node' in e) || e.node !== node.id) };
  return out;
}

/** Places an item at the end of a hub: a page already placed moves there with its node (V21); a new one gets a node with `nodeId`. */
export function place(structure: SiteStructure, hubId: string, item: ItemRef, nodeId: string): SiteStructure {
  const node: ItemNode = nodeOf(structure, item) ?? { id: nodeId, kind: 'item', item: { type: 'article', id: item.id } };
  const without = detach(structure, item);
  return mapHubs(without, (h) => (h.id === hubId ? { ...h, children: [...(h.children ?? []), clone(node)] } : h));
}

/** Moves a hub's child from one position to another. */
export function reorder(structure: SiteStructure, hubId: string, from: number, to: number): SiteStructure {
  return mapHubs(structure, (h) => {
    if (h.id !== hubId || !h.children) return h;
    const children = [...h.children];
    const [n] = children.splice(from, 1);
    children.splice(Math.max(0, Math.min(to, children.length)), 0, n);
    return { ...h, children };
  });
}

/** Changes a hub's own fields. */
export function updateHub(structure: SiteStructure, hubId: string, fields: Partial<Pick<HubNode, 'title' | 'navLabel' | 'summary' | 'slug' | 'view'>>): SiteStructure {
  return mapHubs(structure, (h) => {
    if (h.id !== hubId) return h;
    const next: HubNode = { ...h, ...fields };
    for (const k of ['navLabel', 'summary'] as const) if (!next[k]) delete next[k];
    return next;
  });
}

/** Adds an empty hub under another. */
export function addHub(structure: SiteStructure, parentId: string, hub: HubNode): SiteStructure {
  return mapHubs(structure, (h) => (h.id === parentId ? { ...h, children: [...(h.children ?? []), hub] } : h));
}

/** The slugs a hub's children use (a new child's slug must be new among them). */
export function childSlugs(structure: SiteStructure, hubId: string, itemSlug: (item: ItemRef) => string | undefined): Set<string> {
  const hub = findHub(structure, hubId);
  return new Set((hub?.children ?? []).map((c) => (c.kind === 'hub' ? c.slug : (c.slug ?? itemSlug(c.item) ?? ''))));
}
