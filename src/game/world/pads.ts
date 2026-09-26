import { Vector3 } from 'three';

/**
 * Flat pads: the ground under each structure, shaped to the plane its base stands on
 * (docs: documentation/poc-3d-navigation/ground.md).
 *
 * A structure is built flat in the tangent frame at its centre, but the planet curves away under
 * it (d²/2R: 0.2 u at 2 u from the centre on a radius-10 planet) and the land rolls. So inside a
 * pad the ground *is* that plane: the base box plus a flat `margin`, then a `skirt` that blends back
 * to the natural ground. Pure, so the terrain, the ground mesh and the tests all agree.
 */

export interface PadSpec {
  id: string;
  /** Planet-local unit centre (the structure's origin). */
  n: Vector3;
  /** Planet-local unit tangent of the structure's local +z (its front). */
  facing: Vector3;
  /** Base box in the structure's frame (u): x from `x0` to `x1`, z from `z0` (back) to `z1` (front). */
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** Flat ground beyond the base box (u). */
  margin?: number;
  /** Width of the blend back to the natural ground (u). */
  skirt?: number;
  /** Fixed height of the plane at the centre (u above the base sphere); default: the natural ground's mean under the pad. */
  h?: number;
  /** A cobblestone apron this far beyond the base box (u); 0 or absent for none. */
  apron?: number;
}

export interface Pad {
  id: string;
  n: Vector3;
  /** The frame's tangent axes (x = n × z, z = facing). */
  x: Vector3;
  z: Vector3;
  /** Box centre offset and half extents in the frame (u). */
  cx: number;
  cz: number;
  bx: number;
  bz: number;
  margin: number;
  skirt: number;
  h: number;
  apron: number;
  /** cos of the pad's outer angle (box corner + margin + skirt): n·pad.n below it → no influence. */
  cosOuter: number;
}

export const PAD_MARGIN = 0.3;
export const PAD_SKIRT = 0.8;
/** The apron's soft edge (u each side of its nominal width). */
export const APRON_SOFT = 0.18;

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

export function makePad(spec: PadSpec, h: number, R: number): Pad {
  const n = spec.n.clone().normalize();
  const z = spec.facing.clone().addScaledVector(n, -spec.facing.dot(n)).normalize();
  const x = new Vector3().crossVectors(n, z).normalize();
  const margin = spec.margin ?? PAD_MARGIN;
  const skirt = spec.skirt ?? PAD_SKIRT;
  const apron = spec.apron ?? 0;
  const bx = (spec.x1 - spec.x0) / 2;
  const bz = (spec.z1 - spec.z0) / 2;
  const cx = (spec.x1 + spec.x0) / 2;
  const cz = (spec.z1 + spec.z0) / 2;
  const reach = Math.hypot(Math.abs(cx) + bx, Math.abs(cz) + bz) + Math.max(margin + skirt, apron + APRON_SOFT) + 0.05;
  return { id: spec.id, n, x, z, cx, cz, bx, bz, margin, skirt, h, apron, cosOuter: Math.cos(Math.min(Math.PI / 2, reach / R)) };
}

/**
 * `n` in the pad's frame (u): gnomonic, i.e. where the ray to `n` meets the tangent plane, so
 * straight lines in the structure's frame stay straight. Null behind the horizon.
 */
export function padLocal(p: Pad, n: Vector3, R: number): { x: number; z: number } | null {
  const t = n.dot(p.n);
  if (t <= 1e-6) return null;
  const qx = n.x / t - p.n.x;
  const qy = n.y / t - p.n.y;
  const qz = n.z / t - p.n.z;
  return { x: (qx * p.x.x + qy * p.x.y + qz * p.x.z) * R, z: (qx * p.z.x + qy * p.z.y + qz * p.z.z) * R };
}

/** Signed distance (u) from the base box's edge: negative inside it. */
export function boxDistance(p: Pad, x: number, z: number): number {
  const qx = Math.abs(x - p.cx) - p.bx;
  const qz = Math.abs(z - p.cz) - p.bz;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
}

/** 1 on the flat part (the box and its margin), easing to 0 across the skirt. */
export function padWeight(p: Pad, d: number): number {
  if (d <= p.margin) return 1;
  return 1 - smoothstep(p.margin, p.margin + p.skirt, d);
}

/** Height of the pad's plane (u above the base sphere) along the direction `n`. */
export function planeHeight(p: Pad, n: Vector3, R: number): number {
  return (R + p.h) / Math.max(1e-6, n.dot(p.n)) - R;
}

/**
 * The ground at `n` with the pads applied to the natural height `natural`. Where skirts overlap they
 * blend; a pad's flat part always wins over another's skirt (its weight tends to infinity there).
 */
