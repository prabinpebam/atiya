import { Vector3 } from 'three';
import { CONFIG } from '../config';
import { UP, arcDistance, pointArcDistance } from '../math/sphere';
import type { LandmarkGeometry } from '../math/landmarks';
import { mesaPolar, mesaRadius, riverDistance, tierEdge, tierPolar, type Bridge, type Mesa, type River } from './features';
import { pondAngle, pondBasin, pondFrame, shoreRadius, type PondFrame } from './pond';

/**
 * Ground height above the base sphere (u), as a pure function of the planet-local direction.
 * Mild rolling undulation that flattens at the plaza, landmarks, paths, pond and river banks;
 * a carved river bed and pond bowl; flat-topped rocky mesas. `walkHeight` adds the arched bridge
 * deck, and `waterDepth` says how deep the character is wading.
 */

export const UNDULATION_U = 0.38;
export const RIVER_BED_U = -0.34;
/** Water surface of the river (u above the base sphere). */
export const RIVER_WATER_U = -0.13;
/** The character never sinks deeper than this into the water (u; ≈ knee-deep at 1.25 u tall). */
export const WADE_MAX_U = 0.3;
/** Wading is this much slower than walking on land at full depth (0..1). */
export const WADE_SLOWDOWN = 0.45;
/** Water the ribbon covers beyond the river's half-width (matches the water surface mesh). */
const RIVER_WET_U = 0.22;
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

/**
 * Per-landmark bounds for `flatMask`: beyond each outer radius the factor is exactly 1, so a dot
 * product (no `acos`, no allocation) settles most of the ~35 k ground vertices without the arc maths.
 */
interface LandmarkBounds {
  g: LandmarkGeometry;
  /** cos of the footprint mask's outer angle: n·g.n below it → factor 1. */
  cosFoot: number;
  /** cos of the approach mask's outer angle. */
  cosApproach: number;
  /** Midpoint of the plaza → approach path and cos(half its length + the path mask's outer radius). */
  mid: Vector3;
  cosPath: number;
}

const cosOf = (angle: number) => Math.cos(Math.min(Math.PI, angle));

export class Terrain {
  private readonly R: number;
  private readonly pondF: PondFrame | null;
  private readonly bounds: LandmarkBounds[];

  constructor(
    landmarks: readonly LandmarkGeometry[],
    readonly features: TerrainFeatures,
    cfg = CONFIG,
  ) {
    this.R = cfg.planetRadius;
    this.pondF = features.pond ? pondFrame(features.pond, features.river) : null;
    const R = this.R;
    this.bounds = landmarks.map((g) => {
      // any point of the path is within half its length of its midpoint, so a point farther than
      // that plus 1.5 u from the midpoint is more than 1.5 u from the path
      const half = arcDistance(UP as Vector3, g.approach, 1) / 2;
      const mid = new Vector3().addVectors(UP as Vector3, g.approach);
      if (mid.lengthSq() < 1e-12) mid.copy(g.approach);
      mid.normalize();
      return { g, cosFoot: cosOf((g.footprintU + 2.3) / R), cosApproach: cosOf(1.9 / R), mid, cosPath: cosOf(half + 1.5 / R) };
    });
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
    for (const b of this.bounds) {
      const g = b.g;
      if (n.dot(g.n) >= b.cosFoot) m *= smoothstep(g.footprintU + 0.6, g.footprintU + 2.3, arcDistance(n, g.n, R));
      if (n.dot(g.approach) >= b.cosApproach) m *= smoothstep(0.7, 1.9, arcDistance(n, g.approach, R));
      // paths keep a little of the roll so they follow the land
      if (n.dot(b.mid) >= b.cosPath) m *= 0.3 + 0.7 * smoothstep(0.45, 1.5, pointArcDistance(n, UP as Vector3, g.approach, R));
      if (m === 0) return 0;
    }
    const pond = this.features.pond;
    if (pond) m *= smoothstep(pond.radiusU + 0.35, pond.radiusU + 2.0, arcDistance(n, pond.n, R));
    if (this.features.river) m *= smoothstep(0.75, 2.4, riverD);
    return m;
  }

