import { describe, expect, it } from 'vitest';
import { IcosahedronGeometry, Vector3 } from 'three';
import { CONFIG } from '../../src/game/config';
import { landmarkGeometry } from '../../src/game/math/landmarks';
import { arcDistance, moveAlong, pointArcDistance } from '../../src/game/math/sphere';
import { boxDistance, padLocal } from '../../src/game/world/pads';
import { structurePads } from '../../src/game/world/groundPads';
import { homePads } from '../../src/game/world/home/homePads';
import { PLAZA_RADIUS_U, generateProps } from '../../src/game/world/layout';
import { Terrain, valueNoise } from '../../src/game/world/terrain';
import { BATCH, packMeta, placeGrass, unpackMeta, vertexGrass, type GrassOptions, type GroundMesh } from '../../src/game/world/grass/field';
import { GRASS_H, grassRules, type GroundSurface } from '../../src/game/world/grass/zones';
import { FIXTURE_LANDMARKS } from './fixtures';

const R = CONFIG.planetRadius;
const geos = FIXTURE_LANDMARKS.map((l) => landmarkGeometry(l));
const layout = generateProps(geos);
const home = layout.home!;
const specs = [...structurePads(FIXTURE_LANDMARKS.map((l, i) => ({ geo: geos[i], variant: l.variant })), layout), ...homePads(home, R)];
const terrain = new Terrain(geos, layout, CONFIG, specs);
const env = {
  padDistance: (p: Parameters<typeof padLocal>[0], u: Vector3) => {
    const l = padLocal(p, u, R);
    return l ? boxDistance(p, l.x, l.z) : null;
  },
  segmentDistance: (u: Vector3, a: Vector3, b: Vector3) => pointArcDistance(u, a, b, R),
};
const rules = grassRules({
  R,
  geos,
  layout,
  pads: terrain.pads,
  plazaU: PLAZA_RADIUS_U,
  pondShore: (n) => terrain.pondShore(n),
  noise: valueNoise,
  ...env,
});
const LAWN: GroundSurface = { path: 0, plaza: 0, cobble: 0, sand: 0, bed: 0, bank: 0, steep: 0 };
const at = (u: Vector3, s: Partial<GroundSurface> = {}) => rules.sample(u, { ...LAWN, ...s });

/** Points in a ring of radius `r` (u) round `n`. */
function ring(n: Vector3, r: number, k = 12): Vector3[] {
  const t = new Vector3(0, 1, 0).cross(n).normalize();
  if (t.lengthSq() < 1e-6) t.set(1, 0, 0);
  return Array.from({ length: k }, (_, i) => moveAlong(n, t.clone().applyAxisAngle(n, (i / k) * Math.PI * 2), r / R));
}

/** Fibonacci points over the whole sphere. */
const sphere = Array.from({ length: 6000 }, (_, i) => {
  const y = 1 - (2 * (i + 0.5)) / 6000;
  const r = Math.sqrt(1 - y * y);
  const a = i * Math.PI * (3 - Math.sqrt(5));
  return new Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
});

describe('grass zones (the real layout)', () => {
  it('leaves bare ground bare: paths, plaza, cobbles, sand, riverbed, banks, steep ground', () => {
    const u = sphere[1234];
    for (const s of [{ path: 1 }, { plaza: 1 }, { cobble: 1 }, { sand: 1 }, { bed: 1 }, { bank: 1 }, { steep: 1 }]) expect(at(u, s).density).toBe(0);
  });

  it('grows nothing in the pond, on the picnic mat, under structure bases or inside obstacles', () => {
    expect(at(layout.pond!.n).density).toBe(0);
    expect(at(home.mat.n).density).toBe(0);
    for (const p of terrain.pads) expect(at(p.n).density, p.id).toBe(0);
    const rock = layout.boulders[0] ?? layout.rocks[0];
    expect(at(rock.n).density).toBe(0);
  });

  it('keeps the mesa tops a lawn (their collision discs are not bare ground)', () => {
    for (const m of layout.mesas) expect(at(m.n).density).toBeGreaterThan(0.2);
  });

  it('keeps the whole home short and never knee-high: it is lived in', () => {
    for (let r = 0; r <= home.range; r += 0.5) {
      for (const u of ring(home.centre, r, 16)) {
        const g = at(u);
        expect(g.tall).toBe(0);
        if (g.density > 0) expect(g.height).toBeLessThan(GRASS_H.high);
      }
    }
    for (const u of ring(home.house.n, 3, 16)) {
      const g = at(u);
      expect(g.height).toBeLessThanOrEqual(GRASS_H.short + 0.03);
      expect(g.wear).toBeGreaterThan(0.6);
    }
    for (const b of home.yard.beds) for (const u of ring(b.n, 1.2, 8)) expect(at(u).height).toBeLessThanOrEqual(GRASS_H.short + 0.02);
  });

  it('wears a track between the door and the table', () => {
    const mid = new Vector3().addVectors(home.door.n, home.table.n).normalize();
    const side = ring(mid, 1.2, 8).map((u) => at(u).density);
    expect(at(mid).density).toBeLessThan(Math.max(...side));
    expect(at(mid).wear).toBeGreaterThan(0.9);
  });

  it('keeps the landmark lawns and the plaza verge mown', () => {
    for (const g of geos) for (const u of ring(g.n, g.footprintU + 1, 8)) expect(at(u).tall).toBe(0);
  });

  it('is never uniform: patchy density, varied heights, a few knee-high meadows in open country', () => {
    const open = sphere.map((u) => at(u)).filter((g) => g.density > 0);
    const dens = open.map((g) => g.density);
    const mean = dens.reduce((a, b) => a + b, 0) / dens.length;
    const sd = Math.sqrt(dens.reduce((a, b) => a + (b - mean) ** 2, 0) / dens.length);
    expect(sd).toBeGreaterThan(0.1);
    const heights = open.map((g) => g.height);
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.15);
    const tall = open.filter((g) => g.tall > 0.5).length / open.length;
    expect(tall).toBeGreaterThan(0.02);
    expect(tall).toBeLessThan(0.3);
    expect(open.some((g) => g.height >= GRASS_H.knee - 0.02)).toBe(true);
    const hues = open.map((g) => g.hue);
    expect(Math.max(...hues) - Math.min(...hues)).toBeGreaterThan(0.6);
  });

  it('the bucketed disc lookup matches testing every disc', () => {
    const full = grassRules({ R, geos, layout, pads: terrain.pads, plazaU: PLAZA_RADIUS_U, pondShore: (n) => terrain.pondShore(n), noise: valueNoise, ...env }, true);
    const pts = [...sphere, ...[0.5, 1, 2, 3, 4, 5, 6].flatMap((r) => ring(home.centre, r, 48)), ...layout.boulders.flatMap((b) => ring(b.n, 0.5, 8))];
    for (const u of pts) expect(at(u)).toEqual(full.sample(u, LAWN));
  });

  it('never knee-high near home: the tall meadows are out in open country', () => {
    for (const u of sphere) if (at(u).tall > 0) expect(arcDistance(u, home.centre, R)).toBeGreaterThan(home.range + 0.5);
  });
});

