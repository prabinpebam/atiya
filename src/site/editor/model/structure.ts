/**
 * The site structure, as edit mode changes it (documentation/editor/spec.md §5): the hubs and where an
 * item is placed. Pure and immutable: each function returns a new structure.
 */
import type { HubNode, SiteNode, SiteStructure } from '../../content/schema';

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

const clone = (s: SiteStructure): SiteStructure => JSON.parse(JSON.stringify(s));

function mapHubs(structure: SiteStructure, fn: (hub: HubNode) => HubNode): SiteStructure {
  const walk = (n: HubNode): HubNode => {
    const next = fn(n);
    return { ...next, children: next.children?.map((c) => (c.kind === 'hub' ? walk(c) : c)) };
  };
  return { home: walk(clone(structure).home) };
}

/** Takes an item's node out of the tree (the item itself stays in content). */
export function unplace(structure: SiteStructure, item: ItemRef): SiteStructure {
  return mapHubs(structure, (h) => ({ ...h, children: h.children?.filter((c) => !(c.kind === 'item' && c.item.type === item.type && c.item.id === item.id)) }));
}

/** Places an item at the end of a hub (moving it if it was elsewhere). */
export function place(structure: SiteStructure, hubId: string, item: ItemRef, nodeId: string): SiteStructure {
  const without = unplace(structure, item);
  return mapHubs(without, (h) => (h.id === hubId ? { ...h, children: [...(h.children ?? []), { id: nodeId, kind: 'item', item: { type: item.type as 'article', id: item.id } }] } : h));
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
export function updateHub(structure: SiteStructure, hubId: string, fields: Partial<Pick<HubNode, 'title' | 'navLabel' | 'summary' | 'slug' | 'template'>>): SiteStructure {
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
