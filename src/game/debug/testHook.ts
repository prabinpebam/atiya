import { Vector3 } from 'three';
import { CONFIG } from '../config';
import type { GameController } from '../controller';
import { UP, moveAlong, orientationFor, tangentToward } from '../math/sphere';
import { riverDistance } from '../world/features';
import { textureStatus } from '../world/textures';

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
  /** Force an adaptive-quality step (bypasses the warm-up/throttle). */
  adaptiveStep(dir: -1 | 1): void;
  /** Set and hold the planet clock (hours 0–24); `null` releases it. */
  setTime(hours: number | null): void;
  /** Force the gust level (0…1); `null` returns to the natural wind. */
  setWind(gust: number | null): void;
  /** Ground under the player: smoothed lift, terrain height, walk height and distance to the river (u). */
  groundInfo(): { lift: number; height: number; walk: number; riverD: number; riverHalfWidth: number };
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
        hours: c.timeOfDay,
        night: c.sky.night,
        glow: c.sky.glow,
        timeMode: s.timeMode,
        pitch: c.view.pitch,
        /** Screen angle of map north, degrees clockwise from screen-up (0 = north-up). */
        north: (c.northAngle() * 180) / Math.PI,
        lift: c.lift,
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
