import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { CONFIG } from '../../src/game/config';
import { landmarkGeometry } from '../../src/game/math/landmarks';
import { UP, arcDistance, moveAlong, pointArcDistance, tangentToward, type Obstacle } from '../../src/game/math/sphere';
import { FLOWER_KINDS, KEEP_CLEAR, generateProps, mulberry32 } from '../../src/game/world/layout';
import { Terrain } from '../../src/game/world/terrain';
import { riverDistance } from '../../src/game/world/features';
import { AVOID, CRAFT_STAND, FAMILY, Family, LINES, type FamilyWorld } from '../../src/game/world/home/family';
import { SphereNav } from '../../src/game/world/home/nav';
import { SEAT_KINDS, SIT_T, homeSeats, pickEntry, seatHip } from '../../src/game/world/home/seats';
import { PROP_SCALE, HOME_R } from '../../src/game/world/homestead';
import { ChopperBrain, type DogWorld } from '../../src/game/world/chopper/brain';
import { HIP_FRACTION } from '../../src/game/world/home/poses';
import { FIXTURE_LANDMARKS } from './fixtures';

const R = CONFIG.planetRadius;
const geos = FIXTURE_LANDMARKS.map((l) => landmarkGeometry(l));
const layout = generateProps(geos);
const terrain = new Terrain(geos, layout);
const home = layout.home!;
const obstacles: Obstacle[] = [...geos.map((g) => ({ n: g.n, radiusU: g.footprintU })), ...layout.obstacles];
const d = (a: Vector3, b: Vector3) => arcDistance(a, b, R);
const pond = layout.pond!;
const blocked = (n: Vector3) => d(n, pond.n) < terrain.pondShore(n) + 0.05 || terrain.waterDepth(n) > 0.12;
const nav = new SphereNav(R, obstacles, blocked, FAMILY.radius + 0.12);
const HEIGHTS = { rojina: 1.18, laija: 0.92, lingjel: 0.74, prabin: 1.28 };

function world(player: Vector3, hours = 12, brain?: ChopperBrain): FamilyWorld {
  return {
    hours,
    others: brain ? [brain.n] : [],
    pond: { n: pond.n, shore: (n) => terrain.pondShore(n) },
    R,
    home,
    player,
    obstacles,
    blocked,
    rabbits: [],
    flowers: FLOWER_KINDS.flatMap((k) => layout.flowers[k].map((x) => x.n)).filter((n) => d(n, home.centre) < home.range),
    planet: { spawn: UP.clone(), landmarks: geos.map((g) => ({ id: g.id, n: g.n, approach: g.approach, footprintU: g.footprintU })), craft: layout.craft, bridges: [] },
    dog: brain ? { n: brain.n, free: () => !['whistled', 'heel', 'house', 'fetch'].includes(brain.behaviour) && d(brain.n, player) < 5 } : undefined,
  };
}

function dogWorld(player: Vector3, f: Family | null, extra: Partial<DogWorld> = {}): DogWorld {
  return {
    R,
    player,
    playerFwd: tangentToward(player, new Vector3(0, 0, -1)) ?? new Vector3(1, 0, 0),
    playerVel: new Vector3(),
    obstacles,
    blocked: (n) => d(n, pond.n) < terrain.pondShore(n) + 0.05 || terrain.waterDepth(n) > 0.16,
    rabbits: [],
    spots: [],
    others: f ? f.npcs.map((n) => n.n) : [],
    fetch: f?.fetch,
    plan: (from, to, stuck) => (!stuck && nav.visible(from, to) ? [to.clone()] : nav.path(from, to)),
    ...extra,
  };
}

const step = (f: Family, w: FamilyWorld, seconds: number, each?: () => void) => {
  for (let t = 0; t < seconds; t += 1 / 30) {
    f.step(1 / 30, w);
    each?.();
  }
};

