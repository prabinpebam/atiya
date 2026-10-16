/**
 * The icon watermark beside a screen's content (components/IconPattern.astro): every icon edit mode uses, on a
 * grid, each sized by low-frequency Perlin noise, so large icons gather in soft clouds that thin to dots between.
 * Pure: the cells and their sizes, from a seed, the same every time; scripts/iconPattern.ts draws them.
 */

/** A small seeded random generator (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Classic 2D Perlin noise with its own seeded permutation: about -1 to 1, smooth, 0 at whole numbers. */
export function perlin(seed: number): (x: number, y: number) => number {
  const rand = seeded(seed);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = [...p, ...p];
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const grad = (h: number, x: number, y: number) => {
    switch (h & 7) {
      case 0: return x + y;
      case 1: return -x + y;
      case 2: return x - y;
      case 3: return -x - y;
      case 4: return x;
      case 5: return -x;
      case 6: return y;
      default: return -y;
    }
  };
  const lerp = (a: number, b: number, t: number) => a + t * (b - a);
  return (x, y) => {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);
    const aa = perm[perm[xi] + yi];
    const ab = perm[perm[xi] + yi + 1];
    const ba = perm[perm[xi + 1] + yi];
    const bb = perm[perm[xi + 1] + yi + 1];
    return lerp(lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u), lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u), v);
  };
}

export interface PatternCell {
  /** The cell's centre, in px from the field's top left. */
  x: number;
  y: number;
  /** Which icon, an index into the list given. */
  icon: number;
  /** Its size as a share of the largest icon: from MIN_SCALE (a dot) to 1. */
  scale: number;
}

/** The smallest an icon gets: a dot, so the grid stays visible where the noise is low. */
export const MIN_SCALE = 0.14;
/** How many cells one wave of the noise spans: low, so sizes change slowly across the field. */
export const NOISE_CELLS = 9;

/**
 * The cells for a field: a grid of `cell` px from the top left, each with an icon (spread evenly, in a shuffled
 * order) and a size from the noise. The same seed gives the same field, and a larger field only adds cells.
 */
export function patternCells(o: { width: number; height: number; cell: number; icons: number; seed?: number }): PatternCell[] {
  const { width, height, cell, icons } = o;
  if (width <= 0 || height <= 0 || cell <= 0 || icons <= 0) return [];
  const seed = o.seed ?? 7;
  const noise = perlin(seed);
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  // which icon: a hash of the cell, so neighbours differ and the choice doesn't depend on the field's size
  const order = (r: number, c: number) => {
    let h = Math.imul(r, 73856093) ^ Math.imul(c, 19349663) ^ seed;
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
    return ((h ^ (h >>> 15)) >>> 0) % icons;
  };
  const out: PatternCell[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const n = noise((c + 0.5) / NOISE_CELLS, (r + 0.5) / NOISE_CELLS) + 0.5 * noise((c + 0.5) / (NOISE_CELLS / 2) + 31.7, (r + 0.5) / (NOISE_CELLS / 2) + 17.3);
      // about -1.2…1.2 → 0…1, eased so most cells are small and a few are large
      const t = Math.min(1, Math.max(0, (n + 0.9) / 1.8));
      const scale = MIN_SCALE + (1 - MIN_SCALE) * t * t;
      out.push({ x: c * cell + cell / 2, y: r * cell + cell / 2, icon: order(r, c), scale });
    }
  return out;
}
