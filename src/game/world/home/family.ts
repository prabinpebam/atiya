/**
 * The family's minds (docs: family.md §5, prabin-npc.md): Rojina, Laija and Lingjel living by the
 * house, and Prabin, who roams the whole planet. A small utility AI in the style of The Sims' smart
 * objects: each activity belongs to a place or a person (the reading chair, the tree, the mat, the
 * pond's edge, a butterfly, a building, Chopper, one of the family), scores itself for whoever
 * could do it, and the winner is done for a while, then cools down and isn't repeated straight
 * away. Seats are smart objects with entry points (seats.ts); the front door is an off-mesh link
 * (a scripted walk up the steps and through it); routes come from the planet's navigation grid
 * (nav.ts), with time-to-collision avoidance between walkers and stuck repair. Pure: no rendering,
 * no DOM (the tests drive it directly).
 */
import { Vector3 } from 'three';
import { arcDistance, moveAlong, resolvePenetration, tangentToward, type Obstacle } from '../../math/sphere';
import { rotateAbout, transport, turnToward } from '../../math/steer';
import type { HomeSpot, Homestead } from '../homestead';
import { SphereNav, type NavBlock } from './nav';
import { SIT_T, homeSeats, pickEntry, seatFacing, sitPath, type Seat } from './seats';

export type NpcId = 'rojina' | 'laija' | 'lingjel' | 'prabin';
export type NpcPose =
  | 'stand'
  | 'sitChair'
  | 'read'
  | 'readGround'
  | 'paint'
  | 'crawl'
  | 'lego'
  | 'throw'
  | 'crouch'
  | 'talk'
  | 'place'
  | 'fetch'
  | 'watch'
  | 'eat'
  | 'admire'
  | 'guitar'
  | 'hammer'
  | 'pet';

/** Poses in which they stay put (seated or on the ground) when someone talks to them. */
const SETTLED: ReadonlySet<NpcPose> = new Set(['read', 'sitChair', 'readGround', 'lego', 'eat', 'guitar']);
export type Held = 'book' | 'car' | 'pebble' | 'basket' | 'guitar' | 'hammer' | 'stick' | null;

export const NPC = {
  rojina: { name: 'Rojina', walk: 1.0, run: 1.6, runChance: 0 },
  laija: { name: 'Laija', walk: 1.05, run: 2.3, runChance: 0.4 },
  lingjel: { name: 'Lingjel', walk: 0.95, run: 2.5, runChance: 0.6 },
  prabin: { name: 'Prabin', walk: 1.15, run: 2.4, runChance: 0 },
} as const;

/** The children (they chase butterflies, startle them, and scare the rabbits). */
export const KIDS: ReadonlySet<NpcId> = new Set(['laija', 'lingjel']);

export const FAMILY = {
  /** Personal space round the character (u). */
  personal: 0.75,
  radius: 0.16,
  turnRate: 7,
  accel: 6,
  talkRange: 1.3,
  /** Hard minimum distances between centres (u): nobody walks through anybody. */
  gapPlayer: 0.55,
  gapOther: 0.42,
  gapFamily: 0.36,
} as const;

/**
 * The daily routine (docs: family.md §5): indoors from 8 pm, out again at 6 am. After the clock is
 * set by hand (a jump), they wait `delay` s before following it, so winding the time doesn't send
 * everyone scurrying at once.
 */
export const ROUTINE = { bed: 20, wake: 6, delay: 8, mealGap: 120, mealTime: [22, 32] as [number, number] } as const;

export const isNight = (hours: number) => {
  const h = ((hours % 24) + 24) % 24;
  return h >= ROUTINE.bed || h < ROUTINE.wake;
};

export interface Butterfly {
  n: Vector3;
  /** Height above the ground (u). */
  h: number;
  home: Vector3;
  phase: number;
  /** Seconds left of a startled dash. */
  scared: number;
  away: Vector3;
}

export interface FamilyWorld {
  R: number;
  home: Homestead;
  player: Vector3;
  obstacles: readonly Obstacle[];
  /** Ground they won't step on (the pond, deep water). */
  blocked(n: Vector3): boolean;
  rabbits: readonly { n: Vector3 }[];
  /** Flowers near the home (Laija crouches to look at them). */
  flowers: readonly Vector3[];
  /** The planet clock (hours). */
  hours: number;
  /** Others walking about who aren't family (Chopper): kept clear of like everyone else. */
  others: readonly Vector3[];
  /** The pond (Laija throws pebbles in from its edge). */
  pond: { n: Vector3; shore(n: Vector3): number } | null;
  /** The character's velocity (a tangent, u/s), for looking ahead when giving way. */
  playerVel?: Vector3;
  /** The rest of the planet, for Prabin (prabin-npc.md §4.6). */
  planet?: PlanetInfo;
  /** Chopper, for a game of fetch. */
  dog?: DogLink;
}

export interface PlanetInfo {
  /** The spawn plaza's centre. */
  spawn: Vector3;
  landmarks: ReadonlyArray<{ id: string; n: Vector3; approach: Vector3; footprintU: number }>;
  /** The crafting table (where Prabin works at the table's front), or null. */
  craft: HomeSpot | null;
  /** The bridges' ends (places to stroll to). */
  bridges: readonly Vector3[];
}

/** A stick for fetch, shared with Chopper's mind (`DogWorld.fetch`). */
export interface Fetch {
  state: 'none' | 'thrown' | 'carried' | 'dropped';
  /** Where the stick is (on the ground, or where it's flying to). */
  stick: Vector3;
  /** Who threw it (he brings it back to them). */
  to: Vector3;
  /** Seconds since the throw (the stick's flight). */
  flight: number;
  from: Vector3;
}

export interface DogLink {
  n: Vector3;
  /** Free to play (not answering a whistle, heeling or in his house). */
  free(): boolean;
}

/** Sitting on a seat: sliding onto it from the entry point (`in`), on it, or getting up (`out`). */
export interface SeatUse {
  seat: Seat;
  entry: HomeSpot;
  phase: 'in' | 'on' | 'out';
  t: number;
  from: Vector3;
  /** The activity it was for (anything else stands them up first). */
  owner: string;
}

/** Through the front door: waiting at the step for it to open, or walking up and in (or out and down). */
export interface DoorLink {
  dir: 'in' | 'out';
  phase: 'wait' | 'walk';
  t: number;
  from: Vector3;
  to: Vector3;
}

export interface Npc {
  id: NpcId;
  name: string;
  n: Vector3;
  dir: Vector3;
  speed: number;
  activity: string;
  stage: number;
  /** Time in the activity and in its stage (s). */
  t: number;
  stageT: number;
  dur: number;
  pose: NpcPose;
  poseT: number;
  goal: Vector3 | null;
  want: number;
  /** What they're looking at, or null. */
  look: Vector3 | null;
  /** The spot they're doing it at, and the way it faces. */
  at: HomeSpot | null;
  held: Held;
  /** Talking with the character (paused, facing them). */
  chatting: boolean;
  /** A speech bubble over the head (talking to one of the family). */
  bubble: boolean;
  partner: NpcId | null;
  recent: string[];
  cooldown: Record<string, number>;
  side: number;
  near: Obstacle[];
  nearAt: Vector3;
  /** The planned route to the goal (waypoints), what it was planned for, and how old it is (s). */
  route: Vector3[] | null;
  routeFor: Vector3;
  routeAge: number;
  /** How long they've wanted to walk without getting anywhere (s): past a moment, they give up on it. */
  stuck: number;
  /** In the house (at night): hidden, and not someone to talk to. */
  indoors: boolean;
  /** On (or getting on or off) a seat. */
  seat: SeatUse | null;
  /** The entry point they're walking to for a seat. */
  seatEntry: HomeSpot | null;
  /** Going through the front door. */
  link: DoorLink | null;
  /** Progress along the route: the distance to the next waypoint, and how long it hasn't shrunk (s). */
  progD: number;
  progT: number;
  /** Replans in a row without getting anywhere. */
  repairs: number;
}

export type FamilyEvent = { type: 'splash'; n: Vector3 } | { type: 'throw'; id: NpcId };

interface ActivityDef {
  id: string;
  /** Only ever set by the routine or a meal, never picked by the utility AI. */
  forced?: boolean;
  who: readonly NpcId[];
  weight: number;
  dur: [number, number];
  cooldown: number;
  /** Null when it can't be done now. */
  spot?(f: Family, npc: Npc, w: FamilyWorld): HomeSpot | null;
  /** Done sitting on this seat (walked to its entry point, then sat down). */
  seat?(f: Family, npc: Npc, w: FamilyWorld): Seat | null;
  /** Give it up now (someone with priority wants the place). */
  yield?(f: Family, npc: Npc, w: FamilyWorld): boolean;
  pose?: NpcPose;
  held?: Held;
  /** Run the whole activity by hand (moving targets, several stages); true when done. */
  run?(f: Family, npc: Npc, w: FamilyWorld, dt: number): boolean;
  start?(f: Family, npc: Npc, w: FamilyWorld): boolean;
}

const _t = new Vector3();
const _a = new Vector3();
const _d = new Vector3();
const _v = new Vector3();
const _w = new Vector3();
const _d2 = new Vector3();

/** Where Prabin stands to work at the crafting table: this far in front of its centre (u). */
export const CRAFT_STAND = 0.7;

/** The front door (prabin-npc.md §4.4): seconds to swing open or shut; walking speed through it (u/s); how far into the room they go. */
export const DOOR = { swing: 0.5, speed: 0.75, inside: 0.45, openAt: 0.85 } as const;

