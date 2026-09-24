import { Quaternion, Matrix4, Vector3 } from 'three';
import { CONFIG } from '../config';
import type { LandmarkData } from '../types';
import {
  DEG,
  UP,
  angleBetween,
  arcDistance,
  latLonToVec,
  localNorth,
  moveAlong,
  orientationFor,
  rotateTangent,
  tangentToward,
  type Obstacle,
} from './sphere';

export interface LandmarkGeometry {
  id: string;
  order: number;
  /** Planet-local unit centre. */
  n: Vector3;
  /** Planet-local unit tangent the door faces. */
  door: Vector3;
  /** Planet-local unit approach point (in front of the door). */
  approach: Vector3;
  footprintU: number;
  enterU: number;
  exitU: number;
}

export function landmarkGeometry(l: LandmarkData, cfg = CONFIG): LandmarkGeometry {
  const n = latLonToVec(l.lat, l.lon);
  const door = rotateTangent(localNorth(n), n, l.modelYawDeg * DEG);
  const approach = moveAlong(n, door, l.approachDistanceU / cfg.planetRadius);
  const enterU = l.footprintU + cfg.proximityPadding;
  return { id: l.id, order: l.order, n, door, approach, footprintU: l.footprintU, enterU, exitU: enterU * cfg.exitFactor };
}

/** Object orientation for placing a landmark: local +Y = surface normal, local +Z = door direction. */
export function landmarkObjectQuaternion(g: LandmarkGeometry, out = new Quaternion()): Quaternion {
  const x = new Vector3().crossVectors(g.n, g.door);
  return out.setFromRotationMatrix(new Matrix4().makeBasis(x, g.n, g.door));
}

/** Planet orientation that puts the player on the approach point, facing the landmark (screen-up). */
export function arrivalOrientation(g: LandmarkGeometry, out = new Quaternion()): Quaternion {
  const toward = tangentToward(g.approach, g.n) ?? g.door.clone().negate();
  return orientationFor(g.approach, toward, out);
}

/** Minimum clearance (world units) between a great-circle segment and an obstacle's expanded radius. */
export function segmentClearance(a: Vector3, b: Vector3, o: Obstacle, cfg = CONFIG): number {
  const total = arcDistance(a, b, cfg.planetRadius);
  const dir = tangentToward(a, b);
  const steps = Math.max(1, Math.ceil(total / 0.05));
  const expandedU = o.radiusU + cfg.playerRadius + cfg.skin;
  let min = Infinity;
  for (let i = 0; i <= steps; i++) {
    const p = dir ? moveAlong(a, dir, (total / cfg.planetRadius) * (i / steps)) : a;
    min = Math.min(min, arcDistance(p, o.n, cfg.planetRadius) - expandedU);
  }
  return min;
}

/** Cross-entry content validation (spec §5.6). Returns human-readable errors; empty = valid. */
export function validateLandmarks(list: readonly LandmarkData[], cfg = CONFIG): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const geos = list.map((l) => landmarkGeometry(l, cfg));
  const spawn = UP as Vector3;

  for (const l of list) {
    if (ids.has(l.id)) errors.push(`${l.id}: duplicate id`);
    ids.add(l.id);
    if (Math.abs(l.lat) > 85) errors.push(`${l.id}: |lat| must be ≤ 85`);
  }

  geos.forEach((g, i) => {
    const ownExpanded = g.footprintU + cfg.playerRadius + cfg.skin;
    const ownDist = arcDistance(g.approach, g.n, cfg.planetRadius);
    if (ownDist <= ownExpanded) errors.push(`${g.id}: approach point is inside its own collider`);
    if (ownDist >= g.enterU) errors.push(`${g.id}: approach point is outside its enter radius`);

    const spawnArc = arcDistance(spawn, g.approach, cfg.planetRadius);
    if (spawnArc > cfg.maxSpawnArcU) errors.push(`${g.id}: approach is ${spawnArc.toFixed(2)} u from spawn (max ${cfg.maxSpawnArcU})`);

    geos.forEach((o, j) => {
      if (i === j) return;
      const obstacle: Obstacle = { n: o.n, radiusU: o.footprintU };
      if (j > i) {
        const gap = arcDistance(g.n, o.n, cfg.planetRadius) - g.footprintU - o.footprintU;
        if (gap < cfg.minFootprintGapU) errors.push(`${g.id}/${o.id}: footprints only ${gap.toFixed(2)} u apart (min ${cfg.minFootprintGapU})`);
      }
      const expanded = o.footprintU + cfg.playerRadius + cfg.skin;
      if (arcDistance(g.approach, o.n, cfg.planetRadius) <= expanded) errors.push(`${g.id}: approach point is inside ${o.id}'s collider`);
      if (segmentClearance(spawn, g.approach, obstacle, cfg) <= 0) errors.push(`${g.id}: route from spawn is blocked by ${o.id}`);
    });

    if (angleBetween(spawn, g.n) * cfg.planetRadius < g.footprintU + 3) errors.push(`${g.id}: overlaps the spawn plaza`);
  });

  return errors;
}
