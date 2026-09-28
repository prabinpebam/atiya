/**
 * The planting round the viewing deck's cliff (docs: viewing-deck.md §4.6), in the crafting chunk:
 * leafy and flowering bushes, flower clumps and flowering sprigs round the foot of the cliff, on its
 * terrace and on its top, and the old pine that leans out over the upper rim like a bonsai. Pure and
 * seeded: the same planet always gets the same planting. It keeps off the steps, the platform and the
 * ways to them (the deck's footprint), the build site at the foot, the paths, the landmarks, the home
 * and the water, and clear of the other trees, bushes and stones. The crafting chunk adds it to the
 * props before the scene mounts, with the bushes' and the pine's obstacles.
 */
import { Vector3 } from 'three';
import type { LandmarkGeometry } from '../../math/landmarks';
import { UP, arcDistance, moveAlong, pointArcDistance, type Obstacle } from '../../math/sphere';
import { hash3 } from '../kit';
import { DECK, deckFootprint } from '../deckSpec';
import { mesaDir, mesaPolar, mesaRadius, tierEdge, tierPolar, type Mesa } from '../features';
import { FLOWER_KINDS, type FlowerKind, type PropInstance, type PropLayout } from '../layout';

/** The pine (u, rad): where it grows (its angle from the deck's view round the upper tier, how far in from the rim), its trunk's radius (what blocks) and the bare ground round it (its stem's flare). */
export const BONSAI = { angle: -1.7, inset: 0.3, trunkR: 0.3, bareR: 0.62 } as const;

export interface DeckDressing {
  bushes: PropInstance[];
  flowerBushes: PropInstance[];
  flowers: Record<FlowerKind, PropInstance[]>;
  sprigs: PropInstance[];
  /** The bushes' and the pine's trunk. */
  obstacles: Obstacle[];
  /** Where no grass grows: round the pine's trunk and the tops of its roots. */
  bare: Array<{ n: Vector3; r: number }>;
  /** The pine: where its trunk stands, the way it leans (out over the rim) and the cliff round it, for its roots. */
  bonsai: { n: Vector3; out: Vector3; cliff: PineCliff };
}

/**
 * The cliff round the pine in its own (flat) frame: +x out over the rim, y up from the trunk's foot,
 * z = x × up. So its roots can follow the real ground, over the rim and down the wall.
 */
export interface PineCliff {
  /** How far below the tree's foot the planet's centre is (R + the ground's height there), for what hangs from it. */
  centre: number;
  /** The ground's height at (x, z): the cap's on the top (not the ground's ramp under the rim), the terrace's or the meadow's beyond. */
  ground(x: number, z: number): number;
  /** True on the upper tier's top. */
  inside(x: number, z: number): boolean;
  /** The upper wall's top edge on the tier centre's ray through (x, z), and the wall's outward direction there (in x, z). */
  edge(x: number, z: number): { x: number; z: number; nx: number; nz: number };
}

/** The pine's cliff, for the tier `t` of mesa `m`. */
export function pineCliff(n: Vector3, out: Vector3, m: Mesa, R: number, ground: (n: Vector3) => number): PineCliff {
  const t = m.tier!;
  const X = out.clone().addScaledVector(n, -out.dot(n)).normalize();
  const Z = new Vector3().crossVectors(X, n).normalize();
  const O = n.clone().multiplyScalar(R);
  const at = (x: number, z: number) => O.clone().addScaledVector(X, x).addScaledVector(Z, z).normalize();
  const local = (p: Vector3) => {
    const v = p.clone().multiplyScalar(R).sub(O);
    return { x: v.dot(X), z: v.dot(Z) };
  };
  const inTier = (p: Vector3) => {
    const q = tierPolar(m, p);
    return q.r < tierEdge(t, q.angle);
  };
  const edge = (x: number, z: number) => {
    const { angle } = tierPolar(m, at(x, z));
    const e = moveAlong(t.n, mesaDir(m, t.n, angle), tierEdge(t, angle) / R);
    const f = moveAlong(t.n, mesaDir(m, t.n, angle), (tierEdge(t, angle) + 0.1) / R);
    const a = local(e);
    const b = local(f);
    const l = Math.hypot(b.x - a.x, b.z - a.z);
    return { x: a.x, z: a.z, nx: (b.x - a.x) / l, nz: (b.z - a.z) / l };
  };
  // (the ground's own height ramps down just inside a rim, under the cap: on the top, take it from a
  // little way in along the tier's ray; and the flat frame rises off the sphere by d² / 2R)
  const height = (x: number, z: number) => {
    const p = at(x, z);
    if (!inTier(p)) return ground(p);
    const q = tierPolar(m, p);
    const inset = Math.max(0, Math.min(q.r, tierEdge(t, q.angle) - 0.4));
    return ground(moveAlong(t.n, mesaDir(m, t.n, q.angle), inset / R));
  };
  const h0 = height(0, 0);
  return {
    centre: R + ground(n),
    ground: (x, z) => height(x, z) - h0 - (x * x + z * z) / (2 * R),
    inside: (x, z) => inTier(at(x, z)),
    edge,
  };
}