/** Moving among each other (§4.2): look-ahead (s), the keep-right bias, and the stuck repair's timings (s). */
export const AVOID = { horizon: 2.5, strength: 1.4, keepRight: 0.5, replanAfter: 0.8, giveUpAfter: 3 } as const;

/** A spot `u` from `n` toward the tangent `dir` (unit), turned by `deg`. */
function offset(n: Vector3, dir: Vector3, deg: number, u: number, R: number): Vector3 {
  const d = rotateAbout(_d.copy(dir), n, (deg * Math.PI) / 180);
  return moveAlong(n, d, u / R);
}

/** Where Lingjel sits to build, and where his Lego stands in front of him (on the mat). */
export function legoSpot(home: Homestead, R: number): { sit: HomeSpot; brick: HomeSpot } {
  const n = offset(home.mat.n, home.mat.facing, 90, 0.2, R);
  const facing = home.mat.facing.clone().negate();
  facing.addScaledVector(n, -facing.dot(n)).normalize();
  return { sit: { n, facing }, brick: { n: moveAlong(n, facing, 0.3 / R), facing } };
}

const ACTIVITIES: ActivityDef[] = [
  // ---- Rojina
  {
    id: 'read',
    who: ['rojina'],
    weight: 5,
    dur: [22, 40],
    cooldown: 20,
    spot: (_f, _n, w) => w.home.readingChair,
    seat: (f, npc) => f.seatFree('reading', npc),
    pose: 'read',
    held: 'book',
  },
  {
    id: 'watch',
    who: ['rojina'],
    weight: 2,
    dur: [6, 10],
    cooldown: 25,
    run: (f, npc, w) => {
      const kid = f.nearestKid(npc, w);
      npc.want = 0;
      npc.goal = null;
      npc.look = kid?.n ?? null;
      npc.pose = npc.stageT % 5 < 1.2 ? 'talk' : 'watch';
      return npc.t > npc.dur;
    },
  },
  {
    id: 'serve',
    who: ['rojina'],
    weight: 2.2,
    dur: [0, 0],
    cooldown: 70,
    start: (f) => f.canServe(),
    run: (f, npc, w, dt) => {
      const home = w.home;
      // into the house for the picnic basket, and out again with it
      if (npc.stage === 0) return f.enter(npc, w, dt) && f.next(npc);
      if (npc.stage === 1) {
        if (npc.stageT > 1.3) {
          npc.held = 'basket';
          f.next(npc);
        }
        return false;
      }
      if (npc.stage === 2) return f.exit(npc, w, dt) && f.next(npc);
      if (npc.stage === 3) {
        // (at a corner of the table, clear of the four chairs)
        const byN = offset(home.table.n, home.table.facing, 40, 0.75, w.R);
        const by = { n: byN, facing: tangentToward(byN, home.table.n) ?? home.table.facing };
        return f.goTo(npc, w, by, 'walk', dt) && f.next(npc);
      }
      f.face(npc, home.table.n);
      npc.pose = 'place';
      if (npc.stageT > 0.8 && npc.held) {
        npc.held = null;
        f.foodOnTable = true;
        // lunch is served: everyone comes to the table
        f.startMeal(w);
      }
      return npc.stageT > 1.6;
    },
  },
  // ---- the children
  {
    id: 'readTree',
    who: ['laija'],
    weight: 3,
    dur: [16, 28],
    cooldown: 30,
    spot: (_f, _n, w) => w.home.treeSeat,
    pose: 'readGround',
    held: 'book',
  },
  {
    id: 'paint',
    who: ['laija'],
    weight: 3,
    dur: [14, 24],
    cooldown: 30,
    spot: (f, _npc, w) => f.openSpot(w, w.home.mat.n, 0.9, 1.6, w.home.mat.n),
    pose: 'paint',
  },
  {
    id: 'throw',
    who: ['laija'],
    weight: 2,
    dur: [6, 9],
    cooldown: 35,
    spot: (f, _n, w) => f.shoreSpot(w) ?? w.home.shore,
    pose: 'throw',
    held: 'pebble',
  },
  {
    id: 'crouch',
    who: ['laija'],
    weight: 1.5,
    dur: [4, 7],
    cooldown: 20,
    spot: (f, npc, w) => {
      const fl = w.flowers.filter((p) => arcDistance(p, w.home.centre, w.R) < w.home.range - 1);
      const p = fl.length ? fl[Math.floor(f.rand() * fl.length)] : null;
      if (!p) return f.openSpot(w, w.home.centre, 1, 4, null);
      const out = tangentToward(p, npc.n) ?? npc.dir;
      const n = moveAlong(p, out, 0.35 / w.R);
      return { n, facing: tangentToward(n, p) ?? out.clone().negate() };
    },
    pose: 'crouch',
  },
  {
    id: 'cars',
    who: ['lingjel'],
    weight: 3.5,
    dur: [12, 20],
    cooldown: 20,
    held: 'car',
    run: (f, npc, w) => {
      // crawling round the grass by the mat, pushing a car: a new little goal every few seconds
      npc.held = 'car';
      if (!npc.goal || arcDistance(npc.n, npc.goal, w.R) < 0.15 || npc.stageT > 4) {
        npc.goal = f.openSpot(w, w.home.mat.n, 0.9, 1.8, null)?.n ?? null;
        npc.stageT = 0;
      }
      npc.want = 0.32;
      npc.pose = 'crawl';
      return npc.t > npc.dur;
    },
  },
  {
    id: 'lego',
    who: ['lingjel'],
    weight: 3,
    dur: [14, 24],
    cooldown: 25,
    spot: (_f, _n, w) => legoSpot(w.home, w.R).sit,
    pose: 'lego',
  },
  {
    id: 'wander',
    who: ['laija', 'lingjel', 'rojina'],
    weight: 2,
    dur: [0, 0],
    cooldown: 6,
    run: (f, npc, w, dt) => {
      if (npc.stage === 0) {
        const s = f.openSpot(w, w.home.centre, 1, w.home.range - 1.5, null);
        if (!s) return true;
        npc.at = s;
        const cfg = NPC[npc.id];
        npc.stage = f.rand() < cfg.runChance ? 2 : 1;
      }
      if (f.goTo(npc, w, npc.at!, npc.stage === 2 ? 'run' : 'walk', dt)) {
        npc.pose = 'stand';
        return true;
      }
      return npc.t > 12;
    },
  },
  {
    id: 'chase',
    who: ['laija', 'lingjel'],
    weight: 2.5,
    dur: [4, 7],
    cooldown: 25,
    start: (f, npc, w) => Boolean(f.chaseTarget(npc, w)),
    run: (f, npc, w) => {
      const tg = f.chaseTarget(npc, w);
      if (!tg) return true;
      npc.goal = tg;
      npc.look = tg;
      npc.want = arcDistance(npc.n, tg, w.R) < 0.5 ? 0 : NPC[npc.id].run;
      npc.pose = 'stand';
      return npc.t > npc.dur || arcDistance(npc.n, w.home.centre, w.R) > w.home.range;
    },
  },
  {
    id: 'talk',
    who: ['laija', 'lingjel', 'rojina', 'prabin'],
    weight: 1.6,
    dur: [6, 9],
    cooldown: 40,
    start: (f, npc) => Boolean(f.pickPartner(npc)),
    run: (f, npc, w, dt) => {
      const p = npc.partner ? f.get(npc.partner) : null;
      if (!p || p.partner !== npc.id) return true;
      if (npc.stage === 0) {
        // walk over to them (they wait, facing you)
        const to = tangentToward(p.n, npc.n) ?? p.dir;
        const meet = { n: moveAlong(p.n, to, 0.8 / w.R), facing: to.clone().negate() };
        if (f.goTo(npc, w, meet, 'walk', dt) || npc.t > 10) f.next(npc);
        return false;
      }
      f.face(npc, p.n);
      npc.pose = p.pose === 'read' || p.pose === 'sitChair' ? 'talk' : 'talk';
      // they take turns: a bubble over whoever is speaking
      const turn = Math.floor(npc.stageT / 1.6) % 2 === 0;
      npc.bubble = turn;
      p.bubble = !turn;
      if (npc.stageT > npc.dur) {
        npc.bubble = p.bubble = false;
        p.partner = null;
        npc.partner = null;
        return true;
      }
      return false;
    },
  },
  // ---- Prabin, anywhere on the planet (prabin-npc.md §4.6)
  {
    id: 'stroll',
    who: ['prabin'],
    weight: 2.2,
    dur: [3, 6],
    cooldown: 4,
    run: (f, npc, w, dt) => {
      if (npc.stage === 0) {
        npc.at = f.pointOfInterest(npc, w);
        if (!npc.at) return true;
        f.next(npc);
      }
      if (npc.stage === 1) return (f.goTo(npc, w, npc.at!, 'walk', dt) || npc.stageT > 60) && f.next(npc) && false;
      // there: a look round
      npc.pose = 'watch';
      npc.look = moveAlong(npc.n, rotateAbout(_t.copy(npc.dir), npc.n, Math.sin(npc.stageT * 0.7) * 1.2), 2 / w.R);
      return npc.stageT > npc.dur;
    },
  },
  {
    id: 'admire',
    who: ['prabin'],
    weight: 2.6,
    dur: [10, 16],
    cooldown: 35,
    spot: (f, npc, w) => f.admireSpot(npc, w),
    pose: 'admire',
  },
  {
    id: 'hammer',
    who: ['prabin'],
    weight: 2.6,
    dur: [14, 22],
    cooldown: 50,
    // the visitor has priority at the crafting table: not while they're near it, and he stops when they come
    start: (_f, _n, w) => Boolean(w.planet?.craft) && arcDistance(w.player, w.planet!.craft!.n, w.R) > 4,
    spot: (_f, _n, w) => {
      const c = w.planet?.craft;
      if (!c) return null;
      const n = moveAlong(c.n, c.facing, CRAFT_STAND / w.R);
      return { n, facing: tangentToward(n, c.n) ?? c.facing.clone().negate() };
    },
    yield: (_f, npc, w) => npc.stage > 0 && arcDistance(w.player, w.planet!.craft!.n, w.R) < 2.2,
    pose: 'hammer',
    held: 'hammer',
  },
  {
    id: 'guitar',
    who: ['prabin'],
    weight: 2.2,
    dur: [20, 30],
    cooldown: 80,
    spot: (_f, _n, w) => w.home.campChairs[0],
    seat: (f, npc) => f.seatFree('camp0', npc),
    pose: 'guitar',
    held: 'guitar',
  },
  {
    id: 'fetch',
    who: ['prabin'],
    weight: 3,
    dur: [0, 0],
    cooldown: 60,
    start: (f, npc, w) => f.canFetch(npc, w),
    run: (f, npc, w, dt) => f.playFetch(npc, w, dt),
  },
  // ---- the routine and meals (never picked by the utility AI)
  {
    id: 'eat',
    forced: true,
    who: ['rojina', 'laija', 'lingjel', 'prabin'],
    weight: 0,
    dur: [0, 0],
    cooldown: 0,
    run: (f, npc, w, dt) => {
      if (!f.meal || f.meal.phase === 'clear') return true;
      // (Prabin may be far away: he hurries)
      const gait = arcDistance(npc.n, w.home.table.n, w.R) > 8 ? 'run' : 'walk';
      if (npc.stage === 0) return f.sit(npc, w, f.chairFor(npc), 'eat', dt, gait) && f.next(npc);
      npc.want = 0;
      npc.goal = null;
      npc.look = w.home.table.n;
      npc.pose = 'eat';
      npc.held = null;
      return false;
    },
  },
  {
    id: 'clear',
    forced: true,
    who: ['rojina'],
    weight: 0,
    dur: [0, 0],
    cooldown: 0,
    run: (f, npc, w, dt) => {
      const home = w.home;
      if (npc.stage === 0) {
        // gather it all into the basket
        f.face(npc, home.table.n);
        npc.pose = 'place';
        if (npc.stageT > 1.2) {
          f.foodOnTable = false;
          npc.held = 'basket';
          f.next(npc);
        }
        return false;
      }
      if (npc.stage === 1) return f.enter(npc, w, dt) && f.next(npc);
      if (npc.stage === 2) {
        if (npc.stageT > 0.8) {
          npc.held = null;
          f.next(npc);
        }
        return false;
      }
      if (f.exit(npc, w, dt)) {
        f.endMeal();
        return true;
      }
      return false;
    },
  },
  {
    id: 'bedtime',
    forced: true,
    who: ['rojina', 'laija', 'lingjel', 'prabin'],
    weight: 0,
    dur: [0, 0],
    cooldown: 0,
    run: (f, npc, w, dt) => {
      const home = w.home;
      // a staggered start (the children go in first), then to the door and inside
      if (npc.stage === 0) {
        npc.want = 0;
        npc.pose = 'stand';
        npc.look = home.door.n;
        if (npc.t > npc.dur) f.next(npc);
        return false;
      }
      npc.held = npc.id === 'rojina' && f.foodOnTable ? 'basket' : null;
      if (npc.id === 'rojina') f.foodOnTable = false;
      // (Prabin may be across the planet: he hurries home; if the way is shut for long, in they go)
      const far = arcDistance(npc.n, home.door.n, w.R) > 6;
      if (f.enter(npc, w, dt, far ? 'run' : 'walk') || (!npc.link && npc.stageT > (npc.id === 'prabin' ? 120 : 40))) f.goInside(npc, w);
      return false;
    },
  },
  {
    id: 'indoors',
    forced: true,
    who: ['rojina', 'laija', 'lingjel', 'prabin'],
    weight: 0,
    dur: [0, 0],
    cooldown: 0,
    run: (_f, npc) => {
      npc.want = 0;
      npc.goal = null;
      return false;
    },
  },
  {
    id: 'wake',
    forced: true,
    who: ['rojina', 'laija', 'lingjel', 'prabin'],
    weight: 0,
    dur: [0, 0],
    cooldown: 0,
    run: (f, npc, w, dt) => {
      const home = w.home;
      // one by one (Rojina first), out of the door, down the steps and a few steps onto the lawn
      if (npc.stage === 0) {
        if (npc.t < npc.dur) return false;
        f.next(npc);
      }
      if (npc.stage === 1) {
        if (!f.exit(npc, w, dt)) return false;
        npc.at = f.openSpot(w, moveAlong(home.door.n, home.door.facing, 1.3 / w.R), 0, 0.6, null) ?? { n: moveAlong(home.door.n, home.door.facing, 1.1 / w.R), facing: home.door.facing.clone() };
        f.next(npc);
      }
      npc.pose = 'stand';
      return f.goTo(npc, w, npc.at!, 'walk', dt) || npc.stageT > 8;
    },
  },
];

