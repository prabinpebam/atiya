/**
 * Suggested alt text (documentation/gallery/spec.md §9.6, ai-services.md S11): a picture sent to the writer chosen
 * on the AI screen, when its model accepts pictures and the switch is on, at 960 px wide and without its file
 * name, its metadata or any page's words; a private page's picture only when that service may get private pages.
 * Given up quietly after 20 seconds. Nothing is written: a suggestion is never saved (only what the owner accepts).
 * Also the AI screen's Test of picture input (§7.7) and its switch, and the same test run on the owner's first ask
 * when a writer was never tested (`seesPictures`).
 */
import { existsSync } from 'node:fs';
import { fileOf } from '../../content/source';
import { readDoc, readFile } from './store';
import { keyFor, readSettings, writeSettings, type AiService, type AiSettings } from './aiSettings';
import { AiError, writeOpenAI } from './aiOpenAI';
import { updateService } from '../model/aiServices';
import { ALT_SCHEMA, ALT_WAIT_MS, ALT_WIDTH, PICTURE_TEST_COLOUR, PICTURE_TEST_SCHEMA, altMessages, altOffer, cleanAlt, pictureTestMessages, seesPicture, type AltOff, type PictureMessage } from '../model/altText';
import { CAPTION_SCHEMA, captionMessages, captionOffer, cleanCaption, type CaptionWhy } from '../model/captionText';
import { BATCH_KINDS, cleanWords, missingWords, wantedKinds, wordsMessages, wordsSchema, type PictureWordsNow, type WordKind, type WordMiss, type WordsAnswer } from '../model/pictureWords';
import { pictureMeta } from './pictureMeta';
import type { PictureLocation } from '../model/exif';
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
  /** The owner pressed Suggest (never set for a new picture's own suggestion): a writer never tested for pictures is tested on the way. */
  asked?: boolean;
}

/** A library item's sidecar, and whether it's a private page's. Null when there's no such item. */
function mediaDoc(id: string): { value: ImageMedia | { kind: string; taken?: string; [k: string]: unknown }; isPrivate: boolean; base: string } | null {
  if (!MEDIA_ID.test(id)) return null;
  const isPrivate = existsSync(fileOf(`/private/media/${id}.json`));
  const base = isPrivate ? '/private/media/' : '/content/media/';
  const sc = readDoc<ImageMedia>(`${base}${id}.json`);
  return sc ? { value: sc.value, isPrivate, base } : null;
}

