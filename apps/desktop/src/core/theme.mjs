// @ts-check
/**
 * One colour theme for the whole app (documentation/desktop/spec.md §7.2, plan stage 7D): the title bar's choice sets
 * Electron's `nativeTheme`, which every view follows (the frame, the app's pages, edit mode and the site), and is written
 * into the site's own theme storage on the dev server's origin (`site.theme`, src/site/scripts/theme.ts), so the site and
 * edit mode paint in it from their first frame and never choose on their own. Pure.
 */

/** @typedef {'system' | 'light' | 'dark'} Theme */
/** @type {readonly Theme[]} */
export const THEMES = ['system', 'light', 'dark'];
export const THEME_LABEL = /** @type {const} */ ({ system: 'Match the system', light: 'Light', dark: 'Dark' });
/** The site's icons for each (its icon set's names). */
export const THEME_ICON = /** @type {const} */ ({ system: 'theme-system', light: 'theme-light', dark: 'theme-dark' });

/** @param {unknown} v @returns {Theme} */
export const parseTheme = (v) => (v === 'light' || v === 'dark' ? v : 'system');

/**
 * The script the app runs in a page of the site's dev server to make it follow the app's theme: the stored choice the
 * site reads before its first paint, the page's own `data-theme`, and the site's theme event (its pictures and any
 * switch follow it). Other frames of the origin (edit mode's canvas) follow through the storage event.
 * @param {unknown} theme
 */
export function siteThemeScript(theme) {
  const t = parseTheme(theme);
  return `(() => {
  const t = ${JSON.stringify(t)};
  const r = document.documentElement;
  try { if (t === 'system') localStorage.removeItem('site.theme'); else localStorage.setItem('site.theme', t); } catch {}
  if (t === 'system') delete r.dataset.theme; else r.dataset.theme = t;
  document.dispatchEvent(new Event('site:theme'));
})();`;
}
