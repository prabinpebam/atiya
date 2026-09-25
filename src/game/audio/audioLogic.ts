/** Pure sound rules (no Web Audio): what the ground sounds like, how loud the stream is, when birds sing. */
import type { Vector3 } from 'three';
import { CONFIG } from '../config';
import { UP, arcDistance, pointArcDistance } from '../math/sphere';
import type { LandmarkGeometry } from '../math/landmarks';
import { PLAZA_RADIUS_U } from '../world/layout';
import type { Terrain } from '../world/terrain';

export type Surface = 'grass' | 'wood' | 'stone' | 'water';

/** Wading deeper than this (u) splashes. */
export const WADE_SPLASH_U = 0.05;
/** Dirt paths are this wide (half-width, u) — matches the ground shader's path band. */
const PATH_HALF_U = 0.46;
/** Cobbles reach this far (u) past a landmark's footprint. */
const COBBLE_U = 0.5;

/**
 * The surface under the player at `p` (unit, planet space), in the order the ground is painted:
 * water when wading, the bridge's planks, the plaza, landmark cobbles and dirt paths, else lawn.
 */
export function surfaceAt(p: Vector3, geos: readonly LandmarkGeometry[], terrain: Terrain, wadeDepth: number): Surface {
  const R = CONFIG.planetRadius;
  if (wadeDepth > WADE_SPLASH_U) return 'water';
  const deck = terrain.deckHeight(p);
  if (deck > -Infinity && deck >= terrain.height(p) - 0.02) return 'wood';
  const spawn = UP as Vector3;
  if (arcDistance(p, spawn, R) < PLAZA_RADIUS_U) return 'stone';
  for (const g of geos) {
    if (arcDistance(p, g.n, R) < g.footprintU + COBBLE_U) return 'stone';
    if (pointArcDistance(p, spawn, g.n, R) < PATH_HALF_U) return 'stone';
  }
  return 'grass';
}

/**
 * Stream loudness (0…1) at `d` u from the water's edge: full on the bank, halving by ~2 u,
 * and silent beyond `reach` so the far side of the planet is quiet.
 */
export function streamLevel(edgeDistance: number, reach = 14): number {
  const d = Math.max(0, edgeDistance);
  if (d >= reach) return 0;
  const fall = 1 / (1 + (d / 2.2) ** 2);
  const t = 1 - d / reach;
  return fall * t * t;
}

/** Wind loudness (0…1) and lowpass cutoff (Hz) for the WindFx strength (0.3…1) and gust (0…1). */
export function windMix(strength: number, gust: number): { level: number; cutoff: number } {
  const s = Math.min(1, Math.max(0, (strength - 0.3) / 0.7));
  const g = Math.min(1, Math.max(0, gust));
  return { level: 0.35 + 0.3 * s + 0.35 * g, cutoff: 700 + 2800 * (0.3 * s + 0.7 * g) };
}

/** Birds sing by day and into dusk; the planet is quiet once it's properly night. */
export const birdsSing = (night: number) => night < 0.35;

/** Seconds until the next bird: a few every half minute, never on a beat. */
export const nextBirdDelay = (rand: () => number) => 5 + rand() * 11;

/** A variation index in [0, count) that never repeats `last` (so two steps in a row never sound identical). */
export function pickVariant(count: number, last: number, rand: () => number): number {
  if (count <= 1) return 0;
  const i = Math.floor(rand() * (count - 1));
  return last >= 0 && last < count && i >= last ? i + 1 : i;
}

/**
 * Where in a looping walk/run cycle each foot lands (0…1), from one foot's heights sampled evenly
 * over the cycle: the moment it comes down to within `within` of its lowest point.
 */
export function contactPhase(heights: readonly number[], within = 0.1): number {
  const n = heights.length;
  const lo = Math.min(...heights);
  const hi = Math.max(...heights);
  const thr = lo + within * (hi - lo);
  for (let i = 0; i < n; i++) if (heights[i] <= thr && heights[(i - 1 + n) % n] > thr) return i / n;
  return heights.indexOf(lo) / n;
}

/** Did the cycle position move past any of `phases` going from `prev` to `t` (both 0…1, wrapping)? */
export function crossedPhase(prev: number, t: number, phases: readonly number[]): boolean {
  if (t === prev) return false;
  return phases.some((p) => (t > prev ? p > prev && p <= t : p > prev || p <= t));
}
