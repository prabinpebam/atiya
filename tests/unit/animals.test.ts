import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { CONFIG } from '../../src/game/config';
import { landmarkGeometry } from '../../src/game/math/landmarks';
import { UP, arcDistance, moveAlong, tangentToward } from '../../src/game/math/sphere';
import { riverDistance } from '../../src/game/world/features';
import { generateProps } from '../../src/game/world/layout';
import { Terrain } from '../../src/game/world/terrain';
import { WILD, createWildlife, meadowSpots, stepWildlife, type WildEnv, type Wildlife } from '../../src/game/world/animals';
import { FIXTURE_LANDMARKS } from './fixtures';

const R = CONFIG.planetRadius;
const geos = FIXTURE_LANDMARKS.map((l) => landmarkGeometry(l));
const layout = generateProps(geos);
const terrain = new Terrain(geos, layout);

function world(player = UP.clone() as Vector3, night = 0): { env: WildEnv; w: Wildlife } {
  const env: WildEnv = {
    player,
    night,
    obstacles: [...geos.map((g) => ({ n: g.n, radiusU: g.footprintU })), ...layout.obstacles],
    inWater: (n) => terrain.inWater(n),
    pond: layout.pond ? { n: layout.pond.n, shore: (n) => terrain.pondShore(n) } : null,
    river: layout.river,
  };
  const spots = meadowSpots(env, layout.grass.map((g) => g.n), UP as Vector3);
  return { env, w: createWildlife(env, spots) };
}

/** A point `u` away from `n` (in some direction). */
const near = (n: Vector3, u: number) => moveAlong(n, tangentToward(n, UP as Vector3) ?? new Vector3(1, 0, 0), u / R);
const run = (w: Wildlife, env: WildEnv, seconds: number, each?: () => void) => {
  for (let t = 0; t < seconds; t += 1 / 30) {
    stepWildlife(w, env, 1 / 30);
    each?.();
  }
};
const d = (a: Vector3, b: Vector3) => arcDistance(a, b, R);

describe('wildlife', () => {
  it('populates the meadows, the pond and the stream', () => {
    const { w } = world();
    expect(w.rabbits.length).toBe(4);
    expect(w.duck).not.toBeNull();
    expect(w.ducklings.length).toBe(4);
    expect(w.fish.filter((f) => !f.stream).length).toBe(5);
    expect(w.fish.filter((f) => f.stream).length).toBe(4);
    expect(w.birds.length).toBe(7);
  });

  it('rabbits graze and hop about their patch, never into water or obstacles', () => {
    const { w, env } = world(new Vector3(0, -1, 0)); // the character far away
    let hops = 0;
    const was = w.rabbits.map((r) => r.n.clone());
    run(w, env, 90, () => {
      for (const r of w.rabbits) {
        expect(terrain.inWater(r.n)).toBe(false);
        if (r.hop > 0) hops++;
      }
    });
    expect(hops).toBeGreaterThan(20);
    w.rabbits.forEach((r, i) => expect(d(r.n, was[i])).toBeLessThan(WILD.rabbit.range + 2.5));
  });

  it('a rabbit freezes upright when the character is near, and bolts when it is close', () => {
    const { w, env } = world();
    const r = w.rabbits[0];
    r.state = 'graze';
    env.player = near(r.n, 3.2);
    run(w, env, 0.4);
    expect(r.state).toBe('alert');
    expect(r.upright).toBe(true);
    env.player = near(r.n, 1.4);
    const before = d(r.n, env.player);
    run(w, env, 2.5);
    expect(['flee', 'alert']).toContain(r.state);
    expect(d(r.n, env.player)).toBeGreaterThan(before + 1.5);
  });

  it('the duck paddles about the pond, the ducklings follow in a line, and she swims off from the character', () => {
    const { w, env } = world(new Vector3(0, -1, 0));
    const duck = w.duck!;
    const pond = layout.pond!;
    run(w, env, 120, () => {
      expect(d(duck.n, pond.n)).toBeLessThan(terrain.pondShore(duck.n) + 0.05);
      w.ducklings.forEach((k, i) => expect(d(k.n, i === 0 ? duck.n : w.ducklings[i - 1].n)).toBeLessThan(1.2));
    });
    env.player = near(duck.n, 1.6);
    const before = d(duck.n, env.player);
    run(w, env, 3);
    expect(duck.state).toBe('flee');
    expect(d(duck.n, env.player)).toBeGreaterThan(before);
  });

  it('fish stay in the water; stream fish face upstream; all dart from a close character', () => {
    const { w, env } = world(new Vector3(0, -1, 0));
    run(w, env, 60, () => {
      for (const f of w.fish) expect(terrain.inWater(f.n), f.stream ? 'stream fish' : 'pond fish').toBe(true);
    });
    const river = layout.river!;
    for (const f of w.fish.filter((k) => k.stream)) {
      const downstream = river.tangent[riverDistance(river, f.n).i];
      expect(f.dir.dot(downstream)).toBeLessThan(-0.5);
    }
    const f = w.fish.find((k) => !k.stream)!;
    env.player = near(f.n, 1.0);
    run(w, env, 0.2);
    expect(f.state).toBe('dart');
  });

  it('ground birds take off when approached, fly as a flock in the air, and land again away from the character', () => {
    const { w, env } = world(new Vector3(0, -1, 0));
    const b = w.birds.find((k) => k.state === 'peck')!;
    env.player = near(b.n, 1.5);
    run(w, env, 1);
    expect(b.state).toBe('fly');
    expect(b.alt).toBeGreaterThan(0.5);
    env.player = new Vector3(0, -1, 0);
    let landed = 0;
    run(w, env, 90, () => {
      for (const k of w.birds) if (k.state === 'fly') expect(k.alt).toBeLessThan(WILD.bird.maxAlt + 1.5);
    });
    for (const k of w.birds) if (k.state === 'peck') landed++;
    expect(landed).toBeGreaterThan(0);
  });

  it('birds roost at night: they stay put', () => {
    const { w, env } = world(new Vector3(0, -1, 0), 1);
    const was = w.birds.map((b) => b.n.clone());
    run(w, env, 5);
    w.birds.forEach((b, i) => expect(b.n.distanceTo(was[i])).toBe(0));
  });
});
