/**
 * The pond's water lilies (docs: family.md §3): modelled pads and flowers, no texture cards. They
 * float on the pond by the home, so they come with the home's chunk and are drawn by its view.
 */
import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import { Kit, hash3, mix, type V3 } from '../kit';

function solid(k: Kit): BufferGeometry {
  return k.build().solid!;
}
// ---------------------------------------------------------------------------
// Water lilies: modelled pads and flowers (no texture cards), several pads and a bloom or bud per
// cluster, merged into one geometry per variant

const LILY_NOTCH = 0.32;
const PAD_RINGS = [0, 0.3, 0.62, 0.88, 1] as const;
const PAD_SEGS = 24;

/**
 * One lily pad of radius 1 (scaled by the kit), lying on the water (y = 0): a disc with the water
 * lily's V-shaped notch running in to the centre, its rim turned up a touch and gently waved, and a
 * thin skirt round the edge so it reads as a leaf with some body. Wound counter-clockwise from above.
 */
export function lilyPadGeometry(seed = 0): BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  const a0 = LILY_NOTCH / 2;
  const span = Math.PI * 2 - LILY_NOTCH;
  const lift = (r: number, a: number) => 0.035 * r ** 4 + 0.012 * r ** 3 * Math.sin(a * 5 + seed * 2.3);
  // the top: rings of vertices from the centre out (the centre is a single vertex)
  pos.push(0, 0.01, 0);
  for (let ri = 1; ri < PAD_RINGS.length; ri++) {
    const r = PAD_RINGS[ri];
    for (let j = 0; j <= PAD_SEGS; j++) {
      const a = a0 + (span * j) / PAD_SEGS;
      // (x, z) = (cos a, −sin a): angles run counter-clockwise seen from above
      pos.push(Math.cos(a) * r, 0.01 + lift(r, a), -Math.sin(a) * r);
    }
  }
  const at = (ri: number, j: number) => (ri === 0 ? 0 : 1 + (ri - 1) * (PAD_SEGS + 1) + j);
  for (let j = 0; j < PAD_SEGS; j++) idx.push(0, at(1, j), at(1, j + 1));
  for (let ri = 1; ri < PAD_RINGS.length - 1; ri++) {
    for (let j = 0; j < PAD_SEGS; j++) idx.push(at(ri, j), at(ri + 1, j), at(ri + 1, j + 1), at(ri, j), at(ri + 1, j + 1), at(ri, j + 1));
  }
  // the skirt: the rim down to just under the water, facing out
  const rim = PAD_RINGS.length - 1;
  const base = pos.length / 3;
  for (let j = 0; j <= PAD_SEGS; j++) {
    const a = a0 + (span * j) / PAD_SEGS;
    pos.push(Math.cos(a) * 0.985, -0.012, -Math.sin(a) * 0.985);
  }
  for (let j = 0; j < PAD_SEGS; j++) idx.push(at(rim, j), base + j, base + j + 1, at(rim, j), base + j + 1, at(rim, j + 1));
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Pad colour: sunlit yellow-green at the heart, deeper at the rim, pale veins radiating out, the skirt the leaf's red-bronze underside. */
function padPaint(tone: number) {
  return (p: Vector3) => {
    if (p.y < 0) return mix('#6b3a2e', '#4d6b35', 0.4 + tone * 0.3);
    const r = Math.hypot(p.x, p.z);
    const a = Math.atan2(-p.z, p.x);
    const vein = Math.abs(Math.cos(a * 4.5)) ** 10 * Math.min(1, r * 2.2) * (1 - r * 0.5);
    const leaf = mix(mix('#9ccf5e', '#4f9a40', 0.25 + tone * 0.2), mix('#3f8a3a', '#2f7440', tone), Math.min(1, r * 1.1));
    return mix(leaf, '#c9e98a', vein * 0.55);
  };
}

/** A lily petal of length 1 along +z from its base: pointed, cupped (its sides raised), both faces shown. */
function petalGeometry(): BufferGeometry {
  const rows = [0, 0.22, 0.48, 0.74, 1];
  const top: number[] = [];
  for (const t of rows) {
    const w = 0.5 * Math.sin(Math.PI * Math.min(0.98, t * 0.9 + 0.05)) ** 0.8 * (1 - 0.45 * t) * (t === 1 ? 0 : 1);
    const cup = w * 0.55;
    top.push(-w, cup, t, 0, 0, t, w, cup, t);
  }
  const idx: number[] = [];
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = i * 3;
    const b = (i + 1) * 3;
    // (left, mid, right) per row; up-facing triangles: counter-clockwise seen from +y
    idx.push(a, b, b + 1, a, b + 1, a + 1, a + 1, b + 1, b + 2, a + 1, b + 2, a + 2);
  }
  const n = top.length / 3;
  const back = idx.slice();
  for (let i = 0; i < back.length; i += 3) idx.push(back[i] + n, back[i + 2] + n, back[i + 1] + n);
  const pos = [...top, ...top.map((v, i) => (i % 3 === 1 ? v - 0.02 : v))];
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * A water lily in bloom (or a closed bud), base on the pad: three rings of cupped, pointed petals,
 * the outer ones opening wide and the inner ones standing up round a golden heart of stamens.
 * `pink` sets how far the petal tips blush (0 white … 1 rose pink).
 */
