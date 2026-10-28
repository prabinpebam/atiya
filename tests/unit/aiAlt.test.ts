import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { EMPTY_SETTINGS, keyVariable, readSettings, writeSettings, type AiService, type AiSettings } from '../../src/site/editor/server/aiSettings';
import { altRoute, pictureToSend, suggestAlt, suggestCaption, suggestWords, testPictures } from '../../src/site/editor/server/aiAlt';
import { forgetPictureMeta, keepPictureMeta, pictureMeta } from '../../src/site/editor/server/pictureMeta';
import { aiServicesRoute, testService } from '../../src/site/editor/server/aiServices';
import { ALT_WIDTH } from '../../src/site/editor/model/altText';

const sse = (text: string) =>
  new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: text }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
const writer = (more: Partial<AiService> = {}): AiService => ({ id: 'eyes', kind: 'openai-compatible', provider: 'other', name: 'Eyes', base: 'https://eyes.test/v1', model: 'm', local: false, privatePages: true, pictures: true, ...more });
const settingsWith = (s: Partial<AiService> = {}, more: Partial<AiSettings> = {}): AiSettings => ({ ...structuredClone(EMPTY_SETTINGS), services: [writer(s)], writer: 'eyes', ...more });

/** A stand-in writer: what it was sent, and the alt text it answers. */
function standIn(answer = '{"alt":"Image of a green field under a pale sky."}') {
  const sent: string[] = [];
  const f = (async (_u: string | URL | Request, init?: RequestInit) => {
    const body = String(init?.body ?? '');
    sent.push(body);
    return sse(/picture test/.test(body) ? '{"colour":"red"}' : /connection test/.test(body) ? '{"ok":true}' : answer);
  }) as typeof fetch;
  return { f, sent };
}
/** The picture a request carried, decoded. */
const pictureIn = (body: string) => {
  const url = (JSON.parse(body) as { messages: { content: unknown }[] }).messages.flatMap((m) => (Array.isArray(m.content) ? m.content : [])).find((p: { type: string }) => p.type === 'image_url')?.image_url.url as string;
  return Buffer.from(url.replace(/^data:image\/jpeg;base64,/, ''), 'base64');
};

let dir = '';
const was = { content: process.env.CONTENT_ROOT, priv: process.env.PRIVATE_ROOT };
const files = (root: string): string[] =>
  readdirSync(root, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile())
    .map((e) => `${join(e.parentPath, e.name)} ${statSync(join(e.parentPath, e.name)).mtimeMs}`)
    .sort();

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'atiya-alt-'));
  process.env.CONTENT_ROOT = join(dir, 'content');
  process.env.PRIVATE_ROOT = join(dir, 'private');
  process.env.ATIYA_AI_CREDENTIALS = 'off';
  process.env[keyVariable('eyes')] = 'sk-eyes-not-a-real-key';
  const big = await sharp({ create: { width: 2000, height: 1200, channels: 3, background: { r: 40, g: 160, b: 60 } } }).webp().toBuffer();
  mkdirSync(join(dir, 'content', 'media', 'shared'), { recursive: true });
  writeFileSync(join(dir, 'content', 'media', 'shared', 'holiday-at-home.webp'), big);
  writeFileSync(join(dir, 'content', 'media', 'shared', 'holiday-at-home.json'), JSON.stringify({ kind: 'image', file: 'holiday-at-home.webp' }));
  mkdirSync(join(dir, 'private', 'media', 'articles', 'secret'), { recursive: true });
  mkdirSync(join(dir, 'private', 'articles'), { recursive: true });
  writeFileSync(join(dir, 'private', 'media', 'articles', 'secret', 'kept.webp'), big);
  writeFileSync(join(dir, 'private', 'media', 'articles', 'secret', 'kept.json'), JSON.stringify({ kind: 'image', file: 'kept.webp' }));
  writeFileSync(join(dir, 'private', 'articles', 'secret.json'), '{}');
});
afterAll(() => {
  for (const [k, v] of [
    ['CONTENT_ROOT', was.content],
    ['PRIVATE_ROOT', was.priv],
  ] as const)
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  delete process.env[keyVariable('eyes')];
  rmSync(dir, { recursive: true, force: true });
});
beforeEach(() => writeSettings(settingsWith()));

