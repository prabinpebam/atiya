/**
 * The wildlife's models (world/Wildlife.tsx, in the nature chunk): rabbits, the duck, her ducklings and
 * their nest, fish and songbirds. Kept out of `propModels.ts` so they load with the wildlife, not the
 * initial bundle.
 */
import { BufferGeometry, Quaternion, Vector3 } from 'three';
import { Kit, hash3, mix } from './kit';

const solid = (k: Kit): BufferGeometry => k.build().solid!;

// ---------------------------------------------------------------------------
// Wildlife (world/animals.ts): small, soft kit models, facing +Z, feet (or waterline) at y = 0
// ---------------------------------------------------------------------------

/** A rabbit (≈ 0.3 u long): round body, head, long ears, white scut. `upright` = sitting up to look. */
export function rabbit(upright = false): BufferGeometry {
  const k = new Kit();
  const fur = (_p: Vector3, n: Vector3) => mix('#8a6c52', '#c7a887', 0.45 + n.y * 0.45);
  const lift = upright ? 0.07 : 0;
  k.blob(0.12, fur, { p: [0, 0.1 + lift * 0.6, -0.02], s: upright ? [1, 1.25, 0.95] : [1, 0.85, 1.25] }, 1, 'solid', 0.05, 3);
  k.blob(0.075, fur, { p: [0, 0.17 + lift * 1.4, upright ? 0.07 : 0.12], s: [1, 0.95, 1.1] }, 1, 'solid', 0.04, 4);
  for (const x of [-0.028, 0.028]) {
    k.blob(0.03, fur, { p: [x, 0.27 + lift * 1.4, upright ? 0.05 : 0.08], r: [upright ? -0.1 : -0.45, 0, x * 3], s: [0.55, 2.6, 0.35] }, 0);
    k.blob(0.018, '#e9b7b0', { p: [x, 0.27 + lift * 1.4, upright ? 0.063 : 0.095], r: [upright ? -0.1 : -0.45, 0, x * 3], s: [0.45, 2.2, 0.2] }, 0);
  }
  k.sphere(0.012, '#1d1712', { p: [-0.045, 0.19 + lift * 1.4, upright ? 0.12 : 0.17] }, [5, 4]);
  k.sphere(0.012, '#1d1712', { p: [0.045, 0.19 + lift * 1.4, upright ? 0.12 : 0.17] }, [5, 4]);
  k.blob(0.035, '#f6f1e8', { p: [0, 0.11 + lift * 0.4, -0.14] }, 0);
  return solid(k);
}

/** Where the duck's neck meets her body (model units, before `SIZE.duck`): the head turns about it. */
export const DUCK_NECK: readonly [number, number, number] = [0, 0.085, 0.1];

/**
 * A white farm duck's body (≈ 0.34 u long; the waterline at y = 0): a plump, boat-shaped body with
 * a full breast, folded wings with grey-tipped primaries crossing over the upturned tail, and orange
 * legs and webbed feet (under the water while she swims, standing on the bank). The head is separate
 * (`duckHead`) so she can peck, look about and tuck it under her wing to sleep.
 */
