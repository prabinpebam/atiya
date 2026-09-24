import { BufferGeometry, Quaternion, SphereGeometry, Vector3 } from 'three';
import { Kit, hash3, mix } from './kit';

/** Natural props (rocks, flowers, grass, clouds, pond plants): one merged geometry per kind. Trees and bushes live in foliage.ts. */

function solid(k: Kit): BufferGeometry {
  return k.build().solid!;
}

export function rock(): BufferGeometry {
  const k = new Kit();
  const stone = (_p: Vector3, n: Vector3) => mix('#7a7984', '#b1b0ba', 0.35 + n.y * 0.5);
  k.blob(0.34, stone, { p: [0, 0.18, 0], s: [1.2, 0.85, 1] }, 2, 'solid', 0.18, 1);
  k.blob(0.22, stone, { p: [0.32, 0.1, 0.12], s: [1.1, 0.8, 1] }, 2, 'solid', 0.2, 2);
  k.blob(0.16, stone, { p: [-0.28, 0.06, 0.18] }, 1, 'solid', 0.2, 3);
  return solid(k);
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

export type FlowerKind = 'tulip' | 'cosmos' | 'pansy';

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
