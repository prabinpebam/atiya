/**
 * Colour maths for themes (documentation/site-ui/theming.md §6): sRGB ↔ OKLab/OKLCH, gamut mapping and WCAG 2.2
 * contrast. Pure and dependency-free, so the editor's theme screen and the build use the same numbers.
 */

export type Rgb = [number, number, number];
/** OKLCH: lightness 0–1, chroma 0–~0.4, hue in degrees. */
export interface Lch {
  l: number;
  c: number;
  h: number;
}

const HEX = /^#([0-9a-f]{6})$/i;

export const isHex = (v: unknown): v is string => typeof v === 'string' && HEX.test(v);

/** `#RRGGBB`, or `rgb(r g b / a)` (its alpha dropped: see alphaOf) → 0–255 channels. */
export function parseRgb(v: string): Rgb {
  const hex = HEX.exec(v.trim());
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(v.trim());
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  throw new Error(`not a colour: ${v}`);
}

/** The alpha of `rgb(r g b / a)`; 1 for a hex. */
export function alphaOf(v: string): number {
  const m = /\/\s*([\d.]+)\s*\)/.exec(v);
  return m ? Number(m[1]) : 1;
}

export const toHex = ([r, g, b]: Rgb): string =>
  `#${[r, g, b].map((x) => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

const toLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const toGamma = (v: number) => {
  const x = Math.min(1, Math.max(0, v));
  return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
};

/** OKLab from sRGB (Björn Ottosson, 2020). */
export function rgbToOklab([r, g, b]: Rgb): [number, number, number] {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

/** Linear sRGB (unclamped) from OKLab. */
function oklabToLinear([L, a, b]: [number, number, number]): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}

export function rgbToLch(rgb: Rgb): Lch {
  const [l, a, b] = rgbToOklab(rgb);
  const c = Math.hypot(a, b);
  const h = c < 1e-6 ? 0 : (Math.atan2(b, a) * 180) / Math.PI;
  return { l, c, h: (h + 360) % 360 };
}

const labOf = ({ l, c, h }: Lch): [number, number, number] => [l, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180)];

const EPS = 1e-4;
const inGamut = (lin: Rgb) => lin.every((v) => v >= -EPS && v <= 1 + EPS);

/** The sRGB colour for an OKLCH, its chroma reduced (hue and lightness kept) until it fits the gamut. */
export function lchToRgb(lch: Lch): Rgb {
  const l = Math.min(1, Math.max(0, lch.l));
  let c = Math.max(0, lch.c);
  if (!inGamut(oklabToLinear(labOf({ l, c, h: lch.h })))) {
    let lo = 0;
    let hi = c;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklabToLinear(labOf({ l, c: mid, h: lch.h })))) lo = mid;
      else hi = mid;
    }
    c = lo;
  }
  return oklabToLinear(labOf({ l, c, h: lch.h })).map(toGamma) as Rgb;
}

export const hexToLch = (hex: string): Lch => rgbToLch(parseRgb(hex));
export const lchToHex = (lch: Lch): string => toHex(lchToRgb(lch));

/** WCAG 2.2 relative luminance. */
export function luminance([r, g, b]: Rgb): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG 2.2 contrast ratio of two opaque colours (1–21). */
export function contrastOf(a: string | Rgb, b: string | Rgb): number {
  const la = luminance(typeof a === 'string' ? parseRgb(a) : a);
  const lb = luminance(typeof b === 'string' ? parseRgb(b) : b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Hue distance in degrees (0–180). */
export const hueDistance = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};