export const ACTIVITY_IDS = ACTIVITIES.map((a) => a.id);

export class Family {
  readonly npcs: Npc[];
  readonly butterflies: Butterfly[] = [];
  foodOnTable = false;
  /** A meal in progress: everyone gathers at the table, eats, and Rojina clears up. */
  meal: { phase: 'gather' | 'eating' | 'clear'; t: number; dur: number } | null = null;
  private lastMeal = -1e9;
  /** The routine being followed ('day' / 'night'; null before the first step), and the clock. */
  schedule: 'day' | 'night' | null = null;
  private lastHours: number | null = null;
  /** Seconds since the clock last jumped (was set by hand). */
  sinceJump = 1e9;
  readonly events: FamilyEvent[] = [];
  /** Route planning over the whole planet (built on the first step, from the world's obstacles). */
  nav: SphereNav | null = null;
  /** The seats (smart objects): the reading chair, the table's four chairs, the camp chairs. */
  readonly seats: Seat[];
  /** The front door: how open it is (0 shut … 1 open), and who holds the doorway. */
  readonly door = { open: 0, holder: null as NpcId | null };
  /** The stick for fetch (shared with Chopper's mind as `DogWorld.fetch`). */
  readonly fetch: Fetch = { state: 'none', stick: new Vector3(0, 1, 0), to: new Vector3(0, 1, 0), flight: 0, from: new Vector3(0, 1, 0) };
  /** Throws so far in this game of fetch. */
  private throws = 0;
  private clock = 0;

  constructor(
    readonly home: Homestead,
    readonly R: number,
    readonly rand: () => number = Math.random,
    /** Where Prabin starts (by default by the house). */
    prabinAt?: Vector3,
  ) {
    const mk = (id: NpcId, n: Vector3): Npc => ({
      id,
      name: NPC[id].name,
      n: n.clone(),
      dir: (tangentToward(n, home.centre) ?? home.house.facing).clone(),
      speed: 0,
      activity: 'idle',
      stage: 0,
      t: 0,
      stageT: 0,
      dur: 2 + rand() * 2,
      pose: 'stand',
      poseT: 0,
      goal: null,
      want: 0,
      look: null,
      at: null,
      held: null,
      chatting: false,
      bubble: false,
      partner: null,
      recent: [],
      cooldown: {},
      side: 1,
      near: [],
      nearAt: new Vector3(),
      route: null,
      routeFor: new Vector3(),
      routeAge: 0,
      stuck: 0,
      indoors: false,
      seat: null,
      seatEntry: null,
      link: null,
      progD: Infinity,
      progT: 0,
      repairs: 0,
    });
    this.npcs = [
      mk('rojina', offset(home.readingChair.n, home.readingChair.facing, 0, 0.7, R)),
      mk('laija', offset(home.mat.n, home.mat.facing, 60, 0.9, R)),
      mk('lingjel', offset(home.mat.n, home.mat.facing, -60, 0.8, R)),
      mk('prabin', prabinAt ?? offset(home.door.n, home.door.facing, 30, 1.6, R)),
    ];
    this.seats = homeSeats(home, R);
    for (let i = 0; i < 3; i++) {
      const a = offset(home.centre, home.house.facing, 90 + i * 120, 1.8 + i * 0.4, R);
      this.butterflies.push({ n: a.clone(), h: 0.6, home: a, phase: i * 2.1, scared: 0, away: new Vector3() });
    }
  }

  /** The route-planning grid for a world (build it while loading: it's the costly part, ≈ 30 ms). */
  static navFor(w: FamilyWorld): SphereNav {
    return new SphereNav(w.R, w.obstacles, w.blocked, FAMILY.radius + 0.12);
  }

  get(id: NpcId): Npc {
    return this.npcs.find((x) => x.id === id)!;
  }

  // ---------------------------------------------------------------------------

