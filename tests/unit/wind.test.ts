import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { CONFIG } from '../../src/game/config';
import { landmarkGeometry } from '../../src/game/math/landmarks';
import { UP, arcDistance } from '../../src/game/math/sphere';
import { WIND_AXIS, gustAt, windAt, windStrength } from '../../src/game/world/windField';
import { FIXTURE_LANDMARKS } from './fixtures';

const R = CONFIG.planetRadius;

describe('wind', () => {
  it('blows along the surface (tangent) everywhere', () => {
    for (let i = 0; i < 200; i++) {
      const p = new Vector3(Math.sin(i * 1.3), Math.cos(i * 0.7), Math.sin(i * 2.1)).normalize();
      expect(Math.abs(windAt(p).dot(p))).toBeLessThan(1e-9);
    }
  });

  it('is breezy at the plaza and every landmark (the calm spots are out of the way)', () => {
    expect(windAt(UP.clone()).length()).toBeGreaterThan(0.9);
    for (const l of FIXTURE_LANDMARKS) {
      const g = landmarkGeometry(l);
      expect(windAt(g.n).length()).toBeGreaterThan(0.3);
      expect(arcDistance(g.n, WIND_AXIS, R)).toBeGreaterThan(3);
    }
  });

  it('breathes: a steady breeze with occasional gusts, never stronger than 1', () => {
    let gusty = 0;
    let calm = 0;
    let prev = windStrength(0);
    for (let t = 0; t < 600; t += 0.1) {
      const s = windStrength(t);
      expect(s).toBeGreaterThanOrEqual(0.3 - 1e-9);
      expect(s).toBeLessThanOrEqual(1 + 1e-9);
      // a gust takes over a second to build (≤ 0.07 per 0.1 s)
      expect(Math.abs(s - prev)).toBeLessThan(0.07);
      prev = s;
      if (gustAt(t) > 0.5) gusty++;
      if (gustAt(t) === 0) calm++;
    }
    // gusts are occasional: some of the time, but most of the time it's a gentle breeze
    expect(gusty).toBeGreaterThan(200);
    expect(calm).toBeGreaterThan(gusty);
  });
});
