/**
 * Full planet's rules (camera/overviewMath.ts) and the fog that follows a camera pulled back
 * (world/timeOfDay.ts fogScale): fast travel's fly-over and full planet keep the planet clear.
 */
import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { CONFIG } from '../../src/game/config';
import { FOG, fogScale } from '../../src/game/world/timeOfDay';
import { OVERVIEW, ease, keyTurn, overviewDistance, stepWeight, turnWorld } from '../../src/game/camera/overviewMath';

const R = CONFIG.planetRadius;
const C = CONFIG.camera;
const DEG = Math.PI / 180;
/** The camera's distance from the planet's centre in the character's view at a pitch, `dist` from the feet. */
const rig = (pitchDeg: number, dist: number = C.distance) => Math.hypot(R + Math.sin(pitchDeg * DEG) * dist, Math.cos(pitchDeg * DEG) * dist);
const horizon = (d: number) => Math.sqrt(d * d - R * R);

describe('the fog follows the camera out', () => {
  it('is exactly the character view’s fog at any tilt', () => {
    for (const p of [C.minPitchDeg, C.pitchDeg, C.maxPitchDeg]) expect(fogScale(rig(p), rig(p), R)).toBeCloseTo(1, 12);
    expect(FOG).toEqual({ near: 20, far: 34 });
  });

  it('stretches with the distance to the horizon on a fast travel’s fly-over, so the planet is as clear as in the character’s view', () => {
    const rest = rig(C.pitchDeg);
    const flyover = rig(C.flyoverPitchDeg, C.flyoverDistance);
    const k = fogScale(flyover, rest, R);
    expect(k).toBeGreaterThan(1.25);
    // the horizon sits at the same depth in the fog as in the character's view
    const share = (d: number, s: number) => (horizon(d) - FOG.near * s) / ((FOG.far - FOG.near) * s);
    expect(share(flyover, k)).toBeCloseTo(share(rest, 1), 10);
  });

  it('leaves the whole planet clear in full planet: the near side unfogged, its rim no more than lightly', () => {
    const d = overviewDistance(C.fov, 16 / 9);
    const k = fogScale(d, rig(C.pitchDeg), R);
    // the nearest ground, and the rim (the horizon), against the fog's range
    expect(d - R).toBeLessThan(FOG.near * k);
    expect((horizon(d) - FOG.near * k) / ((FOG.far - FOG.near) * k)).toBeLessThan(0.2);
  });
});

describe('full planet', () => {
  it('pulls back until the planet and all on it fit, in a wide window and a tall one', () => {
    for (const aspect of [16 / 9, 1, 9 / 19]) {
      const d = overviewDistance(C.fov, aspect);
      const halfV = (C.fov / 2) * DEG;
      const half = Math.min(halfV, Math.atan(Math.tan(halfV) * aspect));
      // the ball of everything on the planet subtends less than the narrower half of the view
      expect(Math.asin(OVERVIEW.bound / d)).toBeLessThan(half);
      // and well inside the camera's far plane (130), the planet's far side too
      expect(d + R).toBeLessThan(130);
    }
    expect(overviewDistance(C.fov, 9 / 19)).toBeGreaterThan(overviewDistance(C.fov, 16 / 9));
  });

  it('eases in and out over its time, and at once with reduced motion', () => {
    let w = 0;
    for (let i = 0; i < 10; i++) w = stepWeight(w, true, OVERVIEW.seconds / 10, false);
    expect(w).toBeCloseTo(1, 10);
    expect(stepWeight(1, false, OVERVIEW.seconds / 2, false)).toBeCloseTo(0.5, 10);
    expect(stepWeight(0, true, 0.01, true)).toBe(1);
    expect(stepWeight(1, false, 0.01, true)).toBe(0);
    expect([ease(0), ease(0.5), ease(1)]).toEqual([0, 0.5, 1]);
  });

  it('turns the world as if grabbed: a drag right brings the near side right, a drag down brings it down', () => {
    const right = new Vector3(1, 0, 0);
    const up = new Vector3(0, 1, 0);
    const back = new Vector3(0, 0, 1);
    const near = () => new Vector3(0, 0, R);
    const q = turnWorld(new Quaternion(), 0.3, 0, 0, right, up, back);
    expect(near().applyQuaternion(q).x).toBeGreaterThan(0);
    const q2 = turnWorld(new Quaternion(), 0, 0.3, 0, right, up, back);
    expect(near().applyQuaternion(q2).y).toBeLessThan(0);
    // round the line of sight: the top goes left (counter-clockwise)
    const q3 = turnWorld(new Quaternion(), 0, 0, 0.3, right, up, back);
    expect(new Vector3(0, R, 0).applyQuaternion(q3).x).toBeLessThan(0);
    expect(q3.length()).toBeCloseTo(1, 12);
  });

  it('turns with the arrows, WASD, the view keys and nothing else', () => {
    expect(keyTurn('left')).toEqual({ across: 1, down: 0, roll: 0 });
    expect(keyTurn('right')).toEqual({ across: -1, down: 0, roll: 0 });
    expect(keyTurn('up')).toEqual(keyTurn('tiltUp'));
    expect(keyTurn('down')).toEqual(keyTurn('tiltDown'));
    expect(keyTurn('rotateCcw')?.roll).toBe(1);
    for (const a of ['interact', 'back', 'jump', 'inventory', 'whistle', 'run']) expect(keyTurn(a)).toBeNull();
  });
});
