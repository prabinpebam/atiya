import { Vector3 } from 'three';
import { CONFIG } from '../config';
import { arcDistance, moveAlong } from '../math/sphere';
import { BENCH } from '../world/parts';
import type { Furniture } from '../world/layout';

/** Sitting on benches: where you sit, when it's offered, and the sit-down / stand-up motion. */
export const SEAT = {
  /** Offer a seat within this distance (u) of the bench's centre (collision keeps you ≥ ≈ 0.87 away). */
  enterU: 1.45,
  /** …and keep offering it until you're this far away. */
  exitU: 1.7,
  /** Only from in front or the ends, not from behind: cos of the angle off the bench's facing. */
  frontCos: -0.2,
  /** Where you stand up to: this far in front of the bench's centre (clear of its collision circle). */
  standU: 0.95,
  /** Where you sit: this far behind the bench's centre (so your back is against the backrest). */
  sitBackU: 0.04,
  /** Seconds to sit down and to stand up. */
  sitTime: 0.55,
  standTime: 0.4,
  /** Height (u above the base sphere) of the seat's top: the bench sits 0.01 into the plaza. */
  seatY: BENCH.seatTop - 0.01,
} as const;

export interface Seat {
  id: string;
  /** Bench centre and the tangent it faces (planet-local). */
  n: Vector3;
  facing: Vector3;
  /** Where the character sits and where it stands up to (planet-local unit vectors). */
  sit: Vector3;
  stand: Vector3;
}

/** One seat per bench in the layout. */
export function benchSeats(furniture: readonly Furniture[], R = CONFIG.planetRadius): Seat[] {
  return furniture
    .filter((f) => f.kind === 'bench')
    .map((f, i) => ({
      id: `bench-${i}`,
      n: f.n.clone(),
      facing: f.facing.clone(),
      sit: moveAlong(f.n, f.facing, -SEAT.sitBackU / R),
      stand: moveAlong(f.n, f.facing, SEAT.standU / R),
    }));
}

/** The seat on offer at `p` (keeping `currentId` until you walk out of its exit radius), or null. */
export function seatInRange(p: Vector3, seats: readonly Seat[], currentId: string | null, R = CONFIG.planetRadius): string | null {
  let best: { id: string; d: number } | null = null;
  for (const s of seats) {
    const d = arcDistance(p, s.n, R);
    if (d > (s.id === currentId ? SEAT.exitU : SEAT.enterU)) continue;
    // in front of (or beside) the bench: the direction from its centre to you, against its facing
    const off = p.clone().addScaledVector(s.n, -p.dot(s.n));
    const len = off.length();
    if (len > 1e-9 && off.dot(s.facing) / len < SEAT.frontCos) continue;
    if (!best || d < best.d) best = { id: s.id, d };
  }
  return best?.id ?? null;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Great-circle interpolation between unit vectors. */
function slerpUnit(a: Vector3, b: Vector3, t: number, out: Vector3): Vector3 {
  const c = Math.min(1, Math.max(-1, a.dot(b)));
  const w = Math.acos(c);
  if (w < 1e-9) return out.copy(b);
  const s = Math.sin(w);
  const ka = Math.sin((1 - t) * w) / s;
  const kb = Math.sin(t * w) / s;
  return out.set(a.x * ka + b.x * kb, a.y * ka + b.y * kb, a.z * ka + b.z * kb).normalize();
}

export type SeatStage = 'sitting' | 'seated' | 'standing';

/**
 * Sit-down / stand-up motion. `step` says where the character should be this frame (or null when
 * it's walking freely); `pose` is how far into the sitting pose it is (0 standing … 1 seated).
 */
export class SeatMotion {
  seat: Seat | null = null;
  stage: SeatStage | null = null;
  pose = 0;
  private t = 0;
  private poseFrom = 0;
  private readonly from = new Vector3();
  private readonly at = new Vector3();

  /** True from the moment you sit until you start standing up. */
  get seated(): boolean {
    return this.stage === 'sitting' || this.stage === 'seated';
  }

  sit(seat: Seat, p: Vector3): void {
    this.seat = seat;
    this.stage = 'sitting';
    this.t = 0;
    this.from.copy(p);
    this.poseFrom = this.pose;
  }

  /** Start standing up (from wherever the character is, even halfway down). */
  stand(p: Vector3): void {
    if (!this.seat || this.stage === 'standing') return;
    this.stage = 'standing';
    this.t = 0;
    this.from.copy(p);
    this.poseFrom = this.pose;
  }

  /** Drop out of the seat at once (fast travel, reset). */
  clear(): void {
    this.seat = null;
    this.stage = null;
    this.pose = 0;
  }

  /** Advance by `dt` s (`instant` under reduced motion) and return where the character should be. */
  step(dt: number, instant = false): Vector3 | null {
    const seat = this.seat;
    if (!seat || !this.stage) return null;
    if (this.stage === 'seated') {
      this.pose = 1;
      return this.at.copy(seat.sit);
    }
    const sitting = this.stage === 'sitting';
    this.t = instant ? 1 : Math.min(1, this.t + Math.max(0, dt) / (sitting ? SEAT.sitTime : SEAT.standTime));
    const e = smooth(this.t);
    slerpUnit(this.from, sitting ? seat.sit : seat.stand, e, this.at);
    this.pose = sitting ? this.poseFrom + (1 - this.poseFrom) * e : this.poseFrom * (1 - e);
    if (this.t >= 1) {
      if (sitting) this.stage = 'seated';
      else {
        this.at.copy(seat.stand);
        this.clear();
      }
    }
    return this.at;
  }
}
