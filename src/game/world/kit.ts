import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  ExtrudeGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  LatheGeometry,
  Matrix4,
  Quaternion,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Uint16BufferAttribute,
  Uint32BufferAttribute,
  Vector2,
  Vector3,
  type ColorRepresentation,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Geometry kit: builds a model from many vertex-coloured primitives and merges them into
 * one geometry per material layer, so a detailed building costs only a few draw calls.
 *
 * Surfaces: every part also records what it's made of (`aSurf`, an index into SURFACES) and a
 * texture coordinate in its own frame (`aSurfUV`, in tiles), so the shared kit material can
 * paint wood grain, roof shingles, plaster, stone, brick, iron or canvas detail per part. Wrap
 * parts in `k.surface('wood', () => …)`; untagged parts are plain painted surfaces. Tree bark
 * (`bark`) uses the part's own `uv` (world units, wrapped round the trunk by the tube builder).
 */
export type Layer = 'solid' | 'glow' | 'glass';
export type Paint = ColorRepresentation | ((p: Vector3, n: Vector3) => ColorRepresentation);
export type V3 = [number, number, number];

/** Surface kinds, in shader order (index = `aSurf`). */
export const SURFACES = ['paint', 'wood', 'roof', 'plaster', 'stone', 'brick', 'metal', 'canvas', 'bark'] as const;
export type Surface = (typeof SURFACES)[number];
/** World units per texture repeat for each surface. */
export const SURFACE_TILE_U: Record<Surface, number> = {
  paint: 1,
  wood: 0.8,
  roof: 0.9,
  plaster: 1.3,
  stone: 1.1,
  brick: 0.8,
  metal: 0.6,
  canvas: 0.3,
  bark: 0.9,
};

export interface Xf {
  p?: V3;
  r?: V3;
  q?: Quaternion;
  s?: number | V3;
}

export interface KitGeometry {
  solid: BufferGeometry | null;
  glow: BufferGeometry | null;
  glass: BufferGeometry | null;
}

const tmpColor = new Color();

export function xfMatrix(xf: Xf = {}): Matrix4 {
  const s = xf.s ?? 1;
  const scale = typeof s === 'number' ? new Vector3(s, s, s) : new Vector3(...s);
  const q = xf.q ? xf.q.clone() : new Quaternion().setFromEuler(new Euler(...(xf.r ?? [0, 0, 0])));
  return new Matrix4().compose(new Vector3(...(xf.p ?? [0, 0, 0])), q, scale);
}

