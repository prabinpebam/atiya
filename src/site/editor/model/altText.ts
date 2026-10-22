/**
 * Suggested alt text (documentation/gallery/spec.md §9.6, ai-services.md S11): what's asked, what's sent, the rules
 * an answer must meet before it's shown, and whether a suggestion may be asked for at all. Pure: the server's
 * route and the media screens' scripts read them from here. A suggestion is never saved: only what the owner
 * accepts or edits into the field is alt text.
 */
import type { AiService, AiSettings } from '../server/aiSettings';

/** Alt text's longest (the content check's and the details' limit). */
export const ALT_MAX = 250;
/** The width a picture is sent at: enough to read it, never its full size. */
export const ALT_WIDTH = 960;
/** How long a suggestion may take before it's given up, quietly. */
export const ALT_WAIT_MS = 20_000;

/** A piece of a message: words, or a picture as a data URL (the OpenAI-compatible chat API's parts). */
export type MessagePart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
/** A message that may carry a picture. */
export interface PictureMessage {
  role: 'system' | 'user';
  content: string | MessagePart[];
}

/** The one shape a suggestion comes in. */
export const ALT_SCHEMA = { type: 'object', properties: { alt: { type: 'string' } }, required: ['alt'], additionalProperties: false };

/** What's asked (§9.6): what's visible, short, never "image of", never who a person is. */
export const ALT_SYSTEM = [
  'You write alt text for a picture on a website: a description of what is visible, for someone who cannot see it.',
  `At most ${ALT_MAX} characters; one or two plain sentences.`,
  'Never start with "image of", "picture of" or "photo of": start with what it shows.',
  'Never say who a person is, never name anyone, and never guess their age, ethnicity, gender identity, religion, health or anything else about them that cannot be seen: describe only what they are doing and what is visible.',
  'If the picture has text that matters to what it shows (a sign, a title, a chart label), read it out.',
  'Answer with JSON only: {"alt": "..."}.',
].join(' ');

/**
 * The request's messages: the rules, then the picture alone. No file name, no metadata and no page's words go with it.
 * @param picture the picture at {@link ALT_WIDTH} px, as a data URL
 */
export const altMessages = (picture: string): PictureMessage[] => [
  { role: 'system', content: ALT_SYSTEM },
  { role: 'user', content: [{ type: 'image_url', image_url: { url: picture } }] },
];

/** The AI screen's Test of picture input (ai-services.md §7.7): a small picture of one colour, and its colour asked. */
export const PICTURE_TEST_SCHEMA = { type: 'object', properties: { colour: { type: 'string' } }, required: ['colour'], additionalProperties: false };
export const pictureTestMessages = (picture: string): PictureMessage[] => [
  { role: 'system', content: 'This is a picture test. Say the colour of the picture in one word. Answer with JSON only: {"colour": "..."}.' },
  { role: 'user', content: [{ type: 'image_url', image_url: { url: picture } }] },
];
/** The test picture's colour (sRGB). */
export const PICTURE_TEST_COLOUR = { r: 220, g: 0, b: 0 };
/** Whether the test's answer saw the picture: its colour is red. */
export function seesPicture(answer: string): boolean {
  try {
    const colour = (JSON.parse(answer) as { colour?: unknown }).colour;
    return typeof colour === 'string' && /\bred\b|crimson|scarlet/i.test(colour);
  } catch {
    return false;
  }
}

// ---------- the answer ----------

/** "Image of", "A photo showing", "Picture depicting"…: never how alt text starts (the details' own check refuses it too). */
const LEAD = /^(?:(?:an?|the|this)\s+)?(?:image|picture|photo|photograph|illustration|screenshot)\s+(?:of|showing|that shows|which shows|depicting|with)(?:\s+|$)/i;
/** Who a person is or what can't be seen about them (§9.6): a guessed age, an ethnicity, a name. */
const PERSON = '(?:man|men|woman|women|person|people|boy|boys|girl|girls|child|children|kid|kids|baby|lady|ladies|gentleman|couple|family|teenager|guy|guys)';
const IDENTIFIES: RegExp[] = [
  /\b\d{1,3}[\s-]*(?:years?|yrs?)[\s-]*old\b/i,
  /\baged\s+(?:about\s+|around\s+)?\d/i,
  /\b(?:in\s+(?:his|her|their)\s+)(?:early\s+|mid\s+|late\s+)?(?:teens|twenties|thirties|forties|fifties|sixties|seventies|eighties|nineties|\d0s)\b/i,
  /\b(?:middle[\s-]aged|elderly)\b/i,
  new RegExp(`\\b(?:caucasian|asian|african(?:[\\s-]american)?|hispanic|latin[oax]|white|black|brown|indian|arab|arabic|european|middle[\\s-]eastern|south[\\s-]asian|east[\\s-]asian|ethnic)\\s+${PERSON}\\b`, 'i'),
  /\bof\s+(?:\w+\s+)?(?:descent|ethnicity|heritage|origin)\b/i,
  new RegExp(`\\b${PERSON}\\s+(?:named|called|known\\s+as|identified\\s+as)\\s+[A-Z]`),
  /\b(?:named|called|known\s+as|identified\s+as)\s+[A-Z][a-z]+\s+[A-Z][a-z]+/,
];

