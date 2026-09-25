import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/game/config';
import { CLOUD_BAND, CLOUD_COUNT, CLOUD_FADE_U, CLOUD_SPAN, cloudFade } from '../../src/game/world/clouds';

const DEG = Math.PI / 180;

/** Half the visible width (u) at the farthest, lowest cloud for a camera pitch (deg) and aspect ratio. */
function visibleHalfWidth(pitchDeg: number, aspect: number): number {
  const C = CONFIG.camera;
  const p = pitchDeg * DEG;
  const camY = CONFIG.planetRadius + Math.sin(p) * C.distance;
  const camZ = Math.cos(p) * C.distance;
  // depth along the camera's forward (looking down at `p`)
  const depth = (camZ - CLOUD_BAND.z[0]) * Math.cos(p) + (camY - CLOUD_BAND.y[0]) * Math.sin(p);
  return depth * Math.tan((C.fov * DEG) / 2) * aspect;
}

describe('clouds', () => {
  it('fade smoothly to nothing at the wrap edges and are fully opaque across the middle', () => {
    expect(cloudFade(0)).toBe(1);
    expect(cloudFade(CLOUD_SPAN / 2)).toBe(0);
    expect(cloudFade(-CLOUD_SPAN / 2)).toBe(0);
    expect(cloudFade(CLOUD_SPAN / 2 - CLOUD_FADE_U)).toBe(1);
    // monotone, with no step anywhere across the fade band (a slow fade, not a pop)
    let prev = 1;
    for (let x = CLOUD_SPAN / 2 - CLOUD_FADE_U; x <= CLOUD_SPAN / 2; x += 0.1) {
      const f = cloudFade(x);
      expect(f).toBeLessThanOrEqual(prev + 1e-12);
      expect(prev - f).toBeLessThan(0.02);
      prev = f;
    }
  });

  it('the band is wide enough that even a 32:9 ultrawide sees only fully opaque clouds, at any tilt', () => {
    for (const pitch of [CONFIG.camera.minPitchDeg, CONFIG.camera.pitchDeg, CONFIG.camera.maxPitchDeg]) {
      expect(visibleHalfWidth(pitch, 32 / 9), `pitch ${pitch}`).toBeLessThanOrEqual(CLOUD_SPAN / 2 - CLOUD_FADE_U);
    }
    // a 16:9 view is far inside it
    expect(visibleHalfWidth(CONFIG.camera.pitchDeg, 16 / 9)).toBeLessThan(CLOUD_SPAN / 4);
  });

  it('keeps the original density (about one cloud every 7 u)', () => {
    expect(CLOUD_SPAN / CLOUD_COUNT).toBeGreaterThan(6.5);
    expect(CLOUD_SPAN / CLOUD_COUNT).toBeLessThan(7.5);
  });
});
