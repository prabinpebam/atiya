/**
 * The wildlife's models (world/Wildlife.tsx, in the nature chunk): rabbits, the duck, her ducklings and
 * their nest, fish and songbirds. Kept out of `propModels.ts` so they load with the wildlife, not the
 * initial bundle.
 */
import { BufferGeometry, Quaternion, Vector3 } from 'three';
import { Kit, hash3, mix, xfMatrix, type V3, type Xf } from './kit';
import type { RabbitCoat } from './animals';

const solid = (k: Kit): BufferGeometry => k.build().solid!;

// ---------------------------------------------------------------------------
// Wildlife (world/animals.ts): small, soft kit models, facing +Z, feet (or waterline) at y = 0
// ---------------------------------------------------------------------------

/** The rabbits' coats: fur from its back to its sides, the belly, the ears (and their rims), the scut. */
const COATS: Record<RabbitCoat, { back: string; side: string; belly: string; ear: string; rim: string; scut: string }> = {
  // the wild agouti brown: ticked grey-brown, a cream belly, dark-rimmed ears
  wild: { back: '#6c523d', side: '#a3815d', belly: '#e6d5ba', ear: '#86684d', rim: '#3e2e22', scut: '#f6f1e8' },
  // a soft blue-grey with a pale belly
  grey: { back: '#5d6068', side: '#8f929a', belly: '#ecebe6', ear: '#6e7178', rim: '#3d3f45', scut: '#f7f6f2' },
  // a fawn lop: warm cream and ginger
  lop: { back: '#c38d52', side: '#e3bd8a', belly: '#f6ead5', ear: '#b27b44', rim: '#8e5f33', scut: '#fbf5ea' },
  // the Dutch pattern: dark hindquarters, ears and cheeks; a white blaze, collar, forefeet and hind-foot tips
  dutch: { back: '#35302d', side: '#46403c', belly: '#f4f1ea', ear: '#3a3431', rim: '#2a2523', scut: '#f7f4ee' },
};
const DUTCH_WHITE = '#f4f1ea';

type Role = 'body' | 'head' | 'muzzle' | 'ear' | 'earIn' | 'foot' | 'paw' | 'scut';
type RabbitPose = 'down' | 'up' | 'kit';

/**
 * A rabbit (docs: wildlife.md): an adult (≈ 0.33 u long) lying low to graze (`down`) or sitting up to
 * look (`up`), or a kit (≈ 0.2 u: a round body, a big head, short ears). Coats are painted in model
 * space, so a pattern (the Dutch saddle and blaze) runs across the parts; a lop's ears hang by its
 * cheeks. Facing +z, feet at y = 0.
 */
