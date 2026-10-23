/**
 * Home highlights' editor rules: trusted source choices, stable slide IDs and immutable list operations.
 * The content contract owns eligibility and validation; the editor never copies source titles or pictures.
 */
import { defaultHighlights, highlightCandidates, highlightState, HIGHLIGHT_MAX, type Highlights, type HighlightItem } from '../../content/highlights';
import type { ContentIndex } from '../../content/load';

export { HIGHLIGHT_MAX };
export type { Highlights, HighlightItem };

/** Both the layout's whole-screen live update and this form's own region must render its content. */
export const HIGHLIGHT_REGIONS = ['screen', 'highlights'] as const;

/** Tracks the saved revision without letting a failed/older save or a cross-tab refresh discard input. */
export class HighlightEdits {
  private revision = 0;
  private savedRevision = 0;
  /** A request still holds the screen's version and snapshot. */
  saving = false;
  /** Something typed or reordered here has not been saved. */
  get dirty(): boolean { return this.revision !== this.savedRevision; }
  /** External redraws must keep both unsaved input and a save in flight. */
  get keep(): boolean { return this.dirty || this.saving; }
  /** A local input or list change starts another revision. */
  change(): void { this.revision++; }
  /** Captures the exact revision sent, while newer changes can still be made. */
  begin(): number { this.saving = true; return this.revision; }
  /** Only the sent revision was saved; later typing remains dirty. */
  saved(revision: number): void { this.savedRevision = revision; }
  /** A refusal, conflict or network error keeps this screen editable and protected from redraws. */
  failed(): void { if (!this.dirty) this.change(); }
  /** Ends the request without changing whether input is saved. */
  end(): void { this.saving = false; }
}

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
  /** Its current source title. */
  title: string;
  /** Why it waits, if it cannot render now. */
  reason?: string;
}

/** The same source can appear only once, independently of its slide ID. */
export function highlightSource(item: HighlightItem): string {
  if (item.type === 'custom') return `custom:${item.custom}`;
  if (item.type === 'article') return `article:${item.article}`;
  if (item.type === 'album') return `album:${item.album}`;
  return `image:${item.media}`;
}

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
  const kind = { custom: 'Custom', article: 'Page', album: 'Album', image: 'Image' };
  const choices = items.map((item) => {
    const state = highlightState(index, item);
    return { key: highlightSource(item), title: `${kind[item.type]}: ${state.title}`, reason: state.reason, item };
  });
  const details = Object.fromEntries(highlights.items.map((item) => {
    const state = highlightState(index, item);
    return [item.id, { title: `${kind[item.type]}: ${state.title}`, reason: state.reason }];
  }));
  return { highlights, choices, details };
}
