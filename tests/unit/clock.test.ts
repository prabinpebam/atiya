import { describe, expect, it } from 'vitest';
import { clockHandAngles } from '../../src/game/world/clockFace';

const TAU = Math.PI * 2;
const at = (h: number, m: number, s = 0) => clockHandAngles(new Date(2026, 8, 25, h, m, s));

describe('town-hall clock face', () => {
  it('points every hand at 12 at midnight and noon', () => {
    for (const a of [at(0, 0), at(12, 0)]) {
      expect(a.hour).toBeCloseTo(0);
      expect(a.minute).toBeCloseTo(0);
      expect(a.second).toBeCloseTo(0);
    }
  });

  it('reads 3:00 as a quarter turn and 9:30 with the hour hand halfway past 9', () => {
    expect(at(15, 0).hour).toBeCloseTo(TAU / 4);
    expect(at(15, 0).minute).toBeCloseTo(0);
    const a = at(9, 30);
    expect(a.hour).toBeCloseTo((9.5 / 12) * TAU);
    expect(a.minute).toBeCloseTo(TAU / 2);
  });

  it('creeps the hour hand with the minutes and the minute hand with the seconds; the second hand ticks', () => {
    const a = at(10, 10, 30);
    expect(a.hour).toBeCloseTo(((10 + 10.5 / 60) / 12) * TAU);
    expect(a.minute).toBeCloseTo((10.5 / 60) * TAU);
    expect(a.second).toBeCloseTo(TAU / 2);
    // milliseconds don't move the second hand (it ticks whole seconds)
    expect(clockHandAngles(new Date(2026, 8, 25, 10, 10, 30, 900)).second).toBeCloseTo(TAU / 2);
  });

  it('uses the device local time (getHours), not UTC', () => {
    const d = new Date(Date.UTC(2026, 8, 25, 23, 45, 0));
    expect(clockHandAngles(d).hour).toBeCloseTo((((d.getHours() % 12) + d.getMinutes() / 60) / 12) * TAU);
  });
});
