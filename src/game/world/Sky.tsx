import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useStore } from 'zustand';
import { InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import type { GameController } from '../controller';
import { selectAmbientPaused } from '../state/store';
import { cloud } from './propModels';
import { CLOUD_COUNT, cloudLayout, cloudOrientation, cloudPosition, driftClouds, ringFrame } from './clouds';

let cloudMat: MeshStandardMaterial | null = null;

/** Shared cloud material (tinted by the day–night cycle). */
export function cloudMaterial(): MeshStandardMaterial {
  if (cloudMat) return cloudMat;
  cloudMat = new MeshStandardMaterial({ vertexColors: true, roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.35, fog: false });
  return cloudMat;
}

/**
 * Puffy clouds orbiting the planet on a ring concentric with it on screen (`world/clouds.ts`):
 * they drift clockwise round the planet's outline, over the top from left to right. The rings
 * follow the camera every frame, so they stay concentric at any tilt and during fly-overs.
 */
export function Clouds({ controller }: { controller: GameController }) {
  const paused = useStore(controller.store, selectAmbientPaused);
  const camera = useThree((st) => st.camera);
  const ref = useRef<InstancedMesh>(null);
  const { geo, mat, items } = useMemo(() => ({ geo: cloud(), mat: cloudMaterial(), items: cloudLayout() }), []);

  const frame = useMemo(() => ringFrame(new Vector3(0, 1, 1)), []);
  const m = useMemo(() => new Matrix4(), []);
  const q = useMemo(() => new Quaternion(), []);
  const p = useMemo(() => new Vector3(), []);
  const sc = useMemo(() => new Vector3(), []);
  const write = () => {
    const mesh = ref.current;
    if (!mesh) return;
    ringFrame(camera.position, frame);
    for (let i = 0; i < items.length; i++) {
      const c = items[i];
      cloudPosition(frame, c.theta, c.alpha, c.dist, p);
      cloudOrientation(frame, c.theta, q);
      mesh.setMatrixAt(i, m.compose(p, q, sc.setScalar(c.scale)));
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  useLayoutEffect(write);
  // follows the camera every frame (tilt, fly-overs); only the drift stops when ambient motion is paused
  useFrame((_, dt) => {
    if (!paused) driftClouds(items, dt);
    write();
  });

  return <instancedMesh ref={ref} args={[geo, mat, CLOUD_COUNT]} frustumCulled={false} renderOrder={-1} />;
}