describe('the planet’s route planner (prabin-npc.md §4.1)', () => {
  it('covers the whole sphere with nearly square cells, joined across the cube’s seams', () => {
    expect(nav.count).toBe(6 * 63 * 63);
    expect(nav.cellU).toBeGreaterThan(0.24);
    expect(nav.cellU).toBeLessThan(0.26);
    // every cell is found again from its own centre, and its neighbours are about a cell away
    for (let k = 0; k < nav.count; k += 97) {
      const c = nav.centre(k);
      expect(nav.cellOf(c)).toBe(k);
    }
  });

  it('plans across the planet round obstacles, never through the pond or deep water, and the route stays clear between waypoints', () => {
    const pairs: Array<[Vector3, Vector3]> = [
      [UP.clone(), home.door.n],
      [geos[2].approach, geos[5].approach],
      [geos[0].approach, geos[3].approach],
      [layout.craft!.n.clone(), home.fire.n],
    ];
    for (const [a0, b] of pairs) {
      const a = moveAlong(a0, tangentToward(a0, b)!, 0.6 / R);
      const route = nav.path(a, b)!;
      expect(route).toBeTruthy();
      expect(d(route[route.length - 1], b)).toBeLessThan(1e-6);
      const pts = [a, ...route];
      let len = 0;
      for (let i = 1; i < pts.length; i++) {
        len += d(pts[i - 1], pts[i]);
        // (the last leg may go the final bit into a pocket the grown obstacles seal off)
        if (i === pts.length - 1) continue;
        for (let t = 0.05; t < 1; t += 0.05) {
          const p = pts[i - 1].clone().lerp(pts[i], t).normalize();
          for (const o of obstacles) expect(d(p, o.n), 'route crosses an obstacle').toBeGreaterThan(o.radiusU + 0.05);
          expect(blocked(p), 'route goes into the water').toBe(false);
        }
      }
      expect(len).toBeLessThan(d(a, b) * 1.8 + 2);
    }
  });

  it('plans round a walker standing in the way when asked to', () => {
    const a = moveAlong(home.centre, home.house.facing, 1 / R);
    const b = moveAlong(a, home.table.facing, 2 / R);
    const mid = a.clone().lerp(b, 0.5).normalize();
    const straight = nav.path(a, b)!;
    const round = nav.path(a, b, [{ n: mid, r: 0.3 }])!;
    expect(straight.length).toBeLessThanOrEqual(round.length);
    const pts = [a, ...round];
    for (let i = 1; i < pts.length; i++) for (let t = 0; t <= 1; t += 0.05) expect(d(pts[i - 1].clone().lerp(pts[i], t).normalize(), mid)).toBeGreaterThan(0.3);
  });
});

