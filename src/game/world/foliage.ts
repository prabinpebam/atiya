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
} from 'three';
import { Kit, hash3, mix } from './kit';
import { registerDaylit } from './materials';

/**
 * Foliage: trees and bushes built from a dark inner volume plus many overlapping,
 * alpha-tested leaf cards (the "shingled leaves" look of cozy life-sim trees).
 * Each tree kind returns two geometries rendered with the same instance transforms:
 * `solid` (trunk, core, fruit; vertex-coloured kit material) and `leaves` (cards; foliage material).
 */

export interface TreeGeometry {
  solid: BufferGeometry;
  leaves: BufferGeometry;
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

type LeafKind = 'broad' | 'needle';
const textures = new Map<LeafKind, CanvasTexture>();
function leafTexture(kind: LeafKind): CanvasTexture {
  let t = textures.get(kind);
  if (!t) {
    t = toTexture(kind === 'broad' ? drawBroadLeaf() : drawNeedleScale());
    textures.set(kind, t);
  }
  return t;
}

/** Foliage material + matching depth material (so shadows have leaf-shaped holes). */
export function foliageMaterials(kind: LeafKind): { material: MeshStandardMaterial; depth: Material } {
  const map = leafTexture(kind);
  const material = registerDaylit(
    new MeshStandardMaterial({ map, alphaTest: 0.5, side: DoubleSide, vertexColors: true, roughness: 0.85, metalness: 0, emissive: kind === 'broad' ? '#2f5e1d' : '#1f4a33', emissiveIntensity: 0.3 }),
  );
  const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, map, alphaTest: 0.5, side: DoubleSide });
  return { material, depth };
}

// ---------------------------------------------------------------------------
// Card builder
// ---------------------------------------------------------------------------

class Cards {
  private pos: number[] = [];
  private nor: number[] = [];
  private uv: number[] = [];
  private col: number[] = [];

  /**
   * Add a card whose base sits at `p`, extending `size` along `tip` (texture +Y),
   * lying in the plane spanned by `tip` and `side`. Lighting uses `shadeN` (volume normal).
   */
  add(p: Vector3, tip: Vector3, side: Vector3, size: number, width: number, color: Color, shadeN: Vector3, lift = 0.18) {
    const halfW = (size * width) / 2;
    const b0 = p.clone().addScaledVector(tip, -size * lift);
    const b1 = p.clone().addScaledVector(tip, size * (1 - lift));
    const corners = [
      b0.clone().addScaledVector(side, -halfW),
      b0.clone().addScaledVector(side, halfW),
      b1.clone().addScaledVector(side, halfW),
      b1.clone().addScaledVector(side, -halfW),
    ];
    const uvs = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const c = corners[i];
      this.pos.push(c.x, c.y, c.z);
      this.nor.push(shadeN.x, shadeN.y, shadeN.z);
      this.uv.push(uvs[i][0], uvs[i][1]);
      this.col.push(color.r, color.g, color.b);
    }
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  }
}

/** Cover a spherical lobe with drooping leaf cards. */
function leafLobe(
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
    color.multiplyScalar(0.92 + j * 0.16);
    const shadeN = n.clone().lerp(Y, 0.35).normalize();
    cards.add(p, tip, side, o.size * (0.85 + j2 * 0.3), o.width ?? 0.95, color, shadeN);
  }
}

// ---------------------------------------------------------------------------
// Trees
// ---------------------------------------------------------------------------

function flaredTrunk(k: Kit, h: number, r0: number, r1: number, dark: string, light: string, bend: number) {
  const pts: [number, number][] = [
    [0.001, 0],
    [r0 * 1.7, 0],
    [r0 * 1.25, h * 0.06],
    [r0 * 1.02, h * 0.18],
    [r0 * 0.9, h * 0.45],
    [r1, h * 0.85],
    [r1 * 1.1, h],
    [0.001, h],
  ];
  const bark = (p: Vector3) => {
    const a = Math.atan2(p.z, p.x);
    const streak = Math.sin(a * 7 + p.y * 2.2) * 0.5 + 0.5;
    return mix(dark, light, 0.25 + (p.y / h) * 0.35 + streak * 0.25 + (hash3(Math.round(a * 4), 1, 2) - 0.5) * 0.1);
  };
  const g = new Kit();
  g.lathe(pts, bark, {}, 14);
  const trunkGeo = g.build().solid!;
  // gentle S-bend: shift x by height
  const pos = trunkGeo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    pos.setX(i, pos.getX(i) + Math.sin((y / h) * Math.PI) * bend);
  }
  trunkGeo.computeVertexNormals();
  k.add(trunkGeo, (p) => bark(p));
  // root flares
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.5;
    k.blob(r0 * 0.75, dark, { p: [Math.cos(a) * r0 * 1.35, r0 * 0.2, Math.sin(a) * r0 * 1.35], r: [0, -a, 0], s: [1.9, 0.6, 0.9] }, 1);
  }
}

