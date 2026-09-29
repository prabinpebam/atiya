/**
 * Running a component's script on every page (tier 0; docs: documentation/site-ui/design-system.md §4).
 *
 * The design library moves between pages without reloading (Astro's client-side router), so a bundled
 * script, which runs once, must also set up the elements of each page swapped in. `each` does that:
 * it runs `init` once for every element matching `selector`, now and after every page swap
 * (`astro:page-load`), and never twice for the same element. On pages without the router it simply
 * runs once.
 *
 * `init` gets a signal that aborts when its element has left the page after a swap: pass it to every
 * listener on `window`, `document` or a media query, so a swapped-out component stops listening.
 */
export function onEveryPage(fn: () => void): void {
  fn();
  document.addEventListener('astro:page-load', fn);
}

const live = new Map<Element, AbortController>();
let watching = false;

export function each<T extends Element = HTMLElement>(selector: string, init: (el: T, signal: AbortSignal) => void): void {
  const seen = new WeakSet<Element>();
  if (!watching) {
    watching = true;
    document.addEventListener('astro:after-swap', () =>
      live.forEach((ac, el) => {
        if (el.isConnected) return;
        ac.abort();
        live.delete(el);
      }),
    );
  }
  onEveryPage(() =>
    document.querySelectorAll<T>(selector).forEach((el) => {
      if (seen.has(el)) return;
      seen.add(el);
      let ac = live.get(el);
      if (!ac) live.set(el, (ac = new AbortController()));
      init(el, ac.signal);
    }),
  );
}
