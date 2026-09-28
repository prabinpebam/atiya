/**
 * The furnace behind the workyard and the clay beds on the banks (docs: furnace.md), in the crafting
 * chunk: the furnace's site (a ghost, a card, a target that builds it, then uses it), its fire and
 * smoke (hot while it smelts, cooling after), its ready cue, and the clay beds you dig (targets like
 * the jute row's, scooped out and refilling).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactElement } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from 'zustand';
import { AdditiveBlending, Color, DoubleSide, Group, InstancedMesh, LineBasicMaterial, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Object3D, PlaneGeometry, Quaternion, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
// (icons the game already ships where one fits: each new one costs the main bundle, which holds the icon module)
import { faFire, faHammer, faHand } from '@fortawesome/free-solid-svg-icons';
import { CONFIG } from '../../config';
import type { FurnaceState, GameController } from '../../controller';
import { UP, arcDistance, clamp, moveAlong, tangentToward } from '../../math/sphere';
import { selectAmbientPaused, selectReducedMotion } from '../../state/store';
import type { Target } from '../../systems/interactables';
import { ReadyCue } from '../../systems/readyCue';
import type { PadSpec } from '../pads';
import { KitModel } from '../KitModel';
import { addLamp, withLampLights, type Lamp } from '../lampLights';
import { lampsOn } from '../DayNight';
import { Sparkles } from '../Sparkles';
import { CLAY, clayBeds, type ClayBed } from './clay';
import { CLAY_COLOURS, FIRE_Z, FURNACE, FURNACE_BASE, LUMPS, bedFrame, clayBedsModel, clayLumpGeometry, fireGeometry, furnaceGhost, furnaceModel } from './furnaceModels';
import { prebuilt } from '../prebuilt';
import { BUILD_S, FURNACE_COOL_S, FURNACE_NEEDS, FURNACE_R, GHOST_FAR, GHOST_NEAR, TARGET_REACH, listNeeds, missing, takeNeeds } from './recipes';
import type { CraftStore } from './index';

const KEY = 'site.furnace';
const R = CONFIG.planetRadius;
const KNOCKS = [0.15, 0.5, 0.85];

function loadBuilt(): boolean {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? 'null') as { built?: unknown } | null)?.built === true;
  } catch {
    return false;
  }
}

function saveBuilt(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ built: true }));
  } catch {
    // private mode: it just won't be remembered
  }
}

/** What the view reads each frame: the ghost's visibility, how hot the furnace is, each clay bed's seconds until it's full again. */
export interface FurnaceLink {
  ghost: number;
  heat: number;
  clay: number[];
  cue: ReadyCue;
}

export interface FurnaceAttachment {
  beds: readonly ClayBed[];
  View: () => ReactElement;
  /** Its models, to build ahead (world/prebuilt.ts). */
  models: ReadonlyArray<readonly [string, () => unknown]>;
  /** Its card is up (its site is what E would use, and it isn't built). */
  near(key: string | undefined): boolean;
  step(dt: number, smelting: boolean): void;
  state(): FurnaceState;
}