export function duck(): BufferGeometry {
  const k = new Kit();
  const plume = (_p: Vector3, n: Vector3) => mix('#cfd4da', '#ffffff', 0.45 + n.y * 0.55);
  const wing = (p: Vector3, n: Vector3) => mix(mix('#c4cad2', '#f4f5f6', 0.4 + n.y * 0.6), '#8e97a3', Math.min(1, Math.max(0, (-p.z - 0.1) * 9)));
  const orange = '#f0952e';
  k.blob(0.13, plume, { p: [0, 0.035, -0.01], s: [0.82, 0.58, 1.3] }, 2, 'solid', 0.025, 5);
  k.blob(0.085, plume, { p: [0, 0.05, 0.085], s: [0.92, 0.9, 0.9] }, 1, 'solid', 0.02, 2);
  // the tail, lifted in a little point
  k.blob(0.05, plume, { p: [0, 0.085, -0.16], r: [0.65, 0, 0], s: [0.72, 0.42, 1.25] }, 1, 'solid', 0.02, 3);
  // folded wings: long and slightly apart over the back, the primaries crossing at the tail
  for (const x of [-1, 1]) {
    k.blob(0.075, wing, { p: [x * 0.07, 0.078, -0.035], r: [0.12, x * 0.08, x * 0.12], s: [0.36, 0.42, 1.4] }, 1, 'solid', 0.02, 7 + x);
    k.cone(0.022, 0.1, wing, { p: [x * 0.025, 0.1, -0.165], r: [-Math.PI / 2 + 0.35, x * 0.2, 0], s: [1, 1, 0.45] }, 5);
  }
  // legs and webbed feet
  for (const x of [-1, 1]) {
    k.cyl(0.009, 0.008, 0.05, orange, { p: [x * 0.04, -0.03, 0.01] }, 5);
    k.box([0.045, 0.007, 0.05], orange, { p: [x * 0.042, -0.055, 0.03], r: [0, x * 0.2, 0] }, 0.003);
  }
  return solid(k);
}

/** Her neck and head, from the neck's base (`DUCK_NECK`): a round head, a broad flat orange bill with its nail, bright eyes. */
export function duckHead(): BufferGeometry {
  const k = new Kit();
  const plume = (_p: Vector3, n: Vector3) => mix('#d6dbe0', '#ffffff', 0.5 + n.y * 0.5);
  const bill = (p: Vector3) => mix('#f7a23a', '#e8862a', Math.min(1, Math.max(0, (p.z - 0.09) * 18)));
  k.blob(0.04, plume, { p: [0, 0.045, 0.005], r: [-0.25, 0, 0], s: [0.8, 1.45, 0.9] }, 1, 'solid', 0.01, 4);
  k.blob(0.06, plume, { p: [0, 0.105, 0.03], s: [0.88, 0.92, 1.08] }, 2, 'solid', 0.01, 6);
  // the bill: broad and flat, a touch upturned, with the nail at its tip
  k.box([0.046, 0.016, 0.07], bill, { p: [0, 0.088, 0.098], r: [0.12, 0, 0] }, 0.006);
  k.blob(0.024, bill, { p: [0, 0.084, 0.128], s: [0.98, 0.34, 0.8] }, 1);
  k.sphere(0.006, '#c96f1f', { p: [0, 0.089, 0.144] }, [6, 4]);
  for (const x of [-1, 1]) {
    k.sphere(0.0105, '#16161a', { p: [x * 0.043, 0.118, 0.058] }, [8, 6]);
    k.sphere(0.0035, '#ffffff', { p: [x * 0.051, 0.123, 0.064] }, [5, 4]);
  }
  return solid(k);
}

/** A fluffy yellow duckling (≈ 0.13 u): a round body with wing nubs and a tail tuft, a big head, a little bill and eyes. */
export function duckling(): BufferGeometry {
  const k = new Kit();
  const down = (p: Vector3, n: Vector3) => mix(mix('#dcae2e', '#ffe68a', 0.45 + n.y * 0.55), '#c8962a', Math.min(1, Math.max(0, (p.y - 0.045) * 14)) * 0.35);
  k.blob(0.055, down, { p: [0, 0.02, 0], s: [0.9, 0.72, 1.2] }, 2, 'solid', 0.06, 7);
  k.blob(0.02, down, { p: [0, 0.035, -0.065], r: [0.6, 0, 0], s: [0.7, 0.5, 1] }, 0, 'solid', 0.1, 3);
  for (const x of [-1, 1]) k.blob(0.02, down, { p: [x * 0.045, 0.03, -0.005], s: [0.45, 0.6, 1.2] }, 0, 'solid', 0.08, 5 + x);
  k.blob(0.037, down, { p: [0, 0.078, 0.045] }, 1, 'solid', 0.05, 9);
  k.box([0.022, 0.009, 0.028], '#f08a2a', { p: [0, 0.07, 0.083], r: [0.1, 0, 0] }, 0.003);
  for (const x of [-1, 1]) k.sphere(0.0065, '#16161a', { p: [x * 0.026, 0.088, 0.066] }, [6, 4]);
  return solid(k);
}