/** A picture in the library: its bytes (an animation's still poster), and whether it's a private page's. Null when there's no such picture. */
export function libraryPicture(id: string): { bytes: Buffer; isPrivate: boolean } | null {
  const doc = mediaDoc(id);
  if (!doc || doc.value.kind !== 'image') return null;
  const { value, isPrivate, base } = doc as { value: ImageMedia; isPrivate: boolean; base: string };
  const folder = `${base}${id.slice(0, id.lastIndexOf('/'))}/`;
  const bytes = (value.animation ? readFile(`${folder}${value.animation.poster}`) : null) ?? readFile(`${folder}${value.file}`);
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
  const offer = altOffer(o.settings ?? readSettings(), isPrivate, o.asked);
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

type Asked<T = string> = { text: T; why?: undefined } | { text: null; why: 'failed' | 'timeout' | 'refused' | 'unreadable' | 'blind' };

/** `ai/words`' answer (§9.8.2): the suggestions that meet their rules, why each other kind asked has none, and why there are none at all. */
export interface WordsReply {
  words: Partial<Record<WordKind, string>>;
  missed: Partial<Record<WordKind, WordMiss>>;
  why?: CaptionWhy;
}

/**
 * Asks the writer for several of a picture's words in one question (§9.8.2), on the owner's asking only. Where it was
 * taken goes with it, rounded, only when a place is asked for.
 */
export async function suggestWords(bytes: Buffer, isPrivate: boolean, want: readonly WordKind[], location: PictureLocation | null | undefined, o: AltOptions = {}): Promise<WordsReply> {
  if (!want.length) return { words: {}, missed: {} };
  const offer = captionOffer(o.settings ?? readSettings(), isPrivate);
  if (!offer.on) return { words: {}, missed: {}, why: offer.why };
  const a = await askAbout<WordsAnswer>(bytes, offer.service, { messages: (p) => wordsMessages(p, want, location), schema: wordsSchema(want), clean: (t) => cleanWords(t, want) }, o);
  if (a.text === null) return { words: {}, missed: {}, why: a.why };
  return Object.keys(a.text.words).length ? a.text : { ...a.text, why: 'refused' };
}

/** One question about a picture: sent as {@link pictureToSend} makes it, raced against the time limit, its answer held to `clean`'s rules (null: refused). A writer never tested for pictures is tested first ({@link seesPictures}). */
export async function askAbout<T = string>(bytes: Buffer, s: AiService, ask: { messages: (picture: string) => PictureMessage[]; schema: Record<string, unknown>; clean: (answer: string) => T | null }, o: AltOptions): Promise<Asked<T>> {
  const key = await keyFor(s.id);
  if (!s.local && !key) return { text: null, why: 'failed' };
  if (s.pictures !== true) {
    const sees = await seesPictures(s, o.fetch);
    if (sees === null) return { text: null, why: 'failed' };
    if (!sees) return { text: null, why: 'blind' };
  }
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
  const late = new Promise<Asked<T>>((done) => {
    timer = setTimeout(() => {
      ctl.abort();
      done({ text: null, why: 'timeout' });
    }, wait);
  });
  const asked = writeOpenAI({ base: s.base, key, model: s.model, messages: ask.messages(picture), schema: ask.schema, local: s.local, signal: ctl.signal, fetch: o.fetch, startMs: wait + 1000, stallMs: wait + 1000 }).then(
    (w): Asked<T> => {
      const text = ask.clean(w.text);
      return text ? { text } : { text: null, why: 'refused' };
    },
    (): Asked<T> => ({ text: null, why: ctl.signal.aborted ? 'timeout' : 'failed' }),
  );
  try {
    return await Promise.race([asked, late]);
  } finally {
    clearTimeout(timer);
  }
}

/** The AI screen's Test of picture input (§7.7): a small red picture, and whether the model said red. */
export async function testPictures(s: AiService, key: string | undefined, f?: typeof fetch): Promise<boolean> {
  return (await picturesAnswer(s, key, f)) === true;
}

/** The picture test's answer: whether the model said red, false when its service refused the picture, null when it didn't answer (no verdict). */
async function picturesAnswer(s: AiService, key: string | undefined, f?: typeof fetch): Promise<boolean | null> {
  try {
    const { default: sharp } = await import('sharp');
    const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: PICTURE_TEST_COLOUR } }).png().toBuffer();
    const w = await writeOpenAI({ base: s.base, key, model: s.model, messages: pictureTestMessages(`data:image/png;base64,${png.toString('base64')}`), schema: PICTURE_TEST_SCHEMA, local: s.local, fetch: f, startMs: s.local ? 120_000 : 30_000 });
    return seesPicture(w.text);
  } catch (e) {
    // a service that refuses a request with a picture in it (a 4xx it names no other reason for) has a model that can't see them
    return e instanceof AiError && e.code === 'rejected' ? false : null;
  }
}

const checking = new Map<string, Promise<boolean | null>>();

/**
 * Whether a writer never tested for pictures sees them (ai-services.md §7.7), found the first time the owner asks for
 * words: the AI screen's picture test, run once however many ask at the same time, and kept in the settings as the
 * screen's Test keeps it. No verdict (the service didn't answer) keeps nothing, so the next ask tries again.
 */
export async function seesPictures(s: AiService, f?: typeof fetch): Promise<boolean | null> {
  if (s.pictures !== undefined) return s.pictures;
  const at = `${s.id}\n${s.model}`;
  let running = checking.get(at);
  if (!running) {
    running = (async () => {
      const sees = await picturesAnswer(s, await keyFor(s.id), f);
      const now = readSettings();
      // only for the same model: it may have been changed while the test ran
      if (sees !== null && now.services.some((x) => x.id === s.id && x.model === s.model)) writeSettings(updateService(now, s.id, { pictures: sees }));
      return sees;
    })().finally(() => checking.delete(at));
    checking.set(at, running);
  }
  return running;
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
  if (parts[1] === 'words' && !parts[2]) return wordsRoute(method, request, o);
  if (parts[1] === 'words' && parts[2] === 'needs' && !parts[3] && method === 'POST') return needsRoute(request, o);
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
    // asked about a picture in the library, the owner is the one asking (its details' Suggest); about a folder, it's a new picture's own suggestion
    const offer = what === 'alt' ? altOffer(o.settings ?? readSettings(), isPrivate, !!media) : captionOffer(o.settings ?? readSettings(), isPrivate);
    return json(offer.on ? { ok: true, on: true } : { ok: true, on: false, why: offer.why });
  }
  if (method !== 'POST') return null;
  let picture: { bytes: Buffer; isPrivate: boolean } | null;
  let asked = what === 'caption';
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
    asked = true;
  }
  return json({ ok: true, ...(await (what === 'alt' ? suggestAlt : suggestCaption)(picture.bytes, picture.isPrivate, { ...o, asked })) });
}

