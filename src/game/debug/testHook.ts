import { HalfFloatType, Raycaster, Vector2, Vector3, WebGLRenderTarget } from 'three';
import { CONFIG } from '../config';
import type { GameController } from '../controller';
import { UP, moveAlong, orientationFor, tangentToward } from '../math/sphere';
import { riverDistance } from '../world/features';
import { textureStatus } from '../world/textures';
import { litLamps } from '../world/lampLights';
import { outlineMaterial } from '../player/outline';

export interface GameTestHook {
  getState(): Record<string, unknown>;
  landmarks(): string[];
  teleport(id: string): void;
  travelTo(id: string): void;
  setIntent(x: number, y: number, run?: boolean): void;
  clearIntent(): void;
  interact(): void;
  start(): void;
  pause(): void;
  resume(): void;
  advance(frames: number, dt?: number): void;
  autoWalkTo(id: string): void;
  distanceTo(id: string): number;
  projectLandmark(id: string, part?: 'base' | 'door'): { x: number; y: number; z: number } | null;
  setAdaptiveQuality(enabled: boolean): void;
  setDpr(dpr: number): void;
  /** Stand next to the pond (visual testing). */
  visitPond(): boolean;
  /** Stand ~2 u in front of prop `i` of a kind (visual testing). */
  visitProp(kind: 'hardwood' | 'fruit' | 'cedar' | 'bushes' | 'flowerBushes' | 'rocks' | 'boulders', i?: number): boolean;
  /** Stand near a terrain feature, facing it (visual testing). */
  visitFeature(kind: 'bridge' | 'waterfall' | 'mesa' | 'river', i?: number): boolean;
  /** Draw calls / triangles of the previous frame (all passes). */
  renderInfo(): { calls: number; triangles: number };
  /** Stand just behind a landmark, facing away from it, so the building sits between the camera and the player. */
  standBehind(id: string): boolean;
  /** Renderer and scene census for performance audits. */
  perfStats(): Record<string, unknown>;
  /** Render the scene into a half-float target (like the composer's) and report Inf/NaN pixels and what's under the first one. */
  hdrScan(width?: number, samples?: number): { bad: number; max: number; at: [number, number] | null; hit: string | null };
  /** The live renderer and scene (audits in the console / scripts). */
  __gfx(): GameController['gfx'];
  /** Show or hide the character's occlusion outline (visual testing). */
  setOutline(on: boolean): void;
  /** Scene exposure (into the tone map) and the tilt-shift blend function name. */
  grading(): { exposure: number; tiltBlend: string };
  /** Force an adaptive-quality step (bypasses the warm-up/throttle). */
  adaptiveStep(dir: -1 | 1): void;
  /** Set and hold the planet clock (hours 0–24); `null` releases it. */
  setTime(hours: number | null): void;
  /** Force the gust level (0…1); `null` returns to the natural wind. */
  setWind(gust: number | null): void;
  /** Town-hall clock hand angles last drawn (radians clockwise from 12), or null. */
  clockHands(): { hour: number; minute: number; second: number } | null;
  /** Bridge lanterns: count, how lit they are (0…1) and their point lights' current intensity. */
  bridgeLamps(): { count: number; lit: number; intensity: number };
  /** How open each landmark's door (or curtain) is, 0 shut … 1 open. */
  doors(): Record<string, number>;
  /** How many lamps (plaza lamps, door and stage spots) are lighting the scene this frame. */
  lamps(): number;
  /** The shared warm door light: which landmark it's shining from (null when dark) and its intensity. */
  doorLight(): { id: string | null; intensity: number };
  /** Sound: on/off, audio-context state, sprites loaded, ambience targets and the latest cues (newest last). */
  sound(): {
    enabled: boolean;
    state: string;
    loaded: number;
    total: number;
    levels: { stream: number; streamPan: number; wind: number; windCutoff: number; birds: boolean };
    lastSurface: string | null;
    events: Array<{ t: number; kind: string; detail?: string; played: boolean }>;
  };
  /** Ground under the player: smoothed lift, terrain height, walk height and distance to the river (u). */
  groundInfo(): {
    lift: number;
    height: number;
    walk: number;
    riverD: number;
    riverHalfWidth: number;
    water: number;
    wade: number;
    speedFactor: number;
    ripples: number;
    collar: boolean;
  };
}

