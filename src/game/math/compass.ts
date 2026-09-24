import { Quaternion, Vector3 } from 'three';
import { playerLocal } from './sphere';

/**
 * Map north. The spawn plaza sits on the planet's pole (+Y), where geographic north is undefined,
 * so the compass uses a stereographic "map grid" centred on the plaza instead: at the plaza north
 * points toward the Workshop (−Z), and the field is smooth everywhere except the unvisited far
 * pole (−Y). Like a flat map of the planet, north/east/south/west stay consistent while you walk.
 */
export function mapNorth(p: Vector3, out = new Vector3()): Vector3 {
  const n = p.clone().normalize();
  const d = 1 + n.y;
  if (d < 1e-6) return out.set(0, 0, -1); // far pole: undefined, pick a stable direction
  const u = n.x / d;
  const v = n.z / d;
  // −∂p/∂v of the inverse stereographic projection (tangent to the sphere, conformal)
  out.set(2 * u * v, 2 * v, -(1 + u * u - v * v));
  return out.addScaledVector(n, -out.dot(n)).normalize();
}

/**
 * Screen angle of north (radians, clockwise from screen-up) for the player's current spot.
 * Screen-up is world −Z and screen-right is world +X for the fixed-yaw rig.
 */
export function northScreenAngle(planetQ: Quaternion, pLocal = playerLocal(planetQ)): number {
  const w = mapNorth(pLocal).applyQuaternion(planetQ);
  return Math.atan2(w.x, -w.z);
}

const POINTS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'] as const;
export type CompassPoint = (typeof POINTS)[number];

/** Bearing (degrees, 0 = north, clockwise) of the direction the view faces (screen-up). */
export function viewBearingDeg(northAngle: number): number {
  const deg = (-northAngle * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

export function compassPoint(bearingDeg: number): CompassPoint {
  return POINTS[Math.round((((bearingDeg % 360) + 360) % 360) / 45) % 8];
}
