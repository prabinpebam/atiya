/**
 * The media resolver's local strategy (documentation/content/media.md §5): a media ID and the layout slot
 * it's shown in become the props the design system's picture components take. astro:assets makes WebP
 * sizes at the slot's widths (never wider than the master), a full size for the lightbox and a filmstrip
 * thumbnail; the build caches them and names them by content hash.
 */
import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';
import { getMedia } from './repository';

const masters = import.meta.glob<{ default: ImageMetadata }>('/content/media/**/*.{webp,jpg,jpeg,png,avif}', { eager: true });

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
  const meta = masters[m.master]?.default;
  if (!meta) throw new Error(`media "${id}": its master ${m.master} isn't loaded`);
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