/** Convert to non-indexed position/normal/color (and `uv`, until surfaceUV consumes it) so everything can be merged. */
export function colorize(g: BufferGeometry, color: Paint): BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g;
  for (const name of Object.keys(geo.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') geo.deleteAttribute(name);
  if (!geo.getAttribute('normal')) geo.computeVertexNormals();
  const pos = geo.getAttribute('position');
  const nor = geo.getAttribute('normal');
  const out = new Float32Array(pos.count * 3);
  const p = new Vector3();
  const n = new Vector3();
  const fixed = typeof color === 'function' ? null : tmpColor.set(color).clone();
  for (let i = 0; i < pos.count; i++) {
    let c = fixed;
    if (!c) {
      p.fromBufferAttribute(pos, i);
      n.fromBufferAttribute(nor, i);
      c = tmpColor.set((color as (p: Vector3, n: Vector3) => ColorRepresentation)(p, n));
    }
    out[i * 3] = c.r;
    out[i * 3 + 1] = c.g;
    out[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new Float32BufferAttribute(out, 3));
  return geo;
}

/**
 * Surface id and texture coordinates for a colorized (non-indexed) part, computed in the part's
 * own frame before it's transformed by `m`. Each triangle is box-projected onto the plane of its
 * dominant local axis (so a plank or a roof course keeps one orientation). The texture's
 * horizontal runs along the part's longer extent for wood (grain follows the board) and along the
 * more level axis for everything else (courses, shingle rows and weave stay horizontal). Sloped
 * roof faces are instead mapped in the face's own plane, with the texture's up running up the
 * slope (so shingle tabs always point down toward the eaves, whichever way the face looks). Bark
 * parts that bring their own `uv` (in world units) keep it, so the grain follows the trunk and roots.
 * The part's `uv` is always dropped afterwards (merged parts must share one attribute set).
 */
export function surfaceUV(geo: BufferGeometry, m: Matrix4, surface: Surface, seed: number): void {
  const pos = geo.getAttribute('position');
  const nor = geo.getAttribute('normal');
  const e = m.elements;
  const axes = [new Vector3(e[0], e[1], e[2]), new Vector3(e[4], e[5], e[6]), new Vector3(e[8], e[9], e[10])];
  const scale = axes.map((a) => Math.max(a.length(), 1e-6));
  const level = axes.map((a, i) => Math.abs(a.y) / scale[i]);
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const extent = [(bb.max.x - bb.min.x) * scale[0], (bb.max.y - bb.min.y) * scale[1], (bb.max.z - bb.min.z) * scale[2]];
  const tile = SURFACE_TILE_U[surface];
  const id = SURFACES.indexOf(surface);
  const ids = new Float32Array(pos.count).fill(id);
  const uv = new Float32Array(pos.count * 2);
  const off = [hash3(seed, 1.3, 7.1), hash3(seed, 5.9, 2.4)];
  const n = new Vector3();
  const own = geo.getAttribute('uv');
  if (own) geo.deleteAttribute('uv');
  if (surface === 'bark' && own) {
    for (let v = 0; v < pos.count; v++) {
      uv[v * 2] = own.getX(v) / tile + off[0];
      uv[v * 2 + 1] = own.getY(v) / tile + off[1];
    }
    geo.setAttribute('aSurf', new Float32BufferAttribute(ids, 1));
    geo.setAttribute('aSurfUV', new Float32BufferAttribute(uv, 2));
    return;
  }
  const pick = (i: number, j: number): [number, number] => {
    if (surface === 'wood') return extent[i] >= extent[j] ? [i, j] : [j, i];
    if (Math.abs(level[i] - level[j]) < 0.05) return extent[i] >= extent[j] ? [i, j] : [j, i];
    return level[i] < level[j] ? [i, j] : [j, i];
  };
  const P = [new Vector3(), new Vector3(), new Vector3()];
  const slope = new Vector3();
  const across = new Vector3();
  for (let t = 0; t < pos.count; t += 3) {
    if (surface === 'roof' && roofFaceUV(pos, t, m, P, n, slope, across)) {
      for (let k = 0; k < 3; k++) {
        uv[(t + k) * 2] = P[k].dot(across) / tile + off[0];
        uv[(t + k) * 2 + 1] = P[k].dot(slope) / tile + off[1];
      }
      continue;
    }
    // face normal in the part's scaled frame (normals transform by the inverse scale)
    n.set(0, 0, 0);
    for (let k = 0; k < 3; k++) {
      n.x += nor.getX(t + k) / scale[0];
      n.y += nor.getY(t + k) / scale[1];
      n.z += nor.getZ(t + k) / scale[2];
    }
    const a = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)];
    const d = a[0] >= a[1] && a[0] >= a[2] ? 0 : a[1] >= a[2] ? 1 : 2;
    const [ui, vi] = pick((d + 1) % 3, (d + 2) % 3);
    for (let k = 0; k < 3; k++) {
      const p = [pos.getX(t + k), pos.getY(t + k), pos.getZ(t + k)];
      uv[(t + k) * 2] = (p[ui] * scale[ui]) / tile + off[0];
      uv[(t + k) * 2 + 1] = (p[vi] * scale[vi]) / tile + off[1];
    }
  }
  geo.setAttribute('aSurf', new Float32BufferAttribute(ids, 1));
  geo.setAttribute('aSurfUV', new Float32BufferAttribute(uv, 2));
}

const _e1 = new Vector3();
const _e2 = new Vector3();

/**
 * For a sloped roof triangle: its corners in the model frame (`P`), the up-slope direction in its
 * plane (`slope`) and the horizontal direction along the eave as seen from outside (`across`).
 * Returns false for (near-)level or vertical faces, which keep the box projection.
 */
function roofFaceUV(
  pos: BufferGeometry['attributes'][string],
  t: number,
  m: Matrix4,
  P: Vector3[],
  n: Vector3,
  slope: Vector3,
  across: Vector3,
): boolean {
  for (let k = 0; k < 3; k++) P[k].fromBufferAttribute(pos, t + k).applyMatrix4(m);
  n.crossVectors(_e1.subVectors(P[1], P[0]), _e2.subVectors(P[2], P[0]));
  if (n.lengthSq() < 1e-14) return false;
  n.normalize();
  if (m.determinant() < 0) n.negate();
  if (Math.abs(n.y) > 0.97 || Math.abs(n.y) < 0.03) return false;
  // up the slope, in the face's plane; then "right" as seen looking at the face from outside
  slope.set(0, 1, 0).addScaledVector(n, -n.y).normalize();
  across.crossVectors(slope, n).normalize();
  return true;
}

