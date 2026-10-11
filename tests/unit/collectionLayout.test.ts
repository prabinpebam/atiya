/** The collection's decisions (src/site/scripts/collection.ts) and the strips' room to peek into (media.ts `bleed`). */
import { describe, expect, it } from 'vitest';
import { collectionView, defaultColumns, itemBody, stripState, stripStep, type CollectionLayout } from '../../src/site/scripts/collection';
import { bleed } from '../../src/site/scripts/media';

describe('collection: the layout from its props', () => {
  it('columns, when left out: one for one, three for three, six or more than four, otherwise two', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(defaultColumns)).toEqual([1, 2, 3, 2, 3, 3, 3, 3, 3]);
    expect(defaultColumns(0)).toBe(3);
    expect(collectionView({ count: 2, layout: 'tiles', columns: 4 }).columns).toBe(4);
    expect(collectionView({ count: 5, layout: 'tiles' }).columns).toBe(3);
  });

  it('strips are the carousel and the sideways timeline; timelines are both timelines', () => {
    const of = (layout: CollectionLayout) => collectionView({ count: 3, layout });
    expect((['rows', 'columns', 'tiles', 'masonry', 'carousel', 'timeline', 'timeline-scroll'] as const).map((l) => [of(l).strip, of(l).timeline])).toEqual([
      [false, false],
      [false, false],
      [false, false],
      [false, false],
      [true, false],
      [false, true],
      [true, true],
    ]);
  });

  it('prominent only for tiles', () => {
    expect(collectionView({ count: 3, layout: 'tiles', prominent: true }).prominent).toBe(true);
    expect(collectionView({ count: 3, layout: 'tiles' }).prominent).toBe(false);
    expect(collectionView({ count: 3, layout: 'masonry', prominent: true }).prominent).toBe(false);
  });

  it("a strip's name: as given, else Carousel or Timeline", () => {
    expect(collectionView({ count: 3, layout: 'carousel' }).label).toBe('Carousel');
    expect(collectionView({ count: 3, layout: 'timeline-scroll' }).label).toBe('Timeline');
    expect(collectionView({ count: 3, layout: 'carousel', label: 'Projects' }).label).toBe('Projects');
  });

  it('pictures fill a frame shape and fit their own, unless the display is given', () => {
    expect(collectionView({ count: 1, layout: 'tiles' }).shown).toBe('fit');
    expect(collectionView({ count: 1, layout: 'tiles', ratio: '4/3' }).shown).toBe('fill');
    expect(collectionView({ count: 1, layout: 'tiles', ratio: '4/3', display: 'tile' }).shown).toBe('tile');
  });

  it('only a strip spans the viewport (the rest show full as wide); a peek is a strip that is not full', () => {
    expect(collectionView({ count: 3, layout: 'tiles', width: 'full' }).width).toBe('wide');
    expect(collectionView({ count: 3, layout: 'carousel', width: 'full' }).width).toBe('full');
    expect(collectionView({ count: 3, layout: 'rows' }).width).toBe('content');
    expect(collectionView({ count: 3, layout: 'carousel', peek: true }).peek).toBe(true);
    expect(collectionView({ count: 3, layout: 'carousel', peek: true, width: 'full' }).peek).toBe(false);
    expect(collectionView({ count: 3, layout: 'tiles', peek: true }).peek).toBe(false);
  });

  it("the pictures' sizes: each layout's own width, tiles and masonry their place shared by the columns", () => {
    expect(collectionView({ count: 3, layout: 'rows' }).pictureSizes).toBe('(max-width: 40rem) 92vw, 11rem');
    expect(collectionView({ count: 3, layout: 'columns' }).pictureSizes).toBe('(max-width: 40rem) 92vw, 20rem');
    expect(collectionView({ count: 3, layout: 'carousel' }).pictureSizes).toBe('18rem');
    expect(collectionView({ count: 3, layout: 'timeline' }).pictureSizes).toBe('(max-width: 40rem) 80vw, 20rem');
    expect(collectionView({ count: 3, layout: 'timeline-scroll' }).pictureSizes).toBe('17rem');
    expect(collectionView({ count: 3, layout: 'tiles' }).pictureSizes).toBe('(max-width: 40rem) 92vw, 14rem');
    expect(collectionView({ count: 4, layout: 'masonry', width: 'wide' }).pictureSizes).toBe('(max-width: 40rem) 92vw, 38rem');
    expect(collectionView({ count: 1, layout: 'tiles', width: 'popout' }).pictureSizes).toBe('(max-width: 40rem) 92vw, 52rem');
    expect(collectionView({ count: 2, layout: 'tiles', width: 'full' }).pictureSizes).toBe('(max-width: 40rem) 92vw, 38rem');
  });
});

