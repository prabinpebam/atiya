/**
 * The site's base path (`/` locally; `/atiya` on GitHub Pages, where the site lives under the
 * repository's name): every root-relative link and asset URL goes through `withBase`.
 */
const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/+$/, '');

/** `/play/` → `/atiya/play/` on GitHub Pages (unchanged locally). Leaves full and relative URLs alone. */
export function withBase(path: string): string {
  return path.startsWith('/') && !path.startsWith('//') ? BASE + path : path;
}