describe('suggested alt text: what is sent (gallery spec §9.6)', () => {
  it(`sends the picture at ${ALT_WIDTH} px wide as a JPEG, without its file name or its words, and keeps the rules' answer`, async () => {
    const { f, sent } = standIn();
    const pic = readFileSync(join(dir, 'content', 'media', 'shared', 'holiday-at-home.webp'));
    expect(await suggestAlt(pic, false, { fetch: f })).toEqual({ alt: 'A green field under a pale sky.' });
    expect(sent).toHaveLength(1);
    expect(sent[0]).not.toMatch(/holiday|home/);
    const meta = await sharp(pictureIn(sent[0])).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBe(ALT_WIDTH);
    expect(meta.exif).toBeUndefined();
  });

  it('never enlarges a small picture', async () => {
    const small = await sharp({ create: { width: 300, height: 200, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    expect((await sharp(Buffer.from((await pictureToSend(small)).split(',')[1], 'base64')).metadata()).width).toBe(300);
  });

  it('asks nothing without a writer that sees pictures, or with the switch off', async () => {
    const pic = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } }).png().toBuffer();
    for (const [settings, why] of [
      [{ ...settingsWith(), writer: null }, 'no-writer'],
      [settingsWith({ pictures: false }), 'blind'],
      [settingsWith({ pictures: undefined }), 'blind'],
      [settingsWith({}, { alt: { suggest: false } }), 'off'],
    ] as const) {
      const { f, sent } = standIn();
      expect(await suggestAlt(pic, false, { fetch: f, settings })).toEqual({ alt: null, why });
      expect(sent).toHaveLength(0);
    }
  });

  it("sends a private page's picture only to a service that may get private pages", async () => {
    const pic = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } }).png().toBuffer();
    const no = standIn();
    expect(await suggestAlt(pic, true, { fetch: no.f, settings: settingsWith({ privatePages: false }) })).toEqual({ alt: null, why: 'private' });
    expect(no.sent).toHaveLength(0);
    const yes = standIn();
    expect((await suggestAlt(pic, true, { fetch: yes.f, settings: settingsWith({ privatePages: true }) })).alt).toBeTruthy();
  });

  it('gives up quietly after its time, even when the service never answers', async () => {
    const pic = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } }).png().toBuffer();
    let stopped = false;
    const hangs = ((_u: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => ((stopped = true), reject(new DOMException('stopped', 'AbortError')))))) as typeof fetch;
    const t0 = Date.now();
    expect(await suggestAlt(pic, false, { fetch: hangs, waitMs: 60 })).toEqual({ alt: null, why: 'timeout' });
    expect(Date.now() - t0).toBeLessThan(5000);
    expect(stopped).toBe(true);
    const deaf = (() => new Promise<Response>(() => undefined)) as typeof fetch;
    expect(await suggestAlt(pic, false, { fetch: deaf, waitMs: 60 })).toEqual({ alt: null, why: 'timeout' });
  });

  it('is none when the service fails, or its answer breaks the rules', async () => {
    const pic = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } }).png().toBuffer();
    expect(await suggestAlt(pic, false, { fetch: (async () => new Response('{}', { status: 500 })) as typeof fetch })).toEqual({ alt: null, why: 'failed' });
    expect(await suggestAlt(pic, false, { fetch: standIn('{"alt":"A man named John Smith at a desk."}').f })).toEqual({ alt: null, why: 'refused' });
    expect(await suggestAlt(pic, false, { fetch: standIn('Sure, a desk.').f })).toEqual({ alt: null, why: 'refused' });
    expect(await suggestAlt(Buffer.from('not a picture'), false, { fetch: standIn().f })).toEqual({ alt: null, why: 'unreadable' });
  });
});