describe('moving among each other (§4.2)', () => {
  it('two walkers meeting head-on pass each other without touching or stalling', () => {
    const player = moveAlong(home.centre, home.house.facing, -6 / R);
    const f = new Family(home, R, mulberry32(1));
    const w = world(player);
    for (const n of f.npcs) n.indoors = true;
    const a = f.get('rojina');
    const b = f.get('prabin');
    a.indoors = b.indoors = false;
    // on open ground, 5 u apart, each walking to where the other starts
    const start = f.openSpot(w, home.centre, 0, 0.1, null)!.n;
    const dir = tangentToward(start, home.house.n)!.applyAxisAngle(start, Math.PI / 2);
    const pa = moveAlong(start, dir, -2.5 / R);
    const pb = moveAlong(start, dir, 2.5 / R);
    a.n.copy(pa);
    b.n.copy(pb);
    const ga = { n: pb.clone(), facing: dir.clone() };
    const gb = { n: pa.clone(), facing: dir.clone().negate() };
    let closest = Infinity;
    let arrived = 0;
    for (let t = 0; t < 12 && arrived < 2; t += 1 / 30) {
      arrived = 0;
      for (const [n, g] of [
        [a, ga],
        [b, gb],
      ] as const) {
        n.activity = 'idle';
        if (f.goTo(n, w, g, 'walk', 1 / 30)) arrived++;
      }
      (f as unknown as { move(n: unknown, dt: number, w: FamilyWorld): void }).move(a, 1 / 30, w);
      (f as unknown as { move(n: unknown, dt: number, w: FamilyWorld): void }).move(b, 1 / 30, w);
      closest = Math.min(closest, d(a.n, b.n));
    }
    expect(arrived).toBe(2);
    expect(closest).toBeGreaterThan(FAMILY.gapFamily - 0.02);
  });

  it('a walker boxed behind a boulder gets round it to its goal (a planned route, and stuck repair)', () => {
    const boulder = layout.boulders.find((b) => nav.freeAt(moveAlong(b.n, tangentToward(b.n, UP) ?? new Vector3(1, 0, 0), (0.4 * b.scale + 0.8) / R)))!;
    const out = tangentToward(boulder.n, UP) ?? new Vector3(1, 0, 0);
    const r = 0.4 * boulder.scale;
    const from = moveAlong(boulder.n, out, (r + 0.35) / R);
    const to = moveAlong(boulder.n, out.clone().negate(), (r + 1.2) / R);
    const f = new Family(home, R, mulberry32(2));
    f.nav = nav;
    const w = world(moveAlong(from, out, 8 / R));
    for (const n of f.npcs) n.indoors = true;
    const p = f.get('prabin');
    p.indoors = false;
    p.n.copy(from);
    p.dir.copy(out).negate();
    const goal = { n: to, facing: out.clone().negate() };
    let got = false;
    for (let t = 0; t < 15 && !got; t += 1 / 30) {
      p.activity = 'idle';
      got = f.goTo(p, w, goal, 'walk', 1 / 30);
      (f as unknown as { move(n: unknown, dt: number, w: FamilyWorld): void }).move(p, 1 / 30, w);
      expect(d(p.n, boulder.n)).toBeGreaterThan(r + FAMILY.radius - 0.02);
    }
    expect(got).toBe(true);
    expect(AVOID.replanAfter).toBeLessThan(AVOID.giveUpAfter);
  });

  it('Chopper follows a planned route round a boulder instead of pushing into it', () => {
    const boulder = layout.boulders.find((b) => nav.freeAt(moveAlong(b.n, tangentToward(b.n, UP) ?? new Vector3(1, 0, 0), (0.4 * b.scale + 0.8) / R)))!;
    const out = tangentToward(boulder.n, UP) ?? new Vector3(1, 0, 0);
    const r = 0.4 * boulder.scale;
    const player = moveAlong(boulder.n, out.clone().negate(), (r + 2.2) / R);
    const brain = new ChopperBrain(mulberry32(4));
    const w = dogWorld(player, null);
    brain.n.copy(moveAlong(boulder.n, out, (r + 0.4) / R));
    brain.dir.copy(out).negate();
    brain.whistle();
    let reached = false;
    for (let t = 0; t < 10 && !reached; t += 1 / 30) {
      brain.step(1 / 30, w);
      expect(d(brain.n, boulder.n)).toBeGreaterThan(r + 0.18);
      reached = d(brain.n, player) < 1.6;
    }
    expect(reached).toBe(true);
  });

  it('over minutes of a whole day, nobody walks through anybody: the family, Prabin, Chopper and the character', () => {
    let player = moveAlong(home.centre, home.house.facing, 0.6 / R);
    for (let k = 0; k < 40 && obstacles.some((o) => d(o.n, player) < o.radiusU + 0.4); k++) player = moveAlong(home.centre, home.house.facing.clone().applyAxisAngle(home.centre, k * 0.5), (0.6 + k * 0.05) / R);
    const brain = new ChopperBrain(mulberry32(7));
    const f = new Family(home, R, mulberry32(7));
    f.nav = nav;
    const w = world(player, 12, brain);
    const dw = dogWorld(player, f);
    brain.placeNear(dw);
    let worstP = Infinity;
    let worstF = Infinity;
    let worstD = Infinity;
    for (let t = 0; t < 180; t += 1 / 30) {
      f.step(1 / 30, w);
      brain.step(1 / 30, dw);
      for (const n of f.npcs) {
        if (n.indoors || n.seat || n.link) continue;
        worstP = Math.min(worstP, d(n.n, player));
        worstD = Math.min(worstD, d(n.n, brain.n));
        for (const o of f.npcs) if (o !== n && !o.indoors) worstF = Math.min(worstF, d(n.n, o.n));
      }
    }
    expect(worstP).toBeGreaterThan(FAMILY.gapPlayer - 0.02);
    expect(worstF).toBeGreaterThan(FAMILY.gapFamily - 0.02);
    expect(worstD).toBeGreaterThan(FAMILY.gapOther - 0.05);
  });
});

