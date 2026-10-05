/**
 * Edit mode's access operations (documentation/access/spec.md §4, §8): grants made, extended, rescoped and
 * withdrawn; a page made open or private (its file and the media only it uses moved between content/ and
 * private-pages/, its place kept); a private page's address changed; pages moved between and within
 * sections, open and private together. Each is one store transaction, checked whole; the grants' history is
 * enforced by the store (no grant deleted, no ID or name reused, a withdrawn grant left as it is).
 */
import { type AccessMessage, type Article, type Overlay, type PlanetStructure, type SiteNode, type SiteStructure } from '../../content/schema';
import { commit, jsonBytes, readDoc, readFile, versionOf, type Change, type Result } from './store';
import { articleKey, followOnPlanet, OVERLAY, PLANET, STRUCTURE } from './articles';
import { generateCode } from '../../access/codes';
import { b64, grantId, randomBytes, token } from '../../access/crypto';
import { grantState, isValid } from '../../access/grants';
import type { Grant } from '../../access/types';
import { endOfDay, fillMessage, insertAfter, localIso, longDate, magicLink, movePages, openBefore, placePrivate, privateNode, reorderSection, sectionOrder, takenNames, unplacePrivate, type PageAccess, type SharingView } from '../model/access';
import { nodeIds, sectionOf, unplace } from '../model/structure';
import { unique } from '../model/ids';
import { placeOfPage, takeOff } from '../model/planet';
import { mediaUsed, videosUsed } from '../../content/load';
import { readSnapshot } from '../../content/source';
import { content } from '../../content/repository';

export const ACCESS = '/private/access.json';
export const MESSAGE = '/private/access-message.json';
const EMPTY_OVERLAY: Overlay = { sections: [] };

