/**
 * A linked video (documentation/gallery/spec.md §4.2, §9.4, V45): a YouTube or Vimeo address made a library
 * item, a sidecar of kind `embed` with a poster of the site's own beside it. The provider is asked once (oEmbed)
 * for the video's title, shape and, on Vimeo, its length, and its thumbnail is fetched once and kept as
 * `<name>.poster.webp`. An address the library already has answers that item. Dev only, like every editor
 * route; nothing is added to an album here: the album editor adds the item and saves the album.
 */
import sharp from 'sharp';
import { isShorts, oembedUrl, shapeOf, SHORTS_SHAPE } from '../model/videoShape';
import { slugify, unique } from '../model/ids';
import { parseVideoUrl, PROVIDERS } from '../../content/providers';
import { embedMedia, type EmbedMedia } from '../../content/schema';
import { readSnapshot } from '../../content/source';
import { folderOf, toMaster } from './media';
import { findLinkedVideo } from './libraryIndex';
import { commit, jsonBytes, type Result } from './store';

const WAIT_MS = 10_000;
/** Where a provider's thumbnails may be fetched from: its own picture hosts, over https. */
const THUMB_HOSTS = ['i.ytimg.com', 'i.vimeocdn.com'];
const ALBUM_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** What's refused for an address that isn't a YouTube or Vimeo video. */
export const ONLY_PROVIDERS = 'Only YouTube and Vimeo videos can be linked. Upload the file instead.';

/** What to link: the address, the album it's for (its folder, `media/albums/<id>/`) and whether it's private. */
export interface LinkedVideoRequest {
  url: string;
  album?: string;
  private?: boolean;
}

export type LinkedVideoAnswer = { ok: true; versions: Record<string, string | null>; id: string; existing: boolean; title: string } | Extract<Result, { ok: false }>;

const refuse = (message: string): LinkedVideoAnswer => ({ ok: false, status: 422, issues: [{ file: 'content/media', path: 'url', message }] });

/** The editor's tests never reach a provider: a stand-in answers (scripts/editor-test-server.mjs turns providers off). */
const standIn = () => process.env.SITE_EDITOR_PROVIDERS === 'stand-in' || process.env.SITE_EDITOR_PROFILE_PHOTOS === 'off';

/** The stand-in provider: an oEmbed answer and a plain thumbnail, for tests and the fixture server. */
export async function standInFetch(url: string): Promise<Response> {
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

/** The folder a new linked video goes to: its album's (`albums/<id>`), else the library's; private-pages/ for a private one. */
function folderFor(req: LinkedVideoRequest): string {
  const owner = req.album ? `albums/${req.album}` : 'library';
  const folder = folderOf(owner);
  return req.private ? folder.replace(/^\/content\/media\//, '/private/media/') : folder;
}

/**
 * Makes a YouTube or Vimeo address a linked video in the library, or answers the one already there
 * (`existing`). `get` is the network (a stand-in in tests: they never reach a provider).
 */
export async function addLinkedVideo(req: LinkedVideoRequest, get: typeof fetch = fetch): Promise<LinkedVideoAnswer> {
  const url = String(req.url ?? '').trim();
  const video = parseVideoUrl(url);
  if (!video) return refuse(ONLY_PROVIDERS);
  if (req.album !== undefined && !ALBUM_ID.test(req.album)) return { ok: false, status: 422, issues: [{ file: 'content/albums', path: 'album', message: `"${req.album}" isn't an album's ID` }] };
  const snap = readSnapshot();
  const known = findLinkedVideo(video.provider, video.id, snap.docs);
  if (known) return { ok: true, versions: {}, id: known.id, existing: true, title: known.title };
  const ask: typeof fetch = get === fetch && standIn() ? (((u: string | URL | Request) => standInFetch(String(u))) as typeof fetch) : get;
  const name = PROVIDERS[video.provider].name;
  let answer: Record<string, unknown>;
  try {
    const res = await ask(oembedUrl(video), { signal: AbortSignal.timeout(WAIT_MS) });
    if (!res.ok) return refuse(`${name} didn't answer for that video (${res.status}): check the address, and that the video is public or unlisted.`);
    answer = (await res.json()) as Record<string, unknown>;
  } catch (e) {
    return refuse(`${name} couldn't be reached (${(e as Error).message}): try again in a moment.`);
  }
  const title = (String(answer.title ?? '').trim() || `A ${name} video`).slice(0, 250);
  const shape = isShorts(url) ? SHORTS_SHAPE : shapeOf(answer);
  const duration = Math.round(Number(answer.duration));
  // its thumbnail, fetched once and kept: YouTube's biggest first, when it has one; then whatever the answer named
  const tries = [video.provider === 'youtube' ? allowedThumb(`https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`) : null, allowedThumb(answer.thumbnail_url)].filter((u): u is URL => !!u);
  let bytes: Buffer | null = null;
  for (const u of tries) if ((bytes = await picture(ask, u))) break;
  if (!bytes) return refuse(`${name} gave no picture for that video: try again in a moment, or upload the file instead.`);
  let poster: Awaited<ReturnType<typeof toMaster>>;
  try {
    poster = await toMaster(bytes);
  } catch (e) {
    return refuse(`${name}'s picture for that video couldn't be read (${(e as Error).message}): try again in a moment.`);
  }
  const folder = folderFor(req);
  const taken = new Set([...snap.masters, ...Object.keys(snap.docs)].filter((k) => k.startsWith(folder)).map((k) => k.slice(folder.length).replace(/(?:\.dark(?:\.poster)?|\.poster)?\.\w+$/, '')));
  const slug = slugify(title);
  const fileName = unique(slug === 'untitled' ? slugify(`${video.provider}-${video.id}`) : slug, taken);
  const sidecar: EmbedMedia = {
    kind: 'embed',
    provider: video.provider,
    id: video.id,
    title,
    ...(shape ? { shape } : {}),
    ...(Number.isFinite(duration) && duration > 0 ? { duration } : {}),
    poster: { file: `${fileName}.poster.webp` },
    visibility: 'public',
  };
  const mediaPath = `${folder.replace(/^\/(?:content|private)\/media\//, '')}${fileName}`;
  const parsed = embedMedia.safeParse(sidecar);
  if (!parsed.success) return { ok: false, status: 422, issues: parsed.error.issues.map((i) => ({ file: `content/media/${mediaPath}.json`, path: i.path.join('.'), message: i.message })) };
  const posterKey = `${folder}${fileName}.poster.webp`;
  const sidecarKey = `${folder}${fileName}.json`;
  const r = await commit({ changes: [{ key: posterKey, bytes: poster.bytes }, { key: sidecarKey, bytes: jsonBytes(sidecar) }], ifMatch: { [posterKey]: null, [sidecarKey]: null } });
  return r.ok ? { ok: true, versions: r.versions, id: mediaPath, existing: false, title } : r;
}
