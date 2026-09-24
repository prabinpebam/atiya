import { BufferGeometry, Color, Float32BufferAttribute, Vector3 } from 'three';
import { CONFIG } from '../config';
import { arcDistance, moveAlong } from '../math/sphere';
import { mesaDir, mesaPolar, mesaRadius, tierEdge, type Mesa } from './features';
import { hash3, mix } from './kit';

/**
 * Cliff walls and mesa caps (pure; unit-tested).
 * - Walls: faceted, layered rock rings around each mesa (and its upper tier). Every face is
 *   wound counter-clockwise seen from outside, so its normal points out of the mesa. The
 *   material is front-sided: inward-wound walls get culled on the near side, and you would see
 *   the far wall's inside (and the ground's steep mesa slope) through the gap.
 * - Caps: the grassy top of each plateau, from its centre out over the rim and drooping a
 *   little over the wall. They are merged into the ground mesh and drawn with the ground
 *   material (Planet.tsx), so a mesa top is exactly the same lawn as the land around it: no
 *   seam, no colour step. A lower cap runs on under its upper tier, whose wall starts below it.
 */

const R = CONFIG.planetRadius;

const STRATA = ['#b59a7c', '#9c8f84', '#c9ae8a', '#8e8279', '#bfa585'];

/** Planet-local point at polar (a, r) around `center` (a mesa or tier centre), `y` u above the base sphere. */
function mesaPoint(center: Vector3, m: Mesa, a: number, r: number, y: number): Vector3 {
  return moveAlong(center, mesaDir(m, center, a), r / R).multiplyScalar(R + y);
}

/** One plateau: a mesa's base or its upper tier. */
interface Plateau {
  m: Mesa;
  center: Vector3;
  /** Nominal radius (u), for tessellation. */
  radius: number;
  /** Outline radius (u) at angle `a`. */
  edge: (a: number) => number;
  seed: number;
  /** Wall foot and top (u above the base sphere). */
  y0: number;
  y1: number;
  /** Extra height of the plateau over the mesa's base top (the tier's height, or 0). */
  lift: number;
}

export function plateaus(m: Mesa): Plateau[] {
  const out: Plateau[] = [{ m, center: m.n, radius: m.radiusU, edge: (a) => mesaRadius(m.radiusU, m.seed, a), seed: m.seed, y0: -0.4, y1: m.heightU, lift: 0 }];
  const t = m.tier;
  if (t) out.push({ m, center: t.n, radius: t.radiusU, edge: (a) => tierEdge(t, a), seed: m.seed + 2.2, y0: m.heightU - 0.12, y1: m.heightU + t.heightU, lift: t.heightU });
  return out;
}

/** Segments around a plateau: shared by its wall and its cap, so the two outlines match. */
function ringCount(radius: number): number {
  return Math.max(24, Math.ceil((Math.PI * 2 * radius) / 0.2));
}

class Tris {
  readonly pos: number[] = [];
  readonly col: number[] = [];
  /** (u, v, rock weight) per vertex for the painted strata texture. */
  readonly ruv: number[] = [];
  tri(a: Vector3, b: Vector3, c: Vector3, color: Color, uv?: [number, number, number, number, number, number], w = 0) {
    this.pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let i = 0; i < 3; i++) this.col.push(color.r, color.g, color.b);
    if (uv) this.ruv.push(uv[0], uv[1], w, uv[2], uv[3], w, uv[4], uv[5], w);
    else this.ruv.push(0, 0, 0, 0, 0, 0, 0, 0, 0);
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
    g.computeVertexNormals(); // non-indexed → flat facets (the chiselled rock look)
    return g;
  }
}

/** Wall texture repeats horizontally about every 1.4 u, rounded so each ring wraps seamlessly. */
const ROCK_TILE_U = 1.4;

/** One wall ring from `y0` to `y1` following the plateau's irregular outline, in rocky strata. */
function wallRing(t: Tris, pl: Plateau) {
  const { m, center, radius, seed, y0, y1 } = pl;
  const count = ringCount(radius);
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
      const r = pl.edge(a) + ledge + jitter + (j === 0 ? 0.08 : 0);
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
}

export function buildCliffs(mesas: readonly Mesa[]): BufferGeometry | null {
  if (!mesas.length) return null;
  const t = new Tris();
  for (const m of mesas) for (const pl of plateaus(m)) wallRing(t, pl);
  return t.build();
}

