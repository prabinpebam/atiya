/**
 * How a picture is shown (documentation/content/media.md §9.1): the content model's display modes, its
 * background and rounding on every picture use (figures, galleries, carousels, the lead picture, the
 * thumbnail on cards), with today's look as every default; and the automatic background colour, taken
 * from the picture's own edges.
 */
import { describe, expect, it } from 'vitest';
import { article, block, PICTURE_DISPLAYS } from '../../src/site/content/schema';
import { edgeAverage } from '../../src/site/content/edgeColour';

const base = { id: 'x', type: 'article', kind: 'note', slug: 'x', title: 'X', summary: 'X.', status: 'draft', visibility: 'public', updatedAt: '2026-10-06', locale: 'en', body: [] };

describe('the content model: how a picture is shown', () => {
  it('every picture use takes a display, a background and rounding', () => {
    for (const display of PICTURE_DISPLAYS) {
      expect(block.safeParse({ type: 'figure', media: 'shared/a', display, ratio: '16/9', background: true, rounded: false }).success, display).toBe(true);
      expect(block.safeParse({ type: 'gallery', items: [{ media: 'shared/a' }, { media: 'shared/b' }], display, background: true, rounded: false }).success).toBe(true);
      expect(block.safeParse({ type: 'carousel', label: 'L', items: [{ media: 'shared/a' }, { media: 'shared/b' }], display, background: true, rounded: false }).success).toBe(true);
      expect(article.safeParse({ ...base, hero: { media: 'shared/a', display, background: true, rounded: false }, thumbnailStyle: { display, background: true, rounded: false } }).success).toBe(true);
    }
  });

  it('refuses what it doesn\u2019t know: a display, a shape, a style field', () => {
    expect(block.safeParse({ type: 'figure', media: 'shared/a', display: 'stretch' }).success).toBe(false);
    expect(block.safeParse({ type: 'figure', media: 'shared/a', ratio: '5/4' }).success).toBe(false);
    expect(article.safeParse({ ...base, thumbnailStyle: { colour: 'red' } }).success).toBe(false);
  });

  it('today\u2019s look is every default: nothing new is written for a picture left as it was', () => {
    const f = block.parse({ type: 'figure', media: 'shared/a' });
    expect(f).not.toHaveProperty('display');
    expect(f).not.toHaveProperty('background');
    expect(f).not.toHaveProperty('rounded');
  });
});

describe('the automatic background: the colour of a picture\u2019s edges', () => {
  /** A square of pixels: the edges one colour, the middle another. */
  const square = (n: number, edge: number[], middle: number[]) => {
    const px: number[] = [];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) px.push(...(x === 0 || y === 0 || x === n - 1 || y === n - 1 ? edge : middle));
    return px;
  };

  it('averages the opaque edge pixels and ignores the middle', () => {
    expect(edgeAverage(square(8, [250, 240, 230, 255], [0, 0, 0, 255]), 8)).toBe('rgb(250 240 230)');
  });

  it('weights each edge pixel by its opacity', () => {
    const px = square(4, [200, 0, 0, 255], [0, 0, 0, 255]);
    // one edge pixel half transparent and blue: it counts half
    px.splice(0, 4, 0, 0, 200, 128);
    const c = edgeAverage(px, 4)!;
    const [r, , b] = c.match(/\d+/g)!.map(Number);
    expect(r).toBeGreaterThan(180);
    expect(b).toBeGreaterThan(0);
    expect(b).toBeLessThan(20);
  });

  it('says nothing for transparent edges (the dominant colour is used instead)', () => {
    expect(edgeAverage(square(8, [255, 255, 255, 0], [10, 20, 30, 255]), 8)).toBeNull();
  });
});
