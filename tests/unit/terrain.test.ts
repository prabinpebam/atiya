import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { CONFIG } from '../../src/game/config';
import { landmarkGeometry } from '../../src/game/math/landmarks';
import { UP, arcDistance, moveAlong, pointArcDistance, tangentToward } from '../../src/game/math/sphere';
import { PlanetSim } from '../../src/game/systems/movement';
import { mesaRadius, riverDistance } from '../../src/game/world/features';
import { PLAZA_RADIUS_U, generateProps } from '../../src/game/world/layout';
import { angleGap, pondAngle, pondFrame, pondPoint, shoreRadius } from '../../src/game/world/pond';
import { BENCH_VIEW, HOUSE_BANK, MOUTH_CLEAR, pondPlants } from '../../src/game/world/pondPlants';
import { RIVER_WATER_U, Terrain, UNDULATION_U, WADE_MAX_U, WADE_SLOWDOWN, valueNoise, wadeSpeedFactor } from '../../src/game/world/terrain';
import { FIXTURE_LANDMARKS } from './fixtures';

const R = CONFIG.planetRadius;
const geos = FIXTURE_LANDMARKS.map((l) => landmarkGeometry(l));
const layout = generateProps(geos);
const terrain = new Terrain(geos, layout);
const river = layout.river!;

function randomDirs(count: number, seed = 1): Vector3[] {
  const out: Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const y = 1 - (2 * (i + 0.5)) / count;
    const r = Math.sqrt(1 - y * y);
    const t = Math.PI * (3 - Math.sqrt(5)) * i + seed;
    out.push(new Vector3(Math.cos(t) * r, y, Math.sin(t) * r));
  }
  return out;
}

describe('river & bridge', () => {
  it('flows from the waterfall cliff to the pond', () => {
    const source = layout.mesas[0];
    expect(arcDistance(river.samples[0], source.n, R)).toBeLessThan(source.radiusU * 1.2 + 0.6);
    expect(arcDistance(river.samples[river.samples.length - 1], layout.pond!.n, R)).toBeLessThan(layout.pond!.radiusU);
    expect(river.lengthU).toBeGreaterThan(15);
    for (let i = 1; i < river.samples.length; i++) expect(arcDistance(river.samples[i - 1], river.samples[i], R)).toBeLessThan(0.35);
  });

  it('stays clear of the plaza and every landmark', () => {
    river.samples.forEach((p, i) => {
      expect(arcDistance(p, UP as Vector3, R)).toBeGreaterThan(PLAZA_RADIUS_U + river.halfWidth[i] + 1);
      for (const g of geos) expect(arcDistance(p, g.n, R)).toBeGreaterThan(g.footprintU + river.halfWidth[i] + 0.6);
    });
  });

  it('crosses exactly one path — the Greenhouse path — under a bridge, and no other', () => {
    expect(layout.bridges.map((b) => b.pathId)).toEqual(['greenhouse']);
    for (const g of geos) {
      if (g.id === 'greenhouse') continue;
      river.samples.forEach((p, i) => expect(pointArcDistance(p, UP as Vector3, g.approach, R)).toBeGreaterThan(river.halfWidth[i] + 0.8));
    }
    const b = layout.bridges[0];
    expect(riverDistance(river, b.n).d).toBeLessThan(0.3);
    // the deck spans the water with dry land at both ends
    expect(b.halfLengthU).toBeGreaterThan(river.halfWidth[riverDistance(river, b.n).i] + 0.5);
  });
});