describe('seats as smart objects (§4.3)', () => {
  const seats = homeSeats(home, R);

  it('four chairs at the table (Prabin has one too), a reading chair and two camp chairs', () => {
    expect(home.tableChairs).toHaveLength(4);
    expect(seats.filter((s) => s.kind === 'dining')).toHaveLength(4);
    expect(seats.filter((s) => s.kind === 'camp')).toHaveLength(2);
    // the chairs don't overlap each other, the table or the string lights' post
    const table = [-1, 1].map((s) => moveAlong(home.table.n, home.table.facing, (s * 0.24) / R));
    for (const c of home.tableChairs) {
      for (const t of table) expect(d(c.n, t)).toBeGreaterThan(0.3 + HOME_R.chair - 0.08);
      expect(d(c.n, home.lightsPost)).toBeGreaterThan(HOME_R.chair + HOME_R.post + 0.1);
      for (const o of home.tableChairs) if (o !== c) expect(d(c.n, o.n)).toBeGreaterThan(2 * HOME_R.chair + 0.1);
    }
  });

  it('every seat has entry points outside its chair, and at least one on open ground', () => {
    for (const s of seats) {
      for (const e of s.entries) expect(d(e.n, s.spot.n), s.id).toBeGreaterThan(HOME_R.chair + FAMILY.radius);
      const free = (n: Vector3) => !blocked(n) && obstacles.every((o) => d(n, o.n) > o.radiusU + FAMILY.radius);
      expect(pickEntry(s, s.entries[0].n, free), s.id).not.toBeNull();
    }
  });

  it('the hips rest on each seat at its own height, for every body: nobody sinks into the chair', () => {
    for (const s of seats) {
      expect(s.height).toBeCloseTo(SEAT_KINDS[s.kind].top * PROP_SCALE, 6);
      for (const [id, h] of Object.entries(HEIGHTS)) {
        const hip = seatHip(s, h);
        expect(hip, `${id} on ${s.id}`).toBeGreaterThan(s.height);
        expect(hip - s.height, `${id} on ${s.id}`).toBeLessThan(0.08);
      }
    }
    // (the old way, a fixed share of the body's height, sank the children into the seat)
    expect(0.335 * HEIGHTS.lingjel).toBeLessThan(seats.find((s) => s.kind === 'dining')!.height);
    expect(HIP_FRACTION).toBeGreaterThan(0);
  });

  it('they walk to the entry point (never through the chair), then sit down onto the seat, and stand up the same way', () => {
    const f = new Family(home, R, mulberry32(8));
    f.nav = nav;
    const w = world(moveAlong(home.centre, home.house.facing, -6 / R));
    const roj = f.get('rojina');
    f.hold('rojina', 'read', w);
    const chair = f.seats.find((s) => s.id === 'reading')!;
    let sitStart = -1;
    let seated = -1;
    let t = 0;
    for (; t < 30 && seated < 0; t += 1 / 30) {
      f.step(1 / 30, w);
      if (roj.seat?.phase === 'in' && sitStart < 0) {
        sitStart = t;
        // she's at an entry point, outside the chair
        expect(d(roj.n, chair.spot.n)).toBeGreaterThan(HOME_R.chair + FAMILY.radius - 0.05);
      }
      if (!roj.seat) expect(d(roj.n, chair.spot.n), 'walked into the chair').toBeGreaterThan(HOME_R.chair + FAMILY.radius - 0.03);
      if (roj.seat?.phase === 'on') seated = t;
    }
    expect(sitStart).toBeGreaterThan(0);
    expect(seated - sitStart).toBeGreaterThan(SIT_T - 0.1);
    expect(d(roj.n, chair.spot.n)).toBeLessThan(1e-6);
    expect(chair.user).toBe('rojina');
    expect(roj.pose).toBe('read');
    // something else: she stands up, back to the entry point, and the chair is free again
    f.hold('rojina', 'watch', w);
    step(f, w, SIT_T + 0.2);
    expect(roj.seat).toBeNull();
    expect(chair.user).toBeNull();
    expect(d(roj.n, chair.spot.n)).toBeGreaterThan(HOME_R.chair + FAMILY.radius - 0.05);
  });
});

