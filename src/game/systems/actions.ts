import { Vector3 } from 'three';
import { CONFIG } from '../config';
import { moveAlong } from '../math/sphere';
import { clearSpot, standSpot, type Target } from './interactables';

/**
 * The fixed action cycles (docs: collection-inventory.md §3.1, §5). Every activation plays the same
 * timed cycle: step to the working spot and turn to face the target, play the beats, step back.
 */
export type ActionKind = 'shake' | 'mine' | 'pick' | 'open' | 'water';
export type BeatKind = 'fruit' | 'leaf' | 'log' | 'hit' | 'pluck' | 'open';

export interface Cycle {
  /** Total length (s), including the approach and the step back. */
  duration: number;
  /** Seconds spent stepping to the working spot (and turning to face the target). */
  approach: number;
  /** Seconds at the end spent stepping back clear of the target (trees: you work at the trunk). */
  retreat: number;
  beats: readonly { t: number; beat: BeatKind }[];
}

export const CYCLES: Record<ActionKind, Cycle> = {
  shake: {
    duration: 1.7,
    approach: 0.22,
    retreat: 0.18,
    beats: [
      { t: 0.5, beat: 'fruit' },
      { t: 0.6, beat: 'leaf' },
      { t: 0.92, beat: 'fruit' },
      { t: 1.0, beat: 'log' },
      { t: 1.22, beat: 'leaf' },
    ],
  },
  mine: {
    duration: 2.4,
    approach: 0.22,
    retreat: 0,
    beats: [
      { t: 0.86, beat: 'hit' },
      { t: 1.42, beat: 'hit' },
      { t: 1.98, beat: 'hit' },
    ],
  },
  pick: { duration: 0.8, approach: 0.16, retreat: 0, beats: [{ t: 0.42, beat: 'pluck' }] },
  open: { duration: 0.5, approach: 0.16, retreat: 0, beats: [{ t: 0.32, beat: 'open' }] },
  // watering a plant in the vegetable garden: the home chunk times the pour itself (garden.ts)
  water: { duration: 1.6, approach: 0.22, retreat: 0, beats: [] },
};

export const actionFor = (t: Target): ActionKind | null =>
  t.kind === 'tree' ? 'shake' : t.kind === 'boulder' ? 'mine' : t.kind === 'flower' ? 'pick' : t.kind === 'chest' ? 'open' : null;

/** The mining cycle's swings: when each starts and lands (s), for the pose and the pickaxe. */
export const MINE_SWINGS = CYCLES.mine.beats.map((b) => ({ start: b.t - 0.42, hit: b.t }));
/** The pickaxe is in the hand between these times (s). */
export const PICKAXE = { in: 0.12, out: 2.22 } as const;

const smooth = (t: number) => t * t * (3 - 2 * t);

function slerpUnit(a: Vector3, b: Vector3, t: number, out: Vector3): Vector3 {
  const w = Math.acos(Math.min(1, Math.max(-1, a.dot(b))));
  if (w < 1e-9) return out.copy(b);
  const s = Math.sin(w);
  return out.copy(a).multiplyScalar(Math.sin((1 - t) * w) / s).addScaledVector(b, Math.sin(t * w) / s).normalize();
}

/** Runs one action at a time. */
export class ActionRunner {
  kind: ActionKind | null = null;
  target: Target | null = null;
  /** Seconds into the cycle. */
  t = 0;
  private readonly from = new Vector3();
  private readonly stand = new Vector3();
  private readonly back = new Vector3();
  private readonly at = new Vector3();

  get busy(): boolean {
    return this.kind !== null;
  }

  get cycle(): Cycle | null {
    return this.kind ? CYCLES[this.kind] : null;
  }

  /** How far through the cycle (0…1), or 0 when idle. */
  get progress(): number {
    return this.kind ? Math.min(1, this.t / CYCLES[this.kind].duration) : 0;
  }

  start(kind: ActionKind, target: Target, p: Vector3, R = CONFIG.planetRadius): void {
    this.kind = kind;
    this.target = target;
    this.t = 0;
    this.from.copy(p);
    // a flower is walked over: stand a step back from it, on your side
    this.stand.copy(standSpot(target, p, R));
    this.back.copy(CYCLES[kind].retreat > 0 ? clearSpot(target, p, R) : this.stand);
  }

  cancel(): void {
    this.kind = null;
    this.target = null;
    this.t = 0;
  }

  /**
   * Advance by `dt` (`instant` under reduced motion shortens nothing but the approach). Returns the
   * beats that fired and where the character should be (null: leave it where it is).
   */
  step(dt: number, instant = false): { beats: BeatKind[]; at: Vector3 | null; done: boolean } {
    const beats: BeatKind[] = [];
    if (!this.kind || !this.target) return { beats, at: null, done: false };
    const c = CYCLES[this.kind];
    const t0 = this.t;
    this.t = Math.min(c.duration, this.t + Math.max(0, dt));
    for (const b of c.beats) if (b.t > t0 && b.t <= this.t) beats.push(b.beat);
    let at: Vector3 | null;
    if (this.t < c.approach) at = instant ? this.at.copy(this.stand) : slerpUnit(this.from, this.stand, smooth(this.t / c.approach), this.at);
    else if (c.retreat > 0 && this.t > c.duration - c.retreat) {
      const k = (this.t - (c.duration - c.retreat)) / c.retreat;
      at = slerpUnit(this.stand, this.back, instant ? 1 : smooth(k), this.at);
    } else at = this.at.copy(this.stand);
    const done = this.t >= c.duration;
    if (done) {
      at = this.at.copy(c.retreat > 0 ? this.back : this.stand);
      this.cancel();
    }
    return { beats, at, done };
  }
}

/** A point just in front of the character (`u` ahead along planet-local tangent `fwd`). */
export const ahead = (p: Vector3, fwd: Vector3, u: number, R = CONFIG.planetRadius) => moveAlong(p, fwd, u / R);