describe('suggested alt text: the routes', () => {
  const route = (path: string, method: string, body?: BodyInit, type = 'application/json', f?: typeof fetch) =>
    altRoute(['ai', ...path.split('?')[0].split('/')], method, new Request(`http://localhost/_edit/api/ai/${path}`, { method, body, headers: body instanceof FormData ? undefined : { 'content-type': type } }), { fetch: f });

  it('says whether a suggestion is offered for a picture, a private one, or a folder', async () => {
    expect(await (await route('alt?media=shared/holiday-at-home', 'GET'))!.json()).toEqual({ ok: true, on: true });
    expect((await route('alt?media=shared/nothing', 'GET'))!.status).toBe(404);
    expect((await route('alt?media=Not%20an%20id', 'GET'))!.status).toBe(404);
    expect(await (await route('alt?owner=articles/elsewhere', 'GET'))!.json()).toEqual({ ok: true, on: true });
    writeSettings(settingsWith({ privatePages: false }));
    expect(await (await route('alt?media=articles/secret/kept', 'GET'))!.json()).toEqual({ ok: true, on: false, why: 'private' });
    expect(await (await route('alt?owner=articles/secret', 'GET'))!.json()).toEqual({ ok: true, on: false, why: 'private' });
    expect(await (await route('alt?owner=shared', 'GET'))!.json()).toEqual({ ok: true, on: true });
    expect((await route('alt?owner=../x', 'GET'))!.status).toBe(400);
  });

  it("suggests for a picture in the library and for a file about to be uploaded, never sending the file's name, and writes nothing", async () => {
    const before = files(dir).filter((f) => !f.includes('.atiya'));
    const library = standIn();
    expect(await (await route('alt', 'POST', JSON.stringify({ media: 'shared/holiday-at-home' }), undefined, library.f))!.json()).toEqual({ ok: true, alt: 'A green field under a pale sky.' });
    expect(library.sent[0]).not.toMatch(/holiday/);
    const upload = standIn();
    const form = new FormData();
    form.append('file', new Blob([await sharp({ create: { width: 1500, height: 900, channels: 3, background: '#88f' } }).png().toBuffer()], { type: 'image/png' }), 'our-street-number-12.png');
    form.append('owner', 'shared');
    expect(await (await route('alt', 'POST', form, undefined, upload.f))!.json()).toEqual({ ok: true, alt: 'A green field under a pale sky.' });
    expect(upload.sent[0]).not.toMatch(/street|number-12/);
    expect((await sharp(pictureIn(upload.sent[0])).metadata()).width).toBe(ALT_WIDTH);
    expect(files(dir).filter((f) => !f.includes('.atiya'))).toEqual(before);
  });

  it("keeps a private page's upload from a service that mayn't get private pages", async () => {
    writeSettings(settingsWith({ privatePages: false }));
    const s = standIn();
    const form = new FormData();
    form.append('file', new Blob([await sharp({ create: { width: 10, height: 10, channels: 3, background: '#000' } }).png().toBuffer()], { type: 'image/png' }), 'x.png');
    form.append('owner', 'articles/secret');
    expect(await (await route('alt', 'POST', form, undefined, s.f))!.json()).toEqual({ ok: true, alt: null, why: 'private' });
    expect(await (await route('alt', 'POST', JSON.stringify({ media: 'articles/secret/kept' }), undefined, s.f))!.json()).toEqual({ ok: true, alt: null, why: 'private' });
    expect(s.sent).toHaveLength(0);
  });

  it('refuses what is not a picture or a folder', async () => {
    expect((await route('alt', 'POST', JSON.stringify({})))!.status).toBe(400);
    expect((await route('alt', 'POST', JSON.stringify({ media: 'shared/nothing' })))!.status).toBe(404);
    const form = new FormData();
    form.append('owner', 'shared');
    expect((await route('alt', 'POST', form))!.status).toBe(400);
    expect(await route('alt', 'DELETE')).toBeNull();
    expect(await route('alt/more', 'GET')).toBeNull();
  });

  it('turns "Suggest alt text for new pictures" off and on, kept in the settings', async () => {
    expect(await (await route('pictures', 'PUT', JSON.stringify({ suggest: false })))!.json()).toEqual({ ok: true, suggest: false });
    expect(readSettings().alt).toEqual({ suggest: false });
    expect(readSettings().services[0].pictures).toBe(true);
    await route('pictures', 'PUT', JSON.stringify({ suggest: true }));
    expect(readSettings().alt).toEqual({ suggest: true });
    expect((await route('pictures', 'PUT', JSON.stringify({ suggest: 'yes' })))!.status).toBe(400);
  });

  it('is reached through the AI routes', async () => {
    const res = await aiServicesRoute(['ai', 'pictures'], 'PUT', new Request('http://localhost/', { method: 'PUT', body: JSON.stringify({ suggest: false }) }));
    expect(res?.status).toBe(200);
    expect(readSettings().alt).toEqual({ suggest: false });
  });
});

