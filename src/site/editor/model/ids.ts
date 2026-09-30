/**
 * IDs, slugs and dates for new content (documentation/editor/spec.md §9). Pure: the server uses them
 * when it creates or duplicates an article, and the unit tests pin them down.
 */

/** A slug from a title: lowercase, accents dropped, hyphens between words, at most 60 characters. */
export function slugify(title: string): string {
  const s = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return s || 'untitled';
}

/** `base`, or `base-2`, `base-3`… whichever isn't taken. */
export function unique(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

/** Today in the owner's local time zone, as the content model writes dates (2026-09-30). */
export function today(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}
