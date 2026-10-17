/**
 * Colours from a picture (documentation/site-ui/theming.md §6.4): its pixels clustered in OKLab (k-means, seeded so
 * the same picture always gives the same colours), each cluster scored by how much of the picture it covers and
 * how colourful it is, the way Material's dynamic colour scores a wallpaper. Pure: the Theme screen hands it the
 * pixels of a small copy of the picture, drawn on a canvas in the browser.
 */
import { hexToLch, hueDistance, rgbToOklab, toHex, type Rgb } from './color';
import type { Seed } from './model';

export interface Swatch {
  hex: string;
  /** Its share of the picture (0–1). */
  share: number;
  /** How good an accent it would make. */
  score: number;
  /** Too grey to be an accent. */
  neutral: boolean;
}

/** A small, fast, seeded random number generator (mulberry32). */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dist2 = (a: number[], b: number[]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/** OKLab back to sRGB, for a cluster's centre (always inside the gamut: it's an average of real pixels). */
function labToRgb([L, a, b]: number[]): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return lin.map((v) => {
    const x = Math.min(1, Math.max(0, v));
    return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
  }) as Rgb;
}

/**
 * The picture's main colours, best accent first: `pixels` is RGBA (a canvas's ImageData), transparent pixels
 * left out. At most `count` swatches, each distinct from the others.
 */
export function extractColors(pixels: ArrayLike<number>, count = 6, k = 10): Swatch[] {
  const points: number[][] = [];
  for (let i = 0; i + 3 < pixels.length; i += 4) if (pixels[i + 3] >= 128) points.push(rgbToOklab([pixels[i], pixels[i + 1], pixels[i + 2]]));
  if (!points.length) return [];
  const rnd = random(0x5eed);
  // k-means++: each next centre far from the ones chosen
  const centres: number[][] = [points[Math.floor(rnd() * points.length)]];
  while (centres.length < Math.min(k, points.length)) {
    const d = points.map((p) => Math.min(...centres.map((c) => dist2(p, c))));
    const total = d.reduce((s, x) => s + x, 0);
    if (total === 0) break;
    let r = rnd() * total;
    let i = 0;
    while (i < d.length - 1 && (r -= d[i]) > 0) i++;
    centres.push(points[i]);
  }
  const owner = new Int32Array(points.length);
  for (let iter = 0; iter < 16; iter++) {
    let moved = false;
    for (let i = 0; i < points.length; i++) {
      let best = 0;
      let bd = Infinity;
      for (let c = 0; c < centres.length; c++) {
        const dd = dist2(points[i], centres[c]);
        if (dd < bd) {
          bd = dd;
          best = c;
        }
      }
      if (owner[i] !== best) {
        owner[i] = best;
        moved = true;
      }
    }
    const sums = centres.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < points.length; i++) {
      const s = sums[owner[i]];
      s[0] += points[i][0];
      s[1] += points[i][1];
      s[2] += points[i][2];
      s[3]++;
    }
    for (let c = 0; c < centres.length; c++) if (sums[c][3]) centres[c] = [sums[c][0] / sums[c][3], sums[c][1] / sums[c][3], sums[c][2] / sums[c][3]];
    if (!moved && iter > 0) break;
  }
  const counts = centres.map(() => 0);
  for (let i = 0; i < points.length; i++) counts[owner[i]]++;
  const swatches: Swatch[] = centres
    .map((c, i) => {
      const hex = toHex(labToRgb(c));
      const lch = hexToLch(hex);
      const share = counts[i] / points.length;
      const neutral = lch.c < 0.04;
      // colourful, mid-light and plentiful make a good accent (a near-white or near-black never does)
      const light = 1 - Math.min(1, Math.abs(lch.l - 0.55) / 0.45);
      const score = share > 0 ? Math.sqrt(share) * (lch.c + 0.01) * (0.3 + light) : 0;
      return { hex, share: Math.round(share * 1000) / 1000, score: Math.round(score * 10000) / 10000, neutral };
    })
    .filter((s) => s.share > 0.005)
    .sort((a, b) => Number(a.neutral) - Number(b.neutral) || b.score - a.score || b.share - a.share);
  const out: Swatch[] = [];
  for (const s of swatches) {
    const x = hexToLch(s.hex);
    const close = out.some((o) => {
      const y = hexToLch(o.hex);
      return Math.abs(x.l - y.l) < 0.08 && (Math.min(x.c, y.c) < 0.04 || hueDistance(x.h, y.h) < 18);
    });
    if (!close) out.push(s);
    if (out.length === count) break;
  }
  return out;
}

/** A seed from a picture's colours: its best accent, and a highlight of another hue if it has one. */
export function seedFromSwatches(swatches: Swatch[]): Seed | null {
  const colourful = swatches.filter((s) => !s.neutral);
  const accent = colourful[0] ?? swatches[0];
  if (!accent) return null;
  const a = hexToLch(accent.hex);
  const other = colourful.slice(1).find((s) => hueDistance(hexToLch(s.hex).h, a.h) > 40);
  const greys = swatches.filter((s) => s.neutral);
  // a picture that's mostly cool greys gets cool neutrals; warm or none, the site's own warm stock
  const cool = greys.length > 0 && greys.every((g) => {
    const l = hexToLch(g.hex);
    return l.c > 0.005 && l.h > 180 && l.h < 300;
  });
  return { accent: accent.hex, ...(other ? { highlight: other.hex } : {}), neutral: colourful.length ? (cool ? 'cool' : 'warm') : 'neutral' };
}
