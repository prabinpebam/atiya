/**
 * The owner's home by the pond (docs: family.md §2): where the house, the campsite, the picnic
 * spot and the family's favourite places stand. Pure: a polar plan round the pond's centre (angle
 * from its local north, distance in u), laid out after the random props so nothing else on the
 * planet moves; whatever was in the way is cleared by `generateProps`.
 */
import { Vector3 } from 'three';
import { CONFIG } from '../config';
import { moveAlong, tangentToward, type Obstacle } from '../math/sphere';
import type { Pond } from './layout';

export interface HomeSpot {
  n: Vector3;
  /** The tangent its front faces. */
  facing: Vector3;
}

export interface Homestead {
  /** Roughly the middle of the home ground (the family stays within `range` of it). */
  centre: Vector3;
  range: number;
  house: HomeSpot;
  /** The front door's step (where Rojina fetches the picnic from). */
  door: HomeSpot;
  readingChair: HomeSpot;
  sideTable: HomeSpot;
  table: HomeSpot;
  tableChairs: HomeSpot[];
  mat: HomeSpot;
  fire: HomeSpot;
  campChairs: HomeSpot[];
  log: HomeSpot;
  /** Laija's reading tree (a hardwood added to the layout) and where she sits against it. */
  tree: Vector3;
  treeSeat: HomeSpot;
  /** Where Laija stands to throw pebbles, facing the water. */
  shore: HomeSpot;
  /** The string lights' far post. */
  lightsPost: Vector3;
  /** Where Chopper's house goes (crafting.md): beside the family's house, facing the pond. */
  dogHouse: HomeSpot;
  /** The bench on the pond's bank, facing the water: the visitor and the family sit there and feed the ducks. */
  pondBench: HomeSpot;
  /** Round the house (the lived-in touches): the back yard's fence and vegetable beds, the tulsi in front, the woodpile. */
  yard: Yard;
  obstacles: Obstacle[];
  /** Discs (centre, radius u) the random props are cleared from. */
  clear: Array<{ n: Vector3; r: number }>;
}

/** The back yard and the house's surroundings (all facing the way the house does). */
export interface Yard {
  /** The fence's line behind the house (a U, open toward the house's sides). */
  fence: Vector3[];
  /** The vegetable beds: cabbages, then tomatoes. */
  beds: HomeSpot[];
  wateringCan: HomeSpot;
  /** The tulsi planter (tulsi vrindavan) on its own round cobbled spot in front of the house, its diya's niche toward the house. */
  tulsi: HomeSpot;
  /** Firewood stacked against the house's side wall. */
  woodpile: HomeSpot;
}

/** Yard sizes (u): the beds' length and width, the fence's post spacing. */
export const YARD = { bedL: 1.25, bedW: 0.55, postGap: 0.5 } as const;

/**
 * The tulsi's own round cobbled spot in front of the house, on the door's axis (u): its centre this
 * far in front of the house's centre, the flat ground's and the cobbles' radii round it.
 */
export const TULSI_SPOT = { fwd: 3.1, flat: 0.32, cobbles: 0.6 } as const;

/** The bench by the pond (feeding the ducks): how far beyond the pond's nominal radius it stands (u), and the side of it the family sit on (u along the bench; the visitor takes the other). */
export const POND_BENCH = { out: 1.45, side: 0.28 } as const;
/** Where round the pond it stands (degrees from the pond's local north, as in the plan below). */
const POND_BENCH_DEG = 260;

/** Radii of the home's solid things (u). */
/**
 * The furniture and props are drawn at this scale: the family are chunky, short-legged characters
 * (Rojina's hips are about 0.38 u up), so seats sit about 0.35 u high and the table top about 0.5 u.
 */
export const PROP_SCALE = 0.72;

export const HOME_R = { house: 1.25, chair: 0.22, table: 0.46, fire: 0.42, log: 0.25, post: 0.1, tree: 0.42, dogHouse: 0.7 } as const;

