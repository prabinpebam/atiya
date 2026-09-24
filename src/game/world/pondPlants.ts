import type { River } from './features';
import { hash3 } from './kit';
import type { Pond, PropInstance } from './layout';
import { angleGap, pondFrame, pondPoint, shoreRadius } from './pond';
import { RIVER_WATER_U, type Terrain } from './terrain';

/**
 * Pond plants (pure; unit-tested). Organic groups rather than an even ring: floating lily-pad
 * clusters on the open water, reeds with cattails wading in the shallows, irises right at the
 * waterline and ferns on the damp bank, plus reeds flanking the stream mouth. Nothing is placed
 * in the mouth itself, so the stream visibly flows into the pond.
 */

/** Keep-clear half-angle (rad) around the stream mouth. */
export const MOUTH_CLEAR = 0.5;

export interface PondPlants {
  lilies: PropInstance[];
  reeds: PropInstance[];
  irises: PropInstance[];
  ferns: PropInstance[];
}

export function pondPlants(pond: Pond, river: River | null, terrain: Terrain): PondPlants {
  const f = pondFrame(pond, river);
  const rnd = (a: number, b: number) => hash3(a, b, 41.7);
  const clearOfMouth = (a: number, pad = 0) => f.mouth === null || angleGap(a, f.mouth) > MOUTH_CLEAR + pad;
  const out: PondPlants = { lilies: [], reeds: [], irises: [], ferns: [] };
  const put = (list: PropInstance[], a: number, rho: number, scale: number, seed: number, floating = false) => {
    const n = pondPoint(pond, f, a, rho);
    // the terrain already includes the pond bowl
    list.push({ n, scale, yaw: rnd(seed, 9) * Math.PI * 2, tint: rnd(seed, 10), h: floating ? RIVER_WATER_U + 0.006 : Math.max(terrain.height(n), RIVER_WATER_U - 0.12) });
  };

  // shore groups around the pond at irregular angles, each a mix that grades from water to bank
  const groups = 6;
  const phase = rnd(1, 1) * Math.PI * 2;
  for (let g = 0; g < groups; g++) {
    const a0 = phase + ((g + (rnd(2, g) - 0.5) * 0.55) / groups) * Math.PI * 2;
    if (!clearOfMouth(a0, 0.2)) continue;
    const count = 3 + Math.floor(rnd(3, g) * 3);
    for (let k = 0; k < count; k++) {
      const s = g * 10 + k;
      const a = a0 + (rnd(4, s) - 0.5) * 0.5;
      if (!clearOfMouth(a)) continue;
      const r = shoreRadius(pond, f, a);
      const pick = rnd(5, s);
      if (pick < 0.45) put(out.reeds, a, r - 0.28 + rnd(6, s) * 0.3, 0.85 + rnd(7, s) * 0.45, s);
      else if (pick < 0.72) put(out.irises, a, r - 0.08 + rnd(6, s) * 0.28, 0.8 + rnd(7, s) * 0.35, s);
      else put(out.ferns, a, r + 0.22 + rnd(6, s) * 0.35, 0.8 + rnd(7, s) * 0.4, s);
    }
  }
  // reeds flanking the stream mouth, as on a real inflow
  if (f.mouth !== null) {
    for (const side of [-1, 1]) {
      for (let k = 0; k < 2; k++) {
        const s = 200 + (side + 1) * 5 + k;
        const a = f.mouth + side * (MOUTH_CLEAR + 0.08 + k * 0.16);
        put(out.reeds, a, shoreRadius(pond, f, a) - 0.12 + rnd(6, s) * 0.2, 0.9 + rnd(7, s) * 0.3, s);
      }
    }
  }
  // floating lily-pad clusters on the open water, away from where the stream comes in
  const pads = 5;
  for (let i = 0; i < pads; i++) {
    const s = 300 + i;
    const a = phase + 0.4 + (i / pads) * Math.PI * 2 + (rnd(8, s) - 0.5) * 0.7;
    if (!clearOfMouth(a, 0.1)) continue;
    put(out.lilies, a, shoreRadius(pond, f, a) * (0.25 + rnd(6, s) * 0.45), 0.5 + rnd(7, s) * 0.3, s, true);
  }
  return out;
}