  step(dt: number, w: FamilyWorld): void {
    dt = Math.min(Math.max(dt, 0), 0.1);
    this.clock += dt;
    this.nav ??= Family.navFor(w);
    this.stepRoutine(dt, w);
    this.stepMeal(dt);
    this.stepButterflies(dt, w);
    this.stepDoor(dt);
    for (const npc of this.npcs) {
      if (npc.indoors && npc.activity === 'indoors') continue;
      for (const k of Object.keys(npc.cooldown)) npc.cooldown[k] = Math.max(0, npc.cooldown[k] - dt);
      npc.t += dt;
      npc.stageT += dt;
      npc.poseT += dt;
      // a seat belongs to the activity it was taken for: anything else (a chat excepted) stands them up first
      const su = npc.seat;
      if (su && su.phase !== 'out' && su.owner !== npc.activity && npc.activity !== 'answer' && !npc.chatting) this.standUp(npc);
      if (npc.seat && npc.seat.phase !== 'on') {
        const prev = npc.pose;
        this.stepSeat(npc, dt);
        if (npc.pose !== prev) npc.poseT = 0;
        continue;
      }
      if (npc.link && npc.link.phase === 'walk') {
        this.stepLink(npc, w, dt);
        continue;
      }
      if (npc.chatting) {
        // paused, facing the character (a sitter stays seated)
        npc.want = 0;
        npc.goal = null;
        npc.look = w.player;
        if (!SETTLED.has(npc.pose)) {
          npc.pose = 'talk';
          this.face(npc, w.player);
        }
        this.move(npc, dt, w);
        continue;
      }
      const prevPose = npc.pose;
      // blocked on the way for long (the repairs didn't help): give up and do something else
      npc.stuck = npc.want > 0.3 && npc.speed < 0.05 ? npc.stuck + dt : 0;
      if (npc.stuck > AVOID.giveUpAfter && npc.activity !== 'answer' && !ACTIVITIES.find((a) => a.id === npc.activity)?.forced) {
        npc.stuck = 0;
        npc.route = null;
        this.choose(npc, w);
      } else if (this.runActivity(npc, w, dt)) this.choose(npc, w);
      if (npc.pose !== prevPose) npc.poseT = 0;
      this.move(npc, dt, w);
    }
  }

  private runActivity(npc: Npc, w: FamilyWorld, dt: number): boolean {
    if (npc.activity === 'idle') {
      npc.want = 0;
      npc.pose = 'stand';
      return npc.t > npc.dur;
    }
    if (npc.activity === 'answer') {
      // someone came over to talk: wait facing them (seated if seated)
      const p = npc.partner ? this.get(npc.partner) : null;
      if (!p || p.partner !== npc.id) {
        npc.partner = null;
        npc.bubble = false;
        return true;
      }
      npc.want = 0;
      npc.goal = null;
      npc.look = p.n;
      if (!SETTLED.has(npc.pose)) {
        npc.pose = 'talk';
        this.face(npc, p.n);
      }
      return false;
    }
    const def = ACTIVITIES.find((a) => a.id === npc.activity);
    if (!def) return true;
    if (def.run) return def.run(this, npc, w, dt);
    if (def.yield?.(this, npc, w)) return true;
    const seat = def.seat ? def.seat(this, npc, w) ?? (npc.seat?.seat ?? null) : null;
    // go to its spot (or sit down on its seat), then do it there for a while
    if (npc.stage === 0) {
      if (def.seat) {
        if (!seat) return true;
        if (this.sit(npc, w, seat, def.pose ?? 'sitChair', dt) || npc.t > 30) {
          if (!npc.seat) return true;
          npc.stage = 1;
          npc.stageT = 0;
          npc.t = 0;
        }
        return false;
      }
      if (!npc.at) return true;
      npc.pose = 'stand';
      // (Prabin's spots can be far away)
      if (this.goTo(npc, w, npc.at, 'walk', dt) || npc.t > (npc.id === 'prabin' ? 60 : 14)) {
        npc.stage = 1;
        npc.stageT = 0;
        npc.t = 0;
      }
      return false;
    }
    npc.want = 0;
    npc.goal = null;
    if (!npc.seat && npc.at) this.faceDir(npc, npc.at.facing, dt);
    npc.pose = def.pose ?? 'stand';
    npc.held = def.held ?? null;
    if (def.id === 'throw') {
      // a pebble every 1.6 s: it leaves the hand at 0.55 s and lands in the water
      const k = Math.floor(npc.stageT / 1.6);
      const into = npc.stageT - k * 1.6;
      if (into >= 0.55 && into - dt < 0.55) {
        this.events.push({ type: 'throw', id: npc.id });
        this.events.push({ type: 'splash', n: moveAlong(npc.n, npc.at!.facing, (1.1 + this.rand() * 0.6) / w.R) });
      }
    }
    if (def.id === 'read' && Math.floor(npc.stageT / 7) % 3 === 2) npc.look = this.nearestKid(npc, w)?.n ?? null;
    else npc.look = null;
    return npc.stageT > npc.dur;
  }

  /** The utility AI: score every activity this NPC can do now, pick the best (with some noise). */
  private choose(npc: Npc, w: FamilyWorld): void {
    const prev = npc.activity;
    if (prev !== 'idle' && prev !== 'answer') {
      const def = ACTIVITIES.find((a) => a.id === prev);
      if (def) npc.cooldown[prev] = def.cooldown;
      npc.recent.unshift(prev);
      npc.recent.length = Math.min(npc.recent.length, 2);
    }
    npc.held = null;
    npc.bubble = false;
    // the routine comes first: in at night, and to the table while a meal is on
    if (this.schedule === 'night' && !npc.indoors) return this.force(npc, 'bedtime', 0);
    if (this.meal && this.meal.phase !== 'clear' && npc.activity !== 'eat') return this.force(npc, 'eat', 0);
    const options: Array<[ActivityDef, number, HomeSpot | null]> = [];
    for (const a of ACTIVITIES) {
      if (a.forced || !a.who.includes(npc.id) || (npc.cooldown[a.id] ?? 0) > 0 || npc.recent[0] === a.id) continue;
      if (a.start && !a.start(this, npc, w)) continue;
      const spot = a.spot ? a.spot(this, npc, w) : null;
      if (a.spot && !spot) continue;
      // no-repeat memory, plus noise so the order never settles into a loop
      const fresh = npc.recent.includes(a.id) ? 0.5 : 1;
      options.push([a, a.weight * fresh * (0.6 + this.rand() * 0.8), spot]);
    }
    options.sort((x, y) => y[1] - x[1]);
    const pick = options[0];
    npc.stage = 0;
    npc.t = 0;
    npc.stageT = 0;
    npc.goal = null;
    npc.look = null;
    if (!pick) {
      npc.activity = 'idle';
      npc.dur = 2 + this.rand() * 3;
      return;
    }
    const [def, , spot] = pick;
    npc.activity = def.id;
    // (a seat's activity walks to the seat's entry point, never to the chair itself)
    npc.at = def.seat ? null : spot;
    npc.dur = def.dur[0] + this.rand() * (def.dur[1] - def.dur[0]);
    if (def.id === 'talk') {
      const p = this.pickPartner(npc)!;
      npc.partner = p.id;
      p.partner = npc.id;
      p.activity = 'answer';
      p.t = 0;
      p.stage = 0;
      p.stageT = 0;
      p.held = p.pose === 'read' || p.pose === 'readGround' ? p.held : null;
    }
  }

  /** Start `activity` now (the routine, meals), after `wait` s for the ones that wait. */
  force(npc: Npc, activity: string, wait: number): void {
    if (npc.partner) {
      const p = this.get(npc.partner);
      if (p.partner === npc.id) p.partner = null;
      npc.partner = null;
    }
    npc.activity = activity;
    npc.stage = 0;
    npc.t = 0;
    npc.stageT = 0;
    npc.dur = wait;
    npc.goal = null;
    npc.route = null;
    npc.bubble = false;
    npc.at = null;
  }

  /** Follow the clock: in at 8 pm, out at 6 am; after a jump of the clock, only once it has settled. */
  private stepRoutine(dt: number, w: FamilyWorld): void {
    if (this.lastHours !== null) {
      let dh = Math.abs(w.hours - this.lastHours) % 24;
      dh = Math.min(dh, 24 - dh);
      if (dh > 0.25) this.sinceJump = 0;
    }
    this.lastHours = w.hours;
    this.sinceJump += dt;
    const want = isNight(w.hours) ? 'night' : 'day';
    if (this.schedule === null) {
      // the first look at the clock: at night they're already in
      this.schedule = want;
      if (want === 'night') for (const n of this.npcs) this.goInside(n, w);
      return;
    }
    if (want === this.schedule || this.sinceJump < ROUTINE.delay) return;
    this.schedule = want;
    if (want === 'night') {
      this.meal = null;
      for (const n of this.npcs) this.force(n, 'bedtime', n.id === 'rojina' ? 3 + this.rand() * 2 : this.rand() * 2);
    } else {
      for (const n of this.npcs) this.force(n, 'wake', n.id === 'rojina' ? 0.5 : 2 + this.rand() * 3);
    }
  }

  goInside(npc: Npc, w: FamilyWorld): void {
    this.leaveSeat(npc);
    if (npc.link && this.door.holder === npc.id) this.door.holder = null;
    npc.link = null;
    npc.indoors = true;
    npc.held = null;
    npc.speed = 0;
    npc.chatting = false;
    npc.n.copy(this.insideSpot(w.R));
    this.force(npc, 'indoors', 0);
    if (npc.id === 'rojina') this.foodOnTable = false;
  }

  // ---------------------------------------------------------------------------
  // seats (seats.ts): walk to an entry point, sit down onto the seat, stand up back to it

  /** The seat with this id, if nobody else has it. */
  seatFree(id: string, npc?: Npc): Seat | null {
    const s = this.seats.find((x) => x.id === id) ?? null;
    return s && (!s.user || s.user === npc?.id) ? s : null;
  }

