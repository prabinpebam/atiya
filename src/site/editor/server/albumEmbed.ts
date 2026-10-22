/**
 * A YouTube or Vimeo video added to an album by its address (documentation/gallery/spec.md §9.2): its
 * provider is asked once (oEmbed) for its title, shape and, on Vimeo, its length, and its thumbnail is
 * fetched and kept as the site's own picture beside the album's, its poster. Dev only, like every editor
 * route. Nothing is written to the album here: the Items view adds the item and saves the page.
 */
import sharp from 'sharp';
import { parseVideo } from '../model/ops';
import { isShorts, oembedUrl, shapeOf, SHORTS_SHAPE, type Shape } from '../model/videoShape';
import { PROVIDERS, type ProviderVideo } from '../../content/providers';
import { upload } from './media';
import type { Result } from './store';

const WAIT_MS = 10_000;
const ALT_MAX = 250;
/** Where a provider's thumbnails may be fetched from: its own picture hosts, over https. */
const THUMB_HOSTS = ['i.ytimg.com', 'i.vimeocdn.com'];

export type EmbedAnswer =
  | { ok: true; versions: Record<string, string | null>; embed: ProviderVideo & Partial<Shape>; title: string; poster: string; duration?: number }
  | Extract<Result, { ok: false }>;

const refuse = (message: string): EmbedAnswer => ({ ok: false, status: 422, issues: [{ file: 'content/articles', path: 'album', message }] });

/** The editor's tests never reach a provider: a stand-in answers (scripts/editor-test-server.mjs turns providers off). */
const standIn = () => process.env.SITE_EDITOR_PROVIDERS === 'stand-in' || process.env.SITE_EDITOR_PROFILE_PHOTOS === 'off';

async function standInFetch(url: string): Promise<Response> {
  if (/oembed/.test(url)) {
    const vimeo = /vimeo/.test(url);
    return Response.json({ title: 'A stand-in video', width: 1280, height: 720, thumbnail_url: vimeo ? 'https://i.vimeocdn.com/video/stand-in.jpg' : 'https://i.ytimg.com/vi/stand-in/hqdefault.jpg', ...(vimeo ? { duration: 90 } : {}) });
  }
  const bytes = await sharp({ create: { width: 1280, height: 720, channels: 3, background: { r: 120, g: 140, b: 170 } } }).jpeg().toBuffer();
  return new Response(new Uint8Array(bytes), { headers: { 'content-type': 'image/jpeg' } });
}

const allowedThumb = (raw: unknown): URL | null => {
  try {
    const u = new URL(String(raw));
    return u.protocol === 'https:' && THUMB_HOSTS.includes(u.hostname) ? u : null;
  } catch {
    return null;
  }
};

async function picture(get: typeof fetch, url: URL): Promise<Buffer | null> {
  try {
    const res = await get(url.href, { signal: AbortSignal.timeout(WAIT_MS) });
    if (!res.ok || !/^image\//.test(res.headers.get('content-type') ?? 'image/')) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** Asks the provider about a video's address and keeps its poster in the page's media folder (`articles/<id>`). */
export async function addEmbed(article: string, url: string, get: typeof fetch = fetch): Promise<EmbedAnswer> {
  const video = parseVideo(url);
  if (!video) return refuse('Use a YouTube or Vimeo address (https://youtu.be/…, https://vimeo.com/…).');
  const ask: typeof fetch = get === fetch && standIn() ? ((u: string | URL | Request) => standInFetch(String(u))) as typeof fetch : get;
  const name = PROVIDERS[video.provider].name;
  let answer: Record<string, unknown>;
  try {
    const res = await ask(oembedUrl(video), { signal: AbortSignal.timeout(WAIT_MS) });
    if (!res.ok) return refuse(`${name} didn't answer for that video (${res.status}): check the address, and that the video is public or unlisted.`);
    answer = (await res.json()) as Record<string, unknown>;
  } catch (e) {
    return refuse(`${name} couldn't be reached (${(e as Error).message}): try again in a moment.`);
  }
  const title = String(answer.title ?? '').trim() || `A ${name} video`;
  const shape = isShorts(url) ? SHORTS_SHAPE : shapeOf(answer);
  const duration = Number(answer.duration);
  // YouTube's biggest thumbnail first, when it has one; then whatever the answer named
  const tries = [video.provider === 'youtube' ? allowedThumb(`https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`) : null, allowedThumb(answer.thumbnail_url)].filter((u): u is URL => !!u);
  let bytes: Buffer | null = null;
  for (const u of tries) if ((bytes = await picture(ask, u))) break;
  if (!bytes) return refuse(`${name} gave no picture for that video: add it, then choose its poster from the library.`);
  const alt = `Still from: ${title}`.slice(0, ALT_MAX);
  const r = await upload({ file: { name: `${video.provider}-${video.id}-poster.jpg`, bytes }, owner: `articles/${article}`, alt });
  if (!r.ok) return r;
  return {
    ok: true,
    versions: r.versions,
    embed: { ...video, ...(shape ? shape : {}) },
    title,
    poster: r.id!,
    ...(Number.isFinite(duration) && duration > 0 ? { duration: Math.round(duration) } : {}),
  };
}
