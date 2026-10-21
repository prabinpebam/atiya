import { describe, expect, it } from 'vitest';
import { edgeScale, lengthPx } from '../../src/site/scripts/liftRules';

const edges = (scale: string, w: number, h: number) => {
  const [x, y] = scale.split(' ').map(Number);
  return [(w * x - w) / 2, (h * y - h) / 2];
};

describe('a rise by a distance, not a ratio', () => {
  it('reads px and rem lengths, rem against the root', () => {
    expect(lengthPx('8px', 16)).toBe(8);
    expect(lengthPx(' 0.5rem', 16)).toBe(8);
    expect(lengthPx('0.5rem', 20)).toBe(10);
    expect(lengthPx('', 16)).toBeNull();
    expect(lengthPx('1em', 16)).toBeNull();
    expect(lengthPx('var(--space-2)', 16)).toBeNull();
  });

  it('moves every edge of every tile the same distance, whatever its size', () => {
    for (const [w, h] of [
      [280, 220],
      [620, 640],
      [1200, 300],
      [300, 900],
    ]) {
      const [x, y] = edges(edgeScale(w, h, 8)!, w, h);
      expect(x).toBeCloseTo(8, 1);
      expect(y).toBeCloseTo(8, 1);
    }
  });

  it('a big tile grows by a smaller factor than a small one', () => {
    const big = Number(edgeScale(1200, 800, 8)!.split(' ')[0]);
    const small = Number(edgeScale(300, 200, 8)!.split(' ')[0]);
    expect(big).toBeLessThan(small);
    expect(big).toBeGreaterThan(1);
  });

  it('a press moves the edges in', () => {
    const [x, y] = edges(edgeScale(400, 300, -4)!, 400, 300);
    expect(x).toBeCloseTo(-4, 1);
    expect(y).toBeCloseTo(-4, 1);
  });

  it('gives nothing for a box with no size or one a press would turn inside out', () => {
    expect(edgeScale(0, 300, 8)).toBeNull();
    expect(edgeScale(300, 0, 8)).toBeNull();
    expect(edgeScale(6, 6, -4)).toBeNull();
    expect(edgeScale(300, 300, Number.NaN)).toBeNull();
  });
});
