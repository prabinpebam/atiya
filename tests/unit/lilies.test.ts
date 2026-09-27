import { describe, expect, it } from 'vitest';
import { Color, Vector3, type BufferGeometry } from 'three';
import { LILY_VARIANTS, lilyCluster, lilyPadGeometry } from '../../src/game/world/home/lilies';

/** Face normals (from the winding) of a geometry's triangles. */
function faces(g: BufferGeometry): Array<{ n: Vector3; c: Vector3; low: number }> {
  const t = g.index ? g.toNonIndexed() : g;
  const p = t.getAttribute('position');
  const out: Array<{ n: Vector3; c: Vector3; low: number }> = [];
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i);
    b.fromBufferAttribute(p, i + 1);
    c.fromBufferAttribute(p, i + 2);
    const n = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a));
    if (n.lengthSq() > 1e-14) out.push({ n: n.normalize(), c: a.clone().add(b).add(c).divideScalar(3), low: Math.min(a.y, b.y, c.y) });
  }
  return out;
}

describe('water lilies (modelled, no texture)', () => {
  it('a pad faces up, with a notch cut in to its centre and a skirt round its rim facing out', () => {
    const g = lilyPadGeometry();
    const f = faces(g);
    const top = f.filter((x) => x.low > 0);
    const skirt = f.filter((x) => x.low <= 0);
    expect(top.length).toBeGreaterThan(100);
    for (const x of top) expect(x.n.y, 'top faces up').toBeGreaterThan(0.8);
    for (const x of skirt) expect(x.n.x * x.c.x + x.n.z * x.c.z, 'skirt faces out').toBeGreaterThan(0);
    // nothing in the notch (along +x, where the leaf is split)
    for (const x of top) expect(Math.abs(Math.atan2(-x.c.z, x.c.x)) > 0.1 || Math.hypot(x.c.x, x.c.z) < 0.15).toBe(true);
  });

  it('every cluster has pads and a bloom or a bud, is cheap, and brings no texture coordinates', () => {
    for (let v = 0; v < LILY_VARIANTS; v++) {
      const g = lilyCluster(v);
      const tris = (g.index ? g.index.count : g.getAttribute('position').count) / 3;
      expect(tris, `variant ${v}`).toBeLessThan(2500);
      const col = g.getAttribute('color');
      const c = new Color();
      let pink = 0;
      let white = 0;
      let green = 0;
      for (let i = 0; i < col.count; i++) {
        c.fromBufferAttribute(col, i);
        if (c.r > 0.8 && c.g < 0.75 && c.b > 0.45) pink++;
        else if (c.r > 0.9 && c.g > 0.9 && c.b > 0.85) white++;
        else if (c.g > c.r * 1.2 && c.g > c.b) green++;
      }
      expect(green, `variant ${v} pads`).toBeGreaterThan(200);
      expect(pink + white, `variant ${v} petals`).toBeGreaterThan(20);
      // it all floats at the water: nothing sinks below the pads' skirts or stands tall
      g.computeBoundingBox();
      expect(g.boundingBox!.min.y).toBeGreaterThan(-0.02);
      expect(g.boundingBox!.max.y).toBeLessThan(0.25);
    }
    // a pink bloom on one, a white one on another
    const tints = [0, 1].map((v) => {
      const col = lilyCluster(v).getAttribute('color');
      let max = 0;
      const c = new Color();
      for (let i = 0; i < col.count; i++) max = Math.max(max, c.fromBufferAttribute(col, i).r - c.g);
      return max;
    });
    expect(tints[0]).toBeGreaterThan(0.3);
    expect(tints[1]).toBeLessThan(tints[0]);
  });
});
