/**
 * The old pine on the viewing deck's cliff (viewing-deck.md §4.6): a very old, windswept, bonsai-like
 * tree whose thick trunk rises from the upper rim, bends out and runs nearly level over the edge,
 * ending in a cascade. Its roots follow the real cliff (`PineCliff`): over the top, over the rim's lip
 * and down the wall's face to the terrace. Two bleached
 * deadwood spurs rise from the bend, moss grows on the trunk's upper side, creepers wind up the trunk
 * and hang from the branches and pads, and its needles grow in full, domed pads at the ends of short
 * branches, the way a trained pine's do. In its own frame: +x out over the rim (`BONSAI.inset` out), y up.
 */
import { BufferGeometry, Color, Vector3 } from 'three';
import { Kit, hash3, mix } from '../kit';
import { Cards, barkPaint, barkTube, leafLobe, spine } from '../foliage';
import { BONSAI, type PineCliff } from './deckDressing';

type P4 = [number, number, number, number];

const BARK = { dark: '#3f281d', light: '#957050' } as const;
const NEEDLES = { dark: '#2a5c3a', mid: '#4f914f', light: '#b0dc84' } as const;
const IVY = { dark: '#244d22', mid: '#4d8a36', light: '#9cc86a', stem: '#5a4a2c' } as const;

/** The tree's size against the first, sapling-sized pine (the positions and pads), and its trunk's extra girth for its age. */
export const PINE_SCALE = 2.1;
const GIRTH = 1.2;
const S = PINE_SCALE;
const sc = (p: P4, r = S): P4 => [p[0] * S, p[1] * S, p[2] * S, p[3] * r];

/** The trunk's spine [x, y, z, r], from the root flare's knee to the cascade's tip. */
const TRUNK0: P4[] = [
  [0, 0.26, 0, 0.17],
  [0.07, 0.52, 0.06, 0.15],
  [0.28, 0.76, -0.03, 0.13],
  [0.6, 0.86, -0.1, 0.115],
  [0.94, 0.8, 0.02, 0.1],
  [1.26, 0.68, 0.12, 0.085],
  [1.54, 0.66, 0.05, 0.07],
  [1.78, 0.78, -0.03, 0.05],
];
const TRUNK = TRUNK0.map((p) => sc(p, S * GIRTH));

/** Foliage pads: [x, y, z, radius], each at the end of a branch from trunk ring `from`. */
const PADS0: Array<{ c: P4; from: number }> = [
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
const PADS = PADS0.map(({ c, from }) => ({ c: sc(c, S * 0.95), from }));

/** A flat, layered pad of needles: a dark core and a few lobes spread in a disc, domed on top. */
function pad(k: Kit, cards: Cards, [x, y, z, r]: P4, seed: number): void {
  const core = (_p: Vector3, n: Vector3) => mix(NEEDLES.mid, '#173524', 0.55 - Math.max(0, n.y) * 0.5);
  k.blob(r * 0.8, core, { p: [x, y - r * 0.04, z], s: [1, 0.5, 1] }, 1, 'solid', 0.18, seed);
  const o = { light: NEEDLES.light, mid: NEEDLES.mid, dark: NEEDLES.dark };
  leafLobe(cards, new Vector3(x, y + r * 0.12, z), r * 0.55, { ...o, count: Math.round(95 * r) + 14, size: 0.24 + r * 0.22, seed, minY: -0.2 });
  // a domed top layer, so the pad reads full rather than flat
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + hash3(seed, i, 6);
    leafLobe(cards, new Vector3(x + Math.cos(a) * r * 0.28, y + r * 0.3, z + Math.sin(a) * r * 0.28), r * 0.36, {
      ...o,
      count: Math.round(50 * r) + 8,
      size: 0.19 + r * 0.18,
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
      size: 0.19 + r * 0.2,
      seed: seed * 7 + i,
      minY: -0.45,
    });
  }
}

/**
 * A creeper's stem along `path`, with small leaves strung along it in pairs, drooping toward the
 * planet's centre (`down`: gravity at a point) and turned out.
 */
