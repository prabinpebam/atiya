/**
 * The swing's pendulum (swing.md §4.5; pure, unit-tested): the seat hangs from the old oak's branch
 * on two ropes and swings across it. The wind nudges it; a push from the visitor sets it going.
 */
import { Vector3 } from 'three';

export const PENDULUM = {
  /** Gravity (u/s², the diorama's own: a 1.2 u rope swings in about 2.2 s). */
  g: 9.8,
  /** How fast a swing dies away (1/s): a big swing settles in about 12 s. */
  damping: 0.6,
  /** …and under reduced motion (a gentler push, settling in a few seconds). */
  dampingReduced: 1.6,
  /** A push's kick (rad/s). */
  push: 1.25,
  /** The furthest it swings (rad). */
  max: 0.9,
  /** How hard a full gust leans on the empty seat (rad/s²). */
  wind: 0.35,
  /** A rider's pump (rad/s, in the way it's already swinging), and the fewest seconds between two. */
  pump: 0.42,
  pumpGap: 0.45,
  /** How fast it's caught (1/s) while someone gets on or off (their feet drag). */
  brake: 6,
} as const;

export class Pendulum {
  /** The angle (rad; + toward the swing's facing) and its rate (rad/s). */
  a = 0;
  w = 0;
  private t = 0;
  private lastPump = -Infinity;

  constructor(readonly length: number) {}

  /** A push toward +1 (the swing's facing) or −1, scaled by `k`. */
  push(dir: 1 | -1, k = 1): void {
    this.w += dir * PENDULUM.push * k;
  }

  /**
   * A rider pumps (legs out on the way forward, tucked on the way back): a kick the way it's already
   * swinging (forward from still). False while still too soon after the last pump.
   */
  pump(k = 1): boolean {
    if (this.t - this.lastPump < PENDULUM.pumpGap) return false;
    this.lastPump = this.t;
    this.w += (this.w < -0.02 ? -1 : 1) * PENDULUM.pump * k;
    return true;
  }

  /** Slow it down (someone getting on or off drags their feet). */
  brake(dt: number, rate: number = PENDULUM.brake): void {
    const k = Math.exp(-rate * Math.max(0, dt));
    this.a *= k;
    this.w *= k;
  }

  /** Advance `dt` s; `gust` 0…1 leans on the seat now and then, back and forth. */
  step(dt: number, gust = 0, reduced = false): void {
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = Math.min(dt, 0.25) / steps;
    const damp = reduced ? PENDULUM.dampingReduced : PENDULUM.damping;
    for (let i = 0; i < steps; i++) {
      this.t += h;
      const wind = PENDULUM.wind * Math.max(0, Math.min(1, gust)) * Math.sin(this.t * 1.7);
      // semi-implicit Euler: stable for a pendulum at this step
      this.w += (-(PENDULUM.g / this.length) * Math.sin(this.a) - damp * this.w + wind) * h;
      this.a += this.w * h;
      if (Math.abs(this.a) > PENDULUM.max) {
        this.a = Math.sign(this.a) * PENDULUM.max;
        if (this.w * this.a > 0) this.w = 0;
      }
    }
  }

  /** Swinging noticeably (for the push prompt's cool-down and the tests). */
  get moving(): boolean {
    return Math.abs(this.a) > 0.02 || Math.abs(this.w) > 0.05;
  }
}

export interface SwingFrame {
  /** The site's frame: x along the branch, y up (the ground's normal under the seat), z across (the way it swings). */
  x: Vector3;
  y: Vector3;
  z: Vector3;
  /** Where the ropes hang from (in that frame, from the ground under the seat), and the rope's length to the seat. */
  pivot: Vector3;
  length: number;
}

/**
 * The swing's frame and pivot (swing.md §4.4): the branch point `out` u along `limb` from the trunk,
 * `branchY` above the oak's base (height `treeH`), seen from the ground under the seat (height `siteH`):
 * the planet curves between them, so the rope hangs from wherever the branch really is above the seat.
 */
export function swingFrame(tree: Vector3, limb: Vector3, treeH: number, site: { n: Vector3; facing: Vector3 }, siteH: number, R: number, out: number, branchY: number, seatY: number): SwingFrame {
  const y = site.n.clone();
  const x = new Vector3().crossVectors(site.facing, y).normalize();
  const z = new Vector3().crossVectors(x, y).normalize();
  const p = tree.clone().multiplyScalar(R + treeH + branchY).addScaledVector(limb, out).sub(y.clone().multiplyScalar(R + siteH));
  const pivot = new Vector3(p.dot(x), p.dot(y), p.dot(z));
  return { x, y, z, pivot, length: pivot.y - seatY };
}
