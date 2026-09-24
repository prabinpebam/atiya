import { BufferGeometry, Color, Float32BufferAttribute, Vector3 } from 'three';
import { CONFIG } from '../config';
import { moveAlong } from '../math/sphere';
import { mesaRadius, type Mesa } from './features';
import { hash3, mix } from './kit';

/**
 * Cliff walls (pure; unit-tested): faceted, layered rock rings around each mesa with a grassy lip.
 * Every face is wound counter-clockwise seen from outside, so its normal points out of the
 * mesa. The material is front-sided: inward-wound walls get culled on the near side, and you
 * would see the far wall's inside (and the ground's steep mesa slope) through the gap.
 */

const R = CONFIG.planetRadius;

const STRATA = ['#b59a7c', '#9c8f84', '#c9ae8a', '#8e8279', '#bfa585'];

function dirAt(m: Mesa, a: number): Vector3 {
  return m.north.clone().multiplyScalar(Math.cos(a)).addScaledVector(m.east, Math.sin(a)).normalize();
}

/** Planet-local point at polar (a, r) around a mesa, `y` u above the base sphere. */
function mesaPoint(center: Vector3, m: Mesa, a: number, r: number, y: number): Vector3 {
  return moveAlong(center, dirAt(m, a), r / R).normalize().multiplyScalar(R + y);
}

class Tris {
  readonly pos: number[] = [];
  readonly col: number[] = [];
  /** (u, v, rock weight) per vertex for the painted strata texture. */
  readonly ruv: number[] = [];
  /** Grass weight per vertex (1 on the lip, which has no rock UVs). */
  readonly lip: number[] = [];
  tri(a: Vector3, b: Vector3, c: Vector3, color: Color, uv?: [number, number, number, number, number, number], w = 0) {
    this.pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let i = 0; i < 3; i++) this.col.push(color.r, color.g, color.b);
    if (uv) this.ruv.push(uv[0], uv[1], w, uv[2], uv[3], w, uv[4], uv[5], w);
    else this.ruv.push(0, 0, 0, 0, 0, 0, 0, 0, 0);
    const l = uv ? 0 : 1;
    this.lip.push(l, l, l);
  }
  /** Quad a-b-c-d; `uv` gives (u, v) for a, b, c, d. */
  quad(a: Vector3, b: Vector3, c: Vector3, d: Vector3, color: Color, uv?: [number, number][], w = 0) {
    this.tri(a, b, c, color, uv && [...uv[0], ...uv[1], ...uv[2]], w);
    this.tri(a, c, d, color, uv && [...uv[0], ...uv[2], ...uv[3]], w);
  }
  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3));
    g.setAttribute('aRockUV', new Float32BufferAttribute(this.ruv, 3));
    g.setAttribute('aLip', new Float32BufferAttribute(this.lip, 1));
    g.computeVertexNormals(); // non-indexed → flat facets (the chiselled rock look)
    return g;
  }
}

/** Wall texture repeats horizontally about every 1.4 u, rounded so each ring wraps seamlessly. */
const ROCK_TILE_U = 1.4;

/** One wall ring from `y0` to `y1` following an irregular outline, in rocky strata. */
function wallRing(t: Tris, m: Mesa, center: Vector3, radius: number, seed: number, y0: number, y1: number) {
  const count = Math.max(24, Math.ceil((Math.PI * 2 * radius) / 0.2));
  const layers = Math.max(3, Math.round((y1 - y0) / 0.24));
  const pts: Vector3[][] = [];
  for (let j = 0; j <= layers; j++) {
    const f = j / layers;
    const y = y0 + (y1 - y0) * f;
    // strata ledges: each band bulges at its base and tucks in at its top
    const band = (f * layers) % 1;
    const ledge = j === layers ? -0.02 : 0.07 - 0.07 * band;
    const row: Vector3[] = [];
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2;
      const jitter = (hash3(k * 1.7, j * 3.1, seed) - 0.5) * 0.09;
      const r = mesaRadius(radius, seed, a) + ledge + jitter + (j === 0 ? 0.08 : 0);
      row.push(mesaPoint(center, m, a, r, y));
    }
    pts.push(row);
  }
  const c = new Color();
  // u in tiles around the ring (integer total, so it wraps without a seam), v in tiles up the wall
  const reps = Math.max(1, Math.round((Math.PI * 2 * radius) / ROCK_TILE_U));
  const uAt = (k: number) => (k / count) * reps;
  const vAt = (j: number) => (y0 + ((y1 - y0) * j) / layers) / ROCK_TILE_U;
  for (let j = 0; j < layers; j++) {
    const base = STRATA[(j + Math.floor(seed * 3)) % STRATA.length];
    for (let k = 0; k < count; k++) {
      const k2 = (k + 1) % count;
      c.set(mix(base, '#ffffff', (hash3(k, j, seed + 1) - 0.5) * 0.12 + 0.02));
      // up first, then around: counter-clockwise seen from outside, so the face points outwards
      t.quad(pts[j][k], pts[j + 1][k], pts[j + 1][k2], pts[j][k2], c, [
        [uAt(k), vAt(j)],
        [uAt(k), vAt(j + 1)],
        [uAt(k + 1), vAt(j + 1)],
        [uAt(k + 1), vAt(j)],
      ], 1);
    }
  }
  // grassy lip: a lumpy green band over the rim, drooping slightly over the edge
  const lipCount = count;
  const green = new Color('#86c653');
  const greenDark = new Color('#6fae4a');
  for (let k = 0; k < lipCount; k++) {
    const a0 = (k / lipCount) * Math.PI * 2;
    const a1 = ((k + 1) / lipCount) * Math.PI * 2;
    const droop0 = 0.07 + 0.05 * hash3(k, 7, seed);
    const droop1 = 0.07 + 0.05 * hash3(k + 1 === lipCount ? 0 : k + 1, 7, seed);
    const r0o = mesaRadius(radius, seed, a0) + 0.05;
    const r1o = mesaRadius(radius, seed, a1) + 0.05;
    const top = y1 + 0.03;
    const oA = mesaPoint(center, m, a0, r0o, top);
    const oB = mesaPoint(center, m, a1, r1o, top);
    const iA = mesaPoint(center, m, a0, r0o - 0.32, top);
    const iB = mesaPoint(center, m, a1, r1o - 0.32, top);
    const dA = mesaPoint(center, m, a0, r0o + 0.02, top - droop0);
    const dB = mesaPoint(center, m, a1, r1o + 0.02, top - droop1);
    // lip top faces up, the drooping edge faces out
    t.quad(iA, iB, oB, oA, green);
    t.quad(oA, oB, dB, dA, greenDark);
  }
}

export function buildCliffs(mesas: readonly Mesa[]): BufferGeometry | null {
  if (!mesas.length) return null;
  const t = new Tris();
  for (const m of mesas) {
    wallRing(t, m, m.n, m.radiusU, m.seed, -0.4, m.heightU);
    if (m.tier) wallRing(t, m, m.tier.n, m.tier.radiusU, m.seed + 2.2, m.heightU - 0.12, m.heightU + m.tier.heightU);
  }
  return t.build();
}