/** The ducks' nest on the bank (≈ 0.4 u across): a ring of reeds, straw and twigs round a hollow lined with down. */
export function duckNest(): BufferGeometry {
  const k = new Kit();
  const straw = (p: Vector3, n: Vector3) => mix(mix('#8a6a3a', '#d9bd7a', 0.35 + n.y * 0.5), '#b89652', hash3(p.x * 40, p.y * 40, p.z * 40) * 0.5);
  k.torus(0.15, 0.05, straw, { p: [0, 0.035, 0], r: [Math.PI / 2, 0, 0], s: [1, 1, 0.7] }, Math.PI * 2, [6, 18]);
  k.cyl(0.13, 0.1, 0.03, '#6b5130', { p: [0, 0.015, 0] }, 12);
  // loose twigs and reed stems laid round the rim
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + hash3(i, 3, 1) * 0.4;
    const r = 0.15 + (hash3(i, 5, 2) - 0.5) * 0.04;
    const along = new Vector3(-Math.sin(a + (hash3(i, 6, 6) - 0.5) * 0.6), (hash3(i, 4, 4) - 0.5) * 0.3, Math.cos(a)).normalize();
    k.cyl(0.006, 0.005, 0.16 + hash3(i, 7, 3) * 0.08, hash3(i, 1, 9) > 0.5 ? '#7a5a34' : '#b49a5c', { p: [Math.cos(a) * r, 0.05 + hash3(i, 2, 4) * 0.025, Math.sin(a) * r], q: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), along) }, 4);
  }
  // down feathers in the hollow
  for (let i = 0; i < 6; i++) {
    const a = i * 2.3;
    k.blob(0.018, '#f3f1ea', { p: [Math.cos(a) * 0.07, 0.035, Math.sin(a) * 0.07], s: [1.2, 0.5, 1] }, 0);
  }
  return solid(k);
}

/** A small fish (≈ 0.18 u), near-white so the instance colour paints it (koi orange, trout grey). */
export function fishModel(): BufferGeometry {
  const k = new Kit();
  const scales = (_p: Vector3, n: Vector3) => mix('#c9c9c9', '#ffffff', 0.5 + n.y * 0.5);
  k.blob(0.05, scales, { p: [0, 0, 0.02], s: [0.55, 0.7, 1.7] }, 0);
  k.cone(0.035, 0.06, scales, { p: [0, 0, -0.08], r: [-Math.PI / 2, 0, 0], s: [0.25, 1, 1] }, 4);
  return solid(k);
}

/** A songbird's body (≈ 0.12 u long) — the wings are separate so they can beat. */
export function birdBody(): BufferGeometry {
  const k = new Kit();
  const feathers = (_p: Vector3, n: Vector3) => mix('#6a5747', '#cdb49a', 0.5 + n.y * 0.5);
  k.blob(0.04, feathers, { p: [0, 0.04, 0], s: [0.8, 0.8, 1.5] }, 0);
  k.blob(0.028, feathers, { p: [0, 0.07, 0.05] }, 0);
  k.cone(0.008, 0.025, '#e0a03a', { p: [0, 0.07, 0.085], r: [Math.PI / 2, 0, 0] }, 4);
  k.box([0.03, 0.006, 0.06], '#5a4636', { p: [0, 0.045, -0.07], r: [0.3, 0, 0] }, 0.003);
  return solid(k);
}

/** One wing, rooted at the origin and reaching along +x (mirrored for the other side). */
export function birdWing(): BufferGeometry {
  const k = new Kit();
  k.box([0.09, 0.008, 0.045], (p: Vector3) => mix('#5a4636', '#9c8068', 0.5 + p.x * 8), { p: [0.045, 0, 0] }, 0.004);
  return solid(k);
}

