/**
 * Edit mode's access model (documentation/access/spec.md §4, §8), pure so it's unit-tested: placing and
 * unplacing protected pages in the private overlay, a section's full order split into the overlay's and the
 * public structure's, a grant's new record, its share message and its magic link.
 */
import type { HubNode, Overlay, SiteNode, SiteStructure } from '../../content/schema';
import type { Grant } from '../../access/types';
import type { grantState } from '../../access/grants';

/** What the Access screen shows (made by the server's `accessView`). */
export interface AccessView {
  grants: (Grant & { state: ReturnType<typeof grantState>; opens: string[] })[];
  sections: { id: string; title: string; pages: { id: string; node: string; title: string; access: 'open' | 'locked'; published: boolean }[] }[];
  private: { id: string; title: string; path: string; published: boolean }[];
  /** Pages in no section and not private: they can be made private, or put in a section first. */
  unplaced: { id: string; title: string }[];
  ready: boolean;
}

type ProtectedNode = Overlay['private'][number];

/** The overlay without the page: off its section's locked pages and order, and off the private pages. */
export function unplaceProtected(overlay: Overlay, id: string): Overlay {
  return {
    ...overlay,
    sections: overlay.sections
      .map((s) => ({ ...s, pages: s.pages.filter((p) => p.item.id !== id), ...(s.order ? { order: s.order.filter((o) => o !== id) } : {}) }))
      .filter((s) => s.pages.length > 0),
    private: overlay.private.filter((p) => p.item.id !== id),
  };
}

/** The overlay with a locked page in a section, after `after` in its order (the start when null). */
export function placeLocked(overlay: Overlay, section: string, node: ProtectedNode, order: string[]): Overlay {
  const o = unplaceProtected(overlay, node.item.id);
  const existing = o.sections.find((s) => s.section === section);
  const sections = existing ? o.sections.map((s) => (s.section === section ? { ...s, pages: [...s.pages, node], order } : s)) : [...o.sections, { section, pages: [node], order }];
  return { ...o, sections };
}

/** The overlay with a private page (in no section). */
export const placePrivate = (overlay: Overlay, node: ProtectedNode): Overlay => {
  const o = unplaceProtected(overlay, node.item.id);
  return { ...o, private: [...o.private, node] };
};

/** A section's pages, open and locked, in its full order (the overlay's order, then the rest). */
export function sectionOrder(structure: SiteStructure, overlay: Overlay | null, section: string): { id: string; access: 'open' | 'locked' }[] {
  const hub = (structure.home.children ?? []).find((c): c is HubNode => c.kind === 'hub' && c.id === section);
  const open = (hub?.children ?? []).filter((c) => c.kind === 'item').map((c) => c.id);
  const entry = overlay?.sections.find((s) => s.section === section);
  const locked = entry?.pages.map((p) => p.id) ?? [];
  const all = [...open, ...locked];
  const first = (entry?.order ?? []).filter((id) => all.includes(id));
  return [...new Set([...first, ...all])].map((id) => ({ id, access: locked.includes(id) ? 'locked' : 'open' }));
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

/** The open page a locked one follows in a full order (null: the start), to put it back there when it opens. */
export function openBefore(order: { id: string; access: 'open' | 'locked' }[], id: string): string | null {
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
