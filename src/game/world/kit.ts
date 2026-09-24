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
  Vector2,
  Vector3,
  type ColorRepresentation,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Geometry kit: builds a model from many vertex-coloured primitives and merges them into
 * one geometry per material layer, so a detailed building costs only a few draw calls.
 */
export type Layer = 'solid' | 'glow' | 'glass';
export type Paint = ColorRepresentation | ((p: Vector3, n: Vector3) => ColorRepresentation);
export type V3 = [number, number, number];

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

/** Convert to non-indexed position/normal/color so everything can be merged. */
export function colorize(g: BufferGeometry, color: Paint): BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g;
  for (const name of Object.keys(geo.attributes)) if (name !== 'position' && name !== 'normal') geo.deleteAttribute(name);
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

export class Kit {
  private readonly parts: Record<Layer, BufferGeometry[]> = { solid: [], glow: [], glass: [] };
  private readonly stack: Matrix4[] = [new Matrix4()];

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

  add(g: BufferGeometry, color: Paint, xf: Xf = {}, layer: Layer = 'solid'): this {
    const geo = colorize(g, color);
    geo.applyMatrix4(this.top.clone().multiply(xfMatrix(xf)));
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
      const g = mergeGeometries(list, false);
      g.computeBoundingSphere();
      g.computeBoundingBox();
      return g;
    };
    return { solid: merge(this.parts.solid), glow: merge(this.parts.glow), glass: merge(this.parts.glass) };
  }
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
