import { Vector3 } from 'three';
import { CONFIG } from '../config';
import type { GameController } from '../controller';

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
  };
  (window as unknown as { __game: GameTestHook }).__game = hook;
}