/**
 * `ai/words` (§9.8.2): GET `?media=<id>` says whether words can be suggested for that item, its file's date when its
 * own was cleared (`taken`) and whether its file said where it was taken (`located`); POST `{ media, want, onlyEmpty }`
 * asks for the kinds in `want` (caption, description, alt, place), with `onlyEmpty` leaving out those it already has.
 * Nothing is saved: the owner saves what he keeps.
 */
async function wordsRoute(method: string, request: Request, o: AltOptions): Promise<Response | null> {
  if (method === 'GET') {
    const media = new URL(request.url).searchParams.get('media') ?? '';
    const doc = mediaDoc(media);
    if (!doc) return refuse('No such picture.', 404);
    const meta = pictureMeta(media);
    // the file's own date, whatever the sidecar says: the screen offers it while its Date taken is empty
    const taken = meta?.taken;
    const offer = captionOffer(o.settings ?? readSettings(), doc.isPrivate);
    const on = doc.value.kind === 'image' && offer.on;
    return json({ ok: true, on, ...(on ? {} : { why: offer.on ? 'unreadable' : offer.why }), ...(taken ? { taken } : {}), located: !!meta?.location });
  }
  if (method !== 'POST') return null;
  const b = (await request.json().catch(() => null)) as { media?: unknown; want?: unknown; onlyEmpty?: unknown } | null;
  if (typeof b?.media !== 'string') return refuse('Name the picture.');
  if (!Array.isArray(b.want)) return refuse('Say which words to suggest.');
  const doc = mediaDoc(b.media);
  if (!doc) return refuse('No such picture.', 404);
  const picture = libraryPicture(b.media);
  const has = (k: WordKind) => !!String((doc.value as Record<string, unknown>)[k] ?? '').trim() || (k === 'alt' && !!(doc.value as ImageMedia).decorative);
  const want = wantedKinds(b.want).filter((k) => !(b.onlyEmpty === true && has(k)));
  const meta = pictureMeta(b.media);
  const taken = !String(doc.value.taken ?? '').trim() && meta?.taken ? meta.taken : undefined;
  // a video or a linked video is never sent: it gets only its file's date
  const reply = picture ? await suggestWords(picture.bytes, picture.isPrivate, want, meta?.location, o) : { words: {}, missed: {} };
  return json({ ok: true, ...reply, ...(taken ? { taken } : {}) });
}

/**
 * `ai/words/needs` (§9.8.2): POST `{ media: [ids] }` says, for a batch, whether the writer can be asked and what each
 * item lacks (`lacks`: the file's date only where this computer kept one). Reads only.
 */
async function needsRoute(request: Request, o: AltOptions): Promise<Response> {
  const b = (await request.json().catch(() => null)) as { media?: unknown } | null;
  if (!Array.isArray(b?.media) || !b.media.every((m) => typeof m === 'string')) return refuse('Name the pictures.');
  const docs = (b.media as string[]).flatMap((id) => {
    const d = mediaDoc(id);
    return d ? [{ id, d }] : [];
  });
  const settings = o.settings ?? readSettings();
  const offers = docs.filter((x) => x.d.value.kind === 'image').map((x) => captionOffer(settings, x.d.isPrivate));
  const on = offers.some((x) => x.on);
  const why = on ? undefined : (offers.map((x) => (x.on ? undefined : x.why)).find(Boolean) ?? 'unreadable');
  const lacks = Object.fromEntries(
    docs.map(({ id, d }) => {
      const v = d.value as Record<string, unknown>;
      const s = (k: string) => (typeof v[k] === 'string' ? (v[k] as string) : undefined);
      // the date counts as missing only where there's a file's date to fill it with
      const taken = s('taken') || (pictureMeta(id)?.taken ? undefined : 'none');
      const now: PictureWordsNow = { kind: d.value.kind, caption: s('caption'), description: s('description'), alt: s('alt'), decorative: v.decorative === true, place: s('place'), taken };
      // where the writer can't see it (off, or a private page's picture it isn't allowed), only the date can come
      const sees = now.kind === 'image' && captionOffer(settings, d.isPrivate).on;
      return [id, missingWords(now, BATCH_KINDS).filter((k) => k === 'taken' || sees)];
    }),
  );
  return json({ ok: true, on, ...(why ? { why } : {}), lacks });
}