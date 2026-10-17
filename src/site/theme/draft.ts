/**
 * Live theme drafts (documentation/site-ui/theming.md §7): the themes panel writes its draft to the site origin's
 * localStorage, and every site page in dev applies it before its first paint and follows it as it changes, so the
 * person can browse the whole site while trying a theme. Never in a build: edit mode injects the script.
 */

/** Where the panel keeps its draft: `{ css, at }`. */
export const DRAFT_KEY = 'atiya.themeDraft';
/** The panel refreshes `at` this often while it's open. */
export const HEARTBEAT_MS = 4000;
/** A draft whose panel stopped refreshing it (closed, crashed) is ignored after this. */
export const STALE_MS = 15000;

/** A draft's CSS: the theme's, made to outrank a saved theme on the page, and the light or dark page if chosen. */
export function draftCss(css: string, scheme: 'light' | 'dark' | null): string {
  const raised = css.replace(/:root:root\b/g, ':root:root:root');
  return scheme ? `${raised}\n:root:root:root { color-scheme: ${scheme}; }` : raised;
}

/** Whether a path (after the base) is a site page a draft applies to: not edit mode, the design library, the docs or the game itself. */
export const takesDraft = (path: string): boolean => !/^\/(_edit|design|docs)(\/|$)/.test(path) && !/^\/play\/?$/.test(path);

/**
 * The script every page gets in its head (inline, so it runs before the first paint): applies a fresh draft, follows
 * the panel's changes (the storage event) and drops a stale one.
 */
export function draftScript(base: string): string {
  const b = JSON.stringify(base.replace(/\/$/, ''));
  return `(() => {
  var KEY = ${JSON.stringify(DRAFT_KEY)}, STALE = ${STALE_MS}, base = ${b};
  var path = location.pathname.indexOf(base) === 0 ? location.pathname.slice(base.length) || '/' : location.pathname;
  if (/^\\/(_edit|design|docs)(\\/|$)/.test(path) || /^\\/play\\/?$/.test(path)) return;
  var el = null;
  function read() {
    try {
      var d = JSON.parse(localStorage.getItem(KEY) || 'null');
      return d && typeof d.css === 'string' && Date.now() - d.at < STALE ? d.css : null;
    } catch (e) { return null; }
  }
  function apply() {
    var css = read();
    if (css === null) { if (el) { el.remove(); el = null; } return; }
    if (!el) { el = document.createElement('style'); el.setAttribute('data-site-theme-draft', ''); (document.head || document.documentElement).appendChild(el); }
    if (el.textContent !== css) el.textContent = css;
  }
  apply();
  addEventListener('storage', function (e) { if (e.key === KEY || e.key === null) apply(); });
  setInterval(apply, ${Math.round(STALE_MS / 3)});
})();`;
}