describe('grass packing', () => {
  it('round-trips the packed blade parameters', () => {
    const m = unpackMeta(packMeta(1.3, 0.21, 0.5, 0.75));
    expect(m.yaw).toBeCloseTo(1.3, 2);
    expect(m.height).toBeCloseTo(0.21, 2);
    expect(m.width).toBeCloseTo(0.5, 1);
    expect(m.lean).toBeCloseTo(0.75, 2);
    expect(unpackMeta(packMeta(-0.5, 2, -1, 3)).height).toBeCloseTo(0.6, 5);
  });
});

describe('grass placement', () => {
  const ico = new IcosahedronGeometry(R, 12);
  const pos = ico.getAttribute('position').array as Float32Array;
  const n = pos.length / 3;
  const mesh: GroundMesh = {
    pos,
    color: new Float32Array(n * 3).fill(0.3),
    surf: new Float32Array(n * 4),
    surf2: new Float32Array(n * 4),
    index: Array.from({ length: n }, (_, i) => i),
  };
  const opt: GrassOptions = { seed: 3, bladesPerU2: 40, maxBlades: 20_000, flowersPerU2: 4, maxFlowers: 1_000, tuftsPerU2: 20, maxTufts: 800, cells: 8 };
  const vg = vertexGrass(mesh, rules);

  it('respects the caps, pads to whole batches and is deterministic', () => {
    const a = placeGrass(mesh, vg, opt);
    const b = placeGrass(mesh, vg, opt);
    expect(a.blades.count).toBeGreaterThan(1000);
    for (const [p, cap] of [[a.blades, opt.maxBlades], [a.flowers, opt.maxFlowers], [a.tufts, opt.maxTufts]] as const) {
      expect(p.count).toBeLessThanOrEqual(cap);
      expect(p.padded % BATCH).toBe(0);
      expect(p.padded).toBeGreaterThanOrEqual(p.count);
      // the padding is zero-height and never at the planet's centre
      for (let i = p.count; i < p.padded; i++) {
        expect(unpackMeta(p.meta[i]).height).toBe(0);
        expect(Math.hypot(p.root[i * 3], p.root[i * 3 + 1], p.root[i * 3 + 2])).toBeGreaterThan(1);
      }
    }
    expect(Array.from(a.blades.meta.slice(0, 500))).toEqual(Array.from(b.blades.meta.slice(0, 500)));
    const tight = placeGrass(mesh, vg, { ...opt, maxBlades: 3000 });
    expect(tight.blades.count).toBeLessThanOrEqual(3000);
  });

  it('puts every blade and tuft where the rules allow, and no tuft near home', () => {
    const f = placeGrass(mesh, vg, opt);
    const u = new Vector3();
    for (let i = 0; i < f.blades.count; i += 7) {
      u.set(f.blades.root[i * 3], f.blades.root[i * 3 + 1], f.blades.root[i * 3 + 2]).normalize();
      expect(arcDistance(u, layout.pond!.n, R)).toBeGreaterThan(terrain.pondShore(u) + 0.1);
    }
    expect(f.tufts.count).toBeGreaterThan(0);
    for (let i = 0; i < f.tufts.count; i++) {
      u.set(f.tufts.root[i * 3], f.tufts.root[i * 3 + 1], f.tufts.root[i * 3 + 2]).normalize();
      expect(arcDistance(u, home.centre, R)).toBeGreaterThan(home.range + 0.4);
    }
  });
});
