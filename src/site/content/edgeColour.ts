/**
 * A picture's automatic background (documentation/content/media.md §9.1), pure so it's unit-tested: the
 * average of its opaque edge pixels, weighted by how opaque each is, from a small square of its pixels
 * (RGBA, row by row). Null when its edges are (nearly) all transparent: then its dominant colour is used.
 */
export function edgeAverage(rgba: ArrayLike<number>, size: number): string | null {
  let r = 0;
  let g = 0;
  let b = 0;
  let w = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (x !== 0 && y !== 0 && x !== size - 1 && y !== size - 1) continue;
      const i = (y * size + x) * 4;
      const a = rgba[i + 3] / 255;
      r += rgba[i] * a;
      g += rgba[i + 1] * a;
      b += rgba[i + 2] * a;
      w += a;
    }
  }
  // fewer than four edge pixels' worth of opacity: the edges say nothing about the picture
  if (w < 4) return null;
  return `rgb(${Math.round(r / w)} ${Math.round(g / w)} ${Math.round(b / w)})`;
}
