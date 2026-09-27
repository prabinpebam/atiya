/**
 * The swing's models (swing.md §4.3–4.5): the old oak with its long branch, a jute plant and its
 * stubble, the swing itself and its ghost. Kit geometry in local frames, drawn by `SwingView.tsx`.
 */
import { BoxGeometry, BufferGeometry, CylinderGeometry, EdgesGeometry, Quaternion, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Kit, hash3, mix } from '../kit';
import { Cards, barkPaint, barkTube, leafLobe, limbTo, lowPolyTrunk, spine } from '../foliage';
import { SWING } from '../homestead';

/**
 * The swing's rig (u): the branch's height where the ropes hang from it (in the oak's frame, at the
 * swing's distance from the trunk), the seat's height above the ground, its size, and the ropes'
 * spacing along the branch.
 */
export const SWING_RIG = { branchY: SWING.branch, seatY: SWING.seatY, seatW: 0.62, seatD: 0.2, seatT: SWING.seatT, ropeGap: 0.27, rope: 0.013 } as const;

const BARK = { dark: '#6a3a1e', light: '#bd7f4a' } as const;

/**
 * The old oak, in its own frame with the swing's branch along +x: a thick, buttressed trunk forking
 * into five crown lobes (bigger than the other hardwoods), and one long branch that runs out nearly
 * level at about 1.6 u and ends in a small leafy lobe of its own.
 */
export function oakModel(): { solid: BufferGeometry; leaves: BufferGeometry } {
  const k = new Kit();
  const cards = new Cards();
  const lobes: [number, number, number, number][] = [
    [0.05, 3.0, 0, 1.05],
    [-0.95, 2.45, 0.12, 0.85],
    [0.5, 2.6, -0.78, 0.78],
    [0.25, 2.45, 0.86, 0.78],
    [-0.45, 2.62, -0.62, 0.7],
  ];
  const tip: [number, number, number, number] = [2.05, 1.98, 0.04, 0.5];
  lowPolyTrunk(k, {
    trunk: [
      [0, 0.62, 0, 0.38],
      [0.06, 1.22, 0.02, 0.32],
      [0.02, 1.78, 0.01, 0.25],
      [-0.03, 2.62, 0, 0.13],
    ],
    limbs: lobes.slice(1).map((l, i) => limbTo(1.9 + i * 0.09, l, 0.16, i + 1)),
    roots: 6,
    base: 0.46,
    stubs: 2,
    dark: BARK.dark,
    light: BARK.light,
    seed: 23,
  });
  const paint = barkPaint(BARK.dark, BARK.light, 2.6);
  k.surface('bark', () => {
    // the swing's branch: out of the trunk, a little up, then level where the ropes hang, then up into its lobe
    k.add(
      barkTube(
        spine([
          [0.12, 1.46, 0, 0.17],
          [0.55, 1.6, 0.01, 0.135],
          [0.95, 1.64, 0, 0.118],
          [1.45, 1.645, 0.01, 0.1],
          [1.9, 1.72, 0.03, 0.075],
          [2.15, 1.86, 0.04, 0.05],
        ]),
        6,
        91,
      ),
      paint,
    );
    // a few twigs between the lobes and one off the branch
    const twigs: [number, number, number][] = [
      [-0.55, 1.95, 0.5],
      [0.6, 1.9, 0.45],
      [0.45, 2.0, -0.6],
      [1.7, 1.95, -0.3],
    ];
    twigs.forEach(([x, y, z], i) => {
      const from = i === 3 ? new Vector3(1.5, 1.66, 0) : new Vector3(x * 0.4, y - 0.2, z * 0.4);
      k.add(barkTube([{ p: from, r: 0.045 }, { p: new Vector3(x, y + 0.14, z), r: 0.02 }], 3, 70 + i, 0.1, true), paint);
    });
  });
  const core = (_p: Vector3, n: Vector3) => mix('#1a4724', '#2a6630', 0.4 + n.y * 0.5);
  [...lobes, tip].forEach(([x, y, z, r], i) => {
    k.blob(r * 0.86, core, { p: [x, y, z] }, 1, 'solid', 0.12, i * 2.3 + 1);
    leafLobe(cards, new Vector3(x, y, z), r, {
      count: Math.round(105 * r * r) + 22,
      size: 0.4 + r * 0.14,
      light: '#e4f687',
      mid: '#8fd257',
      dark: '#357f44',
      seed: i * 13 + 5,
      minY: -0.75,
    });
  });
  return { solid: k.build().solid!, leaves: cards.build() };
}

const STALKS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 1.38],
  [0.08, 0.05, 1.24],
  [-0.07, 0.05, 1.3],
  [0.03, -0.08, 1.16],
  [-0.05, -0.06, 1.22],
  [0.1, -0.02, 1.08],
];

