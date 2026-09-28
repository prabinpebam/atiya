import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from 'zustand';
import { Color, DoubleSide, Group, InstancedMesh, LineBasicMaterial, Matrix4, MeshBasicMaterial, Quaternion, Vector3 } from 'three';
import { CONFIG } from '../../config';
import type { GameController } from '../../controller';
import { selectReducedMotion } from '../../state/store';
import { kitMaterials, sharedPropMaterials } from '../materials';
import type { PropMaterials } from '../Props';
import type { Crafting } from './index';
import { jutePlant, juteStubble, oakModel, swingGhost, swingModel } from './swingModels';
import { prebuildSteps, prebuilt } from '../prebuilt';

type SwingSpec = Crafting['swing'];
/** The oak, the jute and the swing, each built on its own (ahead, in slices: `swingSteps`). */
const SWING_MODELS = (sw: SwingSpec) =>
  [
    ['swing.oak', oakModel],
    ['swing.jute', jutePlant],
    ['swing.stubble', juteStubble],
    ['swing.swing', () => (sw ? swingModel(sw.frame.length) : null)],
    ['swing.ghost', () => (sw ? swingGhost(sw.frame.length) : null)],
  ] as const;
const swingModels = (sw: SwingSpec) => {
  const [oak, jute, stubble, swing, ghost] = SWING_MODELS(sw).map(([k, make]) => prebuilt<unknown>(k, make));
  return { oak, jute, stubble, swing, ghost } as { oak: ReturnType<typeof oakModel>; jute: ReturnType<typeof jutePlant>; stubble: ReturnType<typeof juteStubble>; swing: ReturnType<typeof swingModel> | null; ghost: ReturnType<typeof swingGhost> | null };
};
/** The crafting chunk's models, built ahead while it waits for its turn (the summoner's preparation). */
export function craftSteps(sw: SwingSpec, more: ReadonlyArray<readonly [string, () => unknown]>): Generator<void, void> {
  return prebuildSteps([...SWING_MODELS(sw), ...more]);
}

const R = CONFIG.planetRadius;
const WHITE = new Color('#ffffff');
const _m = new Matrix4();
const _q = new Quaternion();
const _x = new Vector3();
const _z = new Vector3();
const _p = new Vector3();
const _s = new Vector3();
const easeOutBack = (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
/** A picked jute plant shows its regrowth over the last this-many seconds (swing.md §4.2). */
const GROW_S = 20;

/** Matrix for a model standing at `n` (at `h` above the base sphere) with its local +x along `x`. */
function standAt(out: Matrix4, n: Vector3, x: Vector3, h: number, scale = 1, yaw = 0): Matrix4 {
  _x.copy(x).addScaledVector(n, -x.dot(n)).normalize();
  _z.crossVectors(_x, n).normalize();
  out.makeBasis(_x, n, _z);
  _q.setFromRotationMatrix(out);
  if (yaw) _q.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw));
  return out.compose(_p.copy(n).multiplyScalar(R + h), _q, _s.setScalar(scale));
}

/**
 * The old oak by the pond (with the swing's branch), the jute row behind the vegetable garden, and
 * the swing (its ghost until it's built): swing.md §4.2–4.5.
 */
