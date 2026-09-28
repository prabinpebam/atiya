/**
 * The old pine on the viewing deck's cliff (viewing-deck.md §4.6): a windswept, bonsai-like tree
 * whose trunk rises from the upper rim, bends out and runs nearly level over the edge, ending in a
 * cascade. Its roots grip the rim (two drape over it down the wall), a bleached deadwood spur
 * rises from the bend, and its needles grow in full, domed pads at the ends of short branches,
 * the way a trained pine's do. In its own frame: +x out over the rim (≈ 0.3 u out), y up.
 */
import { BufferGeometry, Vector3 } from 'three';
import { Kit, hash3, mix } from '../kit';
import { Cards, barkPaint, barkTube, leafLobe, lowPolyTrunk, spine } from '../foliage';

type P4 = [number, number, number, number];

const BARK = { dark: '#4a2f22', light: '#9a6a48' } as const;
const NEEDLES = { dark: '#2a5c3a', mid: '#4f914f', light: '#b0dc84' } as const;

/** The trunk's spine [x, y, z, r], from the root flare's knee to the cascade's tip. */
const TRUNK: P4[] = [
  [0, 0.26, 0, 0.17],
  [0.07, 0.52, 0.06, 0.15],
  [0.28, 0.76, -0.03, 0.13],
  [0.6, 0.86, -0.1, 0.115],
  [0.94, 0.8, 0.02, 0.1],
  [1.26, 0.68, 0.12, 0.085],
  [1.54, 0.66, 0.05, 0.07],
  [1.78, 0.78, -0.03, 0.05],
];

/** Foliage pads: [x, y, z, radius], each at the end of a branch from trunk ring `from`. */
const PADS: Array<{ c: P4; from: number }> = [
  // the cascade at the tip, and the pads that hang below it
  { c: [1.96, 0.96, -0.02, 0.56], from: 7 },
  { c: [1.62, 0.52, -0.4, 0.42], from: 6 },
  { c: [1.52, 1.1, 0.36, 0.44], from: 5 },
  { c: [1.24, 1.42, -0.06, 0.36], from: 5 },
  // along the bend
  { c: [1.06, 1.14, 0.54, 0.46], from: 4 },
  { c: [0.96, 0.74, -0.52, 0.42], from: 4 },
  { c: [0.56, 1.22, -0.52, 0.46], from: 3 },
  { c: [0.64, 1.54, 0.12, 0.38], from: 3 },
  // the crown over the root, and one back over the lawn
  { c: [0.18, 1.52, 0.12, 0.5], from: 2 },
  { c: [-0.3, 0.92, -0.24, 0.36], from: 1 },
];

/** A flat, layered pad of needles: a dark core and a few lobes spread in a disc, domed on top. */
function pad(k: Kit, cards: Cards, [x, y, z, r]: P4, seed: number): void {
  const core = (_p: Vector3, n: Vector3) => mix(NEEDLES.mid, '#173524', 0.55 - Math.max(0, n.y) * 0.5);
  k.blob(r * 0.8, core, { p: [x, y - r * 0.04, z], s: [1, 0.5, 1] }, 1, 'solid', 0.18, seed);
  const o = { light: NEEDLES.light, mid: NEEDLES.mid, dark: NEEDLES.dark };
  leafLobe(cards, new Vector3(x, y + r * 0.12, z), r * 0.55, { ...o, count: Math.round(95 * r) + 14, size: 0.22 + r * 0.25, seed, minY: -0.2 });
  // a domed top layer, so the pad reads full rather than flat
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + hash3(seed, i, 6);
    leafLobe(cards, new Vector3(x + Math.cos(a) * r * 0.28, y + r * 0.3, z + Math.sin(a) * r * 0.28), r * 0.36, {
      ...o,
      count: Math.round(50 * r) + 8,
      size: 0.17 + r * 0.2,
      seed: seed * 13 + i,
      minY: -0.1,
    });
  }
  const lobes = 7;
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2 + hash3(seed, i, 2) * 0.6;
    const d = r * (0.55 + hash3(seed, i, 3) * 0.12);
    leafLobe(cards, new Vector3(x + Math.cos(a) * d, y - r * 0.05 * hash3(seed, i, 4), z + Math.sin(a) * d), r * 0.4, {
      ...o,
      count: Math.round(58 * r) + 10,
      size: 0.17 + r * 0.22,
      seed: seed * 7 + i,
      minY: -0.45,
    });
  }
}

