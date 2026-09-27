import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useStore } from 'zustand';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { CONFIG } from '../config';
import type { GameController } from '../controller';
import type { LandmarkData } from '../types';
import { landmarkObjectQuaternion, type LandmarkGeometry } from '../math/landmarks';
import { damp } from '../math/sphere';
import { selectAmbientPaused, selectReducedMotion } from '../state/store';
import { clockHandAngles } from './clockFace';
import { lampsOn } from './DayNight';
import { addLamp, type Lamp } from './lampLights';
import { BEAM, BEAM_FRAG, BEAM_VERT } from './beam';
import { curtainColumn, DOOR, smooth, stepOpen } from './doors';
import type { KitGeometry, V3 } from './kit';
import { KitModel } from './KitModel';
import { kitMaterials } from './materials';
import { landmarkModel, type LandmarkModel } from './models';
import { ARCH, type DoorLeaf } from './parts';
import { withSurfaceDetail } from './rockDetail';

const R = CONFIG.planetRadius;

function Beam({ at, paused, controller }: { at: [number, number, number]; paused: boolean; controller: GameController }) {
  const ref = useRef<Group>(null);
  const { geo, mat } = useMemo(() => {
    // apex at the lamp, opening outward along +x
    const g = new ConeGeometry(BEAM.radius, BEAM.length, 28, 1, true);
    g.rotateZ(Math.PI / 2);
    g.translate(BEAM.length / 2, 0, 0);
    const m = new ShaderMaterial({
      uniforms: { uColor: { value: new Color('#fff3a6') }, uOpacity: { value: 0.3 }, uLength: { value: BEAM.length } },
      vertexShader: BEAM_VERT,
      fragmentShader: BEAM_FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    });
    return { geo: g, mat: m };
  }, []);
  useFrame((_, dt) => {
    if (ref.current && !paused) ref.current.rotation.y += dt * 0.7;
    mat.uniforms.uOpacity.value = 0.4 + 0.18 * controller.sky.night;
  });
  return (
    <group ref={ref} position={at}>
      <mesh geometry={geo} material={mat} renderOrder={2} />
    </group>
  );
}

function Smoke({ at, paused }: { at: [number, number, number]; paused: boolean }) {
  const puffs = useRef<Mesh[]>([]);
  const t = useRef(0);
  const { geo, mats } = useMemo(
    () => ({
      geo: new SphereGeometry(0.14, 12, 8),
      mats: [0, 1, 2].map(() => new MeshStandardMaterial({ color: '#f4f1ec', roughness: 1, transparent: true, opacity: 0.85, depthWrite: false })),
    }),
    [],
  );
  useFrame((_, dt) => {
    if (!paused) t.current += dt;
    puffs.current.forEach((m, i) => {
      if (!m) return;
      const p = (t.current * 0.35 + i / 3) % 1;
      m.position.set(Math.sin((p + i) * 3) * 0.08 + p * 0.25, p * 1.1, 0);
      m.scale.setScalar(0.6 + p * 1.1);
      mats[i].opacity = 0.8 * (1 - p);
      m.visible = !paused;
    });
  });
  return (
    <group position={at}>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) puffs.current[i] = el;
          }}
          geometry={geo}
          material={mats[i]}
        />
      ))}
    </group>
  );
}

function Flag({ at, color, paused, pole = 2.2 }: { at: [number, number, number]; color: string; paused: boolean; pole?: number }) {
  const cloth = useRef<Mesh>(null);
  const t = useRef(0);
  const { geo, mat, poleMat } = useMemo(() => {
    const g = new PlaneGeometry(0.55, 0.36, 8, 1);
    g.translate(0.275, 0, 0);
    return {
      geo: g,
      mat: new MeshStandardMaterial({ color, side: DoubleSide, roughness: 0.8 }),
      poleMat: new MeshStandardMaterial({ color: '#d8d8dc', roughness: 0.5, metalness: 0.3 }),
    };
  }, [color]);
  useFrame((_, dt) => {
    if (!cloth.current) return;
    if (!paused) t.current += dt;
    const pos = cloth.current.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      pos.setZ(i, Math.sin(t.current * 3 + x * 7) * 0.05 * x);
    }
    pos.needsUpdate = true;
  });
  return (
    <group position={at}>
      <mesh position={[0, pole / 2, 0]} material={poleMat} castShadow>
        <cylinderGeometry args={[0.025, 0.03, pole, 8]} />
      </mesh>
      <mesh position={[0, pole + 0.03, 0]} material={poleMat}>
        <sphereGeometry args={[0.05, 8, 6]} />
      </mesh>
      <mesh ref={cloth} geometry={geo} material={mat} position={[0.02, pole - 0.22, 0]} castShadow />
    </group>
  );
}