export class Kit {
  private readonly parts: Record<Layer, BufferGeometry[]> = { solid: [], glow: [], glass: [] };
  private readonly stack: Matrix4[] = [new Matrix4()];
  private readonly surfaces: Surface[] = ['paint'];
  private count = 0;

  private get top(): Matrix4 {
    return this.stack[this.stack.length - 1];
  }

  /** Apply `xf` to everything added inside `fn`. */
  group(xf: Xf, fn: () => void): this {
    this.stack.push(this.top.clone().multiply(xfMatrix(xf)));
    fn();
    this.stack.pop();
    return this;
  }

  /** Everything added inside `fn` is made of `surface` (nested calls override). */
  surface(surface: Surface, fn: () => void): this {
    this.surfaces.push(surface);
    fn();
    this.surfaces.pop();
    return this;
  }

  add(g: BufferGeometry, color: Paint, xf: Xf = {}, layer: Layer = 'solid'): this {
    const geo = colorize(g, color);
    const m = this.top.clone().multiply(xfMatrix(xf));
    surfaceUV(geo, m, this.surfaces[this.surfaces.length - 1], ++this.count);
    geo.applyMatrix4(m);
    this.parts[layer].push(geo);
    return this;
  }

  /** Rounded box (bevelled edges everywhere, the soft "toy" look). Small boxes use a single bevel segment; tiny ones none. */
  box(size: V3, color: Paint, xf: Xf = {}, radius = 0.04, layer: Layer = 'solid'): this {
    if (Math.max(...size) < 0.2) return this.add(new BoxGeometry(size[0], size[1], size[2]), color, xf, layer);
    const r = Math.min(radius, Math.min(...size) / 2 - 1e-3);
    const seg = Math.max(...size) > 0.9 ? 2 : 1;
    return this.add(new RoundedBoxGeometry(size[0], size[1], size[2], seg, Math.max(r, 0.001)), color, xf, layer);
  }

  cyl(rTop: number, rBottom: number, h: number, color: Paint, xf: Xf = {}, seg = 16, layer: Layer = 'solid', open = false): this {
    return this.add(new CylinderGeometry(rTop, rBottom, h, seg, 1, open), color, xf, layer);
  }

  cone(r: number, h: number, color: Paint, xf: Xf = {}, seg = 16, layer: Layer = 'solid'): this {
    return this.add(new ConeGeometry(r, h, seg), color, xf, layer);
  }

  sphere(r: number, color: Paint, xf: Xf = {}, seg: [number, number] = [16, 12], layer: Layer = 'solid', phi?: [number, number, number, number]): this {
    const [ps, pl, ts, tl] = phi ?? [0, Math.PI * 2, 0, Math.PI];
    return this.add(new SphereGeometry(r, seg[0], seg[1], ps, pl, ts, tl), color, xf, layer);
  }

  blob(r: number, color: Paint, xf: Xf = {}, detail = 2, layer: Layer = 'solid', lump = 0, seed = 0): this {
    return this.add(smoothBlob(r, detail, lump, seed), color, xf, layer);
  }

  torus(r: number, tube: number, color: Paint, xf: Xf = {}, arc = Math.PI * 2, seg: [number, number] = [8, 24], layer: Layer = 'solid'): this {
    return this.add(new TorusGeometry(r, tube, seg[0], seg[1], arc), color, xf, layer);
  }

  lathe(points: [number, number][], color: Paint, xf: Xf = {}, seg = 20, layer: Layer = 'solid'): this {
    return this.add(new LatheGeometry(points.map(([x, y]) => new Vector2(x, y)), seg), color, xf, layer);
  }

  /** Extruded 2D outline (x/y plane), extruded along +z by `depth`, centred on z. */
  extrude(outline: [number, number][], depth: number, color: Paint, xf: Xf = {}, bevel = 0.02, layer: Layer = 'solid'): this {
    const shape = new Shape(outline.map(([x, y]) => new Vector2(x, y)));
    const g = new ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 12 });
    g.translate(0, 0, -depth / 2);
    return this.add(g, color, xf, layer);
  }

  build(): KitGeometry {
    const merge = (list: BufferGeometry[]) => {
      if (!list.length) return null;
      const g = indexExact(mergeGeometries(list, false));
      g.computeBoundingSphere();
      g.computeBoundingBox();
      return g;
    };
    return { solid: merge(this.parts.solid), glow: merge(this.parts.glow), glass: merge(this.parts.glass) };
  }
}

