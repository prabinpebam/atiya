/** The carousel's rules (src/site/scripts/media.ts): its keys, its slides' shape, a loop, autoplay, and a peek's inset and shading. */
import { describe, expect, it } from 'vitest';
import { arrowStep, autoplayRuns, HAZE_REACH, hazeLevels, hazeOf, hazePlan, loopOrder, peekInset, peekOf, slideIndex, SLIDE_SECONDS, slideSeconds, slideShape, type AutoplayHold } from '../../src/site/scripts/media';

describe('carousel: a loop', () => {
  it('without loop, the ends are real; with it, past either end is the other', () => {
    expect([-1, 0, 6, 7].map((i) => slideIndex(i, 7, false))).toEqual([0, 0, 6, 6]);
    expect([-1, 0, 6, 7].map((i) => slideIndex(i, 7, true))).toEqual([6, 0, 6, 0]);
  });

  it('the slide shown sits in the middle of the row, with the ones before it on its left and after it on its right', () => {
    // 7 slides, the first shown: the last is just before it and the second just after
    const order = loopOrder(0, 7);
    expect(order[0]).toBe(3);
    expect(order[6]).toBe(2);
    expect(order[1]).toBe(4);
    expect([...order].sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
    // the last shown: the first comes right after it
    const last = loopOrder(6, 7);
    expect(last[0] - last[6]).toBe(1);
  });

  it('every slide has a neighbour each way from 3 slides; 2 slides keep the other one after; 1 stays put', () => {
    for (let n = 3; n <= 8; n++) {
      for (let c = 0; c < n; c++) {
        const o = loopOrder(c, n);
        expect(o[c]).toBeGreaterThan(0);
        expect(o[c]).toBeLessThan(n - 1);
        expect(o[(c + 1) % n]).toBe(o[c] + 1);
        expect(o[(c - 1 + n) % n]).toBe(o[c] - 1);
      }
    }
    expect(loopOrder(0, 2)).toEqual([0, 1]);
    expect(loopOrder(1, 2)).toEqual([1, 0]);
    expect(loopOrder(0, 1)).toEqual([0]);
  });
});

describe('carousel: autoplay', () => {
  it('runs only while nothing holds it', () => {
    expect(autoplayRuns(new Set())).toBe(true);
    for (const why of ['stopped', 'moving', 'hidden', 'away', 'drag'] as AutoplayHold[]) expect(autoplayRuns(new Set([why]))).toBe(false);
  });

  it("a slide's time is 4 seconds by default, held between 2 and 30", () => {
    expect(SLIDE_SECONDS.default).toBe(4);
    expect(slideSeconds(undefined)).toBe(4);
    expect(slideSeconds(Number.NaN)).toBe(4);
    expect(slideSeconds(Number.POSITIVE_INFINITY)).toBe(4);
    expect(slideSeconds(1)).toBe(2);
    expect(slideSeconds(6.5)).toBe(6.5);
    expect(slideSeconds(90)).toBe(30);
  });
});

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

describe('carousel: the haze over a neighbour', () => {
  it('blurs from near to far in a few levels, each at most 1.5 times the last', () => {
    const L = hazeLevels(4, 20);
    expect(L[0]).toBe(4);
    expect(L.at(-1)).toBe(20);
    expect(L.length).toBeLessThanOrEqual(5);
    for (let k = 1; k < L.length; k++) expect(L[k] / L[k - 1]).toBeLessThanOrEqual(1.5 + 1e-9);
    expect(hazeLevels(4, 0)).toEqual([]);
    expect(hazeLevels(20, 20)).toEqual([20]);
  });

  it("lies where the stylesheet's mask fades: each neighbour's near edge, the gap from the slide shown, to its far end or the viewport's edge", () => {
    // room beside the carousel (400 a side), no inset: a 336-wide neighbour each side, cut at the edges
    expect(hazeOf(1120, 400, 400, 0, 64)).toEqual({ width: 1920, start: { near: 336, far: 0 }, end: { near: 1584, far: 1920 } });
    // no room: the inset keeps a sliver, and the neighbour's far end is a slide's width away
    expect(hazeOf(1000, 0, 0, 112, 64)).toEqual({ width: 1000, start: { near: 48, far: 0 }, end: { near: 952, far: 1000 } });
    // nothing past the gap on a side: no haze there
    expect(hazeOf(1000, 0, 200, 0, 64).start).toBeNull();
  });

  const haze = hazeOf(1120, 400, 400, 0, 64);
  const plan = hazePlan(haze, 4, 20, 64, 600)!;

  it('keeps the slide shown sharp, and eases from sharp to the first blur across the gap, never at a cut', () => {
    expect(plan.sharp).toEqual({ from: 400, to: 1520 });
    for (const side of plan.sides) {
      expect(side.levels[0].blur).toBe(0);
      expect(side.levels[1].blur).toBe(4);
      expect(side.levels.at(-1)!.blur).toBe(20);
      // the first band starts where the sharp stretch ends: the slide shown's edge
      const first = side.bands[0];
      expect(first.towards > 0 ? first.from : first.to).toBe(first.towards > 0 ? plan.sharp.to : plan.sharp.from);
      expect(Math.abs(first.to - first.from)).toBe(64);
    }
  });

  it("each side's bands meet without a gap or an overlap, mix neighbouring levels, and the last runs on to the viewport's edge", () => {
    for (const side of plan.sides) {
      const bands = [...side.bands].sort((a, b) => a.from - b.from);
      for (let k = 1; k < bands.length; k++) expect(bands[k].from).toBe(bands[k - 1].to);
      for (const b of side.bands) {
        expect(b.upper - b.lower).toBe(1);
        expect(b.mid).toBeGreaterThan(b.from);
        expect(b.mid).toBeLessThan(b.to);
      }
      const outer = side.bands.at(-1)!;
      expect(outer.towards > 0 ? outer.to : outer.from).toBe(outer.towards > 0 ? 1920 : 0);
      // each level is needed over exactly the bands it's part of
      side.levels.forEach((level, k) => {
        const parts = side.bands.filter((b) => b.lower === k || b.upper === k);
        expect(level.from).toBe(Math.min(...parts.map((b) => b.from)));
        expect(level.to).toBe(Math.max(...parts.map((b) => b.to)));
      });
    }
  });

  it("reaches past the track by the most blur's spread on every side, so no blur is cut short", () => {
    const reach = HAZE_REACH * 20;
    expect(plan.region.x).toBeLessThanOrEqual(-reach);
    expect(plan.region.y).toBeLessThanOrEqual(-reach);
    expect(plan.region.x + plan.region.width).toBeGreaterThanOrEqual(1920 + reach);
    expect(plan.region.y + plan.region.height).toBeGreaterThanOrEqual(600 + reach);
  });

  it('draws nothing when no neighbour shows, and without a gap starts at the first blur', () => {
    expect(hazePlan({ width: 1000, start: null, end: null }, 4, 20, 64, 600)).toBeNull();
    const tight = hazePlan(haze, 4, 20, 0, 600)!;
    expect(tight.sharp).toEqual({ from: 336, to: 1584 });
    expect(tight.sides[0].levels[0].blur).toBe(4);
  });
});