/** A clock hand pivoting at the origin and pointing up (12 o'clock), with a short tail. */
function handGeometry(width: number, length: number, depth: number, tail = 0.025): BoxGeometry {
  const g = new BoxGeometry(width, length + tail, depth);
  g.translate(0, (length - tail) / 2, 0);
  return g;
}

/**
 * Town-hall clock hands showing the visitor's device time (local time zone), always, whatever the
 * day–night mode. Updated once a second; the second hand ticks, and is hidden while ambient
 * motion is paused (hour and minute hands still tell the time).
 */
function ClockHands({ at, controller, paused }: { at: [number, number, number]; controller: GameController; paused: boolean }) {
  const hour = useRef<Mesh>(null);
  const minute = useRef<Mesh>(null);
  const second = useRef<Mesh>(null);
  const last = useRef(-1);
  const res = useMemo(() => {
    const cap = new CylinderGeometry(0.022, 0.022, 0.012, 12);
    cap.rotateX(Math.PI / 2);
    return {
      hourGeo: handGeometry(0.032, 0.11, 0.01),
      minuteGeo: handGeometry(0.024, 0.165, 0.01),
      secondGeo: handGeometry(0.007, 0.175, 0.006, 0.04),
      cap,
      iron: new MeshStandardMaterial({ color: ARCH.iron, roughness: 0.7, metalness: 0 }),
      red: new MeshStandardMaterial({ color: '#d4483b', roughness: 0.6 }),
      brass: new MeshStandardMaterial({ color: ARCH.brass, roughness: 0.4, metalness: 0.4 }),
    };
  }, []);
  useFrame(() => {
    const now = new Date();
    const stamp = Math.floor(now.getTime() / 1000);
    if (stamp === last.current || !hour.current || !minute.current || !second.current) return;
    last.current = stamp;
    const a = clockHandAngles(now);
    hour.current.rotation.z = -a.hour;
    minute.current.rotation.z = -a.minute;
    second.current.rotation.z = -a.second;
    controller.clockHands = a;
  });
  return (
    <group position={at} name="town-hall-clock">
      <mesh ref={hour} geometry={res.hourGeo} material={res.iron} position={[0, 0, 0.012]} />
      <mesh ref={minute} geometry={res.minuteGeo} material={res.iron} position={[0, 0, 0.022]} />
      <mesh ref={second} geometry={res.secondGeo} material={res.red} position={[0, 0, 0.03]} visible={!paused} />
      <mesh geometry={res.cap} material={res.brass} position={[0, 0, 0.034]} />
    </group>
  );
}

