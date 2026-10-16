import { describe, expect, it } from 'vitest';
import { MIN_SCALE, NOISE_CELLS, patternCells, perlin, seeded } from '../../src/site/editor/model/iconPattern';
import { ICON_DATA } from '../../src/site/design/iconData';

/** The icon watermark beside a screen's content (EditorLayout, components/IconPattern.astro). */
describe('the icon watermark', () => {
  const ICONS = Object.keys(ICON_DATA).length;

  it('is the same every time for a seed, and different for another', () => {
    const a = patternCells({ width: 900, height: 700, cell: 36, icons: ICONS });
    expect(patternCells({ width: 900, height: 700, cell: 36, icons: ICONS })).toEqual(a);
    expect(patternCells({ width: 900, height: 700, cell: 36, icons: ICONS, seed: 99 })).not.toEqual(a);
    expect(seeded(1)()).toBe(seeded(1)());
  });

  it('fills the field with one cell per grid square, centred, and a larger field only adds cells', () => {
    const cells = patternCells({ width: 360, height: 180, cell: 36, icons: ICONS });
    expect(cells.length).toBe(10 * 5);
    expect(cells[0]).toMatchObject({ x: 18, y: 18 });
    const bigger = patternCells({ width: 720, height: 360, cell: 36, icons: ICONS });
    // the cells the small field had are where they were, with the same icon and size
    const at = new Map(bigger.map((c) => [`${c.x},${c.y}`, c]));
    for (const c of cells) expect(at.get(`${c.x},${c.y}`)).toEqual(c);
    expect(patternCells({ width: 0, height: 100, cell: 36, icons: ICONS })).toEqual([]);
  });

  it('uses every icon edit mode has, in sizes from a dot to the largest', () => {
    const cells = patternCells({ width: 1920, height: 1200, cell: 36, icons: ICONS });
    expect(new Set(cells.map((c) => c.icon)).size).toBe(ICONS);
    const scales = cells.map((c) => c.scale);
    expect(Math.min(...scales)).toBeGreaterThanOrEqual(MIN_SCALE);
    expect(Math.max(...scales)).toBeLessThanOrEqual(1);
    // most are small, some are large: the clouds and the dots between them
    expect(scales.filter((s) => s < 0.35).length / scales.length).toBeGreaterThan(0.35);
    expect(scales.filter((s) => s > 0.7).length).toBeGreaterThan(0);
  });

  it('changes size slowly across the field (low-frequency noise), while the icons next to each other differ', () => {
    const cells = patternCells({ width: 1440, height: 900, cell: 36, icons: ICONS });
    const cols = 1440 / 36;
    let step = 0;
    let same = 0;
    for (let i = 1; i < cells.length; i++) {
      if (i % cols === 0) continue;
      step = Math.max(step, Math.abs(cells[i].scale - cells[i - 1].scale));
      if (cells[i].icon === cells[i - 1].icon) same++;
    }
    expect(step).toBeLessThan(0.25);
    expect(same / cells.length).toBeLessThan(0.05);
    expect(NOISE_CELLS).toBeGreaterThanOrEqual(6);
  });

  it("Perlin noise is 0 on the lattice, bounded, and continuous", () => {
    const n = perlin(3);
    expect(n(4, 7)).toBe(0);
    let max = 0;
    for (let x = 0; x < 20; x += 0.13) for (let y = 0; y < 20; y += 0.17) max = Math.max(max, Math.abs(n(x, y)));
    expect(max).toBeLessThanOrEqual(1.01);
    expect(Math.abs(n(2.5, 3.5) - n(2.501, 3.5))).toBeLessThan(0.01);
  });
});
