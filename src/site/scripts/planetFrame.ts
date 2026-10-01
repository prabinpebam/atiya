/**
 * A page read on the planet, in the game's reading overlay (documentation/sections/spec.md §6): it tells
 * the game where it is (planet:ready), asks to close (planet:close) on Space, Esc or Close, keeps every move
 * inside its building (replacing the page, so the history doesn't grow), and says where a link to another
 * building leads instead of going there. Opened on its own, it goes into the game at the same place.
 * Messages go to this origin only, and only the game's own are heard (§6.9).
 */
import { sortLink, type FrameMap } from './frameLinks';

const FROM = 'planet-frame';
const GAME = 'planet-game';

/** Keys that belong to what has the focus: typing in a field, a switch or a slider, a list that's open. */
const OWNS_SPACE = 'input, textarea, select, [contenteditable], [role="combobox"], [role="listbox"], [role="slider"], [role="switch"], [role="checkbox"], [role="radio"]';

export function initFrame(bar: HTMLElement, signal: AbortSignal) {
  // only on a page in the planet's frame (the design library shows the bar as a sample, and it stays still)
  if (document.documentElement.dataset.frame !== 'planet') return;
  const here = bar.dataset.place!;
  const page = bar.dataset.page || null;
  const base = import.meta.env.BASE_URL.replace(/\/+$/, '');

  // alone in a tab: into the game, at this building (and this page)
  if (window.top === window) {
    location.replace(`${base}/play/?at=${encodeURIComponent(here)}&open=1${page ? `&page=${encodeURIComponent(page)}` : ''}`);
    return;
  }

  const map = JSON.parse(bar.querySelector('[data-frame-map]')?.textContent ?? '{}') as FrameMap;
  const post = (m: Record<string, unknown>) => window.parent.postMessage({ source: FROM, ...m }, location.origin);
  const heading = document.querySelector<HTMLElement>('main h1');
  if (heading) heading.tabIndex = -1;
  const theme = document.documentElement.dataset.theme;
  const scheme = theme === 'light' || theme === 'dark' ? theme : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

  // the game focuses the frame, then asks for the heading (a document can't take the focus from its parent)
  window.addEventListener(
    'message',
    (e) => {
      if (e.origin !== location.origin || e.source !== window.parent) return;
      const m = e.data as { source?: string; type?: string };
      if (m?.source === GAME && m.type === 'planet:focus') heading?.focus({ preventScroll: true });
    },
    { signal },
  );
  post({
    type: 'planet:ready',
    place: here,
    page,
    title: document.title,
    heading: heading?.textContent?.trim() ?? '',
    scheme,
    index: bar.dataset.index ? Number(bar.dataset.index) : null,
    count: bar.dataset.count ? Number(bar.dataset.count) : null,
  });

  // back to the planet: Close, Space or Esc (the game's rule: Space goes back), unless something here takes the key first
  const close = () => post({ type: 'planet:close', place: here });
  bar.querySelector('[data-frame-close]')?.addEventListener(
    'click',
    (e) => {
      e.preventDefault();
      close();
    },
    { signal },
  );
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key !== ' ' && e.key !== 'Escape') return;
      // a picture's lightbox (a dialog of the page's own) goes back first
      if (document.querySelector('dialog[open]')) return;
      if (e.key === ' ' && (e.target as Element | null)?.closest?.(OWNS_SPACE)) return;
      e.preventDefault();
      close();
    },
    { signal },
  );

  // "Open classic page" leaves the game for the site
  bar.querySelectorAll<HTMLAnchorElement>('[data-frame-top]').forEach((a) => (a.target = '_top'));

  // where a link leads: within the building (changing the page in place, so the history doesn't grow), a
  // note for another building, a new tab for the rest. The page doesn't reload: the site's router swaps it
  // (PageShell's `router`, on in the frame), so a move inside the building is seamless, with no blank
  // frame between pages. Each link is sorted as it's clicked (capture, before the router hears it): one
  // that stays is the router's, replacing this page; any other the router leaves to the handler below.
  const sorted = (a: HTMLAnchorElement) => sortLink(a.href, { origin: location.origin, base, here, current: location.pathname + location.search, map });
  window.addEventListener(
    'click',
    (e) => {
      const a = (e.target as Element | null)?.closest?.<HTMLAnchorElement>('a[href]');
      if (!a || a.target === '_top' || a.target === '_blank' || a.hasAttribute('download')) return;
      if (sorted(a).kind === 'stay') {
        a.dataset.astroHistory = 'replace';
        delete a.dataset.astroReload;
      } else a.dataset.astroReload = '';
    },
    { signal, capture: true },
  );
  const note = bar.querySelector<HTMLElement>('[data-frame-note]');
  let hide = 0;
  const say = (title: string, siteHref: string) => {
    if (!note) return;
    const out = document.createElement('a');
    out.href = siteHref;
    out.target = '_top';
    out.textContent = 'Open classic page';
    note.replaceChildren(`That’s in the ${title}. Walk there to read it. `, out);
    note.hidden = false;
    clearTimeout(hide);
    hide = window.setTimeout(() => (note.hidden = true), 8000);
  };
  // on the window, so a component's own handler (the lightbox, the video) and the router have their say first
  window.addEventListener(
    'click',
    (e) => {
      const a = (e.target as Element | null)?.closest?.<HTMLAnchorElement>('a[href]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target === '_top' || a.target === '_blank' || a.hasAttribute('download') || a.closest('[data-frame-note]')) return;
      const move = sorted(a);
      if (move.kind === 'anchor') return;
      e.preventDefault();
      // (the router changes a page that stays; this is the way when it can't)
      if (move.kind === 'stay') location.replace(move.href);
      else if (move.kind === 'elsewhere') say(move.title, move.siteHref);
      else window.open(move.href, '_blank', 'noopener');
    },
    { signal },
  );
}