function MailFlag({ at, active }: { at: [number, number, number]; active: boolean }) {
  const ref = useRef<Group>(null);
  const mat = useMemo(() => new MeshStandardMaterial({ color: '#f2b544', roughness: 0.6 }), []);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.x = damp(ref.current.rotation.x, active ? 0 : Math.PI / 2, 10, dt);
  });
  return (
    <group ref={ref} position={at}>
      <mesh position={[0, 0.2, 0]} material={mat}>
        <boxGeometry args={[0.04, 0.4, 0.04]} />
      </mesh>
      <mesh position={[0, 0.34, -0.1]} material={mat}>
        <boxGeometry args={[0.03, 0.14, 0.2]} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Doors that open as you come near, the rooms behind them, and their light at night
// ---------------------------------------------------------------------------

type Openness = { current: number };

function DoorLeaves({ leaves, open }: { leaves: DoorLeaf[]; open: Openness }) {
  const refs = useRef<(Group | null)[]>([]);
  useFrame(() => {
    const a = DOOR.swing * smooth(open.current);
    leaves.forEach((l, i) => {
      const g = refs.current[i];
      if (g) g.rotation.y = l.dir * a;
    });
  });
  return (
    <>
      {leaves.map((l, i) => (
        <group key={i} position={l.hinge} ref={(el) => void (refs.current[i] = el)} name="door-leaf">
          <KitModel geo={l.geo} shadows="receive" />
        </group>
      ))}
    </>
  );
}

let interiorMat: MeshStandardMaterial | null = null;

/**
 * Rooms behind the doors: the kit's surface detail plus a warm emissive that is tinted by each
 * part's own colour (so the room reads as lamplit, not flat orange). Shared by every landmark; the
 * glow depends only on the time of day.
 */
function interiorMaterial(): MeshStandardMaterial {
  if (!interiorMat) {
    const m = withSurfaceDetail(new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, emissive: '#ffcf96', emissiveIntensity: 0.2 }), 0.36, 1.1);
    const prev = m.onBeforeCompile;
    const prevKey = m.customProgramCacheKey.bind(m);
    m.onBeforeCompile = (shader, renderer) => {
      prev.call(m, shader, renderer);
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= diffuseColor.rgb;');
    };
    m.customProgramCacheKey = () => `${prevKey()}|interior-lit`;
    interiorMat = m;
  }
  return interiorMat;
}

function Interior({ geo, open, controller }: { geo: KitGeometry; open: Openness; controller: GameController }) {
  const group = useRef<Group>(null);
  const mat = interiorMaterial();
  useFrame(() => {
    if (group.current) group.current.visible = open.current > 0.002;
    mat.emissiveIntensity = 0.18 + 0.45 * lampsOn(controller.sky.night);
  });
  return (
    <group ref={group} visible={false} name="interior">
      {geo.solid && <mesh geometry={geo.solid} material={mat} receiveShadow />}
      {geo.glow && <mesh geometry={geo.glow} material={kitMaterials().glow} />}
    </group>
  );
}

/** Peak intensities (candela) of the lamplight out of an open door and of the stage spotlight. */
const DOOR_LAMP = 5;
const STAGE_LAMP = 9;

/** A landmark-local point or direction in planet space. */
function toPlanet(v: Vector3, place: { position: Vector3; quaternion: Quaternion }, isDir = false): Vector3 {
  v.applyQuaternion(place.quaternion);
  return isDir ? v.normalize() : v.add(place.position);
}

/**
 * Lamplight out of an open door after dusk: a soft spot from just inside the doorway, aimed out and
 * down over the steps and the path, so the lit ground is the painted ground brightened (lampLights.ts).
 */
function DoorLamp({
  spill,
  from,
  open,
  controller,
  place,
}: {
  spill: NonNullable<LandmarkModel['spill']>;
  from: V3;
  open: Openness;
  controller: GameController;
  place: { position: Vector3; quaternion: Quaternion };
}) {
  const lamp = useMemo<Lamp>(() => {
    const src = new Vector3(...from);
    const target = new Vector3(spill.p[0], 0, spill.p[2] + spill.len * 0.45);
    const dir = target.clone().sub(src).normalize();
    return {
      pos: toPlanet(src, place),
      dir: toPlanet(dir, place, true),
      color: new Color('#ffc27a'),
      intensity: 0,
      range: spill.len + 1.8,
      cone: [1.0, 0.4],
    };
  }, [spill, from, place]);
  useEffect(() => addLamp(lamp), [lamp]);
  useFrame(() => {
    lamp.intensity = DOOR_LAMP * smooth(open.current) * lampsOn(controller.sky.night);
  });
  return null;
}

/**
 * The amphitheater's "door": a velvet festoon curtain across the band shell's arch. Its top follows
 * the arch; as it opens the hem rises on five lift cords into a scalloped valance and the fabric
 * gathers. The vertices are rewritten only while it moves.
 */