  /** Each one's own chair at the table (Rojina, Laija, Lingjel, Prabin). */
  chairFor(npc: Npc): Seat {
    const i = ['rojina', 'laija', 'lingjel', 'prabin'].indexOf(npc.id);
    return this.seats.find((s) => s.id === `table${i}`) ?? this.seats[0];
  }

  /** Go and sit on `seat` (reserved on the way); true once seated. */
  sit(npc: Npc, w: FamilyWorld, seat: Seat, pose: NpcPose, dt: number, gait: 'walk' | 'run' = 'walk'): boolean {
    if (npc.seat) {
      if (npc.seat.seat !== seat) {
        this.standUp(npc);
        return false;
      }
      npc.seat.owner = npc.activity;
      return npc.seat.phase === 'on';
    }
    if (seat.user && seat.user !== npc.id) return false;
    seat.user = npc.id;
    npc.seatEntry ??= pickEntry(seat, npc.n, (n) => this.free(w, n, 0.02)) ?? seat.entries[0];
    const entry = npc.seatEntry;
    if (!this.goTo(npc, w, entry, gait, dt)) {
      // (someone standing on the entry point: try the other side)
      if (npc.stuck > AVOID.replanAfter) npc.seatEntry = pickEntry(seat, npc.n, (n) => this.free(w, n, 0.02) && n !== entry.n) ?? entry;
      return false;
    }
    npc.seat = { seat, entry, phase: 'in', t: 0, from: npc.n.clone(), owner: npc.activity };
    npc.seatEntry = null;
    npc.pose = pose;
    npc.want = 0;
    npc.goal = null;
    npc.route = null;
    return false;
  }

  /** Get up (back to the entry point it came from). */
  standUp(npc: Npc): void {
    const u = npc.seat;
    if (!u || u.phase === 'out') return;
    u.phase = 'out';
    u.t = 0;
    u.from = npc.n.clone();
  }

  /** Off the seat at once (bedtime indoors, a reset). */
  private leaveSeat(npc: Npc): void {
    if (npc.seat) {
      npc.n.copy(npc.seat.entry.n);
      if (npc.seat.seat.user === npc.id) npc.seat.seat.user = null;
    }
    npc.seat = null;
    npc.seatEntry = null;
  }

  /** The sit-down and stand-up moves (scripted: the chair doesn't push them, nor anyone else). */
  private stepSeat(npc: Npc, dt: number): void {
    const u = npc.seat!;
    u.t += dt;
    npc.want = 0;
    npc.goal = null;
    npc.speed = 0;
    if (u.phase === 'in') {
      sitPath(u.from, u.seat.spot.n, u.t, npc.n);
      turnToward(npc.dir, npc.n, seatFacing(u.seat, npc.n), 6 * dt);
      if (u.t >= SIT_T) {
        u.phase = 'on';
        npc.n.copy(u.seat.spot.n);
        npc.dir.copy(seatFacing(u.seat, npc.n));
      }
    } else if (u.phase === 'out') {
      npc.pose = 'stand';
      sitPath(u.from, u.entry.n, u.t, npc.n);
      if (u.t >= SIT_T) {
        if (u.seat.user === npc.id) u.seat.user = null;
        npc.seat = null;
      }
    }
    transport(npc.dir, npc.n);
  }

  // ---------------------------------------------------------------------------
  // the front door (an off-mesh link): wait at the step, the door opens, up the steps and in

  /** Just inside the front door (planet-local unit vector). */
  insideSpot(R: number): Vector3 {
    return moveAlong(this.home.house.n, this.home.house.facing, DOOR.inside / R);
  }

  /** Head indoors through the front door; true once inside. */
  enter(npc: Npc, w: FamilyWorld, dt: number, gait: 'walk' | 'run' = 'walk'): boolean {
    if (npc.indoors) return true;
    if (!npc.link) {
      if (!this.goTo(npc, w, this.home.door, gait, dt)) return false;
      npc.link = { dir: 'in', phase: 'wait', t: 0, from: npc.n.clone(), to: this.insideSpot(w.R) };
    }
    this.waitAtDoor(npc);
    return false;
  }

  /** Come out through the front door (from indoors); true once down the steps. */
  exit(npc: Npc, w: FamilyWorld, _dt: number): boolean {
    if (!npc.indoors && !npc.link) return true;
    if (!npc.link) npc.link = { dir: 'out', phase: 'wait', t: 0, from: this.insideSpot(w.R), to: this.home.door.n.clone() };
    this.waitAtDoor(npc);
    return false;
  }

  /** Waiting for the doorway (one at a time) and for the door to open. */
  private waitAtDoor(npc: Npc): void {
    const l = npc.link!;
    npc.want = 0;
    npc.goal = null;
    npc.route = null;
    if (l.dir === 'in') npc.look = this.home.house.n;
    if (this.door.holder === null) this.door.holder = npc.id;
    if (this.door.holder !== npc.id || this.door.open < DOOR.openAt) return;
    l.phase = 'walk';
    l.t = 0;
    if (l.dir === 'out') {
      npc.indoors = false;
      npc.n.copy(l.from);
      npc.dir.copy(this.home.house.facing).addScaledVector(npc.n, -this.home.house.facing.dot(npc.n)).normalize();
    } else l.from.copy(npc.n);
  }

  /** Walking up the steps and through the doorway (or out and down): scripted, straight along the path. */
  private stepLink(npc: Npc, w: FamilyWorld, dt: number): void {
    const l = npc.link!;
    const len = Math.max(0.05, arcDistance(l.from, l.to, w.R));
    l.t += dt;
    const k = Math.min(1, (l.t * DOOR.speed) / len);
    npc.n.copy(l.from).lerp(l.to, k).normalize();
    const out = this.home.house.facing;
    npc.dir.copy(out).multiplyScalar(l.dir === 'in' ? -1 : 1);
    npc.dir.addScaledVector(npc.n, -npc.dir.dot(npc.n)).normalize();
    npc.speed = DOOR.speed;
    npc.want = 0;
    npc.goal = null;
    npc.pose = 'stand';
    if (k < 1) return;
    npc.speed = 0;
    npc.link = null;
    if (this.door.holder === npc.id) this.door.holder = null;
    if (l.dir === 'in') {
      npc.indoors = true;
      npc.chatting = false;
    }
  }

  /** The door swings open while someone holds the doorway, and shuts when it's clear. */
  private stepDoor(dt: number): void {
    const want = this.door.holder !== null ? 1 : 0;
    const step = dt / DOOR.swing;
    this.door.open = Math.min(1, Math.max(0, this.door.open + (want ? step : -step)));
  }

  // ---------------------------------------------------------------------------
  // Prabin's places (prabin-npc.md §4.6)

  /** Somewhere to stroll to: the plaza, round a building, a bridge's end, or home. */
  pointOfInterest(npc: Npc, w: FamilyWorld): HomeSpot | null {
    const p = w.planet;
    const R = w.R;
    const picks: Array<[Vector3, number]> = [];
    if (p) {
      picks.push([p.spawn, 2.2]);
      for (const g of p.landmarks) picks.push([g.approach, 1.6]);
      for (const b of p.bridges) picks.push([b, 1.0]);
    }
    picks.push([this.home.centre, 2.5]);
    for (let k = 0; k < 16; k++) {
      const [c, r] = picks[Math.floor(this.rand() * picks.length)];
      if (arcDistance(c, npc.n, R) < 3) continue;
      const dir = rotateAbout(_v.copy(tangentToward(c, npc.n) ?? npc.dir), c, this.rand() * Math.PI * 2);
      const n = moveAlong(c, dir, (0.4 + this.rand() * r) / R);
      if (!this.standable(w, n)) continue;
      return { n, facing: tangentToward(n, c) ?? dir.clone() };
    }
    return null;
  }

  /** In front of a building, a little off its path, facing it. */
  admireSpot(npc: Npc, w: FamilyWorld): HomeSpot | null {
    const ls = w.planet?.landmarks ?? [];
    if (!ls.length) return null;
    const R = w.R;
    for (let k = 0; k < 12; k++) {
      const g = ls[Math.floor(this.rand() * ls.length)];
      const out = tangentToward(g.n, g.approach);
      if (!out) continue;
      const side = _w.crossVectors(g.n, out).normalize().multiplyScalar(this.rand() < 0.5 ? 1 : -1);
      const base = moveAlong(g.n, out, (g.footprintU + 1.6 + this.rand() * 1.2) / R);
      const n = moveAlong(base, side, (1.2 + this.rand() * 0.8) / R);
      if (arcDistance(n, npc.n, R) < 1 || !this.standable(w, n)) continue;
      return { n, facing: tangentToward(n, g.n) ?? out.clone().negate() };
    }
    return null;
  }

  /** Open ground: in the planner's free cells, out of the water, clear of the obstacles. */
  standable(w: FamilyWorld, n: Vector3): boolean {
    return (!this.nav || this.nav.freeAt(n)) && this.free(w, n, 0.15);
  }

  /** Chopper is free, and not far off. */
  canFetch(npc: Npc, w: FamilyWorld): boolean {
    const d = w.dog;
    return Boolean(d && d.free() && this.fetch.state === 'none' && arcDistance(d.n, npc.n, w.R) < 14);
  }