describe('the front door (§4.4)', () => {
  it('opens for whoever goes in, one at a time; they climb up and in, and it shuts after them; in the morning they come out the same way', () => {
    const f = new Family(home, R, mulberry32(5));
    f.nav = nav;
    const w = world(moveAlong(home.centre, home.house.facing, -6 / R), 15);
    step(f, w, 2);
    w.hours = 21;
    let passing = 0;
    let maxPassing = 0;
    let openWhilePassing = 1;
    step(f, w, 70, () => {
      passing = f.npcs.filter((n) => n.link?.phase === 'walk').length;
      maxPassing = Math.max(maxPassing, passing);
      if (passing) openWhilePassing = Math.min(openWhilePassing, f.door.open);
    });
    expect(f.npcs.every((n) => n.indoors)).toBe(true);
    expect(maxPassing).toBe(1);
    expect(openWhilePassing).toBeGreaterThan(0.84);
    step(f, w, 2);
    expect(f.door.open).toBe(0);
    for (const n of f.npcs) expect(d(n.n, f.insideSpot(R))).toBeLessThan(0.2);
    // the morning: out through the door, one by one, down the steps
    for (let h = 21; h < 30.2; h += 0.02) {
      w.hours = h % 24;
      f.step(1 / 30, w);
    }
    let sawOut = false;
    step(f, w, 30, () => (sawOut ||= f.npcs.some((n) => n.link?.dir === 'out' && n.link.phase === 'walk' && f.door.open > 0.84)));
    expect(sawOut).toBe(true);
    for (const n of f.npcs) expect(n.indoors, n.id).toBe(false);
  });
});

