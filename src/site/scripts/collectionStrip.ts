/**
 * A collection strip's DOM wiring (tier 0; docs: documentation/site-ui/design-system.md §2): the carousel's
 * and the sideways timeline's Previous and Next, and a peek's room. Collection.astro's script runs it on
 * each strip through `each`; the rules are pure in `collection.ts` and `media.ts`, and unit-tested.
 */
import { stripState, stripStep } from './collection';
import { bleed } from './media';
import { media } from '../design/responsive';

/**
 * A strip's Previous and Next scroll it by a view (the column's width, whatever a peek reaches), and are
 * disabled at its ends; with nothing to scroll (everything in view) they're hidden, and the list leaves the
 * tab order.
 */
export function setupCollectionStrip(root: HTMLElement, signal: AbortSignal): void {
  const track = root.querySelector<HTMLElement>('[data-collection-track]');
  const controls = root.querySelector<HTMLElement>('.controls');
  const prev = root.querySelector<HTMLButtonElement>('[data-collection-prev]');
  const next = root.querySelector<HTMLButtonElement>('[data-collection-next]');
  if (!track || !controls || !prev || !next) return;
  const rtl = () => getComputedStyle(track).direction === 'rtl';
  const update = () => {
    const { scrolls, atStart, atEnd } = stripState(track.scrollLeft, track.scrollWidth, track.clientWidth);
    controls.hidden = !scrolls;
    if (scrolls) track.tabIndex = 0;
    else track.removeAttribute('tabindex');
    prev.disabled = atStart;
    next.disabled = atEnd;
  };
  prev.addEventListener('click', () => track.scrollBy({ left: stripStep(-1, root.clientWidth, rtl()) }), { signal });
  next.addEventListener('click', () => track.scrollBy({ left: stripStep(1, root.clientWidth, rtl()) }), { signal });
  track.addEventListener('scroll', update, { signal, passive: true });
  window.addEventListener('resize', update, { signal });
  // the strip's width, and so whether it scrolls, changes with the page as well as the window
  const sized = new ResizeObserver(update);
  sized.observe(track);
  signal.addEventListener('abort', () => sized.disconnect());

  if (root.hasAttribute('data-peek')) {
    const narrow = matchMedia(media('sm'));
    // the room beside the strip, up to its bounds (and the viewport), and no more than an item's width and
    // its gap: the fade runs across it. None on a phone.
    const room = () => {
      const r = root.getBoundingClientRect();
      const box = (root.closest('[data-bleed-bounds]') ?? root.closest('main') ?? document.documentElement).getBoundingClientRect();
      const first = track.firstElementChild as HTMLElement | null;
      const reach = (first?.offsetWidth ?? 0) + (parseFloat(getComputedStyle(track).columnGap) || 0);
      const { start, end } = bleed(r, box, document.documentElement.clientWidth, reach, narrow.matches);
      root.style.setProperty('--bleed-start', `${Math.floor(start)}px`);
      root.style.setProperty('--bleed-end', `${Math.floor(end)}px`);
      update();
    };
    const observer = new ResizeObserver(room);
    observer.observe(root);
    signal.addEventListener('abort', () => observer.disconnect());
    window.addEventListener('resize', room, { signal });
    narrow.addEventListener('change', room, { signal });
    room();
  }
  update();
}
