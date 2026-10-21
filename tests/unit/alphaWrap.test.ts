import { describe, expect, it } from 'vitest';
import { silhouette, wrapShape } from '../../src/site/scripts/alphaWrapRules';

/** A mask from rows of '#' (ink), '+' (faint, below the threshold) and '.' (clear), as RGBA. */
function mask(rows: string[]) {
  const cols = rows[0].length;
  const rgba = new Uint8ClampedArray(cols * rows.length * 4);
  rows.forEach((row, r) => [...row].forEach((ch, c) => (rgba[(r * cols + c) * 4 + 3] = ch === '#' ? 255 : ch === '+' ? 20 : 0)));
  return silhouette(rgba, cols, rows.length);
}

/** The box exactly the picture, 10 CSS pixels per mask cell. */
const box = (s: { cols: number; rows: number }) => ({ width: s.cols * 10, height: s.rows * 10, image: { x: 0, y: 0, width: s.cols * 10, height: s.rows * 10 } });
const loose = { gap: 0, measure: 10, band: 10 };

/** Where the outline's words-side edge sits at height y (the polygon's vertical runs, before its closing corners). */
function edgeAt(polygon: string, y: number): number {
  const pts = polygon.split(', ').map((p) => p.split(' ').map((n) => parseFloat(n)));
  for (let i = 1; i < pts.length - 2; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    if (x0 === x1 && y0 <= y && y < y1) return x0;
  }
  throw new Error(`no edge at ${y}: ${polygon}`);
}

describe('alpha wrap: the silhouette', () => {
  it('finds each row’s first and last ink, leaving out faint pixels', () => {
    const s = mask(['..##..', '+#..#.', '......']);
    expect([...s.first]).toEqual([2, 1, -1]);
    expect([...s.last]).toEqual([3, 4, -1]);
    expect(s.inked).toBe(2);
  });
});

describe('alpha wrap: the outline', () => {
  it('ink on the right: the words take the left up to the ink, and the shape closes along the right edge', () => {
    const s = mask(['....##', '....##', '...###', '...###']);
    const w = wrapShape(s, box(s), loose)!;
    expect(w.side).toBe('left');
    expect([5, 15, 25, 35].map((y) => edgeAt(w.polygon, y))).toEqual([40, 40, 30, 30]);
    expect(w.polygon.endsWith('60px 40px, 60px 0px')).toBe(true);
  });

  it('ink on the left: the words take the right, mirrored', () => {
    const s = mask(['##....', '###...']);
    const w = wrapShape(s, box(s), loose)!;
    expect(w.side).toBe('right');
    expect([5, 15].map((y) => edgeAt(w.polygon, y))).toEqual([20, 30]);
    expect(w.polygon.endsWith('0px 20px, 0px 0px')).toBe(true);
  });

  it('a hole inside the ink is ignored: only the profile from the words’ side counts', () => {
    const s = mask(['...#.#', '...###']);
    const w = wrapShape(s, box(s), loose, 'left')!;
    expect([5, 15].map((y) => edgeAt(w.polygon, y))).toEqual([30, 30]);
  });

  it('a photo, a full frame or a picture with no ink leaves the box alone (null)', () => {
    const full = mask(['######', '######']);
    expect(wrapShape(full, box(full), loose)).toBeNull();
    const none = mask(['......']);
    expect(wrapShape(none, box(none), loose)).toBeNull();
  });

  it('a gap narrower than the measure is closed: a line never holds a word or two', () => {
    const s = mask(['.#####', '.#####', '....##', '....##']);
    const w = wrapShape(s, box(s), { gap: 0, measure: 30, band: 10 }, 'left')!;
    expect([5, 15, 25, 35].map((y) => edgeAt(w.polygon, y))).toEqual([0, 0, 40, 40]);
  });

  it('an open run shorter than the band is closed, unless it’s at the foot (the words carry on below)', () => {
    const s = mask(['.....#', '#####.', '.....#', '.....#']);
    const w = wrapShape(s, box(s), { gap: 0, measure: 10, band: 15 }, 'left')!;
    expect([5, 15, 25, 35].map((y) => edgeAt(w.polygon, y))).toEqual([0, 0, 50, 50]);
    const foot = mask(['#####.', '#####.', '#####.', '.....#']);
    const v = wrapShape(foot, box(foot), { gap: 0, measure: 10, band: 15 }, 'left')!;
    expect(edgeAt(v.polygon, 35)).toBe(50);
  });

  it('the padding reaches round: a clear row just above ink near the edge loses room, one further away keeps it', () => {
    const s = mask(['......', '......', '......', '##....']);
    // words on the right (x from the right edge); the ink ends at x 20, padded 15, measure 30:
    // row 0 is 20 px above the ink (out of reach: 45 px of room), row 1 is 10 px above (about 29 px: closed)
    const w = wrapShape(s, box(s), { gap: 15, measure: 30, band: 5 }, 'right')!;
    expect(edgeAt(w.polygon, 5)).toBe(0);
    expect(edgeAt(w.polygon, 15)).toBe(60);
    const unpadded = wrapShape(s, box(s), { gap: 0, measure: 30, band: 5 }, 'right')!;
    expect(edgeAt(unpadded.polygon, 15)).toBe(0);
  });

  it('chooses the side with more room, and the preferred side on a tie', () => {
    const left = mask(['#.....', '#.....']);
    expect(wrapShape(left, box(left), loose)!.side).toBe('right');
    const middle = mask(['..##..', '..##..']);
    expect(wrapShape(middle, box(middle), loose)!.side).toBe('left');
    expect(wrapShape(middle, box(middle), loose, 'auto', 'right')!.side).toBe('right');
  });

  it('maps the mask into the picture as drawn in its frame: the letterbox above and below is open', () => {
    const s = mask(['....##']);
    const w = wrapShape(s, { width: 60, height: 30, image: { x: 0, y: 10, width: 60, height: 10 } }, loose, 'left')!;
    expect([5, 15, 25].map((y) => edgeAt(w.polygon, y))).toEqual([60, 40, 60]);
  });

  it('keeps every point inside the box', () => {
    const s = mask(['.#..#.', '##..##', '..##..']);
    const b = { width: 90, height: 50, image: { x: 15, y: 10, width: 60, height: 30 } };
    for (const side of ['left', 'right'] as const) {
      const w = wrapShape(s, b, { gap: 8, measure: 10, band: 5 }, side);
      if (!w) continue;
      for (const [x, y] of w.polygon.split(', ').map((p) => p.split(' ').map((n) => parseFloat(n)))) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(90);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(50);
      }
    }
  });
});
