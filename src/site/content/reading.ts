/** How long an item takes to read, from its words (about 220 a minute, as long-form prose is read). */
import { plainText } from './markdown';
import type { Article } from './schema';

const WORDS_PER_MINUTE = 220;

export function wordCount(a: Article): number {
  const texts: string[] = [a.title, a.summary];
  for (const b of a.body) {
    if (b.type === 'text') texts.push(plainText(b.markdown));
    else if (b.type === 'heading' || b.type === 'quote') texts.push(b.text);
    else if (b.type === 'collection') texts.push(...b.items.map((i) => [i.when, i.heading, i.subtext, i.text && plainText(i.text)].filter(Boolean).join(' ')));
    else if (b.type === 'table') texts.push(b.caption ?? '', ...b.columns, ...b.rows.flat().map((c) => plainText(c)));
  }
  return texts.join(' ').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export const readingMinutes = (a: Article) => Math.max(1, Math.round(wordCount(a) / WORDS_PER_MINUTE));

/** How many pictures a page shows in its body (a Gallery's measure instead of reading time; each picture once). */
export function pictureCount(a: Article): number {
  const ids = new Set<string>();
  for (const b of a.body) {
    if (b.type === 'figure') ids.add(b.media);
    else if (b.type === 'gallery' || b.type === 'carousel') for (const i of b.items) ids.add(i.media);
    else if (b.type === 'collection') for (const i of b.items) if (i.media) ids.add(i.media);
  }
  return ids.size;
}

/**
 * A page's measure, by its kind (documentation/sections/spec.md §3.3): an article's reading time, a
 * gallery's number of pictures, and nothing for a page (About, Contact).
 */
export function pageMeasure(a: Article): string | undefined {
  if (a.kind === 'page') return undefined;
  if (a.kind === 'gallery') {
    const n = pictureCount(a);
    return `${n} ${n === 1 ? 'picture' : 'pictures'}`;
  }
  return `${readingMinutes(a)} min read`;
}
