import { useLayoutEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, Mesh, PlaneGeometry, ShaderMaterial } from 'three';
import type { GameController } from '../controller';
import { selectAmbientPaused, selectReducedMotion } from '../state/store';
import { mulberry32 } from './layout';
import { MeteorShower } from './meteors';

/** Just in front of the stars (DayNight.tsx scatters them 62–68 u back), inside the camera's far plane. */
const METEOR_Z = -61;
/** The streak's width at its head (u). */
const WIDTH = 0.22;

/**
 * Shooting stars (`meteors.ts`): one thin streak, bright at its head and fading down its tail, added
 * to the scene in the camera frame with the sky. It's hidden by day, while ambient motion is paused
 * and under reduced motion (it's nothing but motion). In the wildlife chunk.
 */
export function ShootingStars({ controller }: { controller: GameController }) {
  const scene = useThree((s) => s.scene);
  const { mesh, mat, shower } = useMemo(() => {
    const mat = new ShaderMaterial({
      uniforms: { uAlpha: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      // (clamped: with MSAA a varying can stray past its triangle, and pow() of a negative is NaN)
      fragmentShader:
        'uniform float uAlpha; varying vec2 vUv; void main() { float h = clamp(vUv.x, 0.0, 1.0); float across = clamp(1.0 - abs(vUv.y * 2.0 - 1.0), 0.0, 1.0); float a = (h * h + 1.6 * pow(clamp(vUv.x, 0.0, 1.0), 10.0)) * across * across * uAlpha; gl_FragColor = vec4(vec3(1.6, 1.7, 2.2) * a, a); }',
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
      fog: false,
      toneMapped: false,
    });
    const mesh = new Mesh(new PlaneGeometry(1, 1), mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = -3;
    mesh.position.z = METEOR_Z;
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
    mesh.position.set(m.x - (m.dx * m.tail) / 2, m.y - (m.dy * m.tail) / 2, METEOR_Z);
    mesh.rotation.z = Math.atan2(m.dy, m.dx);
    mesh.scale.set(m.tail, WIDTH, 1);
    mat.uniforms.uAlpha.value = m.alpha;
  });
  return null;
}
