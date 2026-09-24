import { describe, expect, it } from 'vitest';
import {
  CYCLE_DAY_SECONDS,
  CYCLE_NIGHT_SECONDS,
  SUNRISE,
  SUNSET,
  advanceHours,
  bodyDirection,
  formatHours,
  sampleSky,
  wrapHours,
} from '../../src/game/world/timeOfDay';

describe('day–night model', () => {
  it('is fully day at midday and fully night at midnight', () => {
    expect(sampleSky(12).night).toBe(0);
    expect(sampleSky(0).night).toBe(1);
    expect(sampleSky(12).lightIntensity).toBeGreaterThan(2);
    expect(sampleSky(0).lightIntensity).toBeLessThan(0.7);
  });

  it('is continuous across keyframes and across midnight', () => {
    for (let h = 0; h < 24; h += 0.05) {
      const a = sampleSky(h);
      const b = sampleSky(h + 0.05);
      expect(Math.abs(a.night - b.night)).toBeLessThan(0.08);
      expect(Math.abs(a.hemiIntensity - b.hemiIntensity)).toBeLessThan(0.08);
      expect(a.skyTop.clone().sub(b.skyTop).r).toBeLessThan(0.08);
    }
    expect(sampleSky(23.999).night).toBeCloseTo(sampleSky(0).night, 2);
  });

  it('keeps the light above the horizon and hands sun→moon over at zero intensity', () => {
    for (let h = 0; h < 24; h += 0.01) {
      const s = sampleSky(h);
      const next = sampleSky(h + 0.01);
      expect(s.lightDir.y).toBeGreaterThan(0.2);
      expect(Math.abs(s.lightDir.length() - 1)).toBeLessThan(1e-9);
      expect(Math.abs(s.lightIntensity - next.lightIntensity)).toBeLessThan(0.05);
      // whenever the light switches body (direction jumps), it must be (almost) off
      if (s.lightDir.distanceTo(next.lightDir) > 0.2) expect(Math.max(s.lightIntensity, next.lightIntensity)).toBeLessThan(0.02);
    }
  });

  it('rises at screen-left and sets at screen-right', () => {
    expect(bodyDirection(0).x).toBeLessThan(-0.5);
    expect(bodyDirection(1).x).toBeGreaterThan(0.5);
    expect(bodyDirection(0.5).y).toBeGreaterThan(bodyDirection(0).y);
  });

  it('glows lamps only at night (below the bloom threshold by day)', () => {
    expect(sampleSky(12).glow).toBeLessThan(0.6);
    expect(sampleSky(0).glow).toBeGreaterThan(1.4);
  });

  it('cycles: day ≈ 4.5 min, night ≈ 1.5 min', () => {
    let h = SUNRISE;
    let t = 0;
    while (h < SUNSET - 1e-6 && t < 1000) {
      h = advanceHours(h, 1);
      t++;
    }
    expect(t).toBeGreaterThanOrEqual(CYCLE_DAY_SECONDS - 1);
    expect(t).toBeLessThanOrEqual(CYCLE_DAY_SECONDS + 1);
    let n = 0;
    h = SUNSET;
    while (!(h >= SUNRISE && h < SUNSET) && n < 1000) {
      h = advanceHours(h, 1);
      n++;
    }
    expect(n).toBeGreaterThanOrEqual(CYCLE_NIGHT_SECONDS - 1);
    expect(n).toBeLessThanOrEqual(CYCLE_NIGHT_SECONDS + 2);
  });

  it('wraps and formats hours', () => {
    expect(wrapHours(25)).toBe(1);
    expect(wrapHours(-1)).toBe(23);
    expect(formatHours(0)).toBe('12:00 AM');
    expect(formatHours(9.5)).toBe('9:30 AM');
    expect(formatHours(12)).toBe('12:00 PM');
    expect(formatHours(21.25)).toBe('9:15 PM');
  });
});
