/**
 * Chopper's mind (docs: chopper.md §4): a small **utility AI**. Each behaviour scores itself from the
 * situation (how far the character is, a rabbit nearby, a tree he hasn't sniffed, his moods) plus a
 * little noise; he commits to the winner for a minimum time, and behaviours cool down after use, so
 * he's busy and organic without dithering. The whistle overrides everything.
 *
 * Steering is Reynolds-style seek / arrive with obstacle avoidance on the planet's collision
 * circles, a personal-space bubble round the character, and he keeps off the path they're walking.
 * He wades the stream but never the pond. Pure: no rendering, no DOM (tests drive it directly).
 */
import { Vector3 } from 'three';
import { arcDistance, moveAlong, resolvePenetration, tangentToward, type Obstacle } from '../../math/sphere';
import { rotateAbout, transport, turnToward } from '../animals';
import type { Clip } from './anim';

export type Behaviour = 'follow' | 'idle' | 'wander' | 'sniff' | 'chase' | 'scent' | 'runAhead' | 'playBow' | 'whistled' | 'heel';

/** Distances (u), speeds (u/s), times (s). */
export const DOG = {
  /** Past this from the character he comes back (the leash). */
  leash: 6,
  /** Past this he gallops back, whatever he's doing. */
  far: 9,
  /** Past this (a fast travel, a reset) he reappears near the character. */
  warp: 16,
  /** Following ends this close. */
  near: 2.5,
  /** The bubble round the character he never pushes into. */
  personal: 0.9,
  /** Hard minimum distance from the character's centre. */
  minGap: 0.6,
  radius: 0.2,
  speed: { walk: 0.75, trot: 1.7, follow: 2.6, run: 3.6, sprint: 5.8 },
  turnRate: 6,
  accel: 7,
  /** Heel after a whistle for this long. */
  heelTime: 12,
  cooldown: { chase: 25, scent: 40, runAhead: 30, playBow: 45, sniff: 6, wander: 8 },
  /** A thing he sniffed isn't interesting again for this long. */
  sniffMemory: 60,
  chaseMax: 7,
  /** How far ahead of the character he runs to wait (u). */
  runAhead: 5,
  barkGap: 3,
} as const;

export interface Spot {
  n: Vector3;
  radiusU: number;
  kind: 'tree' | 'rock' | 'bush';
  key: string;
}

export interface DogWorld {
  R: number;
  /** Character position (unit, planet-local), facing (unit tangent) and velocity (tangent, u/s). */
  player: Vector3;
  playerFwd: Vector3;
  playerVel: Vector3;
  obstacles: readonly Obstacle[];
  /** Ground he won't go onto (the pond, deep water). */
  blocked(n: Vector3): boolean;
  rabbits: readonly { n: Vector3 }[];
  spots: readonly Spot[];
}

export type DogEvent = { type: 'bark' | 'sniff' | 'yip' };

const IDLE_CLIPS: ReadonlyArray<{ clip: Clip; w: number; dur: [number, number] }> = [
  { clip: 'stand', w: 3, dur: [2.5, 5] },
  { clip: 'sit', w: 4, dur: [4, 8] },
  { clip: 'lie', w: 2, dur: [6, 11] },
  { clip: 'scratch', w: 1.2, dur: [2.2, 2.8] },
  { clip: 'pant', w: 1.5, dur: [3, 6] },
  { clip: 'headTilt', w: 1.2, dur: [1.6, 2.4] },
  { clip: 'shake', w: 0.8, dur: [1.1, 1.1] },
];

/** Weighted random pick with no immediate repeat (and a boost to resting when tired). */
export function pickIdle(last: Clip | null, energy: number, rand: () => number): { clip: Clip; dur: number } {
  const opts = IDLE_CLIPS.filter((o) => o.clip !== last);
  const weight = (o: (typeof IDLE_CLIPS)[number]) => o.w * (o.clip === 'lie' || o.clip === 'pant' ? 1 + (1 - energy) * 2 : 1);
  const total = opts.reduce((s, o) => s + weight(o), 0);
  let r = rand() * total;
  for (const o of opts) {
    r -= weight(o);
    if (r <= 0) return { clip: o.clip, dur: o.dur[0] + rand() * (o.dur[1] - o.dur[0]) };
  }
  const o = opts[opts.length - 1];
  return { clip: o.clip, dur: o.dur[0] };
}

