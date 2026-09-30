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
import { getMedia } from './repository';
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
}

const webp = async (src: ImageMetadata, width: number) => (await getImage({ src, width, format: 'webp', quality: 80 })).src;

export async function picture(id: string, slot: Slot): Promise<Picture> {
  const m = getMedia(id);
  const meta = await metadata(m.master);
  const wanted = WIDTHS[slot];
  const widths = [...new Set([...wanted.filter((w) => w < meta.width), Math.min(meta.width, Math.max(...wanted))])].sort((a, b) => a - b);
  const urls = await Promise.all(widths.map((w) => webp(meta, w)));
  const [full, thumb] = await Promise.all([webp(meta, Math.min(meta.width, FULL)), webp(meta, Math.min(meta.width, THUMB))]);
  return {
    src: urls[Math.min(1, urls.length - 1)],
    srcset: widths.map((w, i) => `${urls[i]} ${w}w`).join(', '),
    alt: m.decorative ? '' : (m.alt ?? ''),
    width: meta.width,
    height: meta.height,
    full,
    thumb,
    focus: m.focus,
    caption: m.caption,
    credit: m.credit,
  };
}
