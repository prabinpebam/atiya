import { Vector3 } from 'three';
import { CONFIG } from '../config';
import { UP, arcDistance, moveAlong, pointArcDistance, tangentToward, type Obstacle } from '../math/sphere';
import type { LandmarkGeometry } from '../math/landmarks';
import { nearPlateauRim } from './cliffs';
import { buildMesas, buildRiver, findBridges, mesaDir, mesaPolar, mesaRadius, riverDistance, tierEdge, tierPolar, type Bridge, type Mesa, type River } from './features';
import { pondAngle, pondFrame, shoreRadius } from './pond';

export type FlowerKind = 'tulip' | 'cosmos' | 'pansy';
export const FLOWER_KINDS: FlowerKind[] = ['tulip', 'cosmos', 'pansy'];

export interface PropInstance {
  /** Planet-local unit position. */
  n: Vector3;
  scale: number;
  yaw: number;
  /** 0..1 random value used for colour variation. */
  tint: number;
  /** Ground height (u above the base sphere), filled in once the terrain is known. */
  h?: number;
}

export interface SignPost {
  id: string;
  n: Vector3;
  /** Planet-local unit tangent the arrow points along (toward its landmark). */
  dir: Vector3;
}

export type FurnitureKind = 'lamp' | 'bench' | 'planter' | 'noticeboard';

export interface Furniture {
  kind: FurnitureKind;
  n: Vector3;
  /** Planet-local unit tangent the item faces (toward the plaza centre). */
  facing: Vector3;
}

export interface Pond {
  n: Vector3;
  radiusU: number;
}

export interface PropLayout {
  hardwood: PropInstance[];
  fruit: PropInstance[];
  cedar: PropInstance[];
  /** All trees (hardwood + fruit + cedar). */
  trees: PropInstance[];
  bushes: PropInstance[];
  flowerBushes: PropInstance[];
  rocks: PropInstance[];
  /** Big boulders at cliff feet and in open country (blocking). */
  boulders: PropInstance[];
  /** Small decorative stones along banks, paths and cliffs (walk-through). */
  pebbles: PropInstance[];
  flowers: Record<FlowerKind, PropInstance[]>;
  grass: PropInstance[];
  posts: SignPost[];
  furniture: Furniture[];
  pond: Pond | null;
  river: River | null;
  bridges: Bridge[];
  mesas: Mesa[];
  /** Everything that blocks movement (landmarks are added by the controller). */
  obstacles: Obstacle[];
}

/** Deterministic PRNG so the planet looks the same on every visit. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomUnit(rand: () => number): Vector3 {
  const u = rand() * 2 - 1;
  const phi = rand() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return new Vector3(s * Math.cos(phi), u, s * Math.sin(phi));
}

export const TREE_TRUNK_RADIUS = 0.3;
export const POST_RADIUS = 0.1;
export const PLAZA_RADIUS_U = 3.0;
const FURNITURE_RADIUS: Record<FurnitureKind, number> = { lamp: 0.14, bench: 0.5, planter: 0.36, noticeboard: 0.4 };

/** One signpost per landmark, just beside the start of its path from the spawn plaza. */
export function plazaPosts(landmarks: readonly LandmarkGeometry[], cfg = CONFIG): SignPost[] {
  const R = cfg.planetRadius;
  const spawn = UP as Vector3;
  return landmarks.map((g) => {
    const out = tangentToward(spawn, g.approach) ?? new Vector3(0, 0, -1);
    const base = moveAlong(spawn, out, 2.1 / R);
    const along = tangentToward(base, g.approach) ?? out;
    const side = new Vector3().crossVectors(base, along).normalize();
    const n = moveAlong(base, side, 0.75 / R);
    const dir = tangentToward(n, g.n) ?? along;
    return { id: g.id, n, dir };
  });
}

