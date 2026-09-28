import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/game/world/layout';
import { METEOR, MeteorShower } from '../../src/game/world/meteors';

const run = (s: MeteorShower, night: number, seconds: number) => {
  const seen: Array<{ start: number; end: number; x: number; y: number; dx: number; dy: number }> = [];
  let cur: (typeof seen)[number] | null = null;
  for (let t = 0; t < seconds; t += 1 / 60) {
    const m = s.step(1 / 60, night);
    if (m && !cur) seen.push((cur = { start: t, end: t, x: m.x, y: m.y, dx: m.dx, dy: m.dy }));
    if (m && cur) cur.end = t;
    if (!m) cur = null;
    if (m) {
      expect(Number.isFinite(m.alpha) && m.alpha >= 0 && m.alpha <= 1).toBe(true);
      expect(m.tail).toBeGreaterThanOrEqual(0);
      expect(m.tail).toBeLessThanOrEqual(METEOR.tail);
    }
  }
  return seen;
};

describe('shooting stars', () => {
  it('never by day or at dusk', () => {
    expect(run(new MeteorShower(mulberry32(1)), 0, 300)).toHaveLength(0);
    expect(run(new MeteorShower(mulberry32(1)), METEOR.night - 0.05, 300)).toHaveLength(0);
  });

  it('now and then at night: the first soon after the stars are out, then every 7–20 s, each under a second', () => {
    const seen = run(new MeteorShower(mulberry32(2)), 1, 300);
    expect(seen[0].start).toBeLessThanOrEqual(METEOR.first[1] + 0.1);
    expect(seen.length).toBeGreaterThan(300 / (METEOR.gap[1] + METEOR.life[1]) - 1);
    expect(seen.length).toBeLessThan(300 / METEOR.gap[0] + 1);
    for (const m of seen) expect(m.end - m.start).toBeLessThanOrEqual(METEOR.life[1] + 0.02);
    for (let i = 1; i < seen.length; i++) expect(seen[i].start - seen[i - 1].end).toBeGreaterThanOrEqual(METEOR.gap[0] - 0.05);
  });

  it('they start among the stars and fall across the sky toward its middle, not all the same way', () => {
    const seen = run(new MeteorShower(mulberry32(3)), 1, 600);
    for (const m of seen) {
      expect(m.dy).toBeLessThan(0);
      expect(Math.hypot(m.dx, m.dy)).toBeCloseTo(1, 6);
      expect(Math.abs(m.x)).toBeLessThanOrEqual(40);
      // (seen a frame in: one that starts right in the middle may have crossed it already)
      if (Math.abs(m.x) > 1.5) expect(Math.sign(m.dx)).toBe(m.x > 0 ? -1 : 1);
    }
    expect(new Set(seen.map((m) => Math.sign(m.dx))).size).toBe(2);
  });
});
