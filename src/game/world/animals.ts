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
 *   They come in four coats (wild agouti, grey, a fawn lop, the Dutch pattern). Three are mothers
 *   with kits, who keep to her side: each has its own place beside or behind her and hops after
 *   her when she moves off, a beat later; they freeze when she does, bolt with her, and she waits
 *   for them when they fall behind.
 * - **The duck** paddles about the pond (contained by its shore) with dabbling pauses; her
 *   **ducklings** follow in a loose, weaving line, each at its own distance and to its own side of
 *   the one ahead, now and then stopping to peck at the water and hurrying to catch up. A close
 *   threat sends her briskly away (still inside the pond) and the brood hurries after her. At
 *   crumbs she pecks at the water; the ducklings crowd round the crumbs and peck too. At night she
 *   leads them out onto the bank to their nest and sleeps there, head tucked, the ducklings snuggled
 *   round her; in the morning they go back to the water.
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
import { rotateAbout, transport, turnToward } from '../math/steer';

const R = CONFIG.planetRadius;

/** Behaviour distances (u) and speeds (u/s), after the real animals (scaled to the diorama). */
export const WILD = {
  rabbit: { alert: 4.0, flee: 2.4, safe: 5.2, hopLen: 0.3, hopTime: 0.3, fleeHopLen: 0.62, fleeHopTime: 0.26, range: 3.5 },
  /** A kit: its hops (shorter, quicker), how far it lets its mother get before it follows, and how far behind she waits for it. */
  kit: { hopLen: 0.17, hopTime: 0.2, fleeHopLen: 0.5, fleeHopTime: 0.22, near: 0.06, wait: 0.75 },
  duck: { flee: 2.6, calm: 4.2, speed: 0.22, fleeSpeed: 0.7, shoreMargin: 0.55, spacing: 0.24, feedSpeed: 0.4, feedReach: 0.18, nestAt: 0.55, wakeAt: 0.35, walk: 0.16, nestR: 0.15 },
  fish: { flee: 1.7, cruise: 0.3, dart: 1.7, dartTime: 0.7, shoreMargin: 0.35, separation: 0.3 },
  bird: { takeOff: 2.4, landAway: 5, speed: 2.1, minAlt: 2.3, maxAlt: 3.8, separation: 0.55, neighbour: 3.2, nightHide: 0.6 },
} as const;

export type RabbitState = 'graze' | 'hop' | 'alert' | 'flee';
/** The rabbits' coats: wild agouti, blue-grey, a fawn lop (ears hanging), the black-and-white Dutch. */
export const RABBIT_COATS = ['wild', 'grey', 'lop', 'dutch'] as const;
export type RabbitCoat = (typeof RABBIT_COATS)[number];
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
  coat: RabbitCoat;
  /** A kit's mother (null for an adult); its place beside or behind her (u back, rad off her tail), and how far she gets before it follows (u). */
  mum: Rabbit | null;
  gap: number;
  side: number;
  lag: number;
}

export interface Swimmer {
  n: Vector3;
  dir: Vector3;
  speed: number;
}
export interface Duck extends Swimmer {
  state: 'paddle' | 'dabble' | 'flee' | 'feed' | 'toNest' | 'nest' | 'leave';
  timer: number;
  /** Her own clock (s): the pecking rhythm. */
  clock: number;
  /** How far her head is down (0 up … 1 bill in the water), pecking at crumbs. */
  peck: number;
  /** 0 awake … 1 settled asleep in the nest (head tucked). */
  rest: number;
}
export interface Duckling extends Swimmer {
  /** Its own place in the brood: how far behind the one ahead (u), how far to the side (u), and a phase for its weaving. */
  gap: number;
  side: number;
  phase: number;
  /** Seconds left dawdling (it stopped to peck at something), and how far its head is down (0…1). */
  dawdle: number;
  peck: number;
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
  /** Crumbs on the water (someone on the pond bench is feeding the ducks): the duck swims over to them. */
  feed?: Vector3 | null;
  /** The character is sitting still (on a bench): the duck doesn't take fright at them. */
  calm?: boolean;
  /** The ducks' nest on the pond's bank (homestead.ts `duckNest`), where they sleep at night. */
  nest?: Vector3 | null;
}

export interface Wildlife {
  rabbits: Rabbit[];
  duck: Duck | null;
  ducklings: Duckling[];
  fish: Fish[];
  birds: Bird[];
  rand: () => number;
}

// ---------------------------------------------------------------------------
// Sphere steering helpers
// ---------------------------------------------------------------------------


