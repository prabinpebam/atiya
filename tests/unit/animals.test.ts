import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { CONFIG } from '../../src/game/config';
import { landmarkGeometry } from '../../src/game/math/landmarks';
import { UP, arcDistance, moveAlong, tangentToward } from '../../src/game/math/sphere';
import { riverDistance } from '../../src/game/world/features';
import { generateProps } from '../../src/game/world/layout';
import { Terrain } from '../../src/game/world/terrain';
import { RABBIT_COATS, WILD, createWildlife, meadowSpots, stepWildlife, type WildEnv, type Wildlife } from '../../src/game/world/animals';
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
    nest: layout.home?.duckNest.n ?? null,
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
    // four adults (three of them mothers) and five kits
    expect(w.rabbits.length).toBe(9);
    expect(w.rabbits.filter((r) => !r.mum)).toHaveLength(4);
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

  it('rabbits come in four coats, and three mothers have kits in their own coat, beside her', () => {
    const { w } = world();
    const adults = w.rabbits.filter((r) => !r.mum);
    expect(new Set(adults.map((r) => r.coat))).toEqual(new Set(RABBIT_COATS));
    const kits = w.rabbits.filter((r) => r.mum);
    expect(kits).toHaveLength(5);
    expect(new Set(kits.map((k) => k.mum))).toHaveProperty('size', 3);
    for (const k of kits) {
      expect(k.coat).toBe(k.mum!.coat);
      expect(adults).toContain(k.mum);
      expect(d(k.n, k.mum!.n)).toBeLessThan(0.4);
    }
    // each kit has its own place and its own lag, so they don't move as one
    expect(new Set(kits.map((k) => k.side.toFixed(3))).size).toBe(kits.length);
    expect(new Set(kits.map((k) => k.lag.toFixed(3))).size).toBe(kits.length);
  });

  it('kits hop along with their mother, a beat behind, never far from her and never into water', () => {
    const { w, env } = world(new Vector3(0, -1, 0));
    const kits = w.rabbits.filter((r) => r.mum);
    const start = kits.map((k) => k.mum!.n.clone());
    let far = 0;
    let kitHops = 0;
    let mumHops = 0;
    // (a kit hops only once its mother has gone on: count the frames each starts a hop)
    const was = w.rabbits.map((r) => r.hop);
    run(w, env, 120, () => {
      w.rabbits.forEach((r, i) => {
        if (was[i] < 0 && r.hop >= 0) r.mum ? kitHops++ : w.rabbits.some((k) => k.mum === r) && mumHops++;
        was[i] = r.hop;
      });
      for (const k of kits) {
        expect(terrain.inWater(k.n)).toBe(false);
        far = Math.max(far, d(k.n, k.mum!.n));
      }
    });
    expect(mumHops).toBeGreaterThan(10);
    // (a kit's hops are shorter, so it makes more of them)
    expect(kitHops).toBeGreaterThan(mumHops);
    expect(far).toBeLessThan(WILD.kit.wait + 0.5);
    // the mothers really went somewhere, with their kits
    expect(kits.some((k, i) => d(k.mum!.n, start[i]) > 0.5)).toBe(true);
    for (const k of kits) expect(d(k.n, k.mum!.n)).toBeLessThan(WILD.kit.wait + 0.2);
  });

  it('a mother bolts from the character and her kits bolt with her', () => {
    const { w, env } = world();
    const mum = w.rabbits[0];
    const kits = w.rabbits.filter((k) => k.mum === mum);
    expect(kits.length).toBe(2);
    env.player = near(mum.n, 1.4);
    const before = kits.map((k) => d(k.n, env.player));
    let fled = false;
    run(w, env, 3, () => {
      if (mum.state === 'flee' && kits.every((k) => k.state === 'flee' || k.hop >= 0)) fled = true;
    });
    expect(fled).toBe(true);
    kits.forEach((k, i) => expect(d(k.n, env.player)).toBeGreaterThan(before[i] + 1));
    // and once she stops, they gather round her again
    env.player = new Vector3(0, -1, 0);
    run(w, env, 8);
    for (const k of kits) expect(d(k.n, mum.n)).toBeLessThan(0.6);
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

  it('the ducklings weave along behind her, each at its own distance and side, and now and then stop to peck', () => {
    // (the character across the planet from the pond, so nothing startles them)
    const { w, env } = world(layout.pond!.n.clone().negate());
    const duck = w.duck!;
    const side = w.ducklings.map(() => [] as number[]);
    let dawdles = 0;
    run(w, env, 120, () => {
      let lead: { n: Vector3; dir: Vector3 } = duck;
      w.ducklings.forEach((k, i) => {
        const off = tangentToward(lead.n, k.n);
        if (off) side[i].push(new Vector3().crossVectors(lead.n, lead.dir).dot(off));
        if (k.dawdle > 0 && k.peck > 0.5) dawdles++;
        lead = k;
      });
    });
    // not a straight line: each one strays to the sides (both ways) by a clear margin
    for (const s of side) {
      expect(Math.max(...s)).toBeGreaterThan(0.15);
      expect(Math.min(...s)).toBeLessThan(-0.15);
    }
    // their own distances behind
    expect(new Set(w.ducklings.map((k) => k.gap.toFixed(3))).size).toBe(w.ducklings.length);
    expect(dawdles).toBeGreaterThan(0);
  });

  it('at night the duck leads the ducklings up the bank to their nest and sleeps; in the morning they swim again', () => {
    const { w, env } = world(layout.pond!.n.clone().negate());
    const duck = w.duck!;
    const nest = layout.home!.duckNest.n;
    const pond = layout.pond!;
    run(w, env, 20);
    env.night = 1;
    run(w, env, 90);
    expect(duck.state).toBe('nest');
    expect(d(duck.n, nest)).toBeLessThan(0.06);
    expect(duck.rest).toBeGreaterThan(0.9);
    expect(terrain.inWater(duck.n)).toBe(false);
    for (const k of w.ducklings) expect(d(k.n, nest)).toBeLessThan(0.3);
    // asleep, she sits tight even when the character walks by
    env.player = near(nest, 1.2);
    run(w, env, 5);
    expect(duck.state).toBe('nest');
    // morning: back into the water, and paddling about again
    env.night = 0;
    env.player = layout.pond!.n.clone().negate();
    run(w, env, 40);
    expect(duck.state).not.toBe('nest');
    expect(d(duck.n, pond.n)).toBeLessThan(terrain.pondShore(duck.n) - 0.3);
    expect(duck.rest).toBeLessThan(0.05);
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
