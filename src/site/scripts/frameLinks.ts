/**
 * Where a link in a page read on the planet may lead (documentation/sections/spec.md §6.4): a building's
 * pages lead only to each other, so finding another section means walking to its building. Pure, so the
 * rules are unit-tested; the frame's script (planetFrame.ts) acts on them.
 */

/** A page on the planet, by its address on the site: its building, the building's name, and its address in the frame. */
export type FrameMap = Record<string, { place: string; title: string; href: string }>;

export type LinkMove =
  /** In this building: open it in the frame, replacing this page (no history entry). */
  | { kind: 'stay'; href: string }
  /** In another building: don't go; say where it is. */
  | { kind: 'elsewhere'; place: string; title: string; siteHref: string }
  /** A page of the site that's not on the planet, the docs, anywhere else: a new tab. */
  | { kind: 'away'; href: string }
  /** A jump within this page. */
  | { kind: 'anchor' };

export interface FrameContext {
  /** The page's origin (only same-origin links can be in a building). */
  origin: string;
  /** The site's base path, without its trailing slash ('' locally, '/atiya' on GitHub Pages). */
  base: string;
  /** This building's ID. */
  here: string;
  /** The page's own address (path and query), for a jump within it. */
  current: string;
  map: FrameMap;
}

export function sortLink(href: string, ctx: FrameContext): LinkMove {
  let url: URL;
  try {
    url = new URL(href, ctx.origin + ctx.current);
  } catch {
    return { kind: 'away', href };
  }
  if (url.origin !== ctx.origin) return { kind: 'away', href: url.href };
  const path = url.pathname;
  if (url.hash && path + url.search === ctx.current) return { kind: 'anchor' };
  // the frame's own routes: this building's, or another's
  const framed = new RegExp(`^${escape(ctx.base)}/play/([a-z0-9-]+)/`).exec(path);
  if (framed) {
    if (framed[1] === ctx.here) return { kind: 'stay', href: path + url.search + url.hash };
    const other = Object.entries(ctx.map).find(([, v]) => v.place === framed[1]);
    return { kind: 'elsewhere', place: framed[1], title: other?.[1].title ?? framed[1], siteHref: other?.[0] ?? `${ctx.base}/` };
  }
  // a page of the site: in this building, in another, or not on the planet
  const entry = ctx.map[path];
  if (entry) return entry.place === ctx.here ? { kind: 'stay', href: entry.href + url.hash } : { kind: 'elsewhere', place: entry.place, title: entry.title, siteHref: path };
  return { kind: 'away', href: url.href };
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