describe('terrain', () => {
  it('is flat where things stand: plaza, landmark footprints and approaches', () => {
    for (let i = 0; i < 40; i++) {
      const p = moveAlong(UP as Vector3, new Vector3(Math.cos(i), 0, Math.sin(i)), ((i % 10) * 0.3) / R);
      expect(Math.abs(terrain.height(p))).toBeLessThan(1e-9);
    }
    for (const g of geos) {
      expect(Math.abs(terrain.height(g.n))).toBeLessThan(1e-9);
      expect(Math.abs(terrain.height(g.approach))).toBeLessThan(1e-9);
    }
  });

  it('rolls mildly in open country and is continuous', () => {
    let max = 0;
    for (const n of randomDirs(3000)) {
      const h = terrain.height(n);
      if (layout.mesas.some((m) => arcDistance(n, m.n, R) < m.radiusU * 1.3)) continue;
      max = Math.max(max, Math.abs(h));
      const step = moveAlong(n, new Vector3(0, 1, 0).cross(n).normalize(), 0.05 / R);
      expect(Math.abs(terrain.height(step) - h)).toBeLessThan(0.12);
    }
    expect(max).toBeGreaterThan(0.12);
    expect(max).toBeLessThan(UNDULATION_U * 1.4);
  });

  it('carves the river bed below the water line, with the water below the banks', () => {
    for (let i = 5; i < river.samples.length - 5; i += 7) {
      expect(terrain.height(river.samples[i])).toBeLessThan(RIVER_WATER_U - 0.1);
    }
    expect(RIVER_WATER_U).toBeLessThan(0);
  });

  it('raises flat-topped mesas', () => {
    for (const m of layout.mesas) {
      expect(terrain.height(m.n)).toBeGreaterThan(m.heightU * 0.95);
      const out = moveAlong(m.n, m.north, (mesaRadius(m.radiusU, m.seed, 0) + 0.4) / R);
      expect(terrain.height(out)).toBeLessThan(0.5);
    }
  });

  it('lifts the character over the bridge deck (arched, highest in the middle)', () => {
    const b = layout.bridges[0];
    const mid = terrain.walkHeight(b.n);
    const end = terrain.walkHeight(moveAlong(b.n, b.along, (b.halfLengthU - 0.05) / R));
    expect(mid).toBeGreaterThan(0.3);
    expect(end).toBeLessThan(mid);
    expect(terrain.height(b.n)).toBeLessThan(0);
  });

  it('value noise is smooth and in [0, 1]', () => {
    for (let i = 0; i < 200; i++) {
      const v = valueNoise(i * 0.37, i * 0.11, i * 0.73);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(Math.abs(valueNoise(i * 0.37 + 0.001, i * 0.11, i * 0.73) - v)).toBeLessThan(0.01);
    }
  });
});

describe('cliffs, rocks and pebbles', () => {
  it('keeps mesas and boulders out of the plaza, landmarks and paths', () => {
    for (const m of layout.mesas) {
      expect(arcDistance(m.n, UP as Vector3, R)).toBeGreaterThan(PLAZA_RADIUS_U + m.radiusU * 1.2);
      for (const g of geos) {
        expect(arcDistance(m.n, g.n, R)).toBeGreaterThan(g.footprintU + m.radiusU * 1.15 + 0.2);
        expect(pointArcDistance(m.n, UP as Vector3, g.approach, R)).toBeGreaterThan(m.radiusU * 1.15 + 0.8);
      }
    }
    expect(layout.boulders.length).toBeGreaterThanOrEqual(15);
    expect(layout.pebbles.length).toBeGreaterThanOrEqual(60);
  });
});