/** Cap height above the mesa's base top: the ground's gentle dome plus this lift (u). */
const CAP_LIFT_U = 0.015;
/** How far the cap's rim reaches past the outline (it overhangs the wall's top row) and how high it sits over the wall top. */
const RIM_OUT_U = 0.05;
const RIM_UP_U = 0.03;

/**
 * Grassy caps for every plateau, as one indexed geometry in planet-local space (smooth normals,
 * so the rim rolls softly over the edge). `aH` is each vertex's height above the base sphere
 * and `aDroop` is 1 on the drooping rim, for the ground attributes Planet.tsx adds.
 */
export function buildMesaCaps(mesas: readonly Mesa[]): BufferGeometry | null {
  if (!mesas.length) return null;
  const pos: number[] = [];
  const hs: number[] = [];
  const droopW: number[] = [];
  const idx: number[] = [];
  const push = (p: Vector3, y: number, d: number) => {
    pos.push(p.x, p.y, p.z);
    hs.push(y);
    droopW.push(d);
    return hs.length - 1;
  };
  for (const m of mesas) {
    // the mesa top's gentle dome, as in Terrain.height, so the cap stays just above the ground
    const dome = (p: Vector3) => {
      const { r, angle } = mesaPolar(m, p);
      return 0.04 * Math.max(0, 1 - r / mesaRadius(m.radiusU, m.seed, angle));
    };
    for (const pl of plateaus(m)) {
      const count = ringCount(pl.radius);
      const rings = Math.max(3, Math.ceil(pl.radius / 0.2));
      const top = m.heightU + pl.lift;
      const v = new Vector3();
      const at = (a: number, r: number, y: number) => mesaPoint(pl.center, m, a, r, y).normalize();
      const center = push(pl.center.clone().multiplyScalar(R + top + dome(pl.center) + CAP_LIFT_U), top + dome(pl.center) + CAP_LIFT_U, 0);
      const grid: number[][] = [];
      for (let i = 1; i <= rings; i++) {
        const row: number[] = [];
        for (let k = 0; k < count; k++) {
          const a = (k / count) * Math.PI * 2;
          const ro = pl.edge(a) + RIM_OUT_U;
          const u = at(a, (ro * i) / rings, 0);
          // interior follows the dome; the outer ring is the rim crest just over the wall's top
          const y = i === rings ? pl.y1 + RIM_UP_U : top + dome(u) + CAP_LIFT_U;
          row.push(push(v.copy(u).multiplyScalar(R + y), y, 0));
        }
        grid.push(row);
      }
      const droop: number[] = [];
      for (let k = 0; k < count; k++) {
        const a = (k / count) * Math.PI * 2;
        const y = pl.y1 + RIM_UP_U - (0.07 + 0.05 * hash3(k, 7, pl.seed));
        const u = at(a, pl.edge(a) + RIM_OUT_U + 0.02, 0);
        droop.push(push(v.copy(u).multiplyScalar(R + y), y, 1));
      }
      grid.push(droop);
      // counter-clockwise seen from above/outside (angles run north → east, clockwise from above)
      for (let k = 0; k < count; k++) {
        const k2 = (k + 1) % count;
        idx.push(center, grid[0][k2], grid[0][k]);
        for (let i = 0; i < grid.length - 1; i++) {
          const a = grid[i][k];
          const b = grid[i][k2];
          const c = grid[i + 1][k2];
          const d = grid[i + 1][k];
          idx.push(a, b, c, a, c, d);
        }
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('aH', new Float32BufferAttribute(hs, 1));
  g.setAttribute('aDroop', new Float32BufferAttribute(droopW, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** True if `n` (planet-local unit) is within `pad` u of any plateau rim (base or tier), inside or out. */
export function nearPlateauRim(mesas: readonly Mesa[], n: Vector3, inside: number, outside: number): boolean {
  for (const m of mesas) {
    for (const pl of plateaus(m)) {
      const d = arcDistance(n, pl.center, R);
      if (d > pl.radius * 1.4 + outside) continue;
      const { angle } = mesaPolar({ n: pl.center, north: m.north, east: m.east }, n);
      const e = d - pl.edge(angle);
      if (e > -inside && e < outside) return true;
    }
  }
  return false;
}