/** Plaza furniture placed in the angular gaps between the paths leaving the plaza. */
export function plazaFurniture(landmarks: readonly LandmarkGeometry[], cfg = CONFIG): Furniture[] {
  const R = cfg.planetRadius;
  const spawn = UP as Vector3;
  const bearings = landmarks
    .map((g) => {
      const t = tangentToward(spawn, g.approach) ?? new Vector3(0, 0, -1);
      return Math.atan2(t.x, -t.z);
    })
    .sort((a, b) => a - b);
  const gaps = bearings.map((b, i) => {
    const next = i + 1 < bearings.length ? bearings[i + 1] : bearings[0] + Math.PI * 2;
    return { mid: (b + next) / 2, size: next - b };
  });
  const widest = gaps.reduce((a, b) => (b.size > a.size ? b : a), gaps[0]);
  const place = (bearing: number, dist: number, kind: FurnitureKind): Furniture => {
    const dir = new Vector3(Math.sin(bearing), 0, -Math.cos(bearing));
    const n = moveAlong(spawn, dir, dist / R);
    return { kind, n, facing: tangentToward(n, spawn) ?? dir.clone().negate() };
  };
  const items: Furniture[] = [];
  gaps.forEach((g, i) => {
    if (g === widest) {
      items.push(place(g.mid, 2.55, 'bench'));
      items.push(place(g.mid - g.size * 0.28, 2.75, 'noticeboard'));
      items.push(place(g.mid + g.size * 0.28, 2.8, 'lamp'));
    } else if (g.size > 0.6) {
      items.push(place(g.mid, 2.8, i % 2 ? 'planter' : 'lamp'));
    }
  });
  return items;
}

/** Pick the open spot furthest from spawn, landmarks and their paths. */
export function choosePond(landmarks: readonly LandmarkGeometry[], cfg = CONFIG): Pond | null {
  const R = cfg.planetRadius;
  const spawn = UP as Vector3;
  let best: { n: Vector3; clearance: number } | null = null;
  const N = 400;
  for (let i = 0; i < N; i++) {
    const y = 1 - (2 * (i + 0.5)) / N;
    const r = Math.sqrt(1 - y * y);
    const t = Math.PI * (3 - Math.sqrt(5)) * i;
    const n = new Vector3(Math.cos(t) * r, y, Math.sin(t) * r);
    let c = arcDistance(n, spawn, R) - PLAZA_RADIUS_U;
    for (const g of landmarks) {
      c = Math.min(c, arcDistance(n, g.n, R) - g.footprintU - 1.2);
      c = Math.min(c, pointArcDistance(n, spawn, g.approach, R) - 1.0);
    }
    if (!best || c > best.clearance) best = { n, clearance: c };
  }
  if (!best || best.clearance < 1.6) return null;
  return { n: best.n, radiusU: Math.min(1.5, best.clearance - 0.2) };
}

