// @ts-check
/**
 * The themes panel's dock (documentation/site-ui/theming.md §8, desktop spec §7.2): where the site's view and the
 * docked panel sit in the window, and which addresses mean "open the themes panel". Pure.
 */

/** The panel's width (a little over the site's narrow measure, 24 rem), and the least room the site keeps. */
export const DOCK_WIDTH = 400;
export const SITE_MIN = 480;

/** The dock's own page on the dev server. */
export const DOCK_PATH = '/_edit/theme/?dock';

/**
 * The body (the site) and, when the dock is open, the dock beside it: two cards in the window's content area, the
 * dock on the right, the site keeping at least SITE_MIN (the dock narrows first).
 * @param {{ width: number, height: number }} size the window's content
 * @param {{ margin: number, inset: number, top: number, open: boolean }} o
 */
export function dockLayout(size, o) {
  const x = o.margin + o.inset;
  const y = o.margin + o.top;
  const width = Math.max(0, size.width - 2 * o.margin - 2 * o.inset);
  const height = Math.max(0, size.height - 2 * o.margin - o.top - o.inset);
  if (!o.open) return { body: { x, y, width, height }, dock: null };
  const dock = Math.max(0, Math.min(DOCK_WIDTH, width - o.inset - SITE_MIN));
  const site = Math.max(0, width - dock - o.inset);
  return { body: { x, y, width: site, height }, dock: { x: x + site + o.inset, y, width: dock, height } };
}

/**
 * Is this address edit mode's Theme screen (not the dock's own page)? In the app it opens the dock beside the site.
 * @param {string} url @param {string} devOrigin
 */
export function isThemeScreen(url, devOrigin) {
  try {
    const u = new URL(url);
    return u.origin === devOrigin && /^\/_edit\/theme\/?$/.test(u.pathname) && !u.searchParams.has('dock');
  } catch {
    return false;
  }
}

/** Is this the dock's own page? @param {string} url @param {string} devOrigin */
export function isDockPage(url, devOrigin) {
  try {
    const u = new URL(url);
    return u.origin === devOrigin && /^\/_edit\/theme\/?$/.test(u.pathname) && u.searchParams.has('dock');
  } catch {
    return false;
  }
}
