import { BufferGeometry, Color, Float32BufferAttribute, Quaternion, SphereGeometry, Vector3 } from 'three';
import { Kit, hash3, mix, smoothBlob } from './kit';

/** Natural props (rocks, flowers, grass, clouds, pond plants): one merged geometry per kind. Trees and bushes live in foliage.ts. */

function solid(k: Kit): BufferGeometry {
  return k.build().solid!;
}

/**
 * A lumpy blob with a few flat, chiselled faces: every vertex beyond a seeded cutting plane is
 * pushed back onto it, so the stone gets broad planes with soft (smooth-normal) edges instead of
 * reading as a potato. Cuts favour the sides and top (the bottom is buried in the ground).
 */
export function chiselledBlob(r: number, detail: number, lump: number, seed: number, cuts: number, depth = 0.74): BufferGeometry {
  const g = smoothBlob(r, detail, lump, seed);
  const pos = g.getAttribute('position');
  const v = new Vector3();
  const planes: [Vector3, number][] = [];
  for (let i = 0; i < cuts; i++) {
    const a = (i / cuts) * Math.PI * 2 + hash3(seed, i, 1) * 1.6;
    const y = i === 0 ? 0.8 + hash3(seed, i, 2) * 0.2 : -0.1 + hash3(seed, i, 2) * 0.75;
    const d = new Vector3(Math.cos(a) * Math.sqrt(1 - y * y), y, Math.sin(a) * Math.sqrt(1 - y * y)).normalize();
    planes.push([d, r * (depth + (hash3(seed, i, 3) - 0.5) * 0.14)]);
  }
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    for (const [d, o] of planes) {
      const t = v.dot(d);
      if (t > o) v.addScaledVector(d, o - t);
    }
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** Stones carry `aMoss` (0…1): how much moss the shader may grow on their upward faces (see rockDetail.ts). */
function stoneGeometry(k: Kit, moss: number): BufferGeometry {
  const g = solid(k);
  g.setAttribute('aMoss', new Float32BufferAttribute(new Float32Array(g.getAttribute('position').count).fill(moss), 1));
  return g;
}

// cool-to-warm greys, lighter on top; the painted `boulder` tile adds the grain, the shader the moss
const stonePaint = (dark: string, light: string, jitter: number) => (p: Vector3, n: Vector3) =>
  mix(dark, light, 0.3 + n.y * 0.45 + (hash3(p.x * 5, p.y * 5, p.z * 5) - 0.5) * jitter);

export function rock(): BufferGeometry {
  const k = new Kit();
  const stone = stonePaint('#7c7a82', '#b6b3b8', 0.1);
  k.add(chiselledBlob(0.34, 2, 0.14, 1, 5), stone, { p: [0, 0.18, 0], s: [1.2, 0.85, 1] });
  k.add(chiselledBlob(0.22, 2, 0.16, 2, 4), stone, { p: [0.32, 0.1, 0.12], s: [1.1, 0.8, 1] });
  k.add(chiselledBlob(0.16, 1, 0.18, 3, 3, 0.8), stone, { p: [-0.28, 0.06, 0.18] });
  return stoneGeometry(k, 0.55);
}

/** A big, chunky boulder with a mossy cap (grown in the shader) and a couple of chips at its foot. */
export function boulder(): BufferGeometry {
  const k = new Kit();
  const stone = stonePaint('#7e7876', '#bcb4ac', 0.12);
  k.add(chiselledBlob(0.5, 2, 0.18, 11, 6), stone, { p: [0, 0.32, 0], s: [1.15, 0.95, 0.95] });
  k.add(chiselledBlob(0.3, 1, 0.2, 12, 4, 0.78), stone, { p: [0.42, 0.18, 0.2], s: [1, 0.85, 1] });
  k.add(chiselledBlob(0.13, 1, 0.22, 13, 3, 0.8), stone, { p: [-0.48, 0.07, 0.26] });
  k.add(chiselledBlob(0.1, 1, 0.22, 14, 3, 0.8), stone, { p: [0.12, 0.05, -0.52] });
  return stoneGeometry(k, 1);
}

/** A small smooth river stone (no moss). */
export function pebble(): BufferGeometry {
  const k = new Kit();
  k.blob(0.5, (_p, n) => mix('#7d756e', '#b3a99c', 0.35 + n.y * 0.4), { p: [0, 0.18, 0], s: [1.25, 0.5, 0.9] }, 1, 'solid', 0.12, 21);
  return stoneGeometry(k, 0);
}

export function grassTuft(): BufferGeometry {
  const k = new Kit();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + hash3(i, 1, 2);
    const h = 0.12 + hash3(i, 3, 4) * 0.1;
    const q = new Quaternion().setFromAxisAngle(new Vector3(-Math.sin(a), 0, Math.cos(a)), 0.35 + hash3(i, 5, 6) * 0.3);
    k.cone(0.022, h, (p) => mix('#3f8a34', '#a4dc6e', (p.y + h / 2) / h), { p: [Math.cos(a) * 0.04, h / 2, Math.sin(a) * 0.04], q }, 3);
  }
  return solid(k);
}