function lilyFlower(k: Kit, xf: { p: V3; yaw: number }, pink: number, bud = false): void {
  const petal = petalGeometry();
  const tip = mix('#fff6f8', '#ff6f9f', pink);
  const paint = (p: Vector3) => mix('#fffaf2', tip, Math.min(1, Math.max(0, (p.z - 0.25) / 0.75)) ** 1.4);
  const rings: Array<[count: number, len: number, width: number, tilt: number, turn: number]> = bud
    ? [
        [5, 0.075, 0.034, 1.25, 0],
        [4, 0.065, 0.03, 1.4, 0.6],
      ]
    : [
        [8, 0.085, 0.036, 0.3, 0],
        [8, 0.075, 0.034, 0.72, 0.39],
        [6, 0.06, 0.03, 1.12, 0.2],
      ];
  // (a bloom about two-thirds of its pad across, as on the real plant)
  k.group({ p: xf.p, r: [0, xf.yaw, 0], s: 1.65 }, () => {
    // four green sepals under the petals
    if (!bud) for (let i = 0; i < 4; i++) k.group({ r: [0, (i / 4) * Math.PI * 2 + 0.2, 0] }, () => k.group({ r: [-0.18, 0, 0] }, () => k.add(petal.clone(), mix('#4f8f45', '#7a9a55', 0.3), { s: [0.036, 0.04, 0.08] })));
    for (const [count, len, width, tilt, turn] of rings) {
      for (let i = 0; i < count; i++) {
        k.group({ p: [0, 0.006, 0], r: [0, (i / count) * Math.PI * 2 + turn, 0] }, () => k.group({ r: [-tilt, 0, 0] }, () => k.add(petal.clone(), paint, { s: [width, width * 0.9, len] })));
      }
    }
    if (bud) return;
    // the heart: a golden boss ringed with stamens
    k.sphere(0.014, '#f2b53a', { p: [0, 0.022, 0], s: [1, 0.55, 1] }, [8, 5]);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      k.cyl(0.0022, 0.0028, 0.024, '#ffd24d', { p: [Math.cos(a) * 0.016, 0.03, Math.sin(a) * 0.016], r: [Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35] }, 3);
    }
  });
}

/** Lily cluster variants: 0 a pink bloom and a bud, 1 a white bloom, 2 pads and a bud. */
export const LILY_VARIANTS = 3;

/**
 * A floating cluster of water lilies (about 0.8 u across at scale 1), base at the water (y = 0):
 * a few pads of mixed sizes, each turned its own way and a hair apart in height so none of them
 * flicker where they overlap, with a bloom and/or a bud standing on the biggest.
 */
export function lilyCluster(variant = 0): BufferGeometry {
  const k = new Kit();
  const rnd = (i: number, j: number) => hash3(i, j, 17.3 + variant * 3.1);
  const pads: Array<[x: number, z: number, r: number]> = [
    [0, 0, 0.19],
    [0.27, 0.13, 0.13],
    [-0.21, 0.19, 0.12],
    [0.08, -0.27, 0.14],
    [-0.28, -0.13, 0.09],
  ];
  const count = variant === 2 ? 4 : 5;
  for (let i = 0; i < count; i++) {
    const [x, z, r] = pads[i];
    const jx = (rnd(i, 1) - 0.5) * 0.06;
    const jz = (rnd(i, 2) - 0.5) * 0.06;
    k.add(lilyPadGeometry(i + variant), padPaint(rnd(i, 3)), { p: [x + jx, i * 0.0015, z + jz], r: [0, rnd(i, 4) * Math.PI * 2, 0], s: [r * (0.9 + rnd(i, 5) * 0.2), 1, r * (0.9 + rnd(i, 5) * 0.2)] });
  }
  if (variant === 0) {
    lilyFlower(k, { p: [0.03, 0.012, 0.02], yaw: 0.4 }, 0.85);
    lilyFlower(k, { p: [0.27, 0.01, 0.13], yaw: 1.3 }, 0.9, true);
  } else if (variant === 1) {
    lilyFlower(k, { p: [-0.02, 0.012, 0.03], yaw: 2.1 }, 0.12);
  } else {
    lilyFlower(k, { p: [0.08, 0.012, -0.27], yaw: 0.8 }, 0.6, true);
  }
  return solid(k);
}
