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
  obstacles: Obstacle[];
  /** Discs (centre, radius u) the random props are cleared from. */
  clear: Array<{ n: Vector3; r: number }>;
}

/** Radii of the home's solid things (u). */
/**
 * The furniture and props are drawn at this scale: the family are chunky, short-legged characters
 * (Rojina's hips are about 0.38 u up), so seats sit about 0.35 u high and the table top about 0.5 u.
 */
export const PROP_SCALE = 0.72;

export const HOME_R = { house: 1.25, chair: 0.22, table: 0.46, fire: 0.42, log: 0.25, post: 0.1, tree: 0.42 } as const;

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

  const house = spot(245, 5.6);
  const door = { n: beside(house, 0, HOME_R.house + 0.3), facing: house.facing.clone() };
  // on the lawn in front of the house, a little to one side of the door, facing the pond
  const chairN = beside(house, -8, 2.1);
  const readingChair = { n: chairN, facing: facingTo(chairN, pond.n) };
  const sideTable = { n: beside(readingChair, 90, 0.4), facing: readingChair.facing.clone() };
  const table = spot(211, 3.7);
  // the table runs along the shore; a chair on each long side, facing it
  // a chair on each long side and one at the end (one each for the family), facing it
  const tableChairs = (
    [
      [90, 0.46],
      [-90, 0.46],
      [0, 0.8],
    ] as const
  ).map(([deg, u]) => {
    const n = beside(table, deg, u);
    return { n, facing: facingTo(n, table.n) };
  });
  const mat = spot(186, 3.55);
  const fire = spot(272, 4.35);
  const campChairs = [150, 215].map((deg) => {
    const n = beside(fire, deg, 0.8);
    return { n, facing: facingTo(n, fire.n) };
  });
  const logN = beside(fire, 330, 0.8);
  const log = { n: logN, facing: facingTo(logN, fire.n) };
  const tree = at(178, 5.5);
  const treeSeatN = moveAlong(tree, facingTo(tree, pond.n), (HOME_R.tree + 0.25) / R);
  const treeSeat = { n: treeSeatN, facing: facingTo(treeSeatN, pond.n) };
  const shore = spot(206, pond.radiusU + 0.75);
  const lightsPost = beside(table, 200, 1.1);
  const centre = at(228, 4.3);

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
  ];
  return { centre, range: 7, house, door, readingChair, sideTable, table, tableChairs, mat, fire, campChairs, log, tree, treeSeat, shore, lightsPost, obstacles, clear };
}
