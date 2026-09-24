import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { boulder, chiselledBlob, pebble, rock } from '../../src/game/world/propModels';
import { TEXTURES } from '../../src/game/world/textureManifest';

describe('stones (boulders, rocks, pebbles)', () => {
  it('carry an aMoss weight per vertex: mossy boulders, less on rocks, none on river pebbles', () => {
    const moss = (g: ReturnType<typeof boulder>) => {
      const a = g.getAttribute('aMoss');
      expect(a.count).toBe(g.getAttribute('position').count);
      return a.getX(0);
    };
    expect(moss(boulder())).toBe(1);
    expect(moss(rock())).toBeGreaterThan(0);
    expect(moss(rock())).toBeLessThan(1);
    expect(moss(pebble())).toBe(0);
  });

  it('chiselled blobs have broad flat faces: many triangles lie in the same cutting plane', () => {
    const r = 0.5;
    const coplanar = (g: ReturnType<typeof chiselledBlob>) => {
      const pos = g.getAttribute('position');
      const idx = g.getIndex()!;
      const [a, b, c] = [new Vector3(), new Vector3(), new Vector3()];
      const normals: Vector3[] = [];
      for (let i = 0; i < idx.count; i += 3) {
        a.fromBufferAttribute(pos, idx.getX(i));
        b.fromBufferAttribute(pos, idx.getX(i + 1));
        c.fromBufferAttribute(pos, idx.getX(i + 2));
        normals.push(b.clone().sub(a).cross(c.clone().sub(a)).normalize());
      }
      return normals.filter((n, i) => normals.some((m, j) => j !== i && n.dot(m) > 0.9995)).length;
    };
    // a plain icosphere has no two faces facing the same way; each cut flattens a whole cap
    expect(coplanar(chiselledBlob(r, 2, 0, 11, 0))).toBe(0);
    const g = chiselledBlob(r, 2, 0, 11, 6);
    expect(coplanar(g)).toBeGreaterThanOrEqual(6 * 4);
    // the cuts only remove material: nothing grows beyond the original radius
    const pos = g.getAttribute('position');
    const v = new Vector3();
    for (let i = 0; i < pos.count; i++) expect(v.fromBufferAttribute(pos, i).length()).toBeLessThanOrEqual(r + 1e-6);
  });

  it('use their own non-directional stone mask (not the cliff strata)', () => {
    const e = (TEXTURES as Record<string, { kind: string; mean?: readonly number[] }>).boulder;
    expect(e?.kind).toBe('mask');
    expect(e.mean![0]).toBeGreaterThan(0.1);
  });
});