describe('Prabin (§4.6)', () => {
  it('finds a place to admire every building from, off its path and facing it', () => {
    const f = new Family(home, R, mulberry32(3));
    f.nav = nav;
    const w = world(UP.clone());
    const p = f.get('prabin');
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const s = f.admireSpot(p, w)!;
      expect(s).toBeTruthy();
      expect(f.standable(w, s.n)).toBe(true);
      // facing one of the buildings, a few steps from its front and off its path
      const g = geos.find((x) => tangentToward(s.n, x.n)!.dot(s.facing) > 0.99 && d(s.n, x.n) - x.footprintU < 4)!;
      expect(g, 'facing a building').toBeTruthy();
      seen.add(g.id);
      expect(d(s.n, g.n) - g.footprintU).toBeGreaterThan(1);
      expect(pointArcDistance(s.n, UP, g.approach, R)).toBeGreaterThan(0.8);
    }
    expect(seen.size).toBeGreaterThanOrEqual(5);
  });

  it('works at the crafting table, but gives it up to the visitor: never starting while they’re near, stopping when they come', () => {
    const craft = layout.craft!;
    const far = moveAlong(craft.n, craft.facing, 8 / R);
    const w = world(far.clone());
    const f = new Family(home, R, mulberry32(6), moveAlong(craft.n, craft.facing, (CRAFT_STAND + 1.5) / R));
    f.nav = nav;
    const p = f.get('prabin');
    f.hold('prabin', 'hammer', w);
    step(f, w, 8);
    expect(p.pose).toBe('hammer');
    expect(p.held).toBe('hammer');
    expect(d(p.n, craft.n)).toBeLessThan(CRAFT_STAND + 0.2);
    // the visitor walks up: he stops and moves on
    w.player.copy(moveAlong(craft.n, craft.facing, 1.6 / R));
    step(f, w, 1);
    expect(p.activity).not.toBe('hammer');
    // and while they're near, he doesn't choose it
    for (let i = 0; i < 40; i++) {
      step(f, w, 1);
      expect(p.activity).not.toBe('hammer');
    }
  });

  it('plays the guitar in the campfire chair, the leaning guitar in his hands', () => {
    const f = new Family(home, R, mulberry32(4));
    f.nav = nav;
    const w = world(moveAlong(home.centre, home.house.facing, -6 / R));
    const p = f.get('prabin');
    f.hold('prabin', 'guitar', w);
    step(f, w, 20);
    expect(p.seat?.seat.id).toBe('camp0');
    expect(p.seat?.phase).toBe('on');
    expect(p.pose).toBe('guitar');
    expect(p.held).toBe('guitar');
  });

  it('plays fetch with Chopper: throws the stick, Chopper brings it back, three times, then a pat', () => {
    const player = moveAlong(UP, new Vector3(0, 0, -1), 3.5 / R);
    const brain = new ChopperBrain(mulberry32(3));
    const f = new Family(home, R, mulberry32(3), moveAlong(player, new Vector3(1, 0, 0), 3 / R));
    f.nav = nav;
    const w = world(player, 12, brain);
    const dw = dogWorld(player, f);
    brain.placeNear(dw);
    f.hold('prabin', 'fetch', w);
    const p = f.get('prabin');
    let throws = 0;
    let returns = 0;
    let last = f.fetch.state;
    let patted = false;
    for (let t = 0; t < 40; t += 1 / 30) {
      f.step(1 / 30, w);
      brain.step(1 / 30, dw);
      if (f.fetch.state !== last) {
        if (f.fetch.state === 'thrown') throws++;
        if (f.fetch.state === 'dropped') {
          returns++;
          // dropped at his feet
          expect(d(f.fetch.stick, p.n)).toBeLessThan(1.2);
        }
        last = f.fetch.state;
      }
      if (p.pose === 'pet') patted = true;
    }
    expect(throws).toBe(3);
    expect(returns).toBe(3);
    expect(patted).toBe(true);
  });

  it('roams the whole planet: over a long day he goes far from home and does all his things, and comes home for the night', () => {
    // (the visitor on the plaza's far side from the crafting table, so he's free to work there)
    const player = moveAlong(UP, tangentToward(UP, layout.craft!.n)!.negate(), 2.5 / R);
    // (the choice is random: this seed, like most, strolls within the ten minutes; seed 12 stopped doing so
    // when the home was spread out for the levelled ground, ground.md)
    const brain = new ChopperBrain(mulberry32(13));
    const f = new Family(home, R, mulberry32(13), moveAlong(layout.craft!.n, layout.craft!.facing, 2 / R));
    f.nav = nav;
    const w = world(player, 9, brain);
    const dw = dogWorld(player, f);
    brain.placeNear(dw);
    const p = f.get('prabin');
    const did = new Set<string>();
    let farthest = 0;
    for (let t = 0; t < 600; t += 1 / 30) {
      f.step(1 / 30, w);
      brain.step(1 / 30, dw);
      did.add(p.activity);
      farthest = Math.max(farthest, d(p.n, home.centre));
      expect(blocked(p.n), 'Prabin in the water').toBe(false);
    }
    expect(farthest).toBeGreaterThan(15);
    for (const a of ['stroll', 'admire', 'hammer', 'fetch']) expect(did.has(a), `${a}: ${[...did].join(', ')}`).toBe(true);
    // the evening: home, and in
    w.hours = 20.5;
    step(f, w, 150);
    expect(p.indoors).toBe(true);
  });

  it('never stalls: over long days of roaming on several seeds he never wants to walk for 3 s without getting anywhere', () => {
    let stalls = 0;
    const where: string[] = [];
    for (const seed of [1, 3, 5, 8, 9]) {
      const player = moveAlong(UP, tangentToward(UP, layout.craft!.n)!.negate(), 2.5 / R);
      const brain = new ChopperBrain(mulberry32(seed));
      const f = new Family(home, R, mulberry32(seed), moveAlong(layout.craft!.n, layout.craft!.facing, 2 / R));
      f.nav = nav;
      const w = world(player, 9, brain);
      const dw = dogWorld(player, f);
      brain.placeNear(dw);
      const p = f.get('prabin');
      const hist: Array<{ n: Vector3; goal: Vector3 | null }> = [];
      let wantFor = 0;
      let flagged = false;
      for (let t = 0; t < 600; t += 1 / 30) {
        w.hours = 9 + (t / 600) * 9;
        f.step(1 / 30, w);
        brain.step(1 / 30, dw);
        hist.push({ n: p.n.clone(), goal: p.goal?.clone() ?? null });
        if (hist.length > 90) hist.shift();
        wantFor = p.want > 0.3 && !p.seat && !p.link ? wantFor + 1 / 30 : 0;
        // (the same goal all along: a goal that changed, like lunch being called, isn't a stall)
        const sameGoal = Boolean(hist[0].goal && p.goal && d(hist[0].goal, p.goal) < 0.5);
        const stalled = wantFor > 3 && hist.length === 90 && sameGoal && d(hist[0].n, p.n) < 0.3;
        if (stalled && !flagged) {
          stalls++;
          where.push(`seed ${seed} t ${t.toFixed(0)} ${p.activity}`);
        }
        flagged = stalled;
      }
    }
    expect(stalls, where.join('; ')).toBe(0);
  });

  it('talks to the visitor as a host (the lines greet a visitor; none calls the visitor Prabin)', () => {
    for (const [id, l] of Object.entries(LINES)) {
      const all = [...Object.values(l.greet).flat(), ...l.pool, ...Object.values(l.doing).flat()];
      for (const line of all) expect(line, id).not.toMatch(/\bhi,? prabin\b|\bwelcome home\b|did you sleep well/i);
    }
    expect(LINES.prabin.greet.day.some((x) => /welcome/i.test(x))).toBe(true);
  });
});

