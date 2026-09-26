import { Vector3 } from 'three';
import type { GrassRules, GroundSurface } from './zones';

/**
 * Blade, flower and tall-grass-card placement on the real ground mesh (docs:
 * documentation/poc-3d-navigation/vegetation/spec.md §4). Pure: the zone rules are sampled once per
 * ground vertex, and each triangle then gets a seeded, jittered share of blades whose density,
 * height, hue and wear are interpolated from its corners, so the grass sits exactly on the drawn
 * ground and follows every zone.
 */

/** Blades per instance of the batched draw (the vertex shader finds its blade as batch × BATCH + vertex / 5). */
export const BATCH = 256;
/** Texel rows of the packed data textures are this wide. */
export const TEX_W = 1024;

export interface GroundMesh {
  /** Planet-local vertex positions (displaced ground; xyz per vertex). */
  pos: ArrayLike<number>;
  /** Linear vertex colours (rgb per vertex). */
  color: ArrayLike<number>;
  /** Surface weights per vertex: path, plaza, cobble, sand. */
  surf: ArrayLike<number>;
  /** Riverbed, wet bank, steepness, height. */
  surf2: ArrayLike<number>;
  index: ArrayLike<number>;
  /** Only triangles whose index position (triangle number) is below this are used (the mesa caps come after). */
  triangles?: number;
  /** Triangles to skip (the sphere under a mesa cap). */
  skip?: (tri: number) => boolean;
}

export interface VertexGrass {
  density: Float32Array;
  height: Float32Array;
  tall: Float32Array;
  wear: Float32Array;
  hue: Float32Array;
  flowers: Float32Array;
}

/** Packed per-item data: `root` xyz floats, `meta` packed bits, `colour` rgba8 (rgb = √linear). */
export interface Packed {
  count: number;
  /** Count padded to whole batches (the padding is zero-height). */
  padded: number;
  root: Float32Array;
  meta: Uint32Array;
  colour: Uint8Array;
}

export interface GrassOptions {
  seed: number;
  /** Blades per u² at full density. */
  bladesPerU2: number;
  /** Most blades. */
  maxBlades: number;
  flowersPerU2: number;
  maxFlowers: number;
  /** Knee-high tufts (3–4 painted blades on one camera-facing card) per u² at full tallness. */
  tuftsPerU2: number;
  maxTufts: number;
  /** Tuft sprite variants in the atlas. */
  cells: number;
}

export interface GrassField {
  blades: Packed;
  flowers: Packed;
  /** meta: mirror | card height | cell (width bits = cell / 63) | lean. */
  tufts: Packed;
}

export function vertexGrass(g: GroundMesh, rules: GrassRules): VertexGrass {
  const n = g.pos.length / 3;
  const out: VertexGrass = {
    density: new Float32Array(n),
    height: new Float32Array(n),
    tall: new Float32Array(n),
    wear: new Float32Array(n),
    hue: new Float32Array(n),
    flowers: new Float32Array(n),
  };
  const u = new Vector3();
  const s: GroundSurface = { path: 0, plaza: 0, cobble: 0, sand: 0, bed: 0, bank: 0, steep: 0 };
  for (let i = 0; i < n; i++) {
    u.set(g.pos[i * 3], g.pos[i * 3 + 1], g.pos[i * 3 + 2]).normalize();
    s.path = g.surf[i * 4];
    s.plaza = g.surf[i * 4 + 1];
    s.cobble = g.surf[i * 4 + 2];
    s.sand = g.surf[i * 4 + 3];
    s.bed = g.surf2[i * 4];
    s.bank = g.surf2[i * 4 + 1];
    s.steep = g.surf2[i * 4 + 2];
    const v = rules.sample(u, s);
    out.density[i] = v.density;
    out.height[i] = v.height;
    out.tall[i] = v.tall;
    out.wear[i] = v.wear;
    out.hue[i] = v.hue;
    out.flowers[i] = v.flowers;
  }
  return out;
}

