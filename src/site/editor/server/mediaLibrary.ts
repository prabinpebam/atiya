/**
 * The library as the Media screen draws it (documentation/gallery/spec.md §9.9): every picture, video file and
 * linked video as a timeline cell (its month, its kind, where it's used), the item open as the info panel shows
 * it, and deleting from the library: refused while a page uses it, else taken out of every album that holds it
 * and deleted, in one store transaction.
 */
import { statSync } from 'node:fs';
import type { Album } from '../../content/schema';
import type { ContentIndex } from '../../content/load';
import { fileOf } from '../../content/source';
import { withBase } from '../../design/meta';
import type { PhotoCell } from '../kit/PhotoGrid.astro';
import { removeItems } from '../model/album';
import type { ViewerItem } from '../model/albumViewer';
import { deleteVerdict, timeline, type LibraryEntry, type LibraryFilter } from '../model/library';
import { albumKey } from './albums';
import { thumbOf } from './albumScreens';
import { viewerItem } from './albumViewer';
import { usesOf } from './libraryIndex';
import { deletionOf } from './media';
import { commit, jsonBytes, readDoc, type Change, type Result } from './store';

const day = (d: Date) => d.toISOString().slice(0, 10);
/** The day a file was added: its master's date on disk (sidecars keep no "added" date). */
function addedOf(key: string | undefined): string {
  try {
    if (key) return day(statSync(fileOf(key)).mtime);
  } catch {
    // gone or unreadable: today
  }
  return day(new Date());
}

/** Every library item as the timeline's entry, with where it's used. */
export function libraryEntries(index: ContentIndex): LibraryEntry[] {
  const albumsOf = new Map<string, Set<string>>();
  for (const al of index.albums.values()) {
    for (const i of al.items) if ('media' in i) albumsOf.set(i.media, (albumsOf.get(i.media) ?? new Set()).add(al.title));
  }
  const noAlbums = { albums: new Map(), articles: index.articles, origins: index.origins };
  const common = (id: string, origin: string) => ({ id, albums: [...(albumsOf.get(id) ?? [])], articles: usesOf(noAlbums, id).articles.map((a) => a.title), private: origin === 'private' });
  const entries: LibraryEntry[] = [];
  for (const m of index.media.values()) {
    const kind = m.file.endsWith('.svg') ? 'drawing' : m.animation ? 'animated' : 'picture';
    entries.push({ ...common(m.id, m.origin), kind, ...(m.taken ? { taken: m.taken } : {}), added: addedOf(m.master), needsAlt: !m.alt && !m.decorative });
  }
  for (const v of index.videos.values()) entries.push({ ...common(v.id, v.origin), kind: 'video', ...(v.taken ? { taken: v.taken } : {}), added: addedOf(v.master), needsAlt: false });
  for (const e of index.embeds.values()) entries.push({ ...common(e.id, e.origin), kind: 'embed', ...(e.taken ? { taken: e.taken } : {}), added: addedOf(e.posterMaster), needsAlt: false });
  return entries;
}

/** A timeline cell: the grid's cell, and where it's used (the delete dialog's words). */
export type LibraryCell = PhotoCell & { albums: string[]; articles: string[] };

/** The timeline under a filter, as the grid draws it: thumbnails, months, kinds and marks. */
export async function libraryCells(index: ContentIndex, filter: LibraryFilter): Promise<LibraryCell[]> {
  const shown = timeline(libraryEntries(index), filter);
  return Promise.all(
    shown.map(async (e) => {
      const t = await thumbOf(index, e.id);
      return {
        id: e.id,
        media: e.id,
        kind: e.kind,
        ...(t.thumb ? { thumb: t.thumb } : {}),
        alt: t.alt,
        ...(t.bg ? { bg: t.bg } : {}),
        width: t.width,
        height: t.height,
        group: e.group,
        ...(e.taken ? { taken: e.taken } : {}),
        ...(e.needsAlt ? { needsAlt: true } : {}),
        ...(e.private ? { private: true } : {}),
        albums: e.albums,
        articles: e.articles,
      };
    }),
  );
}

/** The library item open, as the info panel shows it: its words, every album and page that uses it, its facts. */
export async function libraryItem(index: ContentIndex, id: string): Promise<ViewerItem | null> {
  if (!index.media.has(id) && !index.videos.has(id) && !index.embeds.has(id)) return null;
  // the viewer's item for an album of one (no album's own settings apply), so the panel is the album editor's
  const alone = { id: '', title: '', status: 'draft', items: [{ id, media: id }] } as unknown as Album;
  const item = await viewerItem(index, alone, id, false);
  if (!item) return null;
  const used = usesOf(index, id);
  return {
    ...item,
    uses: [
      ...used.albums.map((a) => ({ title: a.title, href: withBase(`/_edit/albums/${a.id}/`), kind: 'album' as const, draft: a.status !== 'published' })),
      ...used.articles.map((a) => ({ title: a.title, href: withBase(`/_edit/articles/${a.id}/`), kind: 'page' as const, draft: a.status !== 'published' })),
    ],
  };
}

const refused = (message: string): Result => ({ ok: false, status: 422, issues: [{ file: 'content/media', message }] });

/**
 * Deletes library items (spec §9.9): refused while a page uses any (naming the pages); otherwise each is taken
 * out of every album that holds it (its cover too) and deleted with its files, all in one transaction.
 */
export async function deleteFromLibrary(index: ContentIndex, ids: readonly string[]): Promise<Result & { albums?: number }> {
  const unique = [...new Set(ids)];
  if (!unique.length) return refused('Choose what to delete.');
  const uses = unique.map((id) => usesOf(index, id));
  const verdict = deleteVerdict(uses.map((u) => ({ albums: u.albums.map((a) => a.title), articles: u.articles.map((a) => a.title) })));
  if (!verdict.ok) return refused(verdict.why);
  const changes: Change[] = [];
  const ifMatch: Record<string, string | null> = {};
  for (const id of unique) {
    const d = deletionOf(id);
    if (!('changes' in d)) return d;
    changes.push(...d.changes);
    Object.assign(ifMatch, d.ifMatch);
  }
  const gone = new Set(unique);
  const touched = new Set(uses.flatMap((u) => u.albums.map((a) => a.id)));
  for (const albumId of touched) {
    const key = albumKey(albumId);
    const doc = readDoc<Album>(key);
    if (!doc) continue;
    const items = doc.value.items.filter((i) => 'media' in i && gone.has(i.media)).map((i) => i.id);
    changes.push({ key, bytes: jsonBytes(removeItems(doc.value, items)) });
    ifMatch[key] = doc.version;
  }
  const res = await commit({ changes, ifMatch });
  return res.ok ? { ...res, albums: touched.size } : res;
}