export function rabbit(coat: RabbitCoat = 'wild', pose: RabbitPose = 'down'): BufferGeometry {
  const k = new Kit();
  const C = COATS[coat];
  const kit = pose === 'kit';
  const lop = coat === 'lop';
  const up = pose === 'up';
  const hd = new Vector3(...(kit ? [0, 0.12, 0.085] : up ? [0, 0.29, 0.06] : [0, 0.175, 0.13]));
  const hr = kit ? 0.06 : 0.072;
  const P = new Vector3();
  const N = new Vector3();
  const fur = (p: Vector3, n: Vector3, role: Role) => {
    if (role === 'scut') return C.scut;
    if (coat === 'dutch') {
      const q = P.copy(p).sub(hd);
      if (role === 'muzzle' || role === 'paw') return DUTCH_WHITE;
      if (role === 'head') return Math.abs(q.x) < hr * (0.22 + Math.max(0, -q.y / hr) * 0.9) || q.y < -hr * 0.55 ? DUTCH_WHITE : C.back;
      if (role === 'foot') return p.z > (kit ? 0.0 : 0.005) ? DUTCH_WHITE : C.back;
      if (role === 'body') return p.z > (kit ? -0.005 : -0.01) + Math.sin(p.x * 60) * 0.008 || n.y < -0.45 ? DUTCH_WHITE : C.back;
    }
    if (role === 'earIn') return '#e8b3ad';
    if (role === 'ear') return mix(C.ear, C.rim, lop ? (hd.y - hr * 1.1 - p.y) / (hr * 0.6) : (p.y - hd.y - hr * 1.9) / (hr * 0.9));
    // the back darker, the sides lighter, the belly and chin cream; ticked with a little noise
    const base = mix(C.side, C.back, 0.35 + n.y * 0.65);
    const tick = mix(base, C.back, (hash3(Math.round(p.x * 90), Math.round(p.y * 90), Math.round(p.z * 90)) - 0.5) * 0.35);
    const belly = role === 'muzzle' ? 0.55 : Math.min(1, Math.max(0, (-n.y - 0.15) * 1.6));
    return mix(tick, C.belly, kit ? belly * 0.8 + 0.08 : belly);
  };
  // (the paint's p and n are the part's own: bring them into the model's frame for the pattern)
  const part = (role: Role, r: number, xf: Xf, detail = 1, lump = 0, seed = 0) => {
    const m = xfMatrix(xf);
    k.blob(r, (p, n) => fur(p.clone().applyMatrix4(m), N.copy(n).transformDirection(m), role), xf, detail, 'solid', lump, seed);
  };
  const at = (o: V3): V3 => [hd.x + o[0], hd.y + o[1], hd.z + o[2]];
  // body, haunches and chest
  if (kit) {
    part('body', 0.078, { p: [0, 0.07, -0.01], s: [1.02, 0.95, 1.02] }, 2, 0.015, 3);
    for (const x of [-1, 1]) part('body', 0.048, { p: [x * 0.04, 0.056, -0.045], s: [0.65, 0.95, 1] });
    part('body', 0.052, { p: [0, 0.068, 0.035] });
  } else if (up) {
    part('body', 0.12, { p: [0, 0.13, -0.03], s: [0.95, 1.3, 0.92] }, 2, 0.035, 3);
    for (const x of [-1, 1]) part('body', 0.075, { p: [x * 0.06, 0.075, -0.05], s: [0.65, 0.9, 1.1] });
    part('body', 0.07, { p: [0, 0.19, 0.03], s: [0.9, 1.1, 0.85] });
  } else {
    part('body', 0.12, { p: [0, 0.1, -0.03], s: [1, 0.85, 1.2] }, 2, 0.035, 3);
    for (const x of [-1, 1]) part('body', 0.075, { p: [x * 0.058, 0.085, -0.075], s: [0.62, 0.95, 1.05] });
    part('body', 0.08, { p: [0, 0.1, 0.06], s: [0.95, 0.95, 0.9] });
  }
  // long hind feet flat on the ground, and the forepaws (tucked to the chest when sitting up)
  const s = kit ? 0.65 : 1;
  for (const x of [-1, 1]) {
    part('foot', 0.03 * s, { p: [x * 0.062 * s, 0.016 * s, (up ? 0 : -0.02) * s], s: [0.62, 0.42, 2] });
    part('paw', 0.022 * s, up ? { p: [x * 0.03, 0.15, 0.085], s: [0.7, 1.1, 0.8] } : { p: [x * 0.033 * s, 0.02 * s, kit ? 0.065 : 0.1], s: [0.75, 0.7, 1.35] });
  }
  // the head: a rounded muzzle, a pink nose, bright eyes with a catch-light (a kit's bigger)
  part('head', hr, { p: [hd.x, hd.y, hd.z], s: [1, 0.95, 1.12] }, 2, 0.01, 5);
  part('muzzle', hr * 0.47, { p: at([0, -hr * 0.25, hr * 0.8]), s: [1.15, 0.8, 0.8] });
  k.sphere(hr * 0.13, '#d98c8c', { p: at([0, -hr * 0.1, hr * 1.24]) }, [6, 4]);
  for (const x of [-1, 1]) {
    k.sphere(kit ? 0.0135 : 0.012, '#1b1511', { p: at([x * hr * 0.63, hr * 0.17, hr * 0.5]) }, [6, 5]);
    k.sphere(0.0038, '#ffffff', { p: at([x * hr * 0.7, hr * 0.26, hr * 0.6]) }, [4, 3]);
  }
  // ears: long and upright (short on a kit), or a lop's hanging by its cheeks under a crown
  for (const x of [-1, 1]) {
    if (lop) {
      // (broad, flat flaps: thin across, long, and wide front to back)
      const e = { p: at([x * hr * 1.0, -hr * (kit ? 0.3 : 0.42), -hr * 0.12]), r: [0.2, 0, x * 0.2] as V3, s: [0.36, kit ? 1.7 : 2.3, 1.05] as V3 };
      part('ear', kit ? 0.024 : 0.032, e);
    } else {
      const len = kit ? 1.75 : 2.6;
      const e = { p: at([x * hr * 0.38, hr * (kit ? 1.1 : 1.4), -hr * 0.55]), r: [up ? -0.12 : -0.45, 0, x * (kit ? 0.28 : 0.1)] as V3 };
      part('ear', kit ? 0.022 : 0.03, { ...e, s: [0.55, len, 0.35] });
      part('earIn', kit ? 0.014 : 0.018, { ...e, p: [e.p[0], e.p[1], e.p[2] + (kit ? 0.009 : 0.013)], s: [0.45, len * 0.85, 0.2] }, 0);
    }
  }
  if (lop) part('head', hr * 0.42, { p: at([0, hr * 0.78, -hr * 0.12]), s: [1.9, 0.6, 0.9] });
  // the white scut
  part('scut', kit ? 0.022 : 0.036, { p: kit ? [0, 0.075, -0.105] : up ? [0, 0.07, -0.155] : [0, 0.12, -0.175] });
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

