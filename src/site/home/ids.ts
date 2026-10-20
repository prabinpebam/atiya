/**
 * The home page's names (documentation/home-views/README.md): its views and its goals. Dependency-free, so the ways
 * file's contract (src/site/modes/contract.ts) can name the views without reading the home's own schema.
 */

/** The home page's views. Classic is the home hub as it was, always there and the fallback. */
export const VIEW_IDS = ['classic', 'bento', 'cover', 'spotlight', 'showreel', 'keywords', 'proof-grid', 'questions'] as const;
export type ViewId = (typeof VIEW_IDS)[number];

/** What the site is for (documentation/home-views/for-every-site.md §2): it sets the home page's defaults. */
export const GOALS = ['hired', 'clients', 'share'] as const;
export type Goal = (typeof GOALS)[number];
