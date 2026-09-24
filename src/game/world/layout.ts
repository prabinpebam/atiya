import { Vector3 } from 'three';
import { CONFIG } from '../config';
import { UP, arcDistance, moveAlong, pointArcDistance, tangentToward, type Obstacle } from '../math/sphere';
import type { LandmarkGeometry } from '../math/landmarks';

export type FlowerKind = 'tulip' | 'cosmos' | 'pansy';
export const FLOWER_KINDS: FlowerKind[] = ['tulip', 'cosmos', 'pansy'];

export interface PropInstance {
  /** Planet-local unit position. */
  n: Vector3;
  scale: number;
  yaw: number;
  /** 0..1 random value used for colour variation. */
  tint: number;
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
  flowers: Record<FlowerKind, PropInstance[]>;
  grass: PropInstance[];
  posts: SignPost[];
  furniture: Furniture[];
  pond: Pond | null;
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

  const nearLandmark = (n: Vector3, pad: number) => landmarks.some((g) => arcDistance(n, g.n, R) < g.footprintU + pad || arcDistance(n, g.approach, R) < 1.2 + pad * 0.3);
  const inPond = (n: Vector3, pad: number) => (pond ? arcDistance(n, pond.n, R) < pond.radiusU + pad : false);
  const inPlaza = (n: Vector3, pad: number) => arcDistance(n, spawn, R) < PLAZA_RADIUS_U + pad;

  const hardwood: PropInstance[] = [];
  const fruit: PropInstance[] = [];
  const cedar: PropInstance[] = [];
  const trees: PropInstance[] = [];
  for (let tries = 0; trees.length < 40 && tries < 5000; tries++) {
    const n = randomUnit(rand);
    if (inPlaza(n, 0.6) || nearLandmark(n, 1.9) || inPond(n, 1.0)) continue;
    if (corridor(n) < 1.35) continue;
    if (trees.some((t) => arcDistance(t.n, n, R) < 1.7)) continue;
    const kind = rand();
    const inst = { n, scale: 0.85 + rand() * 0.35, yaw: rand() * Math.PI * 2, tint: rand() };
    (kind < 0.55 ? hardwood : kind < 0.72 ? fruit : cedar).push(inst);
    trees.push(inst);
  }

  const bushes: PropInstance[] = [];
  const flowerBushes: PropInstance[] = [];
  const allBushes: PropInstance[] = [];
  for (let tries = 0; allBushes.length < 18 && tries < 4000; tries++) {
    const n = randomUnit(rand);
    if (inPlaza(n, 0.3) || nearLandmark(n, 0.9) || inPond(n, 0.6)) continue;
    if (corridor(n) < 1.0) continue;
    if ([...trees, ...allBushes].some((t) => arcDistance(t.n, n, R) < 1.1)) continue;
    const inst = { n, scale: 0.8 + rand() * 0.4, yaw: rand() * Math.PI * 2, tint: rand() };
    (rand() < 0.35 ? flowerBushes : bushes).push(inst);
    allBushes.push(inst);
  }

  const rocks: PropInstance[] = [];
  for (let tries = 0; rocks.length < 14 && tries < 3000; tries++) {
    const n = randomUnit(rand);
    if (inPlaza(n, 0.2) || nearLandmark(n, 0.8) || inPond(n, 0.2)) continue;
    if (corridor(n) < 0.95) continue;
    if ([...trees, ...allBushes, ...rocks].some((t) => arcDistance(t.n, n, R) < 1.0)) continue;
    rocks.push({ n, scale: 0.55 + rand() * 0.55, yaw: rand() * Math.PI * 2, tint: rand() });
  }

  // flowers grow in single-kind, single-colour clumps (walk-through, decorative)
  const flowers: Record<FlowerKind, PropInstance[]> = { tulip: [], cosmos: [], pansy: [] };
  for (let c = 0, tries = 0; c < 24 && tries < 3000; tries++) {
    const center = randomUnit(rand);
    if (inPlaza(center, -0.2) || nearLandmark(center, 0.5) || inPond(center, 0.4)) continue;
    if (corridor(center) < 0.8) continue;
    c++;
    const kind = FLOWER_KINDS[Math.floor(rand() * FLOWER_KINDS.length)];
    const tint = rand();
    const count = 4 + Math.floor(rand() * 6);
    for (let i = 0; i < count; i++) {
      const dir = tangentToward(center, randomUnit(rand));
      if (!dir) continue;
      const n = moveAlong(center, dir, (0.15 + rand() * 0.6) / R);
      if (corridor(n) < 0.55 || [...trees, ...allBushes, ...rocks].some((t) => arcDistance(t.n, n, R) < 0.55)) continue;
      flowers[kind].push({ n, scale: 0.85 + rand() * 0.35, yaw: rand() * Math.PI * 2, tint });
    }
  }

  const grass: PropInstance[] = [];
  for (let tries = 0; grass.length < 650 && tries < 8000; tries++) {
    const n = randomUnit(rand);
    if (inPlaza(n, 0.1) || inPond(n, 0.4)) continue;
    if (landmarks.some((g) => arcDistance(n, g.n, R) < g.footprintU + 0.6)) continue;
    if (corridor(n) < 0.6) continue;
    grass.push({ n, scale: 0.7 + rand() * 0.7, yaw: rand() * Math.PI * 2, tint: rand() });
  }

  const obstacles: Obstacle[] = [
    ...hardwood.map((t) => ({ n: t.n, radiusU: 0.42 * t.scale })),
    ...fruit.map((t) => ({ n: t.n, radiusU: 0.42 * t.scale })),
    ...cedar.map((t) => ({ n: t.n, radiusU: 0.36 * t.scale })),
    ...allBushes.map((b) => ({ n: b.n, radiusU: 0.42 * b.scale })),
    ...rocks.map((r) => ({ n: r.n, radiusU: 0.36 * r.scale })),
    ...posts.map((p) => ({ n: p.n, radiusU: POST_RADIUS })),
    ...furniture.map((f) => ({ n: f.n, radiusU: FURNITURE_RADIUS[f.kind] })),
  ];
  if (pond) obstacles.push({ n: pond.n, radiusU: pond.radiusU + 0.15 });

  return { hardwood, fruit, cedar, trees, bushes, flowerBushes, rocks, flowers, grass, posts, furniture, pond, obstacles };
}