describe('pond', () => {
  const pond = layout.pond!;
  const f = pondFrame(pond, river);
  const plants = pondPlants(pond, river, terrain);
  const polar = (n: Vector3) => ({ d: arcDistance(n, pond.n, R), a: pondAngle(pond, f, n) });

  it('has an organic shoreline that relaxes to the nominal radius at the stream mouth', () => {
    const radii = Array.from({ length: 72 }, (_, i) => shoreRadius(pond, f, (i / 72) * Math.PI * 2));
    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(pond.radiusU * 0.25);
    expect(Math.max(...radii)).toBeLessThan(pond.radiusU * 1.3);
    expect(shoreRadius(pond, f, f.mouth!)).toBeCloseTo(pond.radiusU, 6);
    expect(pond.radiusU).toBeCloseTo(1.8, 6);
  });

  it('shares the stream water level: the bowl meets it just inside the shore', () => {
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      if (angleGap(a, f.mouth!) < MOUTH_CLEAR) continue; // the stream channel runs out through the mouth
      const s = shoreRadius(pond, f, a);
      const ground = (rho: number) => terrain.height(pondPoint(pond, f, a, rho));
      expect(ground(s * 0.6)).toBeLessThan(RIVER_WATER_U - 0.05);
      expect(ground(s + 0.3)).toBeGreaterThan(RIVER_WATER_U);
    }
  });

  it('places every kind of plant in its zone and keeps the stream mouth open', () => {
    for (const list of [plants.lilies, plants.reeds, plants.irises, plants.ferns]) expect(list.length).toBeGreaterThan(0);
    for (const p of plants.lilies) {
      const { d, a } = polar(p.n);
      expect(d).toBeLessThan(shoreRadius(pond, f, a) * 0.75);
      expect(p.h).toBeCloseTo(RIVER_WATER_U + 0.006, 6);
    }
    for (const p of plants.ferns) {
      const { d, a } = polar(p.n);
      expect(d).toBeGreaterThan(shoreRadius(pond, f, a));
    }
    for (const p of [...plants.lilies, ...plants.reeds, ...plants.irises, ...plants.ferns]) {
      expect(angleGap(polar(p.n).a, f.mouth!)).toBeGreaterThan(MOUTH_CLEAR - 1e-6);
    }
  });

  it('keeps other props off the water', () => {
    const all = [...layout.trees, ...layout.bushes, ...layout.flowerBushes, ...layout.rocks, ...layout.boulders, ...Object.values(layout.flowers).flat()];
    for (const p of all) {
      const { d, a } = polar(p.n);
      expect(d).toBeGreaterThan(shoreRadius(pond, f, a));
    }
  });

  it('keeps the bank facing the house open, and the water in front of the pond bench', () => {
    const home = layout.home!;
    const withHome = pondPlants(pond, river, terrain, home);
    const houseA = pondAngle(pond, f, home.house.n);
    const tall = [...withHome.reeds, ...withHome.ferns];
    for (const p of tall) expect(angleGap(polar(p.n).a, houseA)).toBeGreaterThan(HOUSE_BANK - 1e-6);
    const view = home.pondBench.n.clone().lerp(pond.n, 0.45).normalize();
    for (const p of [...tall, ...withHome.irises]) expect(arcDistance(p.n, view, R)).toBeGreaterThan(BENCH_VIEW - 0.02);
    // fewer shore plants than without the home, but still some of every kind
    const count = (x: typeof plants) => x.reeds.length + x.irises.length + x.ferns.length;
    expect(count(withHome)).toBeLessThan(count(plants));
    for (const list of [withHome.lilies, withHome.reeds, withHome.irises, withHome.ferns]) expect(list.length).toBeGreaterThan(0);
  });
});

