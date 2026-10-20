import { describe, expect, it } from 'vitest';
import { ContentError, loadContent, loadContentLeavingOut } from '../../src/site/content/load';

/**
 * One broken file never stops every page (documentation/content/spec.md §5.4): dev leaves out an article or a
 * piece of media that doesn't pass the check, with what only it causes, and says why; a build stays strict.
 */
const page = (id: string, extra: Record<string, unknown> = {}) => ({
  id, type: 'article', kind: 'note', slug: id, title: id.toUpperCase(), summary: 'S', status: 'published', visibility: 'public', updatedAt: '2026-10-20', locale: 'en',
  body: [{ type: 'text', markdown: 'One paragraph.' }],
  ...extra,
});
const base = {
  '/content/site.json': { name: 'N', description: 'D', owner: 'p', locale: 'en' },
  '/content/people/p.json': { id: 'p', name: 'P' },
  '/content/structures/site.json': {
    home: {
      id: 'home', kind: 'hub', slug: '', title: 'Home',
      children: [{ id: 'work', kind: 'hub', slug: 'work', title: 'Work', children: [{ id: 'a', kind: 'item', item: { type: 'article', id: 'a' } }, { id: 'b', kind: 'item', item: { type: 'article', id: 'b' } }] }],
    },
  },
  '/content/articles/a.json': page('a'),
  '/content/articles/b.json': page('b'),
};
// the morning's mistake: a text block holding two paragraphs
const broken = page('b', { body: [{ type: 'text', markdown: 'First paragraph.\n\nSecond paragraph.' }] });
const thrown = (f: () => unknown) => {
  try {
    f();
  } catch (e) {
    return e;
  }
  return null;
};

describe('one broken file never stops every page (dev)', () => {
  it('clean content: the same as the strict loader, with nothing left out', () => {
    const strict = loadContent(base, new Set());
    const lenient = loadContentLeavingOut(base, new Set());
    expect(lenient.problems).toEqual([]);
    expect([...lenient.articles.keys()]).toEqual([...strict.articles.keys()]);
    expect(lenient.canonical).toEqual(strict.canonical);
  });

  it('an article that fails its check is left out, the rest load, and its problem says why', () => {
    const docs = { ...base, '/content/articles/b.json': broken };
    // a build stops (nothing broken is published)
    expect(thrown(() => loadContent(docs, new Set()))).toBeInstanceOf(ContentError);
    const c = loadContentLeavingOut(docs, new Set());
    expect(c.articles.has('a')).toBe(true);
    expect(c.articles.has('b')).toBe(false);
    expect(c.canonical.get('article/a')).toBe('/work/a/');
    expect(c.problems).toHaveLength(1);
    expect(c.problems[0]).toMatchObject({ file: 'content/articles/b.json', path: 'body.0.markdown' });
    expect(c.problems[0].message).toMatch(/one paragraph or one list/);
  });

  it("an article that isn't even valid JSON is left out too, though the structure places it", () => {
    const { ['/content/articles/b.json']: _gone, ...docs } = base;
    const c = loadContentLeavingOut(docs, new Set(), ['content/articles/b.json: not valid JSON (Unexpected token)']);
    expect(c.articles.has('a')).toBe(true);
    expect(c.problems.map((p) => p.file)).toEqual(['content/articles/b.json']);
  });

  it('a broken picture is left out, and so is what only it breaks: the page that shows it', () => {
    const docs = {
      ...base,
      '/content/articles/b.json': page('b', { body: [{ type: 'figure', media: 'articles/b/pic' }] }),
      // its master is missing
      '/content/media/articles/b/pic.json': { kind: 'image', file: 'pic.webp', alt: 'A picture.', visibility: 'public' },
    };
    const c = loadContentLeavingOut(docs, new Set());
    expect(c.articles.has('a')).toBe(true);
    expect(c.articles.has('b')).toBe(false);
    expect(c.problems.map((p) => p.file).sort()).toEqual(['content/articles/b.json', 'content/media/articles/b/pic.json']);
  });

  it('a problem in the site itself still stops: its settings, its structure or its people', () => {
    const noOwner = { ...base, '/content/site.json': { name: 'N', description: 'D', owner: 'nobody', locale: 'en' } };
    expect(thrown(() => loadContentLeavingOut(noOwner, new Set()))).toBeInstanceOf(ContentError);
    const { ['/content/structures/site.json']: _s, ...noStructure } = base;
    expect(thrown(() => loadContentLeavingOut(noStructure, new Set()))).toBeInstanceOf(ContentError);
  });

  it("when the site itself is broken too, the error lists what was left out as well, so nothing's hidden", () => {
    const docs = { ...base, '/content/articles/b.json': broken, '/content/site.json': { name: 'N', description: 'D', owner: 'nobody', locale: 'en' } };
    const e = thrown(() => loadContentLeavingOut(docs, new Set())) as ContentError;
    expect(e).toBeInstanceOf(ContentError);
    expect(e.problems.join('\n')).toMatch(/content\/articles\/b\.json/);
    expect(e.problems.join('\n')).toMatch(/owner "nobody"/);
  });
});
