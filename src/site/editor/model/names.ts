/**
 * What a changed content file is, in words (documentation/editor/spec.md §7): "Article: Do what makes you
 * proud", "Media: articles/x/cover", "Sections". Pure, for the Publish screen and its tests.
 */
export interface Titles {
  article(id: string): string | undefined;
  person(id: string): string | undefined;
}

export function resourceName(key: string, titles: Titles): { kind: string; name: string } {
  let m: RegExpExecArray | null;
  if ((m = /^\/content\/articles\/([^/]+)\.json$/.exec(key))) return { kind: 'Article', name: titles.article(m[1]) ?? m[1] };
  if ((m = /^\/content\/people\/([^/]+)\.json$/.exec(key))) return { kind: 'Person', name: titles.person(m[1]) ?? m[1] };
  if ((m = /^\/content\/media\/(.+)\.(json|webp|jpe?g|png|avif)$/.exec(key))) return { kind: m[2] === 'json' ? 'Picture details' : 'Picture', name: m[1] };
  if (key === '/content/structures/site.json') return { kind: 'Sections', name: 'The site structure' };
  if (key === '/content/site.json') return { kind: 'Settings', name: 'The site settings' };
  return { kind: 'File', name: key.replace(/^\/content\//, '') };
}

/** A commit message made from the changes: "Content: Do what makes you proud, 2 pictures". */
export function suggestMessage(changes: { key: string }[], titles: Titles): string {
  const articles = new Set<string>();
  let pictures = 0;
  let other = 0;
  for (const c of changes) {
    const r = resourceName(c.key, titles);
    if (r.kind === 'Article') articles.add(r.name);
    else if (r.kind === 'Picture') pictures++;
    else if (r.kind !== 'Picture details') other++;
  }
  const parts = [...articles];
  if (pictures) parts.push(`${pictures} picture${pictures === 1 ? '' : 's'}`);
  if (other && !parts.length) parts.push('site content');
  return `Content: ${parts.join(', ') || 'updates'}`;
}
