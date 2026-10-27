/**
 * The album editor's inspector (documentation/gallery/spec.md §9.6): which items it describes, named in the address
 * (`?selected=`, so a reload keeps them and the server draws their details), and what several of them share: their
 * kinds, a date or a place they all have (or that they differ), and this album's downloads for them. Pure.
 */
import type { Album, AlbumItem } from '../../content/schema';
import { albumCounts, countWords, isTextItem, type MediaLookup } from '../../content/album';
import type { ViewerItem } from './albumViewer';
import type { Thumb } from './inspectorFields';

/** The address's parameter naming the selection. */
export const SELECTED_PARAM = 'selected';
/** At most this many are named in the address: the inspector describes a bigger selection by its first ones. */
export const SELECTED_MAX = 200;

/** The items an address names that are in the album, each once, in the address's order. */
export function parseSelected(param: string | null | undefined, album: Pick<Album, 'items'>): string[] {
  if (!param) return [];
  const ids = new Set(album.items.map((i) => i.id));
  const seen = new Set<string>();
  for (const raw of param.split(',')) {
    const id = raw.trim();
    if (id && ids.has(id)) seen.add(id);
    if (seen.size >= SELECTED_MAX) break;
  }
  return [...seen];
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

/** At most this many of a selection's thumbnails are shown; the rest are counted. */
export const SELECTION_THUMBS = 8;

/** What the inspector's Selection tab draws: nothing selected, one item (as the viewer has it), or several. */
export type SelectionView =
  | { state: 'none' }
  | { state: 'one'; item: ViewerItem; thumb?: Thumb }
  | { state: 'many'; summary: SelectionSummary; thumbs: Thumb[]; taken: Shared; place: Shared; albumDownload: boolean };