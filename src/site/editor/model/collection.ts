/**
 * A collection's choices as edit mode offers them (documentation/editor/spec.md §3.4): its layouts and
 * how its headings read, each with a line on what it does. The contract's lists (schema.ts) say which
 * there are; these say them in words, in the same order.
 */
import type { Block, COLLECTION_HEADINGS, CollectionLayout } from '../../content/schema';
import { plainText } from '../../content/markdown';

export const LAYOUT_CHOICES: { value: CollectionLayout; label: string; description: string }[] = [
  { value: 'rows', label: 'Rows', description: 'One under another, a picture beside its words' },
  { value: 'columns', label: 'Columns', description: 'Side by side in a row, wrapping when they don’t fit' },
  { value: 'tiles', label: 'Tiles', description: 'An even grid of cards' },
  { value: 'masonry', label: 'Masonry', description: 'Cards in columns, each as tall as it is' },
  { value: 'carousel', label: 'Carousel', description: 'Cards in a strip that scrolls sideways' },
  { value: 'timeline', label: 'Timeline', description: 'Down a line, each item by its time' },
  { value: 'timeline-scroll', label: 'Timeline, sideways', description: 'Along a line that scrolls sideways' },
];

export const HEADING_CHOICES: { value: (typeof COLLECTION_HEADINGS)[number]; label: string; description: string }[] = [
  { value: 'label', label: 'Labels', description: 'Small capitals over the words' },
  { value: 'title', label: 'Titles', description: 'Set larger, as a title' },
];

/** The layouts that take a number of columns. */
export const TAKES_COLUMNS: ReadonlySet<CollectionLayout> = new Set(['tiles', 'masonry']);

/** The layouts in a strip that scrolls sideways: a named region, so they take a label. */
export const TAKES_LABEL: ReadonlySet<CollectionLayout> = new Set(['carousel', 'timeline-scroll']);

/** The layouts that set each item by its time (its `when`). */
export const TIMELINES: ReadonlySet<CollectionLayout> = new Set(['timeline', 'timeline-scroll']);

/** The width a new collection starts at in a layout: the strips and card grids a little wider than the column. */
export const startWidth = (layout: CollectionLayout): 'popout' | undefined => (TAKES_COLUMNS.has(layout) || TAKES_LABEL.has(layout) ? 'popout' : undefined);

type Item = Extract<Block, { type: 'collection' }>['items'][number];

/** An item's name in the inspector's list of sections: its heading, or else its subtext, its time, its words or its picture's alt text. */
export const itemName = (it: Item, alt?: string): string => it.heading ?? it.subtext ?? it.when ?? (it.text ? plainText(it.text) : it.media ? alt || 'A picture' : '');