/**
 * Pure helpers for the media components (docs: documentation/site-ui/design-system.md §2): the
 * lightbox's stepping and swipes, the carousel's position, keys, shape and peek, and a strip's room to
 * peek into. Unit-tested; the components' scripts (and `carousel.ts`, `collectionStrip.ts`) do the DOM.
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

/**
 * How far to scroll a strip so an item is in view with `pad` to spare: 0 if it already is. Positions
 * are along the strip's axis (the item's start and end, the strip's visible start and end).
 */
export function reveal(start: number, end: number, viewStart: number, viewEnd: number, pad = 0): number {
  if (start < viewStart + pad) return start - viewStart - pad;
  if (end > viewEnd - pad) return Math.min(end - viewEnd + pad, start - viewStart - pad);
  return 0;
}

/** A carousel's arrow keys: -1 for Left (previous), +1 for Right (next), 0 for any other key. */
export function arrowStep(key: string): -1 | 0 | 1 {
  return key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0;
}

interface Size {
  width: number;
  height: number;
}

/**
 * The carousel's slide shape: the tallest picture's (its dark version's too), so the carousel is as tall as
 * its tallest picture and no taller. Pictures without a size don't count; with none, 3:2.
 */
export function slideShape(items: readonly (Size & { dark?: Size })[]): Size {
  const shapes = items.flatMap((item) => [item, ...(item.dark ? [item.dark] : [])]).filter((s) => s.width > 0 && s.height > 0);
  const tallest = shapes.reduce<Size | null>((t, s) => (!t || s.height / s.width > t.height / t.width ? s : t), null);
  return tallest ? { width: tallest.width, height: tallest.height } : { width: 3, height: 2 };
}

/** A horizontal extent, in viewport px. */
interface Span {
  left: number;
  right: number;
}

/**
 * A peek's room beside a strip (the carousel, the collection's strips): from the strip's sides to its
 * bounds (clipped to the viewport, 0 to `viewport` wide), never more than `reach` and never less than 0.
 * None on a phone (`narrow`).
 */
export function bleed(strip: Span, bounds: Span, viewport: number, reach: number, narrow: boolean): { start: number; end: number } {
  if (narrow) return { start: 0, end: 0 };
  const left = Math.max(bounds.left, 0);
  const right = Math.min(bounds.right, viewport);
  return {
    start: Math.max(0, Math.min(strip.left - left, reach)),
    end: Math.max(0, Math.min(right - strip.right, reach)),
  };
}

/** How much of each neighbour a peeking carousel keeps in view itself: what the narrower side's room leaves of `min`. None on a phone. */
export function peekInset(min: number, start: number, end: number, narrow: boolean): number {
  return narrow ? 0 : Math.max(0, min - Math.min(start, end));
}

/**
 * A peeking slide's shading: how far its centre is from the middle in slides (`span`, a slide and its gap),
 * as `peek` (0 in the middle, 1 a whole slide away or more), and which side of the middle it's on.
 */
export function peekOf(centre: number, middle: number, span: number): { peek: number; side: 'before' | 'after' } {
  const d = (centre - middle) / span;
  return { peek: Math.min(1, Math.abs(d)), side: d < 0 ? 'before' : 'after' };
}