const _t = new Vector3();
const _a = new Vector3();
const _d = new Vector3();

export class ChopperBrain {
  readonly n = new Vector3(0, 1, 0);
  readonly dir = new Vector3(0, 0, 1);
  speed = 0;
  /** Turn rate last step (rad/s, + = left). */
  turn = 0;
  behaviour: Behaviour = 'idle';
  /** Time in the current behaviour, and in its current stage. */
  t = 0;
  stage = 0;
  stageT = 0;
  clip: Clip = 'sit';
  clipTime = 0;
  /** Tail-wag excitement 0…1, panting 0/1. */
  wag = 0.3;
  pant = 0;
  /** What he's looking at (planet-local unit), or null. */
  look: Vector3 | null = null;
  barkAge = 99;
  /** Moods (0…1): tiring from running, playfulness and curiosity drift slowly. */
  energy = 1;
  playful = 0.6;
  curious = 0.6;
  readonly cooldown: Partial<Record<Behaviour, number>> = {};
  readonly sniffed = new Map<string, number>();
  /** The scent trail he's following. */
  trail: Vector3[] = [];
  private trailI = 0;
  private trailStops: number[] = [];
  goal: Vector3 | null = null;
  want = 0;
  private dur = 0;
  private idleLast: Clip | null = null;
  private target: Spot | null = null;
  private rabbit = -1;
  private barks: number[] = [];
  private lastBark = -99;
  private clock = 0;
  private steady = 0;
  private steadyDir = new Vector3();
  private near: Obstacle[] = [];
  private nearAt = new Vector3(0, 0, 0);
  private heelLeft = 0;
  private sniffTick = 0;
  private hopSide = 1;
  /** Which way he goes round things in his path (kept, so he doesn't dither at an obstacle). */
  private side = 1;
  readonly events: DogEvent[] = [];

  constructor(private readonly rand: () => number = Math.random) {}

  // ---------------------------------------------------------------------------

  /** Put him `u` away from the character, sitting and looking at them (spawn, after a travel). */
  placeNear(w: DogWorld, u = 1.8, side = 1): void {
    const R = w.R;
    for (let k = 0; k < 12; k++) {
      const ang = side * (0.7 + k * 0.45) * (k % 2 ? -1 : 1);
      const d = _d.copy(w.playerFwd);
      rotateAbout(d, w.player, ang);
      const p = moveAlong(w.player, d, u / R);
      if (this.open(w, p)) {
        this.n.copy(p);
        break;
      }
      if (k === 11) this.n.copy(moveAlong(w.player, w.playerFwd, -u / R));
    }
    const to = tangentToward(this.n, w.player);
    this.dir.copy(to ?? transport(this.dir, this.n));
    this.speed = 0;
    this.near = [];
    this.setBehaviour('idle');
    this.setClip('sit');
    this.dur = 3;
    this.look = w.player.clone();
  }

  /** The whistle: drop everything and come. */
  whistle(): void {
    this.setBehaviour('whistled');
  }

  /** Hold an idle pose for `dur` s (tests and visual checks). */
  hold(clip: Clip, dur = 1e6): void {
    this.setBehaviour('idle');
    this.setClip(clip);
    this.dur = dur;
  }

  /** Sit by the character for a while (they're looking at his profile card). */
  attend(w: DogWorld): void {
    this.setBehaviour('heel');
    this.heelLeft = DOG.heelTime;
    this.look = w.player;
  }

  private setBehaviour(b: Behaviour): void {
    this.behaviour = b;
    this.t = 0;
    this.stage = 0;
    this.stageT = 0;
    this.goal = null;
    this.want = 0;
    this.barks = [];
  }

  private setClip(c: Clip): void {
    if (c !== this.clip) this.clipTime = 0;
    this.clip = c;
  }

