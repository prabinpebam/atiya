/**
 * The files adapter's reading half: every JSON file under content/ (the mock API) and the list of media
 * masters, through Vite's import.meta.glob, so the dev server reloads a page when its content changes.
 * The api adapter will replace this module with one that calls /v1 (documentation/content/api.md).
 */
export const docs = import.meta.glob('/content/**/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;

export const masters = new Set(Object.keys(import.meta.glob('/content/media/**/*.{webp,jpg,jpeg,png,avif}')));
