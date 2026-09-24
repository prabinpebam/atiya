import { describe, expect, it } from 'vitest';
import { BoxGeometry, Matrix4 } from 'three';
import { Kit, SURFACES, SURFACE_TILE_U, colorize, surfaceUV } from '../../src/game/world/kit';

/** UV span (max − min) of the given triangles' vertices, per axis. */
function uvSpan(uv: ArrayLike<number>, verts: number[]): [number, number] {
  const u = verts.map((v) => uv[v * 2]);
  const w = verts.map((v) => uv[v * 2 + 1]);
  return [Math.max(...u) - Math.min(...u), Math.max(...w) - Math.min(...w)];
}

/** Vertex indices of the triangles whose face normal is closest to `axis` (0 = x, 1 = y, 2 = z). */
function faceVerts(geo: ReturnType<typeof colorize>, axis: number): number[] {
  const nor = geo.getAttribute('normal');
  const out: number[] = [];
  for (let v = 0; v < nor.count; v++) if (Math.abs([nor.getX(v), nor.getY(v), nor.getZ(v)][axis]) > 0.9) out.push(v);
  return out;
}

describe('kit surfaces', () => {
  it('tags every part with its surface and in-tile coordinates', () => {
    const k = new Kit();
    k.box([1, 1, 1], '#fff');
    k.surface('roof', () => k.box([1, 1, 1], '#fff'));
    k.surface('wood', () => {
      k.surface('metal', () => k.box([0.1, 0.1, 0.1], '#fff'));
      k.box([1, 0.1, 0.1], '#fff');
    });
    const g = k.build().solid!;
    const ids = new Set(Array.from(g.getAttribute('aSurf').array as Float32Array));
    expect([...ids].sort((a, b) => a - b)).toEqual([0, 1, 2, 6]);
    expect(SURFACES[2]).toBe('roof');
    expect(SURFACES[6]).toBe('metal');
    expect(g.getAttribute('aSurfUV').itemSize).toBe(2);
  });

  it('runs wood grain along the long axis of a plank, whatever its orientation', () => {
    for (const size of [
      [2, 0.1, 0.2],
      [0.2, 2, 0.1],
    ] as [number, number, number][]) {
      const geo = colorize(new BoxGeometry(...size), '#fff');
      surfaceUV(geo, new Matrix4(), 'wood', 1);
      const uv = geo.getAttribute('aSurfUV').array;
      // the broad face of the plank: normal along its thinnest axis
      const face = faceVerts(geo, size.indexOf(Math.min(...size)));
      const [du, dv] = uvSpan(uv, face);
      expect(du).toBeCloseTo(2 / SURFACE_TILE_U.wood, 5);
      expect(dv).toBeLessThan(du / 5);
    }
  });

  it('keeps brick courses horizontal on a wall even when the wall is taller than wide', () => {
    const geo = colorize(new BoxGeometry(1, 3, 0.2), '#fff');
    surfaceUV(geo, new Matrix4(), 'brick', 2);
    const [du, dv] = uvSpan(geo.getAttribute('aSurfUV').array, faceVerts(geo, 2));
    // u across the (level) width, v up the height
    expect(du).toBeCloseTo(1 / SURFACE_TILE_U.brick, 5);
    expect(dv).toBeCloseTo(3 / SURFACE_TILE_U.brick, 5);
  });

  it('measures tiles in world units, so scaled parts keep the same texel size', () => {
    const geo = colorize(new BoxGeometry(1, 1, 0.1), '#fff');
    surfaceUV(geo, new Matrix4().makeScale(3, 1, 1), 'plaster', 3);
    const [du] = uvSpan(geo.getAttribute('aSurfUV').array, faceVerts(geo, 2));
    expect(du).toBeCloseTo(3 / SURFACE_TILE_U.plaster, 5);
  });
});