export function attachFurnace(controller: GameController, store: CraftStore): FurnaceAttachment | null {
  const site = controller.props.furnace;
  const inv = controller.inventory;
  // the clay beds, placed round what's already there (the home's and the chunks' targets included)
  const beds = clayBeds(
    {
      river: controller.props.river,
      pond: controller.props.pond,
      inWater: (n) => controller.terrain.inWater(n),
      pondShore: (n) => controller.terrain.pondShore(n),
      height: (n) => controller.terrain.height(n),
      obstacles: controller.staticObstacles,
      targets: controller.targets,
      bridges: controller.props.bridges,
      mesas: controller.props.mesas,
      paths: controller.geos.map((g) => [UP, g.approach] as const),
      clear: controller.props.home?.clear ?? [],
      landmarks: controller.geos,
    },
    R,
  );
  // nothing grows or lies on them (and the furnace stands on bare, flat, cobbled ground)
  const props = controller.props;
  const under = (n: Vector3, r: number) => beds.some((b) => arcDistance(n, b.n, R) < CLAY.radiusU + r);
  for (const list of [props.pebbles, props.sprigs]) for (let i = list.length - 1; i >= 0; i--) if (under(list[i].n, 0.2)) list.splice(i, 1);
  props.bare = [...(props.bare ?? []), ...beds.map((b) => ({ n: b.n, r: CLAY.radiusU + 0.1 })), ...(site ? [{ n: site.n, r: 0.7 }] : [])];
  // (groundPads' padSpec, written out: importing that module from this chunk re-splits the main bundle's shared chunks)
  const [x0, x1, z0, z1] = FURNACE_BASE;
  const pad: PadSpec | null = site && { id: 'furnace', n: site.n, facing: site.facing, x0, x1, z0, z1, skirt: 0.6, apron: 0.4 };
  if (pad) controller.terrain.addPads([pad]);

  const link: FurnaceLink = { ghost: 0, heat: 0, clay: beds.map(() => 0), cue: new ReadyCue() };
  const up = () => site && controller.replaceObstacles(() => false, [{ n: site.n, radiusU: FURNACE_R }]);
  store.setState({ furnaceBuilt: Boolean(site) && loadBuilt(), furnaceBuilding: null });
  if (store.getState().furnaceBuilt) up();

  const build = () => {
    if (!site || !takeNeeds(inv, FURNACE_NEEDS)) return;
    controller.invChanged();
    store.setState({ furnaceBuilt: true, furnaceBuilding: 0 });
    saveBuilt();
    // step back out of its footprint, then it goes up
    const p = controller.sim.pLocal;
    if (arcDistance(p, site.n, R) < FURNACE_R + CONFIG.playerRadius + 0.05) {
      const out = tangentToward(site.n, p) ?? site.facing;
      controller.sim.placeAt(moveAlong(site.n, out, (FURNACE_R + CONFIG.playerRadius + 0.1) / R));
    }
    up();
    controller.announce('You build the furnace! Smelt iron ore into ingots in it, with firewood to burn.');
    controller.refreshTarget();
  };

  if (site)
    controller.targets.push({
      kind: 'site',
      key: 'site:furnace',
      n: site.n,
      edgeU: FURNACE_R,
      reachU: TARGET_REACH.site,
      standU: FURNACE_R + 0.5,
      index: 0,
      facing: site.facing,
      scale: 1,
      label() {
        if (store.getState().furnaceBuilt) return 'Use the furnace';
        return missing(inv, FURNACE_NEEDS).length ? 'See what the furnace needs' : 'Build the furnace';
      },
      // (usable while it goes up, like the swing's, so the prompt doesn't drop and re-announce over "You build the furnace!")
      use() {
        const s = store.getState();
        if (s.furnaceBuilding !== null) return;
        if (s.furnaceBuilt) {
          controller.openCraft('furnace');
          return;
        }
        const miss = missing(inv, FURNACE_NEEDS);
        if (miss.length) {
          controller.showToast(`The furnace still needs ${listNeeds(miss)}. Make stone blocks at the crafting table, and dig clay on the banks of the stream and the pond.`);
          return;
        }
        build();
      },
      icon: () => (store.getState().furnaceBuilt ? faFire : faHammer),
    });

  // the clay beds: dig (the gathering cycle), two lumps of clay fall at your feet, and it fills back up
  beds.forEach((b, i) => {
    const t: Target = {
      kind: 'clay',
      key: `clay:${i}`,
      n: b.n,
      edgeU: CLAY.radiusU,
      reachU: CLAY.reach,
      standU: CLAY.radiusU + 0.4,
      index: i,
      facing: b.facing,
      scale: 1,
      markU: CLAY.radiusU + 0.14,
      label: () => 'Dig clay',
      usable: () => link.clay[i] <= 0,
      use: () => {
        if (link.clay[i] <= 0) controller.startAction('pick', t);
      },
      onBeat: (beat) => {
        if (beat !== 'pluck' || link.clay[i] > 0) return;
        link.clay[i] = CLAY.regrow;
        const at = b.n.clone().multiplyScalar(R + controller.terrain.height(b.n) + 0.35);
        for (let k = 0; k < CLAY.yield; k++) controller.spawnDrop('clay', 1, at, 1.4, 0.5, 0.4);
        controller.sound.rustle();
        controller.refreshTarget();
      },
      icon: () => faHand,
    };
    controller.targets.push(t);
  });

  return {
    beds,
    models: [
      ['furnace.model', furnaceModel],
      ['furnace.ghost', furnaceGhost],
      ['furnace.fire', fireGeometry],
    ],
    View: () => <FurnaceView controller={controller} store={store} link={link} beds={beds} />,
    near(key) {
      return key === 'site:furnace' && !store.getState().furnaceBuilt;
    },
    step(dt, smelting) {
      const s = store.getState();
      const d = site ? arcDistance(controller.sim.pLocal, site.n, R) : Infinity;
      link.ghost = s.furnaceBuilt ? 0 : clamp((GHOST_FAR - d) / (GHOST_FAR - GHOST_NEAR), 0, 1);
      // hot while it smelts, cooling slowly after
      link.heat = smelting ? 1 : Math.max(0, link.heat - dt / FURNACE_COOL_S);
      link.cue.step(dt, s.furnaceBuilt && controller.store.getState().target?.key === 'site:furnace');
      link.clay.forEach((left, i) => {
        if (left > 0) link.clay[i] = Math.max(0, left - dt);
      });
      if (s.furnaceBuilding !== null) {
        const reduced = selectReducedMotion(controller.store.getState());
        const t = reduced ? BUILD_S : s.furnaceBuilding + dt;
        for (const k of KNOCKS) if (s.furnaceBuilding < k && t >= k && !reduced) controller.sound.hit();
        if (t >= BUILD_S) {
          store.setState({ furnaceBuilding: null });
          controller.sound.pickup();
        } else store.setState({ furnaceBuilding: t });
      }
    },
    state() {
      const s = store.getState();
      return { built: s.furnaceBuilt, building: s.furnaceBuilding !== null, ghost: link.ghost, near: s.near === 'furnace', heat: link.heat, clay: beds.map((b, i) => ({ n: b.n.toArray() as [number, number, number], water: b.water, left: link.clay[i] })) };
    },
  };
}

