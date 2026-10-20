/**
 * The bento's DOM wiring (tier 0; docs: documentation/home-views/bento.md §5): a tile's toggle opens its
 * drawer (one at a time), Close and Esc shut it and put the keyboard back on the tile, the phone's index
 * jumps to a tile, and an address with `#cap-<id>` opens that strength. Bento.astro's script runs it on each
 * bento through `each`; the address rule is pure (`capabilityFromHash`) and unit-tested.
 */

/** The strength an address names (`#cap-<id>`), or null. */
export function capabilityFromHash(hash: string): string | null {
  let text = hash;
  try {
    text = decodeURIComponent(hash);
  } catch {
    // a malformed escape: read it as written
  }
  return /^#cap-(.+)$/.exec(text)?.[1] ?? null;
}

export function setupBento(root: HTMLElement, signal: AbortSignal): void {
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
