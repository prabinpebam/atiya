/** The vegetable garden (docs: family.md §3.2): the plants, the one watering can, drying, and the family watering. */
import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { CONFIG } from '../../src/game/config';
import { landmarkGeometry } from '../../src/game/math/landmarks';
import { UP, arcDistance } from '../../src/game/math/sphere';
import { FLOWER_KINDS, generateProps } from '../../src/game/world/layout';
import { Terrain } from '../../src/game/world/terrain';
import { YARD } from '../../src/game/world/homestead';
import { FAMILY, Family, type FamilyWorld } from '../../src/game/world/home/family';
import { GARDEN, Garden, gardenPlants, pourTilt, pouring } from '../../src/game/world/home/garden';
import { FIXTURE_LANDMARKS } from './fixtures';

const R = CONFIG.planetRadius;
const geos = FIXTURE_LANDMARKS.map((l) => landmarkGeometry(l));
const layout = generateProps(geos);
const terrain = new Terrain(geos, layout);
const home = layout.home!;
const obstacles = [...geos.map((g) => ({ n: g.n, radiusU: g.footprintU })), ...layout.obstacles];
const d = (a: Vector3, b: Vector3) => arcDistance(a, b, R);
const seeded = (s: number) => () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;

function world(garden: Garden, player = new Vector3(0, 1, 0)): FamilyWorld {
  const pond = layout.pond!;
  return {
    hours: 12,
    others: [],
    pond: { n: pond.n, shore: (n) => terrain.pondShore(n) },
    R,
    home,
    player,
    obstacles,
    blocked: (n) => d(n, pond.n) < terrain.pondShore(n) + 0.05 || terrain.waterDepth(n) > 0.12,
    rabbits: [],
    flowers: FLOWER_KINDS.flatMap((k) => layout.flowers[k].map((f) => f.n)).filter((n) => d(n, home.centre) < home.range),
    planet: {
      spawn: UP.clone(),
      landmarks: geos.map((g) => ({ id: g.id, n: g.n, approach: g.approach, footprintU: g.footprintU })),
      craft: layout.craft ? { n: layout.craft.n, facing: layout.craft.facing } : null,
      bridges: [],
    },
    garden,
  };
}

const run = (f: Family, w: FamilyWorld, seconds: number, each?: () => void) => {
  for (let t = 0; t < seconds; t += 1 / 30) {
    f.step(1 / 30, w);
    w.garden?.step(1 / 30);
    each?.();
  }
};

describe('vegetable garden: the plants', () => {
  const plants = gardenPlants(home, R);

  it('are the ones the bed models grow: eight cabbages in two rows, four tomato plants, each inside its bed', () => {
    expect(plants.filter((p) => p.kind === 'cabbage')).toHaveLength(8);
    expect(plants.filter((p) => p.kind === 'tomato')).toHaveLength(4);
    for (const p of plants) {
      const b = home.yard.beds[p.bed];
      const side = new Vector3().crossVectors(b.n, b.facing).normalize();
      const off = p.n.clone().sub(b.n);
      expect(Math.abs(off.dot(side) * R)).toBeLessThan(YARD.bedL / 2 - 0.1);
      expect(Math.abs(off.dot(b.facing) * R)).toBeLessThan(YARD.bedW / 2 - 0.1);
    }
  });

  it('can each be watered from both long sides of their bed: open ground, clear of the beds, the fence and the house', () => {
    for (const p of plants) {
      for (const s of p.stands) {
        for (const o of obstacles) expect(d(s.n, o.n) - o.radiusU, `plant ${p.i} stand vs obstacle`).toBeGreaterThan(FAMILY.radius);
        // facing the plant's bed, near enough to reach the plant
        expect(d(s.n, p.n)).toBeLessThan(0.9);
        const to = p.n.clone().sub(s.n);
        expect(to.dot(s.facing)).toBeGreaterThan(0);
      }
    }
  });

  it('are offered to the visitor from where they can stand (just clear of the beds), within the reach', () => {
    const beds = home.obstacles.filter((o) => home.yard.beds.some((b) => d(o.n, b.n) < 0.4));
    for (const p of plants) {
      // the closest the visitor gets to a plant from either side, clear of the beds' circles
      const best = Math.min(
        ...p.stands.map((s) => {
          const dir = s.n.clone().sub(p.n).normalize();
          for (let u = 0.2; u < 1.5; u += 0.01) {
            const q = p.n.clone().addScaledVector(dir, u / R).normalize();
            if (beds.every((o) => d(q, o.n) >= o.radiusU + CONFIG.playerRadius)) return u;
          }
          return Infinity;
        }),
      );
      expect(best, `plant ${p.i}`).toBeLessThan(0.1 + GARDEN.reachU);
    }
  });
});

