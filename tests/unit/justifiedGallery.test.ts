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

describe('a portrait spanning two rows', () => {
  const W = 925;
  const H = 224;
  const G = 12;
  const portrait = { width: 1067, height: 1600 };
  const landscape = { width: 1600, height: 1067 };
  const tallOf = (layout: ReturnType<typeof justifyGallery>) => layout.boxes.filter((box) => box.rows === 2);

  it('takes two rows and a gap, beside two rows that meet both of its edges exactly', () => {
    const items = [portrait, landscape, landscape, landscape, landscape];
    const layout = justifyGallery(items, W, H, G, { span: true });
    const [tall] = tallOf(layout);
    expect(tall).toMatchObject({ index: 0, left: 0, top: 0, row: 0, height: 2 * H + G });
    for (const row of [0, 1]) {
      const beside = layout.boxes.filter((box) => box.rows === 1 && box.row === row);
      expect(beside.length).toBeGreaterThan(0);
      expect(beside[0]!.left).toBe(tall!.width + G);
      expect(beside.at(-1)!.left + beside.at(-1)!.width).toBe(W);
      expect(new Set(beside.map((box) => box.height))).toEqual(new Set([H]));
      expect(beside[0]!.top).toBe(row * (H + G));
    }
    expect(layout.boxes.map((box) => box.index)).toEqual(items.map((_, index) => index));
    expect(layout.height).toBe(layout.rows * H + (layout.rows - 1) * G);
  });

  it('puts a tall picture that ends its band on the right, its rows before it in reading order', () => {
    const layout = justifyGallery([landscape, landscape, landscape, landscape, portrait], W, H, G, { span: true });
    const [tall] = tallOf(layout);
    expect(tall).toMatchObject({ index: 4, top: 0 });
    expect(tall!.left + tall!.width).toBe(W);
    expect(layout.boxes.map((box) => box.index)).toEqual([0, 1, 2, 3, 4]);
  });

  it('never puts two bands back to back, and alternates their sides', () => {
    const items = Array.from({ length: 20 }, (_, index) => (index % 5 === 0 ? portrait : landscape));
    const layout = justifyGallery(items, W, H, G, { span: true });
    const talls = tallOf(layout);
    expect(talls.length).toBeGreaterThan(1);
    for (let n = 1; n < talls.length; n++) {
      expect(talls[n]!.row - talls[n - 1]!.row).toBeGreaterThanOrEqual(3);
      expect(talls[n]!.left === 0).not.toBe(talls[n - 1]!.left === 0);
    }
  });

  it('stays in a row where it would be too wide or leave too little room: a near-square, or a phone', () => {
    expect(tallOf(justifyGallery([{ width: 900, height: 1000 }, landscape, landscape, landscape, landscape], W, H, G, { span: true }))).toEqual([]);
    expect(tallOf(justifyGallery([portrait, landscape, landscape, landscape, landscape], 254, 160, G, { span: true }))).toEqual([]);
  });

  it('never spans when the gallery turns it off', () => {
    expect(tallOf(justifyGallery([portrait, landscape, landscape, landscape, landscape], W, H, G))).toEqual([]);
  });
});