export function generateProps(landmarks: readonly LandmarkGeometry[], seed = 7, cfg = CONFIG): PropLayout {
  const rand = mulberry32(seed);
  const R = cfg.planetRadius;
  const spawn = UP as Vector3;
  const corridor = (n: Vector3) => Math.min(...landmarks.map((g) => pointArcDistance(n, spawn, g.approach, R)));
  const pond = choosePond(landmarks, cfg);
  const posts = plazaPosts(landmarks, cfg);
  const furniture = plazaFurniture(landmarks, cfg);
  const mesas = buildMesas(cfg);
  const river = buildRiver(pond, mesas[0] ?? null, cfg);
  const bridges = findBridges(river, landmarks, cfg);

  const nearLandmark = (n: Vector3, pad: number) => landmarks.some((g) => arcDistance(n, g.n, R) < g.footprintU + pad || arcDistance(n, g.approach, R) < 1.2 + pad * 0.3);
  const pondF = pond ? pondFrame(pond, river) : null;
  const inPond = (n: Vector3, pad: number) => (pond && pondF ? arcDistance(n, pond.n, R) < shoreRadius(pond, pondF, pondAngle(pond, pondF, n)) + pad : false);
  const inPlaza = (n: Vector3, pad: number) => arcDistance(n, spawn, R) < PLAZA_RADIUS_U + pad;
  /** Signed distance (u) from `n` to the water's edge (negative = in the river). */
  const riverEdge = (n: Vector3) => {
    const { d, i } = riverDistance(river, n, cfg);
    return d - river.halfWidth[i];
  };
  const nearRiver = (n: Vector3, pad: number) => riverEdge(n) < pad;
  /** Signed distance (u) from `n` to the nearest mesa rim (negative = on top). */
  const mesaEdge = (n: Vector3) => {
    let best = Infinity;
    for (const m of mesas) {
      const { r, angle } = mesaPolar(m, n, cfg);
      best = Math.min(best, r - mesaRadius(m.radiusU, m.seed, angle));
    }
    return best;
  };
  const nearMesa = (n: Vector3, pad: number) => mesaEdge(n) < pad;
  const blocked = (n: Vector3, pads: { river: number; mesa: number }) => nearRiver(n, pads.river) || nearMesa(n, pads.mesa);

  const hardwood: PropInstance[] = [];
  const fruit: PropInstance[] = [];
  const cedar: PropInstance[] = [];
  const trees: PropInstance[] = [];
  for (let tries = 0; trees.length < 40 && tries < 5000; tries++) {
    const n = randomUnit(rand);
    const kind = rand();
    const scale = 0.85 + rand() * 0.35;
    const isCedar = kind >= 0.72;
    if (inPlaza(n, 0.6) || nearLandmark(n, 1.9) || inPond(n, 1.0)) continue;
    // the whole crown stays clear of the cliff walls (it would otherwise cut into the rock)
    if (corridor(n) < 1.35 || blocked(n, { river: 0.9, mesa: canopyRadius(isCedar) * scale + 0.15 })) continue;
    if (trees.some((t) => arcDistance(t.n, n, R) < 1.7)) continue;
    const inst = { n, scale, yaw: rand() * Math.PI * 2, tint: rand() };
    (kind < 0.55 ? hardwood : isCedar ? cedar : fruit).push(inst);
    trees.push(inst);
  }
  // a tree or two on each mesa top (unreachable, so no obstacles): trunks well inside the rims,
  // one on the upper tier of a two-tier mesa and one on its lower terrace, clear of the tier wall
  const mesaTop: PropInstance[] = [];
  mesas.forEach((m, i) => {
    const isCedar = i % 2 === 0;
    const count = m.radiusU > 1.5 ? 2 : 1;
    for (let k = 0; k < count; k++) {
      const scale = 0.7 + rand() * 0.2;
      const onTier = Boolean(m.tier) && k === 0;
      let n: Vector3 | null = null;
      for (let t = 0; t < 80 && !n; t++) {
        const a = rand() * Math.PI * 2;
        const f = rand();
        const c = onTier ? m.tier!.n : m.n;
        const cand = moveAlong(c, mesaDir(m, c, a), ((onTier ? tierEdge(m.tier!, a) : mesaRadius(m.radiusU, m.seed, a)) * (onTier ? 0.6 : 0.85) * Math.sqrt(f)) / R);
        if (mesaTopClearance(m, cand, isCedar, scale, onTier, cfg)) n = cand;
      }
      if (!n) continue;
      const inst = { n, scale, yaw: rand() * Math.PI * 2, tint: rand() };
      (isCedar ? cedar : hardwood).push(inst);
      mesaTop.push(inst);
    }
  });

  const bushes: PropInstance[] = [];
  const flowerBushes: PropInstance[] = [];
  const allBushes: PropInstance[] = [];
  for (let tries = 0; allBushes.length < 18 && tries < 4000; tries++) {
    const n = randomUnit(rand);
    if (inPlaza(n, 0.3) || nearLandmark(n, 0.9) || inPond(n, 0.6)) continue;
    if (corridor(n) < 1.0 || blocked(n, { river: 0.5, mesa: 0.6 })) continue;
    if ([...trees, ...allBushes].some((t) => arcDistance(t.n, n, R) < 1.1)) continue;
    const inst = { n, scale: 0.8 + rand() * 0.4, yaw: rand() * Math.PI * 2, tint: rand() };
    (rand() < 0.35 ? flowerBushes : bushes).push(inst);
    allBushes.push(inst);
  }

  const rocks: PropInstance[] = [];
  for (let tries = 0; rocks.length < 18 && tries < 3000; tries++) {
    const n = randomUnit(rand);
    if (inPlaza(n, 0.2) || nearLandmark(n, 0.8) || inPond(n, 0.2)) continue;
    if (corridor(n) < 0.95 || blocked(n, { river: 0.35, mesa: 0.3 })) continue;
    if ([...trees, ...allBushes, ...rocks].some((t) => arcDistance(t.n, n, R) < 1.0)) continue;
    rocks.push({ n, scale: 0.55 + rand() * 0.55, yaw: rand() * Math.PI * 2, tint: rand() });
  }

  // boulders: huddled at the foot of each cliff, a few on the river banks and out in the open
  const boulders: PropInstance[] = [];
  const clear = (n: Vector3, gap: number) =>
    !inPlaza(n, 0.4) &&
    !nearLandmark(n, 0.8) &&
    !inPond(n, 0.4) &&
    corridor(n) >= 1.1 &&
    ![...trees, ...allBushes, ...rocks, ...boulders].some((t) => arcDistance(t.n, n, R) < gap);
  for (const m of mesas) {
    for (let k = 0, tries = 0; k < 4 && tries < 60; tries++) {
      const a = rand() * Math.PI * 2;
      const dir = m.north.clone().multiplyScalar(Math.cos(a)).addScaledVector(m.east, Math.sin(a));
      const edge = mesaRadius(m.radiusU, m.seed, a);
      const n = moveAlong(m.n, dir, (edge + 0.35 + rand() * 0.3) / R);
      if (!clear(n, 0.7) || nearRiver(n, 0.3)) continue;
      boulders.push({ n, scale: 0.75 + rand() * 0.55, yaw: rand() * Math.PI * 2, tint: rand() });
      k++;
    }
  }
  for (let k = 0, tries = 0; k < 7 && tries < 400; tries++) {
    const i = Math.floor(rand() * river.samples.length);
    const side = new Vector3().crossVectors(river.samples[i], river.tangent[i]).normalize().multiplyScalar(rand() < 0.5 ? -1 : 1);
    const n = moveAlong(river.samples[i], side, (river.halfWidth[i] + 0.45 + rand() * 0.3) / R);
    if (!clear(n, 1.0) || nearRiver(n, 0.2) || nearMesa(n, 0.3)) continue;
    boulders.push({ n, scale: 0.7 + rand() * 0.4, yaw: rand() * Math.PI * 2, tint: rand() });
    k++;
  }
  for (let k = 0, tries = 0; k < 6 && tries < 2000; tries++) {
    const n = randomUnit(rand);
    if (!clear(n, 1.4) || nearRiver(n, 0.6) || nearMesa(n, 0.4)) continue;
    boulders.push({ n, scale: 0.8 + rand() * 0.6, yaw: rand() * Math.PI * 2, tint: rand() });
    k++;
  }

  // pebbles: river banks, cliff feet and path edges (decorative, walk-through)
  const pebbles: PropInstance[] = [];
  for (let tries = 0; pebbles.length < 90 && tries < 6000; tries++) {
    const pick = rand();
    let n: Vector3;
    if (pick < 0.5) {
      const i = Math.floor(rand() * river.samples.length);
      const side = new Vector3().crossVectors(river.samples[i], river.tangent[i]).normalize().multiplyScalar(rand() < 0.5 ? -1 : 1);
      n = moveAlong(river.samples[i], side, (river.halfWidth[i] + 0.02 + rand() * 0.3) / R);
    } else if (pick < 0.75) {
      const m = mesas[Math.floor(rand() * mesas.length)];
      const a = rand() * Math.PI * 2;
      const dir = m.north.clone().multiplyScalar(Math.cos(a)).addScaledVector(m.east, Math.sin(a));
      n = moveAlong(m.n, dir, (mesaRadius(m.radiusU, m.seed, a) + 0.12 + rand() * 0.4) / R);
    } else {
      n = randomUnit(rand);
      const c = corridor(n);
      if (c < 0.42 || c > 0.62) continue;
    }
    if (inPlaza(n, 0) || nearLandmark(n, 0.3) || inPond(n, 0.1) || nearRiver(n, 0) || nearMesa(n, 0.08)) continue;
    pebbles.push({ n, scale: 0.12 + rand() * 0.16, yaw: rand() * Math.PI * 2, tint: rand() });
  }

  // flowers grow in single-kind, single-colour clumps (walk-through, decorative)
  const flowers: Record<FlowerKind, PropInstance[]> = { tulip: [], cosmos: [], pansy: [] };
  for (let c = 0, tries = 0; c < 24 && tries < 3000; tries++) {
    const center = randomUnit(rand);
    if (inPlaza(center, -0.2) || nearLandmark(center, 0.5) || inPond(center, 0.4)) continue;
    if (corridor(center) < 0.8 || blocked(center, { river: 0.5, mesa: 0.4 })) continue;
    c++;
    const kind = FLOWER_KINDS[Math.floor(rand() * FLOWER_KINDS.length)];
    const tint = rand();
    const count = 4 + Math.floor(rand() * 6);
    for (let i = 0; i < count; i++) {
      const dir = tangentToward(center, randomUnit(rand));
      if (!dir) continue;
      const n = moveAlong(center, dir, (0.15 + rand() * 0.6) / R);
      if (corridor(n) < 0.55 || blocked(n, { river: 0.2, mesa: 0.15 })) continue;
      if ([...trees, ...allBushes, ...rocks, ...boulders].some((t) => arcDistance(t.n, n, R) < 0.55)) continue;
      flowers[kind].push({ n, scale: 0.85 + rand() * 0.35, yaw: rand() * Math.PI * 2, tint });
    }
  }

  const grass: PropInstance[] = [];
  for (let tries = 0; grass.length < 650 && tries < 8000; tries++) {
    const n = randomUnit(rand);
    if (inPlaza(n, 0.1) || inPond(n, 0.4)) continue;
    if (landmarks.some((g) => arcDistance(n, g.n, R) < g.footprintU + 0.6)) continue;
    if (corridor(n) < 0.6 || nearRiver(n, 0.12)) continue;
    // grass grows on mesa tops too, but not on the cliff rims (base or upper tier)
    if (nearPlateauRim(mesas, n, 0.3, 0.2)) continue;
    grass.push({ n, scale: 0.7 + rand() * 0.7, yaw: rand() * Math.PI * 2, tint: rand() });
  }

  const onMesaTop = new Set(mesaTop);
  const obstacles: Obstacle[] = [
    ...hardwood.filter((t) => !onMesaTop.has(t)).map((t) => ({ n: t.n, radiusU: 0.42 * t.scale })),
    ...fruit.map((t) => ({ n: t.n, radiusU: 0.42 * t.scale })),
    ...cedar.filter((t) => !onMesaTop.has(t)).map((t) => ({ n: t.n, radiusU: 0.36 * t.scale })),
    ...allBushes.map((b) => ({ n: b.n, radiusU: 0.42 * b.scale })),
    ...rocks.map((r) => ({ n: r.n, radiusU: 0.36 * r.scale })),
    ...boulders.map((r) => ({ n: r.n, radiusU: 0.4 * r.scale })),
    ...posts.map((p) => ({ n: p.n, radiusU: POST_RADIUS })),
    ...furniture.map((f) => ({ n: f.n, radiusU: FURNITURE_RADIUS[f.kind] })),
    // the stream and pond are shallow enough to wade through (spec §4.14), so water doesn't block
    ...bridgeRailObstacles(bridges, cfg),
    ...mesas.flatMap((m) => mesaObstacles(m, cfg)),
  ];

  return { hardwood, fruit, cedar, trees, bushes, flowerBushes, rocks, boulders, pebbles, flowers, grass, posts, furniture, pond, river, bridges, mesas, obstacles };
}