function Curtain({ spec, open }: { spec: NonNullable<LandmarkModel['curtain']>; open: Openness }) {
  const NX = 41;
  const NY = 10;
  const last = useRef(-1);
  const { geo, mat } = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(new Float32Array(NX * NY * 3), 3));
    const col: number[] = [];
    const red = [0.62, 0.1, 0.16];
    const gold = [0.89, 0.66, 0.26];
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NX; i++) {
        const fold = 0.82 + 0.18 * Math.cos((i / (NX - 1)) * Math.PI * 24);
        const c = j === 0 ? gold : red.map((v) => v * fold);
        col.push(c[0], c[1], c[2]);
      }
    g.setAttribute('color', new Float32BufferAttribute(col, 3));
    const idx: number[] = [];
    for (let j = 0; j < NY - 1; j++)
      for (let i = 0; i < NX - 1; i++) {
        const a = j * NX + i;
        const b = a + NX;
        idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    g.setIndex(idx);
    return { geo: g, mat: new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 0.92 }) };
  }, []);
  useFrame(() => {
    const e = smooth(open.current);
    if (Math.abs(e - last.current) < 1e-4) return;
    last.current = e;
    const pos = geo.getAttribute('position') as Float32BufferAttribute;
    const [px, py, pz] = spec.p;
    const r = spec.r;
    for (let i = 0; i < NX; i++) {
      const u = i / (NX - 1);
      const { x, top, bottom } = curtainColumn(u, e, r, py);
      const pleat = Math.sin(u * Math.PI * 24) * 0.022 * (1 + e);
      for (let j = 0; j < NY; j++) {
        const v = j / (NY - 1);
        const y = bottom + (top - bottom) * v;
        const ruffle = e * 0.035 * Math.sin(v * Math.PI * 5) * (1 - v);
        pos.setXYZ(j * NX + i, px + x, y, pz + pleat + ruffle);
      }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  });
  return <mesh geometry={geo} material={mat} castShadow name="curtain" />;
}

/** Stage spotlights for the amphitheater: soft beams and a pool of light on the stage while the curtain is up. */
function StageLights({
  spots,
  open,
  controller,
  place,
}: {
  spots: NonNullable<LandmarkModel['spots']>;
  open: Openness;
  controller: GameController;
  place: { position: Vector3; quaternion: Quaternion };
}) {
  const group = useRef<Group>(null);
  // the light on the stage: one spot from between the two lamps, its cone just covering the pool
  const lamp = useMemo<Lamp>(() => {
    const to = new Vector3(...spots.to);
    const src = spots.from.reduce((a, f) => a.add(new Vector3(...f)), new Vector3()).divideScalar(spots.from.length);
    const dist = src.distanceTo(to);
    const outer = Math.atan((spots.pool + 0.2) / dist);
    const dir = to.clone().sub(src).normalize();
    return { pos: toPlanet(src, place), dir: toPlanet(dir, place, true), color: new Color('#fff0c8'), intensity: 0, range: dist + 1.6, cone: [outer, outer * 0.55] };
  }, [spots, place]);
  useEffect(() => addLamp(lamp), [lamp]);
  const { beams, beamMat } = useMemo(() => {
    const to = new Vector3(...spots.to);
    const beamGeos = spots.from.map((f) => {
      const from = new Vector3(...f);
      const len = from.distanceTo(to);
      const g = new ConeGeometry(0.42, len, 20, 1, true);
      g.translate(0, -len / 2, 0); // apex at the lamp
      g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, -1, 0), to.clone().sub(from).normalize()));
      g.translate(from.x, from.y, from.z);
      return g;
    });
    return {
      // the beams are light scattered in the air, so they stay additive (volumetric shafts)
      beams: beamGeos,
      beamMat: new MeshBasicMaterial({ color: '#fff0c8', transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, side: DoubleSide, fog: false }),
    };
  }, [spots]);
  useFrame(() => {
    const e = smooth(open.current);
    const on = lampsOn(controller.sky.night);
    beamMat.opacity = e * (0.012 + 0.05 * on);
    lamp.intensity = STAGE_LAMP * e * (0.3 + 0.7 * on);
    if (group.current) group.current.visible = e > 0.002;
  });
  return (
    <group ref={group} visible={false} name="stage-lights">
      {beams.map((g, i) => (
        <mesh key={i} geometry={g} material={beamMat} renderOrder={2} />
      ))}
    </group>
  );
}

/**
 * One warm point light shared by every door: it sits just inside whichever doorway is most open
 * and shines out after dusk (on the steps, the path and the character). It always stays in the
 * scene (intensity 0 when unused) so the light count and shader programs never change.
 */
