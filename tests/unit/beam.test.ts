import { describe, expect, it } from 'vitest';
import { BEAM, BEAM_FALLOFF, BEAM_FRAG, beamFalloff } from '../../src/game/world/beam';

describe('lighthouse beam', () => {
  it('is long: more than twice the old 3.4 u cone', () => {
    expect(BEAM.length).toBeGreaterThan(2 * 3.4);
  });

  it('is brightest at the lamp and dissolves smoothly to nothing at its far end (no abrupt edge)', () => {
    expect(beamFalloff(0)).toBe(1);
    expect(beamFalloff(1)).toBe(0);
    let prev = 1;
    for (let t = 0.01; t <= 1.0001; t += 0.01) {
      const f = beamFalloff(t);
      expect(f).toBeLessThanOrEqual(prev);
      expect(prev - f).toBeLessThan(0.03); // no step anywhere along it
      prev = f;
    }
    // the last stretch is already nearly invisible, and it reaches 0 with zero slope
    expect(beamFalloff(0.9)).toBeLessThan(0.01);
    expect(beamFalloff(0.999) / 0.001).toBeLessThan(0.01);
    // half-way along it has faded to under a quarter, so the fade reads over the whole length
    expect(beamFalloff(0.5)).toBeLessThan(0.25);
  });

  it('the shader fades with the same curve', () => {
    expect(BEAM_FALLOFF).toBeGreaterThan(1);
    expect(BEAM_FRAG).toContain(`pow(1.0 - vT, ${BEAM_FALLOFF.toFixed(2)})`);
  });
});