/** Rails along both sides of each bridge deck. */
export function bridgeRailObstacles(bridges: readonly Bridge[], cfg = CONFIG): Obstacle[] {
  const R = cfg.planetRadius;
  const out: Obstacle[] = [];
  for (const b of bridges) {
    for (let t = -b.halfLengthU; t <= b.halfLengthU + 1e-6; t += 0.3) {
      for (const s of [-1, 1]) {
        const n = moveAlong(moveAlong(b.n, b.along, t / R), b.across, (s * (b.halfWidthU - 0.02)) / R);
        out.push({ n, radiusU: 0.08 });
      }
    }
  }
  return out;
}

/** Horizontal crown radius (u, at scale 1) of a hardwood or a cedar (foliage.ts). */
export function canopyRadius(isCedar: boolean): number {
  return isCedar ? 1.3 : 1.6;
}

/** Height (u, at scale 1) of the lowest foliage above the ground. */
export function canopyBottom(isCedar: boolean): number {
  return isCedar ? 0.65 : 1.25;
}

/**
 * Whether a tree on a mesa top at `n` stands clear: its trunk and roots at least 0.6 u inside
 * the rim it stands on, and, on the lower terrace of a two-tier mesa, clear of the tier's wall
 * (the whole crown, unless the crown starts above the tier's top).
 */