/** Deterministic PRNG (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash3(x: number, y: number, z: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// meta bits: yaw 10 | height 8 | width (or size) 6 | lean (or palette) 8
export const META = { yaw: 1023, height: 255, width: 63, lean: 255, maxH: 0.6 } as const;

export function packMeta(yaw: number, height: number, width: number, lean: number): number {
  const a = Math.round(((((yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2)) * META.yaw) & META.yaw;
  const h = Math.round(Math.min(1, Math.max(0, height / META.maxH)) * META.height);
  const w = Math.round(Math.min(1, Math.max(0, width)) * META.width);
  const l = Math.round(Math.min(1, Math.max(0, lean)) * META.lean);
  return (a | (h << 10) | (w << 18) | (l << 24)) >>> 0;
}

export function unpackMeta(m: number): { yaw: number; height: number; width: number; lean: number } {
  return {
    yaw: ((m & META.yaw) / META.yaw) * Math.PI * 2,
    height: (((m >>> 10) & META.height) / META.height) * META.maxH,
    width: ((m >>> 18) & META.width) / META.width,
    lean: ((m >>> 24) & META.lean) / META.lean,
  };
}

class Builder {
  count = 0;
  readonly root: Float32Array;
  readonly meta: Uint32Array;
  readonly colour: Uint8Array;
  constructor(readonly cap: number) {
    // room for the cap plus the padding to a whole batch, so pack() needs no copy
    const n = Math.max(BATCH, Math.ceil(cap / BATCH) * BATCH);
    this.root = new Float32Array(n * 3);
    this.meta = new Uint32Array(n);
    this.colour = new Uint8Array(n * 4);
  }
  push(x: number, y: number, z: number, meta: number, r: number, g: number, b: number, a: number): void {
    const i = this.count++;
    this.root[i * 3] = x;
    this.root[i * 3 + 1] = y;
    this.root[i * 3 + 2] = z;
    this.meta[i] = meta;
    const c = this.colour;
    c[i * 4] = Math.sqrt(Math.min(1, Math.max(0, r))) * 255 + 0.5;
    c[i * 4 + 1] = Math.sqrt(Math.min(1, Math.max(0, g))) * 255 + 0.5;
    c[i * 4 + 2] = Math.sqrt(Math.min(1, Math.max(0, b))) * 255 + 0.5;
    c[i * 4 + 3] = Math.min(1, Math.max(0, a)) * 255 + 0.5;
  }
  pack(): Packed {
    const count = this.count;
    const padded = Math.max(BATCH, Math.ceil(count / BATCH) * BATCH);
    const root = this.root.subarray(0, padded * 3);
    // the padding repeats the last root with zero height (never at the planet's centre)
    const last = count > 0 ? [root[count * 3 - 3], root[count * 3 - 2], root[count * 3 - 1]] : [0, 10, 0];
    for (let i = count; i < padded; i++) root.set(last, i * 3);
    return { count, padded, root, meta: this.meta.subarray(0, padded), colour: this.colour.subarray(0, padded * 4) };
  }
}

const PALETTE: ReadonlyArray<readonly [number, number, number]> = [
  [0.95, 0.93, 0.86],
  [1.0, 0.72, 0.18],
  [0.95, 0.52, 0.62],
  [0.66, 0.52, 0.92],
  [0.45, 0.6, 0.95],
];

export function placeGrass(g: GroundMesh, vg: VertexGrass, opt: GrassOptions): GrassField {
  const rand = rng(opt.seed);
  const idx = g.index;
  const tris = Math.min(idx.length / 3, g.triangles ?? Infinity);
  const P = g.pos;
  const C = g.color;
  // the expected count sets the scale so the caps hold
  const area = new Float32Array(tris);
  let wantB = 0;
  let wantF = 0;
  let wantC = 0;
  for (let t = 0; t < tris; t++) {
    if (g.skip?.(t)) continue;
    const a = idx[t * 3];
    const b = idx[t * 3 + 1];
    const c = idx[t * 3 + 2];
    const ux = P[b * 3] - P[a * 3];
    const uy = P[b * 3 + 1] - P[a * 3 + 1];
    const uz = P[b * 3 + 2] - P[a * 3 + 2];
    const vx = P[c * 3] - P[a * 3];
    const vy = P[c * 3 + 1] - P[a * 3 + 1];
    const vz = P[c * 3 + 2] - P[a * 3 + 2];
    const ar = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
    area[t] = ar;
    wantB += ar * (vg.density[a] + vg.density[b] + vg.density[c]) / 3;
    wantF += ar * (vg.flowers[a] + vg.flowers[b] + vg.flowers[c]) / 3;
    wantC += ar * (vg.tall[a] + vg.tall[b] + vg.tall[c]) / 3;
  }
  const kB = Math.min(opt.bladesPerU2, opt.maxBlades / Math.max(1, wantB));
  const kF = Math.min(opt.flowersPerU2, opt.maxFlowers / Math.max(1, wantF));
  const kC = Math.min(opt.tuftsPerU2, opt.maxTufts / Math.max(1, wantC));

  const blades = new Builder(opt.maxBlades);
  const flowers = new Builder(opt.maxFlowers);
  const tufts = new Builder(opt.maxTufts);
  const lerp3 = (arr: ArrayLike<number>, a: number, b: number, c: number, wa: number, wb: number, wc: number, k: number) => arr[a * 3 + k] * wa + arr[b * 3 + k] * wb + arr[c * 3 + k] * wc;
  const lerp1 = (arr: Float32Array, a: number, b: number, c: number, wa: number, wb: number, wc: number) => arr[a] * wa + arr[b] * wb + arr[c] * wc;

  for (let t = 0; t < tris; t++) {
    const ar = area[t];
    if (ar <= 0) continue;
    const a = idx[t * 3];
    const b = idx[t * 3 + 1];
    const c = idx[t * 3 + 2];
    const dMax = Math.max(vg.density[a], vg.density[b], vg.density[c]);
    const fMax = Math.max(vg.flowers[a], vg.flowers[b], vg.flowers[c]);
    const tMax = Math.max(vg.tall[a], vg.tall[b], vg.tall[c]);
    const kinds: Array<[number, number, number]> = [
      [0, dMax, kB],
      [1, fMax, kF],
      [2, tMax, kC],
    ];
    for (const [kind, max, k] of kinds) {
      if (max <= 1e-3) continue;
      const cap = kind === 0 ? opt.maxBlades : kind === 1 ? opt.maxFlowers : opt.maxTufts;
      const into = kind === 0 ? blades : kind === 1 ? flowers : tufts;
      if (into.count >= cap) continue;
      const expect = ar * k * max;
      let n = Math.floor(expect);
      if (rand() < expect - n) n++;
      n = Math.min(n, cap - into.count);
      for (let i = 0; i < n; i++) {
        let wb = rand();
        let wc = rand();
        if (wb + wc > 1) {
          wb = 1 - wb;
          wc = 1 - wc;
        }
        const wa = 1 - wb - wc;
        const x = lerp3(P, a, b, c, wa, wb, wc, 0);
        const y = lerp3(P, a, b, c, wa, wb, wc, 1);
        const z = lerp3(P, a, b, c, wa, wb, wc, 2);
        const dens = lerp1(vg.density, a, b, c, wa, wb, wc);
        const want = kind === 0 ? dens : kind === 1 ? lerp1(vg.flowers, a, b, c, wa, wb, wc) : lerp1(vg.tall, a, b, c, wa, wb, wc);
        if (rand() * max > want) continue;
        const h = lerp1(vg.height, a, b, c, wa, wb, wc);
        const tall = lerp1(vg.tall, a, b, c, wa, wb, wc);
        const wear = lerp1(vg.wear, a, b, c, wa, wb, wc);
        const hue = lerp1(vg.hue, a, b, c, wa, wb, wc);
        // clumps (≈ 0.36 u cells): shared lean direction, height and a whisper of hue
        const cx = Math.floor(x * 2.8);
        const cy = Math.floor(y * 2.8);
        const cz = Math.floor(z * 2.8);
        const cA = hash3(cx, cy, cz);
        const cB = hash3(cz + 17, cx - 5, cy + 11);
        let r = lerp3(C, a, b, c, wa, wb, wc, 0);
        let gg = lerp3(C, a, b, c, wa, wb, wc, 1);
        let bb = lerp3(C, a, b, c, wa, wb, wc, 2);
        // hue drift: warm yellow-green one way, cool blue-green the other; worn grass dries yellow
        const hw = Math.max(0, hue) * 0.32;
        const hc = Math.max(0, -hue) * 0.28;
        r *= 1 + hw * 0.2 - hc * 0.14;
        gg *= 1 + hw * 0.06 + hc * 0.02;
        bb *= 1 - hw * 0.5 + hc * 0.12;
        const dry = wear * 0.55 + tall * 0.2;
        r *= 1 + dry * 0.18;
        bb *= 1 - dry * 0.4;
        const cv = 0.94 + cB * 0.12;
        r *= cv;
        gg *= cv;
        if (kind === 0) {
          if (h < 0.02) continue;
          const hh = h * (0.82 + cB * 0.36) * (0.8 + rand() * 0.4);
          const yaw = cA * Math.PI * 2 + (rand() - 0.5) * 1.3;
          const lean = Math.min(1, 0.25 + 0.5 * cA * 0.5 + rand() * 0.45 + tall * 0.25);
          blades.push(x, y, z, packMeta(yaw, hh, 0.35 + rand() * 0.5 + tall * 0.15, lean), r, gg, bb, tall);
        } else if (kind === 1) {
          // flower drifts: one colour per patch (≈ 3 u), a few strays
          const px = Math.floor(x * 0.34 + 3.1);
          const py = Math.floor(y * 0.34 - 1.7);
          const pz = Math.floor(z * 0.34 + 0.9);
          const pal = rand() < 0.85 ? Math.floor(hash3(px, py, pz) * PALETTE.length) : Math.floor(rand() * PALETTE.length);
          const col = PALETTE[pal];
          const fh = Math.max(0.07, h) + 0.04 + rand() * 0.06;
          flowers.push(x, y, z, packMeta(rand() * Math.PI * 2, fh, 0.4 + rand() * 0.6, pal / 8), col[0] * col[0], col[1] * col[1], col[2] * col[2], 1);
        } else {
          if (tall < 0.3) continue;
          const cell = Math.floor(rand() * opt.cells) % opt.cells;
          const th = (0.26 + 0.16 * rand()) * (0.75 + 0.25 * tall);
          tufts.push(x, y, z, packMeta(rand() < 0.5 ? 0 : Math.PI, th, cell / META.width, 0.2 + rand() * 0.6), r, gg, bb, tall);
        }
      }
    }
  }
  return { blades: blades.pack(), flowers: flowers.pack(), tufts: tufts.pack() };
}
