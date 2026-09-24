import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { CONFIG } from '../../src/game/config';
import { compassPoint, mapNorth, northScreenAngle, viewBearingDeg } from '../../src/game/math/compass';
import { UP, latLonToVec, moveAlong, tangentToward } from '../../src/game/math/sphere';
import { PlanetSim } from '../../src/game/systems/movement';
import type { MoveIntent } from '../../src/game/types';

const DEG = Math.PI / 180;
const UP_KEY: MoveIntent = { x: 0, y: 1, run: false };

/** Compass bearing (deg) of travelling from a toward b, measured against map north at a. */
function bearing(a: Vector3, b: Vector3): number {
  const north = mapNorth(a);
  const east = new Vector3().crossVectors(north, a).normalize();
  const dir = tangentToward(a, b)!;
  return ((Math.atan2(dir.dot(east), dir.dot(north)) / DEG) % 360 + 360) % 360;
}

describe('map north (compass)', () => {
  it('points to the Workshop (−Z) at the plaza, so the spawn view is north-up', () => {
    const n = mapNorth(UP.clone());
    expect(n.x).toBeCloseTo(0, 9);
    expect(n.z).toBeCloseTo(-1, 9);
    expect(northScreenAngle(new Quaternion())).toBeCloseTo(0, 9);
  });

  it('is a unit tangent everywhere except the far pole', () => {
    for (let lat = -80; lat <= 90; lat += 10) {
      for (let lon = -180; lon < 180; lon += 30) {
        const p = latLonToVec(lat, lon);
        const n = mapNorth(p);
        expect(Math.abs(n.dot(p))).toBeLessThan(1e-9);
        expect(n.length()).toBeCloseTo(1, 9);
      }
    }
  });

  it('is smooth around the plaza (no spinning near spawn)', () => {
    // walk a continuous spiral out from the plaza in 0.05 u steps
    let p = UP.clone();
    let prev = mapNorth(p);
    for (let i = 1; i <= 400; i++) {
      const dir = mapNorth(p).applyAxisAngle(p, i * 0.02);
      p = moveAlong(p, dir, 0.05 / CONFIG.planetRadius);
      const n = mapNorth(p);
      expect(n.angleTo(prev)).toBeLessThan(1.5 * DEG);
      prev = n;
    }
  });

  it('reads like a map: Workshop north, Town Hall east, Library south, Post Office west of the plaza', () => {
    const plaza = UP.clone();
    const near = (lon: number) => latLonToVec(57, lon);
    expect(bearing(plaza, near(0))).toBeCloseTo(0, 6);
    expect(bearing(plaza, near(90))).toBeCloseTo(90, 6);
    expect(bearing(plaza, near(180))).toBeCloseTo(180, 6);
    expect(bearing(plaza, near(-90))).toBeCloseTo(270, 6);
    // from the Library, the plaza lies to the north
    expect(bearing(near(180), plaza)).toBeCloseTo(0, 6);
  });

  it('names the facing direction', () => {
    expect(compassPoint(viewBearingDeg(0))).toBe('north');
    expect(compassPoint(viewBearingDeg(-Math.PI / 2))).toBe('east');
    expect(compassPoint(viewBearingDeg(Math.PI / 2))).toBe('west');
    expect(compassPoint(viewBearingDeg(Math.PI))).toBe('south');
    expect(compassPoint(viewBearingDeg(-Math.PI / 4))).toBe('north-east');
  });
});

describe('rotating the view', () => {
  it('keeps the player in place, turns heading with the world, and moves the compass needle', () => {
    const sim = new PlanetSim([]);
    const before = sim.pLocal.clone();
    const h0 = sim.heading;
    sim.rotateView(0.7);
    expect(sim.pLocal.distanceTo(before)).toBeLessThan(1e-9);
    expect(sim.heading).toBeCloseTo(((h0 + 0.7 + Math.PI) % (2 * Math.PI)) - Math.PI, 9);
    // the scene turned counter-clockwise, so north now appears to the left of screen-up
    expect(northScreenAngle(sim.planetQ, sim.pLocal)).toBeCloseTo(-0.7, 9);
    // facing north again = rotating by the needle's angle
    sim.rotateView(northScreenAngle(sim.planetQ, sim.pLocal));
    expect(northScreenAngle(sim.planetQ, sim.pLocal)).toBeCloseTo(0, 9);
  });

  it('keeps WASD screen-relative: after a quarter turn, W walks toward what was on the right', () => {
    const sim = new PlanetSim([]);
    sim.rotateView(Math.PI / 2);
    for (let i = 0; i < 60; i++) sim.step(1 / 60, UP_KEY);
    expect(sim.pLocal.x).toBeGreaterThan(0.05);
    expect(Math.abs(sim.pLocal.z)).toBeLessThan(1e-6);
  });

  it('is ignored during fast travel', () => {
    const sim = new PlanetSim([]);
    sim.startTravel(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 0.5), 'x', 'flyover');
    const q = sim.planetQ.clone();
    sim.rotateView(1);
    expect(sim.planetQ.equals(q)).toBe(true);
  });
});
