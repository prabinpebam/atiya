import { Vector3, type BufferGeometry, type ColorRepresentation } from 'three';
import { Kit, mix, type Xf } from './kit';
import { Cards, leafLobe, leafyBush, type TreeGeometry } from './foliage';
import { flowerBlooms, flowerStems, type FlowerKind } from './propModels';
import { ARCH, shade } from './parts';

/**
 * Pots, window boxes and the plaza's stone urns, planted with the planet's own plants: the meadow
 * flowers (tulip, cosmos, pansy), the leafy bush and tufts of the painted leaf cards, so a planter
 * reads like the flowerbeds rather than a ball on a pot. Everything merges into the model's kit
 * (the cards into its `leaves` layer), so a building's planters add no draw calls of their own.
 */

const KINDS: FlowerKind[] = ['tulip', 'cosmos', 'pansy'];
const flowers = new Map<FlowerKind, [BufferGeometry, BufferGeometry]>();
let bush: TreeGeometry | null = null;

/** A meadow flower (three blooms on their stems, `bloom` tinting the petals), base at the group's origin. */
function flower(k: Kit, xf: Xf, kind: FlowerKind, bloom: ColorRepresentation) {
  let f = flowers.get(kind);
  if (!f) flowers.set(kind, (f = [flowerStems(kind), flowerBlooms(kind)]));
  k.merge(f[0], xf);
  k.merge(f[1], xf, bloom);
}

/** The planet's leafy bush (foliage.ts), merged into a model: its core and its leaf cards. */
export function shrub(k: Kit, xf: Xf) {
  bush ??= leafyBush();
  k.merge(bush.solid, xf);
  k.cards(bush.leaves, xf);
}

const LEAF = { light: '#d8f07c', mid: '#82c852', dark: '#2f7a42' };

/** A low tuft of leaf cards round `c` (radius `r`). */
function tuft(cards: Cards, c: Vector3, r: number, count: number, seed: number) {
  leafLobe(cards, c, r, { ...LEAF, count, size: r * 1.15, seed, minY: -0.35 });
}

/** Ivy trailing over a rim: a short chain of leaves hanging from `p`, falling outward along `out`. */
function trail(cards: Cards, p: Vector3, out: Vector3, n: number, seed: number) {
  const side = new Vector3(0, 1, 0).cross(out).normalize();
  const tip = out.clone().multiplyScalar(0.35).add(new Vector3(0, -1, 0)).normalize();
  for (let i = 0; i < n; i++) {
    const t = i / Math.max(1, n - 1);
    const at = p.clone().addScaledVector(tip, i * 0.055).addScaledVector(side, Math.sin(seed + i * 2.1) * 0.02);
    cards.add(at, tip, side, 0.085 - t * 0.02, 0.9, mix(LEAF.dark, LEAF.mid, 0.6 - t * 0.4).multiplyScalar(1.15), out.clone().lerp(new Vector3(0, 1, 0), 0.4).normalize(), 0.1);
  }
}

// terracotta: darker toward the foot, a paler rolled rim, and the soil inside
const clay = (top: number, inner: number) => (p: Vector3, n: Vector3) =>
  p.y > top - 0.03 && n.y > 0.7 && Math.hypot(p.x, p.z) < inner ? ARCH.soil : mix('#a9532f', '#d98a5c', Math.min(1, p.y / top + (p.y > top - 0.04 ? 0.25 : 0)));

/**
 * A terracotta pot on its saucer, planted: a tuft of leaves and a meadow flower in `bloom` (the kind
 * cycles with `seed`), or without a bloom a small round bush. Origin at the foot of the saucer.
 */
export function potPlant(k: Kit, xf: Xf, bloom?: ColorRepresentation, seed = 0) {
  k.group(xf, () => {
    k.surface('plaster', () => {
      k.cyl(0.125, 0.112, 0.022, shade('#b8653f', -0.08), { p: [0, 0.011, 0] }, 14);
      k.lathe(
        [
          [0.001, 0.02],
          [0.085, 0.02],
          [0.092, 0.032],
          [0.116, 0.16],
          [0.14, 0.166],
          [0.145, 0.205],
          [0.126, 0.21],
          [0.12, 0.19],
          [0.001, 0.19],
        ],
        clay(0.21, 0.121),
        {},
        14,
      );
    });
    const cards = new Cards();
    if (bloom) {
      tuft(cards, new Vector3(0, 0.22, 0), 0.1, 16, 31 + seed * 7);
      flower(k, { p: [0, 0.19, 0], r: [0, seed * 1.3, 0], s: 0.95 }, KINDS[seed % 3], bloom);
      trail(cards, new Vector3(0.13, 0.2, 0.03), new Vector3(1, 0, 0.2).normalize(), 3, seed);
    } else shrub(k, { p: [0, 0.16, 0], s: 0.34 });
    k.cards(cards.build());
  });
}

