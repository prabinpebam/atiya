import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { moveAlong, tangentToward } from '../../src/game/math/sphere';
import type { LandmarkGeometry } from '../../src/game/math/landmarks';
import { InteractBuffer, updateProximity } from '../../src/game/systems/proximity';

const R = 10;
const cfg = { planetRadius: R, switchMargin: 0.25 };

function lm(id: string, n: Vector3, order = 1, footprintU = 1): LandmarkGeometry {
  const enterU = footprintU + 1.75;
  return { id, order, n: n.clone().normalize(), door: new Vector3(), approach: n.clone(), footprintU, enterU, exitU: enterU * 1.3 };
}

/** Point at arc distance `u` from `from` toward `to`. */
function at(from: Vector3, to: Vector3, u: number): Vector3 {
  return moveAlong(from, tangentToward(from, to)!, u / R);
}

const A = new Vector3(0, 1, 0);
const B = moveAlong(A, new Vector3(0, 0, -1), 5 / R); // 5 u from A

describe('updateProximity', () => {
  it('enters a landmark inside its enter radius and ignores it outside', () => {
    const a = lm('a', A);
    expect(updateProximity(null, at(A, B, 2.7), [a], cfg)).toBe('a');
    expect(updateProximity(null, at(A, B, 2.8), [a], cfg)).toBeNull();
  });

  it('uses hysteresis: stays nearby until the exit radius', () => {
    const a = lm('a', A);
    const p = at(A, B, 3.4); // beyond enter (2.75), within exit (3.575)
    expect(updateProximity(null, p, [a], cfg)).toBeNull();
    expect(updateProximity('a', p, [a], cfg)).toBe('a');
    expect(updateProximity('a', at(A, B, 3.6), [a], cfg)).toBeNull();
  });

  it('picks the nearest when ranges overlap', () => {
    const a = lm('a', A);
    const b = lm('b', B);
    expect(updateProximity(null, at(A, B, 2.6), [a, b], cfg)).toBe('b'); // 2.4 u from B
    expect(updateProximity(null, at(A, B, 2.4), [a, b], cfg)).toBe('a');
    expect(updateProximity(null, at(A, B, 2.3), [a, b], cfg)).toBe('a');
  });

  it('does not flicker at equal distance (switch margin)', () => {
    const a = lm('a', A);
    const b = lm('b', B);
    const mid = at(A, B, 2.5);
    expect(updateProximity('a', at(A, B, 2.55), [a, b], cfg)).toBe('a');
    expect(updateProximity('b', at(A, B, 2.45), [a, b], cfg)).toBe('b');
    expect(updateProximity('a', mid, [a, b], cfg)).toBe('a');
  });

  it('hands off immediately once another landmark is clearly closer', () => {
    const a = lm('a', A);
    const b = lm('b', B);
    expect(updateProximity('a', at(A, B, 2.7), [a, b], cfg)).toBe('b');
  });

  it('breaks exact ties by order, then id', () => {
    const a = lm('z', A, 2);
    const b = lm('y', B, 1);
    expect(updateProximity(null, at(A, B, 2.5), [a, b], cfg)).toBe('y');
    const c = lm('c', A, 1);
    const d = lm('d', B, 1);
    expect(updateProximity(null, at(A, B, 2.5), [d, c], cfg)).toBe('c');
  });
});

describe('InteractBuffer', () => {
  it('honours presses within the window only', () => {
    const b = new InteractBuffer();
    b.press(1000);
    expect(b.consume(1149, 150)).toBe(true);
    expect(b.consume(1149, 150)).toBe(false); // consumed
    b.press(2000);
    expect(b.consume(2151, 150)).toBe(false);
  });
});
