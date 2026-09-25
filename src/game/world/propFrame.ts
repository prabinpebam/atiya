import { Matrix4, Quaternion, Vector3 } from 'three';
import type { PropInstance } from './layout';

const Y = new Vector3(0, 1, 0);
const _q = new Quaternion();
const _yaw = new Quaternion();
const _s = new Vector3();
const _p = new Vector3();

/** A prop's placement (as `Props.tsx` draws it): its planet-local rotation and base position. */
export function propFrame(it: PropInstance, R: number, lift = -0.02, q = new Quaternion(), p = new Vector3()): { q: Quaternion; p: Vector3 } {
  q.setFromUnitVectors(Y, it.n);
  _yaw.setFromAxisAngle(Y, it.yaw);
  q.multiply(_yaw);
  p.copy(it.n).multiplyScalar(R + (it.h ?? 0) + lift);
  return { q, p };
}

/** Planet-local position of a point given in a prop's own frame (at scale 1). */
export function propPoint(it: PropInstance, local: readonly [number, number, number], R: number, out = new Vector3()): Vector3 {
  const { q, p } = propFrame(it, R, -0.02, _q, _p);
  return out.set(local[0], local[1], local[2]).multiplyScalar(it.scale).applyQuaternion(q).add(p);
}

/**
 * A prop's instance matrix with an extra tilt (rad, about its local x and z axes), a sideways nudge
 * (planet-local) and a scale multiplier: tree wobble, boulder shudder, regrowth pop.
 */
export function propMatrix(it: PropInstance, R: number, lift: number, out: Matrix4, tiltX = 0, tiltZ = 0, scaleK = 1, nudge?: Vector3): Matrix4 {
  const { q, p } = propFrame(it, R, lift, _q, _p);
  if (tiltX || tiltZ) {
    _yaw.setFromAxisAngle(new Vector3(1, 0, 0), tiltX);
    q.multiply(_yaw);
    _yaw.setFromAxisAngle(new Vector3(0, 0, 1), tiltZ);
    q.multiply(_yaw);
  }
  if (nudge) p.add(nudge);
  _s.setScalar(it.scale * scaleK);
  return out.compose(p, q, _s);
}
