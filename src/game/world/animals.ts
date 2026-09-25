/**
 * Ambient wildlife (pure simulation, no rendering): rabbits, a duck with ducklings, fish in the
 * pond and the stream, and birds. The industry-standard recipe for ambient game animals:
 * Craig Reynolds' **steering behaviours** (wander, seek, flee, arrive, containment, 1999) and
 * **boids** (separation, alignment, cohesion, 1987) for motion, each species driven by a small
 * **finite-state machine** that switches behaviours, e.g. to flee when the character comes close
 * (its "flight initiation distance"). Behaviour follows the real animals:
 *
 * - **Rabbits** graze in short bouts, sit up now and then to scan, and move in short hops near a
 *   home patch, never into water or obstacles. A nearby threat makes them *freeze* upright facing it
 *   (vigilance); a close one makes them *bolt* in fast zigzag hops, then stay alert before grazing.
 * - **The duck** paddles about the pond (contained by its shore) with dabbling pauses; her
 *   **ducklings** follow in a line, each arriving just behind the one ahead. A close threat sends
 *   her briskly away (still inside the pond) and the brood hurries after her.
 * - **Pond fish** cruise as a loose school (wander + separation + containment); **stream fish** hold
 *   station facing upstream, like trout. Both dart away from a close threat, then settle again.
 * - **Birds** peck on the ground in little hops, or fly as a flock over the planet (boids plus an
 *   altitude band). Ground birds take off when the character comes close and join the flock; flying
 *   birds land again later, away from the character. They roost (are hidden) at night.
 *
 * Everything lives on the planet in planet-local space: a unit direction `n` plus, for birds, a
 * height. Headings are unit tangents at `n`; moving is a step along the great circle, then the
 * heading is carried over to the new tangent plane.
 */
import { Vector3 } from 'three';
import { CONFIG } from '../config';
import { arcDistance, moveAlong, tangentToward, type Obstacle } from '../math/sphere';
import { riverDistance, type River } from './features';
import { mulberry32 } from './layout';

const R = CONFIG.planetRadius;

/** Behaviour distances (u) and speeds (u/s), after the real animals (scaled to the diorama). */
export const WILD = {
  rabbit: { alert: 4.0, flee: 2.4, safe: 5.2, hopLen: 0.3, hopTime: 0.3, fleeHopLen: 0.62, fleeHopTime: 0.26, range: 3.5 },
  duck: { flee: 2.6, calm: 4.2, speed: 0.22, fleeSpeed: 0.7, shoreMargin: 0.55, spacing: 0.24 },
  fish: { flee: 1.7, cruise: 0.3, dart: 1.7, dartTime: 0.7, shoreMargin: 0.35, separation: 0.3 },
  bird: { takeOff: 2.4, landAway: 5, speed: 2.1, minAlt: 2.3, maxAlt: 3.8, separation: 0.55, neighbour: 3.2, nightHide: 0.6 },
} as const;

export type RabbitState = 'graze' | 'hop' | 'alert' | 'flee';
export interface Rabbit {
  n: Vector3;
  dir: Vector3;
  home: Vector3;
  state: RabbitState;
  timer: number;
  /** Sitting up to look around (graze), or upright and frozen (alert). */
  upright: boolean;
  hopsLeft: number;
  /** Current hop: from → to over `hopTime` s; `hop` is its progress 0…1 (−1 = on the ground). */
  hop: number;
  hopTime: number;
  from: Vector3;
  to: Vector3;
  zig: number;
}

export interface Swimmer {
  n: Vector3;
  dir: Vector3;
  speed: number;
}
export interface Duck extends Swimmer {
  state: 'paddle' | 'dabble' | 'flee';
  timer: number;
}
export interface Fish extends Swimmer {
  state: 'cruise' | 'hold' | 'dart';
  timer: number;
  /** Stream fish: the river sample they hold near. */
  home: number;
  stream: boolean;
}

export type BirdState = 'peck' | 'fly' | 'land';
export interface Bird {
  n: Vector3;
  dir: Vector3;
  /** Height above the ground (u; 0 on the ground). */
  alt: number;
  climb: number;
  state: BirdState;
  timer: number;
  /** Wing-beat phase (rad) and how hard it flaps (0 folded … 1). */
  flap: number;
  flapAmp: number;
  /** Where it's landing. */
  spot: Vector3;
  /** 0…1 while pecking (the head dips). */
  peck: number;
}