  private nextStage(): void {
    this.stage++;
    this.stageT = 0;
  }

  private bark(): void {
    this.events.push({ type: 'bark' });
    this.barkAge = 0;
    this.lastBark = this.clock;
  }

  private dist(a: Vector3, b: Vector3, R: number): number {
    return arcDistance(a, b, R);
  }

  /** Is `p` somewhere he can stand? (Not in the pond, not inside an obstacle.) */
  open(w: DogWorld, p: Vector3, pad = 0.12): boolean {
    if (w.blocked(p)) return false;
    const c = Math.cos(3 / w.R);
    for (const o of w.obstacles) if (o.n.dot(p) > c && this.dist(p, o.n, w.R) < o.radiusU + DOG.radius + pad) return false;
    return true;
  }

  // ---------------------------------------------------------------------------

  step(dt: number, w: DogWorld): void {
    dt = Math.min(Math.max(dt, 0), 0.1);
    this.clock += dt;
    this.t += dt;
    this.stageT += dt;
    this.clipTime += dt;
    this.barkAge += dt;
    for (const k of Object.keys(this.cooldown) as Behaviour[]) this.cooldown[k] = Math.max(0, (this.cooldown[k] ?? 0) - dt);
    const R = w.R;
    const d = this.dist(this.n, w.player, R);
    if (d > DOG.warp) {
      this.placeNear(w);
      return;
    }
    // moods
    if (this.speed > DOG.speed.follow + 0.4) this.energy = Math.max(0, this.energy - dt * 0.045);
    else if (this.speed < 0.2) this.energy = Math.min(1, this.energy + dt * 0.03);
    this.playful = Math.min(1, Math.max(0.2, this.playful + (this.rand() - 0.5) * dt * 0.1 + (this.energy - 0.5) * dt * 0.01));
    this.curious = Math.min(1, Math.max(0.2, this.curious + (this.rand() - 0.5) * dt * 0.1));
    // how long the character has walked steadily one way (for running ahead)
    const pv = w.playerVel.length();
    if (pv > 1.2) {
      _t.copy(w.playerVel).multiplyScalar(1 / pv);
      this.steady = this.steadyDir.dot(_t) > 0.94 ? this.steady + dt : 0;
      this.steadyDir.copy(_t);
    } else this.steady = 0;

    // the leash: interrupt whatever he's doing when the character is far
    const b = this.behaviour;
    const committed = b === 'whistled' || b === 'heel' || b === 'runAhead';
    if (!committed && b !== 'follow' && (d > DOG.far || (d > DOG.leash && (b !== 'chase' || d > DOG.far) && this.t > 1))) this.setBehaviour('follow');
    else if (b === 'chase' && d > DOG.far) this.setBehaviour('follow');

    this.look = null;
    const done = this.run(dt, w, d);
    if (done) this.choose(w, d);
    this.move(dt, w);
  }

