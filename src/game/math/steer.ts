/**
 * Steering helpers for tangent directions on the planet (shared by the wildlife, Chopper and the
 * family): keep a direction tangent as its point moves, rotate it about the surface normal, and
 * turn it toward another at a limited rate.
 */
import { Vector3 } from 'three';
import { tangentToward } from './sphere';

const _t = new Vector3();
const _u = new Vector3();

/** Carry a heading over to the tangent plane at `n` (after a step), keeping it unit length. */
export function transport(dir: Vector3, n: Vector3): Vector3 {
  dir.addScaledVector(n, -dir.dot(n));
  const l = dir.length();
  if (l < 1e-9) return tangentToward(n, n.x < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 0, 1), dir)!;
  return dir.multiplyScalar(1 / l);
}

/** Rotate tangent `dir` about the normal `n` by `angle` (rad). */
export function rotateAbout(dir: Vector3, n: Vector3, angle: number): Vector3 {
  _t.crossVectors(n, dir);
  return dir.multiplyScalar(Math.cos(angle)).addScaledVector(_t, Math.sin(angle)).normalize();
}

/** Turn `dir` toward the tangent `desired` by at most `maxAngle` (rad). */
export function turnToward(dir: Vector3, n: Vector3, desired: Vector3, maxAngle: number): Vector3 {
  const cos = Math.min(1, Math.max(-1, dir.dot(desired)));
  const angle = Math.acos(cos);
  if (angle < 1e-6) return dir;
  const side = Math.sign(_u.crossVectors(dir, desired).dot(n)) || 1;
  return rotateAbout(dir, n, side * Math.min(angle, maxAngle));
}

