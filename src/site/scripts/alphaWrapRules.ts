/**
 * Words round a picture's drawn shape, not its box: the pure half of scripts/alphaWrap.ts.
 *
 * The browser lays the words out (a float's shape-outside: native line breaking, selection, reflow); this
 * works out the shape. A float only ever offers each line the room between the words' edge and the nearest
 * ink on that side, so the outline it needs is the silhouette's profile from that side, row by row: holes
 * and separate pieces fall out of it (the union's outer edge), and shape-margin pads it by the same distance
 * all round, rounded at the corners (a die-cut sticker's edge), in CSS pixels at any size.
 *
 * Two rules keep the words readable: a gap narrower than `measure` (after the padding) is closed, so a line
 * never holds a word or two, and an open run shorter than `band` is closed, so a name never splits round a
 * narrow part of the picture. A run at the foot of the box is never too short: the words carry on below it.
 */

/** A picture's silhouette, row by row from its alpha mask: each row's first and last column with ink (-1: none). */
export interface Silhouette {
  cols: number;
  rows: number;
  first: Int16Array;
  last: Int16Array;
  /** How many rows have ink. */
  inked: number;
}

/** The float's box and, within it, the picture as drawn (shown whole in a frame), in CSS pixels. */
export interface WrapBox {
  width: number;
  height: number;
  image: { x: number; y: number; width: number; height: number };
}

/** In CSS pixels: the padding round the ink (the float's shape-margin) and the least room a run of words takes. */
export interface WrapRules {
  gap: number;
  measure: number;
  band: number;
}

/** Where the words go and the outline that keeps them off the picture (CSS polygon points, in the box's pixels). */
export interface Wrap {
  side: 'left' | 'right';
  polygon: string;
  /** The area the words can take beside the picture (px²): the larger side wins. */
  room: number;
}

/** The alpha mask of RGBA pixels (as getImageData gives them): a pixel is ink above `threshold` (0 to 255), so faint antialiasing is left out. */
export function silhouette(rgba: ArrayLike<number>, cols: number, rows: number, threshold = 32): Silhouette {
  const first = new Int16Array(rows).fill(-1);
  const last = new Int16Array(rows).fill(-1);
  let inked = 0;
  for (let r = 0; r < rows; r++) {
    const row = r * cols;
    for (let c = 0; c < cols; c++) {
      if (rgba[(row + c) * 4 + 3] > threshold) {
        first[r] = c;
        break;
      }
    }
    if (first[r] < 0) continue;
    for (let c = cols - 1; c >= first[r]; c--) {
      if (rgba[(row + c) * 4 + 3] > threshold) {
        last[r] = c;
        break;
      }
    }
    inked++;
  }
  return { cols, rows, first, last, inked };
}

interface Band {
  y0: number;
  y1: number;
  /** How far in from the words' edge the ink starts (the box's width: none). */
  depth: number;
  open?: boolean;
}

/** The box in thin horizontal bands (a mask row each; the space above and below the picture cut to the same height), each with how far its ink sits from the words' side. */
function bands(s: Silhouette, box: WrapBox, side: 'left' | 'right'): Band[] {
  const out: Band[] = [];
  const { image } = box;
  const rowH = image.height / s.rows;
  const colW = image.width / s.cols;
  const clear = (from: number, to: number) => {
    const n = Math.ceil((to - from) / rowH);
    for (let i = 0; i < n; i++) out.push({ y0: from + ((to - from) * i) / n, y1: from + ((to - from) * (i + 1)) / n, depth: box.width });
  };
  clear(0, Math.max(0, image.y));
  for (let r = 0; r < s.rows; r++) {
    const y0 = Math.max(0, image.y + r * rowH);
    const y1 = Math.min(box.height, image.y + (r + 1) * rowH);
    const depth = s.first[r] < 0 ? box.width : side === 'left' ? image.x + s.first[r] * colW : box.width - (image.x + (s.last[r] + 1) * colW);
    if (y1 > y0) out.push({ y0, y1, depth: Math.max(0, Math.min(box.width, depth)) });
  }
  clear(Math.min(box.height, image.y + image.height), box.height);
  return out;
}

/** The room a band's words get: its depth less the padding, which reaches it from any ink within `gap` above or below (round, as shape-margin draws it). */
function roomOf(all: Band[], i: number, gap: number): number {
  const b = all[i];
  let room = b.depth - gap;
  for (const step of [-1, 1]) {
    for (let j = i + step; j >= 0 && j < all.length; j += step) {
      const o = all[j];
      const d = step < 0 ? b.y0 - o.y1 : o.y0 - b.y1;
      if (d >= gap) break;
      if (o.depth < b.depth) room = Math.min(room, o.depth - Math.sqrt(gap * gap - Math.max(0, d) ** 2));
    }
  }
  return Math.max(0, room);
}

const px = (n: number) => `${Math.round(n * 10) / 10}px`;

/** The outline for words on one side, or null when no run there is big enough to take them (the box does as well). */
function wrapOn(s: Silhouette, box: WrapBox, rules: WrapRules, side: 'left' | 'right'): Wrap | null {
  const all = bands(s, box, side);
  const rooms = all.map((_, i) => roomOf(all, i, rules.gap));
  all.forEach((b, i) => (b.open = rooms[i] >= rules.measure));
  // close an open run too short for a few lines (the last, at the foot, carries on below the box)
  for (let i = 0; i < all.length; ) {
    if (!all[i].open) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < all.length && all[j + 1].open) j++;
    if (j < all.length - 1 && all[j].y1 - all[i].y0 < rules.band) for (let k = i; k <= j; k++) all[k].open = false;
    i = j + 1;
  }
  const room = all.reduce((sum, b, i) => sum + (b.open ? (rooms[i] - rules.measure / 2) * (b.y1 - b.y0) : 0), 0);
  if (!all.some((b) => b.open)) return null;
  // a closed band reaches the words' edge; an open one stops at its ink
  const edge = (b: Band) => (b.open ? b.depth : 0);
  const x = (depth: number) => (side === 'left' ? depth : box.width - depth);
  const points: string[] = [];
  let prev: number | undefined;
  for (const b of all) {
    const e = edge(b);
    if (prev !== undefined && Math.abs(prev - e) < 0.5) {
      points[points.length - 1] = `${px(x(e))} ${px(b.y1)}`;
      continue;
    }
    points.push(`${px(x(e))} ${px(b.y0)}`, `${px(x(e))} ${px(b.y1)}`);
    prev = e;
  }
  const back = side === 'left' ? box.width : 0;
  points.push(`${px(back)} ${px(box.height)}`, `${px(back)} 0px`);
  return { side, polygon: points.join(', '), room };
}

/**
 * The outline that lets words into the empty space beside a picture's ink, on the side with more room (or the
 * side asked for), or null when the picture leaves no run big enough (a photo, a full frame): its box then.
 */
export function wrapShape(s: Silhouette, box: WrapBox, rules: WrapRules, side: 'left' | 'right' | 'auto' = 'auto', prefer: 'left' | 'right' = 'left'): Wrap | null {
  if (s.inked === 0 || box.width <= 0 || box.height <= 0 || box.image.width <= 0 || box.image.height <= 0) return null;
  if (side !== 'auto') return wrapOn(s, box, rules, side);
  const other = prefer === 'left' ? 'right' : 'left';
  const a = wrapOn(s, box, rules, prefer);
  const b = wrapOn(s, box, rules, other);
  if (!a || !b) return a ?? b;
  return b.room > a.room ? b : a;
}
