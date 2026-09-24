import { Quaternion, Vector3 } from 'three';
import { CONFIG } from '../config';
import type { River } from './features';

/**
 * Pond shape (pure; unit-tested): the tangent frame at its centre, the lobed shoreline and the
 * bowl carved into the ground. Shared by the terrain, the ground mesh, the water surface, the
 * plants and prop placement, so they all agree on where the water is.
 */

const Y = new Vector3(0, 1, 0);

export interface PondShape {
  n: Vector3;
  radiusU: number;
}

export interface PondFrame {
  tan: Vector3;
  bit: Vector3;
  /** Direction the stream enters from (radians in the tan/bit plane), or null without a river. */
  mouth: number | null;
}

/** Tangent frame at the pond centre, shared by the water surface and the plants. */
export function pondFrame(pond: PondShape, river: River | null): PondFrame {
  const q = new Quaternion().setFromUnitVectors(Y, pond.n);
  const tan = new Vector3(1, 0, 0).applyQuaternion(q);
  const bit = new Vector3().crossVectors(pond.n, tan);
  let mouth: number | null = null;
  if (river) {
    const target = river.lengthU - 1.4;
    const i = Math.max(0, river.along.findIndex((s) => s >= target));
    const d = new Vector3().subVectors(river.samples[i], pond.n);
    mouth = Math.atan2(d.dot(bit), d.dot(tan));
  }
  return { tan, bit, mouth };
}

/** Planet-local unit vector at polar (angle `a`, distance `rho` u) around the pond centre. */
export function pondPoint(pond: PondShape, f: PondFrame, a: number, rho: number, R = CONFIG.planetRadius): Vector3 {
  return pond.n
    .clone()
    .addScaledVector(f.tan, (Math.cos(a) * rho) / R)
    .addScaledVector(f.bit, (Math.sin(a) * rho) / R)
    .normalize();
}

/** Smallest absolute difference between two angles. */
export function angleGap(a: number, b: number): number {
  let d = Math.abs(a - b) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
}

/**
 * Organic shoreline: the pond's effective radius (u) at polar angle `a`. A few low harmonics
 * give a soft kidney/lobed outline; it relaxes to the nominal radius at the stream mouth so the
 * river always meets the same water edge.
 */
export function shoreRadius(pond: PondShape, f: PondFrame, a: number): number {
  const w = 0.09 * Math.sin(2 * a + 1.3) + 0.06 * Math.sin(3 * a + 4.1) + 0.035 * Math.sin(5 * a + 2.2);
  let keep = 1;
  if (f.mouth !== null) {
    const t = Math.min(1, Math.max(0, (angleGap(a, f.mouth) - 0.35) / 0.5));
    keep = t * t * (3 - 2 * t);
  }
  return pond.radiusU * (1 + w * keep);
}

/** Polar angle (radians in the pond frame) of planet-local unit vector `n` around the pond centre. */
export function pondAngle(pond: PondShape, f: PondFrame, n: Vector3): number {
  const dx = n.x - pond.n.x;
  const dy = n.y - pond.n.y;
  const dz = n.z - pond.n.z;
  return Math.atan2(dx * f.bit.x + dy * f.bit.y + dz * f.bit.z, dx * f.tan.x + dy * f.tan.y + dz * f.tan.z);
}

/** Pond bowl depth (u) at the centre; the pond shares the stream's water level (RIVER_WATER_U). */
export const POND_DEPTH_U = 0.4;

/** Extra depth of the pond bowl at distance `d` (u) from its centre: the shoreline lands just inside the rim. */
export function pondBasin(d: number, radiusU: number): number {
  const t = 1 - Math.min(1, Math.max(0, (d - (radiusU - 0.5)) / 0.65));
  return POND_DEPTH_U * t;
}