export function DoorLight({ controller }: { controller: GameController }) {
  const light = useMemo(() => {
    const l = new PointLight('#ffc27a', 0, 2.8, 1.5);
    l.castShadow = false;
    return l;
  }, []);
  useFrame(() => {
    let id: string | null = null;
    let best = 0;
    for (const [k, d] of controller.doors) {
      if (d.light && d.open > best) {
        best = d.open;
        id = k;
        light.position.copy(d.light);
      }
    }
    light.intensity = id ? 3.2 * smooth(best) * lampsOn(controller.sky.night) : 0;
    controller.doorLight.id = light.intensity > 0 ? id : null;
    controller.doorLight.intensity = light.intensity;
  });
  return <primitive object={light} />;
}

export function Landmark({ controller, geo, data }: { controller: GameController; geo: LandmarkGeometry; data: LandmarkData }) {
  const active = useStore(controller.store, (s) => s.nearbyId === geo.id && !s.traveling);
  const reduced = useStore(controller.store, selectReducedMotion);
  const paused = useStore(controller.store, selectAmbientPaused);
  const body = useRef<Group>(null);
  const model = useMemo(() => landmarkModel(data.variant, data.accent), [data.variant, data.accent]);

  // (on its levelled pad: the ground under it is the plane its base stands on, world/pads.ts)
  const place = useMemo(() => ({ position: geo.n.clone().multiplyScalar(R + controller.terrain.height(geo.n) - 0.01), quaternion: landmarkObjectQuaternion(geo) }), [geo, controller]);
  const { position, quaternion } = place;

  // (the glowing ring round it while its card is up is drawn by world/cues.tsx)
  const open = useMemo<Openness>(() => ({ current: 0 }), []);
  const hasDoor = !!(model.doors?.length || model.curtain);
  const lightAt = useMemo(() => (model.light ? new Vector3(...(model.light as V3)).applyQuaternion(quaternion).add(position) : null), [model, position, quaternion]);

  useFrame((_, dt) => {
    if (hasDoor) {
      open.current = stepOpen(open.current, active ? 1 : 0, dt, reduced);
      const d = controller.doors.get(geo.id);
      if (d) d.open = open.current;
      else controller.doors.set(geo.id, { open: open.current, light: lightAt, curtain: !!model.curtain });
    }
    const target = active ? 1.035 : 1;
    const g = body.current;
    if (g) {
      const s = reduced ? target : damp(g.scale.x, target, 12, dt);
      g.scale.setScalar(s);
    }
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (controller.viewDragged || e.delta > CONFIG.camera.dragThresholdPx) return;
    controller.travelTo(geo.id);
  };

  return (
    <group
      position={position}
      quaternion={quaternion}
      name={`landmark-${geo.id}`}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <group ref={body}>
        <KitModel geo={model.geo} />
        {model.anchors.beam && <Beam at={model.anchors.beam} paused={paused} controller={controller} />}
        {model.anchors.smoke && <Smoke at={model.anchors.smoke} paused={paused} />}
        {data.variant === 'town-hall' && model.anchors.flag && <Flag at={model.anchors.flag} color={data.accent} paused={paused} />}
        {model.anchors.clock && <ClockHands at={model.anchors.clock} controller={controller} paused={paused} />}
        {data.variant === 'post-office' && model.anchors.flag && <MailFlag at={model.anchors.flag} active={active} />}
        {model.doors && <DoorLeaves leaves={model.doors} open={open} />}
        {model.interior && <Interior geo={model.interior} open={open} controller={controller} />}
        {model.curtain && <Curtain spec={model.curtain} open={open} />}
        {model.spots && <StageLights spots={model.spots} open={open} controller={controller} place={place} />}
      </group>
      {model.spill && model.light && <DoorLamp spill={model.spill} from={model.light as V3} open={open} controller={controller} place={place} />}
      {active && (
        // (spatial UI: under the HUD layer, --layer-hud = 10, so a lane surface always covers it)
        <Html position={[0, model.height + 0.45, 0]} center zIndexRange={[9, 0]} className="world-label-wrap">
          <div className="world-label" aria-hidden="true" style={{ ['--accent' as string]: data.accent }}>
            {data.title}
          </div>
        </Html>
      )}
    </group>
  );
}
