/**
 * The media resolver's local strategy (documentation/content/media.md §5): a media ID and the layout slot
 * it's shown in become the props the design system's picture components take. astro:assets makes WebP
 * sizes at the slot's widths (never wider than the master), a full size for the lightbox and a filmstrip
 * thumbnail; the build caches them and names them by content hash.
 *
 * A build imports the masters (masters.ts). In dev a master's metadata is read with sharp and handed to
 * astro:assets in the shape an import gives, so a picture uploaded in the editor is used at once, and
 * no picture is a module whose change would reload every open page.
 */
import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';
import { readFileSync, statSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { getMedia, getVideo, videoHref } from './repository';
import { fileOf } from './source';

const devMeta = new Map<string, { mtime: number; meta: ImageMetadata }>();
const FORMAT: Record<string, string> = { jpeg: 'jpg', heif: 'avif' };

async function metadata(master: string): Promise<ImageMetadata> {
  if (!import.meta.env.DEV) {
    const { masters } = await import('./masters');
    const meta = masters[master]?.default;
    if (!meta) throw new Error(`the master ${master} isn't in the build`);
    return meta;
  }
  const abs = fileOf(master);
  const mtime = statSync(abs).mtimeMs;
  const hit = devMeta.get(abs);
  if (hit && hit.mtime === mtime) return hit.meta;
  const { default: sharp } = await import('sharp');
  // from the bytes, not the path: sharp keeps files it opened by path open, and Windows then refuses to
  // replace or delete them (the editor's Replace and Delete)
  const m = await sharp(readFileSync(abs)).metadata();
  const format = FORMAT[m.format ?? ''] ?? m.format ?? 'webp';
  const url = pathToFileURL(abs);
  url.searchParams.append('origWidth', String(m.width));
  url.searchParams.append('origHeight', String(m.height));
  url.searchParams.append('origFormat', format);
  // exactly what an import gives in dev (astro's emitImageMetadata)
  const src = '/@fs/' + (fileURLToPath(url) + url.search).replace(/\\/g, '/').replace(/^\//, '');
  const meta = { src, width: m.width!, height: m.height!, format } as ImageMetadata;
  Object.defineProperty(meta, 'fsPath', { enumerable: false, writable: false, value: abs.replace(/\\/g, '/') });
  devMeta.set(abs, { mtime, meta });
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
}

export interface Picture {
  src: string;
  srcset: string;
  alt: string;
  width: number;
  height: number;
  full: string;
  thumb: string;
  focus?: string;
  caption?: string;
  credit?: string;
  /** Its dark mode version, if it has one (documentation/content/media.md §10). */
  dark?: DarkPicture;
}

const webp = async (src: ImageMetadata, width: number) => (await getImage({ src, width, format: 'webp', quality: 80 })).src;

/** In a build, every file made from a private master goes in the provenance record, for the sealer (documentation/access/spec.md §6.2). */
async function record(master: string, urls: string[]) {
  if (!import.meta.env.PROD || !master.startsWith('/private/')) return;
  const { recordProvenance } = await import('./provenance');
  for (const url of new Set(urls)) recordProvenance({ kind: 'asset', url, master });
}

/** One master at a slot's widths: what the page needs to show it. */
async function sized(master: string, slot: Slot) {
  const meta = await metadata(master);
  const wanted = WIDTHS[slot];
  const widths = [...new Set([...wanted.filter((w) => w < meta.width), Math.min(meta.width, Math.max(...wanted))])].sort((a, b) => a - b);
  const urls = await Promise.all(widths.map((w) => webp(meta, w)));
  const [full, thumb] = await Promise.all([webp(meta, Math.min(meta.width, FULL)), webp(meta, Math.min(meta.width, THUMB))]);
  await record(master, [...urls, full, thumb]);
  return {
    src: urls[Math.min(1, urls.length - 1)],
    srcset: widths.map((w, i) => `${urls[i]} ${w}w`).join(', '),
    width: meta.width,
    height: meta.height,
    full,
    thumb,
  };
}

export async function picture(id: string, slot: Slot): Promise<Picture> {
  const m = getMedia(id);
  const [light, dark] = await Promise.all([sized(m.master, slot), m.darkMaster ? sized(m.darkMaster, slot) : undefined]);
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
