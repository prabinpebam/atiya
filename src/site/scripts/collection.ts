/**
 * The collection's decisions (tier 0; docs: documentation/site-ui/design-system.md §2): what its props
 * come to (the columns, whether it's a strip or a timeline, its width and peek, the pictures' sizes), an
 * item's words as blocks, and a strip's ends and steps. Pure and unit-tested; Collection.astro renders with
 * them, and `collectionStrip.ts` does a strip's DOM.
 */
import { sizes } from '../design/responsive';
import type { PictureSource } from '../design/pictures';

/** A collection item's picture (Collection.astro's items). */
export interface CollectionPicture {
  /** The displayed image. */
  src: string;
  /** Responsive sources for it. */
  srcset?: string;
  /** What the picture shows. */
  alt: string;
  /** Its own width (px). */
  width: number;
  /** Its own height (px). */
  height: number;
  /** Which part stays in a crop ("50% 30%"). */
  focus?: string;
  /** Its own edge colour (media.md §9.1), for a background behind it. */
  bg?: string;
  /** Its dark mode version, shown when the page is dark. */
  dark?: PictureSource;
}

/** A collection item: when it was, a heading, a picture, a subtext and a few words, each optional (Collection.astro's items). */
export interface CollectionItem {
  /** When it was, in words ("2016", "July 2019 to now"): by its mark in a timeline, over its heading otherwise. */
  when?: string;
  /** Its heading: a label or a title, as the collection says. */
  heading?: string;
  /** Its picture. */
  picture?: CollectionPicture;
  /** An SVG drawn in the picture's place, its colours the site's roles (the Illustration fundamental): an item has one or the other. */
  illustration?: string;
  /** A short line under the heading. */
  subtext?: string;
  /** Its words as HTML the content layer rendered from Markdown (paragraphs and lists, bold, italic, strikethrough, code, links), set as compact prose; a line of inline HTML, or several (each a paragraph), works too. */
  html?: string | string[];
}

export type CollectionLayout = 'rows' | 'columns' | 'tiles' | 'masonry' | 'carousel' | 'timeline' | 'timeline-scroll' | 'stats';
export type CollectionWidth = 'content' | 'popout' | 'wide' | 'full';

/** Items to a row for tiles, figures and masonry, when the collection doesn't say: one for one, three for three, six or more than four, otherwise two. */
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
  timelineStyle?: 'inset' | 'margin';
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
  /** A timeline in the margin style: its words the whole column, its times and marks hung before it (its width is the column's). */
  hang: boolean;
  /** A strip's accessible name. */
  label: string;
  width: CollectionWidth;
  peek: boolean;
  /** The pictures' sizes, for the browser's pick. */
  pictureSizes: string;
}

export interface MasonryItemBox {
  /** The item's inline position: items at the same position are in one visual column. */
  inlineStart: number;
  /** The item's visible bottom, relative to the masonry track. */
  blockEnd: number;
  /** The item's content-driven height. */
  blockSize: number;
}

/**
 * Each shorter masonry column shares its shortfall evenly between its items, so every column's
 * visible bottom meets the longest one's. One column needs no adjustment.
 */
export function masonryItemSizes(boxes: MasonryItemBox[]): number[] {
  const columns = new Map<number, { end: number; count: number }>();
  const columnAt = (box: MasonryItemBox) => Math.round(box.inlineStart);
  for (const box of boxes) {
    const key = columnAt(box);
    const column = columns.get(key);
    if (column) {
      column.end = Math.max(column.end, box.blockEnd);
      column.count += 1;
    } else columns.set(key, { end: box.blockEnd, count: 1 });
  }
  if (columns.size < 2) return boxes.map((box) => box.blockSize);
  const end = Math.max(...[...columns.values()].map((column) => column.end));
  return boxes.map((box) => {
    const column = columns.get(columnAt(box))!;
    return box.blockSize + Math.max(0, end - column.end) / column.count;
  });
}

/** What a collection's props come to. */
export function collectionView(o: CollectionOptions): CollectionView {
  const columns = o.columns ?? defaultColumns(o.count);
  const strip = o.layout === 'carousel' || o.layout === 'timeline-scroll';
  // only a strip spans the viewport (a grid of cards or a list of rows that wide reads badly); a peek needs room beside it
  const hang = o.layout === 'timeline' && o.timelineStyle === 'margin';
  const width = hang ? 'content' : o.width === 'full' && !strip ? 'wide' : (o.width ?? 'content');
  const place = width === 'content' ? 'measure' : width === 'full' ? 'wide' : width;
  const across = o.layout === 'tiles' || o.layout === 'masonry' || o.layout === 'stats' ? columns : 1;
  return {
    columns,
    prominent: (o.layout === 'tiles' || o.layout === 'stats') && !!o.prominent,
    shown: o.display ?? (o.ratio ? 'fill' : 'fit'),
    strip,
    timeline: o.layout === 'timeline' || o.layout === 'timeline-scroll',
    hang,
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