export function SwingView({ controller, crafting }: { controller: GameController; crafting: Crafting }) {
  const home = controller.props.home;
  const built = useStore(crafting.store, (s) => s.swingBuilt);
  const building = useStore(crafting.store, (s) => s.swingBuilding !== null);
  const sw = crafting.swing;
  const geo = useMemo(() => swingModels(sw), [sw]);
  const mats = useMemo(() => {
    const p = sharedPropMaterials<PropMaterials>();
    return {
      tree: p.tree,
      leaves: p.broad,
      // (the bushes' material: the same gentle sway from the ground up, and lamplight)
      jute: p.bush,
      solid: kitMaterials().solid,
      fill: new MeshBasicMaterial({ color: '#a8d8ff', transparent: true, opacity: 0, depthWrite: false, side: DoubleSide, toneMapped: false }),
      line: new LineBasicMaterial({ color: '#dff1ff', transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
    };
  }, []);
  useEffect(
    () => () => {
      for (const g of [geo.oak.solid, geo.oak.leaves, geo.jute, geo.stubble, geo.swing, geo.ghost?.fill, geo.ghost?.edges]) g?.dispose();
    },
    [geo],
  );
  const oak = useRef<Record<'solid' | 'leaves', InstancedMesh | null>>({ solid: null, leaves: null });
  const plants = useRef<InstancedMesh>(null);
  const stubble = useRef<InstancedMesh>(null);
  const seat = useRef<Group>(null);
  const ghost = useRef<Group>(null);
  const juteVersion = useRef(-1);
  // the site's frame (x along the branch, y up, z across), from the ground under the seat
  const siteAt = useMemo(() => {
    if (!home || !sw) return null;
    const { x, y, z } = sw.frame;
    const q = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
    return { p: home.swing.n.clone().multiplyScalar(R + controller.terrain.height(home.swing.n)), q };
  }, [home, sw, controller]);

  useLayoutEffect(() => {
    if (!home) return;
    const m = standAt(new Matrix4(), home.tree, home.swingLimb, controller.terrain.height(home.tree) - 0.03);
    for (const k of ['solid', 'leaves'] as const) {
      const mesh = oak.current[k];
      if (!mesh) continue;
      mesh.setMatrixAt(0, m);
      mesh.setColorAt(0, WHITE);
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    for (const mesh of [plants.current, stubble.current]) {
      if (!mesh) continue;
      for (let i = 0; i < home.yard.jute.length; i++) mesh.setColorAt(i, WHITE);
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }, [home, controller]);

  useFrame(({ clock }) => {
    if (!home) return;
    const reduced = selectReducedMotion(controller.store.getState());
    // the jute: grown, cut to stubble, or growing back
    const jute = crafting.jute;
    const growing = jute.left.some((l) => l > 0 && l < GROW_S);
    if ((jute.version !== juteVersion.current || growing) && plants.current && stubble.current) {
      juteVersion.current = jute.version;
      home.yard.jute.forEach((j, i) => {
        const left = jute.left[i];
        const k = left <= 0 ? 1 : left >= GROW_S ? 0 : 0.15 + 0.85 * (1 - left / GROW_S);
        const h = controller.terrain.height(j.n) - 0.02;
        const yaw = i * 1.9;
        plants.current!.setMatrixAt(i, standAt(_m, j.n, j.facing, h, k > 0 ? (0.92 + (i % 3) * 0.06) * k : 0, yaw));
        stubble.current!.setMatrixAt(i, standAt(_m, j.n, j.facing, h, k < 0.5 ? 1 : 0, yaw));
      });
      plants.current.instanceMatrix.needsUpdate = true;
      stubble.current.instanceMatrix.needsUpdate = true;
    }
    const s = crafting.store.getState();
    const t = s.swingBuilding;
    // the ghost: faint from afar, clear up close, shimmering; it fades as the swing goes up
    const g = ghost.current;
    if (g) {
      const k = crafting.swingGhost;
      const fade = t === null ? 1 : Math.max(0, 1 - t / 0.6);
      const shimmer = reduced ? 1 : 0.86 + 0.14 * Math.sin(clock.elapsedTime * 2.1);
      const o = (t === null && s.swingBuilt ? 0 : 1) * fade;
      mats.line.opacity = (0.05 + 0.8 * Math.pow(k, 1.3)) * shimmer * o;
      mats.fill.opacity = 0.16 * Math.pow(k, 1.6) * shimmer * o;
      g.visible = mats.line.opacity > 0.004;
    }
    // the swing drops down from the branch on its ropes, overshoots a little and settles; then it swings
    const sg = seat.current;
    if (sg && sw) {
      const p = t === null ? 1 : Math.min(1, Math.max(0, (t - 0.3) / 1.4));
      sg.scale.set(1, Math.max(0.02, p <= 0 ? 0.02 : easeOutBack(p)), 1);
      sg.visible = p > 0;
      sg.rotation.x = sw.pendulum.a;
    }
  });

  if (!home || !sw || !siteAt) return null;
  const n = home.yard.jute.length;
  return (
    <group name="swing-and-jute">
      <instancedMesh ref={(m) => void (oak.current.solid = m)} args={[geo.oak.solid, mats.tree, 1]} castShadow receiveShadow frustumCulled={false} />
      <instancedMesh ref={(m) => void (oak.current.leaves = m)} args={[geo.oak.leaves, mats.leaves.material, 1]} castShadow receiveShadow customDepthMaterial={mats.leaves.depth} frustumCulled={false} />
      <instancedMesh ref={plants} args={[geo.jute, mats.jute, n]} castShadow receiveShadow frustumCulled={false} />
      <instancedMesh ref={stubble} args={[geo.stubble, mats.solid, n]} receiveShadow frustumCulled={false} />
      <group name="swing" position={siteAt.p} quaternion={siteAt.q}>
        <group position={sw.frame.pivot}>
          {(!built || building) && geo.ghost && (
            <group ref={ghost} name="swing-ghost">
              <mesh geometry={geo.ghost.fill} material={mats.fill} renderOrder={3} />
              <lineSegments geometry={geo.ghost.edges} material={mats.line} renderOrder={4} />
            </group>
          )}
          {built && geo.swing && (
            <group ref={seat} name="swing-seat">
              <mesh geometry={geo.swing} material={mats.solid} castShadow receiveShadow />
            </group>
          )}
        </group>
      </group>
    </group>
  );
}

