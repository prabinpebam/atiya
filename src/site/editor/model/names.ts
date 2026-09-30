/**
 * What a changed content file is, in words (documentation/editor/spec.md §7): "Article: Do what makes you
 * proud", "Media: articles/x/cover", "Sections". A picture's master and its sidecar are one resource
 * (they're added, discarded and published together). Pure, for the Publish screen and its tests.
 */
export interface Titles {
  article(id: string): string | undefined;
  person(id: string): string | undefined;
}

const MEDIA = /^\/content\/media\/(.+)\.(json|webp|jpe?g|png|avif)$/;

/** The resource a file belongs to: a picture's master and sidecar share one (/content/media/<id>); any other file is its own. */
export const resourceOf = (key: string) => {
  const m = MEDIA.exec(key);
  return m ? `/content/media/${m[1]}` : key;
};

export function resourceName(key: string, titles: Titles): { kind: string; name: string } {
  let m: RegExpExecArray | null;
  if ((m = /^\/content\/articles\/([^/]+)\.json$/.exec(key))) return { kind: 'Article', name: titles.article(m[1]) ?? m[1] };
  if ((m = /^\/content\/people\/([^/]+)\.json$/.exec(key))) return { kind: 'Person', name: titles.person(m[1]) ?? m[1] };
  if ((m = MEDIA.exec(key)) || (m = /^\/content\/media\/(.+)$/.exec(key))) return { kind: 'Media', name: m[1] };
  if (key === '/content/structures/site.json') return { kind: 'Sections', name: 'The site structure' };
  if (key === '/content/site.json') return { kind: 'Settings', name: 'The site settings' };
  return { kind: 'File', name: key.replace(/^\/content\//, '') };
}

export type Status = 'added' | 'changed' | 'deleted';

export interface ResourceChange {
  /** The resource (resourceOf), its name in words, and its files. */
  resource: string;
  kind: string;
  name: string;
  status: Status;
  keys: string[];
}

/** The changed files as resources, in a stable order: articles, media, then the rest. A resource is added or deleted only when all its files are. */
export function groupChanges(files: { key: string; status: Status }[], titles: Titles): ResourceChange[] {
  const by = new Map<string, ResourceChange>();
  for (const f of files) {
    const resource = resourceOf(f.key);
    const hit = by.get(resource);
    if (hit) {
      hit.keys.push(f.key);
      if (hit.status !== f.status) hit.status = 'changed';
    } else by.set(resource, { resource, ...resourceName(f.key, titles), status: f.status, keys: [f.key] });
  }
  const RANK: Record<string, number> = { Article: 0, Media: 1, Sections: 2, Settings: 3, Person: 4 };
  return [...by.values()].sort((a, b) => (RANK[a.kind] ?? 9) - (RANK[b.kind] ?? 9) || a.name.localeCompare(b.name));
}

/** A commit message made from the changes, naming what changed: "Content: Do what makes you proud, 2 pictures, the sections". */
export function suggestMessage(changes: { key: string }[], titles: Titles): string {
  const articles = new Set<string>();
  const pictures = new Set<string>();
  const rest = new Set<string>();
  for (const c of changes) {
    const r = resourceName(c.key, titles);
    if (r.kind === 'Article') articles.add(r.name);
    else if (r.kind === 'Media') pictures.add(r.name);
    else rest.add(r.kind === 'Sections' ? 'the sections' : r.kind === 'Settings' ? 'the site settings' : r.kind === 'Person' ? `${r.name}'s profile` : r.name);
  }
  const parts = [...articles];
  if (pictures.size) parts.push(`${pictures.size} picture${pictures.size === 1 ? '' : 's'}`);
  parts.push(...rest);
  const shown = parts.slice(0, 3);
  const more = parts.length - shown.length;
  return `Content: ${shown.join(', ') || 'updates'}${more ? ` and ${more} more` : ''}`;
}

/** The GitHub Actions page for a remote's address (https or ssh), where the deploy can be followed; null for any other host. */
export function actionsUrl(remote: string): string | null {
  const m = /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(remote.trim());
  return m ? `https://github.com/${m[1]}/${m[2]}/actions` : null;
}