/**
 * Index a non-indexed geometry by merging vertices that are bit-for-bit identical in every
 * attribute (the copies `toNonIndexed` made, still equal after colouring, surface UVs and the
 * part transform). Lossless: the triangles and every attribute value are unchanged, but a vertex
 * shared by several triangles is stored and shaded once (typically 60 % fewer vertices, in both
 * the colour and the shadow pass). Differs from `mergeVertices`: exact (no tolerance) and fast
 * (a hash table over the raw bits), so it can run on every model at load.
 */
export function indexExact(g: BufferGeometry): BufferGeometry {
  if (g.index) return g;
  const names = Object.keys(g.attributes);
  const attrs = names.map((n) => g.getAttribute(n));
  if (!attrs.length || attrs.some((a) => !(a.array instanceof Float32Array) || (a as { isInterleavedBufferAttribute?: boolean }).isInterleavedBufferAttribute)) return g;
  const count = attrs[0].count;
  const stride = attrs.reduce((s, a) => s + a.itemSize, 0);
  const packed = new Float32Array(count * stride);
  let o = 0;
  for (let i = 0; i < count; i++) {
    for (const a of attrs) {
      const arr = a.array as Float32Array;
      for (let k = 0, base = i * a.itemSize; k < a.itemSize; k++) packed[o++] = arr[base + k];
    }
  }
  const bits = new Uint32Array(packed.buffer);
  let size = 1;
  while (size < count * 2) size <<= 1;
  const table = new Int32Array(size).fill(-1);
  const first = new Uint32Array(count); // unique vertex → its first source vertex
  const index = new Uint32Array(count);
  let unique = 0;
  for (let i = 0; i < count; i++) {
    const b = i * stride;
    let h = 2166136261;
    for (let k = 0; k < stride; k++) h = Math.imul(h ^ bits[b + k], 16777619);
    let slot = (h >>> 0) & (size - 1);
    for (;;) {
      const u = table[slot];
      if (u < 0) {
        table[slot] = unique;
        first[unique] = i;
        index[i] = unique++;
        break;
      }
      const f = first[u] * stride;
      let same = true;
      for (let k = 0; k < stride; k++) {
        if (bits[f + k] !== bits[b + k]) {
          same = false;
          break;
        }
      }
      if (same) {
        index[i] = u;
        break;
      }
      slot = (slot + 1) & (size - 1);
    }
  }
  if (unique === count) return g;
  const out = new BufferGeometry();
  attrs.forEach((a, ai) => {
    const src = a.array as Float32Array;
    const n = a.itemSize;
    const dst = new Float32Array(unique * n);
    for (let u = 0; u < unique; u++) for (let k = 0, s = first[u] * n; k < n; k++) dst[u * n + k] = src[s + k];
    out.setAttribute(names[ai], new Float32BufferAttribute(dst, n, a.normalized));
  });
  out.setIndex(unique < 65536 ? new Uint16BufferAttribute(Uint16Array.from(index), 1) : new Uint32BufferAttribute(index, 1));
  out.name = g.name;
  return out;
}

/** Deterministic value noise for organic displacement (no dependencies). */
export function hash3(x: number, y: number, z: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

export function lumpy(g: BufferGeometry, amount: number, freq = 3, seed = 0): BufferGeometry {
  const pos = g.getAttribute('position');
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const len = v.length();
    const n = hash3(Math.round(v.x * freq * 10) / 10 + seed, Math.round(v.y * freq * 10) / 10, Math.round(v.z * freq * 10) / 10);
    v.multiplyScalar((len + (n - 0.5) * amount) / Math.max(len, 1e-6));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** Smooth-shaded, optionally lumpy sphere (welded so normals are soft, not faceted). */
export function smoothBlob(r: number, detail = 2, lump = 0, seed = 0): BufferGeometry {
  let g: BufferGeometry = new IcosahedronGeometry(r, detail);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g);
  if (lump > 0) lumpy(g, lump * r, 2.2 / r, seed);
  else g.computeVertexNormals();
  return g;
}

export function mix(a: ColorRepresentation, b: ColorRepresentation, t: number): Color {
  return new Color(a).lerp(new Color(b), Math.min(1, Math.max(0, t)));
}
