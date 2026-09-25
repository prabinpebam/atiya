/**
 * The family's minds (docs: family.md §5): Rojina, Laija and Lingjel living by the house. A small
 * utility AI in the style of The Sims' smart objects: each activity belongs to a place or a person
 * (the reading chair, the tree, the mat, the pond's edge, a butterfly, one of the family), scores
 * itself for whoever could do it, and the winner is done for a while, then cools down and isn't
 * repeated straight away. Pure: no rendering, no DOM (the tests drive it directly).
 */
import { Vector3 } from 'three';
import { arcDistance, moveAlong, resolvePenetration, tangentToward, type Obstacle } from '../../math/sphere';
import { rotateAbout, transport, turnToward } from '../animals';
import type { HomeSpot, Homestead } from '../homestead';
import { NavGrid } from './nav';

export type NpcId = 'rojina' | 'laija' | 'lingjel';
export type NpcPose = 'stand' | 'sitChair' | 'read' | 'readGround' | 'paint' | 'crawl' | 'lego' | 'throw' | 'crouch' | 'talk' | 'place' | 'fetch' | 'watch' | 'eat';

/** Poses in which they stay put (seated or on the ground) when someone talks to them. */
const SETTLED: ReadonlySet<NpcPose> = new Set(['read', 'sitChair', 'readGround', 'lego', 'eat']);
export type Held = 'book' | 'car' | 'pebble' | 'basket' | null;

export const NPC = {
  rojina: { name: 'Rojina', walk: 1.0, run: 1.6, runChance: 0 },
  laija: { name: 'Laija', walk: 1.05, run: 2.3, runChance: 0.4 },
  lingjel: { name: 'Lingjel', walk: 0.95, run: 2.5, runChance: 0.6 },
} as const;

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
  pose?: NpcPose;
  held?: Held;
  /** Run the whole activity by hand (moving targets, several stages); true when done. */
  run?(f: Family, npc: Npc, w: FamilyWorld, dt: number): boolean;
  start?(f: Family, npc: Npc, w: FamilyWorld): boolean;
}

