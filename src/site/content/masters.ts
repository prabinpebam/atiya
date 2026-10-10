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

const publicMasters: Masters = import.meta.glob<{ default: ImageMetadata }>('/content/media/**/*.{webp,jpg,jpeg,png,avif,gif}', { eager: true });
const privateMasters: Masters = import.meta.glob<{ default: ImageMetadata }>('@private-pages/media/**/*.{webp,jpg,jpeg,png,avif,gif}', { eager: true });

/** A private master's key, whatever form the glob gives it (the alias, or the folder's path). */
const privateKey = (key: string) => '/private/media/' + key.replace(/\\/g, '/').replace(/^.*?\/media\//, '');

export const masters: Masters = {
  ...publicMasters,
  ...Object.fromEntries(Object.entries(privateMasters).map(([k, v]) => [privateKey(k), v])),
};