/** Non-production only (dev server and `astro build --mode test`). */
export function installTestHook(c: GameController): void {
  const hook: GameTestHook = {
    getState: () => {
      const s = c.store.getState();
      return {
        phase: s.phase,
        pLocal: c.sim.pLocal.toArray(),
        nearby: s.nearbyId,
        open: s.openId,
        menuOpen: s.menuOpen,
        traveling: s.traveling,
        speed: c.sim.speed,
        heading: c.sim.heading,
        atSpawn: c.isAtSpawn(),
        autoWalk: Boolean(c.sim.autoWalk),
        dpr: s.dpr,
        quality: s.quality,
        postLevel: s.postLevel,
        postFx: c.postFx,
        avatar: c.avatar,
        character: s.character,
        avatarModel: c.avatarModel,
        outlines: c.outlines,
        hours: c.timeOfDay,
        night: c.sky.night,
        glow: c.sky.glow,
        timeMode: s.timeMode,
        pitch: c.view.pitch,
        /** Screen angle of map north, degrees clockwise from screen-up (0 = north-up). */
        north: (c.northAngle() * 180) / Math.PI,
        lift: c.lift,
        hover: c.sim.hover,
        wind: { ...c.wind },
        textures: textureStatus(),
      };
    },
    landmarks: () => c.landmarks.map((l) => l.id),
    teleport: (id) => c.teleport(id),
    travelTo: (id) => c.travelTo(id),
    setIntent: (x, y, run = false) => {
      c.keyboard.override = { x, y, run };
    },
    clearIntent: () => {
      c.keyboard.override = null;
    },
    interact: () => c.interact(),
    start: () => c.start(),
    pause: () => {
      c.paused = true;
    },
    resume: () => {
      c.paused = false;
    },
    advance: (frames, dt = 1 / 60) => {
      for (let i = 0; i < frames; i++) c.step(dt);
    },
    autoWalkTo: (id) => {
      const g = c.geoById.get(id);
      if (g) c.sim.startAutoWalk(g.approach);
    },
    distanceTo: (id) => c.distanceTo(id),
    projectLandmark: (id, part = 'base') => {
      const g = c.geoById.get(id);
      if (!g || !c.camera) return null;
      const local = part === 'door' ? g.n.clone().addScaledVector(g.door, g.footprintU / CONFIG.planetRadius).normalize() : g.n.clone();
      const world = new Vector3().copy(local).multiplyScalar(CONFIG.planetRadius).applyQuaternion(c.sim.planetQ);
      c.camera.updateMatrixWorld();
      const ndc = world.project(c.camera);
      return { x: ndc.x, y: ndc.y, z: ndc.z };
    },
    setAdaptiveQuality: (enabled) => c.store.setState({ adaptiveQuality: enabled }),
    setDpr: (dpr) => c.store.setState({ dpr }),
    visitPond: () => {
      const pond = c.props.pond;
      if (!pond) return false;
      const toward = tangentToward(pond.n, UP as Vector3) ?? new Vector3(0, 0, 1);
      const stand = moveAlong(pond.n, toward, (pond.radiusU + 1.2) / CONFIG.planetRadius);
      const face = tangentToward(stand, pond.n) ?? toward.clone().negate();
      c.sim.setOrientation(orientationFor(stand, face));
      return true;
    },
    renderInfo: () => ({ ...c.lastRenderInfo }),
    standBehind: (id) => {
      const g = c.geoById.get(id);
      if (!g) return false;
      const back = g.door.clone().negate();
      const stand = moveAlong(g.n, back, (g.footprintU + 0.9) / CONFIG.planetRadius);
      const face = tangentToward(stand, g.n)?.negate() ?? back;
      c.sim.setOrientation(orientationFor(stand, face));
      return true;
    },
    __gfx: () => c.gfx,
    hdrScan: (width = 320, samples = 0) => {
      const gfx = c.gfx;
      const cam = c.camera;
      if (!gfx || !cam) return { bad: 0, max: 0, at: null, hit: null };
      const { gl, scene } = gfx;
      const w = width;
      const h = Math.round((w * gl.domElement.height) / gl.domElement.width);
      const rt = new WebGLRenderTarget(w, h, { type: HalfFloatType, samples });
      const prev = gl.getRenderTarget();
      gl.setRenderTarget(rt);
      gl.render(scene, cam);
      gl.setRenderTarget(prev);
      const buf = new Uint16Array(w * h * 4);
      gl.readRenderTargetPixels(rt, 0, 0, w, h, buf);
      rt.dispose();
      let bad = 0;
      let max = 0;
      let at: [number, number] | null = null;
      const half = (v: number) => {
        const e = (v >> 10) & 31;
        const m = v & 1023;
        return e === 0 ? m * 2 ** -24 : (1 + m / 1024) * 2 ** (e - 15);
      };
      for (let i = 0; i < w * h; i++) {
        let broken = false;
        for (let k = 0; k < 3; k++) {
          const v = buf[i * 4 + k];
          if ((v & 0x7c00) === 0x7c00) broken = true;
          else max = Math.max(max, half(v));
        }
        if (broken) {
          bad++;
          at ??= [i % w, Math.floor(i / w)];
        }
      }
      let hit: string | null = null;
      if (at) {
        const ray = new Raycaster();
        ray.setFromCamera(new Vector2((at[0] + 0.5) / w * 2 - 1, (at[1] + 0.5) / h * 2 - 1), cam);
        const first = ray.intersectObject(scene, true)[0];
        if (first) {
          const names: string[] = [];
          for (let o: typeof first.object | null = first.object; o; o = o.parent) names.push(o.name || o.type);
          hit = `${names.join(' < ')} @${first.distance.toFixed(2)}`;
        }
      }
      return { bad, max, at, hit };
    },
    perfStats: () => {
      const gfx = c.gfx;
      if (!gfx) return {};
      const { gl, scene } = gfx;
      const materials = new Set<string>();
      const geometries = new Set<string>();
      const programs = new Map<string, number>();
      let meshes = 0;
      let instanced = 0;
      let instances = 0;
      let casters = 0;
      let transparent = 0;
      let vertices = 0;
      let skinned = 0;
      const lights: Record<string, number> = {};
      const shadowLights: string[] = [];
      const bigMeshes: Array<[string, number]> = [];
      scene.traverseVisible((o) => {
        const l = o as unknown as { isLight?: boolean; type: string; castShadow: boolean; shadow?: { mapSize: { x: number } } };
        if (l.isLight) {
          lights[l.type] = (lights[l.type] ?? 0) + 1;
          if (l.castShadow) shadowLights.push(`${l.type}:${l.shadow?.mapSize.x}`);
        }
        const m = o as unknown as {
          isMesh?: boolean;
          isInstancedMesh?: boolean;
          isSkinnedMesh?: boolean;
          count?: number;
          castShadow: boolean;
          name: string;
          geometry: { uuid: string; attributes: { position?: { count: number } }; index: { count: number } | null };
          material: { uuid: string; transparent: boolean; type: string; name: string } | Array<{ uuid: string; transparent: boolean; type: string; name: string }>;
        };
        if (!m.isMesh && !(o as { isPoints?: boolean }).isPoints) return;
        meshes++;
        if (m.isInstancedMesh) {
          instanced++;
          instances += m.count ?? 0;
        }
        if (m.isSkinnedMesh) skinned++;
        if (m.castShadow) casters++;
        geometries.add(m.geometry.uuid);
        const v = m.geometry.attributes.position?.count ?? 0;
        vertices += v * (m.isInstancedMesh ? (m.count ?? 1) : 1);
        bigMeshes.push([`${o.name || o.parent?.name || m.geometry.uuid.slice(0, 6)}${m.isInstancedMesh ? `×${m.count}` : ''}`, (m.geometry.index?.count ?? v) / 3 * (m.isInstancedMesh ? (m.count ?? 1) : 1)]);
        for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
          materials.add(mat.uuid);
          if (mat.transparent) transparent++;
          const key = `${mat.type}${mat.name ? `:${mat.name}` : ''}`;
          programs.set(key, (programs.get(key) ?? 0) + 1);
        }
      });
      bigMeshes.sort((a, b) => b[1] - a[1]);
      const info = gl.info;
      return {
        calls: c.lastRenderInfo.calls,
        triangles: c.lastRenderInfo.triangles,
        programs: info.programs?.length ?? 0,
        gpuGeometries: info.memory.geometries,
        gpuTextures: info.memory.textures,
        meshes,
        instanced,
        instances,
        skinned,
        casters,
        transparent,
        vertices,
        uniqueMaterials: materials.size,
        uniqueGeometries: geometries.size,
        lights,
        shadowLights,
        pixelRatio: gl.getPixelRatio(),
        drawingBuffer: [gl.domElement.width, gl.domElement.height],
        shadowAutoUpdate: gl.shadowMap.autoUpdate,
        shadowType: gl.shadowMap.type,
        materialKinds: Object.fromEntries([...programs.entries()].sort((a, b) => b[1] - a[1])),
        topTriangles: bigMeshes.slice(0, 15),
      };
    },
    setOutline: (on) => {
      outlineMaterial().visible = on;
    },
    grading: () => ({ ...c.grading }),
    adaptiveStep: (dir) => c.adaptiveStep?.(dir, true),
    setTime: (hours) => {
      if (hours === null) {
        c.timeFrozen = false;
        return;
      }
      c.timeOfDay = ((hours % 24) + 24) % 24;
      c.timeFrozen = true;
    },
    setWind: (gust) => {
      c.windOverride = gust === null ? null : Math.min(1, Math.max(0, gust));
    },
    clockHands: () => (c.clockHands ? { ...c.clockHands } : null),
    bridgeLamps: () => ({ ...c.bridgeLamps }),
    doors: () => Object.fromEntries([...c.doors].map(([id, d]) => [id, d.open])),
    doorLight: () => ({ ...c.doorLight }),
    lamps: () => litLamps(),
    sound: () => ({
      enabled: c.sound.enabled,
      state: c.sound.state,
      loaded: c.sound.loaded,
      total: c.sound.total,
      levels: { ...c.sound.levels },
      lastSurface: c.lastStepSurface,
      events: c.sound.events.map((e) => ({ ...e })),
    }),
    groundInfo: () => {
      const p = c.sim.pLocal;
      const river = c.props.river;
      const rd = river ? riverDistance(river, p) : { d: Infinity, i: 0 };
      return {
        lift: c.lift,
        height: c.terrain.height(p),
        walk: c.terrain.walkHeight(p),
        riverD: rd.d,
        riverHalfWidth: river ? river.halfWidth[rd.i] : 0,
        water: c.terrain.waterDepth(p),
        wade: c.wadeDepth,
        speedFactor: c.sim.speedFactor,
        ripples: c.wake.ripples,
        collar: c.wake.collar,
      };
    },
    visitProp: (kind, i = 0) => {
      const list = c.props[kind];
      const item = list[i % Math.max(1, list.length)];
      if (!item) return false;
      const toward = tangentToward(item.n, UP as Vector3) ?? new Vector3(0, 0, 1);
      const stand = moveAlong(item.n, toward, 2.0 / CONFIG.planetRadius);
      const face = tangentToward(stand, item.n) ?? toward.clone().negate();
      c.sim.setOrientation(orientationFor(stand, face));
      return true;
    },
    visitFeature: (kind, i = 0) => {
      const R = CONFIG.planetRadius;
      const { bridges, river, mesas } = c.props;
      let target: Vector3 | null = null;
      let stand: Vector3 | null = null;
      if (kind === 'bridge' && bridges[i]) {
        const b = bridges[i];
        target = b.n;
        stand = moveAlong(b.n, b.along, -(b.halfLengthU + 1.6) / R);
      } else if (kind === 'waterfall' && river && mesas[0]) {
        target = river.samples[0];
        const away = tangentToward(mesas[0].n, target) ?? mesas[0].east;
        const side = new Vector3().crossVectors(target, away).normalize();
        stand = moveAlong(moveAlong(target, away, 2.2 / R), side, 1.2 / R);
      } else if (kind === 'mesa' && mesas[i]) {
        const m = mesas[i];
        target = m.n;
        const out = tangentToward(m.n, UP as Vector3) ?? m.north;
        stand = moveAlong(m.n, out, (m.radiusU + 2.6) / R);
      } else if (kind === 'river' && river) {
        const k = Math.min(river.samples.length - 1, Math.floor(river.samples.length * (0.15 + 0.1 * i)));
        target = river.samples[k];
        const side = new Vector3().crossVectors(target, river.tangent[k]).normalize();
        stand = moveAlong(target, side, 2.2 / R);
      }
      if (!target || !stand) return false;
      const face = tangentToward(stand, target) ?? new Vector3(0, 0, -1);
      c.sim.setOrientation(orientationFor(stand, face));
      c.lift = c.terrain.walkHeight(c.sim.pLocal);
      return true;
    },
  };
  (window as unknown as { __game: GameTestHook }).__game = hook;
}
