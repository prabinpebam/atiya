/**
 * The crop's geometry (documentation/editor/spec.md §6.1): a rectangle in the source picture's pixels,
 * moved, resized by one of its eight handles (keeping a ratio when one is chosen), resized about its centre
 * (the Size slider), and always kept inside the picture and at least MIN_SIDE on either side. Pure, so the
 * crop dialog and the tests share it.
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Bounds {
  width: number;
  height: number;
}

export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/** The least a crop can be on either side (px): smaller, nothing useful is left. */
export const MIN_SIDE = 16;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** The rectangle kept inside the picture, its size unchanged. */
export const inside = (r: Rect, b: Bounds): Rect => ({ ...r, x: clamp(r.x, 0, b.width - r.width), y: clamp(r.y, 0, b.height - r.height) });

/** The rectangle moved so its centre is at (cx, cy), as far as the picture allows. */
export const centreOn = (r: Rect, cx: number, cy: number, b: Bounds): Rect => inside({ ...r, x: cx - r.width / 2, y: cy - r.height / 2 }, b);

/** The rectangle moved by (dx, dy), as far as the picture allows. */
export const move = (r: Rect, dx: number, dy: number, b: Bounds): Rect => inside({ ...r, x: r.x + dx, y: r.y + dy }, b);

/** The largest rectangle of `ratio` (width over height) in the picture, centred on (cx, cy) as far as it can be; the whole picture without a ratio. */
export function largest(b: Bounds, ratio?: number, cx = b.width / 2, cy = b.height / 2): Rect {
  if (!ratio) return { x: 0, y: 0, width: b.width, height: b.height };
  const width = Math.min(b.width, b.height * ratio);
  return centreOn({ x: 0, y: 0, width, height: width / ratio }, cx, cy, b);
}

/** The same place in a new shape: the largest rectangle of `ratio` centred where this one is (unchanged without a ratio). */
export const withRatio = (r: Rect, b: Bounds, ratio?: number): Rect => (ratio ? largest(b, ratio, r.x + r.width / 2, r.y + r.height / 2) : r);

/**
 * The rectangle with one handle dragged by (dx, dy): the opposite corner (or edge) stays put. With a ratio,
 * a corner follows whichever way the pointer went further, and an edge keeps the other axis centred.
 */
export function resize(r: Rect, handle: Handle, dx: number, dy: number, b: Bounds, ratio?: number): Rect {
  const left = r.x;
  const top = r.y;
  const right = r.x + r.width;
  const bottom = r.y + r.height;
  const e = handle.includes('e');
  const w = handle.includes('w');
  const n = handle.includes('n');
  const s = handle.includes('s');
  if (!ratio) {
    const l = w ? clamp(left + dx, 0, right - MIN_SIDE) : left;
    const rr = e ? clamp(right + dx, left + MIN_SIDE, b.width) : right;
    const t = n ? clamp(top + dy, 0, bottom - MIN_SIDE) : top;
    const bb = s ? clamp(bottom + dy, top + MIN_SIDE, b.height) : bottom;
    return { x: l, y: t, width: rr - l, height: bb - t };
  }
  const minWidth = Math.max(MIN_SIDE, MIN_SIDE * ratio);
  if ((e || w) && (n || s)) {
    // a corner: the opposite corner is the anchor
    const ax = e ? left : right;
    const ay = s ? top : bottom;
    const wantW = e ? right + dx - ax : ax - (left + dx);
    const wantH = s ? bottom + dy - ay : ay - (top + dy);
    const room = Math.min(e ? b.width - ax : ax, (s ? b.height - ay : ay) * ratio);
    const width = clamp(Math.max(wantW, wantH * ratio), minWidth, room);
    const height = width / ratio;
    return inside({ x: e ? ax : ax - width, y: s ? ay : ay - height, width, height }, b);
  }
  const cx = left + r.width / 2;
  const cy = top + r.height / 2;
  if (e || w) {
    // a side: the other side stays, and the height follows about the centre
    const ax = e ? left : right;
    const want = e ? right + dx - ax : ax - (left + dx);
    const room = Math.min(e ? b.width - ax : ax, 2 * Math.min(cy, b.height - cy) * ratio);
    const width = clamp(want, minWidth, room);
    const height = width / ratio;
    return inside({ x: e ? ax : ax - width, y: cy - height / 2, width, height }, b);
  }
  // the top or the bottom: the other stays, and the width follows about the centre
  const ay = s ? top : bottom;
  const want = s ? bottom + dy - ay : ay - (top + dy);
  const room = Math.min(s ? b.height - ay : ay, (2 * Math.min(cx, b.width - cx)) / ratio);
  const height = clamp(want, minWidth / ratio, room);
  const width = height * ratio;
  return inside({ x: cx - width / 2, y: s ? ay : ay - height, width, height }, b);
}

