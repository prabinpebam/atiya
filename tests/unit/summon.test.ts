import { describe, expect, it } from 'vitest';
import { POP_S, SUMMON_GROUPS, WAVE, popPose, sproutAt, spring, waveTimes, type PopKind } from '../../src/game/world/summon';

describe('the summoning (progressive-loading.md §5.5)', () => {
  it('summons Prabin first, then the props, the home, the grass, the crafting, the wildlife and the clouds', () => {
    expect(SUMMON_GROUPS).toEqual(['prabin', 'props', 'home', 'grass', 'craft', 'wildlife', 'clouds']);
  });

  it('times the wave outward from the character, nearest first, a few objects a frame', () => {
    const d = [5, 0.5, 12, 3, 3, 3, 3, 3, 3, 3, 3];
    const t = waveTimes(d, 2);
    // nearest first, and at about 12 u/s
    expect(t[1]).toBeCloseTo(2 + 0.5 / WAVE.speed, 6);
    expect(t[0]).toBeGreaterThan(t[3]);
    expect(t[2]).toBeGreaterThan(t[0]);
    expect(t[2]).toBeCloseTo(2 + 12 / WAVE.speed, 6);
    // eight things at the same distance: no more than six start in one frame
    const same = t.filter((_, i) => d[i] === 3).sort((a, b) => a - b);
    expect(same[same.length - 1] - same[0]).toBeGreaterThanOrEqual(WAVE.frameS - 1e-9);
    const frames = new Map<number, number>();
    for (const x of t) frames.set(Math.floor((x - 2) / WAVE.frameS + 1e-6), (frames.get(Math.floor((x - 2) / WAVE.frameS + 1e-6)) ?? 0) + 1);
    // (a frame holds at most perFrame starts, give or take one where two frames' windows meet)
    for (const n of frames.values()) expect(n).toBeLessThanOrEqual(WAVE.perFrame + 1);
  });

  it('within reach, what you can use comes before what you only see', () => {
    const t = waveTimes([2, 2], 0, [false, true]);
    expect(t[1]).toBeLessThan(t[0]);
    // far away, using doesn't matter
    const far = waveTimes([9, 9], 0, [false, true]);
    expect(far[1]).toBe(far[0]);
  });

  it('the spring overshoots to about 1.1 and settles, and is never NaN', () => {
    let peak = 0;
    for (let t = 0; t <= POP_S; t += 0.005) peak = Math.max(peak, spring(t));
    expect(peak).toBeGreaterThan(1.07);
    expect(peak).toBeLessThan(1.16);
    expect(spring(0)).toBe(0);
    expect(spring(POP_S)).toBe(1);
    expect(Math.abs(spring(POP_S * 0.999) - 1)).toBeLessThan(0.01);
    for (const t of [NaN, -1, Infinity, -Infinity, 1e9]) expect(Number.isFinite(spring(t))).toBe(true);
  });

  it('each kind pops in its own way, settles, is safe for any time, and reduced motion gets none of the motion', () => {
    for (const kind of ['tree', 'rock', 'flower', 'model', 'fade'] as PopKind[]) {
      expect(popPose(kind, -0.1).scale).toBe(0);
      expect(popPose(kind, NaN).done).toBe(false);
      const end = popPose(kind, 5);
      expect(end).toMatchObject({ scale: 1, stretch: 1, wiggle: 0, drop: 0, alpha: 1, done: true });
      for (let t = 0; t < 1; t += 0.01) {
        const p = popPose(kind, t, 0.37);
        for (const v of [p.scale, p.stretch, p.wiggle, p.drop, p.alpha]) expect(Number.isFinite(v)).toBe(true);
        expect(p.scale).toBeGreaterThanOrEqual(0);
        expect(p.scale * p.stretch).toBeLessThan(1.3);
        expect(Math.abs(p.wiggle)).toBeLessThan(0.15);
      }
      // reduced motion: there from its birth, without a spring or a wiggle
      expect(popPose(kind, 0, 0.5, true)).toMatchObject({ scale: 1, wiggle: 0, done: true });
      expect(popPose(kind, -1, 0.5, true).scale).toBe(0);
    }
    // trees wiggle, rocks don't but drop in, flowers are quicker
    expect(Math.max(...[0.05, 0.1, 0.15].map((t) => Math.abs(popPose('tree', t, 0.2).wiggle)))).toBeGreaterThan(0.02);
    expect(popPose('rock', 0.02).drop).toBeGreaterThan(0.3);
    expect(popPose('rock', 0.1).wiggle).toBe(0);
    expect(popPose('flower', POP_S * 0.75).done).toBe(true);
    expect(popPose('tree', POP_S * 0.75).done).toBe(false);
  });

  it('the grass sprouts in a ripple behind the wave front', () => {
    expect(sproutAt(3, 0)).toBe(0);
    expect(sproutAt(3, 3 / WAVE.speed)).toBe(0);
    expect(sproutAt(3, (3 + 1.5) / WAVE.speed)).toBe(1);
    const mid = sproutAt(3, (3 + 0.75) / WAVE.speed);
    expect(mid).toBeGreaterThan(0.3);
    expect(mid).toBeLessThan(0.7);
    expect(sproutAt(3, NaN)).toBe(0);
  });
});
