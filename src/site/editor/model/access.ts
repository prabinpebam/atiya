/**
 * Edit mode's access model (documentation/access/spec.md §4, §8), pure so it's unit-tested: placing and
 * unplacing private pages in the private overlay (a private page is always in a section), pages moved in the
 * Sections screen with open and private ones together, a section's full order split into the overlay's and
 * the public structure's, a grant's new record, its share message and its magic link, and the Access
 * screen's words: its groups by state, its dates, what a grant opens in one line, and what it's found by.
 */
import type { HubNode, Overlay, SiteNode, SiteStructure } from '../../content/schema';
import type { Grant } from '../../access/types';
import type { grantState } from '../../access/grants';
import { nodeOf, placeAll, unplace } from './structure';

/** A page's access: open to everyone, or private (in private-pages/, opened by an access code or a magic link). */
export type PageAccess = 'open' | 'private';

/** A grant as edit mode lists it: its state, and what it opens in words. */
export type ListedGrant = Grant & { state: ReturnType<typeof grantState>; opens: string[] };

/** A private page a grant can open: its section (its title, and its ID) and whether it's on the site yet. */
export interface ScopePage {
  id: string;
  title: string;
  /** Its section's title. */
  section: string;
  sectionId: string;
  published: boolean;
}

/** What the sharing panel and the Access screen show (made by the server's `sharingView`). */
export interface SharingView {
  /** Every grant, newest first; on a page's Share dialog, only the ones that open it. */
  grants: ListedGrant[];
  /** The private pages a grant can open, each with its section. */
  pages: ScopePage[];
  /** Every section of the site: a grant can open every private page in one, now and later (even before it holds any). */
  sections: { id: string; title: string }[];
}

type State = ListedGrant['state'];

/** The states in the order the Access screen lists them (what needs you first), with their words and tones. */
export const GRANT_STATES: { state: State; label: string; tone: 'positive' | 'highlight' | 'neutral' | 'negative' }[] = [
  { state: 'expiring', label: 'Ends soon', tone: 'highlight' },
  { state: 'active', label: 'Active', tone: 'positive' },
  { state: 'expired', label: 'Expired', tone: 'neutral' },
  { state: 'withdrawn', label: 'Withdrawn', tone: 'negative' },
];
export const STATE_OF = Object.fromEntries(GRANT_STATES.map((s) => [s.state, s])) as Record<State, (typeof GRANT_STATES)[number]>;

export const KIND_LABEL: Record<Grant['kind'], string> = { code: 'Access code', link: 'Magic link' };

/** Grants grouped by state, in GRANT_STATES' order, newest first in each; empty groups left out. */
export function grantGroups<T extends { state: State; createdAt: string }>(grants: T[]): { state: State; label: string; grants: T[] }[] {
  return GRANT_STATES.map((s) => ({
    state: s.state,
    label: s.label,
    grants: grants.filter((g) => g.state === s.state).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
  })).filter((g) => g.grants.length > 0);
}

/** A short date, for lists: "5 Nov 2026". */
export const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** What a grant's dates say in the list, by its state: "Until 5 Nov 2026", "Ends 7 Oct 2026", "Expired …", "Withdrawn …", "No end date". */
export function dateLine(g: { state: State; expiresAt?: string; revokedAt?: string }): string {
  if (g.state === 'withdrawn' && g.revokedAt) return `Withdrawn ${shortDate(g.revokedAt)}`;
  if (g.state === 'expired' && g.expiresAt) return `Expired ${shortDate(g.expiresAt)}`;
  if (g.state === 'expiring' && g.expiresAt) return `Ends ${shortDate(g.expiresAt)}`;
  return g.expiresAt ? `Until ${shortDate(g.expiresAt)}` : 'No end date';
}