/**
 * A jute plant (≈ 1.35 u): a dense clump of slender green stalks with long, lance-shaped leaves
 * crowding their upper half and drooping outward, and small yellow flowers at the top.
 */
export function jutePlant(): BufferGeometry {
  const k = new Kit();
  const stalk = (p: Vector3) => mix('#4f7a2e', '#8fb84e', Math.min(1, p.y / 1.3));
  const leaf = (p: Vector3, n: Vector3) => mix(mix('#3a7229', '#8cc850', 0.45 + n.y * 0.5), '#b9d86a', Math.max(0, p.y - 1.1) * 1.5);
  const up = new Vector3(0, 1, 0);
  const along = new Vector3(0, 0, 1);
  STALKS.forEach(([x, z, h], i) => {
    const lean = new Vector3(x * 1.6, 1, z * 1.6).normalize();
    k.cyl(0.013, 0.02, h, stalk, { p: [x + lean.x * h * 0.5, (h / 2) * lean.y, z + lean.z * h * 0.5], q: new Quaternion().setFromUnitVectors(up, lean) }, 5);
    const top = new Vector3(x, 0, z).addScaledVector(lean, h);
    for (let j = 0; j < 8; j++) {
      const y = 0.4 + j * 0.075;
      const at = new Vector3(x, 0, z).addScaledVector(lean, h * y);
      const a = j * 2.4 + i * 1.3;
      const d = new Vector3(Math.cos(a), -0.25 - 0.15 * hash3(i, j, 3), Math.sin(a)).normalize();
      const len = 0.27 - j * 0.015;
      k.blob(0.06, leaf, { p: [at.x + d.x * len * 0.5, at.y + d.y * len * 0.5, at.z + d.z * len * 0.5], q: new Quaternion().setFromUnitVectors(along, d), s: [0.62, 0.1, len / 0.12] }, 0);
    }
    for (let f = 0; f < 2; f++) {
      const a = f * 2.1 + i;
      k.sphere(0.022, '#f2cf3a', { p: [top.x + Math.cos(a) * 0.035, top.y - 0.02 - f * 0.03, top.z + Math.sin(a) * 0.035] }, [4, 3]);
    }
  });
  return k.build().solid!;
}

/** What's left of a picked jute plant: the cut stalks, pale at the top. */
export function juteStubble(): BufferGeometry {
  const k = new Kit();
  STALKS.forEach(([x, z], i) => {
    const h = 0.1 + hash3(i, 2, 7) * 0.05;
    k.cyl(0.015, 0.017, h, '#6f8a3a', { p: [x, h / 2, z] }, 5);
    k.cyl(0.015, 0.015, 0.006, '#d9d0a0', { p: [x, h, z] }, 5);
  });
  return k.build().solid!;
}

/**
 * The swing, hanging from its pivot on the branch (the origin, the branch along x): two jute ropes
 * wrapped round the branch, down `length` u to a plank seat. It swings about the x axis.
 */
export function swingModel(length: number): BufferGeometry {
  const { seatW, seatD, seatT, ropeGap, rope } = SWING_RIG;
  const k = new Kit();
  const jute = (p: Vector3) => mix('#b8914f', '#dcbd7c', hash3(Math.round(p.y * 60), 1, 2) * 0.6 + 0.2);
  for (const x of [-ropeGap, ropeGap]) {
    k.cyl(rope, rope, length, jute, { p: [x, -length / 2, 0] }, 5);
    // wrapped round the branch, and knotted under the seat
    k.torus(0.1, 0.02, jute, { p: [x, 0, 0], r: [0, Math.PI / 2, 0] }, Math.PI * 2, [5, 12]);
    k.sphere(0.026, jute, { p: [x, -length - seatT / 2 - 0.02, 0] }, [6, 5]);
  }
  k.surface('wood', () => k.box([seatW, seatT, seatD], '#b07a45', { p: [0, -length, 0] }, 0.012));
  return k.build().solid!;
}

/** The swing's ghost (swing.md §4.4): the seat's and ropes' fill and outline, hanging `length` u from the pivot. */
export function swingGhost(length: number): { fill: BufferGeometry; edges: BufferGeometry } {
  const { seatW, seatD, seatT, ropeGap } = SWING_RIG;
  const seat = new BoxGeometry(seatW, seatT, seatD).translate(0, -length, 0);
  const ropes = [-ropeGap, ropeGap].map((x) => new CylinderGeometry(0.02, 0.02, length, 5, 1, true).translate(x, -length / 2, 0));
  const fill = mergeGeometries([seat, ...ropes].map((g) => g.toNonIndexed()), false);
  const edges = mergeGeometries([new EdgesGeometry(seat, 20), ...ropes.map((g) => new EdgesGeometry(g, 60))], false);
  return { fill, edges };
}
