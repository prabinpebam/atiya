/**
 * Suggested words (documentation/gallery/spec.md §9.8.2, ai-services.md S13): the AI writer's drafts of a picture's
 * caption, description, alt text and place, in one question about the picture, for a field the owner asks beside
 * or for several pictures at once. The rules are alt text's and captions' (model/altText.ts, model/captionText.ts):
 * the picture alone, never its file's name or a page's words, and never who a person is. A place comes from where
 * the camera recorded it was taken (rounded to about a kilometre, kept only on this computer) or, without that,
 * only from what's written in the picture or a landmark nobody could mistake. A date is never asked of the writer:
 * it's the file's own. Pure: the server's route and the media screens' scripts read them from here. Nothing is saved
 * until the owner saves it.
 */
import { ITEM_DESCRIPTION_MAX, PLACE_MAX } from '../../content/schema';
import { ALT_MAX, tidyAnswer, type PictureMessage } from './altText';
import { CAPTION_SUGGEST_MAX, captionMissLine, type CaptionWhy } from './captionText';
import type { PictureLocation } from './exif';

/** The words the writer can suggest, in the order they're asked and shown. */
export const WORD_KINDS = ['caption', 'description', 'alt', 'place'] as const;
export type WordKind = (typeof WORD_KINDS)[number];

/** A suggested description's longest: a few sentences, well inside the description's own limit. */
export const DESCRIPTION_SUGGEST_MAX = Math.min(400, ITEM_DESCRIPTION_MAX);

const MAX: Record<WordKind, number> = { caption: CAPTION_SUGGEST_MAX, description: DESCRIPTION_SUGGEST_MAX, alt: ALT_MAX, place: PLACE_MAX };

/** How each kind is named in a sentence. */
export const WORD_NOUNS: Record<WordKind, { the: string; a: string; no: string; many: string; label: string }> = {
  caption: { the: 'The caption', a: 'a caption', no: 'No caption', many: 'captions', label: 'Caption' },
  description: { the: 'The description', a: 'a description', no: 'No description', many: 'descriptions', label: 'Description' },
  alt: { the: 'The alt text', a: 'alt text', no: 'No alt text', many: 'alt text', label: 'Alt text' },
  place: { the: 'The place', a: 'a place', no: 'No place', many: 'places', label: 'Place' },
};

/** The kinds asked for, known and in their order (anything else is left out). */
export const wantedKinds = (want: readonly unknown[]): WordKind[] => WORD_KINDS.filter((k) => want.includes(k));

/** The answer's shape: one string for each kind asked (a place may be empty). */
export function wordsSchema(want: readonly WordKind[]): Record<string, unknown> {
  return { type: 'object', properties: Object.fromEntries(want.map((k) => [k, { type: 'string' }])), required: [...want], additionalProperties: false };
}

/** Coordinates as they're sent: rounded to two places (about a kilometre), never the exact spot. */
export const roughly = (l: PictureLocation): PictureLocation => ({ lat: Math.round(l.lat * 100) / 100, lon: Math.round(l.lon * 100) / 100 });

/** What's asked: each wanted kind's rules (the people rules for all), and JSON with exactly those keys. */
export function wordsSystem(want: readonly WordKind[], located: boolean): string {
  const rules: string[] = ['You write the words for a picture in a photo album on a personal website.'];
  if (want.includes('caption')) rules.push(`"caption": the short line a reader sees under it, at most ${CAPTION_SUGGEST_MAX} characters, one plain sentence or a phrase in sentence case: what is happening or notable, never hashtags, emoji or quotation marks.`);
  if (want.includes('description')) rules.push(`"description": two to four plain sentences about what it shows and what is interesting in it, at most ${DESCRIPTION_SUGGEST_MAX} characters, one paragraph, no lists or headings.`);
  if (want.includes('alt')) rules.push(`"alt": alt text, a description of what is visible for someone who cannot see it, at most ${ALT_MAX} characters, one or two plain sentences; if the picture has text that matters, read it out.`);
  if (want.includes('place'))
    rules.push(
      located
        ? `"place": where it was taken, from the coordinates given: the town or city and the region or country, like "Kyoto, Japan", at most ${PLACE_MAX} characters; never a street, a house number or anything closer than a neighbourhood.`
        : `"place": where it was taken, at most ${PLACE_MAX} characters, the town or city and the country, only if it is written in the picture or it is a famous landmark nobody could mistake; otherwise an empty string. Never guess.`,
    );
  rules.push(
    'Never start with "image of", "picture of" or "photo of": start with what it shows.',
    'Never say who a person is, never name anyone, and never guess their age, ethnicity, gender identity, religion, health or anything else about them that cannot be seen.',
    'Never invent a date, an event or a name: use one only when it is written in the picture itself.',
    `Answer with JSON only, with exactly these keys: ${want.map((k) => `"${k}"`).join(', ')}.`,
  );
  return rules.join(' ');
}

