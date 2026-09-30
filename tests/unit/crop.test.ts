/**
 * The crop's geometry (src/site/editor/model/crop.ts; documentation/editor/spec.md §6.1): the largest
 * rectangle of a shape, moving and centring, the eight handles with and without a ratio, the Size slider,
 * whole pixels, and a shape in words. Everything stays inside the picture and above the least size.
 */
import { describe, expect, it } from 'vitest';
import { centreOn, largest, MIN_SIDE, move, pictureNote, ratioLabel, ratioOfShape, resize, resizeTo, sizeOf, whole, withRatio, HANDLES, type Rect } from '../../src/site/editor/model/crop';

const B = { width: 1024, height: 576 };
const within = (r: Rect, b = B) => r.x >= -1e-9 && r.y >= -1e-9 && r.x + r.width <= b.width + 1e-9 && r.y + r.height <= b.height + 1e-9;
const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-6);

describe('the crop rectangle', () => {
  it('is, at its largest, the whole picture without a ratio, and the widest centred rectangle of a ratio with one', () => {
    expect(largest(B)).toEqual({ x: 0, y: 0, width: 1024, height: 576 });
    // 16:9 picture, 21:9 crop: as wide as the picture, height trimmed
    const lead = largest(B, 21 / 9);
    expect(lead.width).toBe(1024);
    close(lead.height, 1024 / (21 / 9));
    close(lead.y, (576 - lead.height) / 2);
    // 1:1: as tall as the picture, centred across
    expect(largest(B, 1)).toEqual({ x: 224, y: 0, width: 576, height: 576 });
    // centred on a point as far as it can be
    expect(largest(B, 1, 0, 0)).toEqual({ x: 0, y: 0, width: 576, height: 576 });
  });

  it('moves and centres within the picture', () => {
    const r = { x: 100, y: 100, width: 200, height: 100 };
    expect(move(r, -500, 0, B).x).toBe(0);
    expect(move(r, 5000, 5000, B)).toEqual({ x: 824, y: 476, width: 200, height: 100 });
    expect(centreOn(r, 512, 288, B)).toEqual({ x: 412, y: 238, width: 200, height: 100 });
    expect(centreOn(r, 1024, 0, B)).toEqual({ x: 824, y: 0, width: 200, height: 100 });
  });

  it('resizes freely by any handle, the opposite side staying put, inside the picture and never below the least size', () => {
    const r = { x: 100, y: 100, width: 400, height: 200 };
    expect(resize(r, 'se', 50, 20, B)).toEqual({ x: 100, y: 100, width: 450, height: 220 });
    expect(resize(r, 'nw', -50, -20, B)).toEqual({ x: 50, y: 80, width: 450, height: 220 });
    expect(resize(r, 'e', 5000, 0, B)).toEqual({ x: 100, y: 100, width: 924, height: 200 });
    expect(resize(r, 'n', 0, 5000, B)).toEqual({ x: 100, y: 300 - MIN_SIDE, width: 400, height: MIN_SIDE });
    for (const h of HANDLES) for (const [dx, dy] of [[-9999, -9999], [9999, 9999], [-9999, 9999], [9999, -9999]]) expect(within(resize(r, h, dx, dy, B))).toBe(true);
  });

  it('resizes by any handle keeping a ratio: a corner follows the pointer\u2019s further way, a side keeps the other axis centred', () => {
    const ratio = 3 / 2;
    const r = { x: 200, y: 100, width: 300, height: 200 };
    const corner = resize(r, 'se', 60, 10, B, ratio);
    expect(corner.x).toBe(200);
    expect(corner.y).toBe(100);
    close(corner.width / corner.height, ratio);
    expect(corner.width).toBe(360);
    const side = resize(r, 'e', 60, 0, B, ratio);
    close(side.width / side.height, ratio);
    close(side.y + side.height / 2, 200);
    const top = resize(r, 'n', 0, -40, B, ratio);
    close(top.height, 240);
    close(top.x + top.width / 2, 350);
    for (const h of HANDLES)
      for (const [dx, dy] of [[-9999, -9999], [9999, 9999], [-9999, 9999], [9999, -9999], [-290, -190]]) {
        const out = resize(r, h, dx, dy, B, ratio);
        expect(within(out), `${h} ${dx},${dy}`).toBe(true);
        close(out.width / out.height, ratio);
        expect(out.height).toBeGreaterThanOrEqual(MIN_SIDE - 1e-9);
      }
  });

  it('changes shape where it is, and the Size slider scales it about its centre, its shape kept', () => {
    const r = { x: 600, y: 200, width: 200, height: 100 };
    const square = withRatio(r, B, 1);
    expect(square.width).toBe(576);
    close(square.x + square.width / 2, 700);
    expect(withRatio(r, B)).toBe(r);
    const half = resizeTo(largest(B, 3 / 2), 0.5, B);
    close(sizeOf(half, B), 0.5);
    close(half.width / half.height, 3 / 2);
    close(half.x + half.width / 2, 512);
    close(sizeOf(resizeTo(half, 2, B), B), 1);
    expect(resizeTo(half, 0, B).height).toBeGreaterThanOrEqual(MIN_SIDE);
  });

  it('saves in whole pixels, inside the picture', () => {
    expect(whole({ x: 10.4, y: 0.6, width: 99.5, height: 50.2 }, B)).toEqual({ x: 10, y: 1, width: 100, height: 50 });
    expect(whole({ x: 1000.7, y: 570, width: 30, height: 10 }, B)).toEqual({ x: 994, y: 566, width: 30, height: 10 });
  });

  it('names a shape, and reads the shapes it offers', () => {
    expect(ratioLabel(1024, 576)).toBe('16:9');
    expect(ratioLabel(2400, 1029)).toBe('21:9');
    expect(ratioLabel(960, 640)).toBe('3:2');
    expect(ratioLabel(1000, 480)).toBe('2.08:1');
    expect(ratioLabel(480, 1000)).toBe('1:2.08');
    expect(ratioOfShape('free', B)).toBeUndefined();
    close(ratioOfShape('original', B)!, 1024 / 576);
    close(ratioOfShape('21/9', B)!, 21 / 9);
  });

  it("says what a use does with a picture: its size and shape, a crop or a frame when the shape differs, and when it's too small", () => {
    const lead = { ratio: '21/9', fit: 'crop' as const, width: 2400 };
    const thumb = { ratio: '3/2', fit: 'whole' as const, width: 960 };
    expect(pictureNote(lead, 1024, 576)).toBe("This one is 1024 × 576 px (16:9). The page crops it to 21:9 around its focus point: crop it yourself to choose what shows. It's smaller than 2400 px wide, so it may look soft.");
    expect(pictureNote(lead, 2400, 1029)).toBe('This one is 2400 × 1029 px (21:9).');
    expect(pictureNote(thumb, 1024, 576)).toBe('This one is 1024 × 576 px (16:9). Cards show it whole, with space above and below: crop it to 3:2 to fill them.');
    expect(pictureNote(thumb, 800, 1000)).toContain('with space either side');
    expect(pictureNote(thumb, 1200, 800)).toBe('This one is 1200 × 800 px (3:2).');
  });
});
