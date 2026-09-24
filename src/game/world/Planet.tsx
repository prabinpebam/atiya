import { useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { BufferAttribute, Color, IcosahedronGeometry, Vector3, type BufferGeometry } from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config';
import type { GameController } from '../controller';
import { UP, arcDistance, pointArcDistance } from '../math/sphere';
import { riverDistance } from './features';
import { PLAZA_RADIUS_U } from './layout';
import { createPlanetMaterial } from './planetMaterial';
import { valueNoise } from './terrain';

const R = CONFIG.planetRadius;
/** Icosphere subdivision: ≈ 0.21 u between vertices, fine enough for the rolling hills and river banks. */
export const GROUND_DETAIL = 56;

function band(d: number, inner: number, soft: number): number {
  return 1 - Math.min(1, Math.max(0, (d - inner) / soft));
}


function smooth(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * Build the ground sphere: displaced by the terrain (hills, river bed, mesas, pond basin),
 * smooth-shaded, with per-vertex surface weights for the ground shader:
 * `aSurf` = path, plaza, cobbles, sand · `aSurf2` = riverbed, wet bank, steepness, height (u).
 */
function buildGround(controller: GameController): BufferGeometry {
  let g: BufferGeometry = new IcosahedronGeometry(R, GROUND_DETAIL);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g);
  const pos = g.getAttribute('position');
  const count = pos.count;
  const colors = new Float32Array(count * 3);
  const surf = new Float32Array(count * 4);
  const surf2 = new Float32Array(count * 4);
  const v = new Vector3();
  const u = new Vector3();
  const lush = new Color('#86c653');
  const sunny = new Color('#a9d862');
  const cool = new Color('#7fc06a');
  const c = new Color();
  const spawn = UP as Vector3;
  const { pond, river } = controller.props;
  const terrain = controller.terrain;

  for (let i = 0; i < count; i++) {
    v.fromBufferAttribute(pos, i);
    u.copy(v).normalize();
    const h = terrain.height(u);

    // base grass: large soft colour drifts, sunnier on rises, lusher in hollows
    const drift = valueNoise(u.x * 3.1 + 5, u.y * 3.1, u.z * 3.1 - 2);
    const drift2 = valueNoise(u.x * 7.3, u.y * 7.3 + 3, u.z * 7.3);
    c.copy(lush).lerp(sunny, Math.min(1, Math.max(0, drift * 0.9 + h * 1.2)));
    c.lerp(cool, Math.max(0, drift2 - 0.55) * 0.9);
    colors.set([c.r, c.g, c.b], i * 3);

    const plaza = band(arcDistance(u, spawn, R), PLAZA_RADIUS_U - 0.1, 0.18);
    let cobble = 0;
    let path = 0;
    for (const lm of controller.geos) {
      cobble = Math.max(cobble, band(arcDistance(u, lm.n, R), lm.footprintU + 0.5, 0.16));
      const wobble = 0.06 * Math.sin(u.x * 41 + u.y * 37 + u.z * 29);
      path = Math.max(path, band(pointArcDistance(u, spawn, lm.n, R), 0.46 + wobble, 0.2));
    }
    let sand = 0;
    if (pond) {
      const d = arcDistance(u, pond.n, R);
      const pr = terrain.pondShore(u);
      sand = band(d, pr + 0.4, 0.22) * (1 - band(d, pr - 0.35, 0.1));
    }
    let bed = 0;
    let bank = 0;
    if (river) {
      const rd = riverDistance(river, u);
      const hw = river.halfWidth[rd.i];
      bed = 1 - smooth(hw * 0.75, hw + 0.12, rd.d);
      bank = (1 - smooth(hw + 0.1, hw + 0.75, rd.d)) * (1 - bed);
    }
    const inPlaza = plaza;
    cobble *= 1 - inPlaza;
    path *= (1 - inPlaza) * (1 - cobble) * (1 - bed);
    sand *= 1 - inPlaza;
    surf.set([path, inPlaza, cobble, sand], i * 4);
    surf2.set([bed, bank, 0, h], i * 4);

    // the terrain includes the carved river bed and pond bowl
    const r = R + h;
    v.copy(u).multiplyScalar(r);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.setAttribute('color', new BufferAttribute(colors, 3));
  g.setAttribute('aSurf', new BufferAttribute(surf, 4));
  g.computeVertexNormals();

  // steepness (0 flat … 1 cliff) from the displaced normals: cliffs and banks get rock/earth
  const nor = g.getAttribute('normal');
  const n = new Vector3();
  for (let i = 0; i < count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    n.fromBufferAttribute(nor, i);
    surf2[i * 4 + 2] = smooth(0.12, 0.45, 1 - n.dot(v));
  }
  g.setAttribute('aSurf2', new BufferAttribute(surf2, 4));
  return g;
}

export function Planet({ controller }: { controller: GameController }) {
  const { geometry, material } = useMemo(() => ({ geometry: buildGround(controller), material: createPlanetMaterial(R) }), [controller]);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    // a tap walks; a drag tumbles the view (handled on the region) and must not walk
    if (controller.viewDragged || e.delta > CONFIG.camera.dragThresholdPx) return;
    e.stopPropagation();
    controller.walkToWorldPoint(e.point.clone());
  };

  return <mesh geometry={geometry} material={material} receiveShadow onClick={onClick} name="planet" />;
}
