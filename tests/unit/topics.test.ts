import { describe, expect, it } from 'vitest';
import { TOPIC_TAGS_SHOWN, topicLabel, topicPages, topicPath, topicTags } from '../../src/site/content/topics';

const vocab = {
  topics: [
    { id: 'leadership', label: 'Leadership' },
    { id: 'ai', label: 'AI', synonyms: ['artificial intelligence'] },
    { id: 'side-project', label: 'Side project' },
    { id: 'craft', label: 'Craft' },
    { id: 'storytelling', label: 'Storytelling' },
  ],
};

describe('topics (sections spec §3.8)', () => {
  it('labels a topic from the vocabulary, else from its ID', () => {
    expect(topicLabel('ai', vocab)).toBe('AI');
    expect(topicLabel('team-culture', vocab)).toBe('Team culture');
    expect(topicLabel('craft', null)).toBe('Craft');
  });

  it('gives each topic in use its pages, newest first, the busiest topics first', () => {
    const pages = topicPages(vocab, [
      { id: 'a', topics: ['leadership', 'ai'], publishedAt: '2026-01-01' },
      { id: 'b', topics: ['ai'], publishedAt: '2026-03-01' },
      { id: 'c', topics: ['craft', 'craft'], publishedAt: '2026-02-01' },
      { id: 'd' },
    ]);
    expect(pages.map((p) => p.id)).toEqual(['ai', 'craft', 'leadership']);
    expect(pages[0]).toEqual({ id: 'ai', label: 'AI', path: '/topics/ai/', pages: ['b', 'a'] });
    expect(pages[1]!.pages).toEqual(['c']);
    expect(topicPath('ai')).toBe('/topics/ai/');
  });

  it('never makes a page for a topic no page has', () => {
    expect(topicPages(vocab, [{ id: 'a', topics: [] }])).toEqual([]);
  });

  it('shows a page’s first topics in its own order, linked where the topic has a page', () => {
    const pages = topicPages(vocab, [{ id: 'a', topics: ['ai', 'craft'] }]);
    const tags = topicTags(['craft', 'storytelling', 'ai', 'leadership'], vocab, pages, { href: (p) => `/atiya${p}` });
    expect(tags).toEqual([
      { id: 'craft', label: 'Craft', href: '/atiya/topics/craft/' },
      { id: 'storytelling', label: 'Storytelling' },
      { id: 'ai', label: 'AI', href: '/atiya/topics/ai/' },
    ]);
    expect(tags).toHaveLength(TOPIC_TAGS_SHOWN);
  });

  it('leaves out a topic that only repeats the section, by its label, ID or a synonym, singular or plural', () => {
    const pages = topicPages(vocab, [{ id: 'a', topics: ['side-project', 'ai'] }]);
    expect(topicTags(['side-project', 'ai'], vocab, pages, { omit: ['Side projects'] }).map((t) => t.id)).toEqual(['ai']);
    expect(topicTags(['leadership', 'ai'], vocab, pages, { omit: ['Leadership'] }).map((t) => t.id)).toEqual(['ai']);
    expect(topicTags(['ai'], vocab, pages, { omit: ['Artificial intelligence'] })).toEqual([]);
  });

  it('links nothing without an href (the planet, where a page can’t leave its building)', () => {
    const pages = topicPages(vocab, [{ id: 'a', topics: ['ai'] }]);
    expect(topicTags(['ai'], vocab, pages)).toEqual([{ id: 'ai', label: 'AI' }]);
  });
});
