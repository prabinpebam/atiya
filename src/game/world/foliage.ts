import {
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  MeshDepthMaterial,
  MeshStandardMaterial,
  Quaternion,
  RGBADepthPacking,
  SRGBColorSpace,
  Vector3,
  type ColorRepresentation,
  type Material,
  type Texture,
} from 'three';
import { Kit, SURFACE_TILE_U, hash3, mix } from './kit';
import { registerDaylit } from './materials';
import { gameTexture } from './textures';

/**
 * Foliage: trees and bushes built from a dark inner volume plus many overlapping,
 * alpha-tested leaf cards (the "shingled leaves" look of cozy life-sim trees).
 * Each tree kind returns two geometries rendered with the same instance transforms:
 * `solid` (trunk, core, fruit; vertex-coloured kit material) and `leaves` (cards; foliage material).
 */

export interface TreeGeometry {
  solid: BufferGeometry;
  leaves: BufferGeometry;
  /** Fruit trees: the fruit on its own (so a shaken tree can drop it and grow it back). */
  fruit?: BufferGeometry;
  /** Where each fruit hangs (tree-local, at scale 1): where it falls from. */
  fruitSpots?: readonly [number, number, number][];
}

const Y = new Vector3(0, 1, 0);

function fib(n: number, i: number, minY = -1): Vector3 {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - ((i + 0.5) / n) * (1 - minY);
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const t = golden * i;
  return new Vector3(Math.cos(t) * r, y, Math.sin(t) * r);
}

// ---------------------------------------------------------------------------
// Leaf textures (drawn once at runtime, greyscale; vertex colours tint them)
// ---------------------------------------------------------------------------

function canvas(size = 128): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return [c, c.getContext('2d')!];
}

