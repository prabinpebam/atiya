import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { CONFIG } from '../../src/game/config';
import { landmarkGeometry } from '../../src/game/math/landmarks';
import { UP, arcDistance, moveAlong, pointArcDistance, tangentToward } from '../../src/game/math/sphere';
import { BACKPACK_SLOTS, HOTBAR, Inventory } from '../../src/game/inventory/inventory';
import { BLOOM_COLOURS, ITEMS, type ItemId } from '../../src/game/inventory/items';
import { ICONS } from '../../src/game/inventory/iconManifest';
import { CRAFT_RADIUS, CHEST_RADIUS, KEEP_CLEAR, KEEP_SOLID, generateProps } from '../../src/game/world/layout';
import { HOME_R } from '../../src/game/world/homestead';
import { Terrain } from '../../src/game/world/terrain';
import { buildTargets, pickTarget, targetLabel } from '../../src/game/systems/interactables';
import { benchSeats } from '../../src/game/systems/seating';
import { ChopperBrain, type DogWorld } from '../../src/game/world/chopper/brain';
import {
  BULK_MAX,
  HOUSE_R,
  HOUSE_HEX,
  HOUSE_NEEDS,
  RECIPES,
  TARGET_REACH,
  byMaterials,
  colourName,
  craft,
  fits,
  listNeeds,
  maxCraftable,
  missing,
  paintOptions,
  parseSite,
  recipeById,
  spendPaint,
  takeHouse,
} from '../../src/game/world/craft/recipes';
import { BED_U, DOGHOUSE, DOORWAY_U } from '../../src/game/world/craft/models';
import { FIXTURE_LANDMARKS } from './fixtures';

const R = CONFIG.planetRadius;
const geos = FIXTURE_LANDMARKS.map((l) => landmarkGeometry(l));
const layout = generateProps(geos);
const terrain = new Terrain(geos, layout);
const d = (a: Vector3, b: Vector3) => arcDistance(a, b, R);
const r = (id: string) => recipeById(id)!;
const inv = (items: Array<[ItemId, number]> = []) => {
  const x = new Inventory();
  for (const [id, n] of items) x.add(id, n);
  return x;
};

describe('crafting: recipes (crafting.md §4.1)', () => {
  it('has planks, a beam, a slab and a paint for each of the 7 bloom colours', () => {
    expect(RECIPES.map((x) => x.id)).toEqual(['planks', 'beam', 'slab', ...BLOOM_COLOURS.map((c) => `paint-${c.name}`)]);
    expect(r('planks')).toMatchObject({ out: 'planks', yield: 4, needs: [{ any: ['log'], n: 1 }] });
    expect(r('beam')).toMatchObject({ out: 'beam', yield: 1, needs: [{ any: ['log'], n: 2 }] });
    expect(r('slab')).toMatchObject({ out: 'slab', yield: 1, needs: [{ any: ['stone'], n: 2 }] });
    for (const c of BLOOM_COLOURS) {
      const p = r(`paint-${c.name}`);
      expect(p.out).toBe(`paint-${c.name}`);
      expect(p.needs).toHaveLength(1);
      expect(p.needs[0].n).toBe(3);
      expect([...p.needs[0].any].sort()).toEqual([`cosmos-${c.name}`, `pansy-${c.name}`, `tulip-${c.name}`]);
    }
  });

  it('registers every result as an item with an icon from the golden-set manifest', () => {
    for (const x of RECIPES) {
      const def = ITEMS.get(x.out)!;
      expect(def, x.out).toBeTruthy();
      expect(ICONS[def.icon]?.url, def.icon).toMatch(/\.webp$/);
    }
  });

  it('crafts: the materials leave the backpack and the result goes in', () => {
    const a = inv([['log', 3]]);
    expect(craft(a, r('planks'), 2)).toEqual({ made: 8, left: 0 });
    expect(a.count('log')).toBe(1);
    expect(a.count('planks')).toBe(8);
    const b = inv([['stone', 5]]);
    expect(craft(b, r('slab'), 2)).toEqual({ made: 2, left: 0 });
    expect(b.count('stone')).toBe(1);
    const c = inv([['log', 4]]);
    expect(craft(c, r('beam'), 2)).toEqual({ made: 2, left: 0 });
    expect(c.count('log')).toBe(0);
  });

  it("won't craft without enough, and takes nothing", () => {
    const a = inv([['log', 3]]);
    expect(craft(a, r('beam'), 2)).toBeNull();
    expect(craft(a, r('planks'), 0)).toBeNull();
    expect(a.count('log')).toBe(3);
    expect(a.count('beam')).toBe(0);
  });

  it('makes paint from any 3 flowers of a colour, a mix of kinds, taking the most plentiful first', () => {
    const a = inv([
      ['tulip-blue', 1],
      ['pansy-blue', 4],
      ['cosmos-red', 5],
    ]);
    const p = r('paint-blue');
    expect(byMaterials(a, p)).toBe(1);
    expect(craft(a, p, 1)).toEqual({ made: 1, left: 0 });
    expect(a.count('paint-blue')).toBe(1);
    expect(a.count('pansy-blue')).toBe(1);
    expect(a.count('tulip-blue')).toBe(1);
    // other colours don't count
    expect(a.count('cosmos-red')).toBe(5);
    expect(byMaterials(a, p)).toBe(0);
    expect(maxCraftable(a, r('paint-red'))).toBe(1);
  });

  it('bulk crafting: 1 to 10 at once, capped by the materials', () => {
    expect(maxCraftable(inv([['log', 25]]), r('planks'))).toBe(BULK_MAX);
    expect(maxCraftable(inv([['log', 3]]), r('planks'))).toBe(3);
    expect(maxCraftable(inv([['log', 5]]), r('beam'))).toBe(2);
    expect(maxCraftable(inv([['stone', 1]]), r('slab'))).toBe(0);
    expect(maxCraftable(inv(), r('planks'))).toBe(0);
  });

  it('bulk crafting is capped by room for the result (after the materials have gone)', () => {
    // every slot full: 35 full stacks of apples and one of logs
    const full = inv([['apple', 64 * (BACKPACK_SLOTS - 1)], ['log', 64]]);
    expect(full.room('planks')).toBe(0);
    expect(maxCraftable(full, r('planks'))).toBe(0);
    expect(fits(full, r('planks'), 1)).toBe(false);
    // …but a single log's slot empties as it's used, making room
    const one = inv([['apple', 64 * (BACKPACK_SLOTS - 1)], ['log', 1]]);
    expect(maxCraftable(one, r('planks'))).toBe(1);
    expect(craft(one, r('planks'), 1)).toEqual({ made: 4, left: 0 });
    expect(one.count('planks')).toBe(4);
  });

  it('reports what did not fit (the caller drops it at your feet)', () => {
    const a = inv([['apple', 64 * (BACKPACK_SLOTS - 1)], ['log', 64]]);
    const res = craft(a, r('planks'), 2);
    expect(res).toEqual({ made: 8, left: 8 });
    expect(a.count('log')).toBe(62);
  });
});