  /** Pick the best-scoring behaviour (utility AI). */
  private choose(w: DogWorld, d: number): void {
    const R = w.R;
    const cd = (b: Behaviour) => (this.cooldown[b] ?? 0) > 0;
    const noise = () => this.rand() * 0.15;
    const scores: Array<[Behaviour, number]> = [];
    const moving = w.playerVel.length() > 0.5;
    scores.push(['follow', d > DOG.leash ? 0.8 + (d - DOG.leash) * 0.2 : d > 3.5 && moving ? 0.6 : 0]);
    scores.push(['idle', 0.32 + (1 - this.energy) * 0.35 + noise()]);
    if (!cd('wander') && d < 5) scores.push(['wander', 0.2 + this.curious * 0.2 + noise()]);
    // something to sniff: the nearest spot he hasn't sniffed lately
    const spot = this.nearestSpot(w, (s) => s.kind !== 'bush' || this.rand() < 0.5);
    if (spot && !cd('sniff')) scores.push(['sniff', 0.3 + this.curious * 0.35 + noise()]);
    const rabbit = this.nearestRabbit(w);
    if (rabbit >= 0 && !cd('chase') && this.energy > 0.3) scores.push(['chase', 0.55 + this.playful * 0.35 + noise()]);
    if (!cd('scent') && d < 4) scores.push(['scent', 0.1 + this.curious * 0.25 + noise()]);
    if (!cd('runAhead') && this.steady > 4 && this.energy > 0.35) scores.push(['runAhead', 0.85 + noise()]);
    const bush = this.nearestSpot(w, (s) => s.kind === 'bush');
    if (bush && !cd('playBow') && this.energy > 0.3) scores.push(['playBow', 0.18 + this.playful * 0.4 + noise()]);
    scores.sort((a, b) => b[1] - a[1]);
    const pick = scores[0][0];
    this.setBehaviour(pick);
    if (pick === 'sniff') this.target = spot;
    if (pick === 'playBow') this.target = bush;
    if (pick === 'chase') this.rabbit = rabbit;
    if (pick === 'idle') {
      const i = pickIdle(this.idleLast, this.energy, this.rand);
      this.idleLast = i.clip;
      this.setClip(i.clip);
      this.dur = i.dur;
    }
    if (pick === 'wander') this.goal = this.randomSpot(w, 3, 7);
    if (pick === 'scent') this.makeTrail(w);
    if (pick === 'runAhead') {
      const ahead = moveAlong(w.player, this.steadyDir, DOG.runAhead / R);
      this.goal = this.open(w, ahead, 0.3) ? ahead : null;
      if (!this.goal) this.setBehaviour('idle');
    }
  }

  private nearestSpot(w: DogWorld, ok: (s: Spot) => boolean): Spot | null {
    let best: Spot | null = null;
    let bd = 6;
    const c = Math.cos(6 / w.R);
    for (const s of w.spots) {
      if (s.n.dot(this.n) < c || !ok(s)) continue;
      const seen = this.sniffed.get(s.key);
      if (seen !== undefined && this.clock - seen < DOG.sniffMemory) continue;
      const dd = this.dist(s.n, this.n, w.R);
      if (dd < bd && this.dist(s.n, w.player, w.R) < DOG.leash) {
        bd = dd;
        best = s;
      }
    }
    return best;
  }

  private nearestRabbit(w: DogWorld): number {
    let best = -1;
    let bd = 7;
    w.rabbits.forEach((r, i) => {
      const dd = this.dist(r.n, this.n, w.R);
      if (dd < bd && this.dist(r.n, w.player, w.R) < DOG.far - 1) {
        bd = dd;
        best = i;
      }
    });
    return best;
  }

  /** A random open spot `lo`…`hi` u from the character. */
  private randomSpot(w: DogWorld, lo: number, hi: number): Vector3 | null {
    for (let k = 0; k < 10; k++) {
      const d = _d.copy(w.playerFwd);
      rotateAbout(d, w.player, this.rand() * Math.PI * 2);
      const p = moveAlong(w.player, d, (lo + this.rand() * (hi - lo)) / w.R);
      if (this.open(w, p, 0.25)) return p;
    }
    return null;
  }

  /** A wiggly scent trail from where he is: a smooth random walk, clear of obstacles and water. */
  makeTrail(w: DogWorld): void {
    const R = w.R;
    const pts: Vector3[] = [];
    let p = this.n.clone();
    const h = this.dir.clone();
    rotateAbout(h, p, (this.rand() - 0.5) * 2);
    const len = 12 + Math.floor(this.rand() * 8);
    for (let i = 0; i < len; i++) {
      let ok = false;
      for (let tries = 0; tries < 6 && !ok; tries++) {
        rotateAbout(h, p, (this.rand() - 0.5) * 0.9 + (tries ? (tries % 2 ? 1 : -1) * tries * 0.5 : 0));
        const q = moveAlong(p, h, 0.5 / R);
        if (this.open(w, q, 0.3) && this.dist(q, w.player, R) < DOG.leash + 1) {
          p = q;
          transport(h, p);
          pts.push(q);
          ok = true;
        }
      }
      if (!ok) break;
    }
    this.trail = pts;
    this.trailI = 0;
    this.trailStops = pts.length > 6 ? [Math.floor(pts.length * 0.35), Math.floor(pts.length * 0.75)] : [];
    if (pts.length < 4) this.trail = [];
  }