export interface WildEnv {
  /** Planet-local unit direction of the character. */
  player: Vector3;
  /** Other things rabbits and ground birds shy away from, like the character (Chopper). */
  threats?: readonly Vector3[];
  /** 0 = full day … 1 = full night. */
  night: number;
  obstacles: readonly Obstacle[];
  /** True where the ground is under water (stream or pond). */
  inWater(n: Vector3): boolean;
  pond: { n: Vector3; shore(n: Vector3): number } | null;
  river: River | null;
}

export interface Wildlife {
  rabbits: Rabbit[];
  duck: Duck | null;
  ducklings: Swimmer[];
  fish: Fish[];
  birds: Bird[];
  rand: () => number;
}

// ---------------------------------------------------------------------------
// Sphere steering helpers
// ---------------------------------------------------------------------------

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

/** Unit tangent at `n` pointing away from `from` (flee), or null when they coincide. */
function awayFrom(n: Vector3, from: Vector3, out = new Vector3()): Vector3 | null {
  const t = tangentToward(n, from, out);
  return t ? t.negate() : null;
}

function step(a: { n: Vector3; dir: Vector3 }, dist: number): void {
  a.n.copy(moveAlong(a.n, a.dir, dist / R));
  transport(a.dir, a.n);
}

const dist = (a: Vector3, b: Vector3) => arcDistance(a, b, R);

/** The nearest threat to `n` (the character, or another in `env.threats`) and how far it is. */
export function nearestThreat(n: Vector3, env: Pick<WildEnv, 'player' | 'threats'>): { at: Vector3; d: number } {
  let at = env.player;
  let d = dist(n, at);
  for (const t of env.threats ?? []) {
    const e = dist(n, t);
    if (e < d) {
      d = e;
      at = t;
    }
  }
  return { at, d };
}

function onLand(env: WildEnv, n: Vector3, pad = 0.12): boolean {
  if (env.inWater(n)) return false;
  for (const o of env.obstacles) if (dist(n, o.n) < o.radiusU + pad) return false;
  return true;
}