describe('suggested captions (gallery spec §9.8.1)', () => {
  const route = (path: string, method: string, body?: BodyInit, f?: typeof fetch) =>
    altRoute(['ai', ...path.split('?')[0].split('/')], method, new Request(`http://localhost/_edit/api/ai/${path}`, { method, body, headers: { 'content-type': 'application/json' } }), { fetch: f });
  const pic = () => sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } }).png().toBuffer();

  it('asks with the caption rules and the picture alone, and keeps an answer that meets them', async () => {
    const { f, sent } = standIn('{"caption":"Picture of a green field after rain."}');
    expect(await suggestCaption(await pic(), false, { fetch: f })).toEqual({ caption: 'A green field after rain.' });
    const messages = JSON.parse(sent[0]).messages as { role: string; content: unknown }[];
    expect(messages[0].content).toMatch(/caption for a picture/);
    expect(messages[1].content).toEqual([expect.objectContaining({ type: 'image_url' })]);
  });

  it('is offered without the alt text switch, but never without a writer that sees pictures, or for a private picture it mayn\u2019t see', async () => {
    const { f, sent } = standIn('{"caption":"A field."}');
    expect((await suggestCaption(await pic(), false, { fetch: f, settings: settingsWith({}, { alt: { suggest: false } }) })).caption).toBe('A field.');
    for (const [settings, isPrivate, why] of [
      [{ ...settingsWith(), writer: null }, false, 'no-writer'],
      [settingsWith({ pictures: false }), false, 'blind'],
      [settingsWith({ privatePages: false }), true, 'private'],
    ] as const) expect(await suggestCaption(await pic(), isPrivate, { fetch: f, settings })).toEqual({ caption: null, why });
    expect(sent).toHaveLength(1);
  });

  it('is none, with why, when the answer breaks the rules or the service fails or takes too long', async () => {
    expect(await suggestCaption(await pic(), false, { fetch: standIn('{"caption":"A man named John Smith at his desk."}').f })).toEqual({ caption: null, why: 'refused' });
    expect(await suggestCaption(await pic(), false, { fetch: standIn('{"alt":"A desk."}').f })).toEqual({ caption: null, why: 'refused' });
    expect(await suggestCaption(await pic(), false, { fetch: (async () => new Response('{}', { status: 500 })) as typeof fetch })).toEqual({ caption: null, why: 'failed' });
    expect(await suggestCaption(await pic(), false, { fetch: (() => new Promise<Response>(() => undefined)) as typeof fetch, waitMs: 60 })).toEqual({ caption: null, why: 'timeout' });
  });

  it('`ai/caption` says whether one is offered and suggests for a library picture, writing nothing', async () => {
    writeSettings(settingsWith({}, { alt: { suggest: false } }));
    expect(await (await route('caption?media=shared/holiday-at-home', 'GET'))!.json()).toEqual({ ok: true, on: true });
    expect((await route('caption?media=shared/nothing', 'GET'))!.status).toBe(404);
    const before = files(dir).filter((f) => !f.includes('.atiya'));
    const s = standIn('{"caption":"Green, from edge to edge"}');
    expect(await (await route('caption', 'POST', JSON.stringify({ media: 'shared/holiday-at-home' }), s.f))!.json()).toEqual({ ok: true, caption: 'Green, from edge to edge' });
    expect(s.sent[0]).not.toMatch(/holiday/);
    expect(files(dir).filter((f) => !f.includes('.atiya'))).toEqual(before);
    writeSettings(settingsWith({ privatePages: false }));
    expect(await (await route('caption?media=articles/secret/kept', 'GET'))!.json()).toEqual({ ok: true, on: false, why: 'private' });
    expect(await (await route('caption', 'POST', JSON.stringify({ media: 'articles/secret/kept' })))!.json()).toEqual({ ok: true, caption: null, why: 'private' });
    expect(await route('caption/more', 'GET')).toBeNull();
  });

  it('is reached through the AI routes', async () => {
    const res = await aiServicesRoute(['ai', 'caption'], 'GET', new Request('http://localhost/_edit/api/ai/caption?media=shared/holiday-at-home'));
    expect(await res?.json()).toEqual({ ok: true, on: true });
  });
});

