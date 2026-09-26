import { Matrix4, Quaternion, Vector3 } from 'three';

export const UP: Readonly<Vector3> = new Vector3(0, 1, 0);
export const DEG = Math.PI / 180;
const EPS = 1e-9;

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Planet-local convention: lat 90° is the spawn pole (+Y); lon 0° points "ahead" of the
 * spawn camera (−Z), lon 90° to screen-right (+X).
 */
export function latLonToVec(latDeg: number, lonDeg: number, out = new Vector3()): Vector3 {
  const lat = latDeg * DEG;
  const lon = lonDeg * DEG;
  return out.set(Math.cos(lat) * Math.sin(lon), Math.sin(lat), -Math.cos(lat) * Math.cos(lon));
}

export function vecToLatLon(v: Vector3): { lat: number; lon: number } {
  const n = v.clone().normalize();
  return { lat: Math.asin(clamp(n.y, -1, 1)) / DEG, lon: Math.atan2(n.x, -n.z) / DEG };
}

export function angleBetween(a: Vector3, b: Vector3): number {
  return Math.acos(clamp(a.dot(b), -1, 1));
}

export function arcDistance(a: Vector3, b: Vector3, radius: number): number {
  return radius * angleBetween(a, b);
}

/** Unit tangent at `p` along the great circle toward `t`; null when degenerate (same or antipodal point). */
export function tangentToward(p: Vector3, t: Vector3, out = new Vector3()): Vector3 | null {
  out.copy(t).addScaledVector(p, -t.dot(p));
  const len = out.length();
  if (len < 1e-7) return null;
  return out.multiplyScalar(1 / len);
}

/** Unit tangent at `p` pointing away from `n` (outward from an obstacle centred at `n`). */
export function tangentAwayFrom(p: Vector3, n: Vector3, out = new Vector3()): Vector3 | null {
  out.copy(p).multiplyScalar(p.dot(n)).sub(n);
  const len = out.length();
  if (len < 1e-7) return null;
  return out.multiplyScalar(1 / len);
}

/** Point reached by walking from unit `p` along unit tangent `d` by arc angle `theta`. */
export function moveAlong(p: Vector3, d: Vector3, theta: number, out = new Vector3()): Vector3 {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return out.set(p.x * c + d.x * s, p.y * c + d.y * s, p.z * c + d.z * s).normalize();
}

/** Rotate tangent `t` about normal `n` by `angle` (right-hand rule). */
export function rotateTangent(t: Vector3, n: Vector3, angle: number, out = new Vector3()): Vector3 {
  const q = new Quaternion().setFromAxisAngle(n, angle);
  return out.copy(t).applyQuaternion(q);
}

/** Local "north" tangent at `n` (toward the spawn pole). Falls back to −Z near the poles. */
export function localNorth(n: Vector3, out = new Vector3()): Vector3 {
  return tangentToward(n, UP as Vector3, out) ?? tangentToward(n, new Vector3(0, 0, -1), out) ?? out.set(0, 0, -1);
}

/** Frame-rate-independent exponential approach. `lambda` in 1/s. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return target + (current - target) * Math.exp(-lambda * dt);
}

export function wrapAngle(a: number): number {
  let r = (a + Math.PI) % (Math.PI * 2);
  if (r < 0) r += Math.PI * 2;
  return r - Math.PI;
}

/** Damp an angle along the shortest arc. */
export function dampAngle(current: number, target: number, halfLife: number, dt: number): number {
  const delta = wrapAngle(target - current);
  const lambda = Math.LN2 / Math.max(halfLife, 1e-4);
  return wrapAngle(current + delta * (1 - Math.exp(-lambda * dt)));
}

/**
 * Planet orientation that puts planet-local point `a` at the top (world +Y) with the
 * planet-local tangent `f` pointing to screen-up (world −Z).
 */
export function orientationFor(a: Vector3, f: Vector3, out = new Quaternion()): Quaternion {
  const u = a.clone().normalize();
  const fwd = f.clone().addScaledVector(u, -f.dot(u)).normalize();
  const right = new Vector3().crossVectors(fwd, u);
  const m = new Matrix4().makeBasis(right, u, fwd.clone().negate());
  return out.setFromRotationMatrix(m).invert();
}

/** Player position on the unit sphere in planet-local space. */
export function playerLocal(planetQ: Quaternion, out = new Vector3()): Vector3 {
  return out.copy(UP).applyQuaternion(planetQ.clone().invert());
}

/** Arc distance (world units) from `p` to the great-circle segment a→b (all unit vectors). */
export function pointArcDistance(p: Vector3, a: Vector3, b: Vector3, radius: number): number {
  const m = new Vector3().crossVectors(a, b);
  const len = m.length();
  if (len < 1e-9) return arcDistance(p, a, radius);
  m.multiplyScalar(1 / len);
  const q = p.clone().addScaledVector(m, -p.dot(m));
  if (q.lengthSq() > 1e-12) {
    q.normalize();
    const ab = angleBetween(a, b);
    if (Math.abs(angleBetween(a, q) + angleBetween(q, b) - ab) < 1e-6) {
      return radius * Math.asin(clamp(Math.abs(p.dot(m)), 0, 1));
    }
  }
  return Math.min(arcDistance(p, a, radius), arcDistance(p, b, radius));
}

export interface Obstacle {
  /** Planet-local unit vector of the centre. */
  n: Vector3;
  /** Footprint radius in world units. */
  radiusU: number;
  /** Part of a mesa's collision ring (its top is still a lawn: the grass ignores these). */
  mesa?: boolean;
}

export interface CollisionParams {
  radius: number;
  playerRadius: number;
  skin: number;
}

function expandedAngle(o: Obstacle, c: CollisionParams): number {
  return (o.radiusU + c.playerRadius + c.skin) / c.radius;
}

/**
 * Remove velocity components that push into touching obstacles (iterative projection).
 * `v` and the result are planet-local tangent vectors at `p`. Returns zero when wedged.
 */
export function slideVelocity(
  v: Vector3,
  p: Vector3,
  obstacles: readonly Obstacle[],
  c: CollisionParams,
  out = new Vector3(),
): Vector3 {
  out.copy(v);
  const normals: Vector3[] = [];
  for (const o of obstacles) {
    if (angleBetween(p, o.n) <= expandedAngle(o, c) + 1e-4) {
      const t = tangentAwayFrom(p, o.n);
      if (t) normals.push(t);
    }
  }
  if (normals.length === 0) return out;
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (const t of normals) {
      const d = out.dot(t);
      if (d < -EPS) {
        out.addScaledVector(t, -d);
        changed = true;
      }
    }
    if (!changed) break;
  }
  for (const t of normals) {
    if (out.dot(t) < -1e-6) return out.set(0, 0, 0);
  }
  return out;
}

/** If `p` is inside any expanded obstacle, return the corrected point on its boundary; otherwise null. */
export function resolvePenetration(p: Vector3, obstacles: readonly Obstacle[], c: CollisionParams): Vector3 | null {
  let current = p.clone();
  let moved = false;
  for (let pass = 0; pass < 3; pass++) {
    let any = false;
    for (const o of obstacles) {
      const beta = expandedAngle(o, c);
      const ang = angleBetween(current, o.n);
      if (ang < beta - 1e-7) {
        const w = tangentToward(o.n, current) ?? localNorth(o.n);
        current = moveAlong(o.n, w, beta);
        any = true;
        moved = true;
      }
    }
    if (!any) break;
  }
  return moved ? current : null;
}
