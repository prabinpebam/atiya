/**
 * Which changes a save to remote takes (documentation/editor/spec.md §7.1): every change waiting, or only
 * the ones ticked. Pure, for the Save to remote screen's script and the server.
 */
import { suggestMessage, type Titles } from './names';

/** A changed resource on the screen: its name in words and its files. */
export interface PickedRow {
  name: string;
  keys: string[];
}

/** The files a save takes: every one when nothing was chosen, else those the chosen keys name (a key no longer changed is left out). */
export function chosenFiles<T extends { key: string }>(files: T[], keys?: readonly string[] | null): T[] {
  if (!keys) return files;
  const wanted = new Set(keys);
  return files.filter((f) => wanted.has(f.key));
}

/**
 * The changes that are one page's (spec §7.1): its file in either folder (a page made private has a row in
 * each) and the media uploaded to it. Save to remote opened from that page ticks only these.
 */
export function pageScope(resources: readonly string[], id: string): string[] {
  const files = [`/content/articles/${id}.json`, `/private/articles/${id}.json`];
  const media = [`/content/media/articles/${id}/`, `/private/media/articles/${id}/`];
  return resources.filter((r) => files.includes(r) || media.some((folder) => r.startsWith(folder)));
}

/** The page an edit mode address is the editor of (/_edit/articles/<id>/), or null. */
export const pageOf = (path: string): string | null => /\/_edit\/articles\/([^/]+)\/?$/.exec(path)?.[1] ?? null;

/** What happens to the message when private pages are in the save (documentation/access/spec.md §8.3), or null. */
export function privateNote(keys: readonly string[]): string | null {
  if (!keys.some((k) => k.startsWith('/private/'))) return null;
  return keys.some((k) => k.startsWith('/content/'))
    ? 'Private pages changed too: this message goes on the private commit only. The public commit gets one made from the public changes.'
    : 'Only private pages changed: this message goes on the private commit only. The public commit is "Private pages: update".';
}

/** Titles read from the rows themselves: an article's and a person's row are named by their title. */
export function titlesOf(rows: readonly PickedRow[]): Titles {
  const named = (key: string) => rows.find((r) => r.keys.includes(key))?.name;
  return {
    article: (id) => named(`/content/articles/${id}.json`) ?? named(`/private/articles/${id}.json`),
    person: (id) => named(`/content/people/${id}.json`),
  };
}

/** The message offered for the ticked rows (none: nothing to offer). */
export function messageFor(rows: readonly PickedRow[]): string {
  const keys = rows.flatMap((r) => r.keys);
  return keys.length ? suggestMessage(keys.map((key) => ({ key })), titlesOf(rows)) : '';
}

/**
 * The submit button's words: Save to remote for everything (or none), and the count when only some are
 * ticked. A save never publishes a page: that's the page's own Publish (its Status).
 */
export function saveLabel(picked: number, total: number): string {
  if (picked >= total || picked === 0) return 'Save to remote';
  return `Save ${picked} of ${total} to remote`;
}
