import { describe, expect, it } from 'vitest';
import { justifyGallery } from '../../src/site/scripts/justifiedGallery';

describe('justified gallery', () => {
  it('fills every complete row exactly, including its gaps', () => {
    const layout = justifyGallery(
      [
        { width: 1600, height: 900 },
        { width: 900, height: 1200 },
        { width: 1200, height: 900 },
        { width: 1600, height: 900 },
      ],
      900,
      220,
      12,
    );
    for (let row = 0; row < layout.rows - 1; row++) {
      const boxes = layout.boxes.filter((box) => box.row === row);
      expect(boxes.at(-1)!.left + boxes.at(-1)!.width).toBe(900);
      expect(new Set(boxes.map((box) => box.height))).toEqual(new Set([220]));
    }
  });

  it('keeps a final widow at natural width instead of stretching it', () => {
    const layout = justifyGallery(
      [
        { width: 800, height: 600 },
        { width: 800, height: 600 },
        { width: 400, height: 600 },
      ],
      700,
      180,
      10,
    );
    const last = layout.boxes.at(-1)!;
    expect(last.width).toBe(120);
    expect(last.crop).toBe(0);
  });

  it('gives an extreme panorama its own full row and reports the unavoidable crop', () => {
    const [panorama] = justifyGallery([{ width: 6000, height: 500 }], 800, 200, 12).boxes;
    expect(panorama).toMatchObject({ left: 0, width: 800, height: 200, row: 0 });
    expect(panorama!.crop).toBeGreaterThan(0.6);
  });

  it('is deterministic and preserves source order across responsive widths', () => {
    const items = Array.from({ length: 17 }, (_, index) => ({ width: 500 + index * 137, height: 400 + (index % 4) * 151 }));
    for (const width of [320, 640, 1200]) {
      const rowHeight = width < 640 ? 160 : 224;
      const first = justifyGallery(items, width, rowHeight, 12);
      expect(justifyGallery(items, width, rowHeight, 12)).toEqual(first);
      expect(first.boxes.map((box) => box.index)).toEqual(items.map((_, index) => index));
      expect(first.height).toBe(first.rows * rowHeight + (first.rows - 1) * 12);
    }
  });

  it('returns no geometry for unusable measurements', () => {
    expect(justifyGallery([{ width: 1, height: 1 }], 0, 200, 12)).toEqual({ boxes: [], height: 0, rows: 0 });
  });
});
