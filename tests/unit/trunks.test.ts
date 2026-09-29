import { describe, expect, it } from 'vitest';
import { Vector3, type BufferGeometry } from 'three';
import { cedar, hardwood } from '../../src/game/world/trees';
import { SURFACES } from '../../src/game/world/kit';

const BARK = SURFACES.indexOf('bark');

/** The kit indexes its output; these checks walk plain triangles. */
const flat = <T extends { solid: BufferGeometry }>(t: T): T => ({ ...t, solid: t.solid.index ? t.solid.toNonIndexed() : t.solid });

/** Triangles (vertex indices) of the merged solid geometry that are tagged as bark. */
function barkTris(g: BufferGeometry): number[] {
  const s = g.getAttribute('aSurf');
  const out: number[] = [];
  for (let t = 0; t < s.count; t += 3) if (s.getX(t) === BARK) out.push(t);
  return out;
}

const trees = [
  ['hardwood', flat(hardwood()), 250],
  ['cedar 0', flat(cedar(0)), 120],
  ['cedar 1', flat(cedar(1)), 120],
] as const;

describe('tree trunks', () => {
  it('stay within a low triangle budget (detail comes from the bark texture)', () => {
    for (const [name, tree, budget] of trees) {
      const n = barkTris(tree.solid).length;
      expect(n, name).toBeGreaterThan(40);
      expect(n, name).toBeLessThanOrEqual(budget);
    }
  });

  it('wrap the bark tile round each tube without a seam jump inside any triangle', () => {
    for (const [name, tree] of trees) {
      const uv = tree.solid.getAttribute('aSurfUV');
      for (const t of barkTris(tree.solid)) {
        const us = [0, 1, 2].map((k) => uv.getX(t + k));
        const vs = [0, 1, 2].map((k) => uv.getY(t + k));
        expect(Math.max(...us) - Math.min(...us), name).toBeLessThan(1);
        expect(Math.max(...vs) - Math.min(...vs), name).toBeLessThan(1.5);
      }
    }
  });

  it('face outwards at the roots and base (no inside-out root flare)', () => {
    for (const [name, tree] of trees) {
      const pos = tree.solid.getAttribute('position');
      const a = new Vector3();
      const b = new Vector3();
      const c = new Vector3();
      let faces = 0;
      for (const t of barkTris(tree.solid)) {
        a.fromBufferAttribute(pos, t);
        b.fromBufferAttribute(pos, t + 1);
        c.fromBufferAttribute(pos, t + 2);
        const centre = a.clone().add(b).add(c).divideScalar(3);
        if (centre.y > 0.5) continue; // limbs and twigs branch off higher up
        const n = b.clone().sub(a).cross(c.clone().sub(a));
        expect(n.dot(centre.setY(0)), name).toBeGreaterThan(0);
        faces++;
      }
      expect(faces, name).toBeGreaterThan(30);
    }
  });

  it('are smooth-shaded along the stem (shared normals, not per-facet)', () => {
    const g = flat(hardwood()).solid;
    const pos = g.getAttribute('position');
    const nor = g.getAttribute('normal');
    const byPos = new Map<string, Set<string>>();
    for (const t of barkTris(g)) {
      for (let k = 0; k < 3; k++) {
        const i = t + k;
        if (pos.getY(i) < 0.9) continue;
        const key = [pos.getX(i), pos.getY(i), pos.getZ(i)].map((v) => v.toFixed(4)).join();
        const n = [nor.getX(i), nor.getY(i), nor.getZ(i)].map((v) => v.toFixed(3)).join();
        if (!byPos.has(key)) byPos.set(key, new Set());
        byPos.get(key)!.add(n);
      }
    }
    const shared = [...byPos.values()].filter((s) => s.size === 1).length;
    expect(shared / byPos.size).toBeGreaterThan(0.8);
  });
});
