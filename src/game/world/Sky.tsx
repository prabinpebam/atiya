import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from 'zustand';
import { InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import type { GameController } from '../controller';
import { selectAmbientPaused } from '../state/store';
import { mulberry32 } from './layout';
import { cloud } from './propModels';

const COUNT = 9;
const SPAN = 64;

let cloudMat: MeshStandardMaterial | null = null;

/** Shared cloud material (tinted by the day–night cycle). */
export function cloudMaterial(): MeshStandardMaterial {
  cloudMat ??= new MeshStandardMaterial({ vertexColors: true, roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.35, fog: false });
  return cloudMat;
}

/** Puffy clouds in the sky band behind the planet (world space, drift slowly). */
export function Clouds({ controller }: { controller: GameController }) {
  const paused = useStore(controller.store, selectAmbientPaused);
  const ref = useRef<InstancedMesh>(null);
  const { geo, mat, items } = useMemo(() => {
    const rand = mulberry32(11);
    return {
      geo: cloud(),
      mat: cloudMaterial(),
      items: Array.from({ length: COUNT }, (_, i) => ({
        x: -SPAN / 2 + (SPAN / COUNT) * i + rand() * 3,
      y: -10 + rand() * 8,
      z: -30 - rand() * 8,
      s: 1.0 + rand() * 1.1,
        speed: 0.12 + rand() * 0.12,
      })),
    };
  }, []);

  const m = useMemo(() => new Matrix4(), []);
  const q = useMemo(() => new Quaternion(), []);
  const write = () => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((c, i) => {
      m.compose(new Vector3(c.x, c.y, c.z), q, new Vector3(c.s, c.s, c.s));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  useLayoutEffect(write);
  useFrame((_, dt) => {
    if (paused) return;
    for (const c of items) {
      c.x += c.speed * dt;
      if (c.x > SPAN / 2) c.x -= SPAN;
    }
    write();
  });

  return <instancedMesh ref={ref} args={[geo, mat, COUNT]} frustumCulled={false} renderOrder={-1} />;
}
