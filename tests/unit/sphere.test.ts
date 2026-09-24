import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import {
  UP,
  angleBetween,
  arcDistance,
  latLonToVec,
  orientationFor,
  playerLocal,
  resolvePenetration,
  slideVelocity,
  tangentAwayFrom,
  tangentToward,
  vecToLatLon,
  type Obstacle,
} from '../../src/game/math/sphere';

const C = { radius: 10, playerRadius: 0.35, skin: 0.02 };

describe('sphere math', () => {
  it('round-trips lat/lon', () => {
    for (const [lat, lon] of [[57, 0], [25, 135], [-40, -120], [0, 90]] as const) {
      const r = vecToLatLon(latLonToVec(lat, lon));
      expect(r.lat).toBeCloseTo(lat, 6);
      expect(r.lon).toBeCloseTo(lon, 6);
    }
  });

  it('puts lon 0 ahead of the spawn camera (−Z) and lon 90 to screen-right (+X)', () => {
    expect(latLonToVec(0, 0).z).toBeCloseTo(-1);
    expect(latLonToVec(0, 90).x).toBeCloseTo(1);
    expect(latLonToVec(90, 0).y).toBeCloseTo(1);
  });

  it('computes arc distance', () => {
    expect(arcDistance(latLonToVec(90, 0), latLonToVec(0, 0), 10)).toBeCloseTo((Math.PI / 2) * 10);
  });

  it('returns null tangents for degenerate targets', () => {
    expect(tangentToward(UP.clone(), UP.clone())).toBeNull();
    expect(tangentToward(UP.clone(), UP.clone().negate())).toBeNull();
  });

  it('rotation sign: axis = d × UP with a positive angle brings the point ahead to the top', () => {
    const d = new Vector3(0, 0, -1);
    const axis = new Vector3().crossVectors(d, UP).normalize();
    const ahead = latLonToVec(60, 0); // 30° ahead of spawn
    const q = new Quaternion().setFromAxisAngle(axis, (30 * Math.PI) / 180);
    const moved = ahead.clone().applyQuaternion(q);
    expect(moved.y).toBeCloseTo(1, 6);
  });

  it('orientationFor maps the point to the top and the tangent to screen-up', () => {
    const a = latLonToVec(20, 70);
    const f = tangentToward(a, latLonToVec(30, 90))!;
    const q = orientationFor(a, f);
    const top = a.clone().applyQuaternion(q);
    const fw = f.clone().applyQuaternion(q);
    expect(top.distanceTo(UP)).toBeLessThan(1e-6);
    expect(fw.distanceTo(new Vector3(0, 0, -1))).toBeLessThan(1e-6);
    expect(playerLocal(q).distanceTo(a)).toBeLessThan(1e-6);
  });

  describe('slideVelocity', () => {
    const p = UP.clone();
    const obstacleAhead: Obstacle = { n: latLonToVec(90 - (0.46 / 10) * (180 / Math.PI), 0), radiusU: 0.1 };

    it('stops on a head-on collision without producing NaN', () => {
      const v = tangentToward(p, obstacleAhead.n)!.multiplyScalar(2);
      const out = slideVelocity(v, p, [obstacleAhead], C);
      expect(out.length()).toBeLessThan(1e-6);
      expect(Number.isNaN(out.x)).toBe(false);
    });

    it('keeps the tangential component on a glancing collision', () => {
      const into = tangentToward(p, obstacleAhead.n)!;
      const along = new Vector3().crossVectors(p, into).normalize();
      const v = into.clone().add(along).multiplyScalar(3);
      const out = slideVelocity(v, p, [obstacleAhead], C);
      expect(out.dot(into)).toBeGreaterThanOrEqual(-1e-9);
      expect(out.dot(along)).toBeCloseTo(3, 6);
    });

    it('returns zero when wedged in a corner between two obstacles', () => {
      const t = tangentToward(p, obstacleAhead.n)!;
      const side = new Vector3().crossVectors(p, t).normalize();
      const left: Obstacle = { n: p.clone().addScaledVector(t, 0.045).addScaledVector(side, 0.02).normalize(), radiusU: 0.15 };
      const right: Obstacle = { n: p.clone().addScaledVector(t, 0.045).addScaledVector(side, -0.02).normalize(), radiusU: 0.15 };
      const out = slideVelocity(t.clone().multiplyScalar(2), p, [left, right], C);
      expect(out.dot(t)).toBeLessThanOrEqual(1e-6);
      expect(Number.isNaN(out.length())).toBe(false);
    });

    it('ignores obstacles that are not touching', () => {
      const far: Obstacle = { n: latLonToVec(0, 0), radiusU: 1 };
      const v = new Vector3(0, 0, -1);
      expect(slideVelocity(v, p, [far], C).equals(v)).toBe(true);
    });
  });

  it('resolvePenetration pushes the point to the obstacle boundary', () => {
    const o: Obstacle = { n: UP.clone(), radiusU: 1 };
    const p = latLonToVec(89, 0);
    const fixed = resolvePenetration(p, [o], C)!;
    expect(fixed).not.toBeNull();
    const beta = (1 + C.playerRadius + C.skin) / C.radius;
    expect(angleBetween(fixed, o.n)).toBeCloseTo(beta, 6);
    // stays on the same side of the obstacle
    expect(tangentAwayFrom(fixed, o.n)!.dot(tangentAwayFrom(p, o.n)!)).toBeGreaterThan(0.99);
  });
});
