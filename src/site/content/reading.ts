/** How long an item takes to read, from its words (about 220 a minute, as long-form prose is read). */
import { plainText } from './markdown';
import type { Article } from './schema';

const WORDS_PER_MINUTE = 220;

export function wordCount(a: Article): number {
  const texts: string[] = [a.title, a.summary];
  for (const b of a.body) {
    if (b.type === 'text') texts.push(plainText(b.markdown));
    else if (b.type === 'heading' || b.type === 'quote') texts.push(b.text);
    else if (b.type === 'facts') texts.push(...b.items.map((i) => `${i.label} ${i.value}`));
    else if (b.type === 'tiles') texts.push(...b.items.map((i) => `${i.label} ${plainText(i.text)}`));
  }
  return texts.join(' ').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export const readingMinutes = (a: Article) => Math.max(1, Math.round(wordCount(a) / WORDS_PER_MINUTE));
