/**
 * Albums, as edit mode changes them (documentation/gallery/spec.md §9, §9.7): an album is its own file,
 * `content/albums/<id>.json` (a private one `private-pages/albums/<id>.json`), placed by a node in a section. The
 * server owns what must stay true: a new album's ID, its dates, its place in a section, and the albums a page
 * shows (V51). Every change is one store transaction, checked before a byte is written.
 */
import { existsSync } from 'node:fs';
import type { Album, Article, Overlay, SiteStructure } from '../../content/schema';
import { isPublished, type ContentIndex } from '../../content/load';
import type { MediaLookup } from '../../content/album';
import { fileOf, hasPrivate, privateRoot, readSnapshot } from '../../content/source';
import { token } from '../../access/crypto';
import { commit, jsonBytes, readDoc, type Change, type Result } from './store';
import { OVERLAY, STRUCTURE } from './articles';
import { today, unique } from '../model/ids';
import { childSlugs, findHub, hubs, nodeIds, nodeOf, place, sectionOf, unplace } from '../model/structure';
import { placePrivate, privateNode, sectionOrder, unplacePrivate } from '../model/access';
import { albumLifecycleRefusal, showingPages, type AlbumChange } from '../model/albumBlock';
import { addItems, albumIdFrom, newAlbum } from '../model/album';

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** An album's file: in private-pages/ when it's private (§12), else in content/. */
export const albumKey = (id: string): string => (existsSync(fileOf(`/private/albums/${id}.json`)) ? `/private/albums/${id}.json` : `/content/albums/${id}.json`);

