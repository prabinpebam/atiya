import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Group, Matrix4, MeshBasicMaterial, PlaneGeometry, Quaternion, Vector3 } from 'three';
import { CONFIG } from '../config';
import type { GameController } from '../controller';
import { damp } from '../math/sphere';
import { selectReducedMotion } from '../state/store';
import { Kit } from './kit';
import { KitModel } from './KitModel';
import { ARCH, shade } from './parts';
import { chestPose } from '../systems/readyCue';
import { Sparkles } from './Sparkles';

const R = CONFIG.planetRadius;
/** Chest proportions (u): front is +z, the lid hinges along the top back edge. */
export const CHEST = { w: 0.64, d: 0.42, body: 0.34, lid: 0.15 } as const;

function chestBody(): Kit {
  const k = new Kit();
  const { w, d, body } = CHEST;
  const wood = ARCH.wood;
  const iron = '#4a4540';
  k.surface('wood', () => {
    // planked box: three horizontal boards on the front and back, end boards on the sides
    for (let i = 0; i < 3; i++) {
      const y = 0.02 + (body - 0.04) * ((i + 0.5) / 3);
      const tone = i % 2 ? shade(wood, -0.05) : wood;
      k.box([w - 0.04, (body - 0.04) / 3 - 0.008, 0.035], tone, { p: [0, y, d / 2 - 0.018] }, 0.008);
      k.box([w - 0.04, (body - 0.04) / 3 - 0.008, 0.035], tone, { p: [0, y, -d / 2 + 0.018] }, 0.008);
    }
    for (const s of [-1, 1]) k.box([0.035, body - 0.02, d - 0.03], shade(wood, -0.08), { p: [s * (w / 2 - 0.018), body / 2, 0] }, 0.008);
    k.box([w - 0.06, 0.03, d - 0.06], shade(wood, -0.2), { p: [0, 0.03, 0] }, 0.005);
    // a dark inside, seen when the lid is up
    k.box([w - 0.07, 0.01, d - 0.07], '#3b2616', { p: [0, body - 0.08, 0] }, 0.002);
  });
  k.surface('metal', () => {
    // iron corner posts and two bands
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box([0.045, body, 0.045], iron, { p: [sx * (w / 2 - 0.02), body / 2, sz * (d / 2 - 0.02)] }, 0.01);
    for (const x of [-w * 0.28, w * 0.28]) {
      k.box([0.04, body + 0.004, 0.012], iron, { p: [x, body / 2, d / 2 + 0.002] }, 0.004);
      k.box([0.04, body + 0.004, 0.012], iron, { p: [x, body / 2, -d / 2 - 0.002] }, 0.004);
    }
    // lock plate and hasp on the front
    k.box([0.09, 0.1, 0.018], '#caa24a', { p: [0, body - 0.05, d / 2 + 0.01] }, 0.006);
    k.sphere(0.014, '#2a2420', { p: [0, body - 0.055, d / 2 + 0.02] }, [6, 4]);
  });
  return k;
}

/** The lid, built with its hinge (back top edge) at the origin. */
function chestLid(): Kit {
  const k = new Kit();
  const { w, d, lid } = CHEST;
  const iron = '#4a4540';
  k.surface('wood', () => {
    // a rounded lid (a heavily bevelled box) sitting forward of the hinge
    k.box([w - 0.01, lid, d + 0.01], ARCH.wood, { p: [0, lid / 2, d / 2] }, 0.06);
  });
  k.surface('metal', () => {
    for (const x of [-w * 0.28, w * 0.28]) {
      k.box([0.04, 0.012, d + 0.02], iron, { p: [x, lid + 0.002, d / 2] }, 0.004);
      k.box([0.04, lid - 0.02, 0.012], iron, { p: [x, lid / 2, d + 0.012] }, 0.004);
    }
    for (const s of [-1, 1]) k.box([0.04, lid + 0.01, d + 0.03], iron, { p: [s * (w / 2 - 0.02), lid / 2, d / 2] }, 0.012);
    // hasp tongue hanging over the lock
    k.box([0.05, 0.07, 0.014], '#caa24a', { p: [0, -0.01, d + 0.016] }, 0.005);
  });
  return k;
}

const GLOW = new Color('#ffc861');

/**
 * The storage chest by the Workshop (docs: collection-inventory.md §2). Its lid opens while the
 * chest screen is open. When it becomes what E would use it wiggles, its lid rattling, then rests
 * ajar with a warm glow inside and glints over it (crafting.md §7).
 */
export function Chest({ controller }: { controller: GameController }) {
  const spot = controller.props.chest;
  const geo = useMemo(() => ({ body: chestBody().build(), lid: chestLid().build() }), []);
  const frame = useMemo(() => {
    if (!spot) return null;
    const n = spot.n;
    const h = controller.terrain.height(n);
    const x = new Vector3().crossVectors(n, spot.facing).normalize();
    const z = new Vector3().crossVectors(x, n).normalize();
    const q = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, n, z));
    const p = n.clone().multiplyScalar(R + h - 0.02);
    return { p, q };
  }, [spot, controller]);
  const lid = useRef<Group>(null);
  const body = useRef<Group>(null);
  // the warm glow inside, seen through the lid's gap (HDR, so it blooms)
  const glow = useMemo(() => ({ geo: new PlaneGeometry(CHEST.w - 0.08, CHEST.d - 0.08).rotateX(-Math.PI / 2), mat: new MeshBasicMaterial({ color: '#000000' }) }), []);
  useFrame((_, dt) => {
    const open = controller.store.getState().invScreen === 'chest' ? 1 : 0;
    const reduced = selectReducedMotion(controller.store.getState());
    controller.chestLid = reduced ? open : damp(controller.chestLid, open, open ? 9 : 12, Math.min(dt, 0.1));
    const cue = controller.chestCue;
    const pose = chestPose(cue.since, cue.on, reduced);
    const shut = 1 - controller.chestLid;
    // the lid swings back past vertical a little, like a real chest resting on its stay; ready, it
    // rattles and then rests ajar
    if (lid.current) lid.current.rotation.x = -(controller.chestLid * 1.95 + pose.lid * shut);
    const b = body.current;
    if (b) {
      b.rotation.set(pose.pitchX, 0, pose.rollZ);
      const w = 1 / Math.sqrt(pose.sy);
      b.scale.set(w, pose.sy, w);
    }
    glow.mat.color.copy(GLOW).multiplyScalar(2.4 * pose.glow * shut);
  });
  if (!spot || !frame) return null;
  return (
    <group name="chest" position={frame.p} quaternion={frame.q}>
      <group ref={body} name="chest-body">
        <KitModel geo={geo.body} />
        <mesh geometry={glow.geo} material={glow.mat} position={[0, CHEST.body - 0.07, 0]} />
        <group ref={lid} position={[0, CHEST.body, -CHEST.d / 2]}>
          <KitModel geo={geo.lid} />
        </group>
      </group>
      <Sparkles controller={controller} cue={controller.chestCue} at={[0, CHEST.body + CHEST.lid + 0.1, 0]} half={[CHEST.w * 0.6, 0.3, CHEST.d * 0.7]} count={7} />
    </group>
  );
}
