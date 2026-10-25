/**
 * Pure helpers for the media components (docs: documentation/site-ui/design-system.md §2): the
 * lightbox's stepping and swipes, the carousel's position, keys, shape and peek, and a strip's room to
 * peek into. Unit-tested; the components' scripts (and `carousel.ts`, `collectionStrip.ts`) do the DOM.
 */
import { cssNumber } from './units';

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

/** A video file as the Video fundamental takes it: an MP4 as its src, a WebM as its webm (a carousel's slide, a gallery's cell). */
export function videoSources(video: { src: string; type: string }): { src?: string; webm?: string } {
  return { src: video.type === 'video/mp4' ? video.src : undefined, webm: video.type === 'video/webm' ? video.src : undefined };
}

/**
 * Whether a component is narrower than its container query's size token (its computed value, "36.45rem"):
 * what its `@container (width < …)` says, for its script (a peek has no room in a phone's column).
 */
export const narrowerThan = (width: number, limit: string, remPx = 16): boolean => width < cssNumber(limit, remPx);

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

/**
 * A peek's blur levels (px), from `near` (at a neighbour's near edge) to `far` (at its far end), each at
 * most `ratio` times the last, so a point between two levels shows a mix of two blurs close enough to read
 * as one between them. Few levels keep the filter cheap: 4 to 20 px is five.
 */
export function hazeLevels(near: number, far: number, ratio = 1.5): number[] {
  if (!(far > 0)) return [];
  const lo = Math.max(near, far / 16);
  if (lo >= far) return [far];
  const n = Math.ceil(Math.log(far / lo) / Math.log(ratio) - 1e-9);
  const levels = Array.from({ length: n + 1 }, (_, i) => (i === n ? far : lo * (far / lo) ** (i / n)));
  return near < lo ? [Math.max(0, near), ...levels] : levels;
}
/** Where the haze lies across a peeking carousel's viewport, from its start edge: each neighbour's near edge and far end (cut at the viewport's edge). */
export interface Haze {
  /** The width of the viewport. */
  width: number;
  /** The neighbour before: its near edge and its far end (nearer the start edge), or null when none shows. */
  start: { near: number; far: number } | null;
  /** The neighbour after: its near edge and its far end (nearer the end edge), or null when none shows. */
  end: { near: number; far: number } | null;
}

/**
 * The haze's place, from the carousel's width and its peek's room (the same sums as its stylesheet's
 * mask): each neighbour rests the gap away from the slide shown, and shows up to a slide's width of itself.
 */
export function hazeOf(carousel: number, bleedStart: number, bleedEnd: number, inset: number, gap: number): Haze {
  const width = carousel + bleedStart + bleedEnd;
  const shown = width - bleedStart - bleedEnd - 2 * inset;
  const side = (room: number) => {
    const near = room + inset - gap;
    return near > 0 ? { near, far: Math.max(0, near - shown) } : null;
  };
  const s = side(bleedStart);
  const e = side(bleedEnd);
  return { width, start: s, end: e && { near: width - e.near, far: width - e.far } };
}

/** One side's part of a peek's haze (viewport px, from its start edge; every edge a whole pixel, so the parts meet exactly). */
export interface HazeSide {
  /** Each blur level (px) and the stretch it's needed over (its bands). */
  levels: { blur: number; from: number; to: number }[];
  /**
   * Each stretch between two levels: it mixes level `lower` into level `upper` along a ramp centred on
   * `mid`, `soft` its softness (a blurred edge, rising `towards` the far end: 1 rightwards, -1 leftwards).
   * The last runs on to the viewport's edge.
   */
  bands: { from: number; to: number; lower: number; upper: number; mid: number; soft: number; towards: 1 | -1 }[];
}