/** How big the rectangle is, from 0 to 1: its width over the largest of its own shape the picture holds. */
export const sizeOf = (r: Rect, b: Bounds): number => r.width / largest(b, r.width / r.height).width;

/** The rectangle at `size` (0 to 1, as sizeOf reads it), its shape and its centre kept as far as they can be. */
export function resizeTo(r: Rect, size: number, b: Bounds): Rect {
  const ratio = r.width / r.height;
  const most = largest(b, ratio);
  const width = clamp(most.width * size, Math.max(MIN_SIDE, MIN_SIDE * ratio), most.width);
  return centreOn({ ...r, width, height: width / ratio }, r.x + r.width / 2, r.y + r.height / 2, b);
}

/** In whole pixels, inside the picture: what's saved. */
export function whole(r: Rect, b: Bounds): Rect {
  const width = clamp(Math.round(r.width), 1, b.width);
  const height = clamp(Math.round(r.height), 1, b.height);
  return { x: clamp(Math.round(r.x), 0, b.width - width), y: clamp(Math.round(r.y), 0, b.height - height), width, height };
}

/**
 * What a picture's field says about the picture in it, for its use (documentation/editor/spec.md §3.5): its
 * size and shape, what the design does when the shape isn't the use's (crops it, or frames it whole), and
 * whether it's too small to stay sharp.
 */
export function pictureNote(use: { ratio: string; fit: 'crop' | 'whole'; width: number }, width: number, height: number): string {
  const [rw, rh] = use.ratio.split('/').map(Number);
  const want = `${rw}:${rh}`;
  const r = width / height;
  const parts = [`This one is ${width} × ${height} px (${ratioLabel(width, height)}).`];
  if (Math.abs(r / (rw / rh) - 1) > 0.01) {
    parts.push(
      use.fit === 'crop'
        ? `The page crops it to ${want} around its focus point: crop it yourself to choose what shows.`
        : `Cards show it whole, with space ${r > rw / rh ? 'above and below' : 'either side'}: crop it to ${want} to fill them.`,
    );
  }
  if (width < use.width) parts.push(`It's smaller than ${use.width} px wide, so it may look soft.`);
  return parts.join(' ');
}

const NAMED: [number, number][] = [
  [1, 1],
  [5, 4],
  [4, 5],
  [4, 3],
  [3, 4],
  [3, 2],
  [2, 3],
  [16, 9],
  [9, 16],
  [21, 9],
  [2, 1],
  [3, 1],
];

/** A size's shape in words: "16:9" when it's within 1% of a common one, else "2.08:1". */
export function ratioLabel(width: number, height: number): string {
  const r = width / height;
  const named = NAMED.find(([w, h]) => Math.abs(r / (w / h) - 1) <= 0.01);
  if (named) return `${named[0]}:${named[1]}`;
  return r >= 1 ? `${Number(r.toFixed(2))}:1` : `1:${Number((1 / r).toFixed(2))}`;
}

/** The shapes the crop offers, as the dialog's Shape list takes them ("free": any; "original": the picture's own). */
export const SHAPES = ['free', 'original', '1/1', '4/5', '3/2', '4/3', '16/9', '21/9'] as const;

/** A shape as a ratio: undefined for free, the picture's own for original. */
export function ratioOfShape(shape: string, b: Bounds): number | undefined {
  if (shape === 'free') return undefined;
  if (shape === 'original') return b.width / b.height;
  const [w, h] = shape.split('/').map(Number);
  return w && h ? w / h : undefined;
}