describe('a writer never tested for pictures: tested when the owner first asks (ai-services.md §7.7)', () => {
  const pic = () => sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } }).png().toBuffer();
  const untested = () => writeSettings(settingsWith({ pictures: undefined }));
  const tests = (sent: string[]) => sent.filter((b) => /picture test/.test(b)).length;
  /** A service that refuses any request with a picture in it, as a model that can't see them does. */
  const blind = () => {
    const sent: string[] = [];
    const f = (async (_u: string | URL | Request, init?: RequestInit) => {
      sent.push(String(init?.body ?? ''));
      return new Response('{"error":{"message":"this model does not support images"}}', { status: 400 });
    }) as typeof fetch;
    return { f, sent };
  };

  it('asked for a caption, it runs the picture test first, keeps that the model sees pictures, then asks', async () => {
    untested();
    const s = standIn('{"caption":"A field."}');
    expect(await suggestCaption(await pic(), false, { fetch: s.f })).toEqual({ caption: 'A field.' });
    expect(tests(s.sent)).toBe(1);
    expect(s.sent).toHaveLength(2);
    expect(readSettings().services[0].pictures).toBe(true);
    // tested now: the next ask goes straight to the question
    const t = standIn('{"caption":"A field."}');
    await suggestCaption(await pic(), false, { fetch: t.f });
    expect(tests(t.sent)).toBe(0);
  });

  it('a model whose service refuses the picture is kept as blind, and nothing more is asked', async () => {
    untested();
    const s = blind();
    expect(await suggestWords(await pic(), false, ['caption'], null, { fetch: s.f })).toEqual({ words: {}, missed: {}, why: 'blind' });
    expect(s.sent).toHaveLength(1);
    expect(readSettings().services[0].pictures).toBe(false);
  });

  it("a service that doesn't answer keeps no verdict: the ask fails and the next one tests again", async () => {
    untested();
    const down = (async () => new Response('{}', { status: 500 })) as typeof fetch;
    expect(await suggestCaption(await pic(), false, { fetch: down })).toEqual({ caption: null, why: 'failed' });
    expect(readSettings().services[0].pictures).toBeUndefined();
  });

  it('asks at the same time share one test', async () => {
    untested();
    const s = standIn('{"caption":"A field."}');
    await Promise.all([suggestCaption(await pic(), false, { fetch: s.f }), suggestCaption(await pic(), false, { fetch: s.f }), suggestWords(await pic(), false, ['caption'], null, { fetch: s.f })]);
    expect(tests(s.sent)).toBe(1);
  });

  it("a new picture's own alt text never goes to an untested writer; the owner's Suggest in its details does", async () => {
    untested();
    const s = standIn();
    expect(await suggestAlt(await pic(), false, { fetch: s.f })).toEqual({ alt: null, why: 'blind' });
    expect(s.sent).toHaveLength(0);
    const route = (path: string) => altRoute(['ai', 'alt'], 'GET', new Request(`http://localhost/_edit/api/ai/${path}`));
    expect(await (await route('alt?owner=shared'))!.json()).toEqual({ ok: true, on: false, why: 'blind' });
    expect(await (await route('alt?media=shared/holiday-at-home'))!.json()).toEqual({ ok: true, on: true });
    const asked = await altRoute(['ai', 'alt'], 'POST', new Request('http://localhost/_edit/api/ai/alt', { method: 'POST', body: JSON.stringify({ media: 'shared/holiday-at-home' }), headers: { 'content-type': 'application/json' } }), { fetch: s.f });
    expect(await asked!.json()).toEqual({ ok: true, alt: 'A green field under a pale sky.' });
    expect(tests(s.sent)).toBe(1);
  });
});