describe('vegetable garden: the watering can and drying', () => {
  it('has one holder at a time, and goes back to its spot', () => {
    const g = new Garden(home, R, seeded(3));
    expect(g.take('visitor')).toBe(true);
    expect(g.take('rojina')).toBe(false);
    expect(g.take('visitor')).toBe(true);
    g.putBack();
    expect(g.holder).toBeNull();
    expect(g.take('prabin')).toBe(true);
  });

  it('starts thirsty; watered plants are full, then dry out over time and ask again', () => {
    const g = new Garden(home, R, seeded(7));
    expect(g.thirsty().length).toBeGreaterThan(3);
    g.water(0);
    expect(g.wet[0]).toBe(1);
    expect(g.thirsty()).not.toContain(0);
    for (let t = 0; t < GARDEN.dryS * (1 - GARDEN.thirsty) + 1; t += 1) g.step(1);
    expect(g.thirsty()).toContain(0);
    expect(Math.min(...g.wet)).toBeGreaterThanOrEqual(0);
  });

  it('pours: the can tips, the water falls while it is tipped, and the pour ends', () => {
    expect(pourTilt(0)).toBe(0);
    expect(pouring(GARDEN.wetAt)).toBe(true);
    expect(pourTilt(GARDEN.pourS)).toBeLessThan(0.05);
    const g = new Garden(home, R, seeded(1));
    g.pour(0, home.yard.wateringCan.n);
    expect(g.pours).toHaveLength(1);
    for (let t = 0; t < GARDEN.pourS + 0.1; t += 0.1) g.step(0.1);
    expect(g.pours).toHaveLength(0);
  });
});

describe('vegetable garden: Rojina and Prabin water it', () => {
  for (const who of ['rojina', 'prabin'] as const) {
    it(`${who} picks up the can, waters every thirsty plant one by one from beside its bed, and puts it back`, () => {
      const garden = new Garden(home, R, seeded(11));
      const f = new Family(home, R, seeded(5));
      const w = world(garden);
      const thirsty = garden.thirsty();
      expect(thirsty.length).toBeGreaterThan(3);
      f.hold(who, 'water', w);
      const npc = f.get(who);
      let held = false;
      let pours = 0;
      const pour = garden.pour.bind(garden);
      garden.pour = (i, from) => {
        pours++;
        // at the plant: beside its bed (never in it, never from afar)
        expect(d(from, garden.plants[i].n), `pour on plant ${i}`).toBeLessThan(1.0);
        expect(d(from, garden.plants[i].n)).toBeGreaterThan(0.5);
        pour(i, from);
      };
      run(f, w, 60, () => {
        if (garden.holder === who) held = true;
        if (npc.held === 'can') expect(garden.holder).toBe(who);
      });
      expect(held).toBe(true);
      expect(pours).toBeGreaterThanOrEqual(thirsty.length);
      for (const i of thirsty) expect(garden.wet[i], `plant ${i}`).toBeGreaterThan(0.5);
      // done: the can's back by the beds, and they've gone on to something else
      expect(garden.holder).toBeNull();
      expect(npc.held).not.toBe('can');
      expect(npc.activity).not.toBe('water');
    });
  }

  it('never takes the can while the visitor has it, or when the visitor is standing by it', () => {
    const garden = new Garden(home, R, seeded(2));
    const f = new Family(home, R, seeded(9));
    garden.take('visitor');
    const w = world(garden);
    run(f, w, 400, () => {
      for (const n of f.npcs) expect(n.activity).not.toBe('water');
      expect(garden.holder).toBe('visitor');
    });
    garden.putBack();
    const byCan = world(garden, garden.can.n.clone());
    const f2 = new Family(home, R, seeded(9));
    run(f2, byCan, 200, () => {
      for (const n of f2.npcs) expect(n.stage === 0 && n.activity === 'water').toBe(false);
    });
  });

  it('leaves the can back by the beds if called away mid-way (bedtime)', () => {
    const garden = new Garden(home, R, seeded(4));
    const f = new Family(home, R, seeded(5));
    const w = world(garden);
    f.hold('rojina', 'water', w);
    const npc = f.get('rojina');
    // until she's picked it up, and a moment into the watering
    for (let t = 0; t < 30 && garden.holder !== 'rojina'; t += 1 / 30) {
      f.step(1 / 30, w);
      garden.step(1 / 30);
    }
    run(f, w, 3);
    expect(garden.holder).toBe('rojina');
    expect(npc.held).toBe('can');
    w.hours = 21;
    run(f, w, 12);
    expect(npc.activity).not.toBe('water');
    expect(garden.holder).toBeNull();
    expect(npc.held).not.toBe('can');
  });
});
