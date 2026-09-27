/**
 * The vegetable garden's view (docs: family.md §3.2): the watering can (by the beds, in the
 * visitor's hand, or in Rojina's or Prabin's: FamilyView draws theirs), a darker ring of wet soil
 * round each watered plant, fading as it dries, and the water falling from the spout while someone
 * pours. Instanced (one draw each for the soil and the water).
 */
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, InstancedMesh, Matrix4, Object3D, Quaternion, Vector3 } from 'three';
import { CONFIG } from '../../config';
import type { GameController } from '../../controller';
import { moveAlong, tangentToward } from '../../math/sphere';
import { Kit } from '../kit';
import { KitModel } from '../KitModel';
import { kitMaterials } from '../materials';
import { PROP_SCALE, type HomeSpot, type Homestead } from '../homestead';
import { GARDEN, pourTilt, pouring, type Garden } from './garden';
import { heldCanModel, wateringCan } from './models';

const R = CONFIG.planetRadius;
const DROPS = 14;
/** The spout's tip in the carried can's own frame (models.ts `heldCanModel`). */
const SPOUT = new Vector3(0, 0.01, 0.2);
const MAX_POURS = 3;
/** The visitor is taller than the family: their can is drawn a little larger. */
const VISITOR_CAN = 0.9;
const _x = new Vector3();
const _p = new Vector3();
const _q = new Quaternion();
const _m = new Matrix4();
const _s = new Vector3();
const _a = new Vector3();
const _b = new Vector3();
const _up = new Vector3(0, 1, 0);

/** A model's frame standing at `n` with its front along `facing`, `h` above the ground. */
function frameAt(s: HomeSpot, h: number, yaw = 0): Matrix4 {
  const z = s.facing.clone().addScaledVector(s.n, -s.facing.dot(s.n)).normalize();
  const x = _x.crossVectors(s.n, z).normalize();
  const q = new Quaternion().setFromRotationMatrix(_m.makeBasis(x, s.n, z)).multiply(new Quaternion().setFromAxisAngle(_up, yaw));
  return new Matrix4().compose(s.n.clone().multiplyScalar(R + h), q, new Vector3(1, 1, 1));
}

export function GardenView({ controller, home, garden }: { controller: GameController; home: Homestead; garden: Garden }) {
  const ht = (n: Vector3) => controller.terrain.height(n);
  const scene = useThree((s) => s.scene);
  const geo = useMemo(() => {
    const ground = new Kit();
    ground.group({ s: PROP_SCALE }, () => wateringCan(ground));
    const soil = new Kit();
    soil.cyl(1, 1, 0.004, '#22140d', {}, 14);
    const drop = new Kit();
    drop.sphere(0.016, '#a9dcff', {}, [6, 4]);
    return { ground: ground.build(), held: heldCanModel(), soil: soil.build().solid!, drop: drop.build().solid! };
  }, []);
  // each plant's wet patch, on its bed's soil (the bed stands on the ground at its own centre, flat)
  const patches = useMemo(
    () =>
      garden.plants.map((p) => {
        const bed = home.yard.beds[p.bed];
        const m = frameAt(bed, ht(bed.n));
        const side = new Vector3().crossVectors(bed.n, bed.facing).normalize();
        const off = p.n.clone().sub(bed.n);
        const local = new Vector3(off.dot(side) * R, GARDEN.soil + 0.002, off.dot(bed.facing) * R);
        return { m, local, r: p.kind === 'cabbage' ? 0.17 : 0.14, top: local.clone().setY(GARDEN.soil + 0.1).applyMatrix4(m) };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [garden, home],
  );
  const canAt = useMemo(() => {
    const p = new Vector3();
    const q = new Quaternion();
    frameAt(home.yard.wateringCan, ht(home.yard.wateringCan.n), 0.6).decompose(p, q, new Vector3());
    return { p, q };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home]);
  const ground = useRef<Group>(null);
  const held = useRef<Group>(null);
  const soil = useRef<InstancedMesh>(null);
  const drops = useRef<InstancedMesh>(null);
  const hand = useRef<Object3D | null>(null);

  useFrame(() => {
    if (ground.current) ground.current.visible = garden.holder === null;
    // in the visitor's right hand, upright (tipping while they pour)
    const h = held.current;
    if (h) {
      hand.current ??= scene.getObjectByName('player-model')?.getObjectByName('RightHand') ?? null;
      const hb = hand.current;
      h.visible = garden.holder === 'visitor' && Boolean(hb);
      if (h.visible && hb) {
        // (the character stays at the top of the world while the planet turns under it: from world into the planet's frame)
        h.parent!.updateWorldMatrix(true, false);
        h.position.copy(h.parent!.worldToLocal(hb.getWorldPosition(_p)));
        const a = controller.action;
        h.quaternion.setFromAxisAngle(_up, controller.sim.heading);
        if (a.kind === 'water') h.rotateX(pourTilt(a.t));
        h.quaternion.premultiply(h.parent!.getWorldQuaternion(_q).invert());
      }
    }
    // the wet soil: a darker patch round each watered plant, shrinking as it dries
    const s = soil.current;
    if (s) {
      patches.forEach((p, i) => {
        const w = Math.sqrt(garden.wet[i] ?? 0);
        _m.makeScale(p.r * w + 1e-4, 1, p.r * w + 1e-4).setPosition(p.local);
        s.setMatrixAt(i, _m.premultiply(p.m));
      });
      s.instanceMatrix.needsUpdate = true;
    }
    // the water: drops falling from the spout onto the plant while the can is tipped
    const d = drops.current;
    if (!d) return;
    let n = 0;
    for (const pour of garden.pours.slice(0, MAX_POURS)) {
      if (!pouring(pour.t)) continue;
      const plant = patches[pour.i];
      // from the spout of the can in hand (the visitor's, or Rojina's or Prabin's), in the planet's frame like the plants
      const can = garden.holder === 'visitor' ? held.current : (scene.getObjectByName(`npc-${garden.holder}`)?.getObjectByName('can')?.children[0] ?? null);
      if (can && d.parent) {
        can.updateWorldMatrix(true, false);
        d.parent.worldToLocal(can.localToWorld(_a.copy(SPOUT)));
      } else {
        const to = tangentToward(pour.from, garden.plants[pour.i].n) ?? garden.plants[pour.i].stands[0].facing;
        _a.copy(moveAlong(pour.from, to, 0.4 / R)).multiplyScalar(R + ht(pour.from) + 0.35);
      }
      _b.copy(plant.top);
      for (let k = 0; k < DROPS; k++) {
        const f = (pour.t * 2.4 + k / DROPS) % 1;
        _p.lerpVectors(_a, _b, f).addScaledVector(_b.clone().normalize(), Math.sin(f * Math.PI) * 0.05);
        _m.compose(_p, _q.identity(), _s.setScalar(1 - f * 0.3));
        d.setMatrixAt(n++, _m);
      }
    }
    d.count = n;
    d.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <group ref={ground} position={canAt.p} quaternion={canAt.q}>
        <KitModel geo={geo.ground} />
      </group>
      <group ref={held} visible={false} scale={VISITOR_CAN}>
        <KitModel geo={geo.held} shadows={false} />
      </group>
      <instancedMesh ref={soil} args={[geo.soil, kitMaterials().solid, patches.length]} receiveShadow frustumCulled={false} />
      <instancedMesh ref={drops} args={[geo.drop, kitMaterials().solid, DROPS * MAX_POURS]} frustumCulled={false} />
    </>
  );
}