export function bonsaiModel(): { solid: BufferGeometry; leaves: BufferGeometry } {
  const k = new Kit();
  const cards = new Cards();
  const at = (i: number) => new Vector3(TRUNK[i][0], TRUNK[i][1], TRUNK[i][2]);
  lowPolyTrunk(k, {
    trunk: TRUNK,
    // (the branches to the pads, each from inside the trunk out to its pad's middle)
    limbs: PADS.map(({ c: [x, y, z], from }, i) => {
      const s = at(from);
      const r = TRUNK[from][3] * 0.55;
      const mid = s.clone().lerp(new Vector3(x, y, z), 0.5).add(new Vector3(0, 0.06 + hash3(i, 5, 1) * 0.06, 0));
      return [
        [s.x, s.y, s.z, r],
        [mid.x, mid.y, mid.z, r * 0.7],
        [x, y - 0.05, z, r * 0.45],
      ] as P4[];
    }),
    roots: 5,
    base: 0.2,
    stubs: 1,
    dark: BARK.dark,
    light: BARK.light,
    seed: 61,
  });
  const paint = barkPaint(BARK.dark, BARK.light, 1.1);
  k.surface('bark', () => {
    // roots gripping the rim: two run out and drape down over it, two more creep along it
    const roots: P4[][] = [
      [
        [0.12, 0.05, 0.08, 0.07],
        [0.3, 0.02, 0.14, 0.06],
        [0.37, -0.12, 0.16, 0.05],
        [0.39, -0.42, 0.13, 0.035],
      ],
      [
        [0.1, 0.05, -0.1, 0.065],
        [0.28, 0.01, -0.2, 0.055],
        [0.36, -0.14, -0.24, 0.045],
        [0.38, -0.34, -0.3, 0.03],
      ],
      [
        [-0.08, 0.04, 0.1, 0.06],
        [-0.3, 0.0, 0.28, 0.045],
        [-0.46, -0.02, 0.34, 0.025],
      ],
      [
        [-0.1, 0.04, -0.08, 0.06],
        [-0.34, 0.0, -0.16, 0.04],
        [-0.5, -0.02, -0.3, 0.022],
      ],
    ];
    roots.forEach((r, i) => k.add(barkTube(spine(r, 2), 5, 80 + i, 0.14, true), paint));
  });
  // the deadwood spur (a jin): bleached and twisted, up from the bend
  const bleached = barkPaint('#b8ab96', '#eee6d6', 1.6);
  k.surface('bark', () =>
    k.add(
      barkTube(
        spine([
          [0.3, 0.76, -0.02, 0.05],
          [0.26, 1.0, -0.14, 0.035],
          [0.36, 1.22, -0.1, 0.022],
          [0.32, 1.36, -0.18, 0.01],
        ]),
        4,
        97,
        0.1,
        true,
      ),
      bleached,
    ),
  );
  // a cushion of moss and two stones where it grips the rim
  k.blob(0.2, (_p, n) => mix('#46692c', '#7ea447', Math.max(0, n.y)), { p: [0.05, 0.0, 0.02], s: [1.6, 0.3, 1.3] }, 1, 'solid', 0.3, 5);
  k.surface('rock', () => {
    k.blob(0.1, '#9d968b', { p: [-0.26, 0.02, -0.05], s: [1.3, 0.6, 1] }, 1, 'solid', 0.25, 8);
    k.blob(0.07, '#b3ab9d', { p: [0.2, 0.02, 0.26], s: [1.2, 0.6, 1] }, 1, 'solid', 0.25, 9);
  });
  PADS.forEach(({ c }, i) => pad(k, cards, c, 11 + i * 5));
  return { solid: k.build().solid!, leaves: cards.build() };
}