export function hardwood(fruit?: string): TreeGeometry {
  const k = new Kit();
  const cards = new Cards();
  const trunkH = 1.35;
  flaredTrunk(k, trunkH, 0.3, 0.22, '#7f4b29', '#b97b46', 0.06);
  // stubby branches up into the canopy
  for (const [x, z, rz, rx] of [
    [-0.25, 0.05, 0.7, 0.1],
    [0.25, -0.05, -0.7, -0.1],
    [0.02, 0.22, 0.1, -0.6],
  ] as const) {
    k.cyl(0.07, 0.12, 0.7, '#a86a3a', { p: [x, trunkH + 0.12, z], r: [rx, 0, rz] }, 8);
  }
  const lobes: [number, number, number, number][] = [
    [0, 2.45, 0, 0.88],
    [-0.74, 1.98, 0.08, 0.7],
    [0.74, 1.96, -0.08, 0.7],
    [0.06, 1.92, 0.58, 0.62],
    [-0.04, 2.02, -0.58, 0.62],
  ];
  const core = (_p: Vector3, n: Vector3) => mix('#1a4724', '#2a6630', 0.4 + n.y * 0.5);
  lobes.forEach(([x, y, z, r], i) => {
    k.blob(r * 0.86, core, { p: [x, y, z] }, 1, 'solid', 0.12, i * 2.3);
    leafLobe(cards, new Vector3(x, y, z), r, {
      count: Math.round(105 * r * r) + 22,
      size: 0.4 + r * 0.14,
      light: '#c2f08a',
      mid: '#7fcf5f',
      dark: '#3f9046',
      seed: i * 11 + 3,
      minY: -0.75,
    });
  });
  if (fruit) {
    const spots: [number, number, number][] = [
      [-0.9, 1.72, 0.38],
      [0.88, 1.66, 0.34],
      [0.2, 1.52, 0.98],
      [-0.42, 2.1, 0.8],
      [0.55, 2.35, 0.72],
      [-0.2, 2.8, 0.66],
    ];
    for (const [x, y, z] of spots) {
      k.sphere(0.1, fruit, { p: [x, y, z] }, [12, 10]);
      k.sphere(0.035, mix(fruit, '#ffffff', 0.5), { p: [x - 0.035, y + 0.04, z + 0.07] }, [6, 4]);
      k.cyl(0.008, 0.008, 0.07, '#6b4a2a', { p: [x, y + 0.12, z] }, 4);
      k.blob(0.04, '#3f8a3a', { p: [x + 0.04, y + 0.14, z], s: [1.4, 0.35, 0.8] }, 0);
    }
  }
  return { solid: k.build().solid!, leaves: cards.build() };
}

export function cedar(): TreeGeometry {
  const k = new Kit();
  const cards = new Cards();
  flaredTrunk(k, 0.95, 0.2, 0.13, '#6f3f25', '#a0623b', 0.02);
  const tiers = 6;
  for (let t = 0; t < tiers; t++) {
    const f = t / (tiers - 1);
    const r = 1.0 - f * 0.72;
    const h = 0.72 - f * 0.22;
    const y = 0.72 + t * 0.44;
    k.cone(r * 0.82, h, (p) => mix('#1a4830', '#285f40', (p.y + h / 2) / h), { p: [0, y + h / 2, 0] }, 12);
    // two rings of drooping needle scales around the tier's rim
    for (const [ring, frac, count] of [
      [0, 0.95, Math.round(10 + r * 16)],
      [1, 0.62, Math.round(7 + r * 10)],
    ] as const) {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + t * 0.4 + ring * 0.3;
        const j = hash3(t, i, ring + 2);
        const out = new Vector3(Math.cos(a), 0, Math.sin(a));
        const rr = r * frac;
        const yy = y + (ring === 0 ? 0.06 : h * 0.42);
        const p = new Vector3(Math.cos(a) * rr, yy, Math.sin(a) * rr);
        const tip = out.clone().multiplyScalar(0.55).add(new Vector3(0, -0.85, 0)).normalize();
        const side = new Vector3().crossVectors(tip, out).normalize();
        const shadeN = out.clone().multiplyScalar(0.8).add(new Vector3(0, 0.6, 0)).normalize();
        const color = mix('#3a8a5e', '#78c890', 0.35 + f * 0.25 + j * 0.3 - ring * 0.12);
        cards.add(p, tip, side, 0.42 - f * 0.12 + j * 0.06, 0.62, color, shadeN, 0.25);
      }
    }
  }
  // crown: a little cluster of upward scales
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const out = new Vector3(Math.cos(a), 0, Math.sin(a));
    const tip = out.clone().multiplyScalar(0.3).add(Y).normalize();
    const side = new Vector3().crossVectors(tip, out).normalize();
    cards.add(new Vector3(Math.cos(a) * 0.08, 0.72 + tiers * 0.44 - 0.05, Math.sin(a) * 0.08), tip, side, 0.34, 0.55, mix('#3f8f5f', '#6cbf85', 0.6), Y, 0.1);
  }
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
      light: '#b8ec80',
      mid: '#72c656',
      dark: '#3a8a42',
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
