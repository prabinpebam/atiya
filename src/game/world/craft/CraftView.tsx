import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from 'zustand';
import { Color, DoubleSide, Group, InstancedMesh, LineBasicMaterial, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Object3D, Quaternion, SphereGeometry, Vector3 } from 'three';
import { CONFIG } from '../../config';
import type { GameController } from '../../controller';
import { selectReducedMotion } from '../../state/store';
import { KitModel } from '../KitModel';
import { addLamp, withLampLights, type Lamp } from '../lampLights';
import { lampsOn } from '../DayNight';
import type { Crafting } from './index';
import { DOGHOUSE_LANTERN, TABLE, craftingTableModel, dogHouseModel, ghostGeometry } from './models';
import { toolPose } from '../../systems/readyCue';
import { Sparkles } from '../Sparkles';
import { HOUSE_HEX } from './recipes';
import { prebuilt } from '../prebuilt';

const R = CONFIG.planetRadius;
const _x = new Vector3();
const _m = new Matrix4();

/** Position and orientation for a model standing at `n` with its front along `facing`. */
function frame(n: Vector3, facing: Vector3, h: number): { p: Vector3; q: Quaternion } {
  const z = facing.clone().addScaledVector(n, -facing.dot(n)).normalize();
  const x = _x.crossVectors(n, z).normalize();
  return { p: n.clone().multiplyScalar(R + h), q: new Quaternion().setFromRotationMatrix(_m.makeBasis(x, n, z)) };
}

