/**
 * Suggested captions (documentation/gallery/spec.md §9.8.1, ai-services.md S12): the AI writer's draft of a picture's
 * caption, asked for only when the owner presses Suggest caption beside an empty Caption field. What's sent and the
 * people rules are alt text's (model/altText.ts): the picture alone, never its name, its metadata or a page's words,
 * and never who a person is. A caption also never invents what can't be seen (a place, a date, an event, a name).
 * Pure: the server's route and the media screens' script read them from here. A suggestion is never saved.
 */
import type { AiSettings, AiService } from '../server/aiSettings';
import { CAPTION_MAX } from '../../content/schema';
import { altOffer, tidyAnswer, type AltOff, type PictureMessage } from './altText';

/** A suggested caption's longest: a line under the picture, well inside the caption's own limit. */
export const CAPTION_SUGGEST_MAX = Math.min(120, CAPTION_MAX);

/** The one shape a suggestion comes in. */
export const CAPTION_SCHEMA = { type: 'object', properties: { caption: { type: 'string' } }, required: ['caption'], additionalProperties: false };

/** What's asked: a short line about what's happening or notable, never invented, never who a person is. */
export const CAPTION_SYSTEM = [
  'You write a caption for a picture in a photo album on a personal website: the short line a reader sees under it.',
  `At most ${CAPTION_SUGGEST_MAX} characters: one plain sentence or a phrase, in sentence case.`,
  'Say what is happening or what is notable in it, not a full description: alt text describes it elsewhere.',
  'Never start with "image of", "picture of" or "photo of", and never use hashtags, emoji or quotation marks.',
  'Never say who a person is, never name anyone, and never guess their age, ethnicity, gender identity, religion, health or anything else about them that cannot be seen.',
  'Never invent a place, a date, an event or a name: use one only when it is written in the picture itself.',
  'Answer with JSON only: {"caption": "..."}.',
].join(' ');

/**
 * The request's messages: the rules, then the picture alone.
 * @param picture the picture as it's sent (alt text's width), as a data URL
 */
export const captionMessages = (picture: string): PictureMessage[] => [
  { role: 'system', content: CAPTION_SYSTEM },
  { role: 'user', content: [{ type: 'image_url', image_url: { url: picture } }] },
];

/** What became of an answer: the caption to show, or why there's none. */
export type CaptionAnswer = { caption: string } | { caption: null; why: 'empty' | 'identifies' };

/** The rules an answer meets before it's shown: alt text's (tidied, no "image of", no one identified), cut to {@link CAPTION_SUGGEST_MAX}. */
export function cleanCaption(answer: string): CaptionAnswer {
  const w = tidyAnswer(answer, 'caption', CAPTION_SUGGEST_MAX);
  return w.text !== null ? { caption: w.text } : { caption: null, why: w.why };
}

/**
 * Whether a caption may be suggested for a picture: the writer, when its model sees pictures, and for a private
 * page's picture only when it may get private pages. Unlike alt text there's no switch: it's only ever asked for.
 */
export function captionOffer(s: Pick<AiSettings, 'services' | 'writer'>, isPrivate: boolean): { on: true; service: AiService } | { on: false; why: Exclude<AltOff, 'off'> } {
  const o = altOffer({ ...s, alt: { suggest: true } }, isPrivate);
  return o.on ? o : { on: false, why: o.why as Exclude<AltOff, 'off'> };
}

/** Why a caption wasn't suggested (the server's answer). */
export type CaptionWhy = Exclude<AltOff, 'off'> | 'failed' | 'timeout' | 'refused' | 'unreadable';

/** What the status line says when a caption the owner asked for didn't come: what happened and what to do (never silent, never vague). */
export function captionMissLine(why: CaptionWhy | string | undefined): string {
  switch (why) {
    case 'timeout':
      return 'The caption took too long to come. Try again, or write it yourself.';
    case 'refused':
      return 'No caption came back that meets the rules. Try again, or write it yourself.';
    case 'unreadable':
      return "This picture couldn't be read to suggest a caption. Write it yourself.";
    case 'no-writer':
      return 'No AI writer is chosen. Choose one on the AI screen to suggest captions.';
    case 'blind':
      return "The AI writer's model can't see pictures. Choose one that can on the AI screen.";
    case 'private':
      return "The AI writer isn't allowed to see private pages' pictures. Write this caption yourself.";
    default:
      return "The AI writer didn't answer. Check it on the AI screen, then try again.";
  }
}
