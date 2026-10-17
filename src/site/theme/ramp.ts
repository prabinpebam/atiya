/**
 * A theme's type ramp, spacing and corners (documentation/site-ui/theming.md §5): the site's own sizes, changed by
 * a few controls rather than set one by one. The ramp works on sizes in log space round body text, so every
 * control keeps the sizes in order, and each fluid size still grows at most 2.5× (WCAG 1.4.4).
 */
import type { Span, ThemeBase } from './base';
import { LAYOUT_SPACES } from './base';
import { CORNER_FACTOR, SPACING_FACTOR, TYPE_RANGE, type Corners, type Spacing, type TypeSettings } from './model';

/** No size below 12 px; body text never below 16 px (the browser's own default). */
export const TEXT_FLOOR = 0.75;
export const BODY_FLOOR = 1;
/** A fluid size grows at most this much (WCAG 1.4.4: 200 % zoom must still enlarge it). */
export const MAX_GROWTH = 2.5;

const round = (x: number) => Math.round(x * 10000) / 10000;
const clampStep = (k: keyof TypeSettings, v: number) => Math.min(TYPE_RANGE[k].max, Math.max(TYPE_RANGE[k].min, Math.round(v || 0)));

/** The controls, each kept to its range and whole steps. */
export const cleanType = (t: Partial<TypeSettings>): TypeSettings => ({
  size: clampStep('size', t.size ?? 0),
  largest: clampStep('largest', t.largest ?? 0),
  smallest: clampStep('smallest', t.smallest ?? 0),
  contrast: clampStep('contrast', t.contrast ?? 0),
});

/** One end of the ramp (the small or the large viewport's sizes), with the controls applied and the floors held. */
function end(sizes: Record<string, number>, s: TypeSettings): Record<string, number> {
  const ln = Object.fromEntries(Object.entries(sizes).map(([k, v]) => [k, Math.log(v)]));
  const b = ln.body;
  const all = Object.values(ln);
  const top = Math.max(...all);
  const bottom = Math.min(...all);
  const c = 1 + TYPE_RANGE.contrast.step * s.contrast;
  const largest = Math.log(1 + TYPE_RANGE.largest.step * s.largest);
  const smallest = Math.log(1 + TYPE_RANGE.smallest.step * s.smallest);
  const size = Math.log(1 + TYPE_RANGE.size.step * s.size);
  const out: Record<string, number> = {};
  for (const [k, l] of Object.entries(ln)) {
    // the step between sizes spreads the headings from body text; the small sizes are the smallest-text control's
    let next = l > b ? b + (l - b) * c : l;
    if (l > b && top > b) next += (largest * (l - b)) / (top - b);
    if (l < b && bottom < b) next += (smallest * (b - l)) / (b - bottom);
    out[k] = Math.max(k === 'body' ? BODY_FLOOR : TEXT_FLOOR, Math.exp(next + size));
  }
  // a floor can lift a size past one above it: keep the site's order (a heading never smaller than body text)
  let floor = 0;
  for (const k of Object.keys(sizes).sort((x, y) => sizes[x] - sizes[y])) {
    out[k] = Math.max(out[k], floor);
    floor = out[k];
  }
  return out;
}

/** The type ramp with a theme's controls: each size at the small and the large end, in rem. */
export function typeRamp(base: Record<string, Span>, settings: Partial<TypeSettings>): Record<string, Span> {
  const s = cleanType(settings);
  const lo = end(Object.fromEntries(Object.entries(base).map(([k, v]) => [k, v.min])), s);
  const hi = end(Object.fromEntries(Object.entries(base).map(([k, v]) => [k, v.max])), s);
  const out: Record<string, Span> = {};
  for (const k of Object.keys(base)) {
    const min = round(lo[k]);
    // rounded down, so the 4-place value never grows past 2.5×
    const max = Math.min(round(Math.max(min, hi[k])), Math.floor(min * MAX_GROWTH * 10000) / 10000);
    // a fixed size (the interface's) stays fixed
    out[k] = base[k].min === base[k].max ? { min, max: min } : { min, max };
  }
  return out;
}

/** What the Theme screen says about a ramp that's hard to read. */
export function typeWarnings(ramp: Record<string, Span>): string[] {
  const out: string[] = [];
  if (ramp.sm && ramp.sm.min < 0.875) out.push('Small text is under 14 px: captions and labels will be hard to read.');
  if (ramp.body && ramp.body.min < 1) out.push('Body text is under 16 px on a phone: reading will be tiring.');
  return out;
}

/** The space scale for a density: the layout's whitespace moves more than the room inside components. */
export function spaceScale(base: ThemeBase['space'], spacing: Spacing): Record<string, Span> {
  const f = SPACING_FACTOR[spacing];
  return Object.fromEntries(
    Object.entries(base).map(([k, v]) => {
      const x = LAYOUT_SPACES.includes(k) ? f.layout : f.space;
      return [k, { min: round(v.min * x), max: round(v.max * x) }];
    }),
  );
}

/** The radius scale for a corner style; circles (`round`) stay circles. */
export function radiusScale(base: ThemeBase['radius'], corners: Corners): Record<string, number> {
  const f = CORNER_FACTOR[corners];
  return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, k === 'round' ? v : k === 'pill' ? (f.pill ? v : 0) : round(v * f.radius)]));
}
