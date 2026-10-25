/**
 * A peeking carousel's haze (tier 0; docs: documentation/site-ui/visual-language.md): an SVG filter on its
 * track that blurs each neighbour more and more across itself, from c.carousel.peek-blur-near at its near
 * edge to peek-blur at its far end. The slides are blurred themselves (never a layer over them, which would
 * leave them sharp under a blurred copy), then the viewport's mask fades the blurred picture. The rules are
 * pure in `media.ts` (`hazePlan`).
 *
 * Built to run on the GPU every frame the slides move: only primitives Chromium's compositor runs itself
 * (no feImage, which sends the whole filter to the CPU: 270 ms a frame, measured), each cut to the stretch
 * it's needed over, a few blur levels mixed by blurred-edge ramps (a flood blurred sideways) rather than
 * many, and the filter's region the track's own box with the most blur's reach round it (never cut short).
 */
import type { HazePlan } from './media';

const NS = 'http://www.w3.org/2000/svg';

function node(name: string, attrs: Record<string, string | number>): SVGElement {
  const el = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

const px = (n: number) => String(Math.round(n * 100) / 100);
const box = (from: number, to: number) => ({ x: px(from), width: px(Math.max(1, to - from)) });

/** Writes `plan` into `filter` (or clears it when null). Returns whether there's a haze to show. */
export function drawHaze(filter: SVGFilterElement, plan: HazePlan | null): boolean {
  if (!plan) {
    filter.replaceChildren();
    return false;
  }
  const parts: SVGElement[] = [node('feOffset', { in: 'SourceGraphic', ...box(plan.sharp.from, plan.sharp.to), result: 'sharp' })];
  const merged = ['sharp'];
  plan.sides.forEach((side, s) => {
    side.levels.forEach((level, k) =>
      parts.push(
        level.blur > 0
          ? node('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: px(level.blur), ...box(level.from, level.to), result: `b${s}-${k}` })
          : node('feOffset', { in: 'SourceGraphic', ...box(level.from, level.to), result: `b${s}-${k}` }),
      ),
    );
    if (!side.bands.length) merged.push(`b${s}-0`);
    side.bands.forEach((band, j) => {
      const id = `${s}-${j}`;
      // the ramp: 0 towards the near edge, 1 towards the far end, a flood's edge blurred sideways only
      const reach = 3 * band.soft + 1;
      const flood = band.towards > 0 ? box(band.mid, band.to + reach) : box(band.from - reach, band.mid);
      parts.push(
        node('feFlood', { 'flood-color': '#000', 'flood-opacity': 1, ...flood, result: `f${id}` }),
        node('feGaussianBlur', { in: `f${id}`, stdDeviation: `${px(band.soft)} 0`, ...box(band.from, band.to), result: `w${id}` }),
        node('feComposite', { in: `b${s}-${band.lower}`, in2: `w${id}`, operator: 'out', ...box(band.from, band.to), result: `lo${id}` }),
        node('feComposite', { in: `b${s}-${band.upper}`, in2: `w${id}`, operator: 'in', ...box(band.from, band.to), result: `hi${id}` }),
        node('feComposite', { in: `lo${id}`, in2: `hi${id}`, operator: 'arithmetic', k1: 0, k2: 1, k3: 1, k4: 0, ...box(band.from, band.to), result: `m${id}` }),
      );
      merged.push(`m${id}`);
    });
  });
  // the region: the track's box and the most blur's reach on every side (cut nearer, a blur ends in an edge)
  filter.setAttribute('filterUnits', 'userSpaceOnUse');
  for (const [k, v] of Object.entries(plan.region)) filter.setAttribute(k, px(v));
  const merge = node('feMerge', {});
  for (const m of merged) merge.append(node('feMergeNode', { in: m }));
  parts.push(merge);
  filter.replaceChildren(...parts);
  return true;
}