/** Words joined as a reader would: "A", "A and B", "A, B and C". */
export function listWords(words: string[]): string {
  if (words.length < 2) return words[0] ?? '';
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

/**
 * What a grant opens, in one line, from its sections' and single pages' titles: "Opens every private page
 * in Work, and Lantern study". Past three sections or two pages it counts them, so the line stays one line.
 */
export function scopeLine(sections: string[], pages: string[]): string {
  if (!sections.length && !pages.length) return 'Opens nothing yet: choose a section or a page';
  const parts: string[] = [];
  if (sections.length) parts.push(`every private page in ${sections.length <= 3 ? listWords(sections) : `${sections.length} sections`}`);
  if (pages.length) parts.push(pages.length <= 2 ? listWords(pages) : `${pages.length} single pages`);
  return `Opens ${parts.join(', and ')}`;
}

/** A section and its private pages, for the list of what a grant can open. */
export interface ScopeSection {
  id: string;
  title: string;
  pages: ScopePage[];
}

/**
 * The sections and their private pages, in the site's order, for choosing what a grant opens. IDs a
 * grant still names that are no longer a section or a private page come last, as `unknown`, so they can
 * be seen and taken out.
 */
export function scopeGroups(view: Pick<SharingView, 'pages' | 'sections'>, scope: Grant['scope'] = {}): { sections: ScopeSection[]; unknown: { sections: string[]; pages: string[] } } {
  const sections = view.sections.map((s) => ({ ...s, pages: view.pages.filter((p) => p.sectionId === s.id) }));
  const known = new Set(view.sections.map((s) => s.id));
  const pages = new Set(view.pages.map((p) => p.id));
  return { sections, unknown: { sections: (scope.sections ?? []).filter((s) => !known.has(s)), pages: (scope.pages ?? []).filter((p) => !pages.has(p)) } };
}

/** Everything a grant can be found by in the Access screen's list, lowercased: who, why, notes, its code's name, what it opens. */
export function findText(g: ListedGrant): string {
  const r = g.recipient;
  return [r.name, r.organisation, r.role, r.email, g.purpose, g.notes, g.name, KIND_LABEL[g.kind], ...g.opens].filter(Boolean).join(' \n ').toLowerCase();
}

/** A date chosen as a grant's last day (YYYY-MM-DD): what's wrong with it, if anything, today being `today`. */
export function endDateIssue(date: string, today: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return 'write the last day it works as a date';
  if (date < today) return 'the last day it works is today or later: to stop it now, withdraw it';
  return null;
}

/** A date `days` after `from`, as YYYY-MM-DD (the suggested end of a new grant). */
export const daysAfter = (days: number, from = new Date()) => localIso(new Date(from.getTime() + days * 86_400_000)).slice(0, 10);

type PrivateNode = Overlay['sections'][number]['pages'][number];

/** The overlay without the page: off its section's private pages and order. */
export function unplacePrivate(overlay: Overlay, id: string): Overlay {
  return {
    ...overlay,
    sections: overlay.sections
      .map((s) => ({ ...s, pages: s.pages.filter((p) => p.item.id !== id), ...(s.order ? { order: s.order.filter((o) => o !== id) } : {}) }))
      .filter((s) => s.pages.length > 0),
  };
}

/** The overlay with a private page in a section, the section's full order set to `order`. */
export function placePrivate(overlay: Overlay, section: string, node: PrivateNode, order: string[]): Overlay {
  const o = unplacePrivate(overlay, node.item.id);
  const existing = o.sections.find((s) => s.section === section);
  const sections = existing ? o.sections.map((s) => (s.section === section ? { ...s, pages: [...s.pages, node], order } : s)) : [...o.sections, { section, pages: [node], order }];
  return { ...o, sections };
}

/** A private page's node and section, if it's private. */
export function privateNode(overlay: Overlay | null | undefined, id: string): { section: string; node: PrivateNode } | undefined {
  for (const s of overlay?.sections ?? []) {
    const node = s.pages.find((p) => p.item.id === id);
    if (node) return { section: s.section, node };
  }
  return undefined;
}

/** A section's pages, open and private, in its full order (the overlay's order, then the rest). */
export function sectionOrder(structure: SiteStructure, overlay: Overlay | null, section: string): { id: string; access: PageAccess }[] {
  const hub = (structure.home.children ?? []).find((c): c is HubNode => c.kind === 'hub' && c.id === section);
  const open = (hub?.children ?? []).filter((c) => c.kind === 'item').map((c) => c.id);
  const entry = overlay?.sections.find((s) => s.section === section);
  const priv = entry?.pages.map((p) => p.id) ?? [];
  const all = [...open, ...priv];
  const first = (entry?.order ?? []).filter((id) => all.includes(id));
  return [...new Set([...first, ...all])].map((id) => ({ id, access: priv.includes(id) ? 'private' : 'open' }));
}

/** A new full order for a section, split: the overlay keeps the whole order, the public structure its open pages in that order. */
export function reorderSection(structure: SiteStructure, overlay: Overlay, section: string, order: string[]): { structure: SiteStructure; overlay: Overlay } {
  const children = (structure.home.children ?? []).map((c) => {
    if (c.kind !== 'hub' || c.id !== section) return c;
    const kids = c.children ?? [];
    const byId = new Map(kids.map((k) => [k.id, k]));
    const sorted = order.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
    return { ...c, children: [...sorted, ...kids.filter((k) => !sorted.includes(k))] as SiteNode[] };
  });
  const sections = overlay.sections.map((s) => (s.section === section ? { ...s, order } : s));
  return { structure: { ...structure, home: { ...structure.home, children } }, overlay: { ...overlay, sections } };
}

/**
 * Pages moved in the Sections screen, open and private together (documentation/access/spec.md §8.2): into
 * section `to`, in the order given, at `index` among the pages that stay there (the end if left out). Open
 * pages move in the public structure with their nodes (V21), private ones in the overlay with their tokens;
 * the section's full order goes in the overlay, and the moved pages leave every other section's order. `_off`
 * takes pages off the site, which a private page can't leave: the reason is returned instead.
 */
export function movePages(structure: SiteStructure, overlay: Overlay, pages: string[], to: string, index: number | undefined, newNodeId: (id: string) => string): { structure: SiteStructure; overlay: Overlay } | string {
  const ref = (id: string) => ({ type: 'article' as const, id });
  const priv = new Map(pages.flatMap((id) => {
    const p = privateNode(overlay, id);
    return p ? [[id, p] as const] : [];
  }));
  const nodeIdOf = (id: string) => priv.get(id)?.node.id ?? nodeOf(structure, ref(id))?.id ?? newNodeId(id);
  const moved = pages.map(nodeIdOf);
  const leaveOrders = (o: Overlay): Overlay => ({ ...o, sections: o.sections.map((s) => (s.order && s.section !== to ? { ...s, order: s.order.filter((n) => !moved.includes(n)) } : s)) });
  if (to === '_off') {
    if (priv.size) return 'a private page is always in a section: make it public first to take it off the site';
    return { structure: pages.reduce((s, id) => unplace(s, ref(id)), structure), overlay: leaveOrders(overlay) };
  }
  const stay = sectionOrder(structure, overlay, to)
    .map((p) => p.id)
    .filter((n) => !moved.includes(n));
  const at = index === undefined ? stay.length : Math.max(0, Math.min(index, stay.length));
  const order = [...stay.slice(0, at), ...moved, ...stay.slice(at)];
  const open = pages.filter((id) => !priv.has(id));
  let s = open.length ? placeAll(structure, to, open.map((id) => ({ item: ref(id), nodeId: nodeIdOf(id) }))) : structure;
  let o = leaveOrders(overlay);
  for (const [, p] of priv) o = placePrivate(o, to, p.node, order);
  const r = reorderSection(s, o, to, order);
  s = r.structure;
  o = r.overlay;
  return { structure: s, overlay: o };
}

/** The open page a private one follows in a full order (null: the start), to put it back there when it opens. */
export function openBefore(order: { id: string; access: PageAccess }[], id: string): string | null {
  const i = order.findIndex((p) => p.id === id);
  return order.slice(0, Math.max(0, i)).reverse().find((p) => p.access === 'open')?.id ?? null;
}
/** A section's public children with a page put back after `after` (the start when null). */
export function insertAfter(structure: SiteStructure, section: string, node: SiteNode, after: string | null): SiteStructure {
  const children = (structure.home.children ?? []).map((c) => {
    if (c.kind !== 'hub' || c.id !== section) return c;
    const kids = (c.children ?? []).filter((k) => k.id !== node.id);
    const at = after ? kids.findIndex((k) => k.id === after) + 1 : 0;
    kids.splice(at, 0, node);
    return { ...c, children: kids };
  });
  return { ...structure, home: { ...structure.home, children } };
}

/** The message offered with a new grant, its words filled in. */
export function fillMessage(template: string, v: { name: string; code?: string; link: string; expires?: string }): string {
  return template
    .replace(/\{name\}/g, v.name.split(/\s+/)[0] || v.name)
    .replace(/\{code\}/g, v.code ?? '')
    .replace(/\{link\}/g, v.link)
    .replace(/\{expires\}/g, v.expires ?? 'you no longer need it');
}

/** A magic link: the page's address on the live site, and the grant's secret after `#a=` (never sent to a server). */
export const magicLink = (site: string, path: string, grant: string, key: string) => `${site.replace(/\/$/, '')}${path}#a=${grant}.${key}`;

/** A long date in words, for messages: "5 November 2026". */
export const longDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/** An ISO date-time with the machine's own offset ("2026-10-05T12:30:00+05:30"), as grants are written. */
export function localIso(d = new Date()): string {
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  const local = new Date(d.getTime() + off * 60_000).toISOString().slice(0, 19);
  return `${local}${sign}${pad(off / 60)}:${pad(off % 60)}`;
}

/** The end of a day (23:59:59, the machine's offset) for an expiry chosen as a date (YYYY-MM-DD). */
export function endOfDay(date: string, now = new Date()): string {
  const iso = localIso(now);
  return `${date}T23:59:59${iso.slice(19)}`;
}

/** The names of codes that still work: a new code's name may not be one of them (V29). */
export const takenNames = (grants: Grant[], valid: (g: Grant) => boolean) => new Set(grants.filter((g) => g.kind === 'code' && g.name && valid(g)).map((g) => g.name!));