  /** A game of fetch: over to Chopper, a few throws (he brings the stick back), then a pat. */
  playFetch(npc: Npc, w: FamilyWorld, dt: number): boolean {
    const dog = w.dog;
    if (!dog) return true;
    const f = this.fetch;
    const R = w.R;
    const done = () => {
      f.state = 'none';
      npc.held = null;
      return true;
    };
    if (npc.stage === 0) {
      if (npc.stageT < 0.05) this.throws = 0;
      if (!dog.free() && f.state === 'none') return done();
      const from = tangentToward(dog.n, npc.n) ?? npc.dir;
      const meet = { n: moveAlong(dog.n, from, 1.0 / R), facing: from.clone().negate() };
      npc.held = 'stick';
      if (this.goTo(npc, w, meet, 'walk', dt) || npc.t > 25) {
        if (npc.t > 25 && arcDistance(npc.n, dog.n, R) > 2.5) return done();
        f.to = npc.n;
        this.next(npc);
      }
      return false;
    }
    npc.want = 0;
    npc.goal = null;
    if (npc.stage === 1) {
      // a whistle-and-show, then the throw (the stick leaves the hand at 0.55 s into it)
      npc.look = dog.n;
      npc.pose = npc.stageT < 0.8 ? 'talk' : 'throw';
      npc.held = 'stick';
      if (npc.stageT > 0.8 + 0.55) {
        const land = this.throwSpot(npc, w);
        if (!land) return done();
        f.from = npc.n.clone();
        f.stick.copy(land);
        f.to = npc.n;
        f.flight = 0;
        f.state = 'thrown';
        npc.held = null;
        this.throws++;
        this.next(npc);
      }
      return false;
    }
    if (npc.stage === 2) {
      f.flight += dt;
      npc.pose = npc.stageT < 0.5 ? 'throw' : 'watch';
      npc.look = f.state === 'thrown' ? f.stick : dog.n;
      if (f.state === 'dropped' && arcDistance(f.stick, npc.n, R) < 1.2) return this.next(npc);
      // (he didn't bring it back: go and get it)
      if (npc.stageT > 14) return done();
      return false;
    }
    if (npc.stage === 3) {
      npc.pose = 'crouch';
      npc.look = f.stick;
      if (npc.stageT > 0.7) {
        npc.held = 'stick';
        f.state = 'none';
        if (this.throws < 3) {
          npc.stage = 1;
          npc.stageT = 0.8;
        } else this.next(npc);
      }
      return false;
    }
    // a pat to finish
    npc.held = null;
    npc.pose = 'pet';
    npc.look = dog.n;
    return npc.stageT > 2.4 ? done() : false;
  }

  /** Where the stick lands: 2.5–3.5 u ahead-ish, on open ground. */
  private throwSpot(npc: Npc, w: FamilyWorld): Vector3 | null {
    for (let k = 0; k < 10; k++) {
      const d = rotateAbout(_v.copy(npc.dir), npc.n, (this.rand() - 0.5) * 1.6);
      const p = moveAlong(npc.n, d, (2.5 + this.rand()) / w.R);
      if (this.standable(w, p) && arcDistance(p, w.player, w.R) < 8 && arcDistance(p, w.player, w.R) > 1.4) return p;
    }
    return null;
  }

  canServe(): boolean {
    return this.schedule === 'day' && !this.foodOnTable && !this.meal && this.clock - this.lastMeal > ROUTINE.mealGap;
  }

  /** Lunch is on the table: everyone who's out comes to eat (whatever they were doing). */
  startMeal(_w: FamilyWorld): void {
    this.meal = { phase: 'gather', t: 0, dur: ROUTINE.mealTime[0] + this.rand() * (ROUTINE.mealTime[1] - ROUTINE.mealTime[0]) };
    for (const n of this.npcs) if (!n.indoors && n.id !== 'rojina') this.force(n, 'eat', 0);
  }

  endMeal(): void {
    this.meal = null;
    this.lastMeal = this.clock;
  }

  private stepMeal(dt: number): void {
    const m = this.meal;
    if (!m) return;
    m.t += dt;
    const out = this.npcs.filter((n) => !n.indoors);
    if (m.phase === 'gather' && (out.every((n) => (n.pose === 'eat' && n.seat?.phase === 'on') || n.chatting) || m.t > 45)) {
      m.phase = 'eating';
      m.t = 0;
    } else if (m.phase === 'eating' && m.t > m.dur) {
      // done: Rojina clears up, the children run off
      m.phase = 'clear';
      m.t = 0;
      this.force(this.get('rojina'), 'clear', 0);
    } else if (m.phase === 'clear' && m.t > 30) {
      // (if clearing got interrupted for long, the table is cleared anyway)
      this.foodOnTable = false;
      this.endMeal();
    }
  }