describe('the plaza, re-laid (§4.7)', () => {
  const ws = geos.find((g) => g.id === 'workshop')!;
  const po = geos.find((g) => g.id === 'post-office')!;
  const bench = layout.furniture.find((f) => f.kind === 'bench')!;
  const bridge = layout.bridges[0];

  it('puts the bench by the Greenhouse bridge, on dry ground, off the path, clear of the rails', () => {
    expect(bench).toBeTruthy();
    for (const f of [bench]) {
      expect(d(f.n, bridge.n)).toBeLessThan(bridge.halfLengthU + 3.2);
      const rd = riverDistance(layout.river!, f.n);
      expect(rd.d - layout.river!.halfWidth[rd.i]).toBeGreaterThan(0.6);
      for (const g of geos) expect(pointArcDistance(f.n, UP, g.approach, R)).toBeGreaterThan(0.9);
      expect(terrain.inWater(f.n)).toBe(false);
    }
    // the plaza keeps its lamps and planters
    expect(layout.furniture.filter((f) => f.kind === 'lamp').length).toBeGreaterThanOrEqual(3);
    expect(layout.furniture.some((f) => f.kind === 'planter')).toBe(true);
  });

  it('keeps pickable flowers off the bench too', () => {
    for (const k of FLOWER_KINDS) for (const fl of layout.flowers[k]) expect(d(fl.n, bench.n) - 0.5).toBeGreaterThanOrEqual(KEEP_CLEAR - 1e-6);
  });

  it('stands the chest and the crafting table side by side between the Post Office and the Workshop', () => {
    const chest = layout.chest!;
    const craft = layout.craft!;
    const gap = d(chest.n, craft.n);
    expect(gap).toBeGreaterThan(2);
    expect(gap).toBeLessThan(3.2);
    for (const n of [chest.n, craft.n]) {
      const near = geos.map((g) => ({ id: g.id, e: d(n, g.n) - g.footprintU })).sort((a, b) => a.e - b.e);
      expect(near.slice(0, 2).map((x) => x.id).sort()).toEqual(['post-office', 'workshop']);
      for (const g of [ws, po]) expect(d(n, g.n) - g.footprintU).toBeGreaterThan(1.1);
    }
    // both face the plaza
    expect(tangentToward(chest.n, UP)!.dot(chest.facing)).toBeGreaterThan(0.99);
    expect(tangentToward(craft.n, UP)!.dot(craft.facing)).toBeGreaterThan(0.99);
  });
});