  /** Where he trots to beside and a little behind the character (the side he's already on). */
  private slot(w: DogWorld, back: number, side: number): Vector3 {
    const R = w.R;
    const right = _a.crossVectors(w.playerFwd, w.player).normalize();
    const rel = _t.copy(this.n).sub(w.player);
    const s = Math.sign(rel.dot(right)) || 1;
    const dir = _d.copy(w.playerFwd).multiplyScalar(-back).addScaledVector(right, side * s);
    const len = dir.length();
    return moveAlong(w.player, dir.multiplyScalar(1 / len), len / R);
  }

  /** Run the current behaviour; true when it has finished (choose another). */
  private run(dt: number, w: DogWorld, d: number): boolean {
    const R = w.R;
    const arrived = (u: number) => !this.goal || this.dist(this.n, this.goal, R) < u;
    switch (this.behaviour) {
      case 'follow': {
        const fast = d > DOG.far;
        this.goal = this.slot(w, 1.1, 1.0);
        this.want = fast ? DOG.speed.sprint : Math.max(DOG.speed.trot, Math.min(DOG.speed.follow + w.playerVel.length() * 0.6, DOG.speed.run));
        this.setClip('stand');
        this.wag = 0.45;
        return d < DOG.near;
      }
      case 'idle': {
        this.want = 0;
        this.goal = null;
        this.wag = this.clip === 'lie' ? 0.1 : 0.25;
        this.pant = this.clip === 'pant' || this.energy < 0.4 ? 1 : 0;
        if (this.clip !== 'scratch' && this.clip !== 'shake' && this.clip !== 'lie') this.look = w.player;
        if (this.clip === 'scratch' || this.clip === 'shake') this.pant = 0;
        const moving = w.playerVel.length() > 0.5;
        return this.t > this.dur || (moving && d > 4 && this.t > 1);
      }
      case 'wander': {
        if (this.stage === 0) {
          this.want = DOG.speed.walk;
          this.setClip('stand');
          this.wag = 0.2;
          if (arrived(0.3) || this.t > 8) this.nextStage();
          return false;
        }
        this.want = 0;
        this.look = null;
        this.setClip('stand');
        if (this.stageT > 1.6) this.cooldown.wander = DOG.cooldown.wander;
        return this.stageT > 1.6;
      }
      case 'sniff': {
        const s = this.target;
        if (!s) return true;
        if (this.stage === 0) {
          const out = tangentToward(s.n, this.n) ?? this.dir;
          this.goal = moveAlong(s.n, out, (s.radiusU + DOG.radius + 0.12) / R);
          this.want = DOG.speed.trot * 0.85;
          this.setClip('stand');
          this.wag = 0.3;
          if (arrived(0.15) || this.t > 7) {
            this.nextStage();
            this.dur = 2.5 + this.rand() * 1.5;
            this.sniffTick = 0;
          }
          return false;
        }
        this.want = 0;
        this.goal = null;
        this.look = s.n;
        if (this.stage === 1) {
          this.setClip(s.kind === 'tree' ? 'sniffHigh' : 'sniffGround');
          this.wag = 0.15;
          this.sniffTick -= dt;
          if (this.sniffTick <= 0) {
            this.events.push({ type: 'sniff' });
            this.sniffTick = 0.8 + this.rand() * 0.5;
          }
          if (this.stageT > this.dur) {
            this.sniffed.set(s.key, this.clock);
            this.cooldown.sniff = DOG.cooldown.sniff;
            if (this.rand() < 0.5) {
              this.nextStage();
              this.look = null;
              return false;
            }
            return true;
          }
          return false;
        }
        this.look = null;
        this.setClip('shake');
        return this.stageT > 1.1;
      }
      case 'chase': {
        const r = w.rabbits[this.rabbit];
        if (!r) return true;
        const rd = this.dist(this.n, r.n, R);
        this.look = r.n;
        if (this.stage === 0) {
          this.goal = r.n;
          // he never catches one: he eases off just short of it
          this.want = rd < 2.2 ? Math.max(0, (rd - 1.05) * 3.5) : DOG.speed.run + this.playful * 0.8;
          this.setClip('stand');
          this.wag = 0.9;
          if (this.t > DOG.chaseMax || (this.t > 5 && rd > 3) || rd > 10) {
            this.nextStage();
            const n = 2 + Math.floor(this.rand() * 3);
            this.barks = Array.from({ length: n }, (_, i) => 0.15 + i * (0.45 + this.rand() * 0.2));
          }
          return false;
        }
        // lost it: stand and bark after it, tail going
        this.goal = null;
        this.want = 0;
        this.setClip('bark');
        this.wag = 0.8;
        while (this.barks.length && this.stageT >= this.barks[0]) {
          this.barks.shift();
          this.bark();
        }
        if (!this.barks.length && this.stageT > 0.6) {
          this.cooldown.chase = DOG.cooldown.chase;
          this.energy = Math.max(0, this.energy - 0.15);
          return true;
        }
        return false;
      }
      case 'scent': {
        if (!this.trail.length) return true;
        if (this.stage === 0) {
          this.goal = this.trail[this.trailI];
          this.want = DOG.speed.trot * 0.7;
          this.setClip('sniffGround');
          this.wag = 0.2;
          if (arrived(0.3)) {
            if (this.trailStops[0] === this.trailI) {
              this.trailStops.shift();
              this.nextStage();
              return false;
            }
            this.trailI++;
            if (this.trailI >= this.trail.length) {
              this.stage = 2;
              this.stageT = 0;
            }
          }
          if (this.t > 25) this.stage = 2;
          this.sniffTick -= dt;
          if (this.sniffTick <= 0) {
            this.events.push({ type: 'sniff' });
            this.sniffTick = 1.2 + this.rand();
          }
          return false;
        }
        if (this.stage === 1) {
          // a pause to work the spot
          this.want = 0;
          this.goal = null;
          this.setClip('sniffGround');
          if (this.stageT > 1.3) {
            this.stage = 0;
            this.stageT = 0;
            this.trailI++;
          }
          return false;
        }
        // trail's end: a puzzled head tilt (or a shake)
        this.want = 0;
        this.goal = null;
        this.setClip(this.trail.length % 2 ? 'headTilt' : 'shake');
        if (this.stageT > 1.6) {
          this.cooldown.scent = DOG.cooldown.scent;
          this.trail = [];
          return true;
        }
        return false;
      }
      case 'runAhead': {
        if (this.stage === 0) {
          // a spot ahead of the character on their way (it moves with them until he's there)
          const ahead = moveAlong(w.player, this.steadyDir, DOG.runAhead / R);
          if (this.open(w, ahead, 0.3)) this.goal = ahead;
          this.want = DOG.speed.sprint;
          this.setClip('stand');
          this.wag = 0.8;
          if (arrived(0.8) || this.t > 7) this.nextStage();
          return false;
        }
        // sit and wait, looking back expectantly, tail sweeping
        this.want = 0;
        this.goal = null;
        this.look = w.player;
        this.setClip('sit');
        this.wag = 0.85;
        if (d < 1.6 || this.stageT > 8) {
          this.cooldown.runAhead = DOG.cooldown.runAhead;
          this.steady = 0;
          return true;
        }
        return false;
      }
      case 'playBow': {
        const s = this.target;
        if (!s) return true;
        this.look = s.n;
        if (this.stage === 0) {
          const out = tangentToward(s.n, this.n) ?? this.dir;
          this.goal = moveAlong(s.n, out, (s.radiusU + DOG.radius + 0.55) / R);
          this.want = DOG.speed.trot;
          this.setClip('stand');
          this.wag = 0.7;
          if (arrived(0.2) || this.t > 7) {
            this.nextStage();
            this.barks = [0.5, 1.3];
            this.hopSide = this.rand() < 0.5 ? 1 : -1;
          }
          return false;
        }
        this.goal = null;
        while (this.barks.length && this.stageT >= this.barks[0]) {
          this.barks.shift();
          this.bark();
        }
        if (this.stage === 1 || this.stage === 3) {
          this.want = 0;
          this.setClip('playBow');
          this.wag = 1;
          if (this.stage === 1 && this.stageT > 2.1) {
            this.nextStage();
          } else if (this.stage === 3 && this.stageT > 1.8) {
            this.cooldown.playBow = DOG.cooldown.playBow;
            return true;
          }
          return false;
        }
        // a bouncy hop to the side, then bow again
        const side = _a.crossVectors(this.n, _t.copy(s.n)).normalize();
        this.goal = moveAlong(this.n, side.multiplyScalar(this.hopSide), 0.5 / R);
        this.want = 1.6;
        this.setClip('stand');
        if (this.stageT > 0.4) {
          this.nextStage();
          this.barks = [0.6];
        }
        return false;
      }
      case 'whistled': {
        this.wag = 1;
        if (this.stage === 0) {
          // ears up: he heard it
          this.want = 0;
          this.goal = null;
          this.look = w.player;
          this.setClip('lookUp');
          if (this.stageT > 0.15 && this.clock - this.lastBark > 0.5 && !this.barks.length) {
            this.barks = [0];
            this.bark();
          }
          if (this.stageT > 0.4) this.nextStage();
          return false;
        }
        if (this.stage === 1) {
          this.goal = this.slot(w, 0.4, 1.0);
          this.want = d > 2 ? DOG.speed.sprint : 2.2;
          this.setClip('stand');
          if (d < 1.5 || this.t > 10) this.nextStage();
          return false;
        }
        // arrived: the head tilt, then heel
        this.want = 0;
        this.goal = null;
        this.look = w.player;
        this.setClip('headTilt');
        if (this.stageT > 1.3) {
          this.setBehaviour('heel');
          this.heelLeft = DOG.heelTime;
        }
        return false;
      }
      case 'heel': {
        this.heelLeft -= dt;
        this.goal = this.slot(w, 0.5, 1.0);
        const gd = this.dist(this.n, this.goal, R);
        const pv = w.playerVel.length();
        this.want = gd < 0.25 ? 0 : Math.min(DOG.speed.sprint, Math.max(pv * 1.1, gd * 2.5));
        this.wag = 0.6;
        if (pv < 0.2 && gd < 0.4) {
          this.look = w.player;
          if (this.stageT > 0.8) this.setClip('sit');
        } else {
          this.stageT = 0;
          this.setClip('stand');
        }
        return this.heelLeft <= 0;
      }
    }
  }