export function homesteadLayout(pond: Pond, cfg = CONFIG): Homestead {
  const R = cfg.planetRadius;
  const north = tangentToward(pond.n, new Vector3(0, 1, 0)) ?? new Vector3(1, 0, 0);
  const east = new Vector3().crossVectors(north, pond.n).normalize();
  const at = (deg: number, u: number) => {
    const a = (deg * Math.PI) / 180;
    return moveAlong(pond.n, north.clone().multiplyScalar(Math.cos(a)).addScaledVector(east, Math.sin(a)), u / R);
  };
  const facingTo = (n: Vector3, target: Vector3) => tangentToward(n, target) ?? north.clone();
  const spot = (deg: number, u: number, look: Vector3 = pond.n): HomeSpot => {
    const n = at(deg, u);
    return { n, facing: facingTo(n, look) };
  };
  /** A spot `u` from `from` toward the tangent `dir` turned by `deg`. */
  const beside = (from: HomeSpot, deg: number, u: number): Vector3 => {
    const a = (deg * Math.PI) / 180;
    const side = new Vector3().crossVectors(from.n, from.facing).normalize();
    const d = from.facing.clone().multiplyScalar(Math.cos(a)).addScaledVector(side, Math.sin(a));
    return moveAlong(from.n, d, u / R);
  };

  // (spread out round the pond, with room to walk between everything: prabin-npc.md §4.8)
  const house = spot(215, 6.5);
  const door = { n: beside(house, 0, HOME_R.house + 0.3), facing: house.facing.clone() };
  // on the lawn beside the house (off the path from its door), facing the pond
  const chairN = beside(house, 62, 3.6);
  const readingChair = { n: chairN, facing: facingTo(chairN, pond.n) };
  const sideTable = { n: beside(readingChair, 90, 0.4), facing: readingChair.facing.clone() };
  const table = spot(170, 5.0);
  // the table runs along the shore: a chair on each long side and one at each end (one each for
  // Rojina, Laija, Lingjel and Prabin), facing it
  const tableChairs = (
    [
      [90, 0.46],
      [-90, 0.46],
      [0, 0.8],
      [180, 0.8],
    ] as const
  ).map(([deg, u]) => {
    const n = beside(table, deg, u);
    return { n, facing: facingTo(n, table.n) };
  });
  const mat = spot(133, 4.7);
  const fire = spot(266, 6.0);
  const campChairs = [150, 215].map((deg) => {
    const n = beside(fire, deg, 0.8);
    return { n, facing: facingTo(n, fire.n) };
  });
  const logN = beside(fire, 330, 0.8);
  const log = { n: logN, facing: facingTo(logN, fire.n) };
  const tree = at(106, 6.2);
  const treeSeatN = moveAlong(tree, facingTo(tree, pond.n), (HOME_R.tree + 0.25) / R);
  const treeSeat = { n: treeSeatN, facing: facingTo(treeSeatN, pond.n) };
  const shore = spot(185, pond.radiusU + 0.75);
  // the string lights' far post: between the table and the house, beside the table
  const lightsPost = moveAlong(table.n, tangentToward(table.n, house.n)!.applyAxisAngle(table.n, 0.35), 1.3 / R);
  // beside the house and a little behind it, on the table's side, facing the pond
  const dogN = beside(house, -108, 3.4);
  const dogHouse = { n: dogN, facing: facingTo(dogN, pond.n) };
  const centre = at(185, 4.6);
  // the bench by the pond, on the bank between the house and the water, facing the water (feeding the ducks)
  const benchN = at(POND_BENCH_DEG, pond.radiusU + POND_BENCH.out);
  const pondBench = { n: benchN, facing: facingTo(benchN, pond.n) };

  // round the house (in its own frame: `fwd` toward the pond, `side` to its left): the back yard, the
  // tulsi, the woodpile
  const around = (fwd: number, sideU: number): Vector3 => beside(house, (Math.atan2(sideU, fwd) * 180) / Math.PI, Math.hypot(fwd, sideU));
  const facingHouse = (n: Vector3) => house.facing.clone().addScaledVector(n, -house.facing.dot(n)).normalize();
  const yardSpot = (fwd: number, sideU: number): HomeSpot => {
    const n = around(fwd, sideU);
    return { n, facing: facingHouse(n) };
  };
  // a low fence round the back of the garden, open toward the house; its arm on the table's side is
  // shorter, leaving the way round the dog house open
  const fence = [around(-2.75, -2.3), around(-3.8, -2.3), around(-3.8, 2.3), around(-1.9, 2.3)];
  const tulsiN = around(TULSI_SPOT.fwd, 0);
  const yard: Yard = {
    fence,
    beds: [yardSpot(-2.8, -1.05), yardSpot(-2.8, 1.05)],
    wateringCan: yardSpot(-2.3, 0.05),
    tulsi: { n: tulsiN, facing: facingTo(tulsiN, house.n) },
    woodpile: yardSpot(-0.25, 1.5),
  };

  const obstacles: Obstacle[] = [
    { n: house.n, radiusU: HOME_R.house },
    { n: readingChair.n, radiusU: HOME_R.chair },
    { n: sideTable.n, radiusU: 0.13 },
    // the table is long and narrow: two circles along its length, so the chairs at its sides stay reachable
    ...[-1, 1].map((s) => ({ n: moveAlong(table.n, table.facing, (s * 0.24) / R), radiusU: 0.3 })),
    ...tableChairs.map((c) => ({ n: c.n, radiusU: HOME_R.chair })),
    { n: fire.n, radiusU: HOME_R.fire },
    ...campChairs.map((c) => ({ n: c.n, radiusU: HOME_R.chair })),
    { n: log.n, radiusU: HOME_R.log },
    { n: lightsPost, radiusU: HOME_R.post },
    // the yard: the fence's posts (you walk round it, not through), the beds, the tulsi and the woodpile
    ...fencePosts(fence, YARD.postGap, R).map((n) => ({ n, radiusU: 0.06 })),
    ...yard.beds.flatMap((b) => [-1, 1].map((s) => ({ n: moveAlong(b.n, new Vector3().crossVectors(b.n, b.facing).normalize(), (s * YARD.bedL * 0.27) / R), radiusU: YARD.bedW * 0.55 }))),
    { n: yard.tulsi.n, radiusU: 0.22 },
    { n: yard.woodpile.n, radiusU: 0.26 },
  ];
  const clear = [
    { n: house.n, r: HOME_R.house + 0.9 },
    { n: readingChair.n, r: 0.9 },
    { n: table.n, r: 1.5 },
    { n: mat.n, r: 1.1 },
    { n: fire.n, r: 1.7 },
    { n: tree, r: 1.3 },
    { n: shore.n, r: 0.7 },
    { n: lightsPost, r: 0.4 },
    { n: dogN, r: 1.5 },
    // the lawn in front of the door (a clear way out of the house) and the open ground in the middle
    { n: beside(house, 0, HOME_R.house + 1.9), r: 1.5 },
    { n: centre, r: 2.4 },
    // the back yard, the tulsi's spot, and the tall cedar that stood right in front of the house as you
    // come to it from the table (it hid the door)
    { n: around(-2.9, 0), r: 2.6 },
    { n: yard.tulsi.n, r: TULSI_SPOT.cobbles + 0.4 },
    { n: around(-1.8, -4.4), r: 1.1 },
    { n: pondBench.n, r: 1.3 },
  ];
  return { centre, range: 8.5, yard, house, door, readingChair, sideTable, table, tableChairs, mat, fire, campChairs, log, tree, treeSeat, shore, lightsPost, dogHouse, pondBench, obstacles, clear };
}

/** Posts along a polyline, about `gap` u apart (both ends included). */
export function fencePosts(line: readonly Vector3[], gap: number, R: number): Vector3[] {
  const out: Vector3[] = [];
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i];
    const b = line[i + 1];
    const len = a.angleTo(b) * R;
    const n = Math.max(1, Math.round(len / gap));
    for (let k = i ? 1 : 0; k <= n; k++) out.push(a.clone().lerp(b, k / n).normalize());
  }
  return out;
}
