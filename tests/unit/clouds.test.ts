import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { CONFIG } from '../../src/game/config';
import {
  CLOUD_COUNT,
  CLOUD_DIST,
  CLOUD_RINGS,
  cloudLayout,
  cloudOrientation,
  cloudPosition,
  driftClouds,
  ringFrame,
} from '../../src/game/world/clouds';
import { skyPosition } from '../../src/game/world/timeOfDay';

const DEG = Math.PI / 180;
const C = CONFIG.camera;
const R = CONFIG.planetRadius;

/** The diorama camera for a pitch (deg) and zoom distance, lifted off the ground by `lift` (as in DioramaCamera). */
function cameraAt(pitchDeg: number, dist: number = C.distance, lift = 0): Vector3 {
  const p = pitchDeg * DEG;
  return new Vector3(0, R + lift + Math.sin(p) * dist, Math.cos(p) * dist);
}

const CAMERAS = [
  cameraAt(C.minPitchDeg),
  cameraAt(C.pitchDeg),
  cameraAt(C.maxPitchDeg),
  // mid fly-over: far zoom, high pitch, following half the hover height
  cameraAt(C.flyoverPitchDeg, C.flyoverDistance, 0.5 * CONFIG.travelHoverU),
];

describe('clouds', () => {
  it('orbit on circles concentric with the planet as the camera sees it, at any tilt and mid fly-over', () => {
    for (const cam of CAMERAS) {
      const f = ringFrame(cam);
      const toCentre = cam.clone().negate().normalize();
      for (const c of cloudLayout()) {
        for (const theta of [0, 1, 2, 3, 4, 5, 6]) {
          const p = cloudPosition(f, theta, c.alpha, c.dist);
          const v = p.clone().sub(cam);
          expect(v.length()).toBeCloseTo(c.dist, 9);
          expect(v.angleTo(toCentre) / DEG).toBeCloseTo(c.alpha, 9);
        }
      }
    }
  });

  it('never cover the planet and always stay in front of the sun and moon', () => {
    const minAlpha = Math.min(...CLOUD_RINGS.map((r) => r.alphaDeg[0]));
    for (const cam of CAMERAS) {
      const planet = Math.asin(R / cam.length()) / DEG;
      expect(minAlpha, `planet outline ${planet.toFixed(1)}°`).toBeGreaterThan(planet + 2.5);
      for (let arc = 0; arc <= 1; arc += 0.05) {
        expect(skyPosition(arc).distanceTo(cam)).toBeGreaterThan(CLOUD_DIST[1] + 5);
      }
    }
  });

  it('drift clockwise, crossing the top of the sky from left to right, with no wrap or jump', () => {
    const f = ringFrame(cameraAt(C.pitchDeg));
    const clouds = cloudLayout();
    const c = clouds[0];
    c.theta = Math.PI / 2;
    const before = cloudPosition(f, c.theta, c.alpha, c.dist);
    driftClouds(clouds, 5);
    const after = cloudPosition(f, c.theta, c.alpha, c.dist);
    expect(after.x).toBeGreaterThan(before.x);
    // one second of drift moves a cloud about its speed, never more (no teleport at the ring's seam)
    for (let t = 0; t < 4000; t++) {
      const prev = clouds.map((k) => cloudPosition(f, k.theta, k.alpha, k.dist));
      driftClouds(clouds, 1);
      clouds.forEach((k, i) => expect(cloudPosition(f, k.theta, k.alpha, k.dist).distanceTo(prev[i])).toBeLessThan(k.speed + 1e-6));
    }
  });

  it('each cloud faces the camera with its base toward the planet', () => {
    const f = ringFrame(cameraAt(C.pitchDeg));
    for (const theta of [0.3, Math.PI / 2, 2.5, 4]) {
      const q = cloudOrientation(f, theta);
      const up = new Vector3(0, 1, 0).applyQuaternion(q);
      const front = new Vector3(0, 0, 1).applyQuaternion(q);
      const radial = f.right.clone().multiplyScalar(Math.cos(theta)).addScaledVector(f.up, Math.sin(theta));
      expect(up.distanceTo(radial)).toBeLessThan(1e-9);
      expect(front.distanceTo(f.axis)).toBeLessThan(1e-9);
    }
  });

  it('fill the sky of a 16:9 view, and out to the far sides of a 32:9 ultrawide, all along their orbits', () => {
    expect(CLOUD_COUNT).toBe(cloudLayout().length);
    const camPos = cameraAt(C.pitchDeg);
    for (const aspect of [16 / 9, 32 / 9]) {
      const cam = new PerspectiveCamera(C.fov, aspect, 0.1, 130);
      cam.position.copy(camPos);
      cam.lookAt(0, R + C.lookUp, -C.lookAhead);
      cam.updateMatrixWorld();
      const f = ringFrame(camPos);
      const clouds = cloudLayout();
      // every 30 s over 20 minutes of drift
      for (let step = 0; step < 40; step++) {
        const onScreen = clouds
          .map((k) => cloudPosition(f, k.theta, k.alpha, k.dist).project(cam))
          .filter((n) => Math.abs(n.x) <= 1 && Math.abs(n.y) <= 1);
        const at = `aspect ${aspect.toFixed(2)} at ${step * 30} s`;
        if (aspect < 2) {
          // 16:9: a good handful of clouds, on both sides (clumps and clear patches come and go)
          expect(onScreen.length, at).toBeGreaterThanOrEqual(6);
          expect(Math.min(onScreen.filter((n) => n.x < 0).length, onScreen.filter((n) => n.x > 0).length), at).toBeGreaterThan(0);
        } else {
          // 32:9: the outer ring reaches the far sides, so no third of the sky is ever empty
          const thirds = [onScreen.filter((n) => n.x < -1 / 3), onScreen.filter((n) => Math.abs(n.x) <= 1 / 3), onScreen.filter((n) => n.x > 1 / 3)];
          expect(Math.min(...thirds.map((t) => t.length)), at).toBeGreaterThan(0);
        }
        driftClouds(clouds, 30);
      }
    }
  });
});
