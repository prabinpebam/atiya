/**
 * The bento's DOM wiring (tier 0; docs: documentation/home-views/bento.md §5): a tile's toggle opens its
 * drawer (one at a time), Close and Esc shut it and put the keyboard back on the tile, the phone's index
 * jumps to a tile, and an address with `#cap-<id>` opens that strength. Bento.astro's script runs it on each
 * bento through `each`; the address rule is pure (`capabilityFromHash`, scripts/homeAddress.ts) and unit-tested.
 * Opening a drawer tells telemetry (`capability_l3_open`, kind `all`).
 */
import { capabilityFromHash } from './homeAddress';
import { edgeScale, lengthPx } from './liftRules';
import { track } from './telemetry';

/**
 * Each tile's rise and press as its own scale (scripts/liftRules.ts), kept up to date as it changes size, so
 * every tile's edges move by `c.bento.lift` (and in by `c.bento.press`, both handed over by the stylesheet as
 * `--bento-lift-by` and `--bento-press-by`) whatever its size; the stylesheet falls back to the shared scale
 * tokens until this has run.
 */
function liftTiles(root: HTMLElement, signal: AbortSignal): void {
  const measure = (tile: HTMLElement) => {
    const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const style = getComputedStyle(tile);
    const lift = lengthPx(style.getPropertyValue('--bento-lift-by'), rootPx);
    const press = lengthPx(style.getPropertyValue('--bento-press-by'), rootPx);
    const rise = lift === null ? null : edgeScale(tile.offsetWidth, tile.offsetHeight, lift);
    const sink = press === null ? null : edgeScale(tile.offsetWidth, tile.offsetHeight, -press);
    if (rise) tile.style.setProperty('--bento-lift', rise);
    else tile.style.removeProperty('--bento-lift');
    if (sink) tile.style.setProperty('--bento-press', sink);
    else tile.style.removeProperty('--bento-press');
  };
  const tiles = root.querySelectorAll<HTMLElement>('article[data-capability]');
  const sizes = new ResizeObserver((entries) => entries.forEach((e) => measure(e.target as HTMLElement)));
  tiles.forEach((t) => sizes.observe(t));
  signal.addEventListener('abort', () => sizes.disconnect(), { once: true });
}

export function setupBento(root: HTMLElement, signal: AbortSignal): void {
  liftTiles(root, signal);
  const toggles = [...root.querySelectorAll<HTMLButtonElement>('[data-bento-toggle]')];
  const drawerOf = (id: string) => root.querySelector<HTMLElement>(`[data-bento-drawer="${CSS.escape(id)}"]`);
  const tileOf = (id: string) => root.querySelector<HTMLElement>(`#cap-${CSS.escape(id)}`);
  const toggleOf = (id: string) => toggles.find((t) => t.dataset.bentoToggle === id);
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const behavior = (): ScrollBehavior => (still.matches ? 'auto' : 'smooth');
  const address = (hash: string) => history.replaceState(history.state, '', `${location.pathname}${location.search}${hash}`);

  const close = (id: string, focus: boolean) => {
    const toggle = toggleOf(id);
    const drawer = drawerOf(id);
    if (!toggle || !drawer || drawer.hidden) return;
    drawer.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    if (location.hash === `#cap-${id}`) address('');
    if (focus) toggle.focus();
  };
  const open = (id: string, scroll: 'tile' | 'drawer') => {
    const toggle = toggleOf(id);
    const drawer = drawerOf(id);
    if (!toggle || !drawer) return;
    for (const t of toggles) if (t !== toggle) close(t.dataset.bentoToggle!, false);
    drawer.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    address(`#cap-${id}`);
    track('capability_l3_open', { id, view: 'bento', kind: 'all' });
    if (scroll === 'tile') tileOf(id)?.scrollIntoView({ block: 'start', behavior: behavior() });
    // only if it would be out of view: a drawer that fits stays where it opened
    else if (drawer.getBoundingClientRect().bottom > innerHeight) drawer.scrollIntoView({ block: 'nearest', behavior: behavior() });
  };

  for (const toggle of toggles) {
    const id = toggle.dataset.bentoToggle!;
    toggle.addEventListener('click', () => (toggle.getAttribute('aria-expanded') === 'true' ? close(id, false) : open(id, 'drawer')));
  }
  root.addEventListener('click', (e) => {
    const button = (e.target as Element).closest<HTMLElement>('[data-bento-close]');
    if (button) close(button.dataset.bentoClose!, true);
    const jump = (e.target as Element).closest<HTMLAnchorElement>('[data-bento-jump]');
    if (!jump) return;
    // the index jumps to a tile and puts the keyboard on it, without opening it
    e.preventDefault();
    const id = jump.dataset.bentoJump!;
    tileOf(id)?.scrollIntoView({ block: 'start', behavior: behavior() });
    toggleOf(id)?.focus({ preventScroll: true });
  });
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const inside = (e.target as Element).closest<HTMLElement>('[data-bento-drawer], [data-bento-toggle]');
    const id = inside?.dataset.bentoDrawer ?? inside?.dataset.bentoToggle;
    if (id && !drawerOf(id)?.hidden) {
      e.preventDefault();
      close(id, true);
    }
  });

  // an address with #cap-<id> opens that tile's drawer (a link a colleague forwarded, a return visit)
  const fromAddress = () => {
    const id = capabilityFromHash(location.hash);
    if (id && toggleOf(id)) open(id, 'tile');
  };
  fromAddress();
  window.addEventListener('hashchange', fromAddress, { signal });
}
