import type { Vector3 } from 'three';
import { CONFIG } from '../config';
import { arcDistance } from '../math/sphere';
import type { LandmarkGeometry } from '../math/landmarks';

const TIE_EPS = 1e-3;

function better(a: { s: number; g: LandmarkGeometry }, b: { s: number; g: LandmarkGeometry } | null): boolean {
  if (!b) return true;
  if (a.s < b.s - TIE_EPS) return true;
  if (Math.abs(a.s - b.s) <= TIE_EPS) {
    if (a.g.order !== b.g.order) return a.g.order < b.g.order;
    return a.g.id < b.g.id;
  }
  return false;
}

/**
 * Global proximity arbitration (spec §5.4): at most one landmark is "nearby".
 * Keeps the current landmark until it leaves its exit radius, unless another in-range
 * landmark is closer by more than `switchMargin`.
 */
export function updateProximity(
  currentId: string | null,
  pLocal: Vector3,
  landmarks: readonly LandmarkGeometry[],
  cfg: { planetRadius: number; switchMargin: number } = CONFIG,
): string | null {
  let best: { s: number; g: LandmarkGeometry } | null = null;
  let current: { s: number; g: LandmarkGeometry } | null = null;
  for (const g of landmarks) {
    const s = arcDistance(pLocal, g.n, cfg.planetRadius);
    if (g.id === currentId) current = { s, g };
    if (s < g.enterU) {
      const cand = { s, g };
      if (better(cand, best)) best = cand;
    }
  }
  if (current && current.s <= current.g.exitU) {
    if (best && best.g.id !== current.g.id && best.s + cfg.switchMargin < current.s) return best.g.id;
    return current.g.id;
  }
  return best ? best.g.id : null;
}

/** Remembers an interact press so arriving within `windowMs` still opens the landmark. */
export class InteractBuffer {
  private pressedAt = -Infinity;

  press(nowMs: number): void {
    this.pressedAt = nowMs;
  }

  /** True (and clears) if a press happened within `windowMs` before `nowMs`. */
  consume(nowMs: number, windowMs: number = CONFIG.interactBufferMs): boolean {
    if (nowMs - this.pressedAt <= windowMs) {
      this.pressedAt = -Infinity;
      return true;
    }
    return false;
  }

  clear(): void {
    this.pressedAt = -Infinity;
  }
}
