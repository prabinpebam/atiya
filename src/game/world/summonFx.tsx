import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Object3D, Vector3, type InstancedMesh } from 'three';
import { CONFIG } from '../config';
import type { GameController } from '../controller';
import { selectReducedMotion } from '../state/store';
import { Kit, type V3 } from './kit';
import { kitMaterials } from './materials';

/** How long a burst lasts (s), how many stars each throws, and how many can play at once. */
const BURST_S = 0.65;
const STARS = 6;
const MAX = 24;

/**
 * The summoning's puffs of sparkles (progressive-loading.md §5.5): where a tree, a boulder, Prabin,
 * Chopper, the home or the crafting table appears, a few stars burst out and up, and fade. One
 * instanced draw on the glow layer (so they bloom). None under reduced motion.
 */
export function SummonFx({ controller }: { controller: GameController }) {
  const ref = useRef<InstancedMesh>(null);
  const tmp = useMemo(() => new Object3D(), []);
  const geo = useMemo(() => {
    const k = new Kit();
    for (const r of [
      [0, 0, 0],
      [0, 0, Math.PI / 2],
      [Math.PI / 2, 0, 0],
    ] as V3[])
      k.box([0.02, 0.14, 0.02], '#ffe08a', { r }, 0.007, 'glow');
    return k.build().glow!;
  }, []);
  const R = CONFIG.planetRadius;
  const up = useMemo(() => new Vector3(), []);
  const side = useMemo(() => new Vector3(), []);
  const fwd = useMemo(() => new Vector3(), []);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const list = controller.summoner.bursts;
    const now = performance.now();
    // (the finished ones go; bursts come roughly in time order, so they're dropped from the front)
    while (list.length && now - list[0].t > BURST_S * 1000 && list.length > 0) list.shift();
    if (!list.length || selectReducedMotion(controller.store.getState())) {
      m.count = 0;
      return;
    }
    let n = 0;
    for (const b of list) {
      const t = (now - b.t) / 1000;
      if (t < 0 || t > BURST_S) continue;
      if (n >= MAX * STARS) break;
      const x = t / BURST_S;
      up.copy(b.n).normalize();
      side.set(1, 0, 0).addScaledVector(up, -up.x);
      if (side.lengthSq() < 1e-6) side.set(0, 0, 1);
      side.normalize();
      fwd.crossVectors(up, side);
      const reach = 0.15 + 0.55 * (1 - (1 - x) * (1 - x));
      for (let i = 0; i < STARS; i++) {
        const a = (i / STARS) * Math.PI * 2 + b.t * 0.001;
        tmp.position
          .copy(up)
          .multiplyScalar(R + b.h + reach * 0.6 + x * 0.25)
          .addScaledVector(side, Math.cos(a) * reach)
          .addScaledVector(fwd, Math.sin(a) * reach);
        tmp.rotation.set(0, a + t * 3, t * 4 + i);
        tmp.scale.setScalar(Math.max(1e-4, (1 - x) * (x < 0.15 ? x / 0.15 : 1)));
        tmp.updateMatrix();
        m.setMatrixAt(n++, tmp.matrix);
      }
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
  });
  // (always mounted, with nothing drawn until a burst, so its program compiles with the planet)
  return <instancedMesh ref={ref} args={[geo, kitMaterials().glow, MAX * STARS]} count={0} frustumCulled={false} name="summon-fx" />;
}
