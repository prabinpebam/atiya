import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from 'zustand';
import { Color, DoubleSide, Group, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, RingGeometry, SphereGeometry, Vector3, type Mesh } from 'three';
import { CONFIG } from '../../config';
import type { GameController } from '../../controller';
import { moveAlong, tangentToward } from '../../math/sphere';
import { selectAmbientPaused } from '../../state/store';
import { butterflyWing } from '../propModels';
import { Kit, type V3 } from '../kit';
import { KitModel } from '../KitModel';
import { addLamp, withLampLights, type Lamp } from '../lampLights';
import { kitMaterials } from '../materials';
import { gameTexture } from '../textures';
import { lampsOn } from '../DayNight';
import { PROP_SCALE, type HomeSpot, type Homestead } from '../homestead';
import type { Family } from './family';
import {
  armchairModel,
  campChairModel,
  chairModel,
  DOOR_HINGE,
  doorLeafModel,
  fireRingModel,
  flamesModel,
  guitarModel,
  houseModel,
  legoModel,
  lightPostModel,
  logBenchModel,
  matGeometry,
  picnicFoodModel,
  sideTableModel,
  tableModel,
  toyCarModel,
} from './models';
import { legoSpot } from './family';

const R = CONFIG.planetRadius;
const _x = new Vector3();
const _m = new Matrix4();

/** Position and orientation for a model standing at `n` with its front along `facing`. */
function frame(n: Vector3, facing: Vector3, h: number, yaw = 0): { p: Vector3; q: Quaternion } {
  const z = facing.clone().addScaledVector(n, -facing.dot(n)).normalize();
  const x = _x.crossVectors(n, z).normalize();
  const q = new Quaternion().setFromRotationMatrix(_m.makeBasis(x, n, z));
  if (yaw) q.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw));
  return { p: n.clone().multiplyScalar(R + h), q };
}

function Placed({ at, h, yaw = 0, scale = 1, children }: { at: HomeSpot; h: number; yaw?: number; scale?: number; children: React.ReactNode }) {
  const f = useMemo(() => frame(at.n, at.facing, h, yaw), [at, h, yaw]);
  return (
    <group position={f.p} quaternion={f.q} scale={scale}>
      {children}
    </group>
  );
}

/** A point in a spot's frame (x right, y up, z front) → planet-local (for lamps). */
function toPlanet(at: HomeSpot, h: number, local: V3, yaw = 0): Vector3 {
  const f = frame(at.n, at.facing, h, yaw);
  return new Vector3(...local).applyQuaternion(f.q).add(f.p);
}

const FIRE_LAMP = { color: new Color('#ffab5c'), intensity: 6.5, range: 4.2 } as const;
const PORCH_LAMP = { color: new Color('#ffd49a'), intensity: 3.6, range: 3.0 } as const;