describe("collection: an item's words", () => {
  it('Markdown blocks stay as they are; inline HTML becomes a paragraph each; nothing is nothing', () => {
    expect(itemBody(undefined)).toBe('');
    expect(itemBody('')).toBe('');
    expect(itemBody([])).toBe('');
    expect(itemBody('Led <b>design</b>')).toBe('<p>Led <b>design</b></p>');
    expect(itemBody(['One', 'Two'])).toBe('<p>One</p><p>Two</p>');
    expect(itemBody('<p>Done</p>')).toBe('<p>Done</p>');
    expect(itemBody('  <ul><li>a</li></ul>')).toBe('  <ul><li>a</li></ul>');
    expect(itemBody('<ol class="x"><li>a</li></ol>')).toBe('<ol class="x"><li>a</li></ol>');
    expect(itemBody('<pre>code</pre>')).toBe('<p><pre>code</pre></p>');
  });
});

describe('collection: a strip', () => {
  it('scrolls only with more than a pixel to go; its ends within a pixel', () => {
    expect(stripState(0, 500, 500)).toEqual({ scrolls: false, atStart: true, atEnd: true });
    expect(stripState(0, 501, 500)).toEqual({ scrolls: false, atStart: true, atEnd: true });
    expect(stripState(0, 900, 500)).toEqual({ scrolls: true, atStart: true, atEnd: false });
    expect(stripState(200, 900, 500)).toEqual({ scrolls: true, atStart: false, atEnd: false });
    expect(stripState(399.5, 900, 500)).toEqual({ scrolls: true, atStart: false, atEnd: true });
  });

  it('right to left: scrollLeft runs negative, and the ends are the same', () => {
    expect(stripState(-200, 900, 500)).toEqual({ scrolls: true, atStart: false, atEnd: false });
    expect(stripState(-400, 900, 500)).toEqual({ scrolls: true, atStart: false, atEnd: true });
  });

  it('Previous and Next scroll by a view, the other way right to left', () => {
    expect(stripStep(1, 640, false)).toBe(640);
    expect(stripStep(-1, 640, false)).toBe(-640);
    expect(stripStep(1, 640, true)).toBe(-640);
    expect(stripStep(-1, 640, true)).toBe(640);
  });
});

describe("a strip's room to peek into (bleed)", () => {
  const strip = { left: 300, right: 940 };
  it('the room each side, up to its bounds, and no more than the reach', () => {
    expect(bleed(strip, { left: 100, right: 1200 }, 1400, 1000, false)).toEqual({ start: 200, end: 260 });
    expect(bleed(strip, { left: 100, right: 1200 }, 1400, 150, false)).toEqual({ start: 150, end: 150 });
  });

  it('bounds are clipped to the viewport', () => {
    expect(bleed(strip, { left: -500, right: 3000 }, 1000, 1000, false)).toEqual({ start: 300, end: 60 });
  });

  it('never negative, and none on a phone', () => {
    expect(bleed({ left: 50, right: 990 }, { left: 100, right: 900 }, 1000, 500, false)).toEqual({ start: 0, end: 0 });
    expect(bleed(strip, { left: 0, right: 1400 }, 1400, 1000, true)).toEqual({ start: 0, end: 0 });
  });
});
