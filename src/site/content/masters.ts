/**
 * The media masters as imports, for a build: importing them is what makes astro:assets emit and hash
 * them. Only a build loads this module (pictures.ts), so in dev an uploaded picture is never a module
 * and adding one reloads nothing (documentation/editor/spec.md §8.3).
 *
 * Both folders' masters, keyed as the content source keys them: `/content/media/…`, and `/private/media/…`
 * for private-pages/ (or the fixtures, in a test build), which the editor integration aliases as
 * `@private-pages` (documentation/access/spec.md §3).
 */
import type { ImageMetadata } from 'astro';

type Masters = Record<string, { default: ImageMetadata }>;

// a drawing (.svg) is imported too: astro:assets emits it as it is, under a content-hashed name (gallery spec §4.1)
const publicMasters: Masters = import.meta.glob<{ default: ImageMetadata }>('/content/media/**/*.{webp,jpg,jpeg,png,avif,gif,svg}', { eager: true });
const privateMasters: Masters = import.meta.glob<{ default: ImageMetadata }>('@private-pages/media/**/*.{webp,jpg,jpeg,png,avif,gif,svg}', { eager: true });
// a test build's public overlay (src/site/content/overlay.ts): its masters are keyed as the content's; elsewhere the alias is a folder that doesn't exist
const overlayMasters: Masters = import.meta.glob<{ default: ImageMetadata }>('@content-overlay/media/**/*.{webp,jpg,jpeg,png,avif,gif,svg}', { eager: true });

/** A private master's key, whatever form the glob gives it (the alias, or the folder's path). */
const privateKey = (key: string) => '/private/media/' + key.replace(/\\/g, '/').replace(/^.*?\/media\//, '');
/** An overlay master's key, as the content source keys it. */
const overlayKey = (key: string) => '/content/media/' + key.replace(/\\/g, '/').replace(/^.*?\/media\//, '');

export const masters: Masters = {
  ...Object.fromEntries(Object.entries(overlayMasters).map(([k, v]) => [overlayKey(k), v])),
  ...publicMasters,
  ...Object.fromEntries(Object.entries(privateMasters).map(([k, v]) => [privateKey(k), v])),
};
