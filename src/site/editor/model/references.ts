/**
 * Who uses what (documentation/editor/spec.md §6): the reference graph from every document to the
 * pictures it uses (articles in any state, people and the site settings), and a picture's folder in
 * words. Pure: built from the content index, so the Media screen's Used in and its Delete rule, and the
 * unit tests, read the same graph.
 */
import { mediaUsed, videosUsed, type ContentIndex } from '../../content/load';

export interface Reference {
  /** What refers to it, in words ("Article: …", "Person: …", "Site settings"). */
  label: string;
  /** Where to change that, in edit mode (from the editor's root). */
  href: string;
}

/** Every document that refers to each picture, keyed by media ID. */
export function references(index: Pick<ContentIndex, 'articles' | 'people' | 'site'>): Map<string, Reference[]> {
  const refs = new Map<string, Reference[]>();
  const add = (mediaId: string, r: Reference) => {
    const list = refs.get(mediaId) ?? [];
    if (!list.some((x) => x.href === r.href)) list.push(r);
    refs.set(mediaId, list);
  };
  for (const a of index.articles.values()) {
    for (const m of mediaUsed(a)) add(m, { label: `Article: ${a.title}`, href: `articles/${a.id}/` });
    for (const m of videosUsed(a)) add(m, { label: `Article: ${a.title}`, href: `articles/${a.id}/` });
  }
  for (const p of index.people.values()) if (p.avatar) add(p.avatar, { label: `Person: ${p.name}`, href: 'settings/' });
  if (index.site.socialImage) add(index.site.socialImage, { label: 'Site settings', href: 'settings/' });
  return refs;
}

/** A media ID's folder: its ID without the file name (articles/<id>, people/<id>, shared, site). */
export const ownerOf = (mediaId: string) => mediaId.slice(0, mediaId.lastIndexOf('/'));

/** A media folder in words: "Article: Do what makes you proud", "Person: Prabin Pebam", "Shared". */
export function ownerLabel(index: Pick<ContentIndex, 'articles' | 'people'>, owner: string): string {
  const [kind, id] = owner.split('/');
  if (kind === 'articles') return `Article: ${index.articles.get(id)?.title ?? id}`;
  if (kind === 'people') return `Person: ${index.people.get(id)?.name ?? id}`;
  if (kind === 'site') return 'The site';
  if (kind === 'shared') return 'Shared';
  return owner;
}