// (the tangent-direction helpers live in math/steer.ts, shared with Chopper and the family)
export { rotateAbout, transport, turnToward };

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
  // (the adults: a wild mother, a Dutch mother, a lop mother and a grey buck on his own)
  const coats: RabbitCoat[] = ['wild', 'dutch', 'lop', 'grey'];
  for (let i = 0; i < 4 && spots.length; i++) {
    const n = pick().clone();
    rabbits.push({ n, dir: tangentAt(n, rand), home: n.clone(), state: 'graze', timer: 1 + rand() * 4, upright: false, hopsLeft: 0, hop: -1, hopTime: WILD.rabbit.hopTime, from: n.clone(), to: n.clone(), zig: 1, coat: coats[i], mum: null, gap: 0, side: 0, lag: 0 });
  }
  let duck: Duck | null = null;
  const ducklings: Duckling[] = [];
  const fish: Fish[] = [];
  const pond = env.pond;
  if (pond) {
    const n = moveAlong(pond.n, tangentAt(pond.n, rand), (pond.shore(pond.n) * 0.3) / R);
    duck = { n, dir: tangentAt(n, rand), speed: WILD.duck.speed, state: 'paddle', timer: 3 + rand() * 4, clock: 0, peck: 0, rest: 0 };
    // (their own seed, so the rest of the population is unchanged)
    const kid = mulberry32(seed + 7);
    for (let i = 0; i < 4; i++) {
      const d = moveAlong(n, duck.dir, (-(i + 1) * WILD.duck.spacing) / R);
      ducklings.push({ n: d, dir: duck.dir.clone(), speed: 0, gap: WILD.duck.spacing * (0.75 + kid() * 0.55), side: (kid() - 0.5) * 0.14, phase: kid() * 6.28, dawdle: 0, peck: 0 });
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
  // the kits, after everyone else (their own seed, so the rest of the population is unchanged):
  // two with the wild mother, one with the Dutch, two with the lop, each wearing its mother's coat
  const kitRand = mulberry32(seed + 13);
  const adults = rabbits.slice();
  [2, 1, 2].forEach((count, m) => {
    const mum = adults[m];
    if (!mum) return;
    for (let j = 0; j < count; j++) {
      const gap = 0.16 + kitRand() * 0.14;
      const side = (j % 2 ? 1 : -1) * (0.35 + kitRand() * 0.6);
      const back = rotateAbout(mum.dir.clone().negate(), mum.n, side);
      const at = moveAlong(mum.n, back, gap / R);
      const n = onLand(env, at) ? at : mum.n.clone();
      rabbits.push({ n, dir: mum.dir.clone(), home: n.clone(), state: 'graze', timer: 0, upright: false, hopsLeft: 0, hop: -1, hopTime: WILD.kit.hopTime, from: n.clone(), to: n.clone(), zig: 1, coat: mum.coat, mum, gap, side, lag: 0.1 + kitRand() * 0.12 });
    }
  });
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

/** Carry a hop on (a hop in the air can't change its mind). True while it's still in the air. */
function inAir(r: Rabbit, dt: number): boolean {
  if (r.hop < 0) return false;
  r.hop += dt / r.hopTime;
  if (r.hop >= 1) {
    r.n.copy(r.to);
    transport(r.dir, r.n);
    r.hop = -1;
    return false;
  }
  const along = tangentToward(r.from, r.to);
  if (along) r.n.copy(moveAlong(r.from, along, (dist(r.from, r.to) * r.hop) / R));
  return true;
}

/** `waiting`: a mother whose kit has fallen behind stops at the end of this hop until it catches up. */
function stepRabbit(r: Rabbit, env: WildEnv, dt: number, rand: () => number, waiting = false): void {
  const W = WILD.rabbit;
  const threat = nearestThreat(r.n, env);
  const d = threat.d;
  if (inAir(r, dt)) return;
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
      if (r.hopsLeft-- <= 0 || waiting) {
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

/**
 * A kit keeps to its mother: its own place beside or behind her (`gap`, `side`), hopping after her
 * once she's `lag` u past it, a beat after she goes. It freezes when she does, bolts when she bolts
 * (or when a threat gets close to it), and between hops it grazes, facing about the way she does.
 */
function stepKit(k: Rabbit, env: WildEnv, dt: number, rand: () => number): void {
  const mum = k.mum!;
  const K = WILD.kit;
  if (inAir(k, dt)) return;
  const scared = mum.state === 'flee' || nearestThreat(k.n, env).d < WILD.rabbit.flee * 0.8;
  // its place: behind her (to its own side of her tail), or tucked in close while she's fleeing or alert
  const back = rotateAbout(mum.dir.clone().negate(), mum.n, k.side);
  const place = moveAlong(mum.n, back, (scared || mum.state === 'alert' ? k.gap * 0.7 : k.gap) / R);
  const off = dist(k.n, place);
  const go = scared ? K.near : mum.state === 'alert' ? k.lag * 3 : k.lag;
  if (off > go) {
    const toward = tangentToward(k.n, place);
    if (toward) k.dir.copy(toward);
    // (a little wobble, so a pair of kits don't hop in step)
    rotateAbout(k.dir, k.n, (rand() - 0.5) * 0.3);
    const [len, time] = scared ? [K.fleeHopLen, K.fleeHopTime] : [K.hopLen, K.hopTime * (0.85 + rand() * 0.3)];
    if (planHop(k, env, Math.min(len, off + 0.02), time, rand)) {
      k.state = scared ? 'flee' : 'hop';
      return;
    }
  }
  k.state = scared ? 'flee' : mum.state === 'alert' ? 'alert' : 'graze';
  k.upright = false;
  if (k.state !== 'flee') turnToward(k.dir, k.n, mum.dir, 0.8 * dt);
}

// ---------------------------------------------------------------------------
// Duck and ducklings
// ---------------------------------------------------------------------------

/** A point `r` u from `c` in the tangent direction `ref` turned by `a` (rad) about `c`. */
function around(c: Vector3, ref: Vector3, a: number, r: number): Vector3 {
  const dir = ref.clone().addScaledVector(c, -ref.dot(c)).normalize();
  rotateAbout(dir, c, a);
  return moveAlong(c, dir, r / R);
}

/** A quick head-down peck, then back up, a few a second, with a pause to swallow now and then. */
const pecking = (t: number) => (Math.sin(t * 7.5) > 0.25 && t % 2.6 < 1.9 ? 1 : 0);

function stepDuck(duck: Duck, brood: Duckling[], env: WildEnv, dt: number, rand: () => number): void {
  const W = WILD.duck;
  const pond = env.pond;
  if (!pond) return;
  duck.clock += dt;
  const margin = (n: Vector3) => pond.shore(n) - dist(n, pond.n);
  const ashore = margin(duck.n) < 0;
  const nest = env.nest ?? null;
  // night: out onto the bank to the nest; morning: back to the water
  if (nest && env.night > W.nestAt) {
    if (duck.state !== 'nest') duck.state = 'toNest';
  } else if (duck.state === 'toNest' || duck.state === 'nest') duck.state = 'leave';
  else if (duck.state === 'leave' && margin(duck.n) > W.shoreMargin) {
    duck.state = 'paddle';
    duck.timer = 3 + rand() * 4;
  }
  const nightly = duck.state === 'toNest' || duck.state === 'nest' || duck.state === 'leave';
  const d = dist(duck.n, env.player);
  if (!nightly) {
    const scared = !env.calm && d < W.flee;
    if (scared) duck.state = 'flee';
    else if (duck.state === 'flee' && (env.calm || d > W.calm)) {
      duck.state = 'paddle';
      duck.timer = 3 + rand() * 4;
    }
    // crumbs on the water: over to them (arriving slowly), then pecking at them while they last
    if (env.feed && duck.state !== 'flee') duck.state = 'feed';
    else if (!env.feed && duck.state === 'feed') {
      duck.state = 'paddle';
      duck.timer = 3 + rand() * 4;
    }
  }
  let target = 0;
  let eating = false;
  if (duck.state === 'toNest' && nest) {
    const gap = dist(duck.n, nest);
    const toward = tangentToward(duck.n, nest);
    if (toward && gap > 0.02) turnToward(duck.dir, duck.n, toward, 4 * dt);
    target = Math.min(ashore ? W.walk : W.speed * 1.4, gap * 1.5 + 0.03);
    if (gap < 0.04) duck.state = 'nest';
  } else if (duck.state === 'nest') {
    // settled in, facing the water
    const out = tangentToward(duck.n, pond.n);
    if (out) turnToward(duck.dir, duck.n, out, 1.2 * dt);
  } else if (duck.state === 'leave') {
    const toward = tangentToward(duck.n, pond.n);
    if (toward) turnToward(duck.dir, duck.n, toward, 4 * dt);
    target = ashore ? W.walk : W.speed;
  } else if (duck.state === 'feed') {
    const gap = dist(duck.n, env.feed!);
    const toward = tangentToward(duck.n, env.feed!);
    if (toward && gap > 0.05) turnToward(duck.dir, duck.n, toward, 3 * dt);
    target = gap < W.feedReach ? 0 : Math.min(W.feedSpeed, (gap - W.feedReach) * 1.5 + 0.05);
    eating = gap < W.feedReach + 0.12;
  } else if (duck.state === 'flee') {
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
  duck.peck += ((eating ? pecking(duck.clock) : 0) - duck.peck) * Math.min(1, dt * 16);
  duck.rest += ((duck.state === 'nest' ? 1 : 0) - duck.rest) * Math.min(1, dt * (duck.state === 'nest' ? 0.5 : 2));
  if (!nightly) {
    // containment: steer back toward the middle before the shore
    const m = margin(duck.n);
    if (m < W.shoreMargin) {
      const inward = tangentToward(duck.n, pond.n);
      if (inward) turnToward(duck.dir, duck.n, inward, (duck.state === 'flee' ? 5 : 2.5) * dt * (1 + (W.shoreMargin - m) * 4));
    }
  }
  duck.speed += (target - duck.speed) * Math.min(1, dt * 2.5);
  const next = moveAlong(duck.n, duck.dir, (duck.speed * dt) / R);
  // by day she never paddles out of the water (she turns instead); at night she walks up the bank
  if (nightly || margin(next) > 0.15) {
    duck.n.copy(next);
    transport(duck.dir, duck.n);
  } else rotateAbout(duck.dir, duck.n, 2.2 * dt + 0.3);

  // ducklings: each follows the one ahead at its own distance and to its own side, weaving a little
  const home = duck.state === 'nest' && nest ? nest : null;
  const crumbs = duck.state === 'feed' && env.feed && dist(duck.n, env.feed) < 0.9 ? env.feed : null;
  const ref = tangentToward(home ?? crumbs ?? duck.n, pond.n) ?? duck.dir;
  let lead: Swimmer = duck;
  brood.forEach((k, i) => {
    k.phase += dt;
    let slot: Vector3;
    if (home) slot = around(home, ref, 0.6 + (i / brood.length) * Math.PI * 2, W.nestR + (i % 2) * 0.03);
    else if (crumbs) slot = around(crumbs, ref, 2.2 + i * 1.3 + Math.sin(k.phase * 0.4) * 0.3, 0.16 + (i % 2) * 0.06);
    else {
      const behind = moveAlong(lead.n, lead.dir, -k.gap / R);
      const side = new Vector3().crossVectors(lead.n, lead.dir).normalize();
      slot = moveAlong(behind, side, (k.side + 0.05 * Math.sin(k.phase * 0.8 + i * 1.9)) / R);
    }
    // now and then one stops to peck at something on the water, then hurries after the others
    if (k.dawdle > 0) k.dawdle -= dt;
    else if (!nightly && !crumbs && duck.state !== 'flee' && rand() < dt * 0.06) k.dawdle = 0.6 + rand() * 1.2;
    if (nightly || crumbs || duck.state === 'flee') k.dawdle = 0;
    const gap = dist(k.n, slot);
    const toward = tangentToward(k.n, slot);
    if (toward && gap > 0.01) turnToward(k.dir, k.n, toward, 6 * dt);
    else if (home) {
      const out = tangentToward(k.n, pond.n);
      if (out) turnToward(k.dir, k.n, out, 2 * dt);
    }
    // arrive: slow down as it closes in (a dawdler stops, then catches up at a scurry)
    const want = k.dawdle > 0 ? 0 : Math.min(nightly ? 0.5 : 1.3, gap * 2.2);
    k.speed += (want - k.speed) * Math.min(1, dt * 4);
    step(k, k.speed * dt);
    const peck = k.dawdle > 0 || (crumbs && gap < 0.1) ? pecking(k.phase + i * 0.7) : 0;
    k.peck += (peck - k.peck) * Math.min(1, dt * 16);
    lead = k;
  });
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
  for (const r of w.rabbits) {
    if (r.mum) stepKit(r, env, dt, rand);
    else stepRabbit(r, env, dt, rand, r.state === 'hop' && w.rabbits.some((k) => k.mum === r && dist(k.n, r.n) > WILD.kit.wait));
  }
  if (w.duck) stepDuck(w.duck, w.ducklings, env, dt, rand);
  for (const f of w.fish) stepFish(f, w.fish, env, dt, rand);
  // birds roost at night
  if (env.night < WILD.bird.nightHide) for (const b of w.birds) stepBird(b, w.birds, env, dt, rand);
}

/** Whether the birds are out (by day). */
export function birdsOut(env: Pick<WildEnv, 'night'>): boolean {
  return env.night < WILD.bird.nightHide;
}
