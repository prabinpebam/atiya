/**
 * A masonry collection's justified columns (tier 0; docs: documentation/site-ui/design-system.md
 * §2). CSS first balances the items into columns; this preserves those columns and gives each card
 * in a shorter one an equal share of its remaining height.
 */
import { masonryItemSizes } from './collection';

/** Make every masonry column end level by expanding only the cards in shorter columns. */
export function setupCollectionMasonry(root: HTMLElement, signal: AbortSignal): void {
  const track = root.querySelector<HTMLElement>('[data-masonry-track]');
  const items = [...root.querySelectorAll<HTMLElement>('[data-masonry-item]')];
  if (!track || items.length < 2) return;

  let frame = 0;
  let lastWidth = -1;
  const clear = () => {
    root.removeAttribute('data-masonry-justified');
    track.style.removeProperty('--masonry-block-size');
    items.forEach((item) => item.style.removeProperty('--masonry-item-block-size'));
  };
  const justify = () => {
    frame = 0;
    clear();
    const trackBox = track.getBoundingClientRect();
    lastWidth = trackBox.width;
    if (!trackBox.width) return;
    const boxes = items.map((item) => {
      const box = item.getBoundingClientRect();
      return { inlineStart: box.left, blockEnd: box.bottom - trackBox.top, blockSize: box.height };
    });
    if (new Set(boxes.map((box) => Math.round(box.inlineStart))).size < 2) return;
    masonryItemSizes(boxes).forEach((size, index) => items[index].style.setProperty('--masonry-item-block-size', `${size}px`));
    track.style.setProperty('--masonry-block-size', `${trackBox.height}px`);
    root.setAttribute('data-masonry-justified', '');
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(justify);
  };

  const observer = new ResizeObserver(([entry]) => {
    const width = entry?.contentRect.width ?? track.clientWidth;
    if (Math.abs(width - lastWidth) > 0.5) schedule();
  });
  observer.observe(track);
  items.forEach((item) => item.querySelector('img')?.addEventListener('load', schedule, { signal }));
  document.fonts?.ready.then(() => {
    if (!signal.aborted) schedule();
  });
  signal.addEventListener('abort', () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
  });
  schedule();
}