/** Whether words say who a person is, or something about them that can't be seen (§9.6). */
export const identifies = (text: string): boolean => IDENTIFIES.some((r) => r.test(text));

/** Cuts words to `max`: at the last sentence's end if that keeps at least half, else at the last whole word. */
export function cutTo(text: string, max = ALT_MAX): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max);
  const sentence = /^[\s\S]*[.!?](?=\s|$)/.exec(head)?.[0];
  if (sentence && sentence.length >= max / 2) return sentence.trim();
  const space = head.lastIndexOf(' ');
  // one unbroken run of characters: cut where it must be
  if (space <= 0) return head;
  return `${head.slice(0, space).replace(/[\s,;:.!?–—-]+$/, '')}.`;
}

/** What became of an answer: the suggestion to show, or why there's none. */
export type AltAnswer = { alt: string } | { alt: null; why: 'empty' | 'identifies' };

/**
 * The rules an answer meets before it's shown (§9.6): the JSON's `alt`, its spaces and quotes tidied, a leading
 * "image of" taken off, cut to 250 characters; refused when it's empty or says who a person is.
 */
export function cleanAlt(answer: string): AltAnswer {
  let alt: unknown;
  try {
    alt = (JSON.parse(answer) as { alt?: unknown }).alt;
  } catch {
    alt = null;
  }
  if (typeof alt !== 'string') return { alt: null, why: 'empty' };
  let text = alt.replace(/\s+/g, ' ').trim().replace(/^["'“‘]+|["'”’]+$/g, '').trim();
  for (let i = 0; i < 3 && LEAD.test(text); i++) text = text.replace(LEAD, '');
  text = text.charAt(0).toUpperCase() + text.slice(1);
  text = cutTo(text);
  if (!text || !/[a-z0-9]/i.test(text)) return { alt: null, why: 'empty' };
  if (identifies(text)) return { alt: null, why: 'identifies' };
  return { alt: text };
}

// ---------- when a suggestion is offered ----------

/** Whether a service's model can see pictures, from its last Test (ai-services.md §7.7). */
export const picturesOf = (s: Pick<AiService, 'pictures'> | null | undefined): 'yes' | 'no' | 'untested' => (s?.pictures === true ? 'yes' : s?.pictures === false ? 'no' : 'untested');

/** The switch "Suggest alt text for new pictures": on unless turned off. */
export const suggestsAlt = (s: Pick<AiSettings, 'alt'>): boolean => s.alt?.suggest !== false;

/** Why nothing is suggested: no writer, its model can't see pictures (or isn't tested), the switch is off, or the picture is a private page's and the writer mayn't get those. */
export type AltOff = 'no-writer' | 'blind' | 'off' | 'private';

/** Whether a suggestion may be asked for a picture (§9.6): the writer, when its model sees pictures and the switch is on. */
export function altOffer(s: Pick<AiSettings, 'services' | 'writer' | 'alt'>, isPrivate: boolean): { on: true; service: AiService } | { on: false; why: AltOff } {
  const service = s.services.find((x) => x.id === s.writer);
  if (!service) return { on: false, why: 'no-writer' };
  if (service.pictures !== true) return { on: false, why: 'blind' };
  if (!suggestsAlt(s)) return { on: false, why: 'off' };
  if (isPrivate && !service.privatePages) return { on: false, why: 'private' };
  return { on: true, service };
}

/** Whether a field may be given a suggestion: never one with alt text, nor a picture marked decorative. */
export const wantsSuggestion = (field: { alt: string; decorative?: boolean }): boolean => !field.alt.trim() && !field.decorative;

/** The alt text a form saves: only what's in the field. A suggestion not accepted is never saved and doesn't count. */
export const altToSave = (field: string, _suggestion?: string | null): string => field.trim();

/** The status line after suggestions that didn't come (§9.6): how many pictures weren't suggested. */
export function missedLine(missed: number): string {
  if (missed <= 0) return '';
  return missed === 1 ? "1 picture wasn't suggested alt text: write it yourself." : `${missed} pictures weren't suggested alt text: write theirs yourself.`;
}

/** The AI screen's Pictures row when the switch isn't shown. */
export const PICTURES_NO = "This model can't see pictures.";
export const PICTURES_UNTESTED = 'Test the writer to find out whether its model can see pictures.';
/** What a Test adds about pictures (§7.7): nothing when it didn't get that far. */
export const picturesTestLine = (pictures: boolean | undefined): string => (pictures === undefined ? '' : pictures ? ' It can see pictures.' : " It can't see pictures.");
