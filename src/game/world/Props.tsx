import { useLayoutEffect, useMemo, useRef } from 'react';
import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three';
import { CONFIG } from '../config';
import type { PropInstance } from './layout';
import { PALETTE, toon } from './materials';

const R = CONFIG.planetRadius;
const Y = new Vector3(0, 1, 0);

function writeInstances(mesh: InstancedMesh, items: readonly PropInstance[], colorFor?: (p: PropInstance) => Color) {
  const m = new Matrix4();
  const q = new Quaternion();
  const yaw = new Quaternion();
  const s = new Vector3();
  const p = new Vector3();
  items.forEach((it, i) => {
    q.setFromUnitVectors(Y, it.n);
    yaw.setFromAxisAngle(Y, it.yaw);
    q.multiply(yaw);
    p.copy(it.n).multiplyScalar(R - 0.02);
    s.setScalar(it.scale);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
    if (colorFor) mesh.setColorAt(i, colorFor(it));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
}

function useInstances(items: readonly PropInstance[], colorFor?: (p: PropInstance) => Color) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    if (ref.current) writeInstances(ref.current, items, colorFor);
  }, [items, colorFor]);
  return ref;
}

const FLOWER_COLORS = ['#ffd84d', '#ff8fb1', '#ffffff', '#b99cff'].map((c) => new Color(c));
const LEAF_COLORS = [PALETTE.leaf, PALETTE.leafAlt, '#5cae4f'].map((c) => new Color(c));
const ROCK_COLORS = [PALETTE.rock, '#9a9aa5', '#b8b6bf'].map((c) => new Color(c));
const WHITE = new Color('#ffffff');

export function Props({ trees, rocks, flowers }: { trees: PropInstance[]; rocks: PropInstance[]; flowers: PropInstance[] }) {
  const geo = useMemo(
    () => ({
      trunk: new CylinderGeometry(0.12, 0.17, 0.7, 6).translate(0, 0.35, 0),
      canopy: new ConeGeometry(0.62, 1.15, 7).translate(0, 1.1, 0),
      canopyTop: new ConeGeometry(0.45, 0.85, 7).translate(0, 1.65, 0),
      rock: new DodecahedronGeometry(0.5, 0).translate(0, 0.15, 0),
      flower: new IcosahedronGeometry(0.09, 0).translate(0, 0.1, 0),
    }),
    [],
  );
  const leaf = useMemo(() => (p: PropInstance) => LEAF_COLORS[Math.floor(p.tint * LEAF_COLORS.length)], []);
  const rockColor = useMemo(() => (p: PropInstance) => ROCK_COLORS[Math.floor(p.tint * ROCK_COLORS.length)], []);
  const flowerColor = useMemo(() => (p: PropInstance) => FLOWER_COLORS[Math.floor(p.tint * FLOWER_COLORS.length)], []);

  const trunkRef = useInstances(trees);
  const canopyRef = useInstances(trees, leaf);
  const canopyTopRef = useInstances(trees, leaf);
  const rockRef = useInstances(rocks, rockColor);
  const flowerRef = useInstances(flowers, flowerColor);

  return (
    <group name="props">
      <instancedMesh ref={trunkRef} args={[geo.trunk, toon(PALETTE.trunk), trees.length]} castShadow />
      <instancedMesh ref={canopyRef} args={[geo.canopy, toon(WHITE, 'leaf-white'), trees.length]} castShadow />
      <instancedMesh ref={canopyTopRef} args={[geo.canopyTop, toon(WHITE, 'leaf-white'), trees.length]} castShadow />
      <instancedMesh ref={rockRef} args={[geo.rock, toon(WHITE, 'rock-white'), rocks.length]} castShadow receiveShadow />
      <instancedMesh ref={flowerRef} args={[geo.flower, toon(WHITE, 'flower-white'), flowers.length]} />
    </group>
  );
}