describe('wading', () => {
  const obstacles = [...geos.map((g) => ({ n: g.n, radiusU: g.footprintU })), ...layout.obstacles];
  const pond = layout.pond!;

  it('knows how deep the water is: the stream and pond are wadeable, land and bridges are dry', () => {
    for (let i = 5; i < river.samples.length - 5; i += 9) {
      const c = river.samples[i];
      if (terrain.deckHeight(c) > -Infinity) continue;
      expect(terrain.waterDepth(c)).toBeGreaterThan(0.1);
      expect(terrain.waterDepth(c)).toBeLessThanOrEqual(WADE_MAX_U);
    }
    expect(terrain.waterDepth(pond.n)).toBeGreaterThan(0.2);
    expect(terrain.waterDepth(layout.bridges[0].n)).toBe(0);
    expect(terrain.waterDepth(UP as Vector3)).toBe(0);
    // dry hollows in the rolling country are not water
    for (const n of randomDirs(3000, 5)) {
      if (!terrain.inWater(n)) expect(terrain.waterDepth(n)).toBe(0);
      else expect(terrain.walkHeight(n)).toBeGreaterThanOrEqual(RIVER_WATER_U - WADE_MAX_U - 1e-9);
    }
  });

  it('slows the character in deeper water', () => {
    expect(wadeSpeedFactor(0)).toBe(1);
    expect(wadeSpeedFactor(WADE_MAX_U)).toBeCloseTo(1 - WADE_SLOWDOWN, 6);
    for (let d = 0; d < WADE_MAX_U; d += 0.02) expect(wadeSpeedFactor(d + 0.02)).toBeLessThanOrEqual(wadeSpeedFactor(d));
  });

  it('no longer blocks the water: the character wades straight across the stream and into the pond', () => {
    const cross = (start: Vector3, target: Vector3) => {
      const sim = new PlanetSim(obstacles);
      sim.setOrientation(new Quaternion().setFromUnitVectors(start, UP as Vector3));
      sim.startAutoWalk(target);
      let maxDepth = 0;
      let minFactor = 1;
      for (let f = 0; f < 60 * 20 && sim.autoWalk; f++) {
        const depth = terrain.waterDepth(sim.pLocal);
        sim.speedFactor = wadeSpeedFactor(depth);
        maxDepth = Math.max(maxDepth, depth);
        minFactor = Math.min(minFactor, sim.speedFactor);
        sim.step(1 / 60, { x: 0, y: 0, run: false });
      }
      return { maxDepth, minFactor, left: arcDistance(sim.pLocal, target, R) };
    };
    // a stretch of stream with nothing (boulders, trees, landmarks) on the straight line across it
    let tried = 0;
    for (let i = 8; i < river.samples.length - 8 && tried < 3; i += 3) {
      const c = river.samples[i];
      if (layout.bridges.some((b) => arcDistance(c, b.n, R) < 3)) continue;
      const side = new Vector3().crossVectors(c, river.tangent[i]).normalize();
      const hw = river.halfWidth[i];
      const a = moveAlong(c, side, (hw + 1.1) / R);
      const b = moveAlong(c, side, -(hw + 1.1) / R);
      const clear = obstacles.every((o) => pointArcDistance(o.n, a, b, R) > o.radiusU + CONFIG.playerRadius + 0.1);
      if (!clear || terrain.inWater(a) || terrain.inWater(b)) continue;
      tried++;
      const r = cross(a, b);
      expect(r.left).toBeLessThan(CONFIG.autoWalkArrive + 0.05);
      expect(r.maxDepth).toBeGreaterThan(0.12);
      expect(r.minFactor).toBeLessThan(0.7);
    }
    expect(tried).toBeGreaterThan(0);
    // and out into the middle of the pond from its bank
    const toward = tangentToward(pond.n, UP as Vector3)!;
    const bank = moveAlong(pond.n, toward, (terrain.pondShore(moveAlong(pond.n, toward, 0.5 / R)) + 1.2) / R);
    const r = cross(bank, pond.n);
    expect(r.left).toBeLessThan(CONFIG.autoWalkArrive + 0.05);
    expect(r.maxDepth).toBeGreaterThan(0.2);
  });
});

describe('terrain flat mask (fast bounds)', () => {
  const smooth = (e0: number, e1: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  /** The mask with every landmark term evaluated in full (the bounds skip only factors of exactly 1). */
  function reference(n: Vector3, riverD: number): number {
    let m = smooth(3.2, 3.2 + 2.2, arcDistance(n, UP as Vector3, R)); // PLAZA_FLAT_U = 3.2
    if (m === 0) return 0;
    for (const g of geos) {
      m *= smooth(g.footprintU + 0.6, g.footprintU + 2.3, arcDistance(n, g.n, R));
      m *= smooth(0.7, 1.9, arcDistance(n, g.approach, R));
      m *= 0.3 + 0.7 * smooth(0.45, 1.5, pointArcDistance(n, UP as Vector3, g.approach, R));
      if (m === 0) return 0;
    }
    const pond = layout.pond;
    if (pond) m *= smooth(pond.radiusU + 0.35, pond.radiusU + 2.0, arcDistance(n, pond.n, R));
    m *= smooth(0.75, 2.4, riverD);
    return m;
  }

  it('matches the full evaluation everywhere', () => {
    let open = 0;
    for (const n of randomDirs(6000, 0.7)) {
      const d = riverDistance(river, n).d;
      const want = reference(n, d);
      expect(terrain.flatMask(n, d)).toBeCloseTo(want, 12);
      if (want > 0 && want < 1) open++;
    }
    expect(open).toBeGreaterThan(100); // the transitions were sampled, not just the flat and open ground
  });
});
