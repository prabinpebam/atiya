/**
 * The album editor's inspector (documentation/gallery/spec.md §9.6): which items it describes, named in the address
 * (`?selected=`, so a reload keeps them and the server draws their details), and what several of them share: their
 * kinds, a caption, description, alt text, date or place they all have (or that they differ), and this album's
 * downloads for them. Pure.
 */
import type { Album, AlbumItem } from '../../content/schema';
import { albumCounts, countWords, isTextItem, type MediaLookup } from '../../content/album';
import type { ViewerItem } from './albumViewer';
import type { Thumb } from './inspectorFields';

/** The address's parameter naming the selection. */
export const SELECTED_PARAM = 'selected';
/** At most this many are named in the address: the inspector describes a bigger selection by its first ones. */
export const SELECTED_MAX = 200;

/** The ids an address names that `known` knows, each once, in the address's order (at most SELECTED_MAX). */
export function pickSelected(param: string | null | undefined, known: (id: string) => boolean): string[] {
  if (!param) return [];
  const seen = new Set<string>();
  for (const raw of param.split(',')) {
    const id = raw.trim();
    if (id && known(id)) seen.add(id);
    if (seen.size >= SELECTED_MAX) break;
  }
  return [...seen];
}

/** The items an address names that are in the album, each once, in the address's order. */
export function parseSelected(param: string | null | undefined, album: Pick<Album, 'items'>): string[] {
  const ids = new Set(album.items.map((i) => i.id));
  return pickSelected(param, (id) => ids.has(id));
}

/** The parameter's value for a selection ('' for none: the parameter is left out). */
export const selectedParam = (ids: readonly string[]): string => ids.slice(0, SELECTED_MAX).join(',');

/** A value several items have: none of them has one, they all have the same one, or they differ. */
export type Shared = { state: 'none' } | { state: 'same'; value: string } | { state: 'mixed' };

/** What several values share: an empty one counts as having none, so one set among unset ones is mixed. */
export function shared(values: readonly (string | undefined)[]): Shared {
  const set = values.map((v) => v?.trim() ?? '');
  if (!set.some(Boolean)) return { state: 'none' };
  return set.every((v) => v === set[0]) ? { state: 'same', value: set[0] } : { state: 'mixed' };
}

/** A library item's five words, as its sidecar has them (a video's or linked video's kind: it has no alt text of its own). */
export interface ItemWords {
  kind?: string;
  caption?: string;
  description?: string;
  alt?: string;
  taken?: string;
  place?: string;
}

/** What several library items share of their five words (gallery spec §9.8.2 U5). */
export interface SharedWordsView {
  caption: Shared;
  description: Shared;
  alt: Shared;
  taken: Shared;
  place: Shared;
}

/** What several items share of their words; a video's or linked video's missing alt text doesn't count (it has none to have). */
export function sharedWords(media: readonly string[], wordsOf: (id: string) => ItemWords | undefined): SharedWordsView {
  const of = (k: keyof ItemWords, list = media) => shared(list.map((m) => wordsOf(m)?.[k]));
  const NO_ALT = new Set(['video', 'embed']);
  return {
    caption: of('caption'),
    description: of('description'),
    alt: of(
      'alt',
      media.filter((m) => !NO_ALT.has(wordsOf(m)?.kind ?? '')),
    ),
    taken: of('taken'),
    place: of('place'),
  };
}

/** The words each shared field stands for, in a question. */
const WHAT: Record<string, string> = { caption: 'captions', description: 'descriptions', alt: 'alt text', taken: 'dates', place: 'places' };

/**
 * What a value typed into a shared field does (§9.8.2 U6, U8): nothing (left empty over values that differ: each
 * keeps its own), asks first (it would replace their different values, or give several pictures one alt text), or
 * is set on all of them.
 */
export function sharedChange(name: string, value: string, state: Shared['state'], count: number): { act: 'skip' } | { act: 'ask'; question: string } | { act: 'set' } {
  if (!value && state !== 'same') return { act: 'skip' };
  if (value && name === 'alt' && count > 1) return { act: 'ask', question: `One alt text for ${count} pictures: a screen reader hears the same words for each. Set it on all ${count}?` };
  if (value && state === 'mixed') return { act: 'ask', question: `They have different ${WHAT[name] ?? name}. Set this one on all ${count}?` };
  return { act: 'set' };
}

/** This album's downloads for an item: following the album, or its own Allow or Don't allow. */
export type DownloadChoice = 'follow' | 'allow' | 'deny';
const downloadOf = (item: AlbumItem): DownloadChoice => (isTextItem(item) || item.download === undefined ? 'follow' : item.download ? 'allow' : 'deny');

/** What a selection of several items is. */
export interface SelectionSummary {
  /** How many are selected. */
  count: number;
  /** What they are, in words: "3 pictures, 1 video, 2 text cards". */
  words: string;
  /** Their library items, in the selection's order (a text card has none). */
  media: string[];
  /** Downloads for those that can be downloaded (not a text card or a linked video): the same for all, or mixed; null when none can. */
  download: DownloadChoice | 'mixed' | null;
}

/** Sums up the selected items of an album (those it no longer has are left out). */
export function selectionSummary(album: Pick<Album, 'items'>, ids: readonly string[], lookup: MediaLookup): SelectionSummary {
  const items = ids.map((id) => album.items.find((i) => i.id === id)).filter((i): i is AlbumItem => !!i);
  const text = items.filter(isTextItem).length;
  const cards = text ? `${text} text card${text === 1 ? '' : 's'}` : '';
  const words = [countWords(albumCounts(items, lookup)), cards].filter(Boolean).join(', ');
  const media = items.flatMap((i) => (isTextItem(i) ? [] : [i.media]));
  const downloadable = items.filter((i) => !isTextItem(i) && lookup(i.media) && lookup(i.media)?.kind !== 'embed');
  const choices = new Set(downloadable.map(downloadOf));
  const download = !choices.size ? null : choices.size === 1 ? [...choices][0] : 'mixed';
  return { count: items.length, words: words || `${items.length} item${items.length === 1 ? '' : 's'}`, media, download };
}

/** What several library items are, in words: "3 pictures, 1 video". */
export function libraryWords(media: readonly string[], lookup: MediaLookup): string {
  const words = countWords(albumCounts(media.map((m) => ({ id: m, media: m }) as AlbumItem), lookup));
  return words || `${media.length} item${media.length === 1 ? '' : 's'}`;
}

/** At most this many of a selection's thumbnails are shown; the rest are counted. */
export const SELECTION_THUMBS = 8;

/** What the inspector's Selection tab draws: nothing selected, one item (as the viewer has it), or several. */
export type SelectionView =
  | { state: 'none' }
  | { state: 'one'; item: ViewerItem; thumb?: Thumb }
  | ({ state: 'many'; summary: SelectionSummary; thumbs: Thumb[]; albumDownload: boolean } & SharedWordsView);

/** What the Media screen's side panel draws for several picked in the library (§9.8.2 U5, U6). */
export interface LibrarySelection {
  /** How many are picked. */
  count: number;
  /** What they are, in words: "3 pictures, 1 video". */
  words: string;
  /** Their ids, in the order picked. */
  media: string[];
  /** The first SELECTION_THUMBS of them. */
  thumbs: Thumb[];
  /** What they share of their words. */
  shared: SharedWordsView;
}