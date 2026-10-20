import { describe, expect, it } from 'vitest';
import { STILL_BOX, STILL_VIEWS, stillCount, stillShapes, type StillShape } from '../../src/site/design/stills';

const PAD = 8;
const inside = (s: StillShape) => s.x >= PAD - 1e-9 && s.y >= PAD - 1e-9 && s.x + s.w <= STILL_BOX.w - PAD + 1e-9 && s.y + s.h <= STILL_BOX.h - PAD + 1e-9;
const overlap = (a: StillShape, b: StillShape) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('view stills', () => {
  for (const view of STILL_VIEWS) {
    const most = view === 'classic' ? 4 : 6;
    for (let n = 1; n <= most; n++) {
      it(`${view} with ${n}: inside the box, one mark each, none overlapping`, () => {
        const shapes = stillShapes(view, n);
        expect(shapes.filter((s) => !inside(s))).toEqual([]);
        for (const s of shapes) {
          expect(s.w).toBeGreaterThan(0);
          expect(s.h).toBeGreaterThan(0);
          expect(s.r).toBeGreaterThanOrEqual(0);
          expect(s.r).toBeLessThanOrEqual(Math.min(s.w, s.h) / 2 + 1e-9);
        }
        const marks = shapes.filter((s) => s.mark);
        expect(marks).toHaveLength(n);
        for (let i = 0; i < marks.length; i++) for (let j = i + 1; j < marks.length; j++) expect(overlap(marks[i], marks[j])).toBe(false);
      });
    }
  }

  it('clamps the count: one to six strengths, one to four sections', () => {
    expect(stillCount('bento', 0)).toBe(1);
    expect(stillCount('bento', 9)).toBe(6);
    expect(stillCount('bento', 3.7)).toBe(3);
    expect(stillCount('bento', Number.NaN)).toBe(1);
    expect(stillCount('classic', 7)).toBe(4);
    expect(stillShapes('cover', 12).filter((s) => s.mark)).toHaveLength(6);
  });

  it('draws an unknown view as its lead and an empty area, with no marks', () => {
    const shapes = stillShapes('showreel', 4);
    expect(shapes.some((s) => s.mark)).toBe(false);
    expect(shapes.map((s) => s.tone)).toEqual(['ink', 'faint', 'sunk']);
  });

  it('is the same every time, to two decimals', () => {
    for (const view of STILL_VIEWS) {
      const a = stillShapes(view, 5);
      expect(stillShapes(view, 5)).toEqual(a);
      for (const s of a) for (const v of [s.x, s.y, s.w, s.h, s.r]) expect(Math.round(v * 100) / 100).toBe(v);
    }
  });
});
