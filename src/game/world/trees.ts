/**
 * The trees: the hardwoods (and the fruit trees, a hardwood with fruit) and the cedars, built from the
 * foliage kit (foliage.ts). Only the props draw them, so they load with the props' chunk
 * (progressive-loading.md), not the initial bundle.
 */
import { BufferGeometry, Vector3 } from 'three';
import { Kit, hash3, mix } from './kit';
import { Cards, FRUIT_SPOTS, barkPaint, barkTube, cell, leafLobe, limbTo, lowPolyTrunk, type TreeGeometry } from './foliage';

const Y = new Vector3(0, 1, 0);

export function hardwood(fruit?: string): TreeGeometry {
  const k = new Kit();
  const cards = new Cards();
  const lobes: [number, number, number, number][] = [
    [0, 2.45, 0, 0.88],
    [-0.74, 1.98, 0.08, 0.7],
    [0.74, 1.96, -0.08, 0.7],
    [0.06, 1.92, 0.58, 0.62],
    [-0.04, 2.02, -0.58, 0.62],
  ];
  // chunky S-bent trunk that forks into a limb per side lobe and runs on up into the crown
  lowPolyTrunk(k, {
    trunk: [
      [0, 0.5, 0, 0.29],
      [0.07, 0.98, 0.02, 0.24],
      [0.02, 1.38, 0.01, 0.19],
      [-0.02, 2.1, 0, 0.1],
    ],
    limbs: lobes.slice(1).map((l, i) => limbTo(1.08 + i * 0.07, l, 0.12, i + 1)),
    roots: 5,
    base: 0.32,
    stubs: 1,
    dark: '#6e3d20',
    light: '#c3844d',
    seed: 17,
  });
  // a few twigs poking out between the lobes
  for (const [i, [x, y, z]] of ([[-0.5, 1.55, 0.42], [0.52, 1.5, 0.4], [0.4, 1.62, -0.5]] as const).entries()) {
    k.surface('bark', () =>
      k.add(barkTube([{ p: new Vector3(x * 0.4, y - 0.16, z * 0.4), r: 0.045 }, { p: new Vector3(x, y + 0.14, z), r: 0.02 }], 3, 70 + i, 0.1, true), barkPaint('#6e3d20', '#c3844d', 2.2)),
    );
  }
  const core = (_p: Vector3, n: Vector3) => mix('#1a4724', '#2a6630', 0.4 + n.y * 0.5);
  lobes.forEach(([x, y, z, r], i) => {
    k.blob(r * 0.86, core, { p: [x, y, z] }, 1, 'solid', 0.12, i * 2.3);
    leafLobe(cards, new Vector3(x, y, z), r, {
      count: Math.round(105 * r * r) + 22,
      size: 0.4 + r * 0.14,
      light: '#e4f687',
      mid: '#8fd257',
      dark: '#357f44',
      seed: i * 11 + 3,
      minY: -0.75,
    });
  });
  let fruitGeo: BufferGeometry | undefined;
  let fruitSpots: [number, number, number][] | undefined;
  if (fruit) {
    const kf = new Kit();
    const spots = FRUIT_SPOTS;
    for (const [x, y, z] of spots) {
      kf.sphere(0.1, fruit, { p: [x, y, z] }, [12, 10]);
      kf.sphere(0.035, mix(fruit, '#ffffff', 0.5), { p: [x - 0.035, y + 0.04, z + 0.07] }, [6, 4]);
      kf.cyl(0.008, 0.008, 0.07, '#6b4a2a', { p: [x, y + 0.12, z] }, 4);
      kf.blob(0.04, '#3f8a3a', { p: [x + 0.04, y + 0.14, z], s: [1.4, 0.35, 0.8] }, 0);
    }
    fruitGeo = kf.build().solid!;
    fruitSpots = [...spots];
  }
  return { solid: k.build().solid!, leaves: cards.build(), fruit: fruitGeo, fruitSpots };
}

