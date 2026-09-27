import { Vector3 } from 'three';
import { arcDistance } from '../math/sphere';

/**
 * Feeding the ducks from the pond bench (pure; unit-tested): a handful of crumbs tossed onto the
 * water, and where that draws the ducks to for a while. The visitor tosses with E while sitting on
 * the bench; the family toss from their end of it. The duck's side of it is `WildEnv.feed`
 * (world/animals.ts), the crumbs are drawn by the home (HomeView.tsx).
 */
export const FEED = {
  /** Seconds a toss flies, and how long its crumbs float after landing. */
  flight: 0.7,
  float: 5,
  /** Seconds the ducks keep coming to the last spot fed. */
  lure: 14,
  /** Seconds between two tosses by the same feeder (a handful at a time). */
  cooldown: 0.9,
  /** Where the crumbs land: this share of the way in from the shore to the pond's centre, ± a little. */
  inset: 0.42,
  jitter: 0.15,
} as const;

export interface Toss {
  /** Planet-local unit directions: the hand, and where the crumbs land on the water. */
  from: Vector3;
  to: Vector3;
  /** Seconds since it left the hand. */
  t: number;
  by: string;
}

export interface PondLike {
  n: Vector3;
  /** The shore's distance (u) from the centre in the direction of `n`. */
  shore(n: Vector3): number;
}

/**
 * Where a toss from `from` lands: on the line to the pond's centre, `FEED.inset` of the way in from
 * the shore (so well inside the water, where the ducks can reach it), nudged by `jitter` (−1…1 each).
 */
export function landingSpot(from: Vector3, pond: PondLike, R: number, jitter: [number, number] = [0, 0]): Vector3 {
  const d = arcDistance(from, pond.n, R);
  const shore = pond.shore(from);
  const target = Math.max(0.2, shore * (1 - FEED.inset) + jitter[0] * FEED.jitter);
  const k = d > 1e-6 ? Math.min(1, Math.max(0, 1 - target / d)) : 1;
  const to = from.clone().lerp(pond.n, k).normalize();
  if (jitter[1]) {
    const side = new Vector3().crossVectors(to, pond.n.clone().sub(from)).normalize();
    if (side.lengthSq() > 0.5) to.addScaledVector(side, (jitter[1] * FEED.jitter) / R).normalize();
  }
  return to;
}

export class DuckFeed {
  tosses: Toss[] = [];
  /** Handfuls tossed so far, by feeder. */
  readonly count = new Map<string, number>();
  /** Where the ducks are drawn to (the last spot fed), or null once the lure has worn off. */
  spot: Vector3 | null = null;
  private lure = 0;
  private last = new Map<string, number>();
  private clock = 0;

  /** Whether `by` may toss again now. */
  ready(by: string): boolean {
    const t = this.last.get(by);
    return t === undefined || this.clock - t >= FEED.cooldown;
  }

  /** Toss a handful from `from` onto the pond. False (and nothing happens) while `by` is still between tosses. */
  toss(by: string, from: Vector3, pond: PondLike, R: number, rand: () => number = Math.random): boolean {
    if (!this.ready(by)) return false;
    const to = landingSpot(from, pond, R, [rand() * 2 - 1, rand() * 2 - 1]);
    this.tosses.push({ from: from.clone(), to, t: 0, by });
    this.last.set(by, this.clock);
    this.count.set(by, (this.count.get(by) ?? 0) + 1);
    this.spot = to.clone();
    this.lure = FEED.lure;
    return true;
  }

  step(dt: number): void {
    dt = Math.max(0, dt);
    this.clock += dt;
    for (const t of this.tosses) t.t += dt;
    this.tosses = this.tosses.filter((t) => t.t < FEED.flight + FEED.float);
    this.lure = Math.max(0, this.lure - dt);
    if (this.lure <= 0) this.spot = null;
  }

  clear(): void {
    this.tosses = [];
    this.spot = null;
    this.lure = 0;
  }
}
