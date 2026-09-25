import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, InstancedMesh, Matrix4, Quaternion, Vector3, type BufferGeometry } from 'three';
import type { GameController } from '../controller';
import { selectReducedMotion } from '../state/store';
import { itemDef, type ItemId } from '../inventory/items';
import { kitMaterials } from './materials';
import { dropFruit, dropLeaves, dropLog, dropStone, flowerBlooms, flowerStems } from './propModels';
import { DROP, Drops as DropSim } from './dropSim';
import { withLampLights } from './lampLights';

/** Most copies drawn per model (one drop shows up to 3 for a bigger stack). */
const CAP = 96;
const Y = new Vector3(0, 1, 0);
const _m = new Matrix4();
const _q = new Quaternion();
const _yaw = new Quaternion();
const _p = new Vector3();
const _n = new Vector3();
const _s = new Vector3();
const _off = new Vector3();
const WHITE = new Color(1, 1, 1);

type Slot = { key: string; geo: BufferGeometry; scale: number; tinted: boolean; match: (id: ItemId) => boolean };

/** Items lying in the world (docs: collection-inventory.md §3.2): small models that bob, spin and fly to you. */
export function Drops({ controller }: { controller: GameController }) {
  const slots = useMemo<Slot[]>(() => {
    const flowers = (['tulip', 'cosmos', 'pansy'] as const).flatMap((k) => [
      { key: `${k}-stem`, geo: flowerStems(k), scale: 0.62, tinted: false, match: (id: ItemId) => itemDef(id).model === k },
      { key: `${k}-bloom`, geo: flowerBlooms(k), scale: 0.62, tinted: true, match: (id: ItemId) => itemDef(id).model === k },
    ]);
    return [
      { key: 'log', geo: dropLog(), scale: 1, tinted: false, match: (id) => id === 'log' },
      { key: 'leaves', geo: dropLeaves(), scale: 1, tinted: false, match: (id) => id === 'leaves' },
      { key: 'apple', geo: dropFruit('#e8453c'), scale: 1, tinted: false, match: (id) => id === 'apple' },
      { key: 'orange', geo: dropFruit('#ff9a2e'), scale: 1, tinted: false, match: (id) => id === 'orange' },
      { key: 'stone', geo: dropStone(), scale: 1, tinted: false, match: (id) => id === 'stone' },
      ...flowers,
    ];
  }, []);
  const material = useMemo(() => withLampLights(kitMaterials().solid.clone()), []);
  const refs = useRef<Array<InstancedMesh | null>>([]);
  const color = useMemo(() => new Color(), []);

  useFrame(() => {
    const sim = controller.drops;
    const still = selectReducedMotion(controller.store.getState());
    const counts = new Array(slots.length).fill(0);
    for (const d of sim.list) {
      const def = itemDef(d.item);
      const copies = d.count >= 16 ? 3 : d.count >= 2 ? 2 : 1;
      _n.copy(d.p).normalize();
      const float = DropSim.floatH(d, still) - DROP.restH;
      const shrink = d.state === 'collected' ? Math.max(0, 1 - d.t / DROP.collectTime) : d.state === 'magnet' ? 0.85 : 1;
      _q.setFromUnitVectors(Y, _n);
      _yaw.setFromAxisAngle(Y, still ? 0 : d.spin);
      _q.multiply(_yaw);
      slots.forEach((slot, si) => {
        if (!slot.match(d.item)) return;
        const mesh = refs.current[si];
        if (!mesh) return;
        for (let c = 0; c < copies && counts[si] < CAP; c++) {
          // copies sit side by side in the drop's own frame
          _off.set(c === 1 ? 0.09 : c === 2 ? -0.07 : 0, c * 0.03, c === 2 ? 0.08 : c === 1 ? -0.04 : 0).applyQuaternion(_q);
          _p.copy(d.p).addScaledVector(_n, float).add(_off);
          _s.setScalar(slot.scale * shrink);
          _m.compose(_p, _q, _s);
          mesh.setMatrixAt(counts[si], _m);
          mesh.setColorAt(counts[si], slot.tinted ? color.set(def.tint) : WHITE);
          counts[si]++;
        }
      });
    }
    slots.forEach((_, si) => {
      const mesh = refs.current[si];
      if (!mesh) return;
      mesh.count = counts[si];
      mesh.visible = counts[si] > 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
  });

  return (
    <group name="drops">
      {slots.map((s, i) => (
        <instancedMesh
          key={s.key}
          ref={(m) => {
            refs.current[i] = m;
            // every instance needs a colour (the kit material is shared: keep one program variant)
            if (m && !m.instanceColor) {
              for (let k = 0; k < CAP; k++) m.setColorAt(k, WHITE);
              m.count = 0;
            }
          }}
          args={[s.geo, material, CAP]}
          castShadow
          frustumCulled={false}
        />
      ))}
    </group>
  );
}
