import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { InstancedMesh } from 'three';
import { Object3D } from 'three';
import type { GameController } from '../controller';
import { selectReducedMotion } from '../state/store';
import { sparkle, type ReadyCue } from '../systems/readyCue';
import { Kit, type V3 } from './kit';
import { kitMaterials } from './materials';

let star: ReturnType<Kit['build']>['glow'] | null = null;
/** A little three-axis twinkle (glow layer, so it blooms). */
function starGeometry() {
  if (!star) {
    const k = new Kit();
    for (const r of [
      [0, 0, 0],
      [0, 0, Math.PI / 2],
      [Math.PI / 2, 0, 0],
    ] as V3[])
      k.box([0.018, 0.12, 0.018], '#ffe08a', { r }, 0.006, 'glow');
    star = k.build().glow;
  }
  return star!;
}

/**
 * Glints round something that's ready to use (readyCue.ts): they drift up and fade while `cue` is
 * on. Under reduced motion they hold still. `at` is the box's centre and `half` its half-size, in
 * the parent's frame. Always mounted (no instances while off), so its program compiles with the scene.
 */
export function Sparkles({ controller, cue, at, half, count = 6 }: { controller: GameController; cue: ReadyCue; at: V3; half: V3; count?: number }) {
  const ref = useRef<InstancedMesh>(null);
  const tmp = useMemo(() => new Object3D(), []);
  const geo = useMemo(() => starGeometry(), []);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    m.count = cue.on > 0.01 ? count : 0;
    if (!m.count) return;
    const still = selectReducedMotion(controller.store.getState());
    const t = clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const s = sparkle(i, count, t, cue.on, still);
      tmp.position.set(at[0] + s.x * half[0], at[1] + s.y * half[1], at[2] + s.z * half[2]);
      tmp.rotation.set(0, still ? i : t * 2 + i, still ? 0.4 : t * 1.3 + i);
      tmp.scale.setScalar(Math.max(1e-4, s.s));
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geo, kitMaterials().glow, count]} count={0} frustumCulled={false} />;
}
