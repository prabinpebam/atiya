/**
 * The library's index for edit mode (documentation/gallery/spec.md §3.4, §4.2, §9.4, §9.5): a file found by its
 * fingerprint (the SHA-256 of the file as it was uploaded, V55), a linked video found by its provider and ID,
 * and where a library item is used (the albums it's in and the articles that use it: the viewer's "Also in" and
 * the Media screen's Used in). Pure over the documents and the content index, so they're unit-tested; the dev
 * server passes the current snapshot.
 */
import { createHash } from 'node:crypto';
import { mediaUsed, videosUsed, type ContentIndex } from '../../content/load';
import { readSnapshot } from '../../content/source';

/** A library item's kind: a picture (an animation or a drawing included), a video file or a linked video. */
export type LibraryKind = 'image' | 'video' | 'embed';

/** A library item found in the documents: its media ID, its kind and where it lives. */
export interface LibraryMatch {
  id: string;
  kind: LibraryKind;
  origin: 'public' | 'private';
}

/** Where an item is used: one album or article, with its title and status, and where it lives. */
export interface LibraryUse {
  id: string;
  title: string;
  status: string;
  origin: 'public' | 'private';
}

/** The albums an item is in and the articles that use it, each in title order. */
export interface LibraryUses {
  albums: LibraryUse[];
  articles: LibraryUse[];
}

const SIDECAR = /^\/(content|private)\/media\/(.+)\.json$/;
const KINDS = new Set<string>(['image', 'video', 'embed']);

/** A file's fingerprint (V55): its SHA-256 in lowercase hex. */
export const fingerprintOf = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

/** Every library sidecar in the documents (pictures, video files, linked videos), with its media ID and origin. */
function* sidecars(docs: Record<string, unknown>): Generator<LibraryMatch & { doc: Record<string, unknown> }> {
  for (const [key, value] of Object.entries(docs)) {
    const m = SIDECAR.exec(key);
    const doc = value as Record<string, unknown> | null;
    if (!m || !doc || typeof doc !== 'object' || !KINDS.has(String(doc.kind))) continue;
    yield { id: m[2], kind: doc.kind as LibraryKind, origin: m[1] === 'private' ? 'private' : 'public', doc };
  }
}

/**
 * The library item made from the same file (its fingerprint), public or private, or null. Items made before
 * fingerprints were written have none, and are never matched.
 */
export function findByFingerprint(hash: string, docs: Record<string, unknown> = readSnapshot().docs): LibraryMatch | null {
  if (!/^[0-9a-f]{64}$/.test(hash)) return null;
  for (const s of sidecars(docs)) if (s.doc.fingerprint === hash) return { id: s.id, kind: s.kind, origin: s.origin };
  return null;
}

/** The linked video already in the library for a provider's video (its sidecar of kind `embed`), or null. */
export function findLinkedVideo(provider: string, video: string, docs: Record<string, unknown> = readSnapshot().docs): (LibraryMatch & { title: string }) | null {
  for (const s of sidecars(docs)) {
    if (s.kind === 'embed' && s.doc.provider === provider && s.doc.id === video) return { id: s.id, kind: s.kind, origin: s.origin, title: String(s.doc.title ?? '') };
  }
  return null;
}

const byTitle = (a: LibraryUse, b: LibraryUse) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id);

/** The albums a library item is in and the articles that use it (a figure, a gallery, a hero, a thumbnail, a video block…). */
export function usesOf(index: Pick<ContentIndex, 'albums' | 'articles' | 'origins'>, mediaId: string): LibraryUses {
  const origin = (id: string) => (index.origins.get(id) === 'private' ? 'private' : 'public') as LibraryUse['origin'];
  const albums: LibraryUse[] = [];
  for (const al of index.albums.values()) {
    if (al.items.some((i) => 'media' in i && i.media === mediaId)) albums.push({ id: al.id, title: al.title, status: al.status, origin: origin(al.id) });
  }
  const articles: LibraryUse[] = [];
  for (const a of index.articles.values()) {
    if (mediaUsed(a).includes(mediaId) || videosUsed(a).includes(mediaId)) articles.push({ id: a.id, title: a.title, status: a.status, origin: origin(a.id) });
  }
  return { albums: albums.sort(byTitle), articles: articles.sort(byTitle) };
}
