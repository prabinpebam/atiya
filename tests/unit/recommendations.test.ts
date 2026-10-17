/**
 * Recommendations (documentation/sections/recommendations.md, DoD R1, R4, R5): the rules the page and edit mode
 * share, and the content contract's checks of the list and of a section's settings.
 */
import { describe, expect, it } from 'vitest';
import { ContentError, loadContent } from '../../src/site/content/load';
import { bandPlace, initials, linkLabel, monthLabel, moveRecommendation, opensInline, paragraphs, recommendationIdFor, visibleRecommendations, type Recommendation } from '../../src/site/content/recommendations';

const rec = (over: Partial<Recommendation> = {}): Recommendation => ({ id: 'ada-lovelace', name: 'Ada Lovelace', title: 'Principal Engineer, Engines', text: 'Words.', ...over });

describe('the rules', () => {
  it('names a link: LinkedIn by name, any other site by its host', () => {
    expect(linkLabel('https://www.linkedin.com/in/someone/')).toBe('LinkedIn profile');
    expect(linkLabel('https://in.linkedin.com/in/someone')).toBe('LinkedIn profile');
    expect(linkLabel('https://www.ada.dev/about')).toBe('ada.dev');
    expect(linkLabel('not a url')).toBe('Profile');
  });

  it('initials, months, paragraphs and IDs', () => {
    expect(initials('Ada Lovelace')).toBe('AL');
    expect(initials('  ada   king  lovelace ')).toBe('AK');
    expect(initials('Ōno')).toBe('Ō');
    expect(monthLabel('2025-03')).toBe('March 2025');
    expect(paragraphs('One\r\n\r\nTwo\n  \nThree\nstill three')).toEqual(['One', 'Two', 'Three\nstill three']);
    expect(recommendationIdFor('Ada Lovelace', [])).toBe('ada-lovelace');
    expect(recommendationIdFor('Ada Lovelace', ['ada-lovelace'])).toBe('ada-lovelace-2');
    expect(recommendationIdFor('!!!', [])).toBe('recommendation');
  });

  it('tiles and the spotlight always open a dialog; rows and the wall can expand in place', () => {
    expect(opensInline('tiles', 'inline')).toBe(false);
    expect(opensInline('spotlight', 'inline')).toBe(false);
    expect(opensInline('rows', 'inline')).toBe(true);
    expect(opensInline('wall', 'inline')).toBe(true);
    expect(opensInline('wall', 'dialog')).toBe(false);
  });

  it('places the band, hides the hidden, and moves one up or down', () => {
    expect(bandPlace({ show: true, at: 'start', layout: 'tiles', open: 'dialog' }, ['a'])).toEqual({ at: 'start' });
    expect(bandPlace({ show: true, at: 'after', after: 'a', layout: 'tiles', open: 'dialog' }, ['a', 'b'])).toEqual({ after: 'a' });
    expect(bandPlace({ show: true, at: 'after', after: 'gone', layout: 'tiles', open: 'dialog' }, ['a'])).toEqual({ at: 'end' });
    expect(visibleRecommendations([rec(), rec({ id: 'b', hidden: true })]).map((r) => r.id)).toEqual(['ada-lovelace']);
    const list = [rec({ id: 'a' }), rec({ id: 'b' }), rec({ id: 'c' })];
    expect(moveRecommendation(list, 'b', -1).map((r) => r.id)).toEqual(['b', 'a', 'c']);
    expect(moveRecommendation(list, 'c', 1).map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('the contract', () => {
  const structure = (settings: unknown) => ({
    home: {
      id: 'home',
      kind: 'hub',
      slug: '',
      title: 'Home',
      children: [{ id: 'about', kind: 'hub', slug: 'about', title: 'About', recommendations: settings, children: [{ id: 'career', kind: 'item', item: { type: 'article', id: 'career' } }] }],
    },
  });
  const article = { id: 'career', type: 'article', kind: 'note', slug: 'career', title: 'Career', summary: 'S', status: 'published', visibility: 'public', updatedAt: '2026-09-29', locale: 'en', body: [] };
  const docs = (settings: unknown, items: unknown[] = [rec()]) => ({
    '/content/site.json': { name: 'N', description: 'D', owner: 'p', locale: 'en' },
    '/content/people/p.json': { id: 'p', name: 'P' },
    '/content/structures/site.json': structure(settings),
    '/content/articles/career.json': article,
    '/content/recommendations.json': { items },
  });
  const problems = (d: Record<string, unknown>) => {
    try {
      loadContent(d, new Set());
      return [];
    } catch (e) {
      return (e as ContentError).problems;
    }
  };

  it('loads the list and a section’s settings', () => {
    const c = loadContent(docs({ show: true, at: 'after', after: 'career', layout: 'wall', open: 'inline', heading: 'What people say' }), new Set());
    expect(c.recommendations.map((r) => r.id)).toEqual(['ada-lovelace']);
    const about = c.structure.home.children?.[0];
    expect(about?.kind === 'hub' && about.recommendations?.layout).toBe('wall');
  });

  it('refuses a missing name or words, a link that isn’t https, a date that isn’t a month, words too long, and an ID twice', () => {
    const p = problems(docs(undefined, [rec({ name: '' }), rec({ id: 'b', link: 'http://example.com' }), rec({ id: 'c', date: '2025-13' }), rec({ id: 'd', text: 'x'.repeat(3001) })]));
    expect(p.some((x) => /items\.0\.name/.test(x))).toBe(true);
    expect(p.some((x) => /items\.1\.link/.test(x))).toBe(true);
    expect(p.some((x) => /items\.2\.date/.test(x))).toBe(true);
    expect(p.some((x) => /items\.3\.text/.test(x))).toBe(true);
    expect(problems(docs(undefined, [rec({ id: 'd' }), rec({ id: 'd' })]))).toEqual([expect.stringMatching(/"d" is listed twice/)]);
  });

  it('a section’s recommendations follow one of its own pages, named', () => {
    expect(problems(docs({ show: true, at: 'after', layout: 'tiles', open: 'dialog' }))).toEqual([expect.stringMatching(/doesn't say which/)]);
    expect(problems(docs({ show: true, at: 'after', after: 'elsewhere', layout: 'tiles', open: 'dialog' }))).toEqual([expect.stringMatching(/isn't one of its pages/)]);
    expect(problems(docs({ show: true, at: 'middle', layout: 'tiles', open: 'dialog' })).length).toBeGreaterThan(0);
  });
});