describe('inventory: remove (crafting and building)', () => {
  it('takes from the main slots before the hotbar, and nothing when there are too few', () => {
    const a = new Inventory();
    a.backpack[0] = { id: 'log', n: 5 };
    a.backpack[HOTBAR + 2] = { id: 'log', n: 3 };
    expect(a.remove('log', 4)).toBe(true);
    expect(a.backpack[HOTBAR + 2]).toBeNull();
    expect(a.backpack[0]).toEqual({ id: 'log', n: 4 });
    const v = a.version;
    expect(a.remove('log', 9)).toBe(false);
    expect(a.count('log')).toBe(4);
    expect(a.version).toBe(v);
    expect(a.remove('log', 0)).toBe(true);
  });
});

describe("Chopper's house: requirements and paint (crafting.md §4.3)", () => {
  it('needs 2 stone slabs, 2 wooden beams and 4 planks, and says what is missing', () => {
    expect(HOUSE_NEEDS).toEqual([
      { id: 'slab', n: 2 },
      { id: 'beam', n: 2 },
      { id: 'planks', n: 4 },
    ]);
    const a = inv([
      ['slab', 2],
      ['planks', 1],
    ]);
    expect(missing(a)).toEqual([
      { id: 'beam', n: 2, have: 0 },
      { id: 'planks', n: 4, have: 1 },
    ]);
    expect(listNeeds(missing(a))).toBe('2 wooden beams and 3 planks');
    expect(listNeeds(HOUSE_NEEDS)).toBe('2 stone slabs, 2 wooden beams and 4 planks');
    expect(takeHouse(a)).toBe(false);
    expect(a.count('slab')).toBe(2);
  });

  it('building takes exactly the materials', () => {
    const a = inv([
      ['slab', 3],
      ['beam', 2],
      ['planks', 8],
    ]);
    expect(missing(a)).toEqual([]);
    expect(takeHouse(a)).toBe(true);
    expect([a.count('slab'), a.count('beam'), a.count('planks')]).toEqual([1, 0, 4]);
  });

  it('paints with one pot of a paint you have; Original red is free', () => {
    const a = inv([['paint-pink', 2]]);
    const opts = paintOptions(a);
    expect(opts[0]).toEqual({ colour: 'original', pots: Infinity });
    expect(opts.find((o) => o.colour === 'pink')?.pots).toBe(2);
    expect(opts.find((o) => o.colour === 'blue')?.pots).toBe(0);
    expect(spendPaint(a, 'pink')).toBe(true);
    expect(a.count('paint-pink')).toBe(1);
    expect(spendPaint(a, 'blue')).toBe(false);
    expect(spendPaint(a, 'original')).toBe(true);
    expect(colourName('original')).toBe('Original red');
    expect(Object.keys(HOUSE_HEX)).toHaveLength(1 + BLOOM_COLOURS.length);
  });

  it('reads its saved state defensively', () => {
    expect(parseSite(null)).toEqual({ built: false, colour: 'original' });
    expect(parseSite({ built: true, colour: 'blue' })).toEqual({ built: true, colour: 'blue' });
    expect(parseSite({ built: 'yes', colour: 'tartan' })).toEqual({ built: false, colour: 'original' });
  });
});

