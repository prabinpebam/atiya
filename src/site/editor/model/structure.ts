/**
 * The site structure, as edit mode changes it (documentation/editor/spec.md §5): the sections and where
 * a page is placed. Pure and immutable: each function returns a new structure, and keeps everything it
 * doesn't change (the navigation, `menus`: documentation/sections/spec.md §7.2). A page that moves keeps its
 * node (its ID, address and label: V21), so the navigation's entry for it still points at it.
 */
import type { HubNode, ItemNode, MenuEntry, SiteNode, SiteStructure } from '../../content/schema';

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

/**
 * Places an item in a hub, at `index` among its children (the end if left out): a page already placed moves
 * there with its node (V21); a new one gets a node with `nodeId`.
 */
export function place(structure: SiteStructure, hubId: string, item: ItemRef, nodeId: string, index?: number): SiteStructure {
  const node: ItemNode = nodeOf(structure, item) ?? { id: nodeId, kind: 'item', item: { type: 'article', id: item.id } };
  const without = detach(structure, item);
  return mapHubs(without, (h) => {
    if (h.id !== hubId) return h;
    const children = [...(h.children ?? [])];
    children.splice(index === undefined ? children.length : Math.max(0, Math.min(index, children.length)), 0, clone(node));
    return { ...h, children };
  });
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

// ---------- the navigation (documentation/sections/spec.md §4, §7.3) ----------

/** The navigation's entries, in order. */
export const menuOf = (structure: SiteStructure): MenuEntry[] => structure.menus?.primary ?? [];

/** At most this many entries fit the header's row (V17). */
export const MENU_MAX = 8;

const withMenu = (structure: SiteStructure, primary: MenuEntry[]): SiteStructure => ({ ...clone(structure), menus: { ...(structure.menus ?? {}), primary } });

/** Whether a node (a section or a page) has an entry in the navigation. */
export const inMenu = (structure: SiteStructure, nodeId: string): boolean => menuOf(structure).some((e) => 'node' in e && e.node === nodeId);

/** Puts a node in the navigation (at the end) or takes it out; nothing changes if it's already so. */
export function setInMenu(structure: SiteStructure, nodeId: string, on: boolean): SiteStructure {
  const menu = menuOf(structure);
  if (on === inMenu(structure, nodeId)) return structure;
  return withMenu(structure, on ? [...menu, { node: nodeId }] : menu.filter((e) => !('node' in e) || e.node !== nodeId));
}

/** Adds a custom link at the end. */
export const addLink = (structure: SiteStructure, label: string, href: string): SiteStructure => withMenu(structure, [...menuOf(structure), { label, href }]);

/** Takes an entry out. */
export const removeEntry = (structure: SiteStructure, index: number): SiteStructure => withMenu(structure, menuOf(structure).filter((_, i) => i !== index));

/** Moves an entry one place up (-1) or down (1); nothing moves past either end. */
export function moveEntry(structure: SiteStructure, index: number, by: -1 | 1): SiteStructure {
  const menu = [...menuOf(structure)];
  const to = index + by;
  if (index < 0 || index >= menu.length || to < 0 || to >= menu.length) return structure;
  [menu[index], menu[to]] = [menu[to], menu[index]];
  return withMenu(structure, menu);
}

/** Gives an entry its own label; for a section or a page, an empty one goes back to the node's own. A link keeps a label always. */
export function relabelEntry(structure: SiteStructure, index: number, label: string): SiteStructure {
  const text = label.trim();
  return withMenu(
    structure,
    menuOf(structure).map((e, i) => {
      if (i !== index) return e;
      if ('href' in e) return text ? { ...e, label: text } : e;
      return text ? { node: e.node, label: text } : { node: e.node };
    }),
  );
}