function creeper(k: Kit, ivy: Cards, path: P4[], seed: number, down: (p: Vector3) => Vector3, out?: (p: Vector3) => Vector3): void {
  const rings = spine(path, 3);
  k.add(barkTube(rings, 3, seed, 0.05, true), (_p, n) => mix(IVY.stem, '#7c6a40', Math.max(0, n.y) * 0.6));
  let run = 0;
  let next = 0.02 + hash3(seed, 1, 1) * 0.04;
  for (let i = 1; i < rings.length; i++) {
    const a = rings[i - 1].p;
    const b = rings[i].p;
    const seg = a.distanceTo(b);
    const dir = b.clone().sub(a).normalize();
    while (next <= run + seg) {
      const p = a.clone().lerp(b, (next - run) / seg);
      const j = hash3(seed, next * 97, 3);
      const j2 = hash3(seed, next * 53, 7);
      const o = (out?.(p) ?? new Vector3(1, 0, 0)).clone();
      o.addScaledVector(dir, -o.dot(dir));
      if (o.lengthSq() < 1e-4) o.set(0, 0, 1).addScaledVector(dir, -dir.z);
      o.normalize();
      const side0 = new Vector3().crossVectors(dir, o).normalize();
      for (const sgn of [1, -1]) {
        // each leaf leans off the stem to one side and droops
        const tip = side0
          .clone()
          .multiplyScalar(sgn * 0.8)
          .addScaledVector(o, 0.5)
          .addScaledVector(down(p), 0.55 + j * 0.4)
          .normalize();
        const side = new Vector3().crossVectors(o, tip).normalize();
        const t = Math.min(1, Math.max(0, 0.45 + o.y * 0.35 + (j2 - 0.5) * 0.5));
        const c = new Color(t > 0.5 ? mix(IVY.mid, IVY.light, (t - 0.5) * 2) : mix(IVY.dark, IVY.mid, t * 2)).multiplyScalar((0.92 + j * 0.16) * 1.2);
        ivy.add(p, tip, side, 0.12 + j2 * 0.08, 0.9, c, o.clone().lerp(new Vector3(0, 1, 0), 0.3).normalize(), 0.1);
      }
      next += 0.06 + hash3(seed, next * 31, 5) * 0.04;
    }
    run += seg;
  }
}

/** A plain cliff for the model on its own: a flat top out to a straight rim, the terrace 0.8 u below it, 1 u wide. */
const PLAIN_CLIFF: PineCliff = {
  centre: 10 + 1.9,
  ground: (x) => (x < BONSAI.inset ? 0 : x < BONSAI.inset + 1 ? -0.8 : -1.9),
  inside: (x) => x < BONSAI.inset,
  edge: (_x, z) => ({ x: BONSAI.inset, z, nx: 1, nz: 0 }),
};

/**
 * The roots' spines [x, y, z, r] in the tree's frame, following the real cliff: they leave the trunk
 * as buttresses, run half-sunk over the top and, where they reach the rim, bend over its lip and
 * cling down the wall's face to the terrace, where the longest run on a little way (never over its
 * own edge). Pure.
 */
