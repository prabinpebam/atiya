/**
 * Pure cloud-ring layout (shared by the Clouds component and the tests).
 *
 * The clouds orbit the little planet on rings concentric with it as the camera sees it. Each cloud
 * sits at a fixed angle `alpha` from the camera → planet-centre axis (a circle round the planet's
 * outline on screen) and a fixed distance from the camera, and travels round that circle. The
 * rings are rebuilt from the camera position each frame, so they stay concentric at any tilt and
 * during a fly-over. They're closed, so a cloud never wraps, pops or needs fading:
 *  - the inner ring hugs the horizon (the planet's outline is 22.8–26.1° from the axis);
 *  - a sparser outer ring fills the sky that a wide or ultrawide window adds at the sides.
 * Every cloud is further out than the planet's outline (so it never covers the planet) and nearer
 * than the sun, moon and stars (≥ 68 u), which stay behind it.
 */
import { Matrix4, Quaternion, Vector3 } from 'three';
import { mulberry32 } from './layout';

export interface CloudRing {
  count: number;
  /** Angle from the camera → planet-centre axis (deg). */
  alphaDeg: [number, number];
}

export const CLOUD_RINGS: readonly CloudRing[] = [
  // painted sprites cost two triangles each, so the sky can be as full as the art direction's
  { count: 32, alphaDeg: [29, 37] },
  { count: 22, alphaDeg: [41, 60] },
];
export const CLOUD_COUNT = CLOUD_RINGS.reduce((n, r) => n + r.count, 0);
/** Distance of a cloud from the camera (u). */
export const CLOUD_DIST: [number, number] = [46, 56];
/** Drift speed along the orbit (u/s). */
export const CLOUD_SPEED: [number, number] = [0.12, 0.24];

export interface RingFrame {
  cam: Vector3;
  /** Unit axis from the planet centre toward the camera. */
  axis: Vector3;
  /** Screen-right and screen-up directions square to the axis. */
  right: Vector3;
  up: Vector3;
}

/** Ring basis for a camera position (the planet centre is the world origin; the camera's yaw is fixed). */
export function ringFrame(cam: Vector3, out?: RingFrame): RingFrame {
  const f = out ?? { cam: new Vector3(), axis: new Vector3(), right: new Vector3(), up: new Vector3() };
  f.cam.copy(cam);
  f.axis.copy(cam).normalize();
  f.right.set(1, 0, 0).addScaledVector(f.axis, -f.axis.x).normalize();
  f.up.crossVectors(f.axis, f.right);
  return f;
}

/** Radius (u) of a cloud's orbit round the axis. */
export function orbitRadius(alphaDeg: number, dist: number): number {
  return dist * Math.sin((alphaDeg * Math.PI) / 180);
}

/**
 * World position of a cloud at orbit angle `theta` (0 = screen-right, π/2 = over the top). Clouds
 * move clockwise: θ decreases over time, so they cross the top from left to right.
 */
export function cloudPosition(frame: RingFrame, theta: number, alphaDeg: number, dist: number, out = new Vector3()): Vector3 {
  const a = (alphaDeg * Math.PI) / 180;
  const r = dist * Math.sin(a);
  return out
    .copy(frame.cam)
    .addScaledVector(frame.axis, -dist * Math.cos(a))
    .addScaledVector(frame.right, r * Math.cos(theta))
    .addScaledVector(frame.up, r * Math.sin(theta));
}

const _m = new Matrix4();
const _rad = new Vector3();
const _tan = new Vector3();

/** Orientation for a cloud at `theta`: facing the camera, its base toward the planet. */
export function cloudOrientation(frame: RingFrame, theta: number, out = new Quaternion()): Quaternion {
  _rad.copy(frame.right).multiplyScalar(Math.cos(theta)).addScaledVector(frame.up, Math.sin(theta));
  _tan.crossVectors(_rad, frame.axis);
  return out.setFromRotationMatrix(_m.makeBasis(_tan, _rad, frame.axis));
}

const _toCam = new Vector3();
const _upv = new Vector3();
const _side = new Vector3();

/**
 * How much a painted cloud turns with its orbit (0 = upright on screen, 1 = its base toward the
 * planet). 1: each cloud lies along its ring, part of the circle round the little planet.
 */
export const CLOUD_LEAN = 1;

/**
 * Billboard orientation for a painted cloud sprite at `pos` (orbit angle `theta`): its face turned
 * straight at the camera (so it never looks squashed, even far off the axis), turned with the ring
 * round the planet (`CLOUD_LEAN`), so its base faces the planet all the way round.
 */
export function cloudBillboard(frame: RingFrame, theta: number, pos: Vector3, out = new Quaternion()): Quaternion {
  _toCam.copy(frame.cam).sub(pos).normalize();
  _upv.copy(frame.right).multiplyScalar(Math.cos(theta) * CLOUD_LEAN).addScaledVector(frame.up, Math.sin(theta) * CLOUD_LEAN + (1 - CLOUD_LEAN));
  _upv.addScaledVector(_toCam, -_upv.dot(_toCam)).normalize();
  _side.crossVectors(_upv, _toCam);
  return out.setFromRotationMatrix(_m.makeBasis(_side, _upv, _toCam));
}

/** Which painted sprite each cloud uses (atlas cell: 0 big cumulus, 1 towering, 2 small puffs, 3 flat wisp), mostly cumulus. */
export const CLOUD_VARIANTS = [0, 2, 1, 0, 3, 2, 0, 1, 2, 3, 0, 1] as const;

export interface Cloud {
  theta: number;
  alpha: number;
  dist: number;
  scale: number;
  speed: number;
}

/** The seeded clouds: spread evenly round each ring, with jittered angles, distances, sizes and speeds. */
export function cloudLayout(seed = 11): Cloud[] {
  const lerp = ([a, b]: [number, number], t: number) => a + (b - a) * t;
  // each ring has its own seed, so resizing one ring doesn't reshuffle the others
  return CLOUD_RINGS.flatMap((ring, r) => {
    const rand = mulberry32(seed + r * 101);
    return Array.from({ length: ring.count }, (_, i) => ({
      theta: (Math.PI * 2 * (i + rand() * 0.6)) / ring.count,
      alpha: lerp(ring.alphaDeg, rand()),
      dist: lerp(CLOUD_DIST, rand()),
      scale: 1.0 + rand() * 1.1,
      speed: lerp(CLOUD_SPEED, rand()),
    }));
  });
}

/** Drift every cloud clockwise round its orbit for `dt` seconds. */
export function driftClouds(clouds: Cloud[], dt: number): void {
  for (const c of clouds) c.theta = (c.theta - (c.speed * dt) / orbitRadius(c.alpha, c.dist)) % (Math.PI * 2);
}
