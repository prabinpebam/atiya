/**
 * Live content in dev (documentation/engineering/performance-report.md R10): which changes a page of the
 * site shows. Tier 0, pure: PageShell asks it (dev only, loaded on the first change) whether to reload,
 * and edit mode's live rules use the same reading of a content key.
 */

/** An article's own file (its document, or a file in its media folder): its id, else null. */
export function articleOf(key: string): string | null {
  const m = /^\/(?:content|private)\/(?:articles\/([a-z0-9-]+)\.json|media\/articles\/([a-z0-9-]+)\/)/.exec(key);
  return m ? (m[1] ?? m[2]) : null;
}

/**
 * Whether a page that shows the articles `shows` (null: it can't say, so it always does) reloads for a
 * change: not when every changed file is another article's own.
 */
export function pageShows(shows: string[] | null, files: string[]): boolean {
  if (!shows || !files.length) return true;
  const mine = new Set(shows);
  return files.some((f) => {
    const id = articleOf(f);
    return id === null || mine.has(id);
  });
}
