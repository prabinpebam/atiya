/**
 * The media resolver's local strategy (documentation/content/media.md §5): a media ID and the layout slot
 * it's shown in become the props the design system's picture components take. astro:assets makes WebP
 * sizes at the slot's widths (never wider than the master), a full size for the lightbox and a filmstrip
 * thumbnail; the build caches them and names them by content hash.
 *
 * A build imports the masters (masters.ts). In dev a master's metadata is read with sharp and handed to
 * astro:assets in the shape an import gives, so a picture uploaded in the editor is used at once, and
 * no picture is a module whose change would reload every open page. A master's size and background are
 * kept (pictureFacts.ts), and in dev so is each picture worked out, until its master changes.
 */
import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';
import { statSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { getMedia, getVideo, videoHref } from './repository';
import { fileOf } from './source';
import { pictureFacts, type SidecarFacts } from './pictureFacts';
import { timedAsync } from './timing';

const devMeta = new Map<string, { mtime: number; size: number; meta: ImageMetadata }>();

async function metadata(master: string, kept?: SidecarFacts): Promise<ImageMetadata> {
  if (!import.meta.env.DEV) {
    const { masters } = await import('./masters');
    const meta = masters[master]?.default;
    if (!meta) throw new Error(`the master ${master} isn't in the build`);
    return meta;
  }
  const abs = fileOf(master);
  const st = statSync(abs);
  const hit = devMeta.get(abs);
  if (hit && hit.mtime === st.mtimeMs && hit.size === st.size) return hit.meta;
  // its size and format: kept in its sidecar or the facts cache, else read from its bytes (pictureFacts.ts)
  const m = await pictureFacts(master, kept);
  const url = pathToFileURL(abs);
  url.searchParams.append('origWidth', String(m.width));
  url.searchParams.append('origHeight', String(m.height));
  url.searchParams.append('origFormat', m.format);
  // exactly what an import gives in dev (astro's emitImageMetadata)
  const src = '/@fs/' + (fileURLToPath(url) + url.search).replace(/\\/g, '/').replace(/^\//, '');
  const meta = { src, width: m.width, height: m.height, format: m.format } as ImageMetadata;
  Object.defineProperty(meta, 'fsPath', { enumerable: false, writable: false, value: abs.replace(/\\/g, '/') });
  devMeta.set(abs, { mtime: st.mtimeMs, size: st.size, meta });
  return meta;
}

export type Slot = 'content' | 'popout' | 'wide' | 'full' | 'gallery' | 'card';

const WIDTHS: Record<Slot, number[]> = {
  content: [480, 720, 960, 1440],
  popout: [480, 960, 1440],
  wide: [960, 1600, 2400],
  full: [960, 1600, 2560],
  gallery: [480, 960, 1440],
  card: [240, 480, 960],
};
const FULL = 2560;
const THUMB = 240;

/** A picture's dark mode version, at the same widths: shown instead when the page is dark. */
export interface DarkPicture {
  src: string;
  srcset: string;
  width: number;
  height: number;
  full: string;
  thumb: string;
  /** A still first frame shown when the reader asks for less motion. */
  poster?: string;
  /** The colour of its edges, for a background behind it (media.md §9.1). */
  bg: string;
}

export interface Picture {
  src: string;
  srcset: string;
  alt: string;
  width: number;
  height: number;
  full: string;
  thumb: string;
  /** A still first frame shown when the reader asks for less motion. */
  poster?: string;
  focus?: string;
  caption?: string;
  credit?: string;
  /** The colour of its edges (or, where they're transparent, its dominant colour): the automatic background behind it, when a page asks for one (media.md §9.1). */
  bg: string;
  /** Its dark mode version, if it has one (documentation/content/media.md §10). */
  dark?: DarkPicture;
}

const webp = async (src: ImageMetadata, width: number) => (await timedAsync('picture.url', () => getImage({ src, width, format: 'webp', quality: 80 }))).src;

/**
 * A master's automatic background colour: the average of its opaque edge pixels (so the space round a
 * fitted picture continues its edges), or its dominant colour where the edges are transparent. Kept in its
 * sidecar or the facts cache, else read once per master (and again when it changes), from its bytes.
 */
const edgeColour = async (master: string, kept?: SidecarFacts) => (await pictureFacts(master, kept)).bg;

/**
 * In a build, every file made from a private master goes in the provenance record, for the sealer
 * (documentation/access/spec.md §6.2); so does every file made from a public one, so a file both make (the
 * same picture in a public and a private page) stays readable for the public page.
 */
async function record(master: string, urls: string[]) {
  if (!import.meta.env.PROD) return;
  const { recordProvenance } = await import('./provenance');
  const isPrivate = master.startsWith('/private/');
  for (const url of new Set(urls)) recordProvenance(isPrivate ? { kind: 'asset', url, master } : { kind: 'public-asset', url });
}

/** What one master at a slot gives the page. */
interface Sized {
  src: string;
  srcset: string;
  width: number;
  height: number;
  full: string;
  thumb: string;
  poster?: string;
  bg: string;
}

/** One master at a slot's widths, worked out: what the page needs to show it, and every file it names. */
async function work(master: string, slot: Slot, posterMaster?: string, kept?: SidecarFacts): Promise<{ value: Sized; urls: string[] }> {
  const meta = await metadata(master, kept);
  if (posterMaster) {
    const posterMeta = await metadata(posterMaster);
    const [poster, thumb, bg] = await Promise.all([webp(posterMeta, Math.min(posterMeta.width, 1600)), webp(posterMeta, Math.min(posterMeta.width, THUMB)), edgeColour(master, kept)]);
    return { value: { src: meta.src, srcset: '', width: meta.width, height: meta.height, full: meta.src, thumb, poster, bg }, urls: [meta.src, poster, thumb] };
  }
  if (/\.gif$/i.test(master)) {
    const bg = await edgeColour(master, kept);
    return { value: { src: meta.src, srcset: '', width: meta.width, height: meta.height, full: meta.src, thumb: meta.src, bg }, urls: [meta.src] };
  }
  const wanted = WIDTHS[slot];
  const widths = [...new Set([...wanted.filter((w) => w < meta.width), Math.min(meta.width, Math.max(...wanted))])].sort((a, b) => a - b);
  const urls = await Promise.all(widths.map((w) => webp(meta, w)));
  const [full, thumb, bg] = await Promise.all([webp(meta, Math.min(meta.width, FULL)), webp(meta, Math.min(meta.width, THUMB)), edgeColour(master, kept)]);
  return {
    value: {
      src: urls[Math.min(1, urls.length - 1)],
      srcset: widths.map((w, i) => `${urls[i]} ${w}w`).join(', '),
      width: meta.width,
      height: meta.height,
      full,
      thumb,
      bg,
    },
    urls: [...urls, full, thumb],
  };
}

/**
 * Pictures worked out in dev, kept (documentation/engineering/performance-report.md R7): by master and
 * poster (each with its size and time, so a replaced master is worked out again), slot and these rules.
 * On globalThis, so a module reloaded by HMR keeps them; at most MEMO_MAX, the oldest used dropped first.
 */
const MEMO_RULES = JSON.stringify([WIDTHS, FULL, THUMB]);
const MEMO_MAX = 4000;
type Memo = Map<string, Promise<{ value: Sized; urls: string[] }>>;
const memo = (): Memo => ((globalThis as typeof globalThis & { __sitePictureMemo?: Memo }).__sitePictureMemo ??= new Map());

const stamp = (master: string) => {
  const st = statSync(fileOf(master));
  return `${master}@${st.size}:${st.mtimeMs}`;
};

/** The key a picture is kept by: its master's and poster's paths, sizes and times, the slot and the rules. */
export function pictureMemoKey(master: string, slot: Slot, posterMaster?: string): string {
  return `${MEMO_RULES}|${slot}|${stamp(master)}|${posterMaster ? stamp(posterMaster) : ''}`;
}

/** One master at a slot's widths: what the page needs to show it. An animation, or a GIF (kept as it is, never converted), is shown as its master. */
async function sized(master: string, slot: Slot, posterMaster?: string, kept?: SidecarFacts): Promise<Sized> {
  if (!import.meta.env.DEV) {
    const { value, urls } = await work(master, slot, posterMaster, kept);
    await record(master, urls);
    return value;
  }
  const cache = memo();
  const key = pictureMemoKey(master, slot, posterMaster);
  let p = cache.get(key);
  if (p) {
    // used again: the newest
    cache.delete(key);
    cache.set(key, p);
  } else {
    p = work(master, slot, posterMaster, kept);
    cache.set(key, p);
    p.catch(() => cache.delete(key));
    while (cache.size > MEMO_MAX) cache.delete(cache.keys().next().value!);
  }
  return { ...(await p).value };
}

export async function picture(id: string, slot: Slot): Promise<Picture> {
  const m = getMedia(id);
  const [light, dark] = await Promise.all([sized(m.master, slot, m.posterMaster, m.facts), m.darkMaster ? sized(m.darkMaster, slot, m.darkPosterMaster, m.dark?.facts) : undefined]);
  return {
    ...light,
    alt: m.decorative ? '' : (m.alt ?? ''),
    focus: m.focus,
    caption: m.caption,
    credit: m.credit,
    ...(dark ? { dark } : {}),
  };
}

/** A video file as the page shows it (media.md §12): its address and type, its size, its words and its poster at the slot's widths. */
export interface VideoFile {
  src: string;
  type: 'video/mp4' | 'video/webm';
  width: number;
  height: number;
  title: string;
  duration?: number;
  caption?: string;
  credit?: string;
  /** Its poster (a frame from it), if it has one. */
  poster?: { src: string; srcset: string; width: number; height: number; thumb: string };
}

export async function video(id: string, slot: Slot): Promise<VideoFile> {
  const v = getVideo(id);
  const poster = v.posterMaster ? await sized(v.posterMaster, slot) : undefined;
  return {
    src: videoHref(id),
    type: v.file.endsWith('.webm') ? 'video/webm' : 'video/mp4',
    width: v.width,
    height: v.height,
    title: v.title,
    ...(v.duration ? { duration: v.duration } : {}),
    ...(v.caption ? { caption: v.caption } : {}),
    ...(v.credit ? { credit: v.credit } : {}),
    ...(poster ? { poster: { src: poster.src, srcset: poster.srcset, width: poster.width, height: poster.height, thumb: poster.thumb } } : {}),
  };
}
