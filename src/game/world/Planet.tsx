import { useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, Color, IcosahedronGeometry, Vector3 } from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config';
import type { GameController } from '../controller';
import { UP, arcDistance, pointArcDistance } from '../math/sphere';
import { buildMesaCaps } from './cliffs';
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

// warm meadow greens: sunlit yellow-green drifts over a lush base, with cooler hollows
const LUSH = new Color('#8cc84c');
const SUNNY = new Color('#c0df5e');
const COOL = new Color('#6aad56');

/** Base grass colour at `u` (unit) and height `h`: large soft drifts, sunnier on rises, lusher in hollows. */
function grassColor(u: Vector3, h: number, out: Color): Color {
  const drift = valueNoise(u.x * 3.1 + 5, u.y * 3.1, u.z * 3.1 - 2);
  const drift2 = valueNoise(u.x * 7.3, u.y * 7.3 + 3, u.z * 7.3);
  out.copy(LUSH).lerp(SUNNY, Math.min(1, Math.max(0, drift * 0.9 + h * 1.2)));
  return out.lerp(COOL, Math.max(0, drift2 - 0.55) * 0.9);
}

/**
 * Append the mesa caps (cliffs.ts) to the ground: plain lawn with the same colour drifts and
 * ground attributes, so the plateau tops and the rims rolling over the cliffs are drawn by the
 * ground material in the same draw call and blend into the grass around them.
 */
function withMesaCaps(ground: BufferGeometry, caps: BufferGeometry | null): BufferGeometry {
  if (!caps) return ground;
  const n0 = ground.getAttribute('position').count;
  const n1 = caps.getAttribute('position').count;
  const cPos = caps.getAttribute('position');
  const cH = caps.getAttribute('aH');
  const u = new Vector3();
  const c = new Color();
  const col = new Float32Array(n1 * 3);
  const surf2 = new Float32Array(n1 * 4);
  for (let i = 0; i < n1; i++) {
    u.fromBufferAttribute(cPos, i).normalize();
    grassColor(u, cH.getX(i), c);
    col.set([c.r, c.g, c.b], i * 3);
    surf2[i * 4 + 3] = cH.getX(i);
  }
  const join = (name: string, capArr: Float32Array | null, size: number) => {
    const a = ground.getAttribute(name).array as Float32Array;
    const out = new Float32Array((n0 + n1) * size);
    out.set(a);
    if (capArr) out.set(capArr, n0 * size);
    return new BufferAttribute(out, size);
  };
  const g = new BufferGeometry();
  g.setAttribute('position', join('position', cPos.array as Float32Array, 3));
  g.setAttribute('normal', join('normal', caps.getAttribute('normal').array as Float32Array, 3));
  g.setAttribute('color', join('color', col, 3));
  g.setAttribute('aSurf', join('aSurf', null, 4));
  g.setAttribute('aSurf2', join('aSurf2', surf2, 4));
  g.setAttribute('aCob', join('aCob', null, 2));
  const gi = ground.getIndex()!.array;
  const ci = caps.getIndex()!.array;
  const idx = new Uint32Array(gi.length + ci.length);
  idx.set(gi);
  for (let i = 0; i < ci.length; i++) idx[gi.length + i] = ci[i] + n0;
  g.setIndex(new BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  g.userData.sphereTris = gi.length / 3;
  return g;
}

/**
 * Build the ground sphere: displaced by the terrain (hills, river bed, mesas, pond basin),
 * smooth-shaded, with per-vertex surface weights for the ground shader:
 * `aSurf` = path, plaza, cobbles, sand · `aSurf2` = riverbed, wet bank, steepness, height (u) ·
 * `aCob` = the cobbles' texture coordinates, laid flat in the plane of the building they surround.
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
  const cob = new Float32Array(count * 2);
  const v = new Vector3();
  const u = new Vector3();
  const c = new Color();
  const spawn = UP as Vector3;
  const { pond, river } = controller.props;
  const terrain = controller.terrain;
  // Per-landmark bounds: past its outer edge a band is exactly 0, so a dot product (no acos, no
  // allocation) rules most vertices out. A point farther than half the path's length (+ the band)
  // from the path's midpoint can't be within the band of any point on it.
  const PATH_OUTER = 0.46 + 0.06 + 0.2; // inner + max wobble + soft
  const marks = controller.geos.map((lm) => {
    const mid = new Vector3().addVectors(spawn, lm.n);
    if (mid.lengthSq() < 1e-12) mid.copy(lm.n);
    mid.normalize();
    const half = arcDistance(spawn, lm.n, 1) / 2;
    return { lm, mid, cosPath: Math.cos(Math.min(Math.PI, half + PATH_OUTER / R)) };
  });

  for (let i = 0; i < count; i++) {
    v.fromBufferAttribute(pos, i);
    u.copy(v).normalize();
    const rd = river ? riverDistance(river, u) : null;
    const h = terrain.height(u, rd ?? undefined);

    grassColor(u, h, c);
    colors.set([c.r, c.g, c.b], i * 3);

    const plaza = band(arcDistance(u, spawn, R), PLAZA_RADIUS_U - 0.1, 0.18);
    let path = 0;
    const wobble = 0.06 * Math.sin(u.x * 41 + u.y * 37 + u.z * 29);
    for (const { lm, mid, cosPath } of marks) {
      if (u.dot(mid) >= cosPath) path = Math.max(path, band(pointArcDistance(u, spawn, lm.n, R), 0.46 + wobble, 0.2));
    }
    // the cobbled apron round a building, following its levelled pad (pads.ts)
    const ap = terrain.apron(u);
    let cobble = ap.w;
    cob[i * 2] = ap.x;
    cob[i * 2 + 1] = ap.z;
    let sand = 0;
    if (pond) {
      const d = arcDistance(u, pond.n, R);
      const pr = terrain.pondShore(u);
      sand = band(d, pr + 0.4, 0.22) * (1 - band(d, pr - 0.35, 0.1));
    }
    let bed = 0;
    let bank = 0;
    if (river && rd) {
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
  g.setAttribute('aCob', new BufferAttribute(cob, 2));
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
  return withMesaCaps(g, buildMesaCaps(controller.props.mesas));
}

export function Planet({ controller }: { controller: GameController }) {
  const { geometry, material } = useMemo(() => {
    const geometry = buildGround(controller);
    // the blade grass (the nature chunk) grows on exactly this mesh
    controller.ground = geometry;
    return { geometry, material: createPlanetMaterial(R, PLAZA_RADIUS_U) };
  }, [controller]);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    // a tap walks; a drag tumbles the view (handled on the region) and must not walk
    if (controller.viewDragged || e.delta > CONFIG.camera.dragThresholdPx) return;
    e.stopPropagation();
    controller.walkToWorldPoint(e.point.clone());
  };

  return <mesh geometry={geometry} material={material} receiveShadow onClick={onClick} name="planet" />;
}