describe('suggested words: caption, description, alt text and place at once (gallery spec §9.8.2)', () => {
  const route = (path: string, method: string, body?: BodyInit, f: typeof fetch = standIn('{"caption":"A field.","place":""}').f) =>
    altRoute(['ai', ...path.split('?')[0].split('/')], method, new Request(`http://localhost/_edit/api/ai/${path}`, { method, body, headers: { 'content-type': 'application/json' } }), { fetch: f });
  const pic = () => sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } }).png().toBuffer();
  const metaFile = () => join(dir, '.atiya', 'picture-meta.json');

  it('asks for only the kinds wanted, in one question, and sends where it was taken only, rounded, when a place is asked', async () => {
    const s = standIn('{"caption":"A field.","place":"Kyoto, Japan."}');
    expect(await suggestWords(await pic(), false, ['caption', 'place'], { lat: 35.01163, lon: 135.76803 }, { fetch: s.f })).toEqual({ words: { caption: 'A field.', place: 'Kyoto, Japan' }, missed: {} });
    const sent = JSON.parse(s.sent[0]) as { messages: { content: unknown }[]; response_format?: unknown };
    expect(String(sent.messages[0].content)).toMatch(/"caption", "place"/);
    expect(s.sent[0]).toMatch(/latitude 35\.01, longitude 135\.77/);
    expect(s.sent[0]).not.toMatch(/35\.0116/);
    const t = standIn('{"caption":"A field."}');
    await suggestWords(await pic(), false, ['caption'], { lat: 35.01163, lon: 135.76803 }, { fetch: t.f });
    expect(t.sent[0]).not.toMatch(/latitude/);
  });

  it('keeps what meets the rules, says why the rest missed, and is none with why when nothing came', async () => {
    const s = standIn('{"caption":"A man named John Smith.","alt":"Photo of a dog on a lawn.","place":"Unknown"}');
    expect(await suggestWords(await pic(), false, ['caption', 'alt', 'place'], null, { fetch: s.f })).toEqual({ words: { alt: 'A dog on a lawn.' }, missed: { caption: 'identifies', place: 'unplaced' } });
    expect(await suggestWords(await pic(), false, ['place'], null, { fetch: standIn('{"place":""}').f })).toEqual({ words: {}, missed: { place: 'unplaced' }, why: 'refused' });
    expect(await suggestWords(await pic(), false, ['caption'], null, { fetch: standIn().f, settings: { ...settingsWith(), writer: null } })).toEqual({ words: {}, missed: {}, why: 'no-writer' });
    expect(await suggestWords(await pic(), false, ['caption'], null, { fetch: (async () => new Response('{}', { status: 500 })) as typeof fetch })).toEqual({ words: {}, missed: {}, why: 'failed' });
  });

  it('`ai/words` offers the file\u2019s date and place kept on this computer, leaves out what\u2019s filled, and writes nothing', async () => {
    writeSettings(settingsWith());
    rmSync(metaFile(), { force: true });
    expect(await (await route('words?media=shared/holiday-at-home', 'GET'))!.json()).toEqual({ ok: true, on: true, located: false });
    expect((await aiServicesRoute(['ai', 'words'], 'GET', new Request('http://localhost/_edit/api/ai/words?media=shared/holiday-at-home')))?.status).toBe(200);
    keepPictureMeta('shared/holiday-at-home', { taken: '2026-05-01', location: { lat: 24.8, lon: 93.94 } }, metaFile());
    expect(await (await route('words?media=shared/holiday-at-home', 'GET'))!.json()).toEqual({ ok: true, on: true, taken: '2026-05-01', located: true });
    expect((await route('words?media=shared/nothing', 'GET'))!.status).toBe(404);
    const before = files(dir).filter((f) => !f.includes('.atiya'));
    const reply = await (await route('words', 'POST', JSON.stringify({ media: 'shared/holiday-at-home', want: ['caption', 'place', 'nonsense'], onlyEmpty: true })))!.json();
    expect(reply).toEqual({ ok: true, words: { caption: 'A field.' }, missed: { place: 'unplaced' }, taken: '2026-05-01' });
    expect(files(dir).filter((f) => !f.includes('.atiya'))).toEqual(before);
    expect((await route('words', 'POST', JSON.stringify({ media: 'shared/holiday-at-home' })))!.status).toBe(400);
    writeSettings(settingsWith({ privatePages: false }));
    expect(await (await route('words', 'POST', JSON.stringify({ media: 'articles/secret/kept', want: ['caption'] })))!.json()).toEqual({ ok: true, words: {}, missed: {}, why: 'private' });
    forgetPictureMeta('shared/holiday-at-home', metaFile());
    expect(pictureMeta('shared/holiday-at-home', metaFile())).toBeNull();
  });

  it('`ai/words` gives a video only its file\u2019s date, never sending it', async () => {
    writeFileSync(join(dir, 'content', 'media', 'shared', 'clip.json'), JSON.stringify({ kind: 'video', file: 'clip.mp4' }));
    keepPictureMeta('shared/clip', { taken: '2026-04-02' }, metaFile());
    const s = standIn();
    expect(await (await route('words', 'POST', JSON.stringify({ media: 'shared/clip', want: ['caption'], onlyEmpty: true }), s.f))!.json()).toEqual({ ok: true, words: {}, missed: {}, taken: '2026-04-02' });
    expect(s.sent).toHaveLength(0);
    forgetPictureMeta('shared/clip', metaFile());
    rmSync(join(dir, 'content', 'media', 'shared', 'clip.json'));
  });

  it('`ai/words/needs` says what each item lacks: the date only where the file kept one, the writer\u2019s words only where it can see', async () => {
    writeFileSync(join(dir, 'content', 'media', 'shared', 'clip.json'), JSON.stringify({ kind: 'video', file: 'clip.mp4' }));
    keepPictureMeta('shared/holiday-at-home', { taken: '2026-05-01' }, metaFile());
    const needs = async () => (await route('words/needs', 'POST', JSON.stringify({ media: ['shared/holiday-at-home', 'shared/clip', 'articles/secret/kept', 'shared/nothing'] })))!.json();
    writeSettings(settingsWith());
    expect(await needs()).toEqual({ ok: true, on: true, lacks: { 'shared/holiday-at-home': ['caption', 'description', 'alt', 'place', 'taken'], 'shared/clip': [], 'articles/secret/kept': ['caption', 'description', 'alt', 'place'] } });
    writeSettings(settingsWith({ privatePages: false }));
    expect((await needs()).lacks['articles/secret/kept']).toEqual([]);
    writeSettings({ ...settingsWith(), writer: null });
    expect(await needs()).toEqual({ ok: true, on: false, why: 'no-writer', lacks: { 'shared/holiday-at-home': ['taken'], 'shared/clip': [], 'articles/secret/kept': [] } });
    expect((await route('words/needs', 'POST', JSON.stringify({ media: 'x' })))!.status).toBe(400);
    forgetPictureMeta('shared/holiday-at-home', metaFile());
    rmSync(join(dir, 'content', 'media', 'shared', 'clip.json'));
  });
});

describe('the AI screen: the Test checks picture input (ai-services.md §7.7)', () => {
  it('finds whether the model sees a picture', async () => {
    expect(await testPictures(writer(), 'k', standIn().f)).toBe(true);
    expect(await testPictures(writer(), 'k', (async () => sse('{"colour":"blue"}')) as typeof fetch)).toBe(false);
    expect(await testPictures(writer(), 'k', (async () => new Response('{"error":{"message":"this model does not support images"}}', { status: 400 })) as typeof fetch)).toBe(false);
  });

  it('tests pictures only once the words work, and says so', async () => {
    const s = standIn('{"ok":true}');
    const r = await testService(writer(), s.f);
    expect(r).toMatchObject({ state: 'ok', pictures: true });
    expect(s.sent).toHaveLength(2);
    const failed = await testService(writer(), (async () => new Response('{}', { status: 401 })) as typeof fetch);
    expect(failed.state).toBe('key-refused');
    expect(failed.pictures).toBeUndefined();
  });
});
