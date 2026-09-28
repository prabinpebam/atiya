/**
 * The clay beds on the banks of the stream and the pond (docs: furnace.md §4.3). Pure: where they
 * go, from the water, the paths and everything that stands or grows nearby (unit-tested against the
 * real layout). The crafting chunk draws them and makes them targets.
 */
import { Vector3 } from 'three';
import { arcDistance, moveAlong, pointArcDistance, tangentToward, type Obstacle } from '../../math/sphere';
import type { Bridge, Mesa, River } from '../features';
import type { Pond } from '../layout';

/** A bed: 0.5 u across, 2 clay a dig, refilled over `regrow` s; how close you dig from, and how far apart they are. */
export const CLAY = { radiusU: 0.25, yield: 2, regrow: 75, reach: 0.8, apart: 4, perWater: 2 } as const;

export interface ClayBed {
  n: Vector3;
  /** Toward the water (the bed's front: the dig marks run down to it). */
  facing: Vector3;
  water: 'stream' | 'pond';
}

export interface ClayWorld {
  river: River | null;
  pond: Pond | null;
  inWater(n: Vector3): boolean;
  pondShore(n: Vector3): number;
  height(n: Vector3): number;
  /** What blocks, and what you use (a bed keeps away from both). */
  obstacles: readonly Obstacle[];
  targets: ReadonlyArray<{ n: Vector3; edgeU: number; kind: string }>;
  bridges: readonly Bridge[];
  mesas: readonly Mesa[];
  /** The paths, as arcs from the plaza to each building's approach. */
  paths: ReadonlyArray<readonly [Vector3, Vector3]>;
  /** Clearings kept for other features (the home's). */
  clear: ReadonlyArray<{ n: Vector3; r: number }>;
  /** The buildings: a bed stays out of their preview areas, where E opens the building's card. */
  landmarks: ReadonlyArray<{ n: Vector3; exitU: number }>;
}

/** How far out of the water a bed sits (u past where the wet edge ends). */
const OUT = [0.3, 0.45, 0.6, 0.75] as const;

export function clayBeds(w: ClayWorld, R: number): ClayBed[] {
  const out: ClayBed[] = [];
  const ok = (n: Vector3): boolean => {
    const r = CLAY.radiusU;
    if (w.inWater(n)) return false;
    if (w.paths.some(([a, b]) => pointArcDistance(n, a, b, R) < r + 0.8)) return false;
    if (w.bridges.some((b) => arcDistance(n, b.n, R) < b.halfLengthU + 1.4)) return false;
    if (w.mesas.some((m) => arcDistance(n, m.n, R) < m.radiusU + 0.8)) return false;
    if (w.clear.some((c) => arcDistance(n, c.n, R) < c.r)) return false;
    if (w.landmarks.some((g) => arcDistance(n, g.n, R) < g.exitU + 0.6)) return false;
    if (w.obstacles.some((o) => o.radiusU > 0 && arcDistance(n, o.n, R) < o.radiusU + r + 0.5)) return false;
    if (w.targets.some((t) => t.kind !== 'npc' && t.kind !== 'dog' && arcDistance(n, t.n, R) < t.edgeU + r + 0.85)) return false;
    if (out.some((b) => arcDistance(n, b.n, R) < CLAY.apart)) return false;
    // level enough to dig: the ground across the bed stays within a hand's height
    const h = w.height(n);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      const dir = tangentToward(n, new Vector3(Math.cos(a), 0.37, Math.sin(a)).normalize());
      if (dir && Math.abs(w.height(moveAlong(n, dir, r / R)) - h) > 0.12) return false;
    }
    return true;
  };
  // (a spot the water can see: just past the wet edge, the bank facing it)
  const place = (at: Vector3, toWater: Vector3, water: ClayBed['water']): boolean => {
    const away = toWater.clone().negate();
    let edge = 0;
    while (edge < 1.5 && w.inWater(moveAlong(at, away, edge / R))) edge += 0.05;
    for (const o of OUT) {
      const n = moveAlong(at, away, (edge + o) / R);
      if (!ok(n)) continue;
      out.push({ n, facing: tangentToward(n, at) ?? toWater.clone(), water });
      return true;
    }
    return false;
  };

  // the stream: both banks, from its source down, a sample every metre or so
  const river = w.river;
  if (river) {
    let found = 0;
    for (let i = 3; i < river.samples.length - 3 && found < CLAY.perWater; i += 5) {
      const c = river.samples[i];
      const across = new Vector3().crossVectors(c, river.tangent[i]).normalize();
      for (const side of [1, -1]) {
        const bank = moveAlong(c, across.clone().multiplyScalar(side), river.halfWidth[i] / R);
        if (place(bank, across.clone().multiplyScalar(-side), 'stream')) {
          found++;
          break;
        }
      }
    }
  }
  // the pond: round its shore
  const pond = w.pond;
  if (pond) {
    let found = 0;
    const east = tangentToward(pond.n, new Vector3(1, 0, 0)) ?? new Vector3(0, 0, 1);
    const north = new Vector3().crossVectors(pond.n, east).normalize();
    for (let k = 0; k < 48 && found < CLAY.perWater; k++) {
      const a = (k / 48) * Math.PI * 2;
      const dir = east.clone().multiplyScalar(Math.cos(a)).addScaledVector(north, Math.sin(a));
      const shore = moveAlong(pond.n, dir, w.pondShore(moveAlong(pond.n, dir, 1 / R)) / R);
      if (place(shore, tangentToward(shore, pond.n) ?? dir.clone().negate(), 'pond')) found++;
    }
  }
  return out;
}