export function pineRoots(cliff: PineCliff = PLAIN_CLIFF): P4[][] {
  const out: P4[][] = [];
  const r0 = TRUNK[0][3];
  const count = 13;
  const step = 0.08;
  for (let i = 0; i < count; i++) {
    const th = (i / count) * Math.PI * 2 + (hash3(i, 71, 1) - 0.5) * 0.35;
    const dx = Math.cos(th);
    const dz = Math.sin(th);
    const toRim = Math.max(0, dx);
    const thick = 0.08 + 0.05 * hash3(i, 71, 2) + 0.035 * toRim;
    let len = (dx < 0 ? 0.55 : 0.75) + hash3(i, 71, 3) * 0.5 + toRim * 1.1;
    const wob = (hash3(i, 71, 4) - 0.5) * 0.5;
    const taper = len;
    const pts: P4[] = [[dx * r0 * 0.35, 0.4, dz * r0 * 0.35, thick * 1.35]];
    let used = 0;
    let d = r0 * 0.8;
    // the stage: on the top, down the wall (w: where on it), then out on the terrace
    let wall: { x: number; z: number; y: number; land?: number; run: number } | null = null;
    while (used < len) {
      const r = thick * (1 - 0.8 * Math.min(1, used / taper)) + 0.012;
      if (!wall) {
        const side = Math.sin(d * 3 + i) * wob * 0.2;
        const x = dx * d - dz * side;
        const z = dz * d + dx * side;
        const e = cliff.edge(x, z);
        const past = (x - e.x) * e.nx + (z - e.z) * e.nz;
        if (cliff.inside(x, z) && past < -0.04) {
          // on the top: sunk into it, humped where it leaves the trunk
          pts.push([x, cliff.ground(x, z) + r * (used < 0.2 ? 0.5 : 0.2), z, r]);
        } else {
          // over the rim's grassy lip (the cap overhangs the wall a little), then onto the face
          const top = cliff.ground(e.x - e.nx * 0.1, e.z - e.nz * 0.1);
          pts.push([e.x + e.nx * 0.03, top + r * 0.45, e.z + e.nz * 0.03, r]);
          wall = { x: e.x, z: e.z, y: top - 0.02, run: 0 };
          // (once over the lip, it goes on down to the terrace)
          len = Math.max(len, used + 0.9);
        }
      } else {
        // wander a little across the face (along the wall), then find it again on the tier's ray
        const e0 = cliff.edge(wall.x, wall.z);
        const across = Math.sin(used * 5 + i) * 0.04 + wob * 0.05;
        const e = cliff.edge(wall.x - e0.nz * across, wall.z + e0.nx * across);
        wall.x = e.x;
        wall.z = e.z;
        const off = 0.1 + r * 0.55 + wall.run;
        const x = e.x + e.nx * off;
        const z = e.z + e.nz * off;
        const floor = cliff.ground(e.x + e.nx * 0.4, e.z + e.nz * 0.4);
        if (wall.land === undefined) {
          // down the face, just clear of its ledges (they bulge up to 0.1 u)
          wall.y = Math.max(floor + r * 0.3, wall.y - step * 1.3);
          if (wall.y <= floor + r * 0.3 + 1e-6) wall.land = floor;
          pts.push([x, wall.y, z, r]);
        } else {
          // out along the terrace, sunk into it, stopping short of its own edge
          wall.run += step;
          const g = cliff.ground(x, z);
          if (g < wall.land - 0.06) break;
          pts.push([x, g + r * 0.2, z, r]);
        }
      }
      used += step;
      d += step;
    }
    out.push(pts);
  }
  return out;
}
export function bonsaiModel(cliff: PineCliff = PLAIN_CLIFF): { solid: BufferGeometry; leaves: BufferGeometry; ivy: BufferGeometry } {
  const k = new Kit();
  const cards = new Cards();
  const ivy = new Cards();
  const centre = new Vector3(0, -cliff.centre, 0);
  const down = (p: Vector3) => centre.clone().sub(p).normalize();
  const at = (i: number) => new Vector3(TRUNK[i][0], TRUNK[i][1], TRUNK[i][2]);
  const paint = barkPaint(BARK.dark, BARK.light, 1.1 * S);
  const r0 = TRUNK[0][3];
  k.surface('bark', () => {
    // the stem: it flares at its foot and dives back into the cliff under the top (where it stands
    // over the rim, it bulges out of the wall's top, held by the roots that cling down the face)
    k.add(barkTube([{ p: new Vector3(-0.32, -0.55, 0), r: r0 * 0.7 }, { p: new Vector3(-0.08, -0.12, 0), r: r0 * 1.1 }, { p: new Vector3(0, 0.12, 0), r: r0 * 1.25 }, ...spine(TRUNK, 1)], 7, 61), paint);
    // the branches to the pads, each from inside the trunk out to its pad's middle
    PADS.forEach(({ c: [x, y, z], from }, i) => {
      const s = at(from);
      const r = TRUNK[from][3] * 0.5;
      const mid = s
        .clone()
        .lerp(new Vector3(x, y, z), 0.5)
        .add(new Vector3(0, (0.06 + hash3(i, 5, 1) * 0.06) * S, 0));
      const limb: P4[] = [
        [s.x, s.y, s.z, r],
        [mid.x, mid.y, mid.z, r * 0.7],
        [x, y - 0.05 * S, z, r * 0.45],
      ];
      k.add(barkTube(spine(limb, 1), 4, 111 + i * 7), paint);
    });
    pineRoots(cliff).forEach((r, i) => k.add(barkTube(spine(r, 1), 5, 80 + i, 0.16, true), paint));
  });  // the deadwood spurs (jin): bleached and twisted, up from the bend and off the crown's side
  const bleached = barkPaint('#b8ab96', '#eee6d6', 1.6 * S);
  k.surface('bark', () => {
    const jin: P4[][] = [
      [
        [0.3, 0.76, -0.02, 0.05],
        [0.26, 1.0, -0.14, 0.035],
        [0.36, 1.22, -0.1, 0.022],
        [0.32, 1.36, -0.18, 0.01],
      ],
      [
        [0.08, 0.6, 0.06, 0.035],
        [-0.06, 0.78, 0.2, 0.024],
        [-0.02, 0.94, 0.3, 0.014],
        [-0.1, 1.02, 0.34, 0.006],
      ],
    ];
    jin.forEach((j, i) => k.add(barkTube(spine(j.map((p) => sc(p, S * GIRTH))), 4, 97 + i, 0.1, true), bleached));
  });
  // moss on the trunk's upper side, where it runs out level, and a cushion where it grips the rim
  const moss = (_p: Vector3, n: Vector3) => mix('#46692c', '#8cb04f', Math.max(0, n.y));
  for (let i = 2; i < TRUNK.length - 1; i++) {
    const [x, y, z, r] = TRUNK[i];
    k.blob(r * 0.8, moss, { p: [x, y + r * 0.72, z], s: [1.5, 0.32, 1.1] }, 1, 'solid', 0.35, 20 + i);
  }
  const g = (x: number, z: number) => cliff.ground(x, z);
  k.blob(0.3, moss, { p: [-0.2, g(-0.2, 0), 0], s: [1.5, 0.3, 1.4] }, 1, 'solid', 0.3, 5);
  // stones among the roots, on the top (never out over the rim)
  k.surface('rock', () => {
    for (const [x, z, r, c, s] of [
      [-0.6, -0.12, 0.2, '#9d968b', 8],
      [-0.1, 0.62, 0.14, '#b3ab9d', 9],
      [-0.42, 0.55, 0.1, '#a39b8e', 10],
    ] as const)
      if (cliff.inside(x + r * 1.4, z)) k.blob(r, c, { p: [x, g(x, z) + r * 0.12, z], s: [1.3, 0.6, 1] }, 1, 'solid', 0.25, s);
  });
  PADS.forEach(({ c }, i) => pad(k, cards, c, 11 + i * 5));

  // creepers: two wind up the trunk from the roots, and strands hang from the branches and the pads.
  // Over the top's lawn they stop well above head height; out past the rim they hang lower
  const trunkRings = spine(TRUNK, 4);
  const wind = (phase: number, turns: number, upTo: number, seed: number) => {
    const path: P4[] = [];
    const last = Math.min(trunkRings.length - 1, upTo);
    for (let i = 0; i <= last; i += 1) {
      const ring = trunkRings[i];
      const tan = trunkRings[Math.min(trunkRings.length - 1, i + 1)].p.clone().sub(trunkRings[Math.max(0, i - 1)].p).normalize();
      const n0 = new Vector3(0, 0, 1).addScaledVector(tan, -tan.z).normalize();
      const b0 = new Vector3().crossVectors(tan, n0);
      const a = phase + (i / last) * turns * Math.PI * 2;
      const off = n0.multiplyScalar(Math.cos(a)).addScaledVector(b0, Math.sin(a));
      path.push([ring.p.x + off.x * ring.r * 1.08, ring.p.y + off.y * ring.r * 1.08, ring.p.z + off.z * ring.r * 1.08, 0.016]);
    }
    // then off the trunk: it lets go and hangs
    const end = new Vector3(...(path[path.length - 1].slice(0, 3) as [number, number, number]));
    const g = down(end);
    const p1 = end.clone().addScaledVector(g, 0.25).add(new Vector3(0.05, 0, 0.04));
    const p2 = end.clone().addScaledVector(g, 0.55).add(new Vector3(0.08, 0, 0.02));
    path.push([p1.x, p1.y, p1.z, 0.012], [p2.x, p2.y, p2.z, 0.009]);
    const axis = (p: Vector3) => {
      let best = trunkRings[0].p;
      for (const r of trunkRings) if (r.p.distanceToSquared(p) < best.distanceToSquared(p)) best = r.p;
      return p.clone().sub(best).normalize();
    };
    creeper(k, ivy, path, seed, down, axis);
  };
  wind(0.4, 1.3, 14, 300);
  wind(3.3, 1.0, 18, 301);
  let seed = 400;
  const hang = (from: Vector3, len: number) => {
    const s = seed++;
    const floor = cliff.ground(from.x, from.z) + (cliff.inside(from.x - 0.4, from.z) ? 1.35 : 0.3);
    // it hangs straight down toward the planet's centre (so out past the rim, where the ground curves
    // away, the strands splay a little, like everything else that hangs), with a slight curl
    const g = down(from);
    const L = Math.min(len, (from.y - floor) / Math.max(0.5, -g.y));
    if (L < 0.25) return;
    const u = new Vector3().crossVectors(g, new Vector3(0, 0, 1)).normalize();
    const w = new Vector3().crossVectors(g, u);
    const sway = (hash3(s, 2, 2) - 0.5) * 0.3;
    const path: P4[] = [];
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      const p = from
        .clone()
        .addScaledVector(g, t * L)
        .addScaledVector(u, Math.sin(t * 2.2) * sway)
        .addScaledVector(w, Math.sin(t * 1.7 + s) * 0.06);
      path.push([p.x, p.y, p.z, 0.013 - t * 0.005]);
    }
    creeper(k, ivy, path, s, down, (p) => p.clone().sub(from).addScaledVector(g, -p.clone().sub(from).dot(g)).add(new Vector3(from.x, 0, from.z).multiplyScalar(0.3)));
  };
  PADS.forEach(({ c: [x, y, z, r] }, i) => {
    const n = 3 + Math.round(hash3(i, 7, 7) * 2);
    for (let q = 0; q < n; q++) {
      const a = hash3(i, q, 11) * Math.PI * 2;
      const d = r * (0.3 + hash3(i, q, 12) * 0.45);
      hang(new Vector3(x + Math.cos(a) * d, y - r * 0.28, z + Math.sin(a) * d), 0.8 + hash3(i, q, 13) * 1.3);
    }
  });
  for (let i = 3; i < TRUNK.length; i++) {
    const [x, y, z, r] = TRUNK[i];
    hang(new Vector3(x, y - r * 0.9, z + (hash3(i, 3, 3) - 0.5) * r), 0.7 + hash3(i, 4, 4) * 0.9);
  }
  // festoons: creepers looping down between the trunk and its branches' pads
  PADS.forEach(({ c: [x, y, z, r], from }, i) => {
    if (from < 3) return;
    const a = at(from);
    const b = new Vector3(x, y - r * 0.3, z);
    const sag = 0.35 + hash3(i, 9, 9) * 0.3;
    const path: P4[] = [];
    for (let q = 0; q <= 6; q++) {
      const t = q / 6;
      const p = a.clone().lerp(b, t);
      p.addScaledVector(down(p), Math.sin(t * Math.PI) * sag + TRUNK[from][3] * 0.8 * (1 - t));
      path.push([p.x, p.y, p.z, 0.012]);
    }
    creeper(k, ivy, path, 500 + i, down, (p) => p.clone().sub(a).setY(0).normalize());
  });
  return { solid: k.build().solid!, leaves: cards.build(), ivy: ivy.build() };
}