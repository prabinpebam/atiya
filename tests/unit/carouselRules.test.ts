/** The carousel's rules (src/site/scripts/media.ts): its keys, its slides' shape, and a peek's inset and shading. */
import { describe, expect, it } from 'vitest';
import { arrowStep, peekInset, peekOf, slideShape } from '../../src/site/scripts/media';

describe('carousel: keys', () => {
  it('Left is previous, Right is next, nothing else moves', () => {
    expect(arrowStep('ArrowLeft')).toBe(-1);
    expect(arrowStep('ArrowRight')).toBe(1);
    expect(['ArrowUp', 'ArrowDown', 'Home', 'End', ' ', 'Enter', 'a'].map(arrowStep)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});

describe("carousel: the slides' shape", () => {
  it('the tallest picture (height over width) sets it', () => {
    expect(slideShape([{ width: 1600, height: 900 }, { width: 800, height: 1000 }, { width: 1200, height: 1200 }])).toEqual({ width: 800, height: 1000 });
  });

  it("a dark version counts too", () => {
    expect(slideShape([{ width: 1600, height: 900, dark: { width: 900, height: 1600 } }])).toEqual({ width: 900, height: 1600 });
  });

  it('the first of equally tall shapes wins', () => {
    expect(slideShape([{ width: 300, height: 200 }, { width: 600, height: 400 }])).toEqual({ width: 300, height: 200 });
  });

  it('pictures without a size are left out; with none at all, 3:2', () => {
    expect(slideShape([{ width: 0, height: 500 }, { width: 400, height: 300 }])).toEqual({ width: 400, height: 300 });
    expect(slideShape([])).toEqual({ width: 3, height: 2 });
    expect(slideShape([{ width: 0, height: 0 }])).toEqual({ width: 3, height: 2 });
  });
});

describe('carousel: peek', () => {
  it('the inset makes up what the narrower side lacks of the minimum, and is none on a phone', () => {
    expect(peekInset(48, 0, 0, false)).toBe(48);
    expect(peekInset(48, 200, 20, false)).toBe(28);
    expect(peekInset(48, 200, 300, false)).toBe(0);
    expect(peekInset(48, 0, 0, true)).toBe(0);
  });

  it('a slide is 0 in the middle, 1 a slide away and no more, before or after it', () => {
    expect(peekOf(500, 500, 400)).toEqual({ peek: 0, side: 'after' });
    expect(peekOf(700, 500, 400)).toEqual({ peek: 0.5, side: 'after' });
    expect(peekOf(100, 500, 400)).toEqual({ peek: 1, side: 'before' });
    expect(peekOf(-700, 500, 400)).toEqual({ peek: 1, side: 'before' });
    expect(peekOf(1300, 500, 400)).toEqual({ peek: 1, side: 'after' });
  });
});
