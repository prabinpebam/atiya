/**
 * The media masters as imports, for a build: importing them is what makes astro:assets emit and hash
 * them. Only a build loads this module (pictures.ts), so in dev an uploaded picture is never a module
 * and adding one reloads nothing (documentation/editor/spec.md §8.3).
 */
import type { ImageMetadata } from 'astro';

export const masters = import.meta.glob<{ default: ImageMetadata }>('/content/media/**/*.{webp,jpg,jpeg,png,avif}', { eager: true });
