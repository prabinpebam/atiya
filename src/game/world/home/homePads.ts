import { Vector3 } from 'three';
import { padSpec, type Box } from '../groundPads';
import { PROP_SCALE, TULSI_SPOT, YARD, type HomeSpot, type Homestead } from '../homestead';
import type { PadSpec } from '../pads';

/**
 * The flat pads under the home's structures (docs: poc-3d-navigation/ground.md). They load with the
 * home's chunk and are added to the terrain when it attaches, before the ground is built.
 */

/** The owner's cottage with its front steps, doormat, pots and mailbox (models.ts `houseModel`). */
export const HOUSE_BASE: Box = [-1.17, 1.17, -0.97, 1.86];
/** Chopper's house (craft/models.ts `dogHouseModel`). */
export const DOG_HOUSE_BASE: Box = [-0.58, 0.62, -0.65, 0.9];
/** A vegetable bed (models.ts `bed`, 1.25 × 0.55). */
export const BED_BASE: Box = [-YARD.bedL / 2 - 0.02, YARD.bedL / 2 + 0.02, -YARD.bedW / 2 - 0.02, YARD.bedW / 2 + 0.02];

/** A box round several things near `c` (each a disc `r` u across), in `c`'s frame. */
function around(c: HomeSpot, members: ReadonlyArray<{ n: Vector3; r: number }>, R: number): Box {
  const z = c.facing.clone().addScaledVector(c.n, -c.facing.dot(c.n)).normalize();
  const x = new Vector3().crossVectors(c.n, z).normalize();
  let [x0, x1, z0, z1] = [Infinity, -Infinity, Infinity, -Infinity];
  for (const m of members) {
    const q = m.n.clone().divideScalar(m.n.dot(c.n)).sub(c.n);
    const lx = q.dot(x) * R;
    const lz = q.dot(z) * R;
    x0 = Math.min(x0, lx - m.r);
    x1 = Math.max(x1, lx + m.r);
    z0 = Math.min(z0, lz - m.r);
    z1 = Math.max(z1, lz + m.r);
  }
  return [x0, x1, z0, z1];
}

export function homePads(home: Homestead, R: number): PadSpec[] {
  // the woodpile leans on the house's side wall: one pad for both
  const wood = around(home.house, [{ n: home.yard.woodpile.n, r: 0.23 }], R);
  const house: Box = [Math.min(HOUSE_BASE[0], wood[0]), Math.max(HOUSE_BASE[1], wood[1]), Math.min(HOUSE_BASE[2], wood[2]), Math.max(HOUSE_BASE[3], wood[3])];
  const chair = 0.22 * PROP_SCALE + 0.02;
  return [
    padSpec('house', home.house, house, { margin: 0.3, skirt: 0.9, apron: 0.45 }),
    padSpec('dog-house', home.dogHouse, DOG_HOUSE_BASE, { skirt: 0.6 }),
    // the picnic table and its four chairs, the campfire with its chairs and log, the reading corner
    padSpec('picnic', home.table, around(home.table, [{ n: home.table.n, r: 0.56 * PROP_SCALE }, ...home.tableChairs.map((c) => ({ n: c.n, r: chair }))], R), { skirt: 0.7 }),
    padSpec('campfire', home.fire, around(home.fire, [{ n: home.fire.n, r: 0.5 * 0.85 }, ...home.campChairs.map((c) => ({ n: c.n, r: chair })), { n: home.log.n, r: 0.5 * PROP_SCALE }], R), { skirt: 0.7 }),
    padSpec('reading', home.readingChair, around(home.readingChair, [{ n: home.readingChair.n, r: 0.29 * PROP_SCALE + 0.02 }, { n: home.sideTable.n, r: 0.14 * PROP_SCALE + 0.02 }], R), { skirt: 0.6 }),
    ...home.yard.beds.map((b, i) => padSpec(`bed-${i}`, b, BED_BASE, { margin: 0.2, skirt: 0.6 })),
    // the tulsi on its own round cobbled spot (a point box: the flat ground and the cobbles are discs round it)
    padSpec('tulsi', home.yard.tulsi, [0, 0, 0, 0], { margin: TULSI_SPOT.flat, skirt: 0.5, apron: TULSI_SPOT.cobbles }),
  ];
}
