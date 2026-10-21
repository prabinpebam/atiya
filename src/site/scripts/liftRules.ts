/**
 * A rise by a distance, not a ratio (tier 0, pure; docs: documentation/home-views/bento.md §13.1): a scale of
 * 1.08 moves a small tile's edges a few pixels and a big one's several times as far, so a tile that rises
 * (or is pressed) gets its own scale, worked out from its size, that moves every edge the same distance.
 */

/** A CSS length as a custom property gives it (px or rem, rem against the root's font size) in px; null otherwise. */
export function lengthPx(text: string, rootPx: number): number | null {
  const m = /^\s*(-?[\d.]+)(px|rem)\s*$/.exec(text);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return m[2] === 'px' ? n : n * rootPx;
}

/**
 * The `scale` that moves every edge of a box `width` by `height` out by `by` px (in, if `by` is negative):
 * one factor across and one down, so a wide tile and a tall one move the same distance both ways. Null for a
 * box with no size, or one a press would turn inside out.
 */
export function edgeScale(width: number, height: number, by: number): string | null {
  if (!(width > 0) || !(height > 0) || !Number.isFinite(by)) return null;
  const across = (width + 2 * by) / width;
  const down = (height + 2 * by) / height;
  if (across <= 0 || down <= 0) return null;
  const f = (n: number) => String(Math.round(n * 10000) / 10000);
  return `${f(across)} ${f(down)}`;
}
