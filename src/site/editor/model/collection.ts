/**
 * A collection's choices as edit mode offers them (documentation/editor/spec.md §3.4): its layouts and
 * how its headings read, each with a line on what it does. The contract's lists (schema.ts) say which
 * there are; these say them in words, in the same order.
 */
import type { COLLECTION_HEADINGS, CollectionLayout } from '../../content/schema';

export const LAYOUT_CHOICES: { value: CollectionLayout; label: string; description: string }[] = [
  { value: 'rows', label: 'Rows', description: 'One under another, a picture beside its words' },
  { value: 'columns', label: 'Columns', description: 'Side by side in a row, wrapping when they don’t fit' },
  { value: 'tiles', label: 'Tiles', description: 'An even grid of cards' },
  { value: 'masonry', label: 'Masonry', description: 'Cards in columns, each as tall as it is' },
  { value: 'carousel', label: 'Carousel', description: 'Cards in a strip that scrolls sideways' },
];

export const HEADING_CHOICES: { value: (typeof COLLECTION_HEADINGS)[number]; label: string; description: string }[] = [
  { value: 'label', label: 'Labels', description: 'Small capitals over the words' },
  { value: 'title', label: 'Titles', description: 'Set larger, as a title' },
];

/** The layouts that take a number of columns. */
export const TAKES_COLUMNS: ReadonlySet<CollectionLayout> = new Set(['tiles', 'masonry']);