/**
 * A window box on two brackets (or, `legs`, a trough standing on four short legs), planted along its
 * length: leaf tufts between meadow flowers in `colors`, with ivy trailing over the front. Origin at
 * the centre of the box; the front is +z.
 */
export function flowerBox(k: Kit, xf: Xf, w: number, colors: ColorRepresentation[], legs = false) {
  k.group(xf, () => {
    k.surface('wood', () => {
      k.box([w, 0.13, 0.15], ARCH.wood, {}, 0.02);
      k.box([w + 0.02, 0.025, 0.17], ARCH.woodDark, { p: [0, 0.064, 0] }, 0.01);
      k.box([w - 0.04, 0.02, 0.006], ARCH.woodDark, { p: [0, -0.02, 0.077] }, 0.004);
      for (const s of [-1, 1]) {
        if (!legs) k.box([0.03, 0.12, 0.03], ARCH.woodDark, { p: [s * (w / 2 - 0.07), -0.1, -0.03], r: [0.75, 0, 0] }, 0.008);
        else for (const z of [-0.05, 0.05]) k.box([0.035, 0.09, 0.035], ARCH.woodDark, { p: [s * (w / 2 - 0.04), -0.09, z] }, 0.008);
      }
    });
    k.box([w - 0.03, 0.01, 0.12], ARCH.soil, { p: [0, 0.07, 0] }, 0.004);
    const cards = new Cards();
    const n = Math.max(2, Math.round(w / 0.15));
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (w / n) * (i + 0.5);
      flower(k, { p: [x, 0.07, -0.01], r: [0, i * 2.1, 0], s: 0.58 }, KINDS[i % 3], colors[i % colors.length]);
      tuft(cards, new Vector3(x + w / n / 2 - 0.02, 0.1, 0.01), 0.06, 10, i * 5 + 3);
      if (i % 2 === 0) trail(cards, new Vector3(x + 0.03, 0.075, 0.078), new Vector3(0, 0, 1), 3, i);
    }
    tuft(cards, new Vector3(-w / 2 + 0.05, 0.1, 0.01), 0.055, 8, 97);
    k.cards(cards.build());
  });
}

/** The plaza's stone urn on its foot, planted with a leafy bush ringed by flowers and trailing ivy. Origin on the ground. */
export function stoneUrn(k: Kit, xf: Xf, colors: ColorRepresentation[]) {
  k.group(xf, () => {
    k.surface('rock', () => {
      k.lathe(
        [
          [0.001, 0],
          [0.27, 0],
          [0.28, 0.05],
          [0.2, 0.08],
          [0.17, 0.13],
          [0.26, 0.17],
          [0.34, 0.26],
          [0.37, 0.3],
          [0.37, 0.335],
          [0.33, 0.34],
          [0.32, 0.31],
          [0.001, 0.31],
        ],
        (p: Vector3, n: Vector3) => (p.y > 0.29 && n.y > 0.7 && Math.hypot(p.x, p.z) < 0.325 ? ARCH.soil : mix(ARCH.stoneDark, ARCH.stone, Math.min(1, 0.35 + p.y * 2))),
        {},
        20,
      );
    });
    shrub(k, { p: [0, 0.25, 0], s: 0.42 });
    const cards = new Cards();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.3;
      const out = new Vector3(Math.cos(a), 0, Math.sin(a));
      flower(k, { p: [out.x * 0.28, 0.3, out.z * 0.28], r: [0, -a, 0], s: 0.9 }, KINDS[i % 3], colors[i % colors.length]);
      trail(cards, out.clone().multiplyScalar(0.36).setY(0.33), out, 4, i);
    }
    k.cards(cards.build());
  });
}