const UP = new Vector3(0, 1, 0);
const X = new Vector3(1, 0, 0);
const easeOutBack = (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
const PUFFS = 10;

/** The crafting table by the Workshop, and Chopper's house by the family's (its ghost until it's built). */
export function CraftView({ controller, crafting }: { controller: GameController; crafting: Crafting }) {
  const table = controller.props.craft;
  const site = controller.props.home?.dogHouse ?? null;
  const built = useStore(crafting.store, (s) => s.built);
  const colour = useStore(crafting.store, (s) => s.colour);
  const building = useStore(crafting.store, (s) => s.building !== null);
  const tableGeo = useMemo(() => prebuilt('craft.table', craftingTableModel), []);
  const tableAt = useMemo(() => (table ? frame(table.n, table.facing, controller.terrain.height(table.n) - 0.02) : null), [table, controller]);
  const siteAt = useMemo(() => (site ? frame(site.n, site.facing, controller.terrain.height(site.n) - 0.03) : null), [site, controller]);
  const houseGeo = useMemo(() => (built ? dogHouseModel(HOUSE_HEX[colour]) : null), [built, colour]);
  // the lantern inside lights his room at night (a real lamp: lampLights.ts), dark by day
  const lantern = useMemo<Lamp | null>(
    () => (siteAt ? { pos: new Vector3(...DOGHOUSE_LANTERN).applyQuaternion(siteAt.q).add(siteAt.p), dir: null, color: new Color('#ffc88a'), intensity: 0, range: 1.1 } : null),
    [siteAt],
  );
  useEffect(() => (built && lantern ? addLamp(lantern) : undefined), [built, lantern]);
  useEffect(
    () => () => {
      for (const g of [houseGeo?.solid, houseGeo?.glow, houseGeo?.glass]) g?.dispose();
    },
    [houseGeo],
  );
  const ghost = useMemo(() => {
    const geo = ghostGeometry();
    const fill = new MeshBasicMaterial({ color: '#a8d8ff', transparent: true, opacity: 0, depthWrite: false, side: DoubleSide, toneMapped: false });
    const line = new LineBasicMaterial({ color: '#dff1ff', transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    return { geo, fill, line };
  }, []);
  const dust = useMemo(() => ({ geo: new SphereGeometry(0.09, 8, 6), mat: withLampLights(new MeshStandardMaterial({ color: '#e9dcc4', roughness: 1, transparent: true, opacity: 0.8, depthWrite: false })) }), []);
  // the loose tools: each hops to life when the table's ready, then keeps a small idle motion
  const toolRefs = useRef<Array<Group | null>>([]);
  const toolAxes = useMemo(() => tableGeo.tools.map((t) => new Vector3(...t.axis).normalize()), [tableGeo]);
  const _q = useMemo(() => new Quaternion(), []);
  const house = useRef<Group>(null);
  const ghostGroup = useRef<Group>(null);
  const puffs = useRef<InstancedMesh>(null);
  const tmp = useMemo(() => new Object3D(), []);
  const seeds = useMemo(() => Array.from({ length: PUFFS }, (_, i) => ({ a: (i / PUFFS) * Math.PI * 2 + Math.random() * 0.4, r: 0.35 + Math.random() * 0.2, s: 0.7 + Math.random() * 0.6 })), []);

  useFrame(({ clock }) => {
    const s = crafting.store.getState();
    if (lantern) lantern.intensity = 1.6 * lampsOn(controller.sky.night);
    const reduced = selectReducedMotion(controller.store.getState());
    const cue = controller.craftCue;
    tableGeo.tools.forEach((tool, i) => {
      const g = toolRefs.current[i];
      if (!g) return;
      const p = toolPose(tool.motion, i, cue.since, cue.on, clock.elapsedTime, reduced);
      g.position.set(tool.pivot[0], tool.pivot[1] + p.lift, tool.pivot[2]);
      // spin about the vertical, then the tap or swing about its own axis, then a rock about x
      g.quaternion.setFromAxisAngle(UP, p.ry).multiply(_q.setFromAxisAngle(toolAxes[i], p.rz));
      if (p.rx) g.quaternion.multiply(_q.setFromAxisAngle(X, p.rx));
    });
    const t = s.building;
    // the ghost: faint from afar, clear up close, with a slow shimmer; it fades as the house goes up
    const g = ghostGroup.current;
    if (g) {
      const k = crafting.ghost;
      const fade = t === null ? 1 : Math.max(0, 1 - t / 0.6);
      const shimmer = reduced ? 1 : 0.86 + 0.14 * Math.sin(clock.elapsedTime * 2.1);
      const o = (t === null && built ? 0 : 1) * fade;
      ghost.line.opacity = (0.05 + 0.8 * Math.pow(k, 1.3)) * shimmer * o;
      ghost.fill.opacity = 0.16 * Math.pow(k, 1.6) * shimmer * o;
      g.visible = ghost.line.opacity > 0.004;
    }
    // the house rises out of the ground, a little overshoot, and settles
    const h = house.current;
    if (h) {
      const p = t === null ? 1 : Math.min(1, Math.max(0, (t - 0.3) / 1.4));
      const y = p <= 0 ? 0.02 : easeOutBack(p);
      h.scale.set(1, Math.max(0.02, y), 1);
      h.visible = p > 0;
    }
    const m = puffs.current;
    // (always mounted, so its material compiles with the scene; no instances unless it's going up)
    if (m) m.count = t === null ? 0 : PUFFS;
    if (m && t !== null) {
      const tt = t;
      for (let i = 0; i < PUFFS; i++) {
        const sd = seeds[i];
        const life = Math.min(1, Math.max(0, (tt - 0.1 - (i % 3) * 0.25) / 1.1));
        const r = sd.r + life * 0.45;
        tmp.position.set(Math.cos(sd.a) * r, 0.06 + life * 0.25, Math.sin(sd.a) * r);
        tmp.scale.setScalar(life > 0 && life < 1 ? sd.s * (0.6 + life * 1.2) : 0.0001);
        tmp.updateMatrix();
        m.setMatrixAt(i, tmp.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
      dust.mat.opacity = 0.75 * (1 - Math.min(1, Math.max(0, (tt - 0.6) / 1.4)));
    }
  });

  return (
    <>
      {tableAt && (
        <group name="crafting-table" position={tableAt.p} quaternion={tableAt.q}>
          <KitModel geo={tableGeo.base} />
          {tableGeo.tools.map((t, i) => (
            <group key={t.name} name={`tool-${t.name}`} ref={(el) => void (toolRefs.current[i] = el)} position={t.pivot}>
              <KitModel geo={t.geo} />
            </group>
          ))}
          <Sparkles controller={controller} cue={controller.craftCue} at={[0, TABLE.h + 0.12, 0]} half={[TABLE.w * 0.55, 0.3, TABLE.d * 0.6]} count={8} />
        </group>
      )}
      {siteAt && (
        <group name="dog-house-site" position={siteAt.p} quaternion={siteAt.q}>
          {(!built || building) && (
            <group ref={ghostGroup} name="dog-house-ghost">
              <mesh geometry={ghost.geo.fill} material={ghost.fill} renderOrder={3} />
              <lineSegments geometry={ghost.geo.edges} material={ghost.line} renderOrder={4} />
            </group>
          )}
          {houseGeo && (
            <group ref={house} name="dog-house">
              <KitModel geo={houseGeo} />
            </group>
          )}
          <instancedMesh ref={puffs} args={[dust.geo, dust.mat, PUFFS]} count={0} frustumCulled={false} />
        </group>
      )}
    </>
  );
}