/** A peek's haze, worked out for its filter: the slide shown's stretch (kept sharp) and each side's. */
export interface HazePlan {
  /** The viewport's width. */
  width: number;
  /** The slide shown's stretch, kept sharp (the gaps beside it ease into the first blur). */
  sharp: { from: number; to: number };
  /** Each side's levels and bands. */
  sides: HazeSide[];
  /** The filter's region (px, the track's own space): its box and the reach of the most blur on every side, so no blur is cut short. */
  region: { x: number; y: number; width: number; height: number };
}

/** How far a blur reaches, in its standard deviations (past 3, what's left is under a 1% tail). */
export const HAZE_REACH = 3;

/**
 * The haze's filter, from where it lies and its blurs (`near` at a neighbour's near edge, `far` at its far
 * end, growing evenly across it): null when no neighbour shows. `gap` is the space between slides: across
 * it the sharp picture eases into the first blur (a level of 0 px), so a slide moving into the haze, or a
 * neighbour's near edge, never meets a cut. `height` is the track's: the region reaches past it, so the blur
 * spreads past the slides' tops and bottoms. Each level is blurred only over the two bands it's part of,
 * and each band only mixes its two levels, so the work grows with the neighbours' width, never the viewport's.
 */
export function hazePlan(haze: Haze, near: number, far: number, gap = 0, height = 0): HazePlan | null {
  const levelsOf = hazeLevels(near, far);
  const ease = Math.round(Math.max(0, gap));
  const blurs = ease > 0 && levelsOf.length && levelsOf[0] > 0 ? [0, ...levelsOf] : levelsOf;
  const sides: HazeSide[] = [];
  const span = far - (levelsOf[0] ?? 0);
  const one = (side: { near: number; far: number }, edge: number): HazeSide | null => {
    if (side.near === side.far || !blurs.length) return null;
    const towards: 1 | -1 = side.far > side.near ? 1 : -1;
    const across = levelsOf.map((b) => Math.round(side.near + (side.far - side.near) * (span > 0 ? (b - levelsOf[0]) / span : 0)));
    // the sharp picture's level sits at the slide shown's edge, a gap before the neighbour's
    const at = blurs.length > levelsOf.length ? [across[0] - towards * ease, ...across] : across;
    const ends = (a: number, b: number) => (a < b ? [a, b] : [b, a]);
    if (blurs.length === 1) {
      const [from, to] = ends(at[0], edge);
      return { levels: [{ blur: blurs[0], from, to }], bands: [] };
    }
    const last = blurs.length - 1;
    const bands = blurs.slice(0, -1).map((_, k) => {
      const [from, to] = ends(at[k], k + 1 === last ? edge : at[k + 1]);
      return { from, to, lower: k, upper: k + 1, mid: (at[k] + at[k + 1]) / 2, soft: Math.max(0.5, Math.abs(at[k + 1] - at[k]) / 4), towards };
    });
    const levels = blurs.map((blur, k) => {
      const parts = bands.filter((b) => b.lower === k || b.upper === k);
      return { blur, from: Math.min(...parts.map((b) => b.from)), to: Math.max(...parts.map((b) => b.to)) };
    });
    return { levels, bands };
  };
  const start = haze.start && one(haze.start, 0);
  const end = haze.end && one(haze.end, haze.width);
  if (start) sides.push(start);
  if (end) sides.push(end);
  if (!sides.length) return null;
  const ramp = Math.max(0, ...sides.flatMap((s) => s.bands.map((b) => HAZE_REACH * b.soft + 2)));
  const reach = Math.ceil(Math.max(HAZE_REACH * far, ramp));
  const lead = blurs.length > levelsOf.length ? ease : 0;
  return {
    width: haze.width,
    sharp: {
      from: haze.start ? Math.round(haze.start.near) + lead : 0,
      to: haze.end ? Math.round(haze.end.near) - lead : Math.round(haze.width),
    },
    sides,
    region: { x: -reach, y: -reach, width: Math.round(haze.width) + 2 * reach, height: Math.round(Math.max(0, height)) + 2 * reach },
  };
}