  /** A spot on the pond's edge, somewhere along the home's side of it, facing the water (varies each time). */
  shoreSpot(w: FamilyWorld): HomeSpot | null {
    const pond = w.pond;
    if (!pond) return null;
    const base = tangentToward(pond.n, w.home.shore.n);
    if (!base) return null;
    for (let k = 0; k < 10; k++) {
      const dir = rotateAbout(_t.copy(base), pond.n, (this.rand() - 0.5) * 2.2);
      // from inside the water outward: the first dry ground, then a short step back from the edge
      let u = 0.4;
      let p = moveAlong(pond.n, dir, u / w.R);
      while (w.blocked(p) && u < 6) p = moveAlong(pond.n, dir, (u += 0.1) / w.R);
      p = moveAlong(pond.n, dir, (u + 0.35) / w.R);
      if (arcDistance(p, w.home.centre, w.R) > w.home.range || !this.free(w, p, 0.15)) continue;
      return { n: p, facing: tangentToward(p, pond.n) ?? dir.clone().negate() };
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // helpers used by the activities

  next(npc: Npc): boolean {
    npc.stage++;
    npc.stageT = 0;
    return false;
  }

  nearestKid(npc: Npc, w: FamilyWorld): Npc | null {
    let best: Npc | null = null;
    let bd = Infinity;
    for (const k of this.npcs) {
      if (k === npc || !KIDS.has(k.id) || k.indoors) continue;
      const d = arcDistance(k.n, npc.n, w.R);
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
    return best;
  }

  /** Someone free to talk (not already talking, not busy fetching the picnic or chatting with the character). */
  pickPartner(npc: Npc): Npc | null {
    // (someone close by, out of doors, not busy with a routine, a door or a seat's getting-up)
    const free = this.npcs.filter(
      (o) => o !== npc && !o.partner && !o.chatting && !o.indoors && !o.link && o.activity !== 'serve' && o.activity !== 'throw' && o.activity !== 'fetch' && o.activity !== 'hammer' && arcDistance(o.n, npc.n, this.R) < 6,
    );
    return free.length ? free[Math.floor(this.rand() * free.length)] : null;
  }

  /** The nearest butterfly (or a rabbit near home) to chase, or null. */
  chaseTarget(npc: Npc, w: FamilyWorld): Vector3 | null {
    let best: Vector3 | null = null;
    let bd = 6;
    for (const b of this.butterflies) {
      const d = arcDistance(b.n, npc.n, w.R);
      if (d < bd) {
        bd = d;
        best = b.n;
      }
    }
    for (const r of w.rabbits) {
      const d = arcDistance(r.n, npc.n, w.R);
      if (d < bd && arcDistance(r.n, w.home.centre, w.R) < w.home.range) {
        bd = d;
        best = r.n;
      }
    }
    return best;
  }

  /** A random open spot `lo`…`hi` u from `about` (facing `look`, or the way from `about`). */
  openSpot(w: FamilyWorld, about: Vector3, lo: number, hi: number, look: Vector3 | null): HomeSpot | null {
    for (let k = 0; k < 12; k++) {
      const d = tangentToward(about, w.home.house.n) ?? w.home.house.facing;
      rotateAbout(_t.copy(d), about, this.rand() * Math.PI * 2);
      const n = moveAlong(about, _t, (lo + this.rand() * (hi - lo)) / w.R);
      if (arcDistance(n, w.home.centre, w.R) > w.home.range || !this.free(w, n, 0.15)) continue;
      return { n, facing: (look ? tangentToward(n, look) : null) ?? tangentToward(n, about)?.negate() ?? _t.clone() };
    }
    return null;
  }

  face(npc: Npc, target: Vector3): void {
    const to = tangentToward(npc.n, target, _a);
    if (to) npc.look = target;
  }

  private faceDir(npc: Npc, dir: Vector3, dt: number): void {
    const d = _a.copy(dir).addScaledVector(npc.n, -dir.dot(npc.n));
    if (d.lengthSq() < 1e-9) return;
    turnToward(npc.dir, npc.n, d.normalize(), 5 * dt);
  }

  /** Head for `spot`; true once there (within 0.12 u), facing its way. */
  goTo(npc: Npc, w: FamilyWorld, spot: HomeSpot, gait: 'walk' | 'run', dt: number): boolean {
    const d = arcDistance(npc.n, spot.n, w.R);
    if (d < 0.12) {
      npc.want = 0;
      npc.goal = null;
      this.faceDir(npc, spot.facing, dt);
      return true;
    }
    npc.goal = spot.n;
    npc.want = NPC[npc.id][gait];
    // on the way somewhere they just walk (no leftover reaching or reading pose)
    npc.pose = 'stand';
    return false;
  }

  /** Can they stand at `p`? (Out of the pond, clear of obstacles, except the one they're going to use.) */
  free(w: FamilyWorld, p: Vector3, pad = 0, npc?: Npc): boolean {
    if (w.blocked(p)) return false;
    const list = npc ? npc.near : w.obstacles;
    const c = Math.cos(3 / w.R);
    for (const o of list) {
      if (o.n.dot(p) < c) continue;
      if (npc?.at && arcDistance(o.n, npc.at.n, w.R) < 0.05) continue;
      if (arcDistance(p, o.n, w.R) < o.radiusU + FAMILY.radius + pad) return false;
    }
    return true;
  }

  /** Start an activity now and keep at it (tests and screenshots). */
  hold(id: NpcId, activity: string, w: FamilyWorld): boolean {
    const npc = this.get(id);
    const def = ACTIVITIES.find((a) => a.id === activity);
    if (!def) return false;
    npc.activity = activity;
    npc.held = null;
    npc.at = def.spot && !def.seat ? def.spot(this, npc, w) : null;
    npc.stage = 0;
    npc.t = 0;
    npc.stageT = 0;
    npc.dur = 1e6;
    return true;
  }

  // ---------------------------------------------------------------------------
  // talking with the character

  /** The character walked up and pressed E: stop, turn to them. */
  startChat(id: NpcId): void {
    const npc = this.get(id);
    npc.chatting = true;
    npc.bubble = false;
  }

  endChat(id: NpcId): void {
    this.get(id).chatting = false;
  }

  // ---------------------------------------------------------------------------

  private stepButterflies(dt: number, w: FamilyWorld): void {
    for (const b of this.butterflies) {
      b.phase += dt;
      // a child close by startles it: a quick dash away and up, then it drifts back
      for (const k of this.npcs) {
        if (!KIDS.has(k.id)) continue;
        if (arcDistance(k.n, b.n, w.R) < 0.6 && b.scared <= 0) {
          b.scared = 1.2;
          b.away.copy(tangentToward(k.n, b.n) ?? k.dir);
        }
      }
      if (b.scared > 0) {
        b.scared -= dt;
        b.n.copy(moveAlong(b.n, b.away, (1.4 * dt) / w.R));
        b.h = Math.min(1.4, b.h + dt * 0.8);
      } else {
        // a lazy figure-of-eight about its patch, which wanders slowly
        const to = tangentToward(b.n, b.home);
        const d = arcDistance(b.n, b.home, w.R);
        const dir = _d.set(Math.sin(b.phase * 0.9), 0, 0);
        if (to) {
          const side = _a.crossVectors(b.n, to);
          dir.copy(to).multiplyScalar(Math.min(1, d * 0.8)).addScaledVector(side, Math.sin(b.phase * 1.3) * 0.6);
          if (dir.lengthSq() > 1e-9) b.n.copy(moveAlong(b.n, dir.normalize(), (0.5 * dt) / w.R));
        }
        b.h += (0.55 + Math.sin(b.phase * 2.3) * 0.2 - b.h) * Math.min(1, dt * 2);
      }
      if (this.rand() < dt * 0.05) b.home.copy(offset(w.home.centre, w.home.house.facing, this.rand() * 360, 1 + this.rand() * 3.5, w.R));
    }
  }

  /** Plan a route to the goal (with extra discs blocked: whoever stands in the way). */
  private plan(npc: Npc, avoid: readonly NavBlock[]): void {
    if (!this.nav || !npc.goal) return;
    // (no way at all: head straight for it, and try again in a while rather than every step)
    npc.route = this.nav.path(npc.n, npc.goal, avoid) ?? [npc.goal.clone()];
    npc.routeFor.copy(npc.goal);
    npc.routeAge = 0;
  }

  /** Whoever is close by and ahead (the stuck repair plans round them). */
  private blockers(npc: Npc, w: FamilyWorld): NavBlock[] {
    const out: NavBlock[] = [];
    const R = w.R;
    const add = (n: Vector3, r: number) => {
      const d = arcDistance(npc.n, n, R);
      const to = d < 1.4 ? tangentToward(npc.n, n, _a) : null;
      if (to && to.dot(npc.dir) > -0.2 && (!npc.goal || arcDistance(n, npc.goal, R) > 0.5)) out.push({ n: n.clone(), r });
    };
    add(w.player, 0.35);
    for (const o of w.others) add(o, 0.22);
    for (const o of this.npcs) if (o !== npc && !o.indoors) add(o.n, FAMILY.radius);
    return out;
  }

  /**
   * Predictive avoidance (Karamouzas et al. 2014): for each walker near by, the time until the two
   * would touch if both kept going; steer away from where they'd touch, harder the sooner it is,
   * and when meeting head-on both bear right.
   */
  private avoid(npc: Npc, w: FamilyWorld, desired: Vector3, want: number): void {
    const R = w.R;
    const n = npc.n;
    const vi = _v.copy(npc.dir).multiplyScalar(Math.max(npc.speed, want * 0.6));
    const right = _w.crossVectors(npc.dir, n).normalize();
    const one = (pos: Vector3, vel: Vector3 | null, rj: number) => {
      if (pos.dot(n) < Math.cos(3 / R)) return;
      const x = _a.copy(pos).sub(n);
      x.addScaledVector(n, -x.dot(n)).multiplyScalar(R);
      const v = _t.copy(vi);
      if (vel) v.sub(vel).addScaledVector(n, -v.dot(n));
      const r = FAMILY.radius + rj + 0.08;
      const a = v.dot(v);
      const b = x.dot(v);
      const c = x.dot(x) - r * r;
      if (c < 0 || a < 1e-6) return;
      const disc = b * b - a * c;
      if (disc <= 0) return;
      const tau = (b - Math.sqrt(disc)) / a;
      if (tau < 0 || tau > AVOID.horizon) return;
      const k = AVOID.strength * (1 - tau / AVOID.horizon) ** 2;
      // where they'd touch, from me: steer the other way
      const contact = x.addScaledVector(v, -tau);
      const len = contact.length();
      if (len > 1e-6) desired.addScaledVector(contact, -k / len);
      // head-on: keep right
      if (b / Math.sqrt(a * x.dot(x) + 1e-9) > 0.85) desired.addScaledVector(right, AVOID.keepRight * k);
    };
    one(w.player, w.playerVel ?? null, 0.35);
    for (const o of w.others) one(o, null, 0.22);
    for (const o of this.npcs) {
      if (o === npc || o.indoors) continue;
      one(o.n, _d2.copy(o.dir).multiplyScalar(o.seat || o.link ? 0 : o.speed), FAMILY.radius);
    }
  }

  /** Steer along the planned route (avoiding everyone, keeping out of the pond and off the character), then step. */
  private move(npc: Npc, dt: number, w: FamilyWorld): void {
    // (sitting down, standing up and the doorway are scripted moves)
    if (npc.seat || npc.link) return;
    const R = w.R;
    if (npc.nearAt.dot(npc.n) < Math.cos(1 / R) || !npc.near.length) {
      const c = Math.cos(4 / R);
      npc.near = w.obstacles.filter((o) => o.n.dot(npc.n) > c);
      npc.nearAt.copy(npc.n);
    }
    let want = npc.want;
    const desired = _d.set(0, 0, 0);
    if (npc.goal) {
      const gd = arcDistance(npc.n, npc.goal, R);
      // follow the planned route: (re)plan when the goal moves on, and now and then for moving goals
      npc.routeAge += dt;
      if (gd > 0.3 && (!npc.route || (arcDistance(npc.routeFor, npc.goal, R) > 0.3 && npc.routeAge > 0.4) || npc.routeAge > 4)) this.plan(npc, []);
      const r = npc.route;
      while (r && r.length > 1 && arcDistance(npc.n, r[0], R) < 0.3) {
        r.shift();
        npc.progD = Infinity;
      }
      const next = r && gd > 0.3 ? r[0] : npc.goal;
      // stuck repair: no progress toward the next waypoint for a moment → a new route round whoever is in the way
      const nd = arcDistance(npc.n, next, R);
      if (nd < npc.progD - 0.04) {
        npc.progD = nd;
        npc.progT = 0;
      } else if (want > 0.3) {
        npc.progT += dt;
        if (npc.progT > AVOID.replanAfter) {
          this.plan(npc, this.blockers(npc, w));
          npc.progT = 0;
          npc.progD = Infinity;
          npc.repairs++;
        }
      }
      const to = tangentToward(npc.n, next, _t);
      if (to && gd > 0.04) {
        desired.copy(to);
        want = Math.min(want, Math.max(0.3, gd * 3));
      } else want = 0;
    } else {
      // nowhere to go: stand (a missing goal never means walking straight ahead)
      npc.route = null;
      npc.progD = Infinity;
      npc.progT = 0;
      want = 0;
    }
    if (want > 0.05) {
      const pd = arcDistance(npc.n, w.player, R);
      const fromP = tangentToward(npc.n, w.player, _a);
      if (fromP && pd < FAMILY.personal + 0.3) desired.addScaledVector(fromP, -(1 - pd / (FAMILY.personal + 0.3)) * 1.5);
      this.avoid(npc, w, desired, want);
    }
    if (desired.lengthSq() > 1e-8) {
      desired.addScaledVector(npc.n, -desired.dot(npc.n)).normalize();
      const align = npc.dir.dot(desired);
      turnToward(npc.dir, npc.n, desired, FAMILY.turnRate * dt);
      want *= Math.max(0.25, align);
    } else if (npc.look && npc.speed < 0.05) {
      const to = tangentToward(npc.n, npc.look, _t);
      if (to && arcDistance(npc.n, npc.look, R) > 0.1) turnToward(npc.dir, npc.n, to, 3 * dt);
    }
    npc.speed += Math.max(-FAMILY.accel * dt * 1.5, Math.min(FAMILY.accel * dt, want - npc.speed));
    if (npc.speed < 1e-3) {
      npc.speed = 0;
      // (standing still they still keep their distance: two who ended up too close step apart)
      this.keepClear(npc, w);
      transport(npc.dir, npc.n);
      return;
    }
    const theta = (npc.speed * dt) / R;
    let next = moveAlong(npc.n, npc.dir, theta);
    if (!this.free(w, next, 0, npc)) {
      let found = false;
      for (let k = 1; k <= 7 && !found; k++) {
        for (const s of [npc.side, -npc.side]) {
          const d2 = rotateAbout(_a.copy(npc.dir), npc.n, s * k * 0.4);
          const q = moveAlong(npc.n, d2, theta);
          if (this.free(w, q, 0, npc)) {
            next = q;
            npc.dir.copy(d2);
            npc.side = s;
            found = true;
            break;
          }
        }
      }
      if (!found) {
        npc.speed *= 0.3;
        next = npc.n.clone();
      }
    }
    npc.n.copy(next);
    const skip = npc.at ? npc.near.filter((o) => arcDistance(o.n, npc.at!.n, R) > 0.05) : npc.near;
    const fixed = resolvePenetration(npc.n, skip, { radius: R, playerRadius: FAMILY.radius, skin: 0.01 });
    if (fixed) npc.n.copy(fixed);
    this.keepClear(npc, w);
    transport(npc.dir, npc.n);
  }

  /** Nobody walks through anybody: keep clear of the character, Chopper and each other (the minimum gaps). */
  private keepClear(npc: Npc, w: FamilyWorld): void {
    this.keepApart(npc, w.player, FAMILY.gapPlayer, w);
    for (const o of w.others) this.keepApart(npc, o, FAMILY.gapOther, w);
    for (const o of this.npcs) if (o !== npc && !o.indoors) this.keepApart(npc, o.n, FAMILY.gapFamily, w);
  }

  private keepApart(npc: Npc, other: Vector3, gap: number, w: FamilyWorld): void {
    const R = w.R;
    const d = arcDistance(npc.n, other, R);
    if (d >= gap) return;
    const out = tangentToward(other, npc.n) ?? tangentToward(other, npc.n.clone().addScaledVector(npc.dir, -0.01).normalize());
    if (!out) return;
    // (onto open ground only: never into the pond or an obstacle)
    const to = moveAlong(other, out, gap / R);
    if (this.free(w, to, 0, npc)) npc.n.copy(to);
  }
}

// ---------------------------------------------------------------------------
// Dialog (docs: family.md §6): preset, generic lines; a greeting for the time of day, a line about
// what they're doing, one from their pool; nothing repeats until the pool has been used up.

type Lines = { greet: Record<'morning' | 'day' | 'evening' | 'night', readonly string[]>; pool: readonly string[]; doing: Record<string, readonly string[]> };

export const LINES: Record<NpcId, Lines> = {
  rojina: {
    greet: {
      morning: ['Good morning! Welcome to our little corner of the planet.', 'Morning! The tea is still warm, if you’d like some.'],
      day: ['Hello! Come and sit with us for a bit.', 'Oh, hello! Nice to have a visitor.'],
      evening: ['Evening already? The fire is going.', 'Look at that sky. Lovely, isn’t it?'],
      night: ['It’s getting late. The kids should be in bed soon.', 'Shh, listen. You can hear the crickets.'],
    },
    pool: [
      'Laija has been painting all day. She’s really getting good.',
      'Lingjel has lined up every toy car he owns. Again.',
      'I made lemonade. It’s on the table.',
      'Don’t let Chopper near the sandwiches.',
      'Isn’t it lovely by the pond today?',
      'Keep an eye on Lingjel near the water, will you?',
      'Maybe a song by the fire later? The guitar is out.',
      'Have you been over to the Library yet?',
      'Have you met Prabin? He’s usually off tinkering somewhere.',
    ],
    doing: {
      read: ['Just one more chapter…', 'This book is so good. No spoilers, please!'],
      serve: ['Lunch is ready! Go tell the kids.'],
      watch: ['Look at them go.', 'Where do they get all that energy?'],
      eat: ['Eat up, there’s plenty.', 'Lunch outside is the best, isn’t it?'],
    },
  },
  laija: {
    greet: {
      morning: ['Good morning!', 'Hi! Hi! Watch this!'],
      day: ['Hello!', 'Hi! Do you want to play?'],
      evening: ['Can we roast marshmallows tonight?', 'Hi! The fire is so warm.'],
      night: ['Is it bedtime already? Five more minutes!', 'Look, the stars are out!'],
    },
    pool: [
      'I’m painting the lighthouse. And a dragon.',
      'Did you see that butterfly? It was SO fast.',
      'I can skip a pebble three times. Well, almost.',
      'Lingjel knocked over my paints again.',
      'When I grow up I’m going to build a treehouse. A big one.',
      'I’m reading a book about the stars. Did you know the sun is a star?',
      'The rabbits here are really shy.',
      'Mama says I read too much. Is that even possible?',
      'Papa throws the stick for Chopper. Chopper always brings it back.',
    ],
    doing: {
      paint: ['Don’t look yet, it’s not finished!', 'I need more blue for the sky.'],
      readTree: ['Shh, it’s the good part.'],
      throw: ['Watch the ripples!', 'That one went really far!'],
      chase: ['I almost caught it!'],
      crouch: ['Look, a ladybird! It has seven spots.'],
      eat: ['Can I have another apple?'],
    },
  },
  prabin: {
    greet: {
      morning: ['Good morning! Welcome to my little planet.', 'Morning! You’re up early. Me too.'],
      day: ['Hi, I’m Prabin. Welcome to my little planet!', 'Hello! Glad you found your way here.'],
      evening: ['Good evening! The light is lovely this time of day.', 'Hi! Stay for the campfire?'],
      night: ['Still exploring? The lamps are on, have a look round.', 'Hello, night owl!'],
    },
    pool: [
      'Every building here is part of my work. Walk up to one and press E to have a look.',
      'The Workshop has my case studies. Start there, if you like.',
      'If you’d rather read it all as regular pages, the classic site is one click away.',
      'Try the crafting table between the Workshop and the Post Office.',
      'Have you met Chopper? Say hi to him for me.',
      'My family lives by the pond. Say hello if you pass by.',
      'Shake a tree or two. You never know what falls out.',
      'I’m still building this place. Come back and see what’s new.',
    ],
    doing: {
      admire: ['I like how this one turned out.', 'I never get tired of this view.'],
      hammer: ['I’m building a birdhouse. Or a very small shed.', 'Measure twice, hammer once.'],
      guitar: ['Want to hear a song? I’m still practising.'],
      fetch: ['He never gets tired of this.', 'One more throw? Always one more.'],
      stroll: ['Just stretching my legs.', 'I like a walk round the planet now and then.'],
      eat: ['Lunch outside is the best.'],
    },
  },
  lingjel: {
    greet: {
      morning: ['Morning!', 'Hi!'],
      day: ['Vroom vroom! Hi!', 'Hi!'],
      evening: ['Hi! Is it dinner time?', 'Hi!'],
      night: ['I’m not sleepy!', 'Hi! I’m not tired. At all.'],
    },
    pool: [
      'This one is the fastest car in the whole world.',
      'Red cars are the fastest. Everybody knows that.',
      'I’m building a garage for all my cars.',
      'Can you race me? I’m really, really fast.',
      'I saw a bunny! It went hop, hop, hop.',
      'Laija won’t let me use her crayons.',
      'When I’m big I’m going to drive a real car. A blue one.',
      'Beep beep! Coming through!',
    ],
    doing: {
      cars: ['Vroom vroom! Out of the way!'],
      lego: ['Don’t knock it over! It’s a tower for my cars.'],
      chase: ['Come back, butterfly!'],
      eat: ['I’m eating my crusts. Some of them.'],
    },
  },
};

export function partOfDay(hours: number): 'morning' | 'day' | 'evening' | 'night' {
  const h = ((hours % 24) + 24) % 24;
  return h >= 5 && h < 11 ? 'morning' : h >= 11 && h < 17 ? 'day' : h >= 17 && h < 20.5 ? 'evening' : 'night';
}

/**
 * Where a conversation's lines come from (prabin-npc.md §4.6): the preset `LinePicker` now; a
 * generative agent can implement the same call later (who, what they're doing, the time of day).
 */
export interface DialogueProvider {
  conversation(id: NpcId, activity: string, hours: number): string[];
}

/** Picks lines so none repeats until its list has been used up (per NPC and list). */
export class LinePicker implements DialogueProvider {
  private readonly used = new Map<string, Set<string>>();
  constructor(private readonly rand: () => number = Math.random) {}

  pick(key: string, list: readonly string[]): string {
    let used = this.used.get(key);
    if (!used || used.size >= list.length) {
      const last = used ? [...used].pop() : undefined;
      used = new Set(last && list.length > 1 ? [last] : []);
      this.used.set(key, used);
    }
    const fresh = list.filter((l) => !used!.has(l));
    const line = fresh[Math.floor(this.rand() * fresh.length)] ?? list[0];
    used.add(line);
    return line;
  }

  /** A conversation: the greeting, then a line about what they're doing (often), then one from their pool. */
  conversation(id: NpcId, activity: string, hours: number): string[] {
    const L = LINES[id];
    const out = [this.pick(`${id}:greet:${partOfDay(hours)}`, L.greet[partOfDay(hours)])];
    const doing = L.doing[activity];
    if (doing && this.rand() < 0.75) out.push(this.pick(`${id}:doing:${activity}`, doing));
    out.push(this.pick(`${id}:pool`, L.pool));
    return out;
  }
}
