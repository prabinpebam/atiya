/**
 * Related stories at the end of a page (documentation/sections/spec.md §3.7): the ranking (the author's
 * picks, shared topics weighted by rarity, the same section, the newest), what a reader is shown (the
 * ones not read yet first), the visits remembered, and the real content's suggestions.
 */
import { describe, expect, it } from 'vitest';
import { MAX_VISITS, isStory, parseVisits, pickToShow, rankRelated, recordVisit, type RelatedCandidate } from '../../src/site/scripts/related';
import { content } from '../../src/site/content/repository';

const story = (id: string, over: Partial<RelatedCandidate> = {}): RelatedCandidate => ({ id, kind: 'note', topics: [], publishedAt: '2026-01-01', ...over });

describe('ranking related stories', () => {
  const all = [
    story('a', { topics: ['side-project', 'figma-plugin', 'liquid-glass'], section: 'side' }),
    story('b', { topics: ['side-project', 'liquid-glass', 'web'], section: 'side' }),
    story('c', { topics: ['side-project', 'figma-plugin', 'ai'], section: 'side' }),
    story('d', { topics: ['side-project', 'ai'], section: 'side', publishedAt: '2026-09-01' }),
    story('e', { topics: ['leadership'], section: 'lead', publishedAt: '2026-10-01' }),
    story('r', { kind: 'page', topics: ['side-project', 'liquid-glass'], section: 'side' }),
  ];

  it('puts the stories that share the rarer topics first, then the section, then the newest; never itself, never a plain page', () => {
    const ranked = rankRelated(all[0], all);
    expect(ranked[0]).toBe('b'); // liquid-glass: shared with one other
    expect(ranked[1]).toBe('c'); // figma-plugin
    expect(ranked.slice(2)).toEqual(['d', 'e']); // only side-project in common (and the section), then the newest elsewhere
    expect(ranked).not.toContain('a');
    expect(ranked).not.toContain('r');
    expect([isStory({ kind: 'note' }), isStory({ kind: 'talk' }), isStory({ kind: 'gallery' }), isStory({ kind: 'page' })]).toEqual([true, true, true, false]);
  });

  it("puts the author's own picks first, in their order, and keeps to the maximum", () => {
    expect(rankRelated({ ...all[0], related: ['e', 'nope', 'd'] }, all).slice(0, 3)).toEqual(['e', 'd', 'b']);
    expect(rankRelated(all[0], all, 2)).toHaveLength(2);
  });

  it('with nothing in common, the same section comes before the newest elsewhere', () => {
    const plain = [story('x', { section: 's' }), story('y', { section: 's' }), story('z', { section: 't', publishedAt: '2026-12-01' })];
    expect(rankRelated(plain[0], plain)).toEqual(['y', 'z']);
  });
});

describe("what a reader is shown", () => {
  it("shows the best ones not read yet; when it runs short, the ones read longest ago", () => {
    const ranked = ['b', 'c', 'd', 'e'];
    expect(pickToShow(ranked, {})).toEqual(['b', 'c', 'd']);
    expect(pickToShow(ranked, { b: 100 })).toEqual(['c', 'd', 'e']);
    expect(pickToShow(ranked, { b: 300, c: 100, d: 200, e: 400 })).toEqual(['c', 'd', 'b']);
    expect(pickToShow(ranked, { c: 50, e: 10 }, 3)).toEqual(['b', 'd', 'e']);
  });

  it('remembers visits, up to a limit, dropping the oldest, and reads only well-formed ones back', () => {
    expect(recordVisit({ a: 1 }, 'b', 2)).toEqual({ a: 1, b: 2 });
    expect(recordVisit({ a: 1 }, 'a', 5)).toEqual({ a: 5 });
    const full = Object.fromEntries(Array.from({ length: MAX_VISITS }, (_, i) => [`s${i}`, i + 1]));
    const next = recordVisit(full, 'new', 10_000);
    expect(Object.keys(next)).toHaveLength(MAX_VISITS);
    expect(next.s0).toBeUndefined();
    expect(next.new).toBe(10_000);
    expect(parseVisits('{"a":1,"B":2,"c":"x","d":3}')).toEqual({ a: 1, d: 3 });
    expect([parseVisits(null), parseVisits('nope'), parseVisits('[1]')]).toEqual([{}, {}, {}]);
  });
});

describe('the real content', () => {
  const c = content();
  const stories = [...c.articles.values()].filter((a) => isStory(a) && c.canonical.has(`article/${a.id}`));
  const pool = stories.map((a) => ({ id: a.id, kind: a.kind, topics: a.topics, publishedAt: a.publishedAt }));

  it('every published story has others to suggest, and the two liquid glass pieces suggest each other near the top', () => {
    for (const a of stories) expect(rankRelated({ id: a.id, kind: a.kind, topics: a.topics }, pool).length, a.id).toBeGreaterThan(0);
    if (c.articles.has('liquid-glass-pro') && c.articles.has('liquid-glass-for-web')) {
      const of = (id: string) => rankRelated({ id, kind: 'note', topics: c.articles.get(id)!.topics }, pool).slice(0, 2);
      expect(of('liquid-glass-pro')).toContain('liquid-glass-for-web');
      expect(of('liquid-glass-for-web')).toContain('liquid-glass-pro');
    }
  });
});