  /** Steer toward the goal at the wanted speed, round obstacles and the character, then step. */
  private move(dt: number, w: DogWorld): void {
    const R = w.R;
    // nearby obstacles (refreshed as he moves)
    if (this.nearAt.dot(this.n) < Math.cos(1 / R) || !this.near.length) {
      const c = Math.cos(4 / R);
      this.near = w.obstacles.filter((o) => o.n.dot(this.n) > c);
      this.nearAt.copy(this.n);
    }
    let want = this.want;
    const desired = _d.set(0, 0, 0);
    if (this.goal) {
      const to = tangentToward(this.n, this.goal, _t);
      const gd = this.dist(this.n, this.goal, R);
      if (to && gd > 0.05) {
        desired.copy(to);
        // arrive: ease off near the goal
        want = Math.min(want, Math.max(0.35, gd * 3));
      } else want = 0;
    }
    // avoid what's ahead (obstacles within a short look-ahead), and the character's bubble and path
    if (want > 0.05) {
      for (const o of this.near) {
        const od = this.dist(this.n, o.n, R) - o.radiusU - DOG.radius;
        if (od > 0.8) continue;
        const away = tangentToward(this.n, o.n, _a);
        if (!away) continue;
        const ahead = -away.dot(desired.lengthSq() > 0 ? desired : this.dir);
        if (ahead > -0.2) continue;
        // push sideways round it, stronger when close
        _t.crossVectors(this.n, away);
        const s = Math.sign(_t.dot(desired)) || 1;
        desired.addScaledVector(_t, s * (1 - Math.max(0, od) / 0.8) * 1.2);
      }
      const pd = this.dist(this.n, w.player, R);
      const fromP = tangentToward(this.n, w.player, _a);
      if (fromP && pd < DOG.personal + 0.4) desired.addScaledVector(fromP, -(1 - pd / (DOG.personal + 0.4)) * 1.5);
      // keep off the line the character is walking (unless he's overtaking them to run ahead)
      const pv = w.playerVel.length();
      if (pv > 0.5 && fromP && this.behaviour !== 'runAhead') {
        const rel = _t.copy(this.n).sub(w.player);
        const along = rel.dot(w.playerVel) / pv;
        const lateral = rel.dot(_a.crossVectors(w.playerVel, w.player).normalize());
        if (along > 0 && along * R < 3 && Math.abs(lateral * R) < 0.8) desired.addScaledVector(_a, (Math.sign(lateral) || 1) * 0.8);
      }
    }
    if (desired.lengthSq() > 1e-8) {
      desired.addScaledVector(this.n, -desired.dot(this.n)).normalize();
      const before = this.dir.clone();
      turnToward(this.dir, this.n, desired, DOG.turnRate * dt * (this.speed > 2.5 ? 0.7 : 1));
      const cross = _t.crossVectors(before, this.dir).dot(this.n);
      this.turn = dt > 0 ? Math.asin(Math.max(-1, Math.min(1, cross))) / dt : 0;
      // don't run full tilt while facing the wrong way
      want *= Math.max(0.2, before.dot(desired));
    } else {
      this.turn = 0;
      // standing: turn to what he's looking at
      if (this.look) {
        const to = tangentToward(this.n, this.look, _t);
        if (to && this.dist(this.n, this.look, R) > 0.1) turnToward(this.dir, this.n, to, 2.2 * dt);
      }
    }
    const accel = want > this.speed ? DOG.accel : DOG.accel * 1.6;
    this.speed += Math.max(-accel * dt, Math.min(accel * dt, want - this.speed));
    if (this.speed < 1e-3) {
      this.speed = 0;
      return;
    }
    // feelers: if the step ahead is blocked (a tree, a wall, the pond's edge), try turning a little
    // more each way, round the side he's been going, and take the first free step
    const theta = (this.speed * dt) / R;
    let next = moveAlong(this.n, this.dir, theta);
    if (!this.free(w, next)) {
      let found = false;
      for (let k = 1; k <= 7 && !found; k++) {
        for (const s of [this.side, -this.side]) {
          const d2 = rotateAbout(_a.copy(this.dir), this.n, s * k * 0.4);
          const q = moveAlong(this.n, d2, theta);
          if (this.free(w, q)) {
            next = q;
            this.dir.copy(d2);
            this.side = s;
            found = true;
            break;
          }
        }
      }
      if (!found) {
        this.speed *= 0.3;
        rotateAbout(this.dir, this.n, this.side * 0.8);
        next = this.n.clone();
      }
    }
    this.n.copy(next);
    const fixed = resolvePenetration(this.n, this.near, { radius: R, playerRadius: DOG.radius, skin: 0.01 });
    if (fixed) this.n.copy(fixed);
    // the character's centre: never on top of them
    const pd = this.dist(this.n, w.player, R);
    if (pd < DOG.minGap) {
      const out = tangentToward(w.player, this.n, _a) ?? w.playerFwd;
      this.n.copy(moveAlong(w.player, out, DOG.minGap / R));
    }
    transport(this.dir, this.n);
  }

  /** Can he step onto `p`? (Clear of the pond and of the obstacles round him.) */
  private free(w: DogWorld, p: Vector3): boolean {
    if (w.blocked(p)) return false;
    for (const o of this.near) if (this.dist(p, o.n, w.R) < o.radiusU + DOG.radius) return false;
    return true;
  }

  /** Planet-local distance from the character (u), for diagnostics. */
  distanceTo(p: Vector3, R: number): number {
    return this.dist(this.n, p, R);
  }
}