/** How far (u) `n` is inside open water: > 0 inside, < 0 outside (pond shore or stream bank). */
function waterMargin(env: WildEnv, n: Vector3): number {
  let m = -Infinity;
  if (env.pond) m = Math.max(m, env.pond.shore(n) - dist(n, env.pond.n));
  if (env.river) {
    const rd = riverDistance(env.river, n);
    m = Math.max(m, env.river.halfWidth[rd.i] - rd.d);
  }
  return m;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

function tangentAt(n: Vector3, rand: () => number): Vector3 {
  const t = tangentToward(n, new Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize()) ?? tangentToward(n, new Vector3(0, 1, 0))!;
  return t;
}

/**
 * Open-meadow starting spots for rabbits and ground birds: from `candidates` (e.g. the grass
 * placements), the ones on dry, unobstructed ground away from the plaza (`spawn`), spread out.
 */
export function meadowSpots(env: WildEnv, candidates: readonly Vector3[], spawn: Vector3, count = 12): Vector3[] {
  const out: Vector3[] = [];
  for (const c of candidates) {
    if (out.length >= count) break;
    if (dist(c, spawn) < 4 || !onLand(env, c, 0.35)) continue;
    if (out.some((o) => dist(o, c) < 2.2)) continue;
    out.push(c.clone());
  }
  return out;
}

/** Seeded starting population. `spots` are open-meadow points for rabbits and ground birds. */
export function createWildlife(env: WildEnv, spots: readonly Vector3[], seed = 41): Wildlife {
  const rand = mulberry32(seed);
  const pick = () => spots[Math.floor(rand() * spots.length) % spots.length] ?? new Vector3(0, 1, 0);
  const rabbits: Rabbit[] = [];
  for (let i = 0; i < 4 && spots.length; i++) {
    const n = pick().clone();
    rabbits.push({ n, dir: tangentAt(n, rand), home: n.clone(), state: 'graze', timer: 1 + rand() * 4, upright: false, hopsLeft: 0, hop: -1, hopTime: WILD.rabbit.hopTime, from: n.clone(), to: n.clone(), zig: 1 });
  }
  let duck: Duck | null = null;
  const ducklings: Swimmer[] = [];
  const fish: Fish[] = [];
  const pond = env.pond;
  if (pond) {
    const n = moveAlong(pond.n, tangentAt(pond.n, rand), (pond.shore(pond.n) * 0.3) / R);
    duck = { n, dir: tangentAt(n, rand), speed: WILD.duck.speed, state: 'paddle', timer: 3 + rand() * 4 };
    for (let i = 0; i < 4; i++) {
      const d = moveAlong(n, duck.dir, (-(i + 1) * WILD.duck.spacing) / R);
      ducklings.push({ n: d, dir: duck.dir.clone(), speed: 0 });
    }
    for (let i = 0; i < 5; i++) {
      const f = moveAlong(pond.n, tangentAt(pond.n, rand), (pond.shore(pond.n) * (0.2 + rand() * 0.4)) / R);
      fish.push({ n: f, dir: tangentAt(f, rand), speed: WILD.fish.cruise, state: 'cruise', timer: 2 + rand() * 3, home: -1, stream: false });
    }
  }
  const river = env.river;
  if (river) {
    for (let i = 0; i < 4; i++) {
      const home = Math.floor(river.samples.length * (0.2 + 0.15 * i));
      const f = river.samples[home].clone();
      fish.push({ n: f, dir: river.tangent[home].clone().negate(), speed: 0, state: 'hold', timer: 1 + rand() * 2, home, stream: true });
    }
  }
  const birds: Bird[] = [];
  for (let i = 0; i < 7 && spots.length; i++) {
    const n = pick().clone();
    const flying = i >= 4;
    birds.push({ n, dir: tangentAt(n, rand), alt: flying ? WILD.bird.minAlt + rand() : 0, climb: 0, state: flying ? 'fly' : 'peck', timer: 8 + rand() * 20, flap: rand() * 6, flapAmp: flying ? 1 : 0, spot: n.clone(), peck: 0 });
  }
  return { rabbits, duck, ducklings, fish, birds, rand };
}

// ---------------------------------------------------------------------------
// Rabbits
// ---------------------------------------------------------------------------

/** Plan the next hop from the rabbit's heading; turn away from water and obstacles. Returns false if boxed in. */
function planHop(r: Rabbit, env: WildEnv, len: number, time: number, rand: () => number): boolean {
  for (let tries = 0; tries < 6; tries++) {
    const to = moveAlong(r.n, r.dir, len / R);
    if (onLand(env, to)) {
      r.from.copy(r.n);
      r.to.copy(to);
      r.hop = 0;
      r.hopTime = time;
      return true;
    }
    rotateAbout(r.dir, r.n, (rand() < 0.5 ? 1 : -1) * (1 + tries * 0.4));
  }
  return false;
}

function stepRabbit(r: Rabbit, env: WildEnv, dt: number, rand: () => number): void {
  const W = WILD.rabbit;
  const threat = nearestThreat(r.n, env);
  const d = threat.d;
  // mid-hop: finish it (a hop in the air can't change its mind)
  if (r.hop >= 0) {
    r.hop += dt / r.hopTime;
    if (r.hop >= 1) {
      r.n.copy(r.to);
      transport(r.dir, r.n);
      r.hop = -1;
    } else {
      const t = r.hop;
      const len = dist(r.from, r.to);
      const along = tangentToward(r.from, r.to);
      if (along) r.n.copy(moveAlong(r.from, along, (len * t) / R));
      return;
    }
  }
  // threat response overrides everything (flee first, then vigilance)
  if (d < W.flee && r.state !== 'flee') {
    r.state = 'flee';
    r.hopsLeft = 8 + Math.floor(rand() * 5);
    r.upright = false;
  } else if (d < W.alert && (r.state === 'graze' || r.state === 'hop')) {
    r.state = 'alert';
    r.timer = 1.5 + rand() * 2;
    r.upright = true;
  }
  switch (r.state) {
    case 'flee': {
      const away = awayFrom(r.n, threat.at);
      if (away) {
        // zigzag: alternate a sideways jink on each bound, as hares and rabbits do
        r.zig = -r.zig;
        rotateAbout(away, r.n, r.zig * (0.25 + rand() * 0.3));
        r.dir.copy(away);
      }
      if (r.hopsLeft-- <= 0 && d > W.safe) {
        r.state = 'alert';
        r.upright = true;
        r.timer = 2 + rand() * 3;
        // the new patch becomes home
        r.home.copy(r.n);
        break;
      }
      if (!planHop(r, env, W.fleeHopLen, W.fleeHopTime, rand)) r.hopsLeft = 0;
      break;
    }
    case 'alert': {
      // frozen, upright, watching the threat
      const toward = tangentToward(r.n, threat.at);
      if (toward && d < W.alert * 1.2) turnToward(r.dir, r.n, toward, 2 * dt);
      r.timer -= dt;
      if (r.timer <= 0 && d > W.alert) {
        r.state = 'graze';
        r.upright = false;
        r.timer = 2 + rand() * 4;
      }
      break;
    }
    case 'graze': {
      r.timer -= dt;
      // now and then sit up and scan
      if (rand() < dt * 0.25) r.upright = !r.upright;
      if (r.timer <= 0) {
        r.state = 'hop';
        r.upright = false;
        r.hopsLeft = 2 + Math.floor(rand() * 4);
        // wander: a random new heading, drawn back toward home when straying
        rotateAbout(r.dir, r.n, (rand() - 0.5) * 2.2);
        if (dist(r.n, r.home) > W.range) {
          const back = tangentToward(r.n, r.home);
          if (back) turnToward(r.dir, r.n, back, 1.2);
        }
      }
      break;
    }
    case 'hop': {
      if (r.hopsLeft-- <= 0) {
        r.state = 'graze';
        r.timer = 1.5 + rand() * 4.5;
        break;
      }
      rotateAbout(r.dir, r.n, (rand() - 0.5) * 0.6);
      if (!planHop(r, env, W.hopLen, W.hopTime, rand)) {
        r.state = 'graze';
        r.timer = 1 + rand() * 2;
      }
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Duck and ducklings
// ---------------------------------------------------------------------------

function stepDuck(duck: Duck, brood: Swimmer[], env: WildEnv, dt: number, rand: () => number): void {
  const W = WILD.duck;
  const pond = env.pond;
  if (!pond) return;
  const d = dist(duck.n, env.player);
  if (d < W.flee) duck.state = 'flee';
  else if (duck.state === 'flee' && d > W.calm) {
    duck.state = 'paddle';
    duck.timer = 3 + rand() * 4;
  }
  let target = 0;
  if (duck.state === 'flee') {
    const away = awayFrom(duck.n, env.player);
    if (away) turnToward(duck.dir, duck.n, away, 3 * dt);
    target = W.fleeSpeed;
  } else if (duck.state === 'dabble') {
    duck.timer -= dt;
    if (duck.timer <= 0) {
      duck.state = 'paddle';
      duck.timer = 4 + rand() * 6;
    }
  } else {
    // wander: a gentle random turn
    rotateAbout(duck.dir, duck.n, (rand() - 0.5) * 1.6 * dt);
    target = W.speed;
    duck.timer -= dt;
    if (duck.timer <= 0) {
      duck.state = 'dabble';
      duck.timer = 1.2 + rand() * 1.8;
    }
  }
  // containment: steer back toward the middle before the shore
  const margin = pond.shore(duck.n) - dist(duck.n, pond.n);
  if (margin < W.shoreMargin) {
    const inward = tangentToward(duck.n, pond.n);
    if (inward) turnToward(duck.dir, duck.n, inward, (duck.state === 'flee' ? 5 : 2.5) * dt * (1 + (W.shoreMargin - margin) * 4));
  }
  duck.speed += (target - duck.speed) * Math.min(1, dt * 2.5);
  // never paddle out of the water: turn instead
  const next = moveAlong(duck.n, duck.dir, (duck.speed * dt) / R);
  if (pond.shore(next) - dist(next, pond.n) > 0.15) {
    duck.n.copy(next);
    transport(duck.dir, duck.n);
  } else rotateAbout(duck.dir, duck.n, 2.2 * dt + 0.3);
  // ducklings: follow the leader, each arriving a spacing behind the one ahead
  let lead: Swimmer = duck;
  for (const k of brood) {
    const slot = moveAlong(lead.n, lead.dir, -W.spacing / R);
    const gap = dist(k.n, slot);
    const toward = tangentToward(k.n, slot);
    if (toward) turnToward(k.dir, k.n, toward, 6 * dt);
    const want = Math.min(1.1, gap * 2.2); // arrive: slow down as it closes in
    k.speed += (want - k.speed) * Math.min(1, dt * 4);
    step(k, k.speed * dt);
    lead = k;
  }
}

// ---------------------------------------------------------------------------
// Fish
// ---------------------------------------------------------------------------

function stepFish(f: Fish, school: Fish[], env: WildEnv, dt: number, rand: () => number): void {
  const W = WILD.fish;
  const d = dist(f.n, env.player);
  // the stream fish's place in the channel, once per step (the channel maths isn't free)
  const rd = f.stream && env.river ? riverDistance(env.river, f.n) : null;
  if (d < W.flee && f.state !== 'dart') {
    f.state = 'dart';
    f.timer = W.dartTime;
    const away = awayFrom(f.n, env.player);
    if (away) {
      if (rd && env.river) {
        // along the channel, whichever way leads away
        const t = env.river.tangent[rd.i];
        f.dir.copy(t.dot(away) >= 0 ? t : t.clone().negate());
        transport(f.dir, f.n);
      } else f.dir.copy(away);
    }
  }
  if (f.state === 'dart') {
    f.speed = W.dart;
    f.timer -= dt;
    if (f.timer <= 0) {
      f.state = f.stream ? 'hold' : 'cruise';
      f.timer = 2 + rand() * 3;
    }
  } else if (rd && env.river) {
    // hold station facing upstream; drift back toward home when displaced
    const river = env.river;
    const home = river.samples[f.home];
    const up = river.tangent[rd.i].clone().negate();
    transport(up, f.n);
    turnToward(f.dir, f.n, up, 2 * dt);
    const off = dist(f.n, home);
    f.speed = off > 0.2 ? Math.min(0.5, off) : 0.04 * Math.sin(f.timer * 3);
    if (off > 0.2) {
      const back = tangentToward(f.n, home);
      if (back) f.n.copy(moveAlong(f.n, back, (f.speed * dt) / R));
      f.speed = 0;
    }
    f.timer -= dt;
    if (f.timer <= 0) f.timer = 2 + rand() * 3;
  } else {
    // pond school: wander + separation (+ containment below)
    rotateAbout(f.dir, f.n, (rand() - 0.5) * 3 * dt);
    for (const o of school) {
      if (o === f || o.stream) continue;
      const g = dist(f.n, o.n);
      if (g < W.separation && g > 1e-6) {
        const away = awayFrom(f.n, o.n);
        if (away) turnToward(f.dir, f.n, away, 3 * dt);
      }
    }
    f.speed += ((f.state === 'hold' ? 0 : W.cruise) - f.speed) * Math.min(1, dt * 2);
    f.timer -= dt;
    if (f.timer <= 0) {
      f.state = f.state === 'hold' ? 'cruise' : rand() < 0.35 ? 'hold' : 'cruise';
      f.timer = 1.5 + rand() * 3;
    }
  }
  // containment: stay in open water (the pond for the school, the channel for stream fish)
  const margin = rd && env.river ? env.river.halfWidth[rd.i] * 0.7 - rd.d : env.pond ? env.pond.shore(f.n) - dist(f.n, env.pond.n) - W.shoreMargin : 1;
  if (margin < 0) {
    const centre = rd && env.river ? env.river.samples[rd.i] : env.pond!.n;
    const inward = tangentToward(f.n, centre);
    if (inward) turnToward(f.dir, f.n, inward, 8 * dt);
  }
  const next = moveAlong(f.n, f.dir, (f.speed * dt) / R);
  // (a fish that isn't moving can't leave the water: skip the check)
  if (f.speed === 0 || waterMargin(env, next) > 0.05) {
    f.n.copy(next);
    transport(f.dir, f.n);
  } else rotateAbout(f.dir, f.n, 2.5);
}

// ---------------------------------------------------------------------------
// Birds
// ---------------------------------------------------------------------------

/** A landing spot: open ground at least `WILD.bird.landAway` from the character, not too far off. */
function landingSpot(b: Bird, env: WildEnv, rand: () => number): Vector3 | null {
  for (let tries = 0; tries < 12; tries++) {
    const s = moveAlong(b.n, tangentAt(b.n, rand), (2 + rand() * 6) / R);
    if (dist(s, env.player) > WILD.bird.landAway && onLand(env, s, 0.3)) return s;
  }
  return null;
}

function stepBird(b: Bird, flock: Bird[], env: WildEnv, dt: number, rand: () => number): void {
  const W = WILD.bird;
  const threat = b.state === 'peck' ? nearestThreat(b.n, env) : { at: env.player, d: dist(b.n, env.player) };
  const d = threat.d;
  if (b.state === 'peck') {
    b.flapAmp += (0 - b.flapAmp) * Math.min(1, dt * 8);
    b.peck = Math.max(0, Math.sin(b.timer * 7) * 1.2 - 0.2);
    // little hops and turns while foraging
    if (rand() < dt * 0.8) rotateAbout(b.dir, b.n, (rand() - 0.5) * 2);
    if (rand() < dt * 0.5) {
      const to = moveAlong(b.n, b.dir, 0.08 / R);
      if (onLand(env, to, 0.2)) {
        b.n.copy(to);
        transport(b.dir, b.n);
      }
    }
    b.timer -= dt;
    // take off when approached (or, now and then, on a whim)
    if (d < W.takeOff || b.timer <= 0) {
      b.state = 'fly';
      b.climb = 2.2;
      b.timer = 12 + rand() * 25;
      const away = awayFrom(b.n, threat.at);
      if (away && d < W.takeOff * 1.5) b.dir.copy(away);
      b.peck = 0;
    }
    return;
  }
  b.flap += dt * (b.state === 'land' ? 10 : 13);
  if (b.state === 'fly') {
    // boids: separation, alignment, cohesion among the flying birds
    const sep = new Vector3();
    const ali = new Vector3();
    const coh = new Vector3();
    let count = 0;
    for (const o of flock) {
      if (o === b || o.state === 'peck') continue;
      const g = dist(b.n, o.n);
      if (g > W.neighbour) continue;
      count++;
      ali.add(o.dir);
      coh.add(o.n);
      if (g < W.separation && g > 1e-6) sep.add(awayFrom(b.n, o.n) ?? new Vector3()).multiplyScalar(1);
    }
    const desired = b.dir.clone();
    if (count) {
      const centre = tangentToward(b.n, coh.multiplyScalar(1 / count).normalize());
      if (centre) desired.addScaledVector(centre, 0.5);
      desired.addScaledVector(transport(ali.normalize(), b.n), 0.6);
      desired.addScaledVector(sep, 1.4);
    }
    // wander, and keep clear of the character
    desired.addScaledVector(rotateAbout(b.dir.clone(), b.n, (rand() - 0.5) * 2), 0.3);
    if (d < W.takeOff * 1.5) desired.addScaledVector(awayFrom(b.n, env.player) ?? new Vector3(), 0.8);
    transport(desired, b.n);
    turnToward(b.dir, b.n, desired, 1.6 * dt);
    // altitude band, with gentle undulation (flap to climb, glide to descend)
    const target = (W.minAlt + W.maxAlt) / 2 + Math.sin(b.flap * 0.05) * 0.5;
    b.climb += ((target - b.alt) * 0.8 - b.climb) * Math.min(1, dt * 1.5);
    b.flapAmp += ((b.climb > -0.1 ? 1 : 0.2) - b.flapAmp) * Math.min(1, dt * 3);
    b.alt += b.climb * dt;
    step(b, W.speed * dt);
    b.timer -= dt;
    if (b.timer <= 0) {
      const spot = landingSpot(b, env, rand);
      if (spot) {
        b.state = 'land';
        b.spot.copy(spot);
      } else b.timer = 5;
    }
  } else {
    // land: seek the spot, gliding down, then arrive
    const toward = tangentToward(b.n, b.spot);
    const g = dist(b.n, b.spot);
    if (toward) turnToward(b.dir, b.n, toward, 3 * dt);
    const speed = Math.min(W.speed, 0.4 + g * 0.8);
    b.alt = Math.max(0, Math.min(b.alt, g * 0.9));
    b.flapAmp += ((g < 1 ? 1 : 0.3) - b.flapAmp) * Math.min(1, dt * 3);
    step(b, Math.min(speed * dt, g));
    if (g < 0.08 || d < W.takeOff) {
      if (d < W.takeOff) {
        b.state = 'fly';
        b.climb = 2;
        b.timer = 10 + rand() * 20;
      } else {
        b.state = 'peck';
        b.alt = 0;
        b.climb = 0;
        b.timer = 10 + rand() * 30;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// The world step
// ---------------------------------------------------------------------------

/** Advance every animal by `dt` seconds (clamp dt; frozen when ambient motion is paused). */
export function stepWildlife(w: Wildlife, env: WildEnv, rawDt: number): void {
  const dt = Math.min(rawDt, 0.1);
  const rand = w.rand;
  for (const r of w.rabbits) stepRabbit(r, env, dt, rand);
  if (w.duck) stepDuck(w.duck, w.ducklings, env, dt, rand);
  for (const f of w.fish) stepFish(f, w.fish, env, dt, rand);
  // birds roost at night
  if (env.night < WILD.bird.nightHide) for (const b of w.birds) stepBird(b, w.birds, env, dt, rand);
}

/** Whether the birds are out (by day). */
export function birdsOut(env: Pick<WildEnv, 'night'>): boolean {
  return env.night < WILD.bird.nightHide;
}
