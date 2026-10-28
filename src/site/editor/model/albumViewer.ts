/**
 * The album editor's viewer and its words (documentation/gallery/spec.md §9.5, §9.8): where an item sits among
 * the ones shown (every item, or in a review only the pictures that need alt text), and a library item's words
 * from the info panel's fields into its sidecar, checked as the content check will. Pure: the server draws from
 * the first, and scripts/mediaInfo.ts saves through the second.
 */
import { CAPTION_MAX, ITEM_DESCRIPTION_MAX, ITEM_DESCRIPTION_PARAGRAPHS, PLACE_MAX } from '../../content/schema';
import { paragraphsOf, plainText } from '../../content/markdown';
import type { EmbedMedia, ImageMedia, VideoMedia } from '../../content/schema';
import type { ItemKind } from '../../content/album';
import type { Picture, VideoFile } from '../../content/pictures';

/** Where the viewer is: the item's place ("3 of 12") and its neighbours (null at an end). */
export interface ViewerStep {
  at: number;
  of: number;
  prev: string | null;
  next: string | null;
}

/** An item's place among `ids` (the order shown), or null when it isn't among them. */
export function viewerStep(ids: readonly string[], id: string): ViewerStep | null {
  const i = ids.indexOf(id);
  if (i < 0) return null;
  return { at: i + 1, of: ids.length, prev: ids[i - 1] ?? null, next: ids[i + 1] ?? null };
}

/**
 * The items a review of alt text goes through (§9.5): those that need it, in the order shown, with the one open
 * kept in its place (so Previous and Next still work from it once it has its words).
 */
export const reviewIds = (cells: readonly { id: string; needsAlt?: boolean }[], open: string): string[] => cells.filter((c) => c.needsAlt || c.id === open).map((c) => c.id);

/** Where a review goes after the item `id` has its alt text: the next that still needs it, else the first before it, else null (the review is over). */
export function nextToReview(cells: readonly { id: string; needsAlt?: boolean }[], id: string): string | null {
  const at = cells.findIndex((c) => c.id === id);
  const after = cells.slice(at + 1).find((c) => c.needsAlt && c.id !== id);
  return after?.id ?? cells.slice(0, Math.max(0, at)).find((c) => c.needsAlt)?.id ?? null;
}

/** A place the item is used besides this album: its editor's address. */
export interface ViewerUse {
  title: string;
  href: string;
  kind: 'album' | 'page';
  draft: boolean;
}

/** One item as the viewer shows it. */
export interface ViewerItem {
  id: string;
  kind: ItemKind | 'missing';
  step: ViewerStep;
  /** The stage: what's drawn large. */
  picture?: Picture;
  video?: VideoFile;
  embed?: { poster: Picture; provider: string; title: string; duration?: number; shape: string };
  /** A text card's words. */
  text?: string;
  /** The library item and its sidecar as it is on disk (null for a text card or a missing item). */
  media?: { id: string; key: string; version: string; sidecar: ImageMedia | VideoMedia | EmbedMedia };
  /** This album's settings for it (V49), and the album's own downloads. */
  download?: boolean;
  autoplay?: boolean;
  loop?: boolean;
  albumDownload: boolean;
  uses: ViewerUse[];
  /** The file's facts, in words. */
  facts: string[];
  /** It's a picture without alt text (and not decorative). */
  needsAlt: boolean;
  /** A picture kept large (the panel offers Make it standard). */
  large: boolean;
  /** In a review: the pictures still needing alt text (thumbnails), the current one among them. */
  strip?: { id: string; media: string; thumb: string; alt: string; width: number; height: number; current: boolean }[];
}

/** What kind of library item the words belong to: its fields differ (§9.5). */
export type WordsKind = 'image' | 'video' | 'embed';

/** The info panel's fields as typed (every one a string; a checkbox a boolean). */
export interface Words {
  caption: string;
  description: string;
  alt: string;
  decorative: boolean;
  taken: string;
  place: string;
  /** A video file's or a linked video's title. */
  title: string;
  credit: string;
  licenceName: string;
  licenceUrl: string;
}