/**
 * The request's messages: the rules, then the picture, and (for a place) the rough coordinates as text. No file
 * name, no other metadata and no page's words go with it.
 * @param picture the picture as it's sent (alt text's width), as a data URL
 */
export function wordsMessages(picture: string, want: readonly WordKind[], location?: PictureLocation | null): PictureMessage[] {
  const at = want.includes('place') && location ? roughly(location) : null;
  const parts: Exclude<PictureMessage['content'], string> = [{ type: 'image_url', image_url: { url: picture } }];
  if (at) parts.push({ type: 'text', text: `The camera recorded that it was taken near latitude ${at.lat}, longitude ${at.lon}.` });
  return [
    { role: 'system', content: wordsSystem(want, !!at) },
    { role: 'user', content: parts },
  ];
}

/** Why a kind came back without a suggestion. */
export type WordMiss = 'empty' | 'identifies' | 'unplaced';

const STREET = /\b(?:street|road|rd\.|lane|avenue|ave\.|boulevard|blvd|drive|marg|flat|apartment|apt\.?|house no\.?|no\.)(?:\s|,|$)|\d/i;
const NO_PLACE = /^(?:unknown|none|n\/a|not (?:known|visible|clear|sure)|unclear|nowhere|-)\.?$/i;

/** A suggested place's rules: one line, no street or number, no "unknown"; trailing full stop off. */
export function cleanPlace(answer: string): { text: string; why?: undefined } | { text: null; why: WordMiss } {
  const w = tidyAnswer(answer, 'place', 200);
  if (w.text === null) return { text: null, why: w.why === 'empty' ? 'unplaced' : w.why };
  const text = w.text.replace(/[.\s]+$/, '');
  if (!text || NO_PLACE.test(text) || STREET.test(text) || text.length > PLACE_MAX) return { text: null, why: 'unplaced' };
  return { text };
}

/** What became of an answer: each kind's suggestion that meets its rules, and why each other kind asked has none. */
export interface WordsAnswer {
  words: Partial<Record<WordKind, string>>;
  missed: Partial<Record<WordKind, WordMiss>>;
}

/** The rules every suggested word meets before it's shown (tidied, no "image of", no one identified, within its length). */
export function cleanWords(answer: string, want: readonly WordKind[]): WordsAnswer {
  const out: WordsAnswer = { words: {}, missed: {} };
  for (const k of want) {
    const w = k === 'place' ? cleanPlace(answer) : tidyAnswer(answer, k, MAX[k]);
    if (w.text !== null) out.words[k] = w.text;
    else out.missed[k] = w.why;
  }
  return out;
}

/** Why a kind wasn't suggested (the server's answer, per kind or for the whole question). */
export type WordWhy = CaptionWhy | WordMiss;

/** What the status line says when a kind the owner asked for didn't come: what happened and what to do. */
export function wordMissLine(kind: WordKind, why: WordWhy | string | undefined): string {
  if (kind === 'caption') return captionMissLine(why === 'empty' || why === 'identifies' || why === 'unplaced' ? 'refused' : why);
  const n = WORD_NOUNS[kind];
  switch (why) {
    case 'unplaced':
      return "The picture doesn't show where it was taken. Write the place yourself.";
    case 'empty':
    case 'identifies':
    case 'refused':
      return `${n.no} came back that meets the rules. Try again, or write it yourself.`;
    case 'timeout':
      return `${n.the} took too long to come. Try again, or write it yourself.`;
    case 'unreadable':
      return `This picture couldn't be read to suggest ${n.a}. Write it yourself.`;
    case 'no-writer':
      return `No AI writer is chosen. Choose one on the AI screen to suggest ${n.many}.`;
    case 'blind':
      return "The AI writer's model can't see pictures. Choose one that can on the AI screen.";
    case 'private':
      return `The AI writer isn't allowed to see private pages' pictures. Write ${n.the.toLowerCase()} yourself.`;
    default:
      return "The AI writer didn't answer. Check it on the AI screen, then try again.";
  }
}

// ---------- several pictures at once ----------