/**
 * Grass clump as three crossed, alpha-tested cards (6 triangles instead of ~36) for the painted
 * `grass-card` sprite. Normals point straight up so the cards shade like the lawn around them;
 * vertex colours run dark at the root to light at the tips (the sprite is greyscale).
 */
export function grassCards(width = 0.36, height = 0.27): BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const col: number[] = [];
  const nrm: number[] = [];
  const idx: number[] = [];
  const lo = new Color('#5c9f42');
  const hi = new Color('#c8ef8a');
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI + 0.3;
    const dx = (Math.cos(a) * width) / 2;
    const dz = (Math.sin(a) * width) / 2;
    const b = pos.length / 3;
    const corners: [number, number, number, number, number][] = [
      [-dx, 0, -dz, 0, 0],
      [dx, 0, dz, 1, 0],
      [dx, height, dz, 1, 1],
      [-dx, height, -dz, 0, 1],
    ];
    for (const [x, y, z, u, v] of corners) {
      pos.push(x, y - 0.01, z);
      uv.push(u, v);
      const c = lo.clone().lerp(hi, v);
      col.push(c.r, c.g, c.b);
      nrm.push(0, 1, 0);
    }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

export type FlowerKind = 'tulip' | 'cosmos' | 'pansy';

/** A floating card lying flat (y = 0), `size` across, with texture cell `uv` (lily pads). */
export function flatCard(size: number, uv: readonly [number, number, number, number]): BufferGeometry {
  const h = size / 2;
  const [u0, v0, u1, v1] = uv;
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([-h, 0, h, h, 0, h, h, 0, -h, -h, 0, -h], 3));
  g.setAttribute('normal', new Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute('uv', new Float32BufferAttribute([u0, v0, u1, v0, u1, v1, u0, v1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

/**
 * `planes` crossed upright cards (base at y = 0) showing texture cell `uv`: pond reeds, irises,
 * ferns. Normals point up so the plants shade like the ground they grow from.
 */
export function uprightCards(width: number, height: number, uv: readonly [number, number, number, number], planes = 2, twist = 0.35): BufferGeometry {
  const pos: number[] = [];
  const nrm: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  const [u0, v0, u1, v1] = uv;
  for (let i = 0; i < planes; i++) {
    const a = (i / planes) * Math.PI + twist;
    const dx = (Math.cos(a) * width) / 2;
    const dz = (Math.sin(a) * width) / 2;
    const b = pos.length / 3;
    pos.push(-dx, -0.02, -dz, dx, -0.02, dz, dx, height, dz, -dx, height, -dz);
    for (let k = 0; k < 4; k++) nrm.push(0, 1, 0);
    uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  return g;
}

const BLOOM_SPOTS: [number, number, number][] = [
  [0, 0.26, 0],
  [0.09, 0.2, 0.05],
  [-0.08, 0.18, -0.04],
];

/** Stems, leaves and flower centres (not tinted per instance). */
export function flowerStems(kind: FlowerKind): BufferGeometry {
  const k = new Kit();
  for (const [x, y, z] of BLOOM_SPOTS) {
    k.cyl(0.008, 0.01, y, '#4a9a3c', { p: [x * 0.6, y / 2, z * 0.6], r: [z * 1.2, 0, -x * 1.2] }, 4);
    if (kind === 'cosmos') k.sphere(0.022, '#f4c542', { p: [x, y + 0.01, z] }, [6, 4]);
    if (kind === 'pansy') k.sphere(0.018, '#f4c542', { p: [x, y + 0.03, z + 0.02] }, [6, 4]);
  }
  const leaves = kind === 'tulip' ? 3 : 5;
  for (let i = 0; i < leaves; i++) {
    const a = (i / leaves) * Math.PI * 2 + 0.3;
    const q = new Quaternion().setFromAxisAngle(new Vector3(-Math.sin(a), 0, Math.cos(a)), kind === 'tulip' ? 0.45 : 1.1);
    k.blob(kind === 'tulip' ? 0.06 : 0.045, '#3f8f38', { p: [Math.cos(a) * 0.05, kind === 'tulip' ? 0.07 : 0.03, Math.sin(a) * 0.05], q, s: [0.6, 2.2, 0.25] }, 0);
  }
  return solid(k);
}

/** Petals only, near-white so the per-instance colour tints them. */
export function flowerBlooms(kind: FlowerKind): BufferGeometry {
  const k = new Kit();
  const petal = (p: Vector3) => mix('#d9d9d9', '#ffffff', 0.5 + p.y * 4);
  for (const [x, y, z] of BLOOM_SPOTS) {
    k.group({ p: [x, y, z] }, () => {
      if (kind === 'tulip') {
        k.lathe(
          [
            [0.001, -0.02],
            [0.04, -0.015],
            [0.058, 0.03],
            [0.052, 0.07],
            [0.001, 0.05],
          ],
          petal,
          {},
          10,
        );
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          k.cone(0.03, 0.05, '#ffffff', { p: [Math.cos(a) * 0.03, 0.08, Math.sin(a) * 0.03] }, 5);
        }
      } else if (kind === 'cosmos') {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          k.blob(0.03, petal, { p: [Math.cos(a) * 0.045, 0.005, Math.sin(a) * 0.045], r: [0, -a, 0.2], s: [1.7, 0.3, 0.9] }, 0);
        }
      } else {
        const petals: [number, number, number][] = [
          [-0.03, 0.035, -0.005],
          [0.03, 0.035, -0.005],
          [-0.042, 0.0, 0.02],
          [0.042, 0.0, 0.02],
          [0, -0.02, 0.045],
        ];
        for (const [px, py, pz] of petals) k.blob(0.038, petal, { p: [px, py + 0.03, pz], r: [-0.9, 0, 0], s: [1, 1, 0.3] }, 0);
      }
    });
  }
  return solid(k);
}

export function cloud(): BufferGeometry {
  const k = new Kit();
  const puffs: [number, number, number, number][] = [
    [0, 0, 0, 1.1],
    [1.1, -0.2, 0.1, 0.85],
    [-1.1, -0.25, 0, 0.8],
    [0.5, 0.45, -0.1, 0.8],
    [-0.5, 0.35, 0.1, 0.75],
    [1.8, -0.35, 0, 0.55],
    [-1.75, -0.4, 0, 0.5],
  ];
  const c = (_p: Vector3, n: Vector3) => mix('#dbe6f5', '#ffffff', 0.55 + n.y * 0.45);
  puffs.forEach(([x, y, z, r], i) => k.blob(r, c, { p: [x, y, z], s: [1, 0.85, 0.8] }, 2, 'solid', 0.08, i));
  return solid(k);
}

export function lilyPad(): BufferGeometry {
  const k = new Kit();
  k.cyl(0.22, 0.22, 0.02, '#5cae4f', { p: [0, 0, 0] }, 16);
  k.box([0.2, 0.03, 0.04], '#4a9a3c', { p: [0.1, 0.01, 0] }, 0.01);
  return solid(k);
}

/** Reeds + cattails clump for the pond edge. */
export function reeds(): BufferGeometry {
  const k = new Kit();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + hash3(i, 2, 3);
    const h = 0.35 + hash3(i, 4, 5) * 0.3;
    const q = new Quaternion().setFromAxisAngle(new Vector3(-Math.sin(a), 0, Math.cos(a)), 0.12 + hash3(i, 6, 7) * 0.18);
    k.cone(0.025, h, (p) => mix('#3f7f34', '#8cc860', (p.y + h / 2) / h), { p: [Math.cos(a) * 0.05, h / 2, Math.sin(a) * 0.05], q }, 3);
    if (i % 3 === 0) {
      k.cyl(0.006, 0.006, h + 0.1, '#5a8a3a', { p: [Math.cos(a) * 0.02, (h + 0.1) / 2, Math.sin(a) * 0.02] }, 4);
      k.add(new SphereGeometry(0.03, 8, 6), '#7a4a2e', { p: [Math.cos(a) * 0.02, h + 0.05, Math.sin(a) * 0.02], s: [1, 2.4, 1] });
    }
  }
  return solid(k);
}

/** Butterfly wing (one side); flapped by rotating around its root (local x = 0). */
export function butterflyWing(): BufferGeometry {
  const k = new Kit();
  k.add(new SphereGeometry(0.06, 10, 6), '#ffffff', { p: [0.06, 0, 0.02], s: [1, 0.12, 0.8] });
  k.add(new SphereGeometry(0.045, 10, 6), '#f5f5f5', { p: [0.045, 0, -0.05], s: [1, 0.12, 0.7] });
  return solid(k);
}