// ---------------------------------------------------------------------------
// drawing

const _x = new Vector3();
const _mm = new Matrix4();
const easeOutBack = (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
const PUFFS = 6;

/** Position and orientation for a model standing at `n` with its front along `facing`. */
function frame(n: Vector3, facing: Vector3, h: number): { p: Vector3; q: Quaternion } {
  const z = facing.clone().addScaledVector(n, -facing.dot(n)).normalize();
  const x = _x.crossVectors(n, z).normalize();
  return { p: n.clone().multiplyScalar(R + h), q: new Quaternion().setFromRotationMatrix(_mm.makeBasis(x, n, z)) };
}

/** The ground's normal at `n` (planet-local), from the terrain's heights a bed's width either side. */
function groundUp(controller: GameController, n: Vector3): Vector3 {
  const e = tangentToward(n, new Vector3(1, 0.3, 0.2).normalize()) ?? new Vector3(1, 0, 0);
  const f = new Vector3().crossVectors(n, e).normalize();
  const s = 0.2;
  const h = (d: Vector3, k: number) => controller.terrain.height(moveAlong(n, d, (k * s) / R));
  const dx = (h(e, 1) - h(e, -1)) / (2 * s);
  const dz = (h(f, 1) - h(f, -1)) / (2 * s);
  return n.clone().addScaledVector(e, -dx).addScaledVector(f, -dz).normalize();
}

function FurnaceView({ controller, store, link, beds }: { controller: GameController; store: CraftStore; link: FurnaceLink; beds: readonly ClayBed[] }) {
  const site = controller.props.furnace;
  const built = useStore(store, (s) => s.furnaceBuilt);
  const building = useStore(store, (s) => s.furnaceBuilding !== null);
  const at = useMemo(() => (site ? frame(site.n, site.facing, controller.terrain.height(site.n) - 0.02) : null), [site, controller]);
  const geo = useMemo(() => prebuilt('furnace.model', furnaceModel), []);
  const ghost = useMemo(() => prebuilt('furnace.ghost', furnaceGhost), []);
  const bedsAt = useMemo(() => beds.map((b) => bedFrame(b.n, groundUp(controller, b.n), b.facing, R + controller.terrain.height(b.n) + 0.004)), [beds, controller]);
  const bedGeo = useMemo(() => (beds.length ? clayBedsModel(beds, (b) => bedsAt[beds.indexOf(b)]) : null), [beds, bedsAt]);
  const mats = useMemo(
    () => ({
      fill: new MeshBasicMaterial({ color: '#a8d8ff', transparent: true, opacity: 0, depthWrite: false, side: DoubleSide, toneMapped: false }),
      line: new LineBasicMaterial({ color: '#dff1ff', transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
      // the fire: a painted gradient (fireGeometry), held below the tone mapper's white point so it stays orange; black when cold
      fire: new MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
      // its glow in the air in front of the mouth (additive: light in the air, never on a surface)
      glow: new ShaderMaterial({
        uniforms: { uI: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform float uI; varying vec2 vUv; void main() { vec2 d = vUv * 2.0 - 1.0; float a = 1.0 - clamp(dot(d, d), 0.0, 1.0); a = a * a * uI; gl_FragColor = vec4(vec3(1.0, 0.42, 0.1) * a, a); }',
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
      }),
      smoke: withLampLights(new MeshStandardMaterial({ color: '#d9d4cc', roughness: 1, transparent: true, opacity: 0.5, depthWrite: false })),
      lump: withLampLights(new MeshStandardMaterial({ color: CLAY_COLOURS.lump, roughness: 0.32, metalness: 0 })),
    }),
    [],
  );
  const fire = useMemo(() => prebuilt('furnace.fire', fireGeometry), []);
  const glowGeo = useMemo(() => new PlaneGeometry(0.8, 0.62), []);
  // at night, the fire lights the hearth and the ground in front (a real lamp: lampLights.ts), only while it's hot
  const lamp = useMemo<Lamp | null>(() => (at ? { pos: new Vector3(0, MOUTH_Y + 0.1, FIRE_Z + 0.35).applyQuaternion(at.q).add(at.p), dir: null, color: new Color('#ff9a4a'), intensity: 0, range: 1.8 } : null), [at]);
  useEffect(() => (built && lamp ? addLamp(lamp) : undefined), [built, lamp]);
  const puffGeo = useMemo(() => new SphereGeometry(0.08, 8, 6), []);
  const lumpGeo = useMemo(() => clayLumpGeometry(), []);
  useEffect(
    () => () => {
      for (const g of [geo.solid, geo.glow, geo.glass, ghost.fill, ghost.edges, fire, glowGeo, puffGeo, lumpGeo, bedGeo?.solid]) g?.dispose();
    },
    [geo, ghost, fire, glowGeo, puffGeo, lumpGeo, bedGeo],
  );
  const body = useRef<Group>(null);
  const ghostRef = useRef<Group>(null);
  const smoke = useRef<InstancedMesh>(null);
  const lumps = useRef<InstancedMesh>(null);
  const tmp = useMemo(() => new Object3D(), []);
  const shown = useRef<number[]>([]);
  const time = useRef(0);
  const warm = useRef<Color>(new Color());

  // the lumps, as full as each bed is (set when it changes, not every frame)
  const placeLumps = (fill: (i: number) => number) => {
    const m = lumps.current;
    if (!m) return;
    beds.forEach((_, i) => {
      const f = fill(i);
      LUMPS.forEach(([x, y, z, s], j) => {
        const k = clamp(f * 1.2 - j * 0.1, 0, 1);
        tmp.position.set(x, y, z).applyQuaternion(bedsAt[i].q).add(bedsAt[i].p);
        tmp.quaternion.copy(bedsAt[i].q);
        tmp.scale.setScalar(Math.max(0.0001, s * k));
        tmp.updateMatrix();
        m.setMatrixAt(i * LUMPS.length + j, tmp.matrix);
      });
    });
    m.instanceMatrix.needsUpdate = true;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => placeLumps(() => 1), [bedsAt]);

  useFrame(({ clock }, dt) => {
    const g = controller.store.getState();
    const reduced = selectReducedMotion(g);
    const paused = selectAmbientPaused(g);
    if (!paused) time.current += dt;
    const s = store.getState();
    const t = s.furnaceBuilding;
    // the ghost: faint from afar, clear up close, with a slow shimmer; it fades as the furnace goes up
    const gh = ghostRef.current;
    if (gh) {
      const fade = t === null ? 1 : Math.max(0, 1 - t / 0.6);
      const shimmer = reduced ? 1 : 0.86 + 0.14 * Math.sin(clock.elapsedTime * 2.1);
      const o = (t === null && built ? 0 : 1) * fade;
      mats.line.opacity = (0.05 + 0.8 * Math.pow(link.ghost, 1.3)) * shimmer * o;
      mats.fill.opacity = 0.16 * Math.pow(link.ghost, 1.6) * shimmer * o;
      gh.visible = mats.line.opacity > 0.004;
    }
    // it rises out of the ground, a little overshoot, and settles
    const b = body.current;
    if (b) {
      const p = t === null ? 1 : Math.min(1, Math.max(0, (t - 0.3) / 1.4));
      b.scale.set(1, Math.max(0.02, p <= 0 ? 0.02 : easeOutBack(p)), 1);
      b.visible = built && p > 0;
    }
    // the fire: dark when it's cold, roaring while it smelts and dying down to embers as it cools (the
    // ready cue is the sparkles, not the fire). The mesh stays drawn (black when cold), so its program
    // compiled with the scene.
    const tt = time.current;
    const flick = reduced ? 1 : 0.82 + 0.12 * Math.sin(tt * 13.1) + 0.06 * Math.sin(tt * 29.7 + 1.3);
    const level = link.heat;
    // (the gradient's in the vertex colours; this is the heat: dull red embers up to a bright roar)
    const k = 0.88 * Math.sqrt(level) * flick;
    mats.fire.color.copy(warm.current.setRGB(1, 0.55 + 0.45 * level, 0.45 + 0.55 * level)).multiplyScalar(k);
    mats.glow.uniforms.uI.value = 0.85 * level * flick;
    if (lamp) lamp.intensity = 1.6 * level * flick * lampsOn(controller.sky.night);
    // smoke from the chimney while it's warm (sparks while it roars: the Sparkles)
    const m = smoke.current;
    if (m) {
      const on = built && link.heat > 0.02 && !paused;
      m.count = on ? PUFFS : 0;
      if (on) {
        const c = FURNACE.chimney;
        for (let i = 0; i < PUFFS; i++) {
          const life = (tt * 0.28 + i / PUFFS) % 1;
          tmp.position.set(Math.sin(life * 5 + i) * 0.06 + life * 0.18, c.top + 0.08 + life * 1.0, c.z);
          tmp.quaternion.identity();
          tmp.scale.setScalar(0.5 + life * 1.3);
          tmp.updateMatrix();
          m.setMatrixAt(i, tmp.matrix);
        }
        m.instanceMatrix.needsUpdate = true;
        mats.smoke.opacity = 0.42 * link.heat;
      }
    }
    // the clay beds swell back as they refill
    const fills = link.clay.map((left) => 1 - left / CLAY.regrow);
    if (fills.some((f, i) => Math.abs(f - (shown.current[i] ?? 1)) > 0.02 || (f === 1 && shown.current[i] !== 1))) {
      shown.current = fills;
      placeLumps((i) => fills[i]);
    }
  });

  const sparks = useMemo(() => ({ on: 0, since: Infinity, active: false, wakes: 0 }) as ReadyCue, []);
  useFrame(() => {
    // (the chimney's sparks: a cue that's "on" while it roars)
    sparks.on = link.heat > 0.6 ? link.heat : 0;
  });

  return (
    <>
      {at && (
        <group name="furnace-site" position={at.p} quaternion={at.q}>
          {(!built || building) && (
            <group ref={ghostRef} name="furnace-ghost">
              <mesh geometry={ghost.fill} material={mats.fill} renderOrder={3} />
              <lineSegments geometry={ghost.edges} material={mats.line} renderOrder={4} />
            </group>
          )}
          {/* (mounted visible, so its fire compiles with the scene; hidden until it's built) */}
          <group ref={body} name="furnace">
            <KitModel geo={geo} />
            <mesh geometry={fire} material={mats.fire} />
            <mesh geometry={glowGeo} material={mats.glow} position={[0, MOUTH_Y, FIRE_Z + 0.07]} renderOrder={5} />
            <Sparkles controller={controller} cue={link.cue} at={[0, MOUTH_Y, 0.52]} half={[0.2, 0.12, 0.08]} count={6} />
            <Sparkles controller={controller} cue={sparks} at={[0, FURNACE.chimney.top + 0.25, FURNACE.chimney.z]} half={[0.08, 0.3, 0.08]} count={8} />
          </group>
          <instancedMesh ref={smoke} args={[puffGeo, mats.smoke, PUFFS]} count={0} frustumCulled={false} />
        </group>
      )}
      {bedGeo && (
        <group name="clay-beds">
          <KitModel geo={bedGeo} />
          <instancedMesh ref={lumps} args={[lumpGeo, mats.lump, beds.length * LUMPS.length]} castShadow receiveShadow frustumCulled={false} />
        </group>
      )}
    </>
  );
}

const MOUTH_Y = FURNACE.plinthH + FURNACE.mouthH * 0.5;
