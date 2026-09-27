import type { LandmarkGeometry } from '../math/landmarks';
import { CHEST_RADIUS, type PropLayout } from './layout';
import type { HomeSpot } from './homestead';
import type { PadSpec } from './pads';

/**
 * The flat pad under every structure (docs: poc-3d-navigation/ground.md): what stands where, and
 * the box its base covers in its own frame (x right, z front, u). The boxes are measured from the
 * models (y < 0.3); `tests/unit/pads.test.ts` checks each still covers its model.
 */

export type Box = readonly [x0: number, x1: number, z0: number, z1: number];

/** Landmark bases by variant (the building plus whatever stands round it on the ground: steps, planters, book stacks). */
export const LANDMARK_BASE: Readonly<Record<string, Box>> = {
  workshop: [-1.58, 1.1, -0.85, 1.19],
  'town-hall': [-1.28, 1.68, -0.88, 1.84],
  lighthouse: [-1.23, 1.22, -1.15, 1.07],
  library: [-1.34, 1.68, -0.9, 1.42],
  amphitheater: [-1.72, 1.72, -1.62, 1.53],
  greenhouse: [-1.36, 1.36, -1.36, 1.68],
  'post-office': [-1.2, 1.12, -1.14, 1.06],
};
/** Cobblestone forecourt round each landmark, beyond its base (u). */
export const LANDMARK_APRON = 0.55;

/** The crafting table (craft/models.ts `craftingTableModel`). */
export const CRAFT_TABLE_BASE: Box = [-0.49, 0.49, -0.25, 0.52];
/** The bench by the bridge (parts.ts `bench`; Plaza.tsx). */
export const BENCH_BASE: Box = [-0.56, 0.56, -0.21, 0.19];
export const padSpec = (id: string, at: HomeSpot, b: Box, extra: Partial<PadSpec> = {}): PadSpec => ({ id, n: at.n, facing: at.facing, x0: b[0], x1: b[1], z0: b[2], z1: b[3], ...extra });

/**
 * The pads under the landmarks, the chest, the crafting table and the bench by the
 * bridge, each plane fitted to the natural ground under it (terrain.ts). The home's come with its
 * chunk (home/homePads.ts).
 */
export function structurePads(landmarks: ReadonlyArray<{ geo: LandmarkGeometry; variant: string }>, props: PropLayout): PadSpec[] {
  const out: PadSpec[] = [];
  for (const { geo, variant } of landmarks) {
    const b = LANDMARK_BASE[variant];
    if (!b) continue;
    out.push(padSpec(`landmark:${geo.id}`, { n: geo.n, facing: geo.door }, b, { margin: 0.3, skirt: 1.0, apron: LANDMARK_APRON }));
  }
  if (props.chest) out.push(padSpec('chest', props.chest, [-CHEST_RADIUS * 0.85, CHEST_RADIUS * 0.85, -0.25, 0.3], { skirt: 0.6 }));
  if (props.craft) out.push(padSpec('craft', props.craft, CRAFT_TABLE_BASE, { skirt: 0.6 }));
  for (const f of props.furniture) if (f.kind === 'bench') out.push(padSpec('bench', f, BENCH_BASE, { skirt: 0.6 }));
  return out;
}