  /** Ground-mesh height (u above the base sphere) at planet-local direction `n` (`rd`: its `riverDistance`, if already known). */
  height(n: Vector3, rd?: { d: number; i: number }): number {
    const river = this.features.river;
    rd ??= river ? riverDistance(river, n) : { d: Infinity, i: 0 };
    let h = this.undulation(n) * this.flatMask(n, rd.d);
    if (river && rd.d < 2) {
      const hw = river.halfWidth[rd.i];
      h += RIVER_BED_U * (1 - smoothstep(hw * 0.55, hw + 0.42, rd.d));
    }
    const pond = this.features.pond;
    if (pond && this.pondF) {
      const d = arcDistance(n, pond.n, this.R);
      // the bowl ends 0.15 u past the (at most ≈ 1.19 × radius) lobed shore; where it meets the
      // stream bed at the mouth the deeper of the two wins, so they don't stack into a hole
      if (d < pond.radiusU * 1.2 + 0.2) {
        const bowl = pondBasin(d, shoreRadius(pond, this.pondF, pondAngle(pond, this.pondF, n)));
        if (bowl > 0) h = Math.min(h, -bowl);
      }
    }
    for (const m of this.features.mesas) h = Math.max(h, this.mesaHeight(m, n));
    return h;
  }

  /** Shoreline radius (u) of the pond in the direction of `n` (the nominal radius without a pond frame). */
  pondShore(n: Vector3): number {
    const pond = this.features.pond;
    if (!pond) return 0;
    return this.pondF ? shoreRadius(pond, this.pondF, pondAngle(pond, this.pondF, n)) : pond.radiusU;
  }

  /** True where `n` is under the stream or pond surface (not on a bridge deck). */
  inWater(n: Vector3): boolean {
    if (this.deckHeight(n) > -Infinity) return false;
    const river = this.features.river;
    if (river) {
      const rd = riverDistance(river, n);
      if (rd.d < river.halfWidth[rd.i] + RIVER_WET_U) return true;
    }
    const pond = this.features.pond;
    return pond !== null && arcDistance(n, pond.n, this.R) < this.pondShore(n) + 0.3;
  }

  /** How deep the character stands in water at `n` (u; 0 on land and on bridges). */
  waterDepth(n: Vector3): number {
    if (!this.inWater(n)) return 0;
    return Math.min(WADE_MAX_U, Math.max(0, RIVER_WATER_U - this.height(n)));
  }

  private mesaHeight(m: Mesa, n: Vector3): number {
    const R = this.R;
    const d = arcDistance(n, m.n, R);
    if (d > m.radiusU * 1.3) return -Infinity;
    const { angle } = mesaPolar(m, n);
    const edge = mesaRadius(m.radiusU, m.seed, angle);
    // flat top with a slight dome, falling steeply just *inside* the (cliff-covered) rim, so the
    // painted cliff wall, not the displaced ground, is what you see
    let h = m.heightU * (1 - smoothstep(edge - 0.22, edge - 0.02, d)) + 0.04 * (1 - d / edge);
    if (m.tier) {
      const { r: dt, angle: ta } = tierPolar(m, n);
      const te = tierEdge(m.tier, ta);
      h += m.tier.heightU * (1 - smoothstep(te - 0.2, te - 0.02, dt));
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

  /**
   * Height the character stands at: the ground (the river bed or pond floor when wading, never
   * more than WADE_MAX_U under the surface), or the bridge deck where it's higher.
   */
  walkHeight(n: Vector3): number {
    const deck = this.deckHeight(n);
    const h = this.height(n);
    if (deck > -Infinity) return Math.max(h, deck);
    return this.inWater(n) ? Math.max(h, RIVER_WATER_U - WADE_MAX_U) : h;
  }
}

/** Speed multiplier for wading at `depth` u: 1 on land, easing down to 1 − WADE_SLOWDOWN in deep water. */
export function wadeSpeedFactor(depth: number): number {
  return 1 - WADE_SLOWDOWN * smoothstep(0.02, 0.22, depth);
}

/** Arched deck profile: plank-top height (u) at `t` along a bridge of half-length `half`. */
export function bridgeArch(t: number, half: number): number {
  return 0.07 + 0.3 * Math.cos((Math.PI / 2) * Math.min(1, Math.abs(t) / half));
}