const refuse = (file: string, message: string, path?: string): Result => ({ ok: false, status: 422, issues: [{ file: file.replace(/^\//, ''), message, ...(path ? { path } : {}) }] });
const grantsDoc = () => readDoc<{ grants: Grant[] }>(ACCESS);
const overlayDoc = () => readDoc<Overlay>(OVERLAY);

export interface NewGrant {
  kind: 'code' | 'link';
  recipient: Grant['recipient'];
  purpose: string;
  scope: Grant['scope'];
  /** The last day it works (YYYY-MM-DD); left out, it never expires. */
  expires?: string | null;
  notes?: string;
}

/** Where a grant's message sends its reader: the Sign in page for a code, the page (or section) for a link. */
function grantTarget(g: Grant): string {
  const routes = content().routes;
  if (g.kind === 'code') return '/sign-in/';
  const page = (g.scope.pages ?? []).map((id) => routes.find((r) => r.node.kind === 'item' && r.node.item.id === id)).find(Boolean);
  if (page) return page.path;
  const section = (g.scope.sections ?? []).map((id) => routes.find((r) => r.node.id === id)).find(Boolean);
  return section?.path ?? '/';
}

/** A grant's message, ready to copy: its code or link, and when it ends. */
export function shareMessage(g: Grant): { message: string; link: string; code?: string } {
  const m = readDoc<AccessMessage>(MESSAGE)?.value;
  const site = m?.site ?? '';
  const target = grantTarget(g);
  const link = g.kind === 'link' ? magicLink(site, target, g.id, g.secret.key!) : `${site.replace(/\/$/, '')}${target}`;
  const code = g.kind === 'code' ? `${g.name}-${g.secret.words}` : undefined;
  const template = (g.kind === 'code' ? m?.code : m?.link) ?? '{link}';
  return { message: fillMessage(template, { name: g.recipient.name, code, link, expires: g.expiresAt ? longDate(g.expiresAt) : undefined }), link, ...(code ? { code } : {}) };
}

export async function createGrant(req: NewGrant): Promise<Result & { grant?: Grant; share?: ReturnType<typeof shareMessage> }> {
  if (!req.recipient?.name?.trim()) return refuse(ACCESS, 'say who it is for', 'recipient.name');
  if (!(req.scope.sections?.length || req.scope.pages?.length)) return refuse(ACCESS, 'choose what it opens', 'scope');
  const doc = grantsDoc();
  const grants = doc?.value.grants ?? [];
  const ids = new Set(grants.map((g) => g.id));
  let id = grantId();
  while (ids.has(id)) id = grantId();
  const salt = b64.encode(randomBytes(16));
  const now = new Date();
  const g: Grant = {
    id,
    kind: req.kind,
    recipient: Object.fromEntries(Object.entries(req.recipient).filter(([, v]) => typeof v === 'string' && v.trim())) as Grant['recipient'],
    purpose: req.purpose?.trim() ?? '',
    scope: { ...(req.scope.sections?.length ? { sections: req.scope.sections } : {}), ...(req.scope.pages?.length ? { pages: req.scope.pages } : {}) },
    createdAt: localIso(now),
    ...(req.expires ? { expiresAt: endOfDay(req.expires, now) } : {}),
    secret: { salt },
    ...(req.notes?.trim() ? { notes: req.notes.trim() } : {}),
  };
  if (req.kind === 'code') {
    const c = generateCode(takenNames(grants, (x) => isValid(x, now)));
    g.name = c.name;
    g.secret = { words: c.secret, salt };
  } else g.secret = { key: b64.encode(randomBytes(32)), salt };
  // the access file, and the overlay and message beside it, on the first grant
  const changes: Change[] = [{ key: ACCESS, bytes: jsonBytes({ grants: [...grants, g] }) }];
  const ifMatch: Record<string, string | null> = { [ACCESS]: doc?.version ?? null };
  if (!overlayDoc()) {
    changes.push({ key: OVERLAY, bytes: jsonBytes(EMPTY_OVERLAY) });
    ifMatch[OVERLAY] = null;
  }
  const r = await commit({ changes, ifMatch });
  return r.ok ? { ...r, grant: g, share: shareMessage(g) } : r;
}

async function changeGrant(id: string, change: (g: Grant) => Grant | string): Promise<Result & { grant?: Grant }> {
  const doc = grantsDoc();
  const g = doc?.value.grants.find((x) => x.id === id);
  if (!doc || !g) return refuse(ACCESS, `grant ${id} doesn't exist`);
  const next = change(g);
  if (typeof next === 'string') return refuse(ACCESS, next);
  const r = await commit({ changes: [{ key: ACCESS, bytes: jsonBytes({ grants: doc.value.grants.map((x) => (x.id === id ? next : x)) }) }], ifMatch: { [ACCESS]: doc.version } });
  return r.ok ? { ...r, grant: next } : r;
}

export const extendGrant = (id: string, expires: string | null) =>
  changeGrant(id, (g) => {
    if (g.revokedAt) return 'a withdrawn grant stays withdrawn: make a new one';
    const { expiresAt: _, ...rest } = g;
    return expires ? { ...rest, expiresAt: endOfDay(expires) } : rest;
  });

export const rescopeGrant = (id: string, scope: Grant['scope']) =>
  changeGrant(id, (g) => (g.revokedAt ? 'a withdrawn grant stays withdrawn: make a new one' : !(scope.sections?.length || scope.pages?.length) ? 'choose what it opens' : { ...g, scope }));

export const withdrawGrant = (id: string) => changeGrant(id, (g) => (g.revokedAt ? 'it is already withdrawn' : { ...g, revokedAt: localIso() }));

/** The media files an article uses that nothing else does, in its folder: each picture's sidecar, master and versions. */
function mediaFiles(article: Article, from: 'content' | 'private', onlyIfUnshared: boolean): string[] {
  const snap = readSnapshot();
  const self = `/${from}/articles/${article.id}.json`;
  const others = JSON.stringify(Object.entries(snap.docs).filter(([k]) => k !== self));
  const ids = new Set([...mediaUsed(article), ...videosUsed(article)]);
  const out: string[] = [];
  for (const id of ids) {
    const sidecar = `/${from}/media/${id}.json`;
    if (!(sidecar in snap.docs)) continue;
    if (onlyIfUnshared && others.includes(`"${id}"`)) continue;
    out.push(sidecar);
    const dir = `/${from}/media/${id.slice(0, id.lastIndexOf('/') + 1)}`;
    const name = id.slice(id.lastIndexOf('/') + 1);
    for (const m of snap.masters) if (m.startsWith(dir) && new RegExp(`^${name}(\\.dark|\\.poster)?\\.\\w+$`).test(m.slice(dir.length))) out.push(m);
  }
  return out;
}

/** Moves files from one folder to the other within a change set (the same bytes, a new key). */
function move(keys: string[], to: 'content' | 'private', changes: Change[], ifMatch: Record<string, string | null>) {
  for (const key of keys) {
    const bytes = readFile(key);
    if (!bytes) continue;
    const dest = key.replace(/^\/(content|private)\//, `/${to}/`);
    changes.push({ key, bytes: null }, { key: dest, bytes });
    ifMatch[key] = versionOf(bytes);
    ifMatch[dest] = versionOf(readFile(dest));
  }
}

export type { PageAccess };

/**
 * Makes a page open or private (spec §8.2), in one transaction: its file and the media only it uses move
 * folders; it keeps its place in its section's order (a private page is always in a section: `section` is
 * the one to use when it has none yet, or to move a private page to); a private page leaves the planet.
 */
export async function setPageAccess(id: string, to: PageAccess, section?: string): Promise<Result> {
  const key = articleKey(id);
  const art = readDoc<Article>(key);
  if (!art) return refuse(key, "doesn't exist");
  const s = readDoc<SiteStructure>(STRUCTURE);
  if (!s) return refuse(STRUCTURE, 'missing');
  const o = overlayDoc();
  const overlay = o?.value ?? EMPTY_OVERLAY;
  const priv = privateNode(overlay, id);
  const from: PageAccess = priv ? 'private' : 'open';
  // a private page moved to another section stays private, at the end of its new section
  const moving = from === 'private' && to === 'private' && !!section && section !== priv!.section;
  if (from === to && !moving) return { ok: true, versions: {} };
  const ref = { type: 'article' as const, id };
  const changes: Change[] = [];
  const ifMatch: Record<string, string | null> = {};
  let structure = s.value;
  let nextOverlay = overlay;

  if (from === 'open') {
    const where = sectionOf(structure, ref) ?? section;
    if (!where) return refuse(STRUCTURE, 'a private page is in a section, like any page: put it in one first', 'section');
    const order = sectionOrder(structure, overlay, where).map((p) => p.id);
    const publicNode = findNode(structure, id);
    const nodeId = publicNode?.id ?? id;
    structure = unplace(structure, ref);
    nextOverlay = placePrivate(overlay, where, { id: nodeId, token: token(), item: ref }, order.includes(nodeId) ? order : [...order, nodeId]);
    move([key, ...mediaFiles(art.value, 'content', true)], 'private', changes, ifMatch);
    // off the planet: it has no way to sign in (V28)
    const planet = readDoc<PlanetStructure>(PLANET);
    if (planet && placeOfPage(planet.value, id)) {
      changes.push({ key: PLANET, bytes: jsonBytes(takeOff(planet.value, id)) });
      ifMatch[PLANET] = planet.version;
    }
  } else if (to === 'open') {
    const where = priv!.section;
    const nodeId = priv!.node.id;
    const fullOrder = sectionOrder(structure, overlay, where).map((p) => p.id);
    const after = openBefore(sectionOrder(structure, overlay, where), nodeId);
    structure = insertAfter(structure, where, { id: nodeId, kind: 'item', item: ref } as SiteNode, after);
    // it keeps its place in the section's full order, now as an open page
    nextOverlay = unplacePrivate(overlay, id);
    nextOverlay = { ...nextOverlay, sections: nextOverlay.sections.map((x) => (x.section === where ? { ...x, order: fullOrder } : x)) };
    move([key, ...mediaFiles(art.value, 'private', false)], 'content', changes, ifMatch);
    // grants that named it alone no longer can (V26): it's open to everyone now
    const g = grantsDoc();
    if (g && g.value.grants.some((x) => x.scope.pages?.includes(id))) {
      const grants = g.value.grants.map((x) => (x.scope.pages?.includes(id) && !x.revokedAt ? { ...x, scope: { ...x.scope, pages: x.scope.pages.filter((p) => p !== id) } } : x));
      changes.push({ key: ACCESS, bytes: jsonBytes({ grants }) });
      ifMatch[ACCESS] = g.version;
    }
  } else {
    const order = [...sectionOrder(structure, overlay, section!).map((p) => p.id).filter((x) => x !== priv!.node.id), priv!.node.id];
    nextOverlay = placePrivate(overlay, section!, priv!.node, order);
  }
  if (structure !== s.value) {
    changes.push({ key: STRUCTURE, bytes: jsonBytes(structure) });
    ifMatch[STRUCTURE] = s.version;
  }
  changes.push({ key: OVERLAY, bytes: jsonBytes(nextOverlay) });
  ifMatch[OVERLAY] = o?.version ?? null;
  return commit({ changes, ifMatch });
}

function findNode(structure: SiteStructure, id: string): SiteNode | undefined {
  for (const c of structure.home.children ?? []) if (c.kind === 'hub') for (const k of c.children ?? []) if (k.kind === 'item' && k.item.id === id) return k;
  return undefined;
}

/** A private page's new address: a new token, so every link to the old one stops working (spec §2.2). */
export async function changeAddress(id: string): Promise<Result> {
  const o = overlayDoc();
  if (!o || !privateNode(o.value, id)) return refuse(OVERLAY, `"${id}" isn't a private page`);
  const next: Overlay = { ...o.value, sections: o.value.sections.map((s) => ({ ...s, pages: s.pages.map((p) => (p.item.id === id ? { ...p, token: token() } : p)) })) };
  return commit({ changes: [{ key: OVERLAY, bytes: jsonBytes(next) }], ifMatch: { [OVERLAY]: o.version } });
}

/**
 * Pages moved in the Sections screen with private pages among them (spec §8.2): open and private together,
 * into `to` at `index` among the pages that stay (`_off`: off the site, open pages only). One transaction:
 * the public structure and the overlay.
 */
export async function moveSectionPages(pages: string[], to: string, index?: number): Promise<Result> {
  const s = readDoc<SiteStructure>(STRUCTURE);
  if (!s) return refuse(STRUCTURE, 'missing');
  const o = overlayDoc();
  const taken = new Set([...nodeIds(s.value), ...(o?.value.sections ?? []).flatMap((x) => x.pages.map((p) => p.id))]);
  const r = movePages(s.value, o?.value ?? EMPTY_OVERLAY, pages, to, index, (id) => {
    const n = unique(id, taken);
    taken.add(n);
    return n;
  });
  if (typeof r === 'string') return refuse(OVERLAY, r, 'pages');
  const changes: Change[] = [{ key: STRUCTURE, bytes: jsonBytes(r.structure) }];
  const ifMatch: Record<string, string | null> = { [STRUCTURE]: s.version };
  // open pages moved to another section follow it to its building, as a move in the public structure does
  followOnPlanet(s.value, r.structure, pages, changes, ifMatch);
  if (o || r.overlay.sections.length) {
    changes.push({ key: OVERLAY, bytes: jsonBytes(r.overlay) });
    ifMatch[OVERLAY] = o?.version ?? null;
  }
  return commit({ changes, ifMatch });
}

/** A section's open and private pages in a new order: the overlay keeps it whole, the public structure its open pages (V31). */
export async function setSectionOrder(section: string, order: string[]): Promise<Result> {
  const s = readDoc<SiteStructure>(STRUCTURE);
  const o = overlayDoc();
  if (!s) return refuse(STRUCTURE, 'missing');
  const current = sectionOrder(s.value, o?.value ?? null, section).map((p) => p.id);
  if (current.length !== order.length || current.some((id) => !order.includes(id))) return refuse(OVERLAY, "the new order isn't the section's pages", 'order');
  const r = reorderSection(s.value, o?.value ?? EMPTY_OVERLAY, section, order);
  const changes: Change[] = [{ key: STRUCTURE, bytes: jsonBytes(r.structure) }];
  const ifMatch: Record<string, string | null> = { [STRUCTURE]: s.version };
  if (o && o.value.sections.some((x) => x.section === section)) {
    changes.push({ key: OVERLAY, bytes: jsonBytes(r.overlay) });
    ifMatch[OVERLAY] = o.version;
  }
  return commit({ changes, ifMatch });
}

export type { SharingView };

/** Whether private-pages/ holds the sharing files yet (the first grant writes them). */
export const sharingReady = () => !!readDoc(ACCESS) || !!overlayDoc();

/** What the sharing panel shows: every grant (or, for one page, the ones that open it), and what a grant can open. */
export function sharingView(page?: string): SharingView {
  const index = content();
  const o = overlayDoc()?.value ?? null;
  const s = readDoc<SiteStructure>(STRUCTURE)?.value ?? index.structure;
  const title = (id: string) => index.articles.get(id)?.title ?? id;
  const sectionTitle = (id: string) => {
    const h = (s.home.children ?? []).find((c) => c.id === id);
    return h?.kind === 'hub' ? h.title : id;
  };
  const pages = (o?.sections ?? []).flatMap((x) => x.pages.map((p) => ({ id: p.item.id, title: title(p.item.id), section: x.section })));
  const sectionOfPage = new Map(pages.map((p) => [p.id, p.section]));
  const opens = (g: Grant) => (page ? (g.scope.pages ?? []).includes(page) || (g.scope.sections ?? []).includes(sectionOfPage.get(page) ?? '') : true);
  const now = new Date();
  return {
    grants: (grantsDoc()?.value.grants ?? [])
      .filter(opens)
      .map((g) => ({ ...g, state: grantState(g, now), opens: opensTitles(g, title, sectionTitle) }))
      .reverse(),
    pages: pages.map((p) => ({ ...p, section: sectionTitle(p.section) })),
    sections: [...new Set(pages.map((p) => p.section))].map((id) => ({ id, title: sectionTitle(id) })),
  };
}

/** A grant's timeline in PostHog (spec §8.1), when the project is known: only its ID goes there. */
export function posthogPerson(): ((id: string) => string) | undefined {
  const host = (process.env.PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com').replace(/\/$/, '').replace('://us.i.', '://us.').replace('://eu.i.', '://eu.');
  const project = process.env.POSTHOG_PROJECT_ID;
  return host && project ? (id: string) => `${host}/project/${project}/person/${id}` : undefined;
}

function opensTitles(g: Grant, title: (id: string) => string, sectionTitle: (id: string) => string): string[] {
  const out = (g.scope.sections ?? []).map((s) => `Every private page in ${sectionTitle(s)}`);
  for (const id of g.scope.pages ?? []) out.push(title(id));
  return out;
}