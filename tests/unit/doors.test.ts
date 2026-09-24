import { describe, expect, it } from 'vitest';
import { BufferGeometry, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { landmarkModel, type LandmarkModel } from '../../src/game/world/models';
import { CURTAIN_FLOOR, DOOR, curtainColumn, stepOpen } from '../../src/game/world/doors';
import type { DoorLeaf } from '../../src/game/world/parts';

const HOUSES = ['workshop', 'town-hall', 'lighthouse', 'library', 'greenhouse', 'post-office'];
const mat = new MeshBasicMaterial();

/** z of the first front-facing hit along a ray toward −z (null when it sees straight through). */
function firstHitZ(geos: (BufferGeometry | null)[], x: number, y: number): number | null {
  const rc = new Raycaster(new Vector3(x, y, 6), new Vector3(0, 0, -1));
  const hits = rc.intersectObjects(geos.filter((g): g is BufferGeometry => !!g).map((g) => new Mesh(g, mat)));
  return hits.length ? hits[0].point.z : null;
}

/** A leaf's solid and glass parts swung by `angle` about its hinge. */
function leafAt(l: DoorLeaf, angle: number): BufferGeometry[] {
  return [l.geo.solid, l.geo.glass]
    .filter((g): g is BufferGeometry => !!g)
    .map((src) => {
      const g = src.clone();
      g.applyMatrix4(new Matrix4().makeRotationY(l.dir * angle));
      g.applyMatrix4(new Matrix4().makeTranslation(l.hinge[0], l.hinge[1], l.hinge[2]));
      return g;
    });
}

/** Sample points across the doorway (±`spread` of its width), from above the sill (and any portico floor) to below the head. */
function doorwaySamples(m: LandmarkModel, spread = 0.3): [number, number][] {
  const xs = m.doors!.map((l) => l.hinge[0]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const w = x1 - x0 || m.spill!.w;
  const cx = xs.length > 1 ? (x0 + x1) / 2 : x0 + (m.doors![0].dir * w) / 2;
  const y0 = m.doors![0].hinge[1];
  const out: [number, number][] = [];
  for (const fx of [-spread, 0, spread]) for (const dy of [0.16, 0.33, 0.5]) out.push([cx + fx * w, y0 + dy]);
  return out;
}

describe('landmark doors', () => {
  it('every house has swinging door leaves, a light and a spill of lamplight; rooms behind solid walls', () => {
    for (const v of HOUSES) {
      const m = landmarkModel(v, '#888888');
      expect(m.doors?.length, v).toBeGreaterThan(0);
      expect(m.light, v).toBeDefined();
      expect(m.spill, v).toBeDefined();
      if (v !== 'greenhouse') expect(m.interior?.solid, v).toBeTruthy(); // the greenhouse is glass: its plants are always on show
    }
  });

  it('the doorway is a real opening in the wall: with the leaves away you see deep into the building', () => {
    for (const v of HOUSES) {
      const m = landmarkModel(v, '#888888');
      const hz = m.doors![0].hinge[2];
      for (const [x, y] of doorwaySamples(m)) {
        const z = firstHitZ([m.geo.solid, m.geo.glass], x, y);
        if (z !== null) expect(z, `${v} @ ${x.toFixed(2)},${y.toFixed(2)}`).toBeLessThan(hz - 0.12);
      }
    }
  });

  it('shut, the leaves close the doorway; open, they swing inside and clear it', () => {
    for (const v of HOUSES) {
      const m = landmarkModel(v, '#888888');
      const hz = m.doors![0].hinge[2];
      const shut = m.doors!.flatMap((l) => leafAt(l, 0));
      const open = m.doors!.flatMap((l) => leafAt(l, DOOR.swing));
      for (const [x, y] of doorwaySamples(m)) {
        const z = firstHitZ(shut, x, y);
        expect(z, `${v} shut`).not.toBeNull();
        expect(z!, v).toBeGreaterThan(hz - 0.01);
        expect(z!, v).toBeLessThan(hz + 0.2);
      }
      // open leaves stand along the jambs (their thickness takes the outer edges of the doorway)
      for (const [x, y] of doorwaySamples(m, 0.2)) {
        const zo = firstHitZ(open, x, y);
        if (zo !== null) expect(zo, `${v} open`).toBeLessThan(hz - 0.1);
      }
      for (const g of open) {
        g.computeBoundingBox();
        expect(g.boundingBox!.max.z, `${v}: an open leaf stays behind the front of the wall`).toBeLessThan(hz + 0.06);
      }
    }
  });

  it('openness moves steadily, takes DOOR.seconds, never overshoots, and snaps under reduced motion', () => {
    let o = 0;
    let frames = 0;
    while (o < 1 && frames < 200) {
      o = stepOpen(o, 1, 1 / 60, false);
      frames++;
    }
    expect(frames / 60).toBeCloseTo(DOOR.seconds, 1);
    expect(stepOpen(1, 1, 1 / 60, false)).toBe(1);
    expect(stepOpen(0, 0, 1 / 60, false)).toBe(0);
    expect(stepOpen(0.5, 0, 1 / 60, false)).toBeLessThan(0.5);
    expect(stepOpen(0.2, 1, 1 / 60, true)).toBe(1);
    expect(stepOpen(0.8, 0, 1 / 60, true)).toBe(0);
  });
});

describe('amphitheater curtain', () => {
  const spec = landmarkModel('amphitheater', '#888888').curtain!;

  it('has no door, but a curtain and stage spotlights', () => {
    const m = landmarkModel('amphitheater', '#888888');
    expect(m.doors).toBeUndefined();
    expect(m.curtain).toBeDefined();
    expect(m.spots?.from.length).toBe(2);
  });

  it('shut, it reaches the floor under the whole arch; open, the hem rises into scallops near the top', () => {
    for (let i = 0; i <= 40; i++) {
      const u = i / 40;
      const c = curtainColumn(u, 0, spec.r, spec.p[1]);
      expect(c.bottom).toBe(CURTAIN_FLOOR);
      expect(c.top).toBeGreaterThanOrEqual(spec.p[1] - 1e-9);
      const o = curtainColumn(u, 1, spec.r, spec.p[1]);
      expect(o.top).toBeCloseTo(c.top, 9);
      if (o.top - 0.3 > CURTAIN_FLOOR) {
        expect(o.bottom).toBeGreaterThan(o.top - 0.3);
        expect(o.bottom).toBeLessThan(o.top - 0.1);
      }
    }
    // centre of the arch: open by more than 3/4 of its height
    const mid = curtainColumn(0.5, 1, spec.r, spec.p[1]);
    expect((mid.bottom - CURTAIN_FLOOR) / (mid.top - CURTAIN_FLOOR)).toBeGreaterThan(0.75);
    // the hem is highest at the lift cords and sags between them
    expect(curtainColumn(0.4, 1, spec.r, spec.p[1]).bottom).toBeGreaterThan(curtainColumn(0.5, 1, spec.r, spec.p[1]).bottom);
  });
});
