import { describe, expect, it } from 'vitest';
import { tooLong } from '../../src/site/editor/model/limits';
import { article } from '../../src/site/content/schema';
import { SUMMARY_MAX } from '../../src/site/content/limits';

describe('edit mode: a field over its limit is caught before a save', () => {
  it('says how long the summary is and how long it may be', () => {
    expect(tooLong('summary', 'x'.repeat(SUMMARY_MAX))).toBeNull();
    expect(tooLong('summary', 'x'.repeat(172))).toBe('The summary is 172 characters: keep it to 160.');
    expect(tooLong('seo.description', 'x'.repeat(161))).toBe('The search description is 161 characters: keep it to 160.');
    expect(tooLong('title', 'x'.repeat(400))).toBeNull();
  });

  it('holds the same limit as the content check', () => {
    const page = { id: 'a', type: 'article', kind: 'note', slug: 'a', title: 'A', status: 'draft', visibility: 'public', updatedAt: '2026-10-11', locale: 'en', body: [] };
    expect(article.safeParse({ ...page, summary: 'x'.repeat(SUMMARY_MAX) }).success).toBe(true);
    expect(article.safeParse({ ...page, summary: 'x'.repeat(SUMMARY_MAX + 1) }).success).toBe(false);
  });
});
