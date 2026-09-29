/**
 * Pure helpers for the media components (docs: documentation/site-ui/design-system.md §2): the
 * lightbox's stepping and swipes, and the carousel's position. Unit-tested; the components' scripts
 * do the DOM.
 */

/** Step through n items, wrapping at both ends. */
export function wrap(i: number, n: number): number {
  return n <= 0 ? 0 : ((i % n) + n) % n;
}

/** A horizontal swipe's direction: +1 next, -1 previous, 0 not a swipe (too short or mostly vertical). */
export function swipe(dx: number, dy: number, min = 48): -1 | 0 | 1 {
  if (Math.abs(dx) < min || Math.abs(dx) < Math.abs(dy) * 1.5) return 0;
  return dx < 0 ? 1 : -1;
}

/** The slide nearest a scroll position, given each slide's left offset in the track. */
export function nearest(scrollLeft: number, offsets: number[]): number {
  let best = 0;
  let d = Infinity;
  offsets.forEach((o, i) => {
    const e = Math.abs(o - scrollLeft);
    if (e < d) {
      d = e;
      best = i;
    }
  });
  return best;
}

/** "3 of 7": a counter's text (1-based). */
export const counter = (i: number, n: number): string => `${i + 1} of ${n}`;

/** Clamp to the slides that exist (a carousel doesn't wrap: its ends are real). */
export const clampIndex = (i: number, n: number): number => Math.max(0, Math.min(n - 1, i));
