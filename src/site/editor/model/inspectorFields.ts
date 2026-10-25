/**
 * What the inspector's forms offer (documentation/editor/spec.md §3.5): the choices its fields list, how its
 * fields are named and what its fixed lines say. Pure, shared by the inspector's parts (the block forms, a
 * set's and a collection's fields, the page's settings) so each draws the same choices and IDs.
 */
import type { Article, Block } from '../../content/schema';
import { shareUrl } from '../../content/providers';

/** A picture a form shows, by media ID: its thumbnail and its words. */
export interface Thumb {
  thumb: string;
  alt: string;
  width: number;
  height: number;
  /** A video file's (its thumbnail is its poster). */
  video?: boolean;
}

/** A choice in one of the inspector's Selects (the Select fundamental's option). */
export interface Choice {
  value: string;
  label: string;
  description?: string;
}

/** A field's ID: the block's place (or "page") and the field's name, so two forms never share one. */
export const fieldId = (i: number | string, f: string): string => `f-${i}-${f.replace(/\W+/g, '-')}`;

/** A length in seconds as minutes and seconds (140 → "2:20"); nothing for none. */
export const duration = (s?: number): string => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '');

/** An embedded video's address, as the person would paste it. */
export const videoUrl = (b: Extract<Block, { type: 'video' }>): string => (!b.embed ? '' : shareUrl(b.embed.provider, b.embed.id));

/** The kinds of page a new page or a page's settings offer (a talk is its own, and keeps its kind). */
export const PAGE_KINDS: Choice[] = [
  { value: 'note', label: 'Article', description: 'A story, a note or an essay' },
  { value: 'page', label: 'Page', description: 'About, Contact and the like' },
];

/** A quote's styles, as a new quote's form and a quote's settings offer them. */
export const QUOTE_STYLES: Choice[] = [
  { value: 'pull', label: 'Pulled out', description: 'A line lifted out and set large' },
  { value: 'block', label: 'In the column', description: 'A quotation in the text' },
];

export const WIDTHS: Choice[] = [
  { value: 'content', label: 'In the column', description: 'As wide as the text' },
  { value: 'popout', label: 'Stepping out', description: 'A little wider than the text' },
  { value: 'wide', label: 'Wide', description: 'Across the page' },
  { value: 'full', label: 'Full bleed', description: 'Edge to edge' },
];

/** How a picture is shown in its frame (documentation/content/media.md §9.1). */
export const DISPLAYS: Choice[] = [
  { value: 'fill', label: 'Fill', description: 'Fills the frame, cropped around its focus point' },
  { value: 'fit', label: 'Fit', description: 'Whole, with room round it' },
  { value: 'actual', label: 'Actual size', description: 'Its own size, centred; never enlarged' },
  { value: 'tile', label: 'Tile', description: 'Repeated at its own size' },
];

export const SHAPES: Choice[] = [
  { value: '', label: 'Its own shape', description: 'As the picture is' },
  { value: '1/1', label: 'Square', description: '1:1' },
  { value: '4/3', label: 'Classic', description: '4:3' },
  { value: '3/2', label: 'Photo', description: '3:2' },
  { value: '16/9', label: 'Screen', description: '16:9' },
  { value: '21/9', label: 'Wide', description: '21:9' },
];

/** Who can see a page (documentation/access/spec.md §8.2). */
export const ACCESS: Choice[] = [
  { value: 'open', label: 'Everyone', description: 'Public, in its section' },
  { value: 'private', label: 'Private', description: 'Only for readers you share it with' },
];

/** What the Section field says, by who can see the page. */
export const SECTION_HINT = {
  open: 'Where it sits on the site, and so its address. Moved, its old address simply goes.',
  private: 'The section it’s listed in for the readers you share it with. Its address is a code, so moving it doesn’t change it.',
} as const;

/** The statuses a page can take, with the one it has kept even when it isn't offered (due for review, archived). */
export function statusChoices(status: Article['status']): Choice[] {
  return [
    { value: 'draft', label: 'Draft', description: 'Not on the site' },
    { value: 'factReview', label: 'Fact review', description: 'Not on the site' },
    { value: 'editorialReview', label: 'Editorial review', description: 'Not on the site' },
    { value: 'approved', label: 'Approved', description: 'Ready: not on the site until published' },
    { value: 'published', label: 'Published', description: 'On the site once you save to remote' },
    ...(status === 'stale' ? [{ value: 'stale', label: 'Due for review', description: 'On the site' }] : []),
    ...(status === 'archived' ? [{ value: 'archived', label: 'Archived', description: 'Not on the site' }] : []),
  ];
}

/** Where a page is on the planet: never when private, else in the building that shows its section (documentation/sections/spec.md §5.2). */
export function onPlanet(privatePage: boolean, place: string, published: boolean): string {
  if (privatePage) return 'Not on the planet: private pages never are, as it has no way to sign in.';
  if (place) return `In the ${place}, which shows its section${published ? '' : ', once it’s published'}.`;
  return 'Not on the planet: no building shows its section.';
}

/**
 * A page's topics after one is ticked or cleared (documentation/sections/spec.md §3.8): the ones it had keep their
 * order (the first three are the tags shown), a new one goes last, and none is nothing (the field is left out).
 */
export function pickTopic(current: readonly string[] | undefined, id: string, on: boolean): string[] | undefined {
  const kept = (current ?? []).filter((t) => t !== id);
  const next = on ? [...kept, id] : kept;
  return next.length ? next : undefined;
}

/** The Topics row's detail in the page's settings: the first two topics' names, then how many more; else None. */
export function topicsDetail(topics: readonly string[] | undefined, choices: readonly Choice[]): string {
  const names = (topics ?? []).map((t) => choices.find((c) => c.value === t)?.label ?? t);
  if (!names.length) return 'None';
  return names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
}
