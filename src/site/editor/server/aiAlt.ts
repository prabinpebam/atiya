/**
 * Suggested alt text (documentation/gallery/spec.md §9.6, ai-services.md S11): a picture sent to the writer chosen
 * on the AI screen, when its model accepts pictures and the switch is on, at 960 px wide and without its file
 * name, its metadata or any page's words; a private page's picture only when that service may get private pages.
 * Given up quietly after 20 seconds. Nothing is written: a suggestion is never saved (only what the owner accepts).
 * Also the AI screen's Test of picture input (§7.7) and its switch.
 */
import { existsSync } from 'node:fs';
import { fileOf } from '../../content/source';
import { readDoc, readFile } from './store';
import { keyFor, readSettings, writeSettings, type AiService, type AiSettings } from './aiSettings';
import { writeOpenAI } from './aiOpenAI';
import { ALT_SCHEMA, ALT_WAIT_MS, ALT_WIDTH, PICTURE_TEST_COLOUR, PICTURE_TEST_SCHEMA, altMessages, altOffer, cleanAlt, pictureTestMessages, seesPicture, type AltOff, type PictureMessage } from '../model/altText';
import { CAPTION_SCHEMA, captionMessages, captionOffer, cleanCaption, type CaptionWhy } from '../model/captionText';
import { MAX_PICTURE_BYTES } from '../model/upload';
import type { ImageMedia } from '../../content/schema';

const MEDIA_ID = /^[a-z0-9-]+(?:\/[a-z0-9-]+)+$/;
const OWNER = /^(shared|site|articles\/[a-z0-9]+(?:-[a-z0-9]+)*|people\/[a-z0-9]+(?:-[a-z0-9]+)*)$/;

/** Why there's no suggestion: not offered (AltOff), the service failed or took too long, the answer broke the rules, or the picture couldn't be read. */
export type AltWhy = AltOff | 'failed' | 'timeout' | 'refused' | 'unreadable';
/** The route's answer: a suggestion, or none and why (quiet: the field stays as it was). */
export type AltReply = { alt: string } | { alt: null; why: AltWhy };
/** `ai/caption`'s answer: a suggested caption, or none and why (the status line says it, with what to do). */
export type CaptionReply = { caption: string } | { caption: null; why: CaptionWhy };

export interface AltOptions {
  settings?: AiSettings;
  fetch?: typeof fetch;
  /** How long before it's given up (20 s). */
  waitMs?: number;
}

/** A picture in the library: its bytes (an animation's still poster), and whether it's a private page's. Null when there's no such picture. */
export function libraryPicture(id: string): { bytes: Buffer; isPrivate: boolean } | null {
  if (!MEDIA_ID.test(id)) return null;
  const isPrivate = existsSync(fileOf(`/private/media/${id}.json`));
  const base = isPrivate ? '/private/media/' : '/content/media/';
  const sc = readDoc<ImageMedia>(`${base}${id}.json`);
  if (!sc || sc.value.kind !== 'image') return null;
  const folder = `${base}${id.slice(0, id.lastIndexOf('/'))}/`;
  const bytes = (sc.value.animation ? readFile(`${folder}${sc.value.animation.poster}`) : null) ?? readFile(`${folder}${sc.value.file}`);
  return bytes ? { bytes, isPrivate } : null;
}

/** Whether an upload's folder is a private page's (its pictures go to private-pages/). */
export function ownerIsPrivate(owner: string): boolean {
  const page = /^articles\/(.+)$/.exec(owner)?.[1];
  return !!page && existsSync(fileOf(`/private/articles/${page}.json`));
}

/** The picture as it's sent: 960 px wide at most, flattened on white, a JPEG with no metadata, as a data URL. Never its name. */
export async function pictureToSend(bytes: Buffer): Promise<string> {
  const { default: sharp } = await import('sharp');
  const out = await sharp(bytes, { failOn: 'error', density: 144 }).rotate().resize({ width: ALT_WIDTH, withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 82 }).toBuffer();
  return `data:image/jpeg;base64,${out.toString('base64')}`;
}

/** Asks the writer for a picture's alt text. Quiet: anything but a suggestion that meets the rules is none, with why. */
export async function suggestAlt(bytes: Buffer, isPrivate: boolean, o: AltOptions = {}): Promise<AltReply> {
  const offer = altOffer(o.settings ?? readSettings(), isPrivate);
  if (!offer.on) return { alt: null, why: offer.why };
  const a = await askAbout(bytes, offer.service, { messages: altMessages, schema: ALT_SCHEMA, clean: (t) => cleanAlt(t).alt }, o);
  return a.text !== null ? { alt: a.text } : { alt: null, why: a.why };
}

/** Asks the writer for a picture's caption (§9.8.1), on the owner's asking only. Anything but one that meets the rules is none, with why. */
export async function suggestCaption(bytes: Buffer, isPrivate: boolean, o: AltOptions = {}): Promise<CaptionReply> {
  const offer = captionOffer(o.settings ?? readSettings(), isPrivate);
  if (!offer.on) return { caption: null, why: offer.why };
  const a = await askAbout(bytes, offer.service, { messages: captionMessages, schema: CAPTION_SCHEMA, clean: (t) => cleanCaption(t).caption }, o);
  return a.text !== null ? { caption: a.text } : { caption: null, why: a.why };
}