export function mesaTopClearance(m: Mesa, n: Vector3, isCedar: boolean, scale: number, onTier: boolean, cfg = CONFIG): boolean {
  const { r, angle } = mesaPolar(m, n, cfg);
  if (r > mesaRadius(m.radiusU, m.seed, angle) - 0.6) return false;
  if (!m.tier) return true;
  const t = tierPolar(m, n, cfg);
  const e = t.r - tierEdge(m.tier, t.angle);
  if (onTier) return e < -0.6;
  const crownClears = canopyBottom(isCedar) * scale > m.tier.heightU + 0.15;
  return e > (crownClears ? 0.5 : canopyRadius(isCedar) * scale + 0.1);
}

/** A cliff blocks with a core circle plus a ring that follows its irregular outline. */
export function mesaObstacles(m: Mesa, cfg = CONFIG): Obstacle[] {
  const R = cfg.planetRadius;
  const out: Obstacle[] = [{ n: m.n, radiusU: m.radiusU * 0.8 }];
  const count = Math.ceil((Math.PI * 2 * m.radiusU) / 0.45);
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2;
    const dir = m.north.clone().multiplyScalar(Math.cos(a)).addScaledVector(m.east, Math.sin(a));
    const edge = mesaRadius(m.radiusU, m.seed, a);
    out.push({ n: moveAlong(m.n, dir, (edge - 0.28) / R), radiusU: 0.36 });
  }
  return out;
}
