import { describe, expect, it } from 'vitest';
import { BufferGeometry, Vector3 } from 'three';
import { CONFIG } from '../../src/game/config';
import { landmarkGeometry } from '../../src/game/math/landmarks';
import { arcDistance, moveAlong } from '../../src/game/math/sphere';
import { BENCH_BASE, CRAFT_TABLE_BASE, LANDMARK_BASE, structurePads } from '../../src/game/world/groundPads';
import { BED_BASE, DOG_HOUSE_BASE, HOUSE_BASE, homePads } from '../../src/game/world/home/homePads';
import { generateProps } from '../../src/game/world/layout';
import { mesaPolar, mesaRadius } from '../../src/game/world/features';
import { landmarkModel } from '../../src/game/world/models';
import { applyPads, boxDistance, makePad, padGap, padLocal, padOutline, padSamples, planeHeight, type Pad } from '../../src/game/world/pads';
import { bench } from '../../src/game/world/parts';
import { Kit } from '../../src/game/world/kit';
import { Terrain } from '../../src/game/world/terrain';
import { bed, houseModel } from '../../src/game/world/home/models';
import { craftingTableModel, dogHouseModel } from '../../src/game/world/craft/models';
import { FIXTURE_LANDMARKS } from './fixtures';

const R = CONFIG.planetRadius;
const geos = FIXTURE_LANDMARKS.map((l) => landmarkGeometry(l));
const layout = generateProps(geos);
const specs = [...structurePads(FIXTURE_LANDMARKS.map((l, i) => ({ geo: geos[i], variant: l.variant })), layout), ...homePads(layout.home!, R)];
const terrain = new Terrain(geos, layout, CONFIG, specs);
const bare = new Terrain(geos, layout);

/** Points across a pad's base box (a grid, edges included, grown by `grow` u). */
function baseGrid(p: Pad, grow = 0): Vector3[] {
  const out: Vector3[] = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = 0; j <= 6; j++) {
      const x = p.cx + (i / 3 - 1) * (p.bx + grow);
      const z = p.cz + (j / 3 - 1) * (p.bz + grow);
      out.push(p.n.clone().addScaledVector(p.x, x / R).addScaledVector(p.z, z / R).normalize());
    }
  }
  return out;
}

/** Horizontal extent (x, z) of a kit model's vertices below `maxY` (its footprint on the ground). */
function footprint(geo: unknown, maxY = 0.3): [number, number, number, number] {
  const e: [number, number, number, number] = [Infinity, -Infinity, Infinity, -Infinity];
  const walk = (g: unknown) => {
    if (g instanceof BufferGeometry) {
      const pos = g.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        if (pos.getY(i) > maxY) continue;
        e[0] = Math.min(e[0], pos.getX(i));
        e[1] = Math.max(e[1], pos.getX(i));
        e[2] = Math.min(e[2], pos.getZ(i));
        e[3] = Math.max(e[3], pos.getZ(i));
      }
    } else if (g && typeof g === 'object') for (const v of Object.values(g)) walk(v);
  };
  walk(geo);
  return e;
}
const kitOf = (f: (k: Kit) => void) => {
  const k = new Kit();
  f(k);
  return k.build();
};

describe('pads: the maths', () => {
  const pad = makePad({ id: 't', n: new Vector3(0.3, 0.8, 0.52).normalize(), facing: new Vector3(1, 0, 0), x0: -1, x1: 0.6, z0: -0.4, z1: 1.2 }, 0.1, R);

  it('maps the frame both ways (gnomonic) and measures the box', () => {
    for (const [x, z] of [[0, 0], [1.3, -0.7], [-2.1, 1.9], [0.4, 3.2]]) {
      const q = pad.n.clone().addScaledVector(pad.x, x / R).addScaledVector(pad.z, z / R).normalize();
      const l = padLocal(pad, q, R)!;
      expect(l.x).toBeCloseTo(x, 9);
      expect(l.z).toBeCloseTo(z, 9);
    }
    expect(boxDistance(pad, pad.cx, pad.cz)).toBeCloseTo(-Math.min(pad.bx, pad.bz), 9);
    expect(boxDistance(pad, pad.cx + pad.bx + 0.5, pad.cz)).toBeCloseTo(0.5, 9);
    expect(boxDistance(pad, pad.cx + pad.bx + 0.3, pad.cz + pad.bz + 0.4)).toBeCloseTo(0.5, 9);
  });

  it('is exactly the plane on its flat part, the natural ground past its skirt, and continuous between', () => {
    expect(planeHeight(pad, pad.n, R)).toBeCloseTo(0.1, 12);
    for (const q of baseGrid(pad, (pad.margin - 0.01) / Math.SQRT2)) expect(applyPads([pad], q, R, 0.37)).toBeCloseTo(planeHeight(pad, q, R), 12);
    for (const q of padOutline(pad, pad.margin + pad.skirt + 0.02, R)) expect(applyPads([pad], q, R, 0.37)).toBe(0.37);
    const dir = new Vector3().crossVectors(pad.n, pad.z).normalize();
    let prev = applyPads([pad], pad.n, R, 0.37);
    for (let s = 0.02; s < 3.5; s += 0.02) {
      const h = applyPads([pad], moveAlong(pad.n, dir, s / R), R, 0.37);
      expect(Math.abs(h - prev)).toBeLessThan(0.02);
      prev = h;
    }
  });

  it('rises with the planet’s curve away from the centre (a plane, not a sphere)', () => {
    const edge = moveAlong(pad.n, pad.z, 1.2 / R);
    expect(planeHeight(pad, edge, R) - pad.h).toBeCloseTo((R + pad.h) / Math.cos(1.2 / R) - R - pad.h, 9);
    expect(planeHeight(pad, edge, R) - pad.h).toBeGreaterThan(0.07);
  });
});

