import { useLayoutEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, Mesh, PlaneGeometry, Quaternion, ShaderMaterial, Vector3 } from 'three';
import type { GameController } from '../controller';
import { selectAmbientPaused, selectReducedMotion } from '../state/store';
import { mulberry32 } from './layout';
import { MeteorShower } from './meteors';

/** How far ahead of the camera (u): in front of the star dome (DayNight.tsx: 66–70 u), behind the clouds. */
const METEOR_Z = -61;
const _v = new Vector3();
const _q = new Quaternion();
const Z = new Vector3(0, 0, 1);
/** The streak's width at its head (u). */
const WIDTH = 0.22;

/**
 * Shooting stars (`meteors.ts`): one thin streak, bright at its head and fading down its tail, added
 * to the scene and placed in the camera's own frame, so it's in the sky at any tilt (the planet hides
 * any that fall behind it). It's hidden by day, while ambient motion is paused
 * and under reduced motion (it's nothing but motion). In the wildlife chunk.
 */
export function ShootingStars({ controller }: { controller: GameController }) {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const { mesh, mat, shower } = useMemo(() => {
    const mat = new ShaderMaterial({
      uniforms: { uAlpha: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      // (clamped: with MSAA a varying can stray past its triangle, and pow() of a negative is NaN)
      fragmentShader:
        'uniform float uAlpha; varying vec2 vUv; void main() { float h = clamp(vUv.x, 0.0, 1.0); float across = clamp(1.0 - abs(vUv.y * 2.0 - 1.0), 0.0, 1.0); float a = (h * h + 1.6 * pow(clamp(vUv.x, 0.0, 1.0), 10.0)) * across * across * uAlpha; gl_FragColor = vec4(vec3(1.6, 1.7, 2.2) * a, a); }',
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
      toneMapped: false,
    });
    const mesh = new Mesh(new PlaneGeometry(1, 1), mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = -3;
    return { mesh, mat, shower: new MeteorShower(mulberry32(311)) };
  }, []);

  // (mounted with the scene and visible, so its program compiles with everything else; hidden from the first frame)
  useLayoutEffect(() => {
    scene.add(mesh);
    return () => {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mat.dispose();
    };
  }, [scene, mesh, mat]);

  useFrame((_, dt) => {
    const s = controller.store.getState();
    const off = selectAmbientPaused(s) || selectReducedMotion(s);
    const m = off ? null : shower.step(Math.min(dt, 0.1), controller.sky.night);
    mesh.visible = controller.meteor = Boolean(m && m.alpha > 0.01 && m.tail > 0.05);
    if (!m || !mesh.visible) return;
    mesh.position.copy(_v.set(m.x - (m.dx * m.tail) / 2, m.y - (m.dy * m.tail) / 2, METEOR_Z).applyMatrix4(camera.matrixWorld));
    mesh.quaternion.copy(camera.quaternion).multiply(_q.setFromAxisAngle(Z, Math.atan2(m.dy, m.dx)));
    mesh.scale.set(m.tail, WIDTH, 1);
    mat.uniforms.uAlpha.value = m.alpha;
  });
  return null;
}