export function applyPads(pads: readonly Pad[], n: Vector3, R: number, natural: number): number {
  let alpha = 0;
  let sum = 0;
  let wsum = 0;
  let flatSum = 0;
  let flatN = 0;
  for (const p of pads) {
    if (n.dot(p.n) < p.cosOuter) continue;
    const l = padLocal(p, n, R);
    if (!l) continue;
    const d = boxDistance(p, l.x, l.z);
    const w = padWeight(p, d);
    if (w <= 0) continue;
    if (w >= 1) {
      flatSum += planeHeight(p, n, R);
      flatN++;
      continue;
    }
    // inverse-distance weights across the skirts (unbounded at a flat part's edge, so it wins
    // there): two neighbouring planes hand over gently rather than at a crease
    const t = (d - p.margin) / p.skirt;
    const k = (1 - t) / t;
    alpha = Math.max(alpha, w);
    sum += k * planeHeight(p, n, R);
    wsum += k;
  }
  // on a pad's flat part only that plane counts
  if (flatN) return flatSum / flatN;
  if (alpha <= 0) return natural;
  return natural + (sum / wsum - natural) * alpha;
}

/**
 * The cobblestone apron at `n`: its weight (0..1, soft-edged) and the texture coordinates in the pad's
 * own plane (u), so the stones are laid flat and unbroken round each building.
 */
export function apronAt(pads: readonly Pad[], n: Vector3, R: number): { w: number; x: number; z: number } {
  // (the coordinates come from the nearest apron even where its weight is 0, so the ground's
  // triangles along its edge interpolate them smoothly instead of smearing the stones)
  let best = { w: 0, x: 0, z: 0 };
  let nearest = Infinity;
  for (const p of pads) {
    if (p.apron <= 0 || n.dot(p.n) < p.cosOuter) continue;
    const l = padLocal(p, n, R);
    if (!l) continue;
    const d = boxDistance(p, l.x, l.z);
    const w = 1 - smoothstep(p.apron - APRON_SOFT, p.apron + APRON_SOFT, d);
    if (w > best.w || (best.w === 0 && d < nearest)) best = { w, x: l.x, z: l.z };
    nearest = Math.min(nearest, d);
  }
  return best;
}

/** Points on the outline `d` u beyond the base box (its rounded offset), in planet-local directions. */
export function padOutline(p: Pad, d: number, R: number, perSide = 8): Vector3[] {
  const out: Vector3[] = [];
  const at = (x: number, z: number) => out.push(p.n.clone().addScaledVector(p.x, x / R).addScaledVector(p.z, z / R).normalize());
  const { cx, cz, bx, bz } = p;
  for (let i = 0; i < perSide; i++) {
    const t = (i + 0.5) / perSide;
    at(cx - bx + 2 * bx * t, cz + bz + d);
    at(cx - bx + 2 * bx * t, cz - bz - d);
    at(cx + bx + d, cz - bz + 2 * bz * t);
    at(cx - bx - d, cz - bz + 2 * bz * t);
  }
  for (const [sx, sz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]] as const) {
    for (let i = 0; i <= 4; i++) {
      const a = (i / 4) * (Math.PI / 2);
      at(cx + sx * (bx + d * Math.sin(a)), cz + sz * (bz + d * Math.cos(a)));
    }
  }
  return out;
}

/** The gap (u) between two pads' base boxes (sampled), for keeping their flat parts apart. */
export function padGap(a: Pad, b: Pad, R: number): number {
  let gap = Infinity;
  for (const [p, q] of [
    [a, b],
    [b, a],
  ] as const) {
    for (const n of padOutline(q, 0, R, 12)) {
      const l = padLocal(p, n, R);
      if (l) gap = Math.min(gap, boxDistance(p, l.x, l.z));
    }
  }
  return gap;
}

/**
 * Shrink the margins of pads whose flat parts would overlap, so each base stays on its own plane
 * (the ground between two close structures then blends from one plane to the other).
 */
export function separatePads(pads: Pad[], R: number, clearance = 0.04): void {
  for (let i = 0; i < pads.length; i++) {
    for (let j = i + 1; j < pads.length; j++) {
      const a = pads[i];
      const b = pads[j];
      if (a.n.dot(b.n) < Math.cos(Math.min(Math.PI / 2, (Math.acos(a.cosOuter) + Math.acos(b.cosOuter)) * 1.0))) continue;
      const room = padGap(a, b, R) - clearance;
      if (a.margin + b.margin <= room) continue;
      const k = Math.max(0, room) / (a.margin + b.margin);
      a.margin *= k;
      b.margin *= k;
    }
  }
}

/** Sample points (base box corners, edge midpoints and centre, grown by `grow` u) in planet-local directions. */
export function padSamples(p: Pad, grow: number, R: number): Vector3[] {
  const out: Vector3[] = [];
  for (const sx of [-1, 0, 1]) {
    for (const sz of [-1, 0, 1]) {
      const x = p.cx + sx * (p.bx + grow);
      const z = p.cz + sz * (p.bz + grow);
      out.push(p.n.clone().addScaledVector(p.x, x / R).addScaledVector(p.z, z / R).normalize());
    }
  }
  return out;
}