const _t = new Vector3();
const _a = new Vector3();
const _d = new Vector3();

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
      if (npc.stage === 0) return f.goTo(npc, w, home.door, 'walk', dt) && f.next(npc);
      if (npc.stage === 1) {
        f.face(npc, home.house.n);
        npc.pose = 'fetch';
        if (npc.stageT > 1.3) {
          npc.held = 'basket';
          f.next(npc);
        }
        return false;
      }
      if (npc.stage === 2) {
        const by = { n: offset(home.table.n, home.table.facing, 180, 0.75, w.R), facing: home.table.facing.clone().negate() };
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
    who: ['laija', 'lingjel', 'rojina'],
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
  // ---- the routine and meals (never picked by the utility AI)
  {
    id: 'eat',
    forced: true,
    who: ['rojina', 'laija', 'lingjel'],
    weight: 0,
    dur: [0, 0],
    cooldown: 0,
    run: (f, npc, w, dt) => {
      if (!f.meal || f.meal.phase === 'clear') return true;
      const seat = w.home.tableChairs[f.npcs.indexOf(npc) % w.home.tableChairs.length];
      npc.at = seat;
      if (npc.stage === 0) return f.goTo(npc, w, seat, 'walk', dt) && f.next(npc);
      npc.want = 0;
      npc.goal = null;
      f.face(npc, w.home.table.n);
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
      if (npc.stage === 1) return f.goTo(npc, w, home.door, 'walk', dt) && f.next(npc);
      f.face(npc, home.house.n);
      npc.pose = 'fetch';
      if (npc.stageT > 0.8) {
        npc.held = null;
        f.endMeal();
        return true;
      }
      return false;
    },
  },
  {
    id: 'bedtime',
    forced: true,
    who: ['rojina', 'laija', 'lingjel'],
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
      if (npc.stage === 1) {
        npc.held = npc.id === 'rojina' && f.foodOnTable ? 'basket' : null;
        if (npc.id === 'rojina') f.foodOnTable = false;
        return (f.goTo(npc, w, home.door, 'walk', dt) || npc.stageT > 25) && f.next(npc);
      }
      f.face(npc, home.house.n);
      npc.pose = 'fetch';
      if (npc.stageT > 0.6) {
        f.goInside(npc, w);
        return false;
      }
      return false;
    },
  },
  {
    id: 'indoors',
    forced: true,
    who: ['rojina', 'laija', 'lingjel'],
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
    who: ['rojina', 'laija', 'lingjel'],
    weight: 0,
    dur: [0, 0],
    cooldown: 0,
    run: (f, npc, w, dt) => {
      const home = w.home;
      // one by one (Rojina first), out of the door and a few steps onto the lawn
      if (npc.stage === 0) {
        if (npc.t < npc.dur) return false;
        npc.indoors = false;
        npc.n.copy(home.door.n);
        npc.dir.copy(home.door.facing);
        npc.at = { n: moveAlong(home.door.n, home.door.facing, 1.1 / w.R), facing: home.door.facing.clone() };
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
  /** Route planning over the home ground (built on the first step, from the world's obstacles). */
  nav: NavGrid | null = null;
  private clock = 0;

  constructor(
    home: Homestead,
    R: number,
    readonly rand: () => number = Math.random,
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
    });
    this.npcs = [
      mk('rojina', offset(home.readingChair.n, home.readingChair.facing, 0, 0.5, R)),
      mk('laija', offset(home.mat.n, home.mat.facing, 60, 0.9, R)),
      mk('lingjel', offset(home.mat.n, home.mat.facing, -60, 0.8, R)),
    ];
    for (let i = 0; i < 3; i++) {
      const a = offset(home.centre, home.house.facing, 90 + i * 120, 1.8 + i * 0.4, R);
      this.butterflies.push({ n: a.clone(), h: 0.6, home: a, phase: i * 2.1, scared: 0, away: new Vector3() });
    }
  }

  /** The route-planning grid for a world (build it while loading: it's the costly part, ≈ 10 ms). */
  static navFor(w: FamilyWorld): NavGrid {
    return new NavGrid(w.home.centre, w.R, w.obstacles, w.blocked, FAMILY.radius + 0.12);
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
    for (const npc of this.npcs) {
      if (npc.indoors && npc.activity === 'indoors') continue;
      for (const k of Object.keys(npc.cooldown)) npc.cooldown[k] = Math.max(0, npc.cooldown[k] - dt);
      npc.t += dt;
      npc.stageT += dt;
      npc.poseT += dt;
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
      // blocked on the way (a spot boxed in, someone in the way for long): give up and do something else
      npc.stuck = npc.want > 0.3 && npc.speed < 0.05 ? npc.stuck + dt : 0;
      if (npc.stuck > 1.5 && npc.activity !== 'answer' && !ACTIVITIES.find((a) => a.id === npc.activity)?.forced) {
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
    // go to its spot, then do it there for a while
    if (npc.stage === 0) {
      if (!npc.at) return true;
      npc.pose = 'stand';
      if (this.goTo(npc, w, npc.at, 'walk', dt) || npc.t > 14) {
        npc.stage = 1;
        npc.stageT = 0;
        npc.t = 0;
      }
      return false;
    }
    npc.want = 0;
    npc.goal = null;
    this.faceDir(npc, npc.at!.facing, dt);
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
    npc.at = spot;
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
    npc.indoors = true;
    npc.held = null;
    npc.speed = 0;
    npc.chatting = false;
    npc.n.copy(w.home.door.n);
    this.force(npc, 'indoors', 0);
    if (npc.id === 'rojina') this.foodOnTable = false;
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
    if (m.phase === 'gather' && (out.every((n) => n.pose === 'eat' || n.chatting) || m.t > 25)) {
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
      if (k === npc || k.id === 'rojina') continue;
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
    const free = this.npcs.filter((o) => o !== npc && !o.partner && !o.chatting && o.activity !== 'serve' && o.activity !== 'throw');
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
    npc.at = def.spot ? def.spot(this, npc, w) : null;
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
        if (k.id === 'rojina') continue;
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

  /** Steer toward the goal (feelers round obstacles, keeping out of the pond and off the character), then step. */
  private move(npc: Npc, dt: number, w: FamilyWorld): void {
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
      // follow the planned route: (re)plan when the goal moves on, or now and then for moving goals
      npc.routeAge += dt;
      if (this.nav && gd > 0.3 && (!npc.route || (arcDistance(npc.routeFor, npc.goal, R) > 0.3 && npc.routeAge > 0.4) || npc.routeAge > 2.5)) {
        npc.route = this.nav.path(npc.n, npc.goal);
        npc.routeFor.copy(npc.goal);
        npc.routeAge = 0;
      }
      const r = npc.route;
      while (r && r.length > 1 && arcDistance(npc.n, r[0], R) < 0.3) r.shift();
      const next = r && gd > 0.3 ? r[0] : npc.goal;
      const to = tangentToward(npc.n, next, _t);
      if (to && gd > 0.04) {
        desired.copy(to);
        want = Math.min(want, Math.max(0.3, gd * 3));
      } else want = 0;
    } else {
      // nowhere to go: stand (a missing goal never means walking straight ahead)
      npc.route = null;
      want = 0;
    }
    if (want > 0.05) {
      const pd = arcDistance(npc.n, w.player, R);
      const fromP = tangentToward(npc.n, w.player, _a);
      if (fromP && pd < FAMILY.personal + 0.3) desired.addScaledVector(fromP, -(1 - pd / (FAMILY.personal + 0.3)) * 1.5);
      // and give each other (and Chopper) room (separation)
      for (const o of w.others) {
        const od = arcDistance(npc.n, o, R);
        const away = od < 0.7 ? tangentToward(npc.n, o, _a) : null;
        if (away) desired.addScaledVector(away, -(1 - od / 0.7) * 1.2);
      }
      for (const o of this.npcs) {
        if (o === npc || o.indoors) continue;
        const od = arcDistance(npc.n, o.n, R);
        const away = od < 0.55 ? tangentToward(npc.n, o.n, _a) : null;
        if (away) desired.addScaledVector(away, -(1 - od / 0.55) * 1.2);
      }
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
    // nobody walks through anybody: whoever is moving keeps clear of the character, Chopper and each other
    this.keepApart(npc, w.player, FAMILY.gapPlayer, R);
    for (const o of w.others) this.keepApart(npc, o, FAMILY.gapOther, R);
    for (const o of this.npcs) if (o !== npc && !o.indoors) this.keepApart(npc, o.n, FAMILY.gapFamily, R);
    transport(npc.dir, npc.n);
  }

  private keepApart(npc: Npc, other: Vector3, gap: number, R: number): void {
    const d = arcDistance(npc.n, other, R);
    if (d >= gap) return;
    const out = tangentToward(other, npc.n) ?? tangentToward(other, npc.n.clone().addScaledVector(npc.dir, -0.01).normalize());
    if (out) npc.n.copy(moveAlong(other, out, gap / R));
  }
}

// ---------------------------------------------------------------------------
// Dialog (docs: family.md §6): preset, generic lines; a greeting for the time of day, a line about
// what they're doing, one from their pool; nothing repeats until the pool has been used up.

type Lines = { greet: Record<'morning' | 'day' | 'evening' | 'night', readonly string[]>; pool: readonly string[]; doing: Record<string, readonly string[]> };

export const LINES: Record<NpcId, Lines> = {
  rojina: {
    greet: {
      morning: ['Good morning! Did you sleep well?', 'Morning! The tea is still warm.'],
      day: ['Hey, you! Come and sit with us for a bit.', 'There you are!'],
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
      'Have you been over to the Library lately?',
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

/** Picks lines so none repeats until its list has been used up (per NPC and list). */
export class LinePicker {
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
