/**
 * What a changed content file is, in words (documentation/editor/spec.md §7): "Article: Do what makes you
 * proud", "Media: articles/x/cover", "Sections". A picture's master, dark version, animation posters and sidecar are
 * one resource (they're added, discarded and published together). Pure, for the Publish screen and its tests.
 */
export interface Titles {
  article(id: string): string | undefined;
  person(id: string): string | undefined;
}

const MEDIA = /^\/(content|private)\/media\/(.+?)(?:\.dark(?:\.poster)?|\.poster)?\.(json|webp|jpe?g|png|avif|gif|pdf|mp4|webm)$/;

/** The resource a file belongs to: a picture's master, versions, posters and sidecar share one (/content/media/<id>); any other file is its own. */
export const resourceOf = (key: string) => {
  const m = MEDIA.exec(key);
  return m ? `/${m[1]}/media/${m[2]}` : key;
};

export function resourceName(key: string, titles: Titles): { kind: string; name: string } {
  let m: RegExpExecArray | null;
  if ((m = /^\/content\/articles\/([^/]+)\.json$/.exec(key))) return { kind: 'Article', name: titles.article(m[1]) ?? m[1] };
  if ((m = /^\/content\/people\/([^/]+)\.json$/.exec(key))) return { kind: 'Person', name: titles.person(m[1]) ?? m[1] };
  if ((m = /^\/private\/articles\/([^/]+)\.json$/.exec(key))) return { kind: 'Private page', name: titles.article(m[1]) ?? m[1] };
  if ((m = MEDIA.exec(key))) return { kind: m[1] === 'private' ? 'Private media' : 'Media', name: m[2] };
  if ((m = /^\/content\/media\/(.+)$/.exec(key))) return { kind: 'Media', name: m[1] };
  if (key === '/private/access.json') return { kind: 'Sharing', name: 'The access codes and magic links' };
  if (key === '/private/access-message.json') return { kind: 'Sharing', name: 'The share message' };
  if (key === '/private/structures/overlay.json') return { kind: 'Private places', name: 'Where private pages are listed' };
  if (key === '/content/structures/site.json') return { kind: 'Sections', name: 'The site structure' };
  if (key === '/content/structures/planet.json') return { kind: 'Planet', name: 'The planet' };
  if (key === '/content/redirects.json') return { kind: 'Redirects', name: 'The redirects' };
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
  const RANK: Record<string, number> = { Article: 0, 'Private page': 1, Media: 2, 'Private media': 3, Sections: 4, 'Private places': 5, Sharing: 6, Planet: 7, Settings: 8, Person: 9 };
  return [...by.values()].sort((a, b) => (RANK[a.kind] ?? 9) - (RANK[b.kind] ?? 9) || a.name.localeCompare(b.name));
}

/** A commit message made from the changes, naming what changed: "Content: Do what makes you proud, 2 pictures, the sections". */
export function suggestMessage(all: { key: string }[], titles: Titles): string {
  // made from public changes only: a private page's name never goes in public history (documentation/access/spec.md §8.3)
  const changes = all.filter((c) => !c.key.startsWith('/private/'));
  const articles = new Set<string>();
  const pictures = new Set<string>();
  const rest = new Set<string>();
  for (const c of changes) {
    const r = resourceName(c.key, titles);
    if (r.kind === 'Article') articles.add(r.name);
    else if (r.kind === 'Media') pictures.add(r.name);
    else rest.add(r.kind === 'Sections' ? 'the sections' : r.kind === 'Planet' ? 'the planet' : r.kind === 'Settings' ? 'the site settings' : r.kind === 'Person' ? `${r.name}'s profile` : r.name);
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
