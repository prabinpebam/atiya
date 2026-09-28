import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { CONFIG } from '../../src/game/config';
import { landmarkGeometry } from '../../src/game/math/landmarks';
import { UP, arcDistance, moveAlong, pointArcDistance, tangentToward } from '../../src/game/math/sphere';
import { Inventory } from '../../src/game/inventory/inventory';
import { BLOOM_COLOURS, ITEMS, type ItemId } from '../../src/game/inventory/items';
import { ICONS } from '../../src/game/inventory/iconManifest';
import { CHEST_RADIUS, CRAFT_RADIUS, FURNACE_GAP, FURNACE_RADIUS, KEEP_CLEAR, KEEP_SOLID, generateProps } from '../../src/game/world/layout';
import { Terrain } from '../../src/game/world/terrain';
import { buildTargets, pickTarget } from '../../src/game/systems/interactables';
import { benchSeats } from '../../src/game/systems/seating';
import { FURNACE_NEEDS, FURNACE_R, RECIPES, SMELTING, TARGET_REACH, craft, listNeeds, maxCraftable, missing, recipeById, takeNeeds } from '../../src/game/world/craft/recipes';
import { CLAY, clayBeds } from '../../src/game/world/craft/clay';
import { FURNACE_BASE } from '../../src/game/world/craft/furnaceModels';
import { padSpec } from '../../src/game/world/groundPads';
import { FIXTURE_LANDMARKS } from './fixtures';

// the furnace, clay, stone blocks, firewood and iron ingots (furnace.md)
const R = CONFIG.planetRadius;
const geos = FIXTURE_LANDMARKS.map((l) => landmarkGeometry(l));
const layout = generateProps(geos);
const terrain = new Terrain(geos, layout);
const d = (a: Vector3, b: Vector3) => arcDistance(a, b, R);
const inv = (items: Array<[ItemId, number]> = []) => {
  const x = new Inventory();
  for (const [id, n] of items) x.add(id, n);
  return x;
};
const targets = buildTargets(layout, benchSeats(layout.furniture), layout.chest, BLOOM_COLOURS.length);
const obstacles = [...layout.obstacles, ...geos.map((g) => ({ n: g.n, radiusU: g.footprintU }))];
const paths = geos.map((g) => [UP, g.approach] as const);
const beds = clayBeds(
  {
    river: layout.river,
    pond: layout.pond,
    inWater: (n) => terrain.inWater(n),
    pondShore: (n) => terrain.pondShore(n),
    height: (n) => terrain.height(n),
    obstacles,
    targets,
    bridges: layout.bridges,
    mesas: layout.mesas,
    paths,
    clear: layout.home?.clear ?? [],
    landmarks: geos,
  },
  R,
);

describe('the furnace: materials and recipes (furnace.md §4.1)', () => {
  it('has clay, stone blocks, firewood and iron ingots, each with an icon from the golden set', () => {
    for (const id of ['clay', 'block', 'firewood', 'ingot'] as const) {
      const def = ITEMS.get(id)!;
      expect(def, id).toBeTruthy();
      expect(ICONS[def.icon]?.url, id).toMatch(/\.webp$/);
    }
    expect(ITEMS.get('block')!.name).toBe('Stone block');
    expect(ITEMS.get('ingot')!.name).toBe('Iron ingot');
  });

  it('makes a stone block from 3 stones, 3 firewood from a log, and nails only from an iron ingot', () => {
    expect(recipeById('block')).toMatchObject({ out: 'block', yield: 1, needs: [{ any: ['stone'], n: 3 }] });
    expect(recipeById('firewood')).toMatchObject({ out: 'firewood', yield: 3, needs: [{ any: ['log'], n: 1 }] });
    expect(recipeById('nails')).toMatchObject({ out: 'nails', yield: 6, needs: [{ any: ['ingot'], n: 1 }] });
    // iron ore makes nothing at the table: only the furnace takes it
    for (const r of RECIPES) for (const n of r.needs) expect(n.any, r.id).not.toContain('iron');
    expect(maxCraftable(inv([['iron', 5]]), recipeById('nails')!)).toBe(0);
  });

  it('smelts one iron ore and one firewood into an ingot, in bulk, and nothing without the fuel', () => {
    expect(SMELTING.map((r) => r.id)).toEqual(['ingot']);
    const ingot = SMELTING[0];
    expect(ingot).toMatchObject({ out: 'ingot', yield: 1, needs: [{ any: ['iron'], n: 1 }, { any: ['firewood'], n: 1 }] });
    const x = inv([
      ['iron', 3],
      ['firewood', 2],
    ]);
    expect(maxCraftable(x, ingot)).toBe(2);
    expect(craft(x, ingot, 2)).toEqual({ made: 2, left: 0 });
    expect([x.count('iron'), x.count('firewood'), x.count('ingot')]).toEqual([1, 0, 2]);
    expect(maxCraftable(inv([['iron', 3]]), ingot)).toBe(0);
  });

  it('builds from 6 stone blocks and 4 clay, taking exactly those', () => {
    expect(FURNACE_NEEDS).toEqual([
      { id: 'block', n: 6 },
      { id: 'clay', n: 4 },
    ]);
    const x = inv([
      ['block', 6],
      ['clay', 3],
    ]);
    expect(missing(x, FURNACE_NEEDS)).toEqual([{ id: 'clay', n: 4, have: 3 }]);
    expect(takeNeeds(x, FURNACE_NEEDS)).toBe(false);
    x.add('clay', 2);
    expect(takeNeeds(x, FURNACE_NEEDS)).toBe(true);
    expect([x.count('block'), x.count('clay')]).toEqual([0, 1]);
    // "clay" and "firewood" don't take an s
    expect(listNeeds([...FURNACE_NEEDS, { id: 'firewood', n: 2 }])).toBe('6 stone blocks, 4 clay and 2 firewood');
  });
});

describe("the furnace's spot behind the workyard (furnace.md §4.2)", () => {
  const f = layout.furnace!;
  const chest = layout.chest!;
  const table = layout.craft!;

  it('stands behind the chest and the table (farther from the plaza), with room to walk between them', () => {
    expect(f).toBeTruthy();
    expect(FURNACE_R).toBe(FURNACE_RADIUS);
    const centre = chest.n.clone().add(table.n).normalize();
    expect(d(f.n, UP)).toBeGreaterThan(d(centre, UP) + 1.5);
    expect(d(f.n, chest.n)).toBeGreaterThanOrEqual(FURNACE_GAP - 1e-6);
    expect(d(f.n, table.n)).toBeGreaterThanOrEqual(FURNACE_GAP - 1e-6);
    // edge to edge, wide enough for two to pass
    expect(d(f.n, chest.n) - FURNACE_RADIUS - CHEST_RADIUS).toBeGreaterThan(1.2);
    expect(d(f.n, table.n) - FURNACE_RADIUS - CRAFT_RADIUS).toBeGreaterThan(1.2);
    // it faces the yard
    const toYard = tangentToward(f.n, centre)!;
    expect(f.facing.dot(toYard)).toBeGreaterThan(0.99);
  });

  it('is off every path, on dry ground, and nothing solid stands where it will', () => {
    for (const g of geos) expect(pointArcDistance(f.n, UP, g.approach, R), `off the path to ${g.id}`).toBeGreaterThan(FURNACE_RADIUS + 0.9 - 1e-6);
    for (const g of geos) expect(d(f.n, g.n) - g.footprintU, g.id).toBeGreaterThan(FURNACE_RADIUS + 0.8 - 1e-6);
    expect(terrain.inWater(f.n)).toBe(false);
    for (const o of layout.obstacles) expect(d(o.n, f.n) - o.radiusU - FURNACE_RADIUS, `obstacle at ${o.n.toArray()}`).toBeGreaterThan(0.3);
  });

  it('stands on its own pad: the ground under its base is one plane, however the land rolls', () => {
    const t = new Terrain(geos, layout);
    t.addPads([padSpec('furnace', f, FURNACE_BASE, { skirt: 0.6, apron: 0.4 })]);
    const z = f.facing;
    const x = new Vector3().crossVectors(f.n, z).normalize();
    const at = (lx: number, lz: number) => moveAlong(moveAlong(f.n, x, lx / R), z, lz / R);
    // (in 3D: the ground's points under the base's corners and middle all lie on one plane)
    const p3 = (lx: number, lz: number) => {
      const n = at(lx, lz);
      return n.multiplyScalar(R + t.height(n));
    };
    const [x0, x1, z0, z1] = FURNACE_BASE;
    const [a, b, c] = [p3(x0, z0), p3(x1, z0), p3(x0, z1)];
    const normal = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).normalize();
    for (const [lx, lz] of [[x1, z1], [0, 0], [x1, 0], [0, z1]]) expect(Math.abs(p3(lx, lz).sub(a).dot(normal)), `${lx},${lz}`).toBeLessThan(0.01);
  });

  it('keeps flowers and solids clear of it (a special target)', () => {
    for (const t of targets) {
      const gap = d(t.n, f.n) - FURNACE_RADIUS - t.edgeU;
      if (t.kind === 'flower') expect(gap, t.key).toBeGreaterThanOrEqual(KEEP_CLEAR - 1e-6);
      if (t.kind === 'tree' || t.kind === 'boulder') expect(gap, t.key).toBeGreaterThanOrEqual(KEEP_SOLID - 0.25);
    }
  });
});

describe('the clay beds on the banks (furnace.md §4.3)', () => {
  it('finds two by the stream and two by the pond', () => {
    expect(beds.filter((b) => b.water === 'stream')).toHaveLength(CLAY.perWater);
    expect(beds.filter((b) => b.water === 'pond')).toHaveLength(CLAY.perWater);
  });

  it('each is on dry bank ground a step from the water, facing it, and level enough to dig', () => {
    for (const b of beds) {
      expect(terrain.inWater(b.n)).toBe(false);
      // the water is just in front of it
      const wet = [0.3, 0.5, 0.7, 0.9, 1.1].some((s) => terrain.inWater(moveAlong(b.n, b.facing, s / R)));
      expect(wet, `water in front of ${b.n.toArray()}`).toBe(true);
    }
  });

  it('is out of the way: off the paths and bridges, clear of every obstacle, flower and target, and well apart', () => {
    for (const b of beds) {
      for (const [a, c] of paths) expect(pointArcDistance(b.n, a, c, R)).toBeGreaterThan(CLAY.radiusU + 0.8 - 1e-6);
      for (const br of layout.bridges) expect(d(b.n, br.n)).toBeGreaterThan(br.halfLengthU + 1.4 - 1e-6);
      for (const o of obstacles) if (o.radiusU > 0) expect(d(b.n, o.n) - o.radiusU).toBeGreaterThan(CLAY.radiusU + 0.5 - 1e-6);
      for (const t of targets) expect(d(b.n, t.n) - t.edgeU, t.key).toBeGreaterThan(CLAY.radiusU + 0.85 - 1e-6);
      // out of every building's preview area (where E would open its card instead)
      for (const g of geos) expect(d(b.n, g.n), g.id).toBeGreaterThan(g.exitU + 0.6 - 1e-6);
      for (const c of beds) if (c !== b) expect(d(b.n, c.n)).toBeGreaterThanOrEqual(CLAY.apart - 1e-6);
    }
  });
});

describe('the furnace and the clay beds take E only for themselves (design system §6.5)', () => {
  it('standing at the furnace or a clay bed, from any side, facing it, offers only it', () => {
    const f = layout.furnace!;
    const extra = [
      { kind: 'site' as const, key: 'site:furnace', n: f.n, edgeU: FURNACE_RADIUS, reachU: TARGET_REACH.site, standU: FURNACE_RADIUS + 0.5, index: 0, scale: 1 },
      { kind: 'craft' as const, key: 'craft', n: layout.craft!.n, edgeU: CRAFT_RADIUS, reachU: TARGET_REACH.table, standU: CRAFT_RADIUS + 0.45, index: 0, scale: 1 },
      ...beds.map((b, i) => ({ kind: 'clay' as const, key: `clay:${i}`, n: b.n, edgeU: CLAY.radiusU, reachU: CLAY.reach, standU: CLAY.radiusU + 0.4, index: i, scale: 1 })),
    ];
    const all = [...targets, ...extra];
    for (const sp of [extra[0], ...extra.slice(2)]) {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const dir = tangentToward(sp.n, new Vector3(Math.cos(a), 0.3, Math.sin(a)).normalize())!;
        const p = moveAlong(sp.n, dir, (sp.edgeU + CONFIG.playerRadius + 0.15) / R);
        if (terrain.inWater(p)) continue;
        const t = pickTarget(p, tangentToward(p, sp.n)!, all, null, () => true, R, false);
        expect(t?.key, `${sp.key} from ${k}`).toBe(sp.key);
      }
    }
  });
});
