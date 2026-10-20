/**
 * The classic hub's ways in (documentation/sections/spec.md §3.5; desktop/modes.md §4.6): `?mode=play` goes
 * to the planet and `?mode=classic` down to the sections, each remembered as the visitor's way in; the way
 * they went last is the primary action. Only at the site's root: the hub at `/views/classic/` is the same
 * page shown at its own address, so it never moves the visitor.
 */

/**
 * Makes the way the visitor went last the primary action (the site, when there's no planet), as an inline
 * script right after the ways in: it runs before the first paint, so the buttons never change colour in view.
 */
export const HUB_WAYS = `(() => {
  let last = null;
  try { last = localStorage.getItem('site.mode'); } catch {}
  if (document.documentElement.getAttribute('data-home-at') !== 'view' && new URLSearchParams(location.search).get('mode') === 'classic') last = 'classic';
  const ways = [...document.querySelectorAll('main a[data-mode]')].filter((a) => !a.closest('[data-view-choices]'));
  const primary = last === 'classic' || !ways.some((a) => a.getAttribute('data-mode') === 'play') ? 'classic' : 'play';
  for (const a of ways) a.setAttribute('data-variant', a.getAttribute('data-mode') === primary ? 'primary' : 'secondary');
})();`;

const store = (m: string) => {
  try {
    localStorage.setItem('site.mode', m);
  } catch {}
};

/** The hub's main region. */
export function setupHub(main: HTMLElement) {
  const atRoot = document.documentElement.dataset.homeAt !== 'view';
  const mode = new URLSearchParams(location.search).get('mode');
  // (the base path: `/atiya` on GitHub Pages)
  const base = import.meta.env.BASE_URL.replace(/\/+$/, '');
  if (atRoot && mode === 'play') {
    store(mode);
    location.replace(base + '/play/');
  } else if (atRoot && mode === 'classic') {
    // the site is this page: stay, and go down to its sections
    store(mode);
    history.replaceState(null, '', base + '/#sections');
    document.getElementById('sections')?.scrollIntoView();
  }
  // (which of them is primary was settled before the first paint: HUB_WAYS)
  main.querySelectorAll<HTMLAnchorElement>('a[data-mode]').forEach((a) => {
    if (!a.closest('[data-view-choices]')) a.addEventListener('click', () => store(a.dataset.mode!));
  });
}
