import { describe, expect, it } from 'vitest';
import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Matrix4 } from 'three';
import { Kit, SURFACES, SURFACE_TILE_U, colorize, surfaceUV } from '../../src/game/world/kit';
import { gableRoof, hipRoof } from '../../src/game/world/parts';

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

  it("wraps bark with the part's own uv (world units → tiles) and drops the uv afterwards", () => {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    g.setAttribute('uv', new Float32BufferAttribute([0, 0, SURFACE_TILE_U.bark * 2, 0, 0, SURFACE_TILE_U.bark * 3], 2));
    const geo = colorize(g, '#fff');
    surfaceUV(geo, new Matrix4(), 'bark', 4);
    const uv = geo.getAttribute('aSurfUV').array;
    expect(uv[2] - uv[0]).toBeCloseTo(2, 5);
    expect(uv[5] - uv[1]).toBeCloseTo(3, 5);
    expect(geo.getAttribute('aSurf').getX(0)).toBe(SURFACES.indexOf('bark'));
    expect(geo.getAttribute('uv')).toBeUndefined();
    // other surfaces ignore (and drop) a primitive's own uv
    const box = colorize(new BoxGeometry(1, 1, 1), '#fff');
    surfaceUV(box, new Matrix4(), 'wood', 5);
    expect(box.getAttribute('uv')).toBeUndefined();
  });

  it('measures tiles in world units, so scaled parts keep the same texel size', () => {
    const geo = colorize(new BoxGeometry(1, 1, 0.1), '#fff');
    surfaceUV(geo, new Matrix4().makeScale(3, 1, 1), 'plaster', 3);
    const [du] = uvSpan(geo.getAttribute('aSurfUV').array, faceVerts(geo, 2));
    expect(du).toBeCloseTo(3 / SURFACE_TILE_U.plaster, 5);
  });
});

describe('roof shingles', () => {
  /** For every sloped roof triangle: does the texture's v rise up the slope (tabs point down to the eaves)? */
  function checkRoof(build: (k: Kit) => void) {
    const k = new Kit();
    build(k);
    const g = k.build().solid!;
    const pos = g.getAttribute('position');
    const surf = g.getAttribute('aSurf');
    const uv = g.getAttribute('aSurfUV');
    const roof = SURFACES.indexOf('roof');
    let sloped = 0;
    for (let t = 0; t < pos.count; t += 3) {
      if (surf.getX(t) !== roof) continue;
      const P = [0, 1, 2].map((i) => [pos.getX(t + i), pos.getY(t + i), pos.getZ(t + i)]);
      const e1 = P[1].map((c, i) => c - P[0][i]);
      const e2 = P[2].map((c, i) => c - P[0][i]);
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const len = Math.hypot(...n);
      if (len < 1e-9) continue;
      const ny = n[1] / len;
      if (Math.abs(ny) < 0.05 || Math.abs(ny) > 0.95) continue;
      sloped++;
      // the pair of corners with the biggest height difference: v must grow with height
      let best = [0, 1];
      for (const [a, b] of [[0, 1], [1, 2], [0, 2]]) if (Math.abs(P[a][1] - P[b][1]) > Math.abs(P[best[0]][1] - P[best[1]][1])) best = [a, b];
      const [a, b] = P[best[0]][1] > P[best[1]][1] ? best : [best[1], best[0]];
      if (P[a][1] - P[b][1] < 1e-4) continue;
      expect(uv.getY(t + a), `triangle ${t / 3}`).toBeGreaterThan(uv.getY(t + b));
    }
    return sloped;
  }

  it('the Town Hall style hip roof has its shingle rows running up every face, front, back and sides', () => {
    expect(checkRoof((k) => hipRoof(k, { w: 2.2, d: 1.6, h: 0.8, y: 1.3, color: '#5a6ee0', bands: 3, top: 0.3 }))).toBeGreaterThan(20);
  });

  it('gable roofs too', () => {
    expect(checkRoof((k) => gableRoof(k, { w: 1.8, d: 1.4, rise: 0.8, wallTop: 1.2, color: '#e07a4a', wall: '#e6ae76', wallSurface: 'wood', rows: 4 }))).toBeGreaterThan(4);
  });
});