const START = /^(image|picture|photo) of\b/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** What's wrong with the words, as the content check would say it but in the editor's voice, or null. */
export function wordsProblem(kind: WordsKind, w: Words): string | null {
  const alt = w.alt.trim();
  if (alt.length > 250) return `The alt text is ${alt.length} characters: keep it to 250.`;
  if (START.test(alt)) return 'Start the alt text with what it shows, not “image of”.';
  if (w.caption.trim().length > CAPTION_MAX) return `The caption is ${w.caption.trim().length} characters: keep it to ${CAPTION_MAX}.`;
  const place = w.place.trim();
  if (place.length > PLACE_MAX) return `The place is ${place.length} characters: keep it to ${PLACE_MAX}.`;
  if (/[\r\n]/.test(place)) return 'The place is one line.';
  if (w.taken && !DAY.test(w.taken)) return 'Choose the day it was taken, or clear it.';
  const d = w.description.trim();
  if (d && paragraphsOf(d).length > ITEM_DESCRIPTION_PARAGRAPHS) return `The description is ${paragraphsOf(d).length} paragraphs: keep it to ${ITEM_DESCRIPTION_PARAGRAPHS}.`;
  if (d && plainText(d).length > ITEM_DESCRIPTION_MAX) return `The description is ${plainText(d).length} characters: keep it to ${ITEM_DESCRIPTION_MAX}.`;
  if (kind !== 'image' && !w.title.trim()) return 'Give it a title: it names the video.';
  if (w.licenceUrl.trim() && !w.licenceName.trim()) return 'Name the licence, or leave its address empty.';
  return null;
}

/**
 * The sidecar with the panel's words (§3.4): a copy of what's on disk, so its other fields and the order of its
 * keys stay; an empty word takes its field out. Only a picture can be marked decorative; a linked video and a
 * video file have a title instead.
 */
export function withWords<T extends Record<string, unknown>>(sidecar: T, kind: WordsKind, w: Words): T {
  const next: Record<string, unknown> = { ...sidecar };
  // a video's save keeps a word it isn't sent (server/media.ts saveSidecar), so a cleared one is sent empty
  const put = (k: string, v: string) => {
    if (v) next[k] = v;
    else if (kind === 'video' && (k === 'description' || k === 'place' || k === 'taken')) next[k] = '';
    else delete next[k];
  };
  put('caption', w.caption.trim());
  put('description', w.description.trim());
  put('place', w.place.trim());
  put('taken', w.taken.trim());
  put('credit', w.credit.trim());
  if (kind !== 'video') put('alt', w.alt.trim());
  if (kind === 'image') {
    if (w.decorative) next.decorative = true;
    else delete next.decorative;
  } else next.title = w.title.trim();
  const licence = { ...((sidecar.licence as Record<string, unknown> | undefined) ?? {}), name: w.licenceName.trim() };
  if (w.licenceUrl.trim()) Object.assign(licence, { url: w.licenceUrl.trim() });
  else delete (licence as Record<string, unknown>).url;
  if (licence.name) next.licence = licence;
  else delete next.licence;
  return next as T;
}

/**
 * A batch change to several items' words (§9.3 Set the date, Set the place; §9.5 Accept all; §9.8.2 Save these words):
 * the fields it sets, `''` to clear.
 */
export interface WordsChange {
  id: string;
  words: { taken?: string; place?: string; alt?: string; caption?: string; description?: string };
}

/** Why a batch change is refused, or null (the same rules as one item's). */
export function batchProblem(changes: readonly WordsChange[]): string | null {
  if (!changes.length) return 'Choose what to change.';
  for (const c of changes) {
    const { taken, place, alt, caption, description } = c.words;
    if (taken !== undefined && taken !== '' && !DAY.test(taken)) return 'Choose a day, or clear the date.';
    if (place !== undefined && (place.trim().length > PLACE_MAX || /[\r\n]/.test(place))) return `A place is one line of at most ${PLACE_MAX} characters.`;
    if (alt !== undefined && (alt.trim().length > 250 || START.test(alt.trim()))) return 'Alt text is at most 250 characters and never starts with “image of”.';
    if (caption !== undefined && caption.trim().length > CAPTION_MAX) return `A caption is at most ${CAPTION_MAX} characters.`;
    const d = description?.trim() ?? '';
    if (d && paragraphsOf(d).length > ITEM_DESCRIPTION_PARAGRAPHS) return `A description is at most ${ITEM_DESCRIPTION_PARAGRAPHS} paragraphs.`;
    if (d && plainText(d).length > ITEM_DESCRIPTION_MAX) return `A description is at most ${ITEM_DESCRIPTION_MAX} characters.`;
  }
  return null;
}

/** One sidecar with a batch change applied; `''` takes the field out. Alt text goes only on a picture or a linked video. */
export function withBatch<T extends Record<string, unknown>>(sidecar: T, words: WordsChange['words']): T {
  const next: Record<string, unknown> = { ...sidecar };
  for (const k of ['taken', 'place', 'alt', 'caption', 'description'] as const) {
    const v = words[k];
    if (v === undefined || (k === 'alt' && sidecar.kind === 'video')) continue;
    if (v.trim()) next[k] = v.trim();
    else delete next[k];
  }
  if (words.alt?.trim() && sidecar.kind === 'image') delete next.decorative;
  return next as T;
}

/** The file's size in words ("2.4 MB", "640 KB"). */
export function sizeWords(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