describe('the crafting table and the house site: placement and keeping targets apart (crafting.md §4.2, §4.4)', () => {
  const home = layout.home!;
  const table = layout.craft!;
  const chest = layout.chest!;
  const ws = geos.find((g) => g.id === 'workshop')!;
  const targets = buildTargets(layout, benchSeats(layout.furniture), chest, BLOOM_COLOURS.length);
  const specials = [
    { key: 'chest', n: chest.n, r: CHEST_RADIUS },
    { key: 'craft', n: table.n, r: CRAFT_RADIUS },
    { key: 'site', n: home.dogHouse.n, r: HOME_R.dogHouse },
  ];

  it('stands the crafting table in the workyard beside the chest (prabin-npc.md §4.7): on the Workshop side, clear of both buildings and the paths', () => {
    expect(table).toBeTruthy();
    const po = geos.find((g) => g.id === 'post-office')!;
    const out = d(table.n, ws.n) - ws.footprintU;
    expect(out).toBeGreaterThanOrEqual(1.3 - 1e-6);
    expect(out).toBeLessThan(3);
    expect(d(table.n, po.n) - po.footprintU).toBeGreaterThan(1.3);
    expect(d(table.n, ws.n)).toBeLessThan(d(chest.n, ws.n));
    // comfortably apart from the chest, but side by side
    expect(d(table.n, chest.n)).toBeGreaterThan(2);
    expect(d(table.n, chest.n)).toBeLessThan(3.2);
    for (const g of geos) expect(pointArcDistance(table.n, UP, g.approach, R), `off the path to ${g.id}`).toBeGreaterThan(CRAFT_RADIUS + 0.9 - 1e-6);
    expect(terrain.inWater(table.n)).toBe(false);
    // the table is solid, and nothing else stands in it
    const own = layout.obstacles.find((o) => o.n === table.n);
    expect(own?.radiusU).toBe(CRAFT_RADIUS);
    for (const o of layout.obstacles) if (o !== own) expect(d(o.n, table.n) - o.radiusU - CRAFT_RADIUS).toBeGreaterThan(0.1);
  });

  it("puts Chopper's house site beside the family's house, on dry open ground", () => {
    const s = home.dogHouse.n;
    expect(d(s, home.house.n)).toBeLessThan(3.5);
    expect(terrain.inWater(s)).toBe(false);
    for (const o of layout.obstacles) expect(d(o.n, s) - o.radiusU - HOME_R.dogHouse, `obstacle at ${o.n.toArray()}`).toBeGreaterThan(0.3);
  });

  it('keeps flowers, trees, bushes, rocks and boulders clear of the chest, the crafting table and the site', () => {
    for (const sp of specials) {
      for (const t of targets) {
        const gap = d(t.n, sp.n) - sp.r - t.edgeU;
        if (t.kind === 'flower') expect(gap, `${t.key} by ${sp.key}`).toBeGreaterThanOrEqual(KEEP_CLEAR - 1e-6);
        if (t.kind === 'tree' || t.kind === 'boulder') expect(gap, `${t.key} by ${sp.key}`).toBeGreaterThanOrEqual(KEEP_SOLID - 0.25);
      }
    }
    // and the specials are well apart from each other
    for (const a of specials) for (const b of specials) if (a !== b) expect(d(a.n, b.n), `${a.key}–${b.key}`).toBeGreaterThan(2);
  });

  it('offers only the special target when you stand at it', () => {
    const extra = [
      { kind: 'craft' as const, key: 'craft', n: table.n, edgeU: CRAFT_RADIUS, reachU: TARGET_REACH.table, standU: CRAFT_RADIUS + 0.45, index: 0, scale: 1 },
      { kind: 'site' as const, key: 'site', n: home.dogHouse.n, edgeU: HOUSE_R, reachU: TARGET_REACH.site, standU: 1.1, index: 0, scale: 1 },
    ];
    const all = [...targets, ...extra];
    for (const sp of specials) {
      // from every side, a step from its edge, facing it
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const dir = tangentToward(sp.n, new Vector3(Math.cos(a), 0.3, Math.sin(a)).normalize())!;
        const p = moveAlong(sp.n, dir, (sp.r + CONFIG.playerRadius + 0.15) / R);
        const fwd = tangentToward(p, sp.n)!;
        const t = pickTarget(p, fwd, all, null, () => true, R, false);
        expect(t?.key, `${sp.key} from ${k}`).toBe(sp.key);
      }
    }
    expect(targetLabel(extra[0])).toBe('Use crafting table');
  });
});

