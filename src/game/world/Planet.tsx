import { useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { BufferAttribute, Color, IcosahedronGeometry, Vector3, type BufferGeometry } from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config';
import type { GameController } from '../controller';
import { UP, arcDistance, pointArcDistance } from '../math/sphere';
import { PLAZA_RADIUS_U } from './layout';
import { createPlanetMaterial } from './planetMaterial';

const R = CONFIG.planetRadius;

function band(d: number, inner: number, soft: number): number {
  return 1 - Math.min(1, Math.max(0, (d - inner) / soft));
}

/** Build the ground sphere: smooth-shaded, with per-vertex surface weights and a pond basin. */
function buildGround(controller: GameController): BufferGeometry {
  let g: BufferGeometry = new IcosahedronGeometry(R, 44);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g);
  const pos = g.getAttribute('position');
  const count = pos.count;
  const colors = new Float32Array(count * 3);
  const surf = new Float32Array(count * 4);
  const v = new Vector3();
  const u = new Vector3();
  const grass = new Color('#93cf5a');
  const grassWarm = new Color('#a3d35f');
  const spawn = UP as Vector3;
  const pond = controller.props.pond;

  for (let i = 0; i < count; i++) {
    v.fromBufferAttribute(pos, i);
    u.copy(v).normalize();
    // gentle warm/cool drift in the base grass colour
    const t = 0.5 + 0.5 * Math.sin(u.x * 3.1 + u.z * 2.3) * Math.cos(u.y * 2.7);
    const c = grass.clone().lerp(grassWarm, t);
    colors.set([c.r, c.g, c.b], i * 3);

    const plaza = band(arcDistance(u, spawn, R), PLAZA_RADIUS_U - 0.1, 0.18);
    let cobble = 0;
    let path = 0;
    for (const lm of controller.geos) {
      cobble = Math.max(cobble, band(arcDistance(u, lm.n, R), lm.footprintU + 0.5, 0.16));
      const wobble = 0.06 * Math.sin(u.x * 41 + u.y * 37 + u.z * 29);
      path = Math.max(path, band(pointArcDistance(u, spawn, lm.n, R), 0.46 + wobble, 0.14));
    }
    let sand = 0;
    let depth = 0;
    if (pond) {
      const d = arcDistance(u, pond.n, R);
      sand = band(d, pond.radiusU + 0.45, 0.2) * (1 - band(d, pond.radiusU - 0.25, 0.1));
      depth = band(d, pond.radiusU - 0.15, 0.35);
    }
    const inPlaza = plaza;
    cobble *= 1 - inPlaza;
    path *= (1 - inPlaza) * (1 - cobble);
    sand *= 1 - inPlaza;
    surf.set([path, inPlaza, cobble, sand], i * 4);
    if (depth > 0) {
      v.multiplyScalar((R - 0.22 * depth) / R);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
  }
  g.setAttribute('color', new BufferAttribute(colors, 3));
  g.setAttribute('aSurf', new BufferAttribute(surf, 4));
  g.computeVertexNormals();
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