type Asked = { text: string; why?: undefined } | { text: null; why: 'failed' | 'timeout' | 'refused' | 'unreadable' };

/** One question about a picture: sent as {@link pictureToSend} makes it, raced against the time limit, its answer held to `clean`'s rules. */
async function askAbout(bytes: Buffer, s: AiService, ask: { messages: (picture: string) => PictureMessage[]; schema: Record<string, unknown>; clean: (answer: string) => string | null }, o: AltOptions): Promise<Asked> {
  const key = await keyFor(s.id);
  if (!s.local && !key) return { text: null, why: 'failed' };
  let picture: string;
  try {
    picture = await pictureToSend(bytes);
  } catch {
    return { text: null, why: 'unreadable' };
  }
  const wait = o.waitMs ?? ALT_WAIT_MS;
  const ctl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // the time limit stands even when the service never answers: it's raced, and the request is stopped
  const late = new Promise<Asked>((done) => {
    timer = setTimeout(() => {
      ctl.abort();
      done({ text: null, why: 'timeout' });
    }, wait);
  });
  const asked = writeOpenAI({ base: s.base, key, model: s.model, messages: ask.messages(picture), schema: ask.schema, local: s.local, signal: ctl.signal, fetch: o.fetch, startMs: wait + 1000, stallMs: wait + 1000 }).then(
    (w): Asked => {
      const text = ask.clean(w.text);
      return text ? { text } : { text: null, why: 'refused' };
    },
    (): Asked => ({ text: null, why: ctl.signal.aborted ? 'timeout' : 'failed' }),
  );
  try {
    return await Promise.race([asked, late]);
  } finally {
    clearTimeout(timer);
  }
}

/** The AI screen's Test of picture input (§7.7): a small red picture, and whether the model said red. */
export async function testPictures(s: AiService, key: string | undefined, f?: typeof fetch): Promise<boolean> {
  try {
    const { default: sharp } = await import('sharp');
    const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: PICTURE_TEST_COLOUR } }).png().toBuffer();
    const w = await writeOpenAI({ base: s.base, key, model: s.model, messages: pictureTestMessages(`data:image/png;base64,${png.toString('base64')}`), schema: PICTURE_TEST_SCHEMA, local: s.local, fetch: f, startMs: s.local ? 120_000 : 30_000 });
    return seesPicture(w.text);
  } catch {
    return false;
  }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const refuse = (message: string, status = 400) => json({ ok: false, issues: [{ file: 'content/media', message }] }, status);

/**
 * `ai/alt`: GET (`?media=<id>` or `?owner=<folder>`) says whether a suggestion is offered for that picture; POST asks for
 * one, with JSON `{ media }` for a picture in the library or multipart `file` and `owner` for one about to be uploaded.
 * `ai/pictures`: PUT `{ suggest }` turns "Suggest alt text for new pictures" on or off.
 */
export async function altRoute(parts: string[], method: string, request: Request, o: AltOptions = {}): Promise<Response | null> {
  if (parts[1] === 'pictures' && !parts[2] && method === 'PUT') {
    const b = (await request.json().catch(() => null)) as { suggest?: unknown } | null;
    if (typeof b?.suggest !== 'boolean') return refuse('Say whether to suggest alt text.');
    writeSettings({ ...readSettings(), alt: { suggest: b.suggest } });
    return json({ ok: true, suggest: b.suggest });
  }
  const what = parts[1];
  if ((what !== 'alt' && what !== 'caption') || parts[2]) return null;
  if (method === 'GET') {
    const url = new URL(request.url);
    const media = url.searchParams.get('media');
    const owner = url.searchParams.get('owner') ?? 'shared';
    let isPrivate = false;
    if (media) {
      const pic = libraryPicture(media);
      if (!pic) return refuse('No such picture.', 404);
      isPrivate = pic.isPrivate;
    } else if (OWNER.test(owner)) isPrivate = ownerIsPrivate(owner);
    else return refuse('Not a folder.');
    const offer = (what === 'alt' ? altOffer : captionOffer)(o.settings ?? readSettings(), isPrivate);
    return json(offer.on ? { ok: true, on: true } : { ok: true, on: false, why: offer.why });
  }
  if (method !== 'POST') return null;
  let picture: { bytes: Buffer; isPrivate: boolean } | null;
  if ((request.headers.get('content-type') ?? '').startsWith('multipart/form-data')) {
    const form = await request.formData().catch(() => null);
    const file = form?.get('file');
    const owner = String(form?.get('owner') ?? 'shared');
    if (!(file instanceof Blob) || !file.size) return refuse('Send a picture.');
    if (file.size > MAX_PICTURE_BYTES) return refuse(`The picture is too big to suggest ${what === 'alt' ? 'alt text' : 'a caption'} for.`);
    if (!OWNER.test(owner)) return refuse('Not a folder.');
    // only the bytes are read: the file's name never goes anywhere
    picture = { bytes: Buffer.from(await file.arrayBuffer()), isPrivate: ownerIsPrivate(owner) };
  } else {
    const b = (await request.json().catch(() => null)) as { media?: unknown } | null;
    if (typeof b?.media !== 'string') return refuse('Name the picture.');
    picture = libraryPicture(b.media);
    if (!picture) return refuse('No such picture.', 404);
  }
  return json({ ok: true, ...(await (what === 'alt' ? suggestAlt : suggestCaption)(picture.bytes, picture.isPrivate, o)) });
}
