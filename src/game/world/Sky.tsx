import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from 'zustand';
import { InstancedBufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import type { GameController } from '../controller';
import { selectAmbientPaused } from '../state/store';
import { mulberry32 } from './layout';
import { cloud } from './propModels';
import { CLOUD_BAND, CLOUD_COUNT, CLOUD_SPAN, cloudFade } from './clouds';

let cloudMat: MeshStandardMaterial | null = null;

/** Shared cloud material (tinted by the day–night cycle), with a per-instance fade (`aFade`, 0…1). */
export function cloudMaterial(): MeshStandardMaterial {
  if (cloudMat) return cloudMat;
  cloudMat = new MeshStandardMaterial({ vertexColors: true, roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.35, fog: false, transparent: true });
  cloudMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aFade;\nvarying float vFade;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFade = aFade;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vFade;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vFade;');
  };
  return cloudMat;
}

/** Puffy clouds in the sky band behind the planet (world space, drift slowly). */
export function Clouds({ controller }: { controller: GameController }) {
  const paused = useStore(controller.store, selectAmbientPaused);
  const ref = useRef<InstancedMesh>(null);
  const { geo, mat, items } = useMemo(() => {
    const rand = mulberry32(11);
    const geo = cloud();
    geo.setAttribute('aFade', new InstancedBufferAttribute(new Float32Array(CLOUD_COUNT).fill(1), 1));
    return {
      geo,
      mat: cloudMaterial(),
      items: Array.from({ length: CLOUD_COUNT }, (_, i) => ({
        x: -CLOUD_SPAN / 2 + (CLOUD_SPAN / CLOUD_COUNT) * i + rand() * 3,
        y: CLOUD_BAND.y[0] + rand() * (CLOUD_BAND.y[1] - CLOUD_BAND.y[0]),
        z: CLOUD_BAND.z[1] - rand() * (CLOUD_BAND.z[1] - CLOUD_BAND.z[0]),
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
    const fade = geo.getAttribute('aFade') as InstancedBufferAttribute;
    items.forEach((c, i) => {
      m.compose(new Vector3(c.x, c.y, c.z), q, new Vector3(c.s, c.s, c.s));
      mesh.setMatrixAt(i, m);
      fade.setX(i, cloudFade(c.x));
    });
    mesh.instanceMatrix.needsUpdate = true;
    fade.needsUpdate = true;
  };
  useLayoutEffect(write);
  useFrame((_, dt) => {
    if (paused) return;
    for (const c of items) {
      c.x += c.speed * dt;
      // wraps only where it has faded to nothing
      if (c.x > CLOUD_SPAN / 2) c.x -= CLOUD_SPAN;
    }
    write();
  });

  return <instancedMesh ref={ref} args={[geo, mat, CLOUD_COUNT]} frustumCulled={false} renderOrder={-1} />;
}