describe("Chopper and his house (crafting.md §4.3, prabin-npc.md §4.5)", () => {
  const home = layout.home!;
  const site = home.dogHouse;
  const door = moveAlong(site.n, site.facing, DOORWAY_U / R);
  const inside = moveAlong(site.n, site.facing, BED_U / R);
  const facing = tangentToward(door, moveAlong(site.n, site.facing, 3 / R))!;
  const player = moveAlong(site.n, site.facing, 2.4 / R);
  const houseObstacle = { n: site.n, radiusU: HOUSE_R };
  const world = (house = true): DogWorld => ({
    R,
    player,
    playerFwd: tangentToward(player, site.n)!,
    playerVel: new Vector3(),
    obstacles: [...layout.obstacles, houseObstacle],
    blocked: () => false,
    rabbits: [],
    spots: [],
    others: [],
    house: house ? { n: site.n, door, inside, facing, floor: DOGHOUSE.base } : null,
  });

  it('is big enough for him: he walks in upright through the doorway', () => {
    // (1.25× life size: about 0.6 u to the top of his head, 0.3 u across)
    expect(DOGHOUSE.door.h).toBeGreaterThan(0.55);
    expect(DOGHOUSE.door.w).toBeGreaterThan(0.38);
    expect(DOGHOUSE.h).toBeGreaterThan(DOGHOUSE.door.h);
    expect(HOUSE_R).toBeGreaterThan(Math.hypot(DOGHOUSE.w, DOGHOUSE.d) / 2 - 0.2);
  });

  it('goes in when it is built, sits on his bed facing out, lifted onto the floor, and never walks through a wall', () => {
    const b = new ChopperBrain(() => 0.5);
    const w = world();
    b.placeNear(w);
    b.visitHouse(true);
    const wallOk = () => {
      // outside the walls, or inside through the doorway (never across the side or back walls)
      const dc = d(b.n, site.n);
      if (dc > HOUSE_R + 0.19) return true;
      const local = b.n.clone().sub(site.n);
      return local.dot(site.facing) * R > -DOGHOUSE.d / 2 || !b.inside ? b.inside || dc > HOUSE_R + 0.15 : true;
    };
    for (let t = 0; t < 10 && !(b.behaviour === 'house' && b.clip === 'sit' && d(b.n, inside) < 0.1); t += 1 / 30) {
      b.step(1 / 30, w);
      expect(wallOk()).toBe(true);
    }
    expect(b.behaviour).toBe('house');
    expect(b.inside).toBe(true);
    expect(d(b.n, inside)).toBeLessThan(0.1);
    for (let t = 0; t < 1; t += 1 / 30) b.step(1 / 30, w);
    expect(b.clip).toBe('sit');
    expect(b.dir.dot(facing)).toBeGreaterThan(0.9);
    expect(b.lift).toBeCloseTo(DOGHOUSE.base, 5);
    expect(b.events.some((e) => e.type === 'bark')).toBe(true);
    // a whistle: out through the doorway first, then to the character
    b.whistle();
    let out = false;
    for (let t = 0; t < 8; t += 1 / 30) {
      b.step(1 / 30, w);
      if (!b.inside && !out) {
        out = true;
        expect(d(b.n, door)).toBeLessThan(0.2);
      }
    }
    expect(out).toBe(true);
    expect(b.lift).toBe(0);
    expect(d(b.n, site.n)).toBeGreaterThan(HOUSE_R + 0.15);
  });

  it('now and then naps there of his own accord, but never without a house', () => {
    const count = (house: boolean) => {
      let seed = 7;
      const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const b = new ChopperBrain(rand);
      const w = world(house);
      b.placeNear(w);
      b.energy = 0.3;
      let naps = 0;
      let was = '';
      for (let t = 0; t < 240; t += 1 / 30) {
        b.step(1 / 30, w);
        b.energy = Math.min(b.energy, 0.45);
        if (b.behaviour === 'house' && was !== 'house') naps++;
        was = b.behaviour;
      }
      return naps;
    };
    expect(count(true)).toBeGreaterThan(0);
    expect(count(false)).toBe(0);
  });
});