describe('pads: every structure stands on flat ground', () => {
  const pads = terrain.pads;

  it('covers the landmarks, the home, the chest, the crafting table and the bridge bench', () => {
    const ids = pads.map((p) => p.id);
    for (const g of geos) expect(ids).toContain(`landmark:${g.id}`);
    for (const id of ['house', 'dog-house', 'picnic', 'campfire', 'reading', 'bed-0', 'bed-1', 'tulsi', 'chest', 'craft', 'bench']) expect(ids).toContain(id);
    // both benches: the bridge's and the pond's
    expect(ids.filter((x) => x === 'bench').length).toBe(2);
  });

  it('under each base the ground is that structure’s plane (no neighbour bends it)', () => {
    for (const p of pads) {
      for (const q of baseGrid(p)) expect(Math.abs(terrain.height(q) - planeHeight(p, q, R)), `${p.id}`).toBeLessThan(1e-4);
      if (p.id.startsWith('landmark:')) expect(Math.abs(p.h)).toBeLessThan(0.3);
    }
  });

  it('never lets two flat parts overlap (close neighbours shrink theirs to meet)', () => {
    for (let i = 0; i < pads.length; i++) {
      for (let j = i + 1; j < pads.length; j++) {
        const gap = padGap(pads[i], pads[j], R);
        expect(pads[i].margin + pads[j].margin, `${pads[i].id} / ${pads[j].id}`).toBeLessThanOrEqual(Math.max(0, gap - 0.04) + 1e-9);
        expect(gap, `${pads[i].id} and ${pads[j].id} overlap`).toBeGreaterThan(0.1);
      }
    }
  });

  it('fits each plane to the ground under it: about as much cut as fill, never a plinth in the air', () => {
    for (const p of pads) {
      const pts = [...padSamples(p, 0, R), ...padSamples(p, p.margin, R)];
      const diff = pts.map((q) => planeHeight(p, q, R) - bare.height(q));
      // (a small pad in a bigger one's skirt is fitted to that skirt, so it may sit a little off the natural ground)
      expect(Math.abs(diff.reduce((a, b) => a + b, 0) / diff.length), p.id).toBeLessThan(0.12);
      expect(Math.max(...diff.map(Math.abs)), p.id).toBeLessThan(0.45);
    }
  });

  it('keeps its skirt out of the water, and its flat part off the mesas (whose cliffs it never cuts)', () => {
    for (const p of pads) {
      for (const q of padOutline(p, p.margin + p.skirt, R)) expect(terrain.inWater(q), `${p.id} reaches the water`).toBe(false);
      for (const q of padOutline(p, p.margin, R)) {
        for (const m of layout.mesas) expect(arcDistance(q, m.n, R) - mesaRadius(m.radiusU, m.seed, mesaPolar(m, q).angle), `${p.id} reaches a mesa`).toBeGreaterThan(0.15);
      }
    }
    for (const m of layout.mesas) expect(terrain.height(m.n)).toBe(bare.height(m.n));
  });

  it('blends smoothly into the land round it (the change it makes has no steps)', () => {
    const lift = (n: Vector3) => terrain.height(n) - bare.height(n);
    for (const p of pads) {
      // two planes a stride apart meet in a gentle crease; a pad on its own blends as smoothly as the land
      const alone = pads.every((o) => o === p || padGap(p, o, R) > p.margin + p.skirt + o.margin + o.skirt);
      for (let a = 0; a < 16; a++) {
        const dir = p.x.clone().multiplyScalar(Math.cos((a / 16) * Math.PI * 2)).addScaledVector(p.z, Math.sin((a / 16) * Math.PI * 2));
        let prev = lift(p.n);
        for (let s = 0.05; s < 4; s += 0.05) {
          const h = lift(moveAlong(p.n, dir, s / R));
          expect(Math.abs(h - prev), p.id).toBeLessThan(alone ? 0.03 : 0.12);
          prev = h;
        }
      }
    }
  });

  it('lays a cobbled apron round each building, with coordinates that run on smoothly past its edge', () => {
    for (const g of geos) {
      const p = pads.find((x) => x.id === `landmark:${g.id}`)!;
      expect(terrain.apron(moveAlong(p.n, p.z, (p.cz + p.bz + 0.2) / R)).w).toBe(1);
      for (let a = 0; a < 12; a++) {
        const dir = p.x.clone().multiplyScalar(Math.cos(a / 1.9)).addScaledVector(p.z, Math.sin(a / 1.9));
        let prev = terrain.apron(p.n);
        let bare = 0;
        // (checked a ground cell and more past where the stones end: the triangles along the edge)
        for (let s = 0.05; s < 4.5 && bare < 0.5; s += 0.05) {
          const ap = terrain.apron(moveAlong(p.n, dir, s / R));
          expect(Math.hypot(ap.x - prev.x, ap.z - prev.z), g.id).toBeLessThan(0.08);
          prev = ap;
          bare = ap.w > 0 ? 0 : bare + 0.05;
        }
        expect(bare).toBeGreaterThan(0.45);
      }
    }
    expect(terrain.apron(new Vector3(0, 1, 0)).w).toBe(0);
  });

  it('leaves the plaza, the paths’ start and the approach points walkable and low', () => {
    for (const g of geos) expect(Math.abs(terrain.height(g.approach))).toBeLessThan(0.3);
    expect(terrain.height(new Vector3(0, 1, 0))).toBe(0);
  });

  it('gives the tulsi its own small round cobbled spot, apart from the house’s', () => {
    const p = pads.find((x) => x.id === 'tulsi')!;
    const house = pads.find((x) => x.id === 'house')!;
    const n = layout.home!.yard.tulsi.n;
    expect(terrain.apron(n).w).toBe(1);
    for (let a = 0; a < 8; a++) {
      const dir = p.x.clone().multiplyScalar(Math.cos(a)).addScaledVector(p.z, Math.sin(a)).normalize();
      // cobbled all round it, and round (the same radius every way), not spilling into a yard
      expect(terrain.apron(moveAlong(n, dir, 0.35 / R)).w).toBe(1);
      const off = moveAlong(n, dir, 1.0 / R);
      const hl = padLocal(house, off, R)!;
      if (boxDistance(house, hl.x, hl.z) > house.apron + 0.4) expect(terrain.apron(off).w).toBe(0);
    }
    // the house's own cobbles stay a narrow band round it
    expect(house.apron).toBeLessThanOrEqual(0.45);
    expect(house.cz + house.bz).toBeLessThan(HOUSE_BASE[3] + 0.01);
  });
});

