/**
 * Full planet's rules (camera/overview.ts), pure so they're unit-tested: how far back the camera goes to
 * frame the whole planet, how the mode eases in and out, and how a drag or a key turns the world.
 */
import { Quaternion, Vector3 } from 'three';

export const OVERVIEW = {
  /** The planet with everything on it (the lighthouse's lamp, the tallest crowns): what has to fit (u). */
  bound: 15,
  /** Room round it, as a share of the frame. */
  margin: 1.06,
  /** Seconds to ease in or out. */
  seconds: 0.9,
  /** Turn per pixel dragged (rad). */
  dragPerPx: 0.006,
  /** Turn per second with a key held (rad). */
  keyPerS: 1.3,
  /** A menu View button's step (rad). */
  stepRad: Math.PI / 4,
  /** The tilt-shift's focus area with the whole planet in view: all of it sharp, only the frame's very edges soft. */
  focusArea: 1.25,
} as const;

/** The camera's distance from the planet's centre that frames a ball of `bound` with a vertical field of view `fovDeg` at `aspect`. */
export function overviewDistance(fovDeg: number, aspect: number, bound: number = OVERVIEW.bound, margin: number = OVERVIEW.margin): number {
  const halfV = (fovDeg * Math.PI) / 360;
  const halfH = Math.atan(Math.tan(halfV) * Math.max(aspect, 1e-3));
  return (bound / Math.sin(Math.min(halfV, halfH))) * margin;
}

/** The mode's weight one frame on: toward 1 while it's on, 0 while it's off, at once with reduced motion. */
export function stepWeight(w: number, on: boolean, dt: number, reduced: boolean): number {
  const goal = on ? 1 : 0;
  if (reduced) return goal;
  const step = Math.max(0, dt) / OVERVIEW.seconds;
  return on ? Math.min(1, w + step) : Math.max(0, w - step);
}

/** The weight as the camera follows it: eased at both ends. */
export const ease = (w: number): number => w * w * (3 - 2 * w);

const _q = new Quaternion();

/**
 * Turns the world (`q`, in place) as if grabbed: `across` about the screen's up (+ moves the near side
 * right), `down` about the screen's right (+ moves the near side down), `roll` about the line of sight
 * (+ counter-clockwise). The axes are the camera's (`right`, `up`, `back`), in world space.
 */
export function turnWorld(q: Quaternion, across: number, down: number, roll: number, right: Vector3, up: Vector3, back: Vector3): Quaternion {
  if (across) q.premultiply(_q.setFromAxisAngle(up, across));
  if (down) q.premultiply(_q.setFromAxisAngle(right, down));
  if (roll) q.premultiply(_q.setFromAxisAngle(back, roll));
  return q.normalize();
}

/** What a held key does in full planet: a turn across, down or round (−1, 0, 1 each), or nothing. */
export function keyTurn(action: string): { across: number; down: number; roll: number } | null {
  switch (action) {
    // the arrows and WASD turn the planet the way they'd look: left brings what's to the left round
    case 'left':
      return { across: 1, down: 0, roll: 0 };
    case 'right':
      return { across: -1, down: 0, roll: 0 };
    case 'up':
    case 'tiltUp':
      return { across: 0, down: 1, roll: 0 };
    case 'down':
    case 'tiltDown':
      return { across: 0, down: -1, roll: 0 };
    case 'rotateCcw':
      return { across: 0, down: 0, roll: 1 };
    case 'rotateCw':
      return { across: 0, down: 0, roll: -1 };
    default:
      return null;
  }
}