/** Palettes per cedar variant (dark underside → sunlit tip): blue-green, fresh green, yellow-green. */
const CEDAR_TONES: [string, string, string][] = [
  ['#244f45', '#3f7f66', '#86c7a0'],
  ['#265a3a', '#3f8a55', '#8fd08a'],
  ['#2f5f32', '#4f9448', '#a7d67e'],
];

/**
 * Conifer built from painted, circular foliage sprites (2×2 atlas: clump, bough, tufts, crown).
 * Instead of perfectly regular cones ringed by evenly spaced scales, each tier is a handful of
 * *grouped* bough clusters at irregular angles (with gaps), reaches, heights and droops around a
 * lumpy dark core; the whole tree leans slightly and ends in a clustered crown. `variant` seeds a
 * distinct silhouette so neighbouring cedars don't look identical.
 */
export function cedar(variant = 0): TreeGeometry {
  const k = new Kit();
  const cards = new Cards();
  const seed = 31 + variant * 17;
  const rnd = (a: number, b = 0) => hash3(seed, a, b);
  const [dark, mid, light] = CEDAR_TONES[variant % CEDAR_TONES.length];
  lowPolyTrunk(k, {
    trunk: [
      [0.01, 0.34, 0, 0.18],
      [0.02, 0.9, 0.01, 0.135],
      [0, 1.35, 0, 0.1],
    ],
    roots: 4,
    base: 0.21,
    stubs: 1,
    dark: '#5e3320',
    light: '#a8683d',
    seed: 29 + variant,
  });

  const tiers = 5 + (variant % 2);
  const lean = new Vector3(rnd(1) - 0.5, 0, rnd(2) - 0.5).normalize().multiplyScalar(0.05 + rnd(3) * 0.06);
  const base = 1.05 + rnd(4) * 0.12; // radius of the lowest tier
  let y = 0.72 + rnd(5) * 0.08;
  const shade = (out: Vector3) => out.clone().multiplyScalar(0.7).add(new Vector3(0, 0.72, 0)).normalize();
  const tone = (t: number, j: number) => {
    const c = t < 0.5 ? mix(dark, mid, t * 2) : mix(mid, light, (t - 0.5) * 2);
    return c.multiplyScalar(0.9 + j * 0.2);
  };

  for (let ti = 0; ti < tiers; ti++) {
    const f = ti / (tiers - 1);
    const r = base * (1 - f * 0.74) * (0.9 + rnd(10, ti) * 0.2);
    const c = lean.clone().multiplyScalar(f * 2.2).setY(0); // the axis drifts with height
    const h = 0.62 - f * 0.2;
    // small, dark core: only reads as depth in the gaps between clusters
    k.blob(r * 0.4, (_p, n) => mix(dark, '#16302a', 0.55 - Math.max(0, n.y) * 0.3), { p: [c.x, y + h * 0.4, c.z], s: [1, 0.8, 1] }, 1, 'solid', 0.25, seed + ti);
    // each tier is a tapering, irregular shell of foliage gathered into angular groups
    const shellR = (u: number) => r * (1 - 0.72 * u);
    const groups = Math.max(3, Math.round(3 + r * 4.5 + rnd(11, ti) * 1.5));
    const phase = rnd(12, ti) * Math.PI * 2;
    for (let g = 0; g < groups; g++) {
      if (ti < tiers - 1 && ti > 0 && rnd(13 + g, ti) < 0.12) continue; // an occasional gap
      const a = phase + ((g + (rnd(14 + g, ti) - 0.5) * 0.6) / groups) * Math.PI * 2;
      const out = new Vector3(Math.cos(a), 0, Math.sin(a));
      const side = new Vector3(out.z, 0, -out.x);
      const reach = 0.85 + rnd(15 + g, ti) * 0.3; // some groups stick out further
      const spread = (Math.PI / groups) * 0.9;
      // the bough: a drooping fan hanging from the tier's lower rim
      {
        const faceN = out.clone().multiplyScalar(0.62).add(new Vector3(0, 0.78, 0)).normalize();
        const tip = new Vector3().crossVectors(faceN, side).normalize(); // up and back towards the trunk
        const p = c.clone().addScaledVector(out, shellR(0.05) * reach * 0.5).setY(y + h * 0.2);
        const j = rnd(18 + g, ti);
        cards.add(p, tip, side, shellR(0) * reach * 1.05 + 0.2, 1, tone(0.25 + f * 0.2 + j * 0.2, j), shade(out), 0.86, cell(1));
      }
      // round clumps and tufts spread over the group's patch of the shell (outer = lighter)
      const puffs = 3 + Math.floor(rnd(19 + g, ti) * 2.5) + (r > 0.6 ? 1 : 0);
      for (let q = 0; q < puffs; q++) {
        const j = rnd(20 + g * 5 + q, ti);
        const j2 = rnd(21 + g * 5 + q, ti);
        const u = Math.min(0.92, (q + 0.5) / puffs + (j2 - 0.5) * 0.25);
        const o = out.clone().applyAxisAngle(Y, (j - 0.5) * 2 * spread);
        const s = new Vector3(o.z, 0, -o.x);
        const depth = 0.82 + j2 * 0.26;
        const p = c.clone().addScaledVector(o, shellR(u) * reach * depth).setY(y + h * u - (1 - u) * 0.06);
        const faceN = o.clone().multiplyScalar(0.78).add(new Vector3(0, 0.62, 0)).normalize();
        const tip = new Vector3().crossVectors(faceN, s).normalize().applyAxisAngle(faceN, (j2 - 0.5) * 1.0);
        const sd = new Vector3().crossVectors(tip, faceN).normalize();
        const size = (0.3 + r * 0.26) * (0.75 + j * 0.5) * (1 - u * 0.3);
        cards.add(p, tip, sd, size, 1, tone(0.32 + u * 0.3 + f * 0.2 + (depth - 0.82) * 0.6, j), shade(o), 0.5, cell(q % 3 === 1 ? 2 : 0));
      }
      // a darker inner puff so the core never shows as a hole
      {
        const o = out.clone().applyAxisAngle(Y, spread);
        const s = new Vector3(o.z, 0, -o.x);
        const faceN = o.clone().multiplyScalar(0.75).add(new Vector3(0, 0.6, 0)).normalize();
        const tip = new Vector3().crossVectors(faceN, s).normalize();
        const p = c.clone().addScaledVector(o, shellR(0.4) * 0.55).setY(y + h * 0.4);
        cards.add(p, tip, s, 0.32 + r * 0.3, 1, tone(0.08 + f * 0.15, rnd(22 + g, ti)), shade(o), 0.5, cell(0));
      }
    }    y += (0.46 - f * 0.08) * (0.9 + rnd(23, ti) * 0.25);
  }

  // crown: an upright tip spray with a few tufts gathered round its base
  const top = lean.clone().multiplyScalar(2.3).setY(y - 0.02);
  const crownTip = new Vector3(lean.x * 2, 1, lean.z * 2).normalize();
  for (let i = 0; i < 2; i++) {
    const a = i * Math.PI * 0.5 + rnd(30) * Math.PI;
    const faceN = new Vector3(Math.cos(a), 0, Math.sin(a));
    const side = new Vector3().crossVectors(crownTip, faceN).normalize();
    cards.add(top, crownTip, side, 0.62 + rnd(31, i) * 0.1, 1, tone(0.8, rnd(32, i)), Y, 0.2, cell(3));
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rnd(33) * 2;
    const o = new Vector3(Math.cos(a), 0, Math.sin(a));
    const s = new Vector3(o.z, 0, -o.x);
    const faceN = o.clone().multiplyScalar(0.7).add(new Vector3(0, 0.7, 0)).normalize();
    const tip = new Vector3().crossVectors(faceN, s).normalize();
    cards.add(top.clone().addScaledVector(o, 0.14).setY(top.y - 0.08), tip, s, 0.3, 1, tone(0.7, rnd(34, i)), shade(o), 0.5, cell(2));
  }
  return { solid: k.build().solid!, leaves: cards.build() };
}