describe('pads: the base boxes still cover their models', () => {
  const covers = (box: readonly number[], e: readonly number[], name: string) => {
    expect(box[0], `${name} x0`).toBeLessThanOrEqual(e[0] + 1e-6);
    expect(box[1], `${name} x1`).toBeGreaterThanOrEqual(e[1] - 1e-6);
    expect(box[2], `${name} z0`).toBeLessThanOrEqual(e[2] + 1e-6);
    expect(box[3], `${name} z1`).toBeGreaterThanOrEqual(e[3] - 1e-6);
    // and hug them (a stale box that's far too big levels more ground than it needs)
    for (let i = 0; i < 4; i++) expect(Math.abs(box[i] - e[i]), `${name} [${i}]`).toBeLessThan(0.12);
  };

  it('landmarks', () => {
    for (const l of FIXTURE_LANDMARKS) covers(LANDMARK_BASE[l.variant], footprint(landmarkModel(l.variant, l.accent).geo), l.variant);
  });

  it('the cottage, Chopper’s house, the crafting table, the bench and the beds', () => {
    covers(HOUSE_BASE, footprint(houseModel().geo), 'house');
    covers(DOG_HOUSE_BASE, footprint(dogHouseModel('#bf5b43')), 'dog house');
    covers(CRAFT_TABLE_BASE, footprint(craftingTableModel()), 'crafting table');
    covers(BENCH_BASE, footprint(kitOf((k) => bench(k, {}))), 'bench');
    covers(BED_BASE, footprint(kitOf((k) => bed(k, 'cabbage', 1.25, 0.55, 0))), 'bed');
  });
});
