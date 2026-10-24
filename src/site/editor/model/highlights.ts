/**
 * Home highlights' editor rules: trusted source choices, stable slide IDs and immutable list operations.
 * The content contract owns eligibility and validation; the editor never copies source titles or pictures.
 */
import { defaultHighlights, highlightCandidates, highlightSource, highlightState, HIGHLIGHT_MAX, type Highlights, type HighlightItem } from '../../content/highlights';
import type { ContentIndex } from '../../content/load';

export { HIGHLIGHT_MAX };
export type { Highlights, HighlightItem };

/** Both the layout's whole-screen live update and this form's own region must render its content. */
export const HIGHLIGHT_REGIONS = ['screen', 'highlights'] as const;

/** A public resource offered by the text-only source picker. */
export interface HighlightChoice {
  /** The source's unique key, not its slide ID. */
  key: string;
  /** The source's current title, with its kind. */
  title: string;
  /** Why the saved pick would wait rather than render. */
  reason?: string;
  /** The typed reference, before the editor assigns its stable slide ID. */
  item: HighlightItem;
}

/** One saved pick's current title and eligibility, as the list shows it. */
export interface HighlightDetail {
  /** Its current source title, after its kind ("Page: A walk"). */
  title: string;
  /** Its current source title alone, as the list row names it. */
  name: string;
  /** Why it waits, if it cannot render now. */
  reason?: string;
}

/** The same source can appear only once, independently of its slide ID (the content's rule). */
export { highlightSource };

/** Adds a trusted picker choice without changing any existing slide IDs or mutating the list. */
export function addHighlight(items: HighlightItem[], choice: HighlightItem, id: string): HighlightItem[] {
  if (items.length >= HIGHLIGHT_MAX || items.some((i) => i.id === id || highlightSource(i) === highlightSource(choice))) return items;
  return [...items, { ...choice, id }];
}

/** Moves one pick by one place; an end or unknown ID leaves the list unchanged. */
export function moveHighlight(items: HighlightItem[], id: string, direction: -1 | 1): HighlightItem[] {
  const at = items.findIndex((i) => i.id === id);
  const to = at + direction;
  if (at < 0 || to < 0 || to >= items.length) return items;
  const next = [...items];
  [next[at], next[to]] = [next[to], next[at]];
  return next;
}

/** Removes a pick, never its source resource. */
export const removeHighlight = (items: HighlightItem[], id: string): HighlightItem[] => items.filter((i) => i.id !== id);

/** A page's optional excerpt stays verbatim, including its whitespace. Empty means use the summary. */
export function excerptHighlight(items: HighlightItem[], id: string, text: string): HighlightItem[] {
  return items.map((i) => {
    if (i.id !== id || i.type !== 'article') return i;
    const { text: _, ...source } = i;
    return text ? { ...source, text } : source;
  });
}

/** Public choices only; no pictures are decoded or fetched to draw this screen. */
export function highlightsView(index: ContentIndex): { highlights: Highlights; choices: HighlightChoice[]; details: Record<string, HighlightDetail> } {
  const effective = defaultHighlights(index);
  const highlights: Highlights = {
    ...effective, peek: effective.peek ?? false, arrows: effective.arrows ?? true, pager: effective.pager ?? 'dots',
    display: effective.display ?? 'fill', background: effective.background ?? false, rounded: effective.rounded ?? true, shadow: effective.shadow ?? false,
  };
  const items: HighlightItem[] = [{ id: 'choice-github', type: 'custom', custom: 'github' }];
  for (const c of highlightCandidates(index)) {
    const id = `choice-${items.length}`;
    items.push(c.type === 'article' ? { id, type: 'article', article: c.ref } : c.type === 'album' ? { id, type: 'album', album: c.ref } : { id, type: 'image', media: c.ref });
  }
  const choices = items.map((item) => {
    const state = highlightState(index, item);
    return { key: highlightSource(item), title: `${SLIDE_KIND[item.type].label}: ${state.title}`, reason: state.reason, item };
  });
  const details = Object.fromEntries(highlights.items.map((item) => {
    const state = highlightState(index, item);
    return [item.id, { title: `${SLIDE_KIND[item.type].label}: ${state.title}`, name: state.title, reason: state.reason }];
  }));
  return { highlights, choices, details };
}

/** What the details column shows (documentation/editor/list-and-details.md): a slide, `new` or the carousel's `settings`. */
export type SlideChoice = string;

/** The asked slide if it's saved, else `new` or `settings` as asked, else the first slide, else Add slide. */
export function chosenSlide(items: readonly { id: string }[], asked: string | null): SlideChoice {
  if (asked === 'new' || asked === 'settings') return asked;
  return items.find((i) => i.id === asked)?.id ?? items[0]?.id ?? 'new';
}

/** Each kind's word and list mark, for the list, the details and the picker alike (custom slides are charts: GitHub's is the one so far). */
export const SLIDE_KIND: Record<HighlightItem['type'], { label: string; icon: 'code' | 'article' | 'gallery' | 'image' }> = {
  custom: { label: 'Chart', icon: 'code' },
  article: { label: 'Page', icon: 'article' },
  album: { label: 'Album', icon: 'gallery' },
  image: { label: 'Picture', icon: 'image' },
};

/** A slide's list mark: GitHub's own for its chart. */
export const slideIcon = (item: HighlightItem): 'github' | (typeof SLIDE_KIND)[HighlightItem['type']]['icon'] =>
  item.type === 'custom' && item.custom === 'github' ? 'github' : SLIDE_KIND[item.type].icon;

/** A slide's line under its name: its kind, and whether it shows or why it waits. */
export const slideLine = (item: HighlightItem, detail?: { reason?: string }): string =>
  `${SLIDE_KIND[item.type].label} · ${detail?.reason ? `Waiting: ${detail.reason}` : 'Ready to show'}`;

const PAGER: Record<NonNullable<Highlights['pager']>, string> = { dots: 'dots', filmstrip: 'filmstrip', 'filmstrip-wrap': 'wrapping filmstrip' };

/** The carousel settings row's line: shown or hidden, its slide count and its pager. */
export function settingsLine(h: Highlights): string {
  const n = h.items.length;
  return `${h.enabled ? 'Shown' : 'Hidden'} · ${n} ${n === 1 ? 'slide' : 'slides'} · ${PAGER[h.pager ?? 'dots']}`;
}

/** The sources Add slide still offers: one place per source. */
export const freeChoices = (choices: readonly HighlightChoice[], items: readonly HighlightItem[]): HighlightChoice[] =>
  choices.filter((c) => !items.some((i) => highlightSource(i) === c.key));
