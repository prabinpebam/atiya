/**
 * Edit mode's access operations (documentation/access/spec.md §4, §8): grants made, changed (who it's for,
 * why, what it opens, when it ends), extended, rescoped, withdrawn and deleted; a page made open or private
 * (its file and the media only it uses moved between content/ and private-pages/, its place kept); a private
 * page's address changed; pages moved between and within sections, open and private together. Each is one
 * store transaction, checked whole; the grants' history is enforced by the store (no ID or working code's
 * name reused, a withdrawn grant left as it is but for its purpose and notes).
 */
import { type AccessMessage, type Album, type Article, type HubNode, type Overlay, type PlanetStructure, type SiteNode, type SiteStructure } from '../../content/schema';
import { commit, jsonBytes, readDoc, readFile, versionOf, type Change, type Result } from './store';
import { articleKey, OVERLAY, STRUCTURE } from './articles';
import { generateCode } from '../../access/codes';
import { b64, grantId, randomBytes, token } from '../../access/crypto';
import { grantState, isValid } from '../../access/grants';
import type { Grant } from '../../access/types';
import { endDateIssue, endOfDay, fillMessage, insertAfter, localIso, longDate, magicLink, movePages, openBefore, placePrivate, privateNode, reorderSection, sectionOrder, takenNames, unplacePrivate, type PageAccess, type SharingView } from '../model/access';
import { nodeIds, sectionOf, unplace } from '../model/structure';
import { unique } from '../model/ids';
import { isAlbumPublished, isPublished, mediaUsed, videosUsed } from '../../content/load';
import { hasPrivate, privateRoot, readSnapshot } from '../../content/source';
import { isMediaItem } from '../../content/album';
import { albumKey, albumRefusal } from './albums';
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

async function changeGrant(id: string, change: (g: Grant) => Grant | string | { message: string; path: string }): Promise<Result & { grant?: Grant }> {
  const doc = grantsDoc();
  const g = doc?.value.grants.find((x) => x.id === id);
  if (!doc || !g) return refuse(ACCESS, `grant ${id} doesn't exist`);
  const next = change(g);
  if (typeof next === 'string') return refuse(ACCESS, next);
  if ('message' in next) return refuse(ACCESS, next.message, next.path);
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

/** A grant's details as the Access screen saves them; a field left out stays as it is. */
export interface GrantEdit {
  recipient?: Grant['recipient'];
  purpose?: string;
  notes?: string;
  scope?: Grant['scope'];
  /** The last day it works (YYYY-MM-DD), or null for no end. */
  expires?: string | null;
}

const RECIPIENT = ['name', 'organisation', 'role', 'email'] as const;
const sameScope = (a: Grant['scope'], b: Grant['scope']) => (['sections', 'pages'] as const).every((k) => [...(a[k] ?? [])].sort().join('\n') === [...(b[k] ?? [])].sort().join('\n'));

/**
 * Changes a grant's details in one save (documentation/access/spec.md §8.1): who it's for, why, its notes,
 * what it opens and its last day. A withdrawn grant keeps who it was for, what it opened and its dates (the
 * store holds that too): only why and the notes change. What's unchanged keeps its exact bytes.
 */
export const updateGrant = (id: string, e: GrantEdit) =>
  changeGrant(id, (g) => {
    let recipient = g.recipient;
    if (e.recipient) {
      const r = Object.fromEntries(RECIPIENT.flatMap((k) => (typeof e.recipient?.[k] === 'string' && e.recipient[k]!.trim() ? [[k, e.recipient[k]!.trim()]] : []))) as Grant['recipient'];
      if (!r.name) return { message: 'say who it is for', path: 'recipient.name' };
      if (RECIPIENT.some((k) => (r[k] ?? '') !== (g.recipient[k] ?? ''))) recipient = r;
    }
    let scope = g.scope;
    if (e.scope) {
      const s: Grant['scope'] = { ...(e.scope.sections?.length ? { sections: [...new Set(e.scope.sections)] } : {}), ...(e.scope.pages?.length ? { pages: [...new Set(e.scope.pages)] } : {}) };
      if (!(s.sections?.length || s.pages?.length)) return { message: 'choose what it opens: a section or a page', path: 'scope' };
      if (!sameScope(s, g.scope)) scope = s;
    }
    let expiresAt = g.expiresAt;
    if (e.expires !== undefined && (e.expires || null) !== (g.expiresAt?.slice(0, 10) ?? null)) {
      if (e.expires) {
        const issue = endDateIssue(e.expires, localIso().slice(0, 10));
        if (issue) return { message: issue, path: 'expires' };
        expiresAt = endOfDay(e.expires);
      } else expiresAt = undefined;
    }
    if (g.revokedAt && (recipient !== g.recipient || scope !== g.scope || expiresAt !== g.expiresAt)) return 'a withdrawn code or link keeps who it was for, what it opened and its dates: only why and the notes can change';
    const purpose = e.purpose === undefined ? g.purpose : e.purpose.trim();
    const notes = e.notes === undefined ? g.notes : e.notes.trim() || undefined;
    // the record's own order of fields, so an unchanged grant's bytes stay the same
    const next: Grant = { ...g, recipient, purpose, scope };
    if (expiresAt) next.expiresAt = expiresAt;
    else delete next.expiresAt;
    if (notes) next.notes = notes;
    else delete next.notes;
    return next;
  });

/**
 * Deletes a grant (documentation/access/spec.md §4.1): its record goes from access.json. One that still
 * works stops once that's published (the next deploy makes no keyring for it); telemetry can no longer
 * name whose it was. The private repository's history keeps the record.
 */
export async function deleteGrant(id: string): Promise<Result> {
  const doc = grantsDoc();
  if (!doc || !doc.value.grants.some((g) => g.id === id)) return refuse(ACCESS, `grant ${id} doesn't exist`);
  return commit({ changes: [{ key: ACCESS, bytes: jsonBytes({ grants: doc.value.grants.filter((g) => g.id !== id) }) }], ifMatch: { [ACCESS]: doc.version } });
}

type Folder = 'content' | 'private';
type Snapshot = ReturnType<typeof readSnapshot>;

/** A library item's files in a folder: its sidecar, its master and its versions (dark, poster, caption tracks). */
function itemFiles(snap: Snapshot, id: string, from: Folder): string[] {
  const sidecar = `/${from}/media/${id}.json`;
  if (!(sidecar in snap.docs)) return [];
  const dir = `/${from}/media/${id.slice(0, id.lastIndexOf('/') + 1)}`;
  const name = id.slice(id.lastIndexOf('/') + 1);
  const version = new RegExp(`^${name}(?:\\.dark(?:\\.poster)?|\\.poster|\\.[a-z]{2,3}(?:-[a-z0-9]+)*)?\\.\\w+$`);
  return [sidecar, ...[...snap.masters].filter((m) => m.startsWith(dir) && version.test(m.slice(dir.length)))];
}

/** The documents other than `skip` that use the library item `id`, under `under` (a folder's prefix) when given. */
function usersOf(snap: Snapshot, id: string, skip: Set<string>, under?: string): string[] {
  const needle = `"${id}"`;
  return Object.entries(snap.docs)
    .filter(([k, v]) => !skip.has(k) && (!under || k.startsWith(under)) && JSON.stringify(v).includes(needle))
    .map(([k]) => k);
}

/** What a document is called, for a refusal: its title, else its file. */
function nameOf(snap: Snapshot, key: string): string {
  const t = (snap.docs[key] as { title?: unknown } | undefined)?.title;
  return typeof t === 'string' ? `"${t}"` : key.replace(/^\/(content|private)\//, '');
}

/** The media files an article uses that nothing else does, in its folder: each picture's sidecar, master and versions. */
function mediaFiles(article: Article, from: Folder, onlyIfUnshared: boolean): string[] {
  const snap = readSnapshot();
  const self = `/${from}/articles/${article.id}.json`;
  const others = JSON.stringify(Object.entries(snap.docs).filter(([k]) => k !== self));
  const ids = new Set([...mediaUsed(article), ...videosUsed(article)]);
  const out: string[] = [];
  for (const id of ids) {
    if (onlyIfUnshared && others.includes(`"${id}"`)) continue;
    out.push(...itemFiles(snap, id, from));
  }
  return out;
}

/** Moves files from one folder to the other within a change set (the same bytes, a new key). */
function move(keys: string[], to: Folder, changes: Change[], ifMatch: Record<string, string | null>) {
  relocate(keys.map((key) => [key, key.replace(/^\/(content|private)\//, `/${to}/`)]), changes, ifMatch);
}

/** Moves each file to its new key within a change set (the same bytes). */
function relocate(pairs: [string, string][], changes: Change[], ifMatch: Record<string, string | null>) {
  for (const [key, dest] of pairs) {
    const bytes = readFile(key);
    if (!bytes) continue;
    changes.push({ key, bytes: null }, { key: dest, bytes });
    ifMatch[key] = versionOf(bytes);
    ifMatch[dest] = versionOf(readFile(dest));
  }
}

export type { PageAccess };

/** What changes access: a page or an album, its file, and how its files move (a refusal when they can't). */
interface Subject {
  ref: { type: 'article' | 'album'; id: string };
  key: string;
  /** Puts its file's and its media's moves into the change set; a refusal stops the whole change. */
  moveFiles: (from: Folder, to: Folder, changes: Change[], ifMatch: Record<string, string | null>) => Result | undefined;
}

/**
 * Makes a page open or private (spec §8.2), in one transaction: its file and the media only it uses move
 * folders; it keeps its place in its section's order (a private page is always in a section: `section` is
 * the one to use when it has none yet, or to move a private page to); a private page leaves the planet.
 */
export async function setPageAccess(id: string, to: PageAccess, section?: string): Promise<Result> {
  const key = articleKey(id);
  const art = readDoc<Article>(key);
  if (!art) return refuse(key, "doesn't exist");
  return setAccess(
    {
      ref: { type: 'article', id },
      key,
      moveFiles: (from, dest, changes, ifMatch) => {
        move([key, ...mediaFiles(art.value, from, from === 'content')], dest, changes, ifMatch);
        return undefined;
      },
    },
    to,
    section,
  );
}

/**
 * Makes an album open or private (gallery spec §12, §9.2.1), in one transaction, as `setPageAccess` moves a page:
 * its file and its own folder of pictures (`media/albums/<id>/`) move between content/ and private-pages/, and it
 * keeps its place in its section. A library picture it uses from elsewhere stays where it is: a private album may
 * use an open one; an open album never a private one (V52), so making it open is refused while it holds one,
 * naming it, unless `moveIn` asks for the pictures used nowhere else to move into this album's folder. Its own
 * pictures never change who can see them silently: one another open page uses keeps the album open (and one
 * another private page uses keeps it private), saying which.
 */
export async function setAlbumAccess(id: string, to: PageAccess, opts: { moveIn?: boolean } = {}): Promise<Result> {
  const key = albumKey(id);
  const al = readDoc<Album>(key);
  if (!al) return refuse(key, "doesn't exist");
  if (to === 'private') {
    if (!hasPrivate(privateRoot())) return refuse(OVERLAY, "private-pages/ isn't set up: run scripts/setup-private-pages.ps1 first", 'access');
    const why = albumRefusal(id, 'private');
    if (why) return refuse(key, why, 'access');
  }
  const ownDir = (f: Folder) => `/${f}/media/albums/${id}/`;
  const moveFiles: Subject['moveFiles'] = (from, dest, changes, ifMatch) => {
    const snap = readSnapshot();
    const label = (mid: string) => `"${mid.slice(mid.lastIndexOf('/') + 1)}"`;
    // its own folder: every file in it, and the library items whose sidecars are there
    const own = [...Object.keys(snap.docs), ...snap.masters].filter((k) => k.startsWith(ownDir(from)));
    const ownItems = own.filter((k) => k.endsWith('.json') && k in snap.docs).map((k) => k.slice(`/${from}/media/`.length, -'.json'.length));
    const skip = new Set([key, ...own]);
    // what can see the pictures now stays able to: none of its own is also on a page on the other side
    for (const mid of ownItems) {
      const users = usersOf(snap, mid, skip, `/${from}/`);
      if (users.length)
        return refuse(key, `${label(mid)} is in this album's folder and also on ${nameOf(snap, users[0]!)}, which ${from === 'content' ? 'everyone can see' : 'is private'}: take it off there first`, 'access');
    }
    let album = al.value;
    const pairs: [string, string][] = own.map((k) => [k, k.replace(/^\/(content|private)\//, `/${dest}/`)]);
    if (dest === 'content') {
      // the private pictures it uses from elsewhere (V52)
      const outside = [...new Set(album.items.filter(isMediaItem).map((i) => i.media))].filter((mid) => !ownItems.includes(mid) && `/private/media/${mid}.json` in snap.docs);
      const shared = outside.filter((mid) => usersOf(snap, mid, new Set([key, `/private/media/${mid}.json`])).length);
      if (shared.length) {
        const users = usersOf(snap, shared[0]!, new Set([key, `/private/media/${shared[0]}.json`]));
        return refuse(key, `${shared.map(label).join(', ')} ${shared.length > 1 ? 'are private pictures' : 'is a private picture'} also on ${nameOf(snap, users[0]!)}: an open album can't show ${shared.length > 1 ? 'them' : 'it'} (V52). Take ${shared.length > 1 ? 'them' : 'it'} out of this album first`, 'access');
      }
      if (outside.length && !opts.moveIn)
        return refuse(key, `${outside.map(label).join(', ')} ${outside.length > 1 ? 'are private pictures' : 'is a private picture'} from elsewhere: an open album can't show ${outside.length > 1 ? 'them' : 'it'} (V52). Move ${outside.length > 1 ? 'them' : 'it'} into this album's folder to make it public with ${outside.length > 1 ? 'them' : 'it'}`, 'move');
      // moved into this album's own folder (its ID is its new place there); the album's items follow
      const renamed = new Map<string, string>();
      for (const mid of outside) {
        const next = `albums/${id}/${mid.slice(mid.lastIndexOf('/') + 1)}`;
        if (`/content/media/${next}.json` in snap.docs || `/private/media/${next}.json` in snap.docs || [...renamed.values()].includes(next))
          return refuse(key, `this album's folder already holds a picture called ${label(next)}: rename one first`, 'move');
        renamed.set(mid, next);
        const dir = `/private/media/${mid.slice(0, mid.lastIndexOf('/') + 1)}`;
        for (const f of itemFiles(snap, mid, 'private')) pairs.push([f, `${ownDir('content')}${f.slice(dir.length)}`]);
      }
      if (renamed.size) album = { ...album, items: album.items.map((i) => (isMediaItem(i) && renamed.has(i.media) ? { ...i, media: renamed.get(i.media)! } : i)) };
    }
    relocate(pairs, changes, ifMatch);
    const destKey = `/${dest === 'private' ? 'private' : 'content'}/albums/${id}.json`;
    changes.push({ key, bytes: null }, { key: destKey, bytes: album === al.value ? readFile(key)! : jsonBytes(album) });
    ifMatch[key] = al.version;
    ifMatch[destKey] = versionOf(readFile(destKey));
    return undefined;
  };
  return setAccess({ ref: { type: 'album', id }, key, moveFiles }, to);
}

async function setAccess(subject: Subject, to: PageAccess, section?: string): Promise<Result> {
  const { ref } = subject;
  const id = ref.id;
  const s = readDoc<SiteStructure>(STRUCTURE);
  if (!s) return refuse(STRUCTURE, 'missing');
  const o = overlayDoc();
  const overlay = o?.value ?? EMPTY_OVERLAY;
  const priv = privateNode(overlay, id);
  const from: PageAccess = priv ? 'private' : 'open';
  // a private page moved to another section stays private, at the end of its new section
  const moving = from === 'private' && to === 'private' && !!section && section !== priv!.section;
  if (from === to && !moving) return { ok: true, versions: {} };
  const changes: Change[] = [];
  const ifMatch: Record<string, string | null> = {};
  let structure = s.value;
  let nextOverlay = overlay;

  if (from === 'open') {
    const where = sectionOf(structure, ref) ?? section;
    if (!where) return refuse(STRUCTURE, 'a private page is in a section, like any page: put it in one first', 'section');
    const order = sectionOrder(structure, overlay, where).map((p) => p.id);
    const publicNode = findNode(structure, ref);
    const nodeId = publicNode?.id ?? id;
    structure = unplace(structure, ref);
    nextOverlay = placePrivate(overlay, where, { id: nodeId, token: token(), item: ref }, order.includes(nodeId) ? order : [...order, nodeId]);
    const stop = subject.moveFiles('content', 'private', changes, ifMatch);
    if (stop) return stop;
  } else if (to === 'open') {
    const where = priv!.section;
    const nodeId = priv!.node.id;
    const fullOrder = sectionOrder(structure, overlay, where).map((p) => p.id);
    const after = openBefore(sectionOrder(structure, overlay, where), nodeId);
    structure = insertAfter(structure, where, { id: nodeId, kind: 'item', item: ref } as SiteNode, after);
    // it keeps its place in the section's full order, now as an open page
    nextOverlay = unplacePrivate(overlay, id);
    nextOverlay = { ...nextOverlay, sections: nextOverlay.sections.map((x) => (x.section === where ? { ...x, order: fullOrder } : x)) };
    const stop = subject.moveFiles('private', 'content', changes, ifMatch);
    if (stop) return stop;
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

function findNode(structure: SiteStructure, ref: { type: string; id: string }): SiteNode | undefined {
  for (const c of structure.home.children ?? []) if (c.kind === 'hub') for (const k of c.children ?? []) if (k.kind === 'item' && k.item.type === ref.type && k.item.id === ref.id) return k;
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

/** What the sharing panel and the Access screen show: every grant (or, for one page, the ones that open it), and what a grant can open. */
export function sharingView(page?: string): SharingView {
  const index = content();
  const o = overlayDoc()?.value ?? null;
  const s = readDoc<SiteStructure>(STRUCTURE)?.value ?? index.structure;
  const hubs = (s.home.children ?? []).filter((c): c is HubNode => c.kind === 'hub');
  const sectionTitle = (id: string) => hubs.find((h) => h.id === id)?.title ?? id;
  const article = (id: string) => index.articles.get(id);
  // a grant names an album as it names a page (gallery spec §12): read from its own file, open or private
  const album = (id: string) => index.albums.get(id);
  const title = (id: string) => article(id)?.title ?? album(id)?.title ?? id;
  const pages = (o?.sections ?? []).flatMap((x) =>
    x.pages.map((p) => {
      if (p.item.type === 'album') {
        const al = album(p.item.id);
        return { id: p.item.id, title: title(p.item.id), section: sectionTitle(x.section), sectionId: x.section, published: !!al && isAlbumPublished(al), kind: 'album' as const };
      }
      const a = article(p.item.id);
      return { id: p.item.id, title: title(p.item.id), section: sectionTitle(x.section), sectionId: x.section, published: !!a && isPublished(a) };
    }),
  );
  const sectionOfPage = new Map(pages.map((p) => [p.id, p.sectionId]));
  const opens = (g: Grant) => (page ? (g.scope.pages ?? []).includes(page) || (g.scope.sections ?? []).includes(sectionOfPage.get(page) ?? '') : true);
  const now = new Date();
  return {
    grants: (grantsDoc()?.value.grants ?? [])
      .filter(opens)
      .map((g) => ({ ...g, state: grantState(g, now), opens: opensTitles(g, title, sectionTitle) }))
      .reverse(),
    pages,
    sections: hubs.map((h) => ({ id: h.id, title: h.title })),
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