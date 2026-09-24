import { Vector3 } from 'three';
import { CONFIG } from '../config';
import { UP, arcDistance, pointArcDistance } from '../math/sphere';
import type { LandmarkGeometry } from '../math/landmarks';
import { mesaPolar, mesaRadius, riverDistance, type Bridge, type Mesa, type River } from './features';

/**
 * Ground height above the base sphere (u), as a pure function of the planet-local direction.
 * Mild rolling undulation that flattens at the plaza, landmarks, paths, pond and river banks;
 * a carved river bed; flat-topped rocky mesas. `walkHeight` adds the arched bridge deck.
 */

export const UNDULATION_U = 0.38;
export const RIVER_BED_U = -0.34;
/** Water surface of the river (u above the base sphere). */
export const RIVER_WATER_U = -0.13;
const PLAZA_FLAT_U = 3.2;

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function hash(x: number, y: number, z: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth 3D value noise in [0, 1]. */
export function valueNoise(x: number, y: number, z: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const f = (t: number) => t * t * (3 - 2 * t);
  const u = f(x - xi);
  const v = f(y - yi);
  const w = f(z - zi);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => hash(xi + dx, yi + dy, zi + dz);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}

export interface TerrainFeatures {
  pond: { n: Vector3; radiusU: number } | null;
  river: River | null;
  bridges: Bridge[];
  mesas: Mesa[];
}

export class Terrain {
  private readonly R: number;

  constructor(
    private readonly landmarks: readonly LandmarkGeometry[],
    readonly features: TerrainFeatures,
    cfg = CONFIG,
  ) {
    this.R = cfg.planetRadius;
  }

  /** Rolling hills in [−A, A] before masking. */
  undulation(n: Vector3): number {
    const a = valueNoise(n.x * 2.3 + 11.1, n.y * 2.3 + 3.7, n.z * 2.3 + 7.3);
    const b = valueNoise(n.x * 5.1 + 1.3, n.y * 5.1 + 9.9, n.z * 5.1 + 4.2);
    return (((a - 0.5) * 2) * 0.75 + ((b - 0.5) * 2) * 0.25) * UNDULATION_U * 1.6;
  }

  /** 0 where the ground must be flat (plaza, landmarks, pond, banks), 1 in open country. */
  flatMask(n: Vector3, riverD = Infinity): number {
    const R = this.R;
    let m = smoothstep(PLAZA_FLAT_U, PLAZA_FLAT_U + 2.2, arcDistance(n, UP as Vector3, R));
    if (m === 0) return 0;
    for (const g of this.landmarks) {
      m *= smoothstep(g.footprintU + 0.6, g.footprintU + 2.3, arcDistance(n, g.n, R));
      m *= smoothstep(0.7, 1.9, arcDistance(n, g.approach, R));
      // paths keep a little of the roll so they follow the land
      m *= 0.3 + 0.7 * smoothstep(0.45, 1.5, pointArcDistance(n, UP as Vector3, g.approach, R));
      if (m === 0) return 0;
    }
    const pond = this.features.pond;
    if (pond) m *= smoothstep(pond.radiusU + 0.35, pond.radiusU + 2.0, arcDistance(n, pond.n, R));
    if (this.features.river) m *= smoothstep(0.75, 2.4, riverD);
    return m;
  }

  /** Ground-mesh height (u above the base sphere) at planet-local direction `n`. */
  height(n: Vector3): number {
    const river = this.features.river;
    const rd = river ? riverDistance(river, n) : { d: Infinity, i: 0 };
    let h = this.undulation(n) * this.flatMask(n, rd.d);
    if (river && rd.d < 2) {
      const hw = river.halfWidth[rd.i];
      h += RIVER_BED_U * (1 - smoothstep(hw * 0.55, hw + 0.42, rd.d));
    }
    for (const m of this.features.mesas) h = Math.max(h, this.mesaHeight(m, n));
    return h;
  }

  private mesaHeight(m: Mesa, n: Vector3): number {
    const R = this.R;
    const d = arcDistance(n, m.n, R);
    if (d > m.radiusU * 1.3) return -Infinity;
    const { angle } = mesaPolar(m, n);
    const edge = mesaRadius(m.radiusU, m.seed, angle);
    // flat top with a slight dome, falling steeply at the (cliff-covered) rim
    let h = m.heightU * (1 - smoothstep(edge - 0.1, edge + 0.12, d)) + 0.04 * (1 - d / edge);
    if (m.tier) {
      const dt = arcDistance(n, m.tier.n, R);
      const ta = mesaPolar({ n: m.tier.n, north: m.north, east: m.east }, n).angle;
      const te = mesaRadius(m.tier.radiusU, m.seed + 2.2, ta);
      h += m.tier.heightU * (1 - smoothstep(te - 0.08, te + 0.1, dt));
    }
    return d > edge + 0.12 ? -Infinity : h;
  }

  /** Bridge deck height at `n` (or −∞ off the bridge). */
  deckHeight(n: Vector3): number {
    let best = -Infinity;
    for (const b of this.features.bridges) {
      const d = new Vector3().subVectors(n, b.n);
      const t = d.dot(b.along) * this.R;
      const s = d.dot(b.across) * this.R;
      if (Math.abs(t) > b.halfLengthU || Math.abs(s) > b.halfWidthU) continue;
      best = Math.max(best, bridgeArch(t, b.halfLengthU));
    }
    return best;
  }

  /** Height the character stands at: the ground, or the bridge deck where it's higher. */
  walkHeight(n: Vector3): number {
    return Math.max(this.height(n), this.deckHeight(n));
  }
}

/** Arched deck profile: plank-top height (u) at `t` along a bridge of half-length `half`. */
export function bridgeArch(t: number, half: number): number {
  return 0.07 + 0.3 * Math.cos((Math.PI / 2) * Math.min(1, Math.abs(t) / half));
}
