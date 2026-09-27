import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { CONFIG } from '../../src/game/config';
import { landmarkGeometry } from '../../src/game/math/landmarks';
import { arcDistance } from '../../src/game/math/sphere';
import { DuckFeed, FEED, landingSpot } from '../../src/game/systems/duckFeed';
import { benchSeats, seatInRange, SEAT } from '../../src/game/systems/seating';
import { createWildlife, stepWildlife, type WildEnv } from '../../src/game/world/animals';
import { FLOWER_KINDS, generateProps } from '../../src/game/world/layout';
import { Terrain } from '../../src/game/world/terrain';
import { POND_BENCH } from '../../src/game/world/homestead';
import { homeSeats } from '../../src/game/world/home/seats';
import { Family, type FamilyWorld } from '../../src/game/world/home/family';
import { BENCH } from '../../src/game/world/parts';
import { UP } from '../../src/game/math/sphere';
import { FIXTURE_LANDMARKS } from './fixtures';

const R = CONFIG.planetRadius;
const geos = FIXTURE_LANDMARKS.map((l) => landmarkGeometry(l));
const layout = generateProps(geos);
const terrain = new Terrain(geos, layout);
const home = layout.home!;
const pond = layout.pond!;
const pondLike = { n: pond.n, shore: (n: Vector3) => terrain.pondShore(n) };
const d = (a: Vector3, b: Vector3) => arcDistance(a, b, R);
const obstacles = [...geos.map((g) => ({ n: g.n, radiusU: g.footprintU })), ...layout.obstacles];
const seat = benchSeats(layout.furniture).find((s) => s.byPond)!;

describe('the pond bench', () => {
  it('stands on the dry bank facing the water, clear of everything else', () => {
    const b = layout.furniture.find((f) => f.byPond)!;
    expect(b.kind).toBe('bench');
    expect(terrain.inWater(b.n)).toBe(false);
    const gap = d(b.n, pond.n) - terrain.pondShore(b.n);
    expect(gap).toBeGreaterThan(0.9);
    expect(gap).toBeLessThan(2);
    // facing the pond
    const toPond = pond.n.clone().sub(b.n).addScaledVector(b.n, -pond.n.clone().sub(b.n).dot(b.n)).normalize();
    expect(b.facing.dot(toPond)).toBeGreaterThan(0.95);
    const own = obstacles.filter((o) => o.n.distanceTo(b.n) > 1e-9);
    for (const o of own) expect(d(b.n, o.n) - o.radiusU, 'clear of other obstacles').toBeGreaterThan(0.5);
  });

  it('seats the visitor on one side and the family on the other, at the bench’s height', () => {
    expect(seat).toBeTruthy();
    const fam = homeSeats(home, R).find((s) => s.id === 'pond')!;
    expect(fam.kind).toBe('bench');
    expect(fam.height).toBeCloseTo(BENCH.seatTop, 6);
    expect(d(seat.sit, fam.spot.n)).toBeGreaterThan(2 * POND_BENCH.side - 0.1);
    // the visitor's seat is offered from in front of the bench, as on the others
    expect(seatInRange(seat.stand, [seat], null)).toBe(seat.id);
    expect(d(seat.stand, seat.n)).toBeLessThan(SEAT.enterU);
    // the family's entry points are outside the bench's collision circle
    const bench = obstacles.find((o) => o.n.distanceTo(seat.n) < 1e-9)!;
    for (const e of fam.entries) expect(d(e.n, bench.n) - bench.radiusU).toBeGreaterThan(0.2);
  });
});

describe('feeding the ducks', () => {
  it('tosses the crumbs well inside the water, in front of the bench', () => {
    for (const j of [
      [0, 0],
      [1, 1],
      [-1, -1],
      [1, -1],
    ] as [number, number][]) {
      const to = landingSpot(seat.sit, pondLike, R, j);
      expect(terrain.inWater(to)).toBe(true);
      expect(terrain.pondShore(to) - d(to, pond.n)).toBeGreaterThan(0.45);
      expect(d(to, seat.sit)).toBeLessThan(3.2);
    }
  });

  it('draws the ducks for a while, a handful at a time', () => {
    const f = new DuckFeed();
    expect(f.toss('visitor', seat.sit, pondLike, R)).toBe(true);
    expect(f.spot).toBeTruthy();
    expect(f.toss('visitor', seat.sit, pondLike, R)).toBe(false);
    f.step(FEED.cooldown);
    expect(f.toss('visitor', seat.sit, pondLike, R)).toBe(true);
    expect(f.toss('laija', seat.sit, pondLike, R)).toBe(true);
    for (let t = 0; t < FEED.lure + 1; t += 0.5) f.step(0.5);
    expect(f.spot).toBeNull();
    expect(f.tosses.length).toBe(0);
  });

  it('brings the duck over to the crumbs, calm with the visitor sitting on the bench', () => {
    const env: WildEnv = {
      player: seat.sit.clone(),
      night: 0,
      obstacles,
      inWater: (n) => terrain.inWater(n),
      pond: pondLike,
      river: layout.river,
      calm: true,
      feed: null,
    };
    const w = createWildlife(env, []);
    const duck = w.duck!;
    // she starts on the far side
    duck.n.copy(pond.n).lerp(seat.sit, -0.25).normalize();
    const spot = landingSpot(seat.sit, pondLike, R);
    env.feed = spot;
    for (let t = 0; t < 25; t += 1 / 30) {
      stepWildlife(w, env, 1 / 30);
      expect(duck.state).not.toBe('flee');
      expect(terrain.inWater(duck.n)).toBe(true);
    }
    expect(duck.state).toBe('feed');
    expect(d(duck.n, spot)).toBeLessThan(0.45);
    // the ducklings came too
    for (const k of w.ducklings) expect(d(k.n, spot)).toBeLessThan(1.5);
    // and a visitor walking up still sends her off
    env.calm = false;
    env.player.copy(duck.n);
    stepWildlife(w, env, 1 / 30);
    expect(duck.state).toBe('flee');
  });
});

describe('the family feed the ducks too', () => {
  it('sits on their end of the bench and tosses a handful every few seconds', () => {
    const w: FamilyWorld = {
      hours: 12,
      others: [],
      pond: { n: pond.n, shore: (n) => terrain.pondShore(n) },
      R,
      home,
      player: UP.clone(),
      obstacles,
      blocked: (n) => d(n, pond.n) < terrain.pondShore(n) + 0.05 || terrain.waterDepth(n) > 0.12,
      rabbits: [],
      flowers: FLOWER_KINDS.flatMap((k) => layout.flowers[k].map((f) => f.n)).filter((n) => d(n, home.centre) < home.range),
      planet: { spawn: UP.clone(), landmarks: geos.map((g) => ({ id: g.id, n: g.n, approach: g.approach, footprintU: g.footprintU })), craft: null, bridges: [] },
    };
    const f = new Family(home, R, () => 0.5);
    const npc = f.get('rojina');
    f.force(npc, 'ducks', 0);
    npc.dur = 60;
    let feeds = 0;
    let seated = false;
    for (let t = 0; t < 40; t += 1 / 30) {
      f.step(1 / 30, w);
      for (const e of f.events.splice(0)) if (e.type === 'feed' && e.id === 'rojina') feeds++;
      if (npc.seat?.phase === 'on' && npc.seat.seat.id === 'pond') seated = true;
    }
    expect(seated).toBe(true);
    expect(feeds).toBeGreaterThanOrEqual(3);
  });
});