function toTexture(c: HTMLCanvasElement): CanvasTexture {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Broad, soft three-point leaf (tip at the top of the texture = card +Y). */
function drawBroadLeaf(): HTMLCanvasElement {
  const [c, g] = canvas();
  const lobes: [number, number, number, number, number][] = [
    // cx, cy, rx, ry, rotation
    [64, 50, 24, 42, 0],
    [42, 64, 20, 32, -0.75],
    [86, 64, 20, 32, 0.75],
  ];
  const grad = g.createLinearGradient(0, 128, 0, 0);
  grad.addColorStop(0, '#d2d2d2');
  grad.addColorStop(0.6, '#f2f2f2');
  grad.addColorStop(1, '#ffffff');
  g.fillStyle = grad;
  g.strokeStyle = '#a4a4a4';
  g.lineWidth = 3;
  for (const [x, y, rx, ry, r] of lobes) {
    g.beginPath();
    g.ellipse(x, y, rx, ry, r, 0, Math.PI * 2);
    g.fill();
  }
  for (const [x, y, rx, ry, r] of lobes) {
    g.beginPath();
    g.ellipse(x, y, rx, ry, r, 0, Math.PI * 2);
    g.stroke();
  }
  // refill centres so internal overlaps read as soft folds, then veins
  g.globalAlpha = 0.85;
  for (const [x, y, rx, ry, r] of lobes) {
    g.beginPath();
    g.ellipse(x, y, rx - 5, ry - 6, r, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  g.strokeStyle = '#b9b9b9';
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(64, 118);
  g.lineTo(64, 18);
  g.moveTo(64, 92);
  g.lineTo(34, 52);
  g.moveTo(64, 92);
  g.lineTo(94, 52);
  g.stroke();
  // stem
  g.lineWidth = 5;
  g.strokeStyle = '#9a9a9a';
  g.beginPath();
  g.moveTo(64, 104);
  g.lineTo(64, 126);
  g.stroke();
  return c;
}

/** Drooping needle "scale" for cedars: rounded shingle with needle strokes. */
function drawNeedleScale(): HTMLCanvasElement {
  const [c, g] = canvas();
  const grad = g.createLinearGradient(0, 128, 0, 0);
  grad.addColorStop(0, '#c8c8c8');
  grad.addColorStop(1, '#ffffff');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(64, 4);
  g.bezierCurveTo(112, 34, 118, 92, 64, 124);
  g.bezierCurveTo(10, 92, 16, 34, 64, 4);
  g.fill();
  g.strokeStyle = '#8f8f8f';
  g.lineWidth = 3;
  g.stroke();
  g.strokeStyle = '#a3a3a3';
  g.lineWidth = 2;
  for (let i = -2; i <= 2; i++) {
    g.beginPath();
    g.moveTo(64 + i * 4, 112);
    g.quadraticCurveTo(64 + i * 14, 60, 64 + i * 9, 18);
    g.stroke();
  }
  return c;
}

type LeafKind = 'broad' | 'needle' | 'single' | 'conifer';
const textures = new Map<LeafKind, Texture>();
const GENERATED: Record<LeafKind, 'leaf-broad' | 'conifer-atlas' | 'leaf-single'> = {
  broad: 'leaf-broad',
  needle: 'conifer-atlas',
  single: 'leaf-single',
  conifer: 'conifer-atlas',
};
/** Leaf card texture: the generated hand-painted sprite when loaded, else a canvas-drawn fallback. */
export function leafTexture(kind: LeafKind): Texture {
  let t = textures.get(kind);
  if (!t) {
    t = gameTexture(GENERATED[kind]) ?? toTexture(kind === 'needle' || kind === 'conifer' ? drawNeedleScale() : drawBroadLeaf());
    textures.set(kind, t);
  }
  return t;
}

/** True when the painted conifer atlas (2×2 sprite cells) is loaded; otherwise cards use the whole fallback texture. */
function coniferAtlas(): boolean {
  return gameTexture('conifer-atlas') !== null;
}

/** UV rect of atlas cell `i` (0 clump, 1 bough, 2 tufts, 3 crown; row 0 is the top of the image). */
function cell(i: number): [number, number, number, number] {
  if (!coniferAtlas()) return [0, 0, 1, 1];
  const col = i % 2;
  const row = Math.floor(i / 2);
  return [col * 0.5, 1 - (row + 1) * 0.5, col * 0.5 + 0.5, 1 - row * 0.5];
}

/** Foliage material + matching depth material (so shadows have leaf-shaped holes). */
export function foliageMaterials(kind: LeafKind): { material: MeshStandardMaterial; depth: Material } {
  const map = leafTexture(kind);
  // (no normal map: the painted sprites carry their own relief, and a per-leaf normal fights the
  // canopy's volume shading, which makes the crowns read flatter — tried in the art pass)
  const material = registerDaylit(
    new MeshStandardMaterial({ map, alphaTest: 0.5, side: DoubleSide, vertexColors: true, roughness: 0.85, metalness: 0, emissive: kind === 'broad' ? '#2f5e1d' : '#1f4a33', emissiveIntensity: 0.3 }),
  );
  const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, map, alphaTest: 0.5, side: DoubleSide });
  return { material, depth };
}

let kitLeaves: ReturnType<typeof foliageMaterials> | null = null;
/** The leaf material for cards in kit models (potted plants, window boxes): shared, and still (a pot's plant doesn't sway apart from its pot). */
export function kitLeafMaterials() {
  return (kitLeaves ??= foliageMaterials('broad'));
}

// ---------------------------------------------------------------------------
// Card builder
// ---------------------------------------------------------------------------

/** Leaf cards' random hue spread (fraction of the colour wheel, ±half of it: ≈ ±6°). */
export const LEAF_HUE_JITTER = 0.035;

export class Cards {
  private pos: number[] = [];
  private nor: number[] = [];
  private uv: number[] = [];
  private col: number[] = [];
  private idx: number[] = [];

  /**
   * Add a card whose base sits at `p`, extending `size` along `tip` (texture +Y),
   * lying in the plane spanned by `tip` and `side`. Lighting uses `shadeN` (volume normal).
   */
  add(
    p: Vector3,
    tip: Vector3,
    side: Vector3,
    size: number,
    width: number,
    color: Color,
    shadeN: Vector3,
    lift = 0.18,
    uvRect: readonly [number, number, number, number] = [0, 0, 1, 1],
  ) {
    const halfW = (size * width) / 2;
    const b0 = p.clone().addScaledVector(tip, -size * lift);
    const b1 = p.clone().addScaledVector(tip, size * (1 - lift));
    const corners = [
      b0.clone().addScaledVector(side, -halfW),
      b0.clone().addScaledVector(side, halfW),
      b1.clone().addScaledVector(side, halfW),
      b1.clone().addScaledVector(side, -halfW),
    ];
    const [u0, v0, u1, v1] = uvRect;
    const uvs = [
      [u0, v0],
      [u1, v0],
      [u1, v1],
      [u0, v1],
    ];
    // a mild, stable hue and saturation shift per card (hashed from its position), so a crown has
    // the slight yellow-to-blue variety of real foliage rather than one flat green
    const tone = color.clone().offsetHSL((hash3(p.x * 7.1, p.y * 5.3, p.z * 6.7) - 0.5) * LEAF_HUE_JITTER, (hash3(p.z * 3.9, p.x * 4.7, p.y * 8.3) - 0.5) * 0.06, 0);
    // four shared corners, two triangles (indexed: each corner is shaded once)
    const base = this.pos.length / 3;
    for (let i = 0; i < 4; i++) {
      const c = corners[i];
      this.pos.push(c.x, c.y, c.z);
      this.nor.push(shadeN.x, shadeN.y, shadeN.z);
      this.uv.push(uvs[i][0], uvs[i][1]);
      this.col.push(tone.r, tone.g, tone.b);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

/** Cover a spherical lobe with drooping leaf cards. */
export function leafLobe(
  cards: Cards,
  center: Vector3,
  r: number,
  o: { count: number; size: number; minY?: number; light: ColorRepresentation; mid: ColorRepresentation; dark: ColorRepresentation; seed: number; width?: number },
) {
  const down = new Vector3(0, -1, 0);
  for (let i = 0; i < o.count; i++) {
    const n = fib(o.count, i, o.minY ?? -0.6);
    const j = hash3(o.seed, i, 1.3);
    const j2 = hash3(o.seed, i, 7.7);
    const p = center.clone().addScaledVector(n, r * (0.93 + j * 0.07));
    // leaves hang: the tip points along the surface, down-slope, with some twist
    let tip = down.clone().addScaledVector(n, -down.dot(n));
    if (tip.lengthSq() < 1e-4) tip = new Vector3(Math.cos(j * 6.28), 0, Math.sin(j * 6.28));
    tip.normalize().applyQuaternion(new Quaternion().setFromAxisAngle(n, (j2 - 0.5) * 1.6));
    let side = new Vector3().crossVectors(n, tip).normalize();
    // lift the tip off the surface so layers overlap like shingles
    tip.applyQuaternion(new Quaternion().setFromAxisAngle(side, -0.14 - j * 0.16)).normalize();
    side = new Vector3().crossVectors(n, tip).normalize();
    const t = Math.min(1, Math.max(0, 0.5 + n.y * 0.55 + (j2 - 0.5) * 0.25));
    const color = t > 0.5 ? mix(o.mid, o.light, (t - 0.5) * 2) : mix(o.dark, o.mid, t * 2);
    // ×1.2: the painted leaf sprite is greyscale at ~0.6 linear, so the palette reads as sunlit
    color.multiplyScalar((0.92 + j * 0.16) * 1.2);
    const shadeN = n.clone().lerp(Y, 0.35).normalize();
    cards.add(p, tip, side, o.size * (0.85 + j2 * 0.3), o.width ?? 0.95, color, shadeN);
  }
}

// ---------------------------------------------------------------------------
// Trees
// ---------------------------------------------------------------------------

export interface Ring {
  p: Vector3;
  r: number;
}

/** World units per bark repeat (the kit's `bark` surface tile). */
const BARK_TILE = SURFACE_TILE_U.bark;

/**
 * Builds a tube from rows of vertices (one row per ring, `sides` each, bottom to top). Indexed with
 * a duplicated seam column, so normals are smooth around and along the tube (the painted bark
 * texture carries the detail, not the facets). Bark UVs in world units: u wraps a whole number
 * of bark tiles round the tube (no seam), v is the distance along each column so the grain
 * follows ridges and roots. `cap` closes the far end with a small cone.
 */
function ringStack(rows: Vector3[][], cap?: Vector3): BufferGeometry {
  const n = rows.length;
  const sides = rows[0].length;
  const meanR =
    rows.reduce((acc, row) => {
      const c = row.reduce((a, v) => a.add(v), new Vector3()).divideScalar(sides);
      return acc + row.reduce((a, v) => a + v.distanceTo(c), 0) / sides;
    }, 0) / n;
  const around = Math.max(1, Math.round((Math.PI * 2 * meanR) / BARK_TILE)) * BARK_TILE;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const along = new Array<number>(sides + 1).fill(0);
  for (let i = 0; i < n; i++) {
    for (let s = 0; s <= sides; s++) {
      const v = rows[i][s % sides];
      if (i > 0) along[s] += v.distanceTo(rows[i - 1][s % sides]);
      pos.push(v.x, v.y, v.z);
      uv.push((s / sides) * around, along[s]);
    }
  }
  const w = sides + 1;
  for (let i = 0; i < n - 1; i++) {
    for (let s = 0; s < sides; s++) {
      const a = i * w + s;
      const d = a + w;
      idx.push(a, a + 1, d + 1, a, d + 1, d);
    }
  }
  if (cap) {
    const top = n - 1;
    const tip = pos.length / 3;
    const topV = Math.max(...along);
    pos.push(cap.x, cap.y, cap.z);
    uv.push(around / 2, topV + cap.distanceTo(rows[top][0]));
    // the cap gets its own copy of the last ring so its edge stays crisp
    const base = pos.length / 3;
    for (let s = 0; s <= sides; s++) {
      const v = rows[top][s % sides];
      pos.push(v.x, v.y, v.z);
      uv.push((s / sides) * around, along[s]);
    }
    for (let s = 0; s < sides; s++) idx.push(base + s, base + s + 1, tip);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // weld the seam's normals (the duplicated column only saw one side each)
  const nor = g.getAttribute('normal');
  const t = new Vector3();
  for (let i = 0; i < n; i++) {
    const a = i * w;
    const b = a + sides;
    t.set(nor.getX(a) + nor.getX(b), nor.getY(a) + nor.getY(b), nor.getZ(a) + nor.getZ(b)).normalize();
    nor.setXYZ(a, t.x, t.y, t.z);
    nor.setXYZ(b, t.x, t.y, t.z);
  }
  return g;
}

/**
 * Low-poly tube: an irregular `sides`-gon swept along the spine `rings` (parallel-transport frame,
 * so it never flips) with a little per-vertex radial jitter. Only as many rings as the shape needs
 * (one per bend or taper change); long, straight panels run with the grain. `capped` closes the
 * far end (tips that stick out; limbs ending inside the canopy stay open).
 */
export function barkTube(rings: Ring[], sides: number, seed: number, jitter = 0.12, capped = false): BufferGeometry {
  const n = rings.length;
  const T = rings.map((_, i) => rings[Math.min(n - 1, i + 1)].p.clone().sub(rings[Math.max(0, i - 1)].p).normalize());
  const N = Math.abs(T[0].y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
  N.addScaledVector(T[0], -N.dot(T[0])).normalize();
  const q = new Quaternion();
  const rows: Vector3[][] = [];
  const phase = hash3(seed, 2, 9) * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    if (i > 0) N.applyQuaternion(q.setFromUnitVectors(T[i - 1], T[i])).normalize();
    const B = new Vector3().crossVectors(T[i], N);
    const row: Vector3[] = [];
    for (let s = 0; s < sides; s++) {
      // per-column angle and radius offsets (not per ring), so panels stay long and straight
      const a = phase + (s / sides) * Math.PI * 2 + (hash3(s, seed, 1) - 0.5) * 0.3;
      const rr = rings[i].r * (1 + (hash3(s + 7, seed + 3, 2) - 0.5) * jitter + (hash3(s, i, seed) - 0.5) * jitter * 0.4);
      row.push(rings[i].p.clone().addScaledVector(N, Math.cos(a) * rr).addScaledVector(B, Math.sin(a) * rr));
    }
    rows.push(row);
  }
  const cap = capped ? rings[n - 1].p.clone().addScaledVector(T[n - 1], rings[n - 1].r * 0.8) : undefined;
  return ringStack(rows, cap);
}

/**
 * Root flare: the trunk's base as a stack of rings with three columns per buttress root: two for
 * the root's rounded back and one valley between it and the next root, on the stem's circle (so
 * the stem shows between the roots). The roots sweep out and down into the ground, so each is one
 * strip of polygons that follows its own shape; the top ring tucks inside the stem's flats.
 */
function rootFlare(roots: number, rb: number, mergeY: number, mergeR: number, seed: number): BufferGeometry {
  // [height, root reach, valley radius, root width] per ring as multiples of the base radius, bottom (underground) up
  const profile: [number, number, number, number][] = [
    [-0.55, 2.15, 1.04, 0.6],
    [0.3, 1.88, 1.02, 0.85],
    [0.78, 1.4, 0.97, 1.05],
  ];
  const step = (Math.PI * 2) / roots;
  const phase = hash3(seed, 4, 1) * Math.PI * 2;
  const angle = (j: number) => phase + j * step + (hash3(j % roots, seed, 3) - 0.5) * step * 0.3;
  const reach = (j: number) => 0.72 + hash3(j, seed, 2) * 0.4;
  const rows: Vector3[][] = [];
  const ring = (y: number, root: (j: number) => number, valley: number, width: number) => {
    const row: Vector3[] = [];
    for (let j = 0; j < roots; j++) {
      const a = angle(j);
      const r = root(j);
      const half = Math.min(step * 0.34, width / 2 / Math.max(r, 1e-3));
      // long roots dip a little deeper as they run out
      const dy = r > valley * 1.4 ? -(reach(j) - 0.72) * rb * 0.35 : 0;
      // (angles run from +x towards −z, the same way round as barkTube, so the faces point outwards)
      for (const da of [-half, half]) row.push(new Vector3(Math.cos(a + da) * r, y + dy, -Math.sin(a + da) * r));
      const v = valley * (1 + (hash3(j, 5, seed) - 0.5) * 0.08);
      const mid = (a + angle(j + 1)) / 2;
      row.push(new Vector3(Math.cos(mid) * v, y, -Math.sin(mid) * v));
    }
    rows.push(row);
  };
  for (const [y, reachK, valley, width] of profile) {
    ring(y * rb, (j) => (valley + (reachK - valley) * reach(j)) * rb, valley * rb, width * rb);
  }
  ring(mergeY, () => mergeR, mergeR, rb * 0.5);
  return ringStack(rows);
}

/**
 * Bark paint: darker at the roots, lighter up the trunk, with soft vertical streaks (hashed on a
 * coarse grid that's stretched along y) so the tone runs with the grain rather than per facet.
 * Upward-facing bark (the tops of the roots) is painted a touch darker, as the sun already lights it.
 */
export function barkPaint(dark: string, light: string, topY: number) {
  return (p: Vector3, nrm: Vector3) => {
    const streak = hash3(Math.round(p.x * 11), Math.round(p.y * 2.5), Math.round(p.z * 11));
    const up = Math.min(1, Math.max(0, p.y / topY));
    const t = 0.2 + up * 0.36 + (streak - 0.5) * 0.24 - Math.max(0, nrm.y) * 0.08;
    return mix(dark, light, Math.min(1, Math.max(0, t)));
  };
}

/** Smooth spine through control points (Catmull-Rom), with radii interpolated linearly. */
export function spine(points: [number, number, number, number][], perSpan = 2): Ring[] {
  const pts = points.map(([x, y, z]) => new Vector3(x, y, z));
  const out: Ring[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < perSpan; k++) {
      const t = k / perSpan;
      const t2 = t * t;
      const t3 = t2 * t;
      const p = new Vector3()
        .addScaledVector(p0, -0.5 * t3 + t2 - 0.5 * t)
        .addScaledVector(p1, 1.5 * t3 - 2.5 * t2 + 1)
        .addScaledVector(p2, -1.5 * t3 + 2 * t2 + 0.5 * t)
        .addScaledVector(p3, 0.5 * t3 - 0.5 * t2);
      out.push({ p, r: points[i][3] + (points[i + 1][3] - points[i][3]) * t });
    }
  }
  const last = points[points.length - 1];
  out.push({ p: pts[pts.length - 1], r: last[3] });
  return out;
}

export interface TrunkSpec {
  /** Trunk spine control points [x, y, z, radius] from the root flare's knee to the top; one ring each. */
  trunk: [number, number, number, number][];
  /** Limbs: control points from inside the trunk out to (hidden inside) a canopy lobe. */
  limbs?: [number, number, number, number][][];
  roots: number;
  /** Trunk radius at the ground (roots are sized from it). */
  base: number;
  stubs?: number;
  dark: string;
  light: string;
  seed: number;
}

/**
 * Low-poly trunk, all on the kit's `bark` surface: a smooth-shaded 6-sided stem with one ring per
 * control point, the buttress roots as one flare (see `rootFlare`), 4-sided limbs and a stub.
 * Polygons follow the shape (a strip per root, long panels up the stem) and the painted bark tile
 * fakes the ridges and furrows.
 */
export function lowPolyTrunk(k: Kit, o: TrunkSpec) {
  const topY = o.trunk[o.trunk.length - 1][1];
  const paint = barkPaint(o.dark, o.light, topY);
  const [x0, y0, z0, r0] = o.trunk[0];
  const mergeY = Math.max(o.base * 1.8, y0 + 0.06);
  k.surface('bark', () => {
    // the stem starts inside the flare; the flare's top ring hides inside the stem's flats
    k.add(barkTube([{ p: new Vector3(x0, -0.05, z0), r: o.base * 0.9 }, ...spine(o.trunk, 1)], 6, o.seed), paint);
    k.add(rootFlare(o.roots, o.base, mergeY, r0 * 0.8, o.seed), paint, { p: [x0, 0, z0] });
    for (const [i, limb] of (o.limbs ?? []).entries()) {
      k.add(barkTube(spine(limb, 1), 4, o.seed + 50 + i * 7), paint);
    }
    // broken-off branch stubs on the trunk
    for (let i = 0; i < (o.stubs ?? 0); i++) {
      const f = 0.35 + 0.3 * hash3(i, o.seed, 5);
      const j = Math.min(o.trunk.length - 2, Math.floor(f * (o.trunk.length - 1)));
      const [x, y, z, r] = o.trunk[j];
      const a = hash3(i, o.seed, 6) * Math.PI * 2;
      const out = new Vector3(Math.cos(a), 0.45, Math.sin(a)).normalize();
      const s0 = new Vector3(x, y, z).addScaledVector(out, r * 0.5);
      const s1 = s0.clone().addScaledVector(out, r * 0.9);
      k.add(barkTube([{ p: s0, r: r * 0.34 }, { p: s1, r: r * 0.24 }], 4, o.seed + 90 + i, 0.12, true), paint);
    }
  });
}

/** A limb from the trunk at height `y0` to a canopy lobe centre (ending well inside it). */
export function limbTo(y0: number, lobe: [number, number, number, number], r0: number, seed: number): [number, number, number, number][] {
  const [x, y, z] = lobe;
  const lift = 0.18 + hash3(seed, 1, 2) * 0.12;
  // starts just inside the trunk (a hidden first span would only cost triangles)
  return [
    [x * 0.1, y0 - 0.06, z * 0.1, r0 * 1.02],
    [x * 0.45, y0 + (y - y0) * 0.45 + lift, z * 0.45, r0 * 0.72],
    [x * 0.78, y - 0.05, z * 0.78, r0 * 0.46],
  ];
}

/** Where the fruit hangs on a fruit tree (tree-local, at scale 1). */
export const FRUIT_SPOTS: readonly [number, number, number][] = [
  [-0.9, 1.72, 0.38],
  [0.88, 1.66, 0.34],
  [0.2, 1.52, 0.98],
  [-0.42, 2.1, 0.8],
  [0.55, 2.35, 0.72],
  [-0.2, 2.8, 0.66],
];

export function hardwood(fruit?: string): TreeGeometry {
  const k = new Kit();
  const cards = new Cards();
  const lobes: [number, number, number, number][] = [
    [0, 2.45, 0, 0.88],
    [-0.74, 1.98, 0.08, 0.7],
    [0.74, 1.96, -0.08, 0.7],
    [0.06, 1.92, 0.58, 0.62],
    [-0.04, 2.02, -0.58, 0.62],
  ];
  // chunky S-bent trunk that forks into a limb per side lobe and runs on up into the crown
  lowPolyTrunk(k, {
    trunk: [
      [0, 0.5, 0, 0.29],
      [0.07, 0.98, 0.02, 0.24],
      [0.02, 1.38, 0.01, 0.19],
      [-0.02, 2.1, 0, 0.1],
    ],
    limbs: lobes.slice(1).map((l, i) => limbTo(1.08 + i * 0.07, l, 0.12, i + 1)),
    roots: 5,
    base: 0.32,
    stubs: 1,
    dark: '#6e3d20',
    light: '#c3844d',
    seed: 17,
  });
  // a few twigs poking out between the lobes
  for (const [i, [x, y, z]] of ([[-0.5, 1.55, 0.42], [0.52, 1.5, 0.4], [0.4, 1.62, -0.5]] as const).entries()) {
    k.surface('bark', () =>
      k.add(barkTube([{ p: new Vector3(x * 0.4, y - 0.16, z * 0.4), r: 0.045 }, { p: new Vector3(x, y + 0.14, z), r: 0.02 }], 3, 70 + i, 0.1, true), barkPaint('#6e3d20', '#c3844d', 2.2)),
    );
  }
  const core = (_p: Vector3, n: Vector3) => mix('#1a4724', '#2a6630', 0.4 + n.y * 0.5);
  lobes.forEach(([x, y, z, r], i) => {
    k.blob(r * 0.86, core, { p: [x, y, z] }, 1, 'solid', 0.12, i * 2.3);
    leafLobe(cards, new Vector3(x, y, z), r, {
      count: Math.round(105 * r * r) + 22,
      size: 0.4 + r * 0.14,
      light: '#e4f687',
      mid: '#8fd257',
      dark: '#357f44',
      seed: i * 11 + 3,
      minY: -0.75,
    });
  });
  let fruitGeo: BufferGeometry | undefined;
  let fruitSpots: [number, number, number][] | undefined;
  if (fruit) {
    const kf = new Kit();
    const spots = FRUIT_SPOTS;
    for (const [x, y, z] of spots) {
      kf.sphere(0.1, fruit, { p: [x, y, z] }, [12, 10]);
      kf.sphere(0.035, mix(fruit, '#ffffff', 0.5), { p: [x - 0.035, y + 0.04, z + 0.07] }, [6, 4]);
      kf.cyl(0.008, 0.008, 0.07, '#6b4a2a', { p: [x, y + 0.12, z] }, 4);
      kf.blob(0.04, '#3f8a3a', { p: [x + 0.04, y + 0.14, z], s: [1.4, 0.35, 0.8] }, 0);
    }
    fruitGeo = kf.build().solid!;
    fruitSpots = [...spots];
  }
  return { solid: k.build().solid!, leaves: cards.build(), fruit: fruitGeo, fruitSpots };
}

/** Palettes per cedar variant (dark underside → sunlit tip): blue-green, fresh green, yellow-green. */
const CEDAR_TONES: [string, string, string][] = [
  ['#244f45', '#3f7f66', '#86c7a0'],
  ['#265a3a', '#3f8a55', '#8fd08a'],
  ['#2f5f32', '#4f9448', '#a7d67e'],
];

/**
 * Conifer built from painted, circular foliage sprites (2×2 atlas: clump, bough, tufts, crown).
 * Instead of perfectly regular cones ringed by evenly spaced scales, each tier is a handful of
 * *grouped* bough clusters at irregular angles (with gaps), reaches, heights and droops around a
 * lumpy dark core; the whole tree leans slightly and ends in a clustered crown. `variant` seeds a
 * distinct silhouette so neighbouring cedars don't look identical.
 */
export function cedar(variant = 0): TreeGeometry {
  const k = new Kit();
  const cards = new Cards();
  const seed = 31 + variant * 17;
  const rnd = (a: number, b = 0) => hash3(seed, a, b);
  const [dark, mid, light] = CEDAR_TONES[variant % CEDAR_TONES.length];
  lowPolyTrunk(k, {
    trunk: [
      [0.01, 0.34, 0, 0.18],
      [0.02, 0.9, 0.01, 0.135],
      [0, 1.35, 0, 0.1],
    ],
    roots: 4,
    base: 0.21,
    stubs: 1,
    dark: '#5e3320',
    light: '#a8683d',
    seed: 29 + variant,
  });

  const tiers = 5 + (variant % 2);
  const lean = new Vector3(rnd(1) - 0.5, 0, rnd(2) - 0.5).normalize().multiplyScalar(0.05 + rnd(3) * 0.06);
  const base = 1.05 + rnd(4) * 0.12; // radius of the lowest tier
  let y = 0.72 + rnd(5) * 0.08;
  const shade = (out: Vector3) => out.clone().multiplyScalar(0.7).add(new Vector3(0, 0.72, 0)).normalize();
  const tone = (t: number, j: number) => {
    const c = t < 0.5 ? mix(dark, mid, t * 2) : mix(mid, light, (t - 0.5) * 2);
    return c.multiplyScalar(0.9 + j * 0.2);
  };

  for (let ti = 0; ti < tiers; ti++) {
    const f = ti / (tiers - 1);
    const r = base * (1 - f * 0.74) * (0.9 + rnd(10, ti) * 0.2);
    const c = lean.clone().multiplyScalar(f * 2.2).setY(0); // the axis drifts with height
    const h = 0.62 - f * 0.2;
    // small, dark core: only reads as depth in the gaps between clusters
    k.blob(r * 0.4, (_p, n) => mix(dark, '#16302a', 0.55 - Math.max(0, n.y) * 0.3), { p: [c.x, y + h * 0.4, c.z], s: [1, 0.8, 1] }, 1, 'solid', 0.25, seed + ti);
    // each tier is a tapering, irregular shell of foliage gathered into angular groups
    const shellR = (u: number) => r * (1 - 0.72 * u);
    const groups = Math.max(3, Math.round(3 + r * 4.5 + rnd(11, ti) * 1.5));
    const phase = rnd(12, ti) * Math.PI * 2;
    for (let g = 0; g < groups; g++) {
      if (ti < tiers - 1 && ti > 0 && rnd(13 + g, ti) < 0.12) continue; // an occasional gap
      const a = phase + ((g + (rnd(14 + g, ti) - 0.5) * 0.6) / groups) * Math.PI * 2;
      const out = new Vector3(Math.cos(a), 0, Math.sin(a));
      const side = new Vector3(out.z, 0, -out.x);
      const reach = 0.85 + rnd(15 + g, ti) * 0.3; // some groups stick out further
      const spread = (Math.PI / groups) * 0.9;
      // the bough: a drooping fan hanging from the tier's lower rim
      {
        const faceN = out.clone().multiplyScalar(0.62).add(new Vector3(0, 0.78, 0)).normalize();
        const tip = new Vector3().crossVectors(faceN, side).normalize(); // up and back towards the trunk
        const p = c.clone().addScaledVector(out, shellR(0.05) * reach * 0.5).setY(y + h * 0.2);
        const j = rnd(18 + g, ti);
        cards.add(p, tip, side, shellR(0) * reach * 1.05 + 0.2, 1, tone(0.25 + f * 0.2 + j * 0.2, j), shade(out), 0.86, cell(1));
      }
      // round clumps and tufts spread over the group's patch of the shell (outer = lighter)
      const puffs = 3 + Math.floor(rnd(19 + g, ti) * 2.5) + (r > 0.6 ? 1 : 0);
      for (let q = 0; q < puffs; q++) {
        const j = rnd(20 + g * 5 + q, ti);
        const j2 = rnd(21 + g * 5 + q, ti);
        const u = Math.min(0.92, (q + 0.5) / puffs + (j2 - 0.5) * 0.25);
        const o = out.clone().applyAxisAngle(Y, (j - 0.5) * 2 * spread);
        const s = new Vector3(o.z, 0, -o.x);
        const depth = 0.82 + j2 * 0.26;
        const p = c.clone().addScaledVector(o, shellR(u) * reach * depth).setY(y + h * u - (1 - u) * 0.06);
        const faceN = o.clone().multiplyScalar(0.78).add(new Vector3(0, 0.62, 0)).normalize();
        const tip = new Vector3().crossVectors(faceN, s).normalize().applyAxisAngle(faceN, (j2 - 0.5) * 1.0);
        const sd = new Vector3().crossVectors(tip, faceN).normalize();
        const size = (0.3 + r * 0.26) * (0.75 + j * 0.5) * (1 - u * 0.3);
        cards.add(p, tip, sd, size, 1, tone(0.32 + u * 0.3 + f * 0.2 + (depth - 0.82) * 0.6, j), shade(o), 0.5, cell(q % 3 === 1 ? 2 : 0));
      }
      // a darker inner puff so the core never shows as a hole
      {
        const o = out.clone().applyAxisAngle(Y, spread);
        const s = new Vector3(o.z, 0, -o.x);
        const faceN = o.clone().multiplyScalar(0.75).add(new Vector3(0, 0.6, 0)).normalize();
        const tip = new Vector3().crossVectors(faceN, s).normalize();
        const p = c.clone().addScaledVector(o, shellR(0.4) * 0.55).setY(y + h * 0.4);
        cards.add(p, tip, s, 0.32 + r * 0.3, 1, tone(0.08 + f * 0.15, rnd(22 + g, ti)), shade(o), 0.5, cell(0));
      }
    }    y += (0.46 - f * 0.08) * (0.9 + rnd(23, ti) * 0.25);
  }

  // crown: an upright tip spray with a few tufts gathered round its base
  const top = lean.clone().multiplyScalar(2.3).setY(y - 0.02);
  const crownTip = new Vector3(lean.x * 2, 1, lean.z * 2).normalize();
  for (let i = 0; i < 2; i++) {
    const a = i * Math.PI * 0.5 + rnd(30) * Math.PI;
    const faceN = new Vector3(Math.cos(a), 0, Math.sin(a));
    const side = new Vector3().crossVectors(crownTip, faceN).normalize();
    cards.add(top, crownTip, side, 0.62 + rnd(31, i) * 0.1, 1, tone(0.8, rnd(32, i)), Y, 0.2, cell(3));
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rnd(33) * 2;
    const o = new Vector3(Math.cos(a), 0, Math.sin(a));
    const s = new Vector3(o.z, 0, -o.x);
    const faceN = o.clone().multiplyScalar(0.7).add(new Vector3(0, 0.7, 0)).normalize();
    const tip = new Vector3().crossVectors(faceN, s).normalize();
    cards.add(top.clone().addScaledVector(o, 0.14).setY(top.y - 0.08), tip, s, 0.3, 1, tone(0.7, rnd(34, i)), shade(o), 0.5, cell(2));
  }
  return { solid: k.build().solid!, leaves: cards.build() };
}
/**
 * A low flowering sprig: one small leafy tuft with three blossoms on top (≈ 150 triangles). Scattered
 * by the hundred along paths and through the meadows, walk-through (art direction: abundant flowers).
 */
export function flowerSprig(petal: string, eye = '#ffd24a'): TreeGeometry {
  const k = new Kit();
  const cards = new Cards();
  leafLobe(cards, new Vector3(0, 0.1, 0), 0.16, { count: 14, size: 0.14, light: '#d8f07c', mid: '#82c852', dark: '#2f7a42', seed: 91, minY: -0.15 });
  const blossoms: [number, number, number][] = [
    [0.02, 0.24, 0.03],
    [-0.1, 0.19, -0.05],
    [0.09, 0.2, -0.07],
  ];
  blossoms.forEach(([x, y, z], i) => {
    k.cyl(0.055 - i * 0.006, 0.055 - i * 0.006, 0.012, petal, { p: [x, y, z], r: [0.15 * (i - 1), 0, 0.12] }, 6);
    k.cyl(0.02, 0.02, 0.018, eye, { p: [x, y + 0.008, z] }, 5);
  });
  return { solid: k.build().solid!, leaves: cards.build() };
}

export function leafyBush(flowers?: string): TreeGeometry {
  const k = new Kit();
  const cards = new Cards();
  const lobes: [number, number, number, number][] = [
    [0, 0.34, 0, 0.36],
    [-0.3, 0.24, 0.08, 0.28],
    [0.3, 0.24, -0.06, 0.29],
    [0.04, 0.24, 0.28, 0.26],
    [0.0, 0.26, -0.27, 0.26],
  ];
  const core = (_p: Vector3, n: Vector3) => mix('#23592c', '#357a39', 0.4 + n.y * 0.5);
  lobes.forEach(([x, y, z, r], i) => {
    k.blob(r * 0.88, core, { p: [x, y, z] }, 1, 'solid', 0.12, i * 1.9);
    leafLobe(cards, new Vector3(x, y, z), r, {
      count: Math.round(150 * r * r) + 12,
      size: 0.22 + r * 0.12,
      light: '#d8f07c',
      mid: '#82c852',
      dark: '#2f7a42',
      seed: i * 5 + 17,
      minY: -0.2,
    });
  });
  if (flowers) {
    for (let i = 0; i < 12; i++) {
      const n = fib(12, i, 0.05);
      const p = new Vector3(n.x * 0.42, 0.3 + n.y * 0.34, n.z * 0.42);
      for (let q = 0; q < 5; q++) {
        const a = (q / 5) * Math.PI * 2;
        k.sphere(0.035, flowers, { p: [p.x + Math.cos(a) * 0.035, p.y + 0.01, p.z + Math.sin(a) * 0.035], s: [1, 0.45, 1] }, [6, 4]);
      }
      k.sphere(0.02, '#fff1a8', { p: [p.x, p.y + 0.02, p.z] }, [6, 4]);
    }
  }
  return { solid: k.build().solid!, leaves: cards.build() };
}
