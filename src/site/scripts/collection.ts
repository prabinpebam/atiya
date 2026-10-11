/**
 * The collection's decisions (tier 0; docs: documentation/site-ui/design-system.md §2): what its props
 * come to (the columns, whether it's a strip or a timeline, its width and peek, the pictures' sizes), an
 * item's words as blocks, and a strip's ends and steps. Pure and unit-tested; Collection.astro renders with
 * them, and `collectionStrip.ts` does a strip's DOM.
 */
import { sizes } from '../design/responsive';

export type CollectionLayout = 'rows' | 'columns' | 'tiles' | 'masonry' | 'carousel' | 'timeline' | 'timeline-scroll';
export type CollectionWidth = 'content' | 'popout' | 'wide' | 'full';

/** Items to a row for tiles and masonry, when the collection doesn't say: one for one, three for three, six or more than four, otherwise two. */
export function defaultColumns(count: number): 1 | 2 | 3 {
  return count === 1 ? 1 : count % 3 === 0 || count > 4 ? 3 : 2;
}

// how wide a picture shows in each layout, for the browser's pick (tiles and masonry share their place's width)
const SIZES: Partial<Record<CollectionLayout, string>> = {
  rows: sizes(['sm', '92vw'], 'collection-row-picture'),
  columns: sizes(['sm', '92vw'], { share: 'measure', of: 2 }),
  carousel: sizes('collection-slide'),
  timeline: sizes(['sm', '80vw'], 'collection-timeline-picture'),
  'timeline-scroll': sizes('collection-timeline-slide'),
};

export interface CollectionOptions {
  count: number;
  layout: CollectionLayout;
  columns?: 1 | 2 | 3 | 4;
  prominent?: boolean;
  label?: string;
  width?: CollectionWidth;
  peek?: boolean;
  ratio?: string;
  display?: 'fill' | 'fit' | 'actual' | 'tile';
}

export interface CollectionView {
  columns: 1 | 2 | 3 | 4;
  prominent: boolean;
  /** How each picture is shown: as asked, else fill in a frame shape and fit in its own. */
  shown: 'fill' | 'fit' | 'actual' | 'tile';
  /** Scrolls sideways, with Previous and Next (the carousel, the sideways timeline). */
  strip: boolean;
  /** Sets each item by its time on a line. */
  timeline: boolean;
  /** A strip's accessible name. */
  label: string;
  width: CollectionWidth;
  peek: boolean;
  /** The pictures' sizes, for the browser's pick. */
  pictureSizes: string;
}

/** What a collection's props come to. */
export function collectionView(o: CollectionOptions): CollectionView {
  const columns = o.columns ?? defaultColumns(o.count);
  const strip = o.layout === 'carousel' || o.layout === 'timeline-scroll';
  // only a strip spans the viewport (a grid of cards or a list of rows that wide reads badly); a peek needs room beside it
  const width = o.width === 'full' && !strip ? 'wide' : (o.width ?? 'content');
  const place = width === 'content' ? 'measure' : width === 'full' ? 'wide' : width;
  const across = o.layout === 'tiles' || o.layout === 'masonry' ? columns : 1;
  return {
    columns,
    prominent: o.layout === 'tiles' && !!o.prominent,
    shown: o.display ?? (o.ratio ? 'fill' : 'fit'),
    strip,
    timeline: o.layout === 'timeline' || o.layout === 'timeline-scroll',
    label: o.label ?? (o.layout === 'carousel' ? 'Carousel' : 'Timeline'),
    width,
    peek: strip && !!o.peek && width !== 'full',
    pictureSizes: SIZES[o.layout] ?? sizes(['sm', '92vw'], { share: place, of: across }),
  };
}

/** An item's words as blocks: Markdown's HTML (paragraphs, lists) as it is, a line of inline HTML in a paragraph each. */
export function itemBody(html: string | string[] | undefined): string {
  const block = (h: string) => (/^\s*<(p|ul|ol)[\s>]/.test(h) ? h : `<p>${h}</p>`);
  return (Array.isArray(html) ? html : html ? [html] : []).map(block).join('');
}

/**
 * Where a strip is: whether it scrolls at all (more than a pixel to go), and whether it's at its start or
 * its end (within a pixel). `scrollLeft` may be negative (right to left).
 */
export function stripState(scrollLeft: number, scrollWidth: number, clientWidth: number): { scrolls: boolean; atStart: boolean; atEnd: boolean } {
  const at = Math.abs(scrollLeft);
  const end = scrollWidth - clientWidth;
  return { scrolls: end > 1, atStart: at <= 1, atEnd: at >= end - 1 };
}

/** How far Previous (-1) or Next (+1) scrolls a strip: a view, the other way in a right-to-left page. */
export function stripStep(direction: -1 | 1, view: number, rtl: boolean): number {
  return direction * view * (rtl ? -1 : 1);
}
