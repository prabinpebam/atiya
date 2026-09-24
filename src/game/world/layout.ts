import { Vector3 } from 'three';
import { CONFIG } from '../config';
import { UP, arcDistance, moveAlong, tangentToward, type Obstacle } from '../math/sphere';
import { segmentClearance, type LandmarkGeometry } from '../math/landmarks';

export interface PropInstance {
  /** Planet-local unit position. */
  n: Vector3;
  scale: number;
  yaw: number;
  tint: number;
}

export interface SignPost {
  id: string;
  /** Planet-local unit position. */
  n: Vector3;
  /** Planet-local unit tangent the arrow points along (toward its landmark). */
  dir: Vector3;
}

export interface PropLayout {
  trees: PropInstance[];
  rocks: PropInstance[];
  flowers: PropInstance[];
  posts: SignPost[];
  /** Tree trunks and signposts block movement; rocks and flowers are decorative. */
  obstacles: Obstacle[];
}

export const POST_RADIUS = 0.1;

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

export function generateProps(landmarks: readonly LandmarkGeometry[], seed = 7, cfg = CONFIG): PropLayout {
  const rand = mulberry32(seed);
  const R = cfg.planetRadius;
  const spawn = UP as Vector3;
  const corridors = landmarks.map((g) => ({ a: spawn, b: g.approach }));

  const clearOfLandmarks = (n: Vector3, margin: number) =>
    arcDistance(n, spawn, R) > 3.4 + margin &&
    landmarks.every((g) => arcDistance(n, g.n, R) > g.footprintU + 1.9 + margin && arcDistance(n, g.approach, R) > 1.4 + margin);

  const clearOfCorridors = (n: Vector3, width: number) =>
    corridors.every((c) => segmentClearance(c.a, c.b, { n, radiusU: TREE_TRUNK_RADIUS }, cfg) > width);

  const trees: PropInstance[] = [];
  for (let tries = 0; trees.length < 46 && tries < 4000; tries++) {
    const n = randomUnit(rand);
    if (!clearOfLandmarks(n, 0)) continue;
    if (!clearOfCorridors(n, 0.9)) continue;
    if (trees.some((t) => arcDistance(t.n, n, R) < 1.5)) continue;
    trees.push({ n, scale: 0.8 + rand() * 0.6, yaw: rand() * Math.PI * 2, tint: rand() });
  }

  const rocks: PropInstance[] = [];
  for (let tries = 0; rocks.length < 36 && tries < 3000; tries++) {
    const n = randomUnit(rand);
    if (!clearOfLandmarks(n, -0.6)) continue;
    if ([...trees, ...rocks].some((t) => arcDistance(t.n, n, R) < 0.9)) continue;
    rocks.push({ n, scale: 0.15 + rand() * 0.3, yaw: rand() * Math.PI * 2, tint: rand() });
  }

  const flowers: PropInstance[] = [];
  for (let tries = 0; flowers.length < 120 && tries < 4000; tries++) {
    const n = randomUnit(rand);
    if (landmarks.some((g) => arcDistance(n, g.n, R) < g.footprintU + 0.4)) continue;
    if (trees.some((t) => arcDistance(t.n, n, R) < 0.5)) continue;
    flowers.push({ n, scale: 0.6 + rand() * 0.6, yaw: rand() * Math.PI * 2, tint: rand() });
  }

  const posts = plazaPosts(landmarks, cfg);

  return {
    trees,
    rocks,
    flowers,
    posts,
    obstacles: [
      ...trees.map((t) => ({ n: t.n, radiusU: TREE_TRUNK_RADIUS * t.scale })),
      ...posts.map((p) => ({ n: p.n, radiusU: POST_RADIUS })),
    ],
  };
}
