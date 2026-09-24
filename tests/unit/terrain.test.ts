import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { CONFIG } from '../../src/game/config';
import { landmarkGeometry } from '../../src/game/math/landmarks';
import { UP, arcDistance, moveAlong, pointArcDistance } from '../../src/game/math/sphere';
import { mesaRadius, riverDistance } from '../../src/game/world/features';
import { PLAZA_RADIUS_U, generateProps } from '../../src/game/world/layout';
import { RIVER_WATER_U, Terrain, UNDULATION_U, valueNoise } from '../../src/game/world/terrain';
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