/** A picture's words as the batch reads them (its sidecar's). */
export interface PictureWordsNow {
  kind: string;
  caption?: string;
  description?: string;
  alt?: string;
  decorative?: boolean;
  place?: string;
  taken?: string;
}

/** The kinds a batch can fill: the writer's four, and the date from the file. */
export type BatchKind = WordKind | 'taken';
export const BATCH_KINDS: readonly BatchKind[] = [...WORD_KINDS, 'taken'];

/**
 * What a batch asks for one picture: only the kinds chosen that it doesn't have yet (never alt text for a decorative
 * picture). Only a still picture is described by the writer; a video or a linked video gets only its date.
 */
export function missingWords(now: PictureWordsNow, chosen: readonly BatchKind[]): BatchKind[] {
  return chosen.filter((k) => {
    if (k !== 'taken' && now.kind !== 'image') return false;
    if (k === 'alt' && now.decorative) return false;
    return !String(now[k] ?? '').trim();
  });
}

/** How many of the pictures lack each kind (what the batch's choices say beside them), from each one's `missingWords`. */
export function batchNeeds(lacks: readonly (readonly BatchKind[])[]): Record<BatchKind, number> {
  const n = Object.fromEntries(BATCH_KINDS.map((k) => [k, 0])) as Record<BatchKind, number>;
  for (const l of lacks) for (const k of l) n[k]++;
  return n;
}

/** The items a batch asks about: those lacking one of the kinds chosen, in their order. */
export function batchAsked(lacks: Readonly<Record<string, readonly BatchKind[]>>, media: readonly string[], chosen: readonly BatchKind[]): string[] {
  return media.filter((m) => (lacks[m] ?? []).some((k) => chosen.includes(k)));
}

/** A batch choice's label, and what it says about how many lack it. */
export const BATCH_LABELS: Record<BatchKind, string> = { caption: 'Caption', description: 'Description', alt: 'Alt text', place: 'Place', taken: 'Date taken (from the file)' };

/** What a batch choice says beside it: how many of the items lack it. */
export function needsLine(lack: number, of: number): string {
  if (!lack) return of === 1 ? 'It has one' : 'All have one';
  return of === 1 ? 'It needs one' : `${lack} of ${of} need one`;
}

/** One picture's drafts as the owner leaves them in the review: the words kept (an emptied one is left out). */
export interface BatchDraft {
  media: string;
  words: Partial<Record<BatchKind, string>>;
}

/** The reviewed drafts as one save of the pictures' own words (albumViewer's `WordsChange`): trimmed, empties left out. */
export function batchChanges(drafts: readonly BatchDraft[]): { id: string; words: Partial<Record<BatchKind, string>> }[] {
  return drafts.flatMap((d) => {
    const words = Object.fromEntries(BATCH_KINDS.flatMap((k) => (d.words[k]?.trim() ? [[k, d.words[k]!.trim()]] : []))) as Partial<Record<BatchKind, string>>;
    return Object.keys(words).length ? [{ id: d.media, words }] : [];
  });
}

/** The status line while a batch runs: "Suggested 3 of 12". */
export const batchProgress = (done: number, of: number): string => `Suggested ${done} of ${of}`;

/** The batch's main button: how many pictures it will ask about. */
export const batchRunLabel = (n: number): string => (n === 1 ? 'Suggest for 1 picture' : `Suggest for ${n} pictures`);

/** Why the writer's kinds can't be chosen in a batch, and what to do (the file's date still can be). */
export function batchOffLine(why: string | undefined): string {
  switch (why) {
    case 'no-writer':
      return 'No AI writer is chosen: choose one on the AI screen to suggest words. Dates can still come from the files.';
    case 'blind':
      return "The AI writer's model can't see pictures: choose one that can on the AI screen. Dates can still come from the files.";
    case 'private':
      return "The AI writer isn't allowed to see private pages' pictures. Dates can still come from the files.";
    case 'unreadable':
      return 'Only pictures can be described: videos get only their dates.';
    default:
      return "The AI writer can't be asked now. Check it on the AI screen.";
  }
}

/** What a finished batch says: how many pictures got drafts, and how many got none. */
export function batchDoneLine(got: number, none: number): string {
  const pics = (n: number) => (n === 1 ? '1 picture' : `${n} pictures`);
  if (!got && !none) return 'They already have those words: nothing to suggest.';
  if (!got) return `No suggestions came for ${pics(none)}. Check the AI writer on the AI screen, or write them yourself.`;
  const tail = none ? ` None came for ${pics(none)}.` : '';
  return `Suggestions for ${pics(got)} are ready to review: nothing is saved until you save them.${tail}`;
}
