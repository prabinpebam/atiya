import { describe, expect, it } from 'vitest';
import { tooLong } from '../../src/site/editor/model/limits';
import { article } from '../../src/site/content/schema';
import { SEARCH_DESCRIPTION_MAX, SUMMARY_MAX, searchCopy } from '../../src/site/content/limits';

describe('edit mode: a field over its limit is caught before a save', () => {
  it('says how long the field is and how long it may be', () => {
    expect(SUMMARY_MAX).toBe(240);
    expect(tooLong('summary', 'x'.repeat(SUMMARY_MAX))).toBeNull();
    expect(tooLong('summary', 'x'.repeat(260))).toBe('The summary is 260 characters: keep it to 240.');
    expect(tooLong('seo.description', 'x'.repeat(161))).toBe('The search description is 161 characters: keep it to 160.');
    expect(tooLong('title', 'x'.repeat(400))).toBeNull();
  });

  it('holds the same limits as the content check', () => {
    const page = { id: 'a', type: 'article', kind: 'note', slug: 'a', title: 'A', status: 'draft', visibility: 'public', updatedAt: '2026-10-11', locale: 'en', body: [] };
    expect(article.safeParse({ ...page, summary: 'x'.repeat(SUMMARY_MAX) }).success).toBe(true);
    expect(article.safeParse({ ...page, summary: 'x'.repeat(SUMMARY_MAX + 1) }).success).toBe(false);
    expect(article.safeParse({ ...page, summary: 'S', seo: { description: 'x'.repeat(SEARCH_DESCRIPTION_MAX + 1) } }).success).toBe(false);
  });
});

describe('a summary as a search description', () => {
  it('is kept whole when it fits', () => {
    expect(searchCopy('  A short line,  kept as it is. ')).toBe('A short line, kept as it is.');
  });

  it('is cut at the last word that fits, with an ellipsis, never longer than 160', () => {
    const long = `${'word '.repeat(40)}end`;
    const cut = searchCopy(long);
    expect(cut.length).toBeLessThanOrEqual(SEARCH_DESCRIPTION_MAX);
    expect(cut).toMatch(/word…$/);
    // a run without spaces is cut where it must
    expect(searchCopy('x'.repeat(200))).toBe(`${'x'.repeat(159)}…`);
  });
});