/** The owner's home by the pond (docs: family.md §3): house, campsite, picnic, and their day–night life. */
export function HomeView({ controller, home, family }: { controller: GameController; home: Homestead; family: Family }) {
  const paused = useStore(controller.store, selectAmbientPaused);
  const ht = (n: Vector3) => controller.terrain.height(n);
  const models = useMemo(
    () => ({
      house: houseModel(),
      door: doorLeafModel(),
      ring: fireRingModel(),
      flames: flamesModel(),
      campA: campChairModel('#3f7fb8'),
      campB: campChairModel('#d9534f'),
      log: logBenchModel(),
      guitar: guitarModel(),
      table: tableModel(),
      chair: chairModel('#f2c14e'),
      armchair: armchairModel(),
      side: sideTableModel(),
      food: picnicFoodModel(),
      post: lightPostModel(),
      lego: legoModel(),
      carA: toyCarModel('#2f7fe0'),
      carB: toyCarModel('#f6c629'),
    }),
    [],
  );
  const houseH = ht(home.house.n) + 0.12;

  // the picnic mat: the painted gingham blanket, draped on the ground
  const mat = useMemo(() => {
    // (built in planet space: every vertex follows the ground and the planet's curve, just above the grass roots)
    const g = matGeometry();
    const f = frame(home.mat.n, home.mat.facing, 0, 0.35);
    const pos = g.getAttribute('position');
    const v = new Vector3();
    for (let i = 0; i < pos.count; i++) {
      const n = v.fromBufferAttribute(pos, i).applyQuaternion(f.q).add(f.p).normalize();
      v.multiplyScalar(R + ht(n) + 0.02);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    g.computeBoundingSphere();
    const tex = gameTexture('picnic-mat');
    const m = withLampLights(new MeshStandardMaterial({ map: tex ?? undefined, color: tex ? '#ffffff' : '#e46a5c', roughness: 0.95, metalness: 0, side: DoubleSide }));
    return { g, m };
  }, [home, controller]);

  const lego = useMemo(() => legoSpot(home, R), [home]);

  // the campfire's flames flicker; after dusk it (and the porch lantern) really light the scene
  const flames = useRef<Mesh>(null);
  const fireLamp = useMemo<Lamp>(() => ({ pos: toPlanet(home.fire, ht(home.fire.n), [0, 0.45, 0]), dir: null, color: FIRE_LAMP.color.clone(), intensity: 0, range: FIRE_LAMP.range }), [home]);
  const porchLamp = useMemo<Lamp>(() => ({ pos: toPlanet(home.house, houseH, models.house.lantern), dir: null, color: PORCH_LAMP.color.clone(), intensity: 0, range: PORCH_LAMP.range }), [home, houseH, models]);
  useEffect(() => addLamp(fireLamp), [fireLamp]);
  useEffect(() => addLamp(porchLamp), [porchLamp]);
  const food = useRef<Group>(null);
  const door = useRef<Group>(null);
  const guitar = useRef<Group>(null);
  const smoke = useRef<InstancedMesh>(null);
  const embers = useRef<InstancedMesh>(null);
  const smokeGeo = useMemo(() => new SphereGeometry(0.07, 8, 6), []);
  const smokeMat = useMemo(() => new MeshStandardMaterial({ color: '#f1ede6', roughness: 1, transparent: true, opacity: 0.28, depthWrite: false }), []);
  const emberGeo = useMemo(() => new SphereGeometry(0.018, 5, 4), []);
  const clock = useRef(0);

  // pebbles splashing into the pond: an expanding ripple ring each
  const splashes = useRef<Array<{ p: Vector3; q: Quaternion; t: number }>>([]);
  const rings = useRef<InstancedMesh>(null);
  const ringGeo = useMemo(() => new RingGeometry(0.8, 1, 24).rotateX(-Math.PI / 2), []);
  const ringMat = useMemo(() => new MeshBasicMaterial({ color: '#eaf6ff', transparent: true, opacity: 0.6, depthWrite: false }), []);

  // butterflies round the home (the children chase them)
  const wing = useMemo(() => butterflyWing(), []);
  const wingMats = useMemo(
    () =>
      ['#ffd84d', '#ff9ec7', '#9fd0ff'].map((c) => {
        const m = (kitMaterials().solid as MeshStandardMaterial).clone();
        m.color.set(c);
        m.side = DoubleSide;
        return m;
      }),
    [],
  );
  const flies = useRef<Array<{ root: Group | null; l: Group | null; r: Group | null }>>([]);

  // string lights from the house's corner to the post by the table: a sagging wire of glowing bulbs
  const lights = useMemo(() => {
    const a = toPlanet(home.house, houseH, models.house.lightsCorner);
    const b = home.lightsPost.clone().multiplyScalar(R + ht(home.lightsPost) + 1.8);
    const k = new Kit();
    const N = 14;
    const up = a.clone().add(b).normalize();
    let prev: Vector3 | null = null;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const p = a.clone().lerp(b, t).addScaledVector(up, -Math.sin(Math.PI * t) * 0.35);
      if (prev) {
        const mid = prev.clone().add(p).multiplyScalar(0.5);
        const len = prev.distanceTo(p);
        const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), p.clone().sub(prev).normalize());
        k.cyl(0.006, 0.006, len, '#3a3530', { p: mid.toArray() as V3, q }, 4);
      }
      if (i > 0 && i < N) k.sphere(0.035, ['#ffd98a', '#ffb37a', '#fff1c8'][i % 3], { p: p.clone().addScaledVector(up, -0.04).toArray() as V3 }, [6, 5], 'glow');
      prev = p;
    }
    return k.build();
  }, [home, houseH, models]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    if (!paused) clock.current += dt;
    const t = clock.current;
    const night = controller.sky.night;
    const on = lampsOn(night);
    // flames: a lively flicker, bigger after dark
    const flick = paused ? 1 : 0.85 + 0.1 * Math.sin(t * 13.1) + 0.07 * Math.sin(t * 21.7 + 1.3) + 0.05 * Math.sin(t * 5.3);
    const size = 0.75 + 0.35 * on;
    const fl = flames.current;
    if (fl) {
      fl.scale.set(size * (0.95 + 0.05 * Math.sin(t * 9)), size * flick, size * (0.95 + 0.05 * Math.cos(t * 8)));
      fl.rotation.y = paused ? 0 : Math.sin(t * 1.7) * 0.4;
    }
    fireLamp.intensity = FIRE_LAMP.intensity * on * flick;
    porchLamp.intensity = PORCH_LAMP.intensity * on;
    if (food.current) food.current.visible = family.foodOnTable;
    // the front door swings open for whoever goes through it (eased: it's an off-mesh link, family.ts)
    if (door.current) {
      const o = family.door.open;
      door.current.rotation.y = 1.75 * (o * o * (3 - 2 * o));
    }
    // the guitar leans on the camp chair, unless Prabin is playing it
    if (guitar.current) guitar.current.visible = family.get('prabin').held !== 'guitar';
    // smoke by day, embers by night, rising from the fire
    const sm = smoke.current;
    const em = embers.current;
    const tmp = new Matrix4();
    for (let i = 0; i < 6; i++) {
      const ph = (t * 0.35 + i / 6) % 1;
      const drift = new Vector3(Math.sin(i * 2.1 + t * 0.3) * 0.15 * ph, 0.5 + ph * 1.6, Math.cos(i * 1.7) * 0.12 * ph);
      if (sm) sm.setMatrixAt(i, tmp.compose(drift.multiplyScalar(0.8), new Quaternion(), new Vector3().setScalar((0.4 + ph * 1.2) * (1 - on) * (paused ? 0 : 1) * Math.sin(Math.PI * ph))));
      const ep = (t * 0.7 + i / 6) % 1;
      const ed = new Vector3(Math.sin(i * 3.3 + t) * 0.12, 0.35 + ep * 1.1, Math.cos(i * 2.7 + t * 0.8) * 0.12);
      if (em) em.setMatrixAt(i, tmp.compose(ed, new Quaternion(), new Vector3().setScalar(on * (paused ? 0 : 1) * (1 - ep))));
    }
    if (sm) sm.instanceMatrix.needsUpdate = true;
    if (em) em.instanceMatrix.needsUpdate = true;
    // splashes where Laija's pebbles land
    for (const e of family.events.splice(0)) {
      if (e.type !== 'splash') continue;
      const n = e.n.clone().normalize();
      const f = frame(n, tangentToward(n, home.centre) ?? home.house.facing, 0);
      splashes.current.push({ p: n.multiplyScalar(R + controller.terrain.height(n) + 0.02).clone(), q: f.q, t: 0 });
    }
    const rg = rings.current;
    if (rg) {
      splashes.current = splashes.current.filter((s) => (s.t += dt) < 1.4);
      for (let i = 0; i < 6; i++) {
        const s = splashes.current[i];
        const sc = s ? 0.1 + s.t * 0.35 : 0;
        rg.setMatrixAt(i, tmp.compose(s ? s.p : new Vector3(), s ? s.q : new Quaternion(), new Vector3(sc, sc, sc)));
      }
      rg.instanceMatrix.needsUpdate = true;
    }
    // butterflies (asleep at night)
    family.butterflies.forEach((b, i) => {
      const r = flies.current[i];
      if (!r?.root) return;
      r.root.visible = night < 0.5 && !paused;
      if (!r.root.visible) return;
      r.root.position.copy(b.n).multiplyScalar(R + controller.terrain.height(b.n) + b.h);
      r.root.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), b.n);
      r.root.rotateY(b.phase * 1.3);
      const flap = Math.sin(t * 16 + i) * 0.9;
      if (r.l) r.l.rotation.z = flap;
      if (r.r) r.r.rotation.z = -flap;
    });
  });

  const houseAt = home.house;
  const chairs = home.tableChairs;
  const carSpot: HomeSpot = { n: moveAlong(home.mat.n, home.mat.facing, 1.05 / R), facing: home.mat.facing };
  return (
    <group name="home">
      <Placed at={houseAt} h={houseH}>
        <group name="home-house">
          <KitModel geo={models.house.geo} />
          <group ref={door} position={DOOR_HINGE}>
            <KitModel geo={models.door} />
          </group>
        </group>
      </Placed>
      <Placed at={home.readingChair} h={ht(home.readingChair.n)} scale={PROP_SCALE}>
        <KitModel geo={models.armchair} />
      </Placed>
      <Placed at={home.sideTable} h={ht(home.sideTable.n)} scale={PROP_SCALE}>
        <KitModel geo={models.side} />
      </Placed>
      <Placed at={home.table} h={ht(home.table.n)} yaw={Math.PI / 2} scale={PROP_SCALE}>
        <KitModel geo={models.table} />
        <group ref={food} visible={false}>
          <KitModel geo={models.food} shadows={false} />
        </group>
      </Placed>
      {chairs.map((c, i) => (
        <Placed key={i} at={c} h={ht(c.n)} scale={PROP_SCALE}>
          <KitModel geo={models.chair} />
        </Placed>
      ))}
      <mesh geometry={mat.g} material={mat.m} receiveShadow />
      <Placed at={lego.brick} h={ht(lego.brick.n) + 0.03} scale={0.85}>
        <KitModel geo={models.lego} shadows="receive" />
      </Placed>
      <Placed at={carSpot} h={ht(carSpot.n)} yaw={0.7} scale={0.85}>
        <KitModel geo={models.carA} shadows="receive" />
      </Placed>
      <Placed at={home.fire} h={ht(home.fire.n)} scale={0.85}>
        <KitModel geo={models.ring} />
        <mesh ref={flames} geometry={models.flames} material={kitMaterials().glow} position={[0, 0.05, 0]} />
        <instancedMesh ref={smoke} args={[smokeGeo, smokeMat, 6]} frustumCulled={false} />
        <instancedMesh ref={embers} args={[emberGeo, kitMaterials().glow, 6]} frustumCulled={false} />
      </Placed>
      {home.campChairs.map((c, i) => (
        <Placed key={i} at={c} h={ht(c.n)} scale={PROP_SCALE}>
          <KitModel geo={i ? models.campB : models.campA} />
          {i === 0 && (
            <group ref={guitar} position={[0.34, 0, 0.12]} rotation={[0, -0.4, -0.28]}>
              <KitModel geo={models.guitar} />
            </group>
          )}
        </Placed>
      ))}
      <Placed at={home.log} h={ht(home.log.n)} scale={PROP_SCALE}>
        <KitModel geo={models.log} />
      </Placed>
      <Placed at={{ n: home.lightsPost, facing: home.table.facing }} h={ht(home.lightsPost)}>
        <KitModel geo={models.post} />
      </Placed>
      <KitModel geo={lights} shadows={false} />
      <instancedMesh ref={rings} args={[ringGeo, ringMat, 6]} frustumCulled={false} />
      <group name="home-butterflies">
        {family.butterflies.map((_, i) => (
          <group
            key={i}
            ref={(el) => {
              flies.current[i] = { ...(flies.current[i] ?? { l: null, r: null }), root: el };
            }}
          >
            <group ref={(el) => (flies.current[i] = { ...(flies.current[i] ?? { root: null, r: null }), l: el })}>
              <mesh geometry={wing} material={wingMats[i]} />
            </group>
            <group ref={(el) => (flies.current[i] = { ...(flies.current[i] ?? { root: null, l: null }), r: el })} rotation={[0, Math.PI, 0]}>
              <mesh geometry={wing} material={wingMats[i]} />
            </group>
          </group>
        ))}
      </group>
    </group>
  );
}