const refuse = (file: string, message: string, path?: string): Result => ({ ok: false, status: 422, issues: [{ file: file.replace(/^\//, ''), message, ...(path ? { path } : {}) }] });

/** The index's library, as the album rules look it up. */
export const lookupOf = (index: ContentIndex): MediaLookup => (id) => index.media.get(id) ?? index.videos.get(id) ?? index.embeds.get(id);

/** Every article and album on disk, read from the snapshot (drafts and private ones too). */
function docs(): { articles: Map<string, Article>; albums: Map<string, Album> } {
  const articles = new Map<string, Article>();
  const albums = new Map<string, Album>();
  for (const [key, value] of Object.entries(readSnapshot().docs)) {
    const a = /^\/(?:content|private)\/articles\/([^/]+)\.json$/.exec(key);
    if (a) articles.set(a[1], value as Article);
    const b = /^\/(?:content|private)\/albums\/([^/]+)\.json$/.exec(key);
    if (b) albums.set(b[1], value as Album);
  }
  return { articles, albums };
}

/** Why `change` to the album `id` is refused (§7.2, V51), naming the pages whose album block shows it; undefined when nothing stops it. */
export function albumRefusal(id: string, change: AlbumChange): string | undefined {
  const { articles, albums } = docs();
  if (!albums.has(id)) return undefined;
  const pages = [...articles].map(([pid, a]) => ({ id: pid, title: a.title, published: isPublished(a), body: Array.isArray(a.body) ? a.body : [] }));
  return albumLifecycleRefusal(change, showingPages(pages, id));
}

/** The sections an album can go in (every top section), the albums section first among them as the default. */
export function albumSections(structure: SiteStructure): { value: string; label: string; description: string; albums: boolean }[] {
  return hubs(structure)
    .filter((h) => h.depth === 1)
    .map((h) => ({ value: h.id, label: h.title, description: h.path, albums: findHub(structure, h.id)?.view === 'albums' }));
}

/** Where a new album goes: the section asked for, else the one whose view is Albums, else the first (saying so). */
export function defaultSection(structure: SiteStructure, asked?: string | null): { section: string | null; note?: string } {
  const all = albumSections(structure);
  if (asked && all.some((s) => s.value === asked)) return { section: asked };
  const albums = all.find((s) => s.albums);
  if (albums) return { section: albums.value };
  if (all[0]) return { section: all[0].value, note: `No section shows albums yet, so it's in ${all[0].label}. Set a section's view to Albums to make it the gallery.` };
  return { section: null };
}

export interface CreateAlbum {
  title?: string;
  /** The section (top hub id) to place it in; left out, the albums section. */
  section?: string | null;
  access?: 'open' | 'private';
}

/** A new draft album, placed in its section in the same transaction (§9.1). */
export async function createAlbum(req: CreateAlbum): Promise<Result & { id?: string; note?: string }> {
  const s = readDoc<SiteStructure>(STRUCTURE);
  if (!s) return refuse(STRUCTURE, 'missing');
  const access = req.access ?? 'open';
  if (access === 'private' && !hasPrivate(privateRoot())) return refuse(OVERLAY, "private-pages/ isn't set up: run scripts/setup-private-pages.ps1 first", 'access');
  const { section, note } = defaultSection(s.value, req.section);
  if (!section) return refuse(STRUCTURE, 'an album is placed in a section: add a section first', 'section');
  const { articles, albums } = docs();
  const slugOf = (i: { type: string; id: string }) => (i.type === 'album' ? albums.get(i.id)?.slug : articles.get(i.id)?.slug);
  const taken = new Set([...articles.keys(), ...albums.keys(), ...childSlugs(s.value, section, slugOf)]);
  const id = albumIdFrom(req.title ?? '', taken);
  const doc = newAlbum(id, req.title ?? '', today());
  if (access === 'private') {
    const key = `/private/albums/${id}.json`;
    const o = readDoc<Overlay>(OVERLAY);
    const overlay = o?.value ?? { sections: [] };
    const ids = new Set([...nodeIds(s.value), ...overlay.sections.flatMap((x) => x.pages.map((p) => p.id))]);
    const node = { id: unique(id, ids), token: token(), item: { type: 'album' as const, id } };
    const next = placePrivate(overlay, section, node, [...sectionOrder(s.value, overlay, section).map((p) => p.id), node.id]);
    const r = await commit({ changes: [{ key, bytes: jsonBytes(doc) }, { key: OVERLAY, bytes: jsonBytes(next) }], ifMatch: { [key]: null, [OVERLAY]: o?.version ?? null } });
    return r.ok ? { ...r, id, ...(note ? { note } : {}) } : r;
  }
  const key = `/content/albums/${id}.json`;
  const placed = place(s.value, section, { type: 'album', id }, unique(id, nodeIds(s.value)));
  const r = await commit({ changes: [{ key, bytes: jsonBytes(doc) }, { key: STRUCTURE, bytes: jsonBytes(placed) }], ifMatch: { [key]: null, [STRUCTURE]: s.version } });
  return r.ok ? { ...r, id, ...(note ? { note } : {}) } : r;
}

export interface SaveAlbum {
  id: string;
  album: Album;
  ifMatch: Record<string, string | null>;
}

/** Saves an album as edited (§9.7): its ID and slug stay, its dates are the server's, and unpublishing is refused while a published page shows it (V51). */
export async function saveAlbum(req: SaveAlbum): Promise<Result> {
  if (!ID.test(req.id)) return refuse(albumKey(req.id), 'not an album id');
  const key = albumKey(req.id);
  const cur = readDoc<Album>(key);
  if (!cur) return refuse(key, "doesn't exist");
  const next: Album = { ...req.album, id: req.id, type: 'album', updatedAt: today() };
  if (!next.slug) next.slug = cur.value.slug;
  next.createdAt = cur.value.createdAt;
  if (next.status === 'published' && !next.publishedAt) next.publishedAt = cur.value.publishedAt ?? today();
  if (cur.value.status === 'published' && next.status === 'draft') {
    const why = albumRefusal(req.id, 'draft');
    if (why) return refuse(key, why, 'status');
  }
  return commit({ changes: [{ key, bytes: jsonBytes(next) }], ifMatch: { [key]: req.ifMatch[key] ?? cur.version } });
}

/**
 * Adds library items to another album (§9.3 Add to album): at its end, each once (one already there is skipped);
 * they stay in the album they were chosen in. Answers how many went in and how many were there already.
 */
export async function addToAlbum(id: string, media: readonly string[]): Promise<Result & { added?: number; skipped?: number }> {
  if (!ID.test(id)) return refuse(albumKey(id), 'not an album id');
  const key = albumKey(id);
  const cur = readDoc<Album>(key);
  if (!cur) return refuse(key, "doesn't exist");
  const { album, added, skipped } = addItems(cur.value, media);
  if (!added.length) return { ok: true, versions: { [key]: cur.version }, added: 0, skipped: skipped.length };
  const r = await saveAlbum({ id, album, ifMatch: { [key]: cur.version } });
  return r.ok ? { ...r, added: added.length, skipped: skipped.length } : r;
}

/** Deletes an album (§9.1): its file and its node go, its pictures stay in the library. Refused while a page shows it (V51). */
export async function deleteAlbum(id: string, ifMatch: Record<string, string | null> = {}): Promise<Result> {
  if (!ID.test(id)) return refuse(albumKey(id), 'not an album id');
  const key = albumKey(id);
  const cur = readDoc<Album>(key);
  const s = readDoc<SiteStructure>(STRUCTURE);
  if (!cur || !s) return refuse(key, "doesn't exist");
  const why = albumRefusal(id, 'delete');
  if (why) return refuse(key, why, 'status');
  const changes: Change[] = [{ key, bytes: null }];
  const match: Record<string, string | null> = { [key]: ifMatch[key] ?? cur.version };
  if (sectionOf(s.value, { type: 'album', id })) {
    changes.push({ key: STRUCTURE, bytes: jsonBytes(unplace(s.value, { type: 'album', id })) });
    match[STRUCTURE] = ifMatch[STRUCTURE] ?? s.version;
  }
  const overlay = key.startsWith('/private/') ? readDoc<Overlay>(OVERLAY) : null;
  if (overlay && privateNode(overlay.value, id)) {
    changes.push({ key: OVERLAY, bytes: jsonBytes(unplacePrivate(overlay.value, id)) });
    match[OVERLAY] = ifMatch[OVERLAY] ?? overlay.version;
  }
  return commit({ changes, ifMatch: match });
}

/** The section an album is in (its node in the structure, or a private one's in the overlay). */
export function albumSection(structure: SiteStructure, overlay: Overlay | null, id: string): string | null {
  return sectionOf(structure, { type: 'album', id }) ?? privateNode(overlay, id)?.section ?? null;
}

/** Moves an album to another section (§9.2.1): its node moves, with no redirect. */
export async function moveAlbum(id: string, section: string): Promise<Result> {
  if (!ID.test(id)) return refuse(albumKey(id), 'not an album id');
  const s = readDoc<SiteStructure>(STRUCTURE);
  if (!s) return refuse(STRUCTURE, 'missing');
  if (!albumSections(s.value).some((x) => x.value === section)) return refuse(STRUCTURE, "isn't a section", 'section');
  if (albumKey(id).startsWith('/private/')) {
    const o = readDoc<Overlay>(OVERLAY);
    const at = o && privateNode(o.value, id);
    if (!o || !at) return refuse(OVERLAY, "doesn't place this album", 'section');
    if (at.section === section) return { ok: true, versions: {} };
    const off = unplacePrivate(o.value, id);
    const next = placePrivate(off, section, at.node, [...sectionOrder(s.value, off, section).map((p) => p.id), at.node.id]);
    return commit({ changes: [{ key: OVERLAY, bytes: jsonBytes(next) }], ifMatch: { [OVERLAY]: o.version } });
  }
  if (sectionOf(s.value, { type: 'album', id }) === section) return { ok: true, versions: {} };
  const nodeId = nodeOf(s.value, { type: 'album', id })?.id ?? unique(id, nodeIds(s.value));
  const moved = place(unplace(s.value, { type: 'album', id }), section, { type: 'album', id }, nodeId);
  return commit({ changes: [{ key: STRUCTURE, bytes: jsonBytes(moved) }], ifMatch: { [STRUCTURE]: s.version } });
}