export function deckDressing(layout: PropLayout, geos: readonly LandmarkGeometry[], R: number, ground: (n: Vector3) => number, water: (n: Vector3) => boolean): DeckDressing | null {
  const site = layout.deck;
  const t = site?.mesa.tier;
  if (!site || !t) return null;
  const m = site.mesa;
  let seed = 1;
  const rand = () => hash3(seed++, 4.7, 9.3);
  const at = (n: Vector3): PropInstance => ({ n, h: ground(n), scale: 1, yaw: rand() * Math.PI * 2, tint: rand() });
  const baseEdge = (n: Vector3) => {
    const p = mesaPolar(m, n);
    return p.r - mesaRadius(m.radiusU, m.seed, p.angle);
  };
  const tierEdgeD = (n: Vector3) => {
    const p = tierPolar(m, n);
    return p.r - tierEdge(t, p.angle);
  };
  // the pine, on the upper tier's rim beside the platform, leaning out over the narrow terrace
  const a = DECK.face + BONSAI.angle;
  const bn = moveAlong(t.n, mesaDir(m, t.n, a), (tierEdge(t, a) - BONSAI.inset) / R);
  const bout = mesaDir(m, bn, a);
  const bonsai = { n: bn, out: bout, cliff: pineCliff(bn, bout, m, R, ground) };

  const zone = deckFootprint(site);
  const inZone = (n: Vector3, pad: number) => zone.some((z) => arcDistance(n, z.n, R) < z.r + pad);
  const foot = site.lower[0];
  const solids: Array<{ n: Vector3; r: number }> = [
    ...[...layout.hardwood, ...layout.fruit, ...layout.cedar].map((p) => ({ n: p.n, r: 0.9 * p.scale })),
    ...[...layout.bushes, ...layout.flowerBushes].map((p) => ({ n: p.n, r: 0.5 * p.scale })),
    ...[...layout.rocks, ...layout.boulders].map((p) => ({ n: p.n, r: 0.45 * p.scale })),
    ...layout.furniture.map((f) => ({ n: f.n, r: 0.6 })),
    { n: bn, r: 0.7 },
  ];
  const clearOfSolids = (n: Vector3, r: number) => solids.every((s) => arcDistance(n, s.n, R) > s.r + r);
  const open = (n: Vector3, pad: number) =>
    !water(n) &&
    !inZone(n, pad) &&
    Math.min(...geos.map((g) => pointArcDistance(n, UP, g.approach, R))) > 0.9 + pad &&
    geos.every((g) => arcDistance(n, g.n, R) > g.footprintU + 1 + pad) &&
    !(layout.home?.clear.some((c) => arcDistance(n, c.n, R) < c.r + pad) ?? false);
  // where each level's lawn is: the meadow round the foot, the terrace (off both walls' rims) and the top
  const onLevel = (n: Vector3) => baseEdge(n) > 0.1 || (baseEdge(n) < -0.3 && (tierEdgeD(n) > 0.15 || tierEdgeD(n) < -0.3));

  const bushes: PropInstance[] = [];
  const flowerBushes: PropInstance[] = [];
  const obstacles: Obstacle[] = [{ n: bn, radiusU: BONSAI.trunkR }];
  const bush = (n: Vector3, scale: number) => {
    if (!open(n, 0.55 * scale) || !onLevel(n) || arcDistance(n, foot, R) < 2 || !clearOfSolids(n, 0.5 * scale + 0.3)) return false;
    const p = { ...at(n), scale };
    (rand() < 0.4 ? flowerBushes : bushes).push(p);
    solids.push({ n, r: 0.5 * scale });
    obstacles.push({ n, radiusU: 0.42 * scale, core: 0.18 * scale, soft: true });
    return true;
  };
  const flowers: Record<FlowerKind, PropInstance[]> = { tulip: [], cosmos: [], pansy: [] };
  const sprigs: PropInstance[] = [];
  const bloom = (n: Vector3, pad: number) => open(n, pad) && onLevel(n) && arcDistance(n, foot, R) > 0.9 && clearOfSolids(n, 0.12);
  const sprig = (n: Vector3) => {
    if (bloom(n, 0.1)) sprigs.push({ ...at(n), scale: 0.85 + rand() * 0.45 });
  };
  const clump = (c: Vector3, count: number, spread: number) => {
    const kind = FLOWER_KINDS[Math.floor(rand() * FLOWER_KINDS.length)];
    const tint = rand();
    for (let i = 0; i < count; i++) {
      const n = moveAlong(c, mesaDir(m, c, rand() * Math.PI * 2), (0.08 + rand() * spread) / R);
      if (bloom(n, 0.2)) flowers[kind].push({ ...at(n), scale: 0.8 + rand() * 0.35, tint });
    }
    for (let q = 0; q < 4; q++) sprig(moveAlong(c, mesaDir(m, c, rand() * Math.PI * 2), (0.3 + rand() * 0.45) / R));
  };
  // round the foot: bushes hugging the wall, with flowers and sprigs between them
  const aroundFoot = (a: number, out: number) => moveAlong(m.n, mesaDir(m, m.n, a), (mesaRadius(m.radiusU, m.seed, a) + out) / R);
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2 + rand() * 0.12;
    if (i % 2 === 0 && bush(aroundFoot(a, 0.55 + rand() * 0.35), 0.75 + rand() * 0.4)) continue;
    const c = aroundFoot(a, 0.35 + rand() * 1.1);
    if (i % 5 === 1) clump(c, 3 + Math.floor(rand() * 3), 0.4);
    else for (let q = 0; q < 3; q++) sprig(moveAlong(c, mesaDir(m, c, rand() * Math.PI * 2), (0.1 + rand() * 0.5) / R));
  }
  // on the terrace and the top: flowers along the foot of the upper wall and through the top's lawn, a bush or two
  for (let i = 0, bushed = 0; i < 70; i++) {
    const a = rand() * Math.PI * 2;
    const top = rand() < 0.4;
    const n = top
      ? moveAlong(t.n, mesaDir(m, t.n, a), (tierEdge(t, a) * (0.3 + rand() * 0.55)) / R)
      : moveAlong(t.n, mesaDir(m, t.n, a), (tierEdge(t, a) + 0.18 + rand() * 0.9) / R);
    if (!top && bushed < 3 && i % 6 === 0 && bush(n, 0.65 + rand() * 0.2)) {
      bushed++;
      continue;
    }
    if (i % 9 === 0) clump(n, 2 + Math.floor(rand() * 2), 0.25);
    else sprig(n);
  }
  // the top's lawn round the platform: sprigs along the rim, where the platform leaves room
  for (let i = 0; i < 40; i++) {
    const a = rand() * Math.PI * 2;
    sprig(moveAlong(t.n, mesaDir(m, t.n, a), (tierEdge(t, a) - 0.35 - rand() * 0.5) / R));
  }
  return { bushes, flowerBushes, flowers, sprigs, obstacles, bare: [{ n: bn, r: BONSAI.bareR }], bonsai };
}
