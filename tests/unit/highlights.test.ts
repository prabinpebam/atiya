import { describe, expect, it } from 'vitest';
import { ContentError, loadContent, loadContentLeavingOut, type ContentIndex } from '../../src/site/content/load';
import { checkHighlights, defaultHighlights, highlightCandidates, highlightMedia, highlightState, highlightsFile, HIGHLIGHT_MAX, visibleHighlights, type HighlightItem } from '../../src/site/content/highlights';
import { article, album } from '../../src/site/content/schema';

const pic = 'library/picture';
const page = (id: string) => ({ id, type: 'article', kind: 'note', slug: id, title: 'A shared direction', summary: 'We found a shared direction.', status: 'published', visibility: 'public', updatedAt: '2026-10-23', locale: 'en', hero: { media: pic }, body: [{ type: 'text', markdown: 'We **tried three** approaches together.' }] });
const docs = (): Record<string, unknown> => ({
  '/content/site.json': { name: 'A person', description: 'A site', owner: 'person', locale: 'en' },
  '/content/people/person.json': { id: 'person', name: 'A person' },
  '/content/structures/site.json': { home: { id: 'home', kind: 'hub', slug: '', title: 'A person', children: [{ id: 'work', kind: 'hub', slug: 'work', title: 'Work', children: [
    { id: 'page', kind: 'item', item: { type: 'article', id: 'page' } },
    { id: 'album', kind: 'item', item: { type: 'album', id: 'album' } },
  ] }] } },
  '/content/articles/page.json': page('page'),
  '/content/albums/album.json': { id: 'album', type: 'album', slug: 'album', title: 'A walk', status: 'draft', createdAt: '2026-10-23', updatedAt: '2026-10-23', items: [{ id: 'picture', media: pic }] },
  '/content/media/library/picture.json': { kind: 'image', file: 'picture.webp', alt: 'Trees beside a path', visibility: 'public' },
});
const masters = new Set(['/content/media/library/picture.webp']);
const picks: HighlightItem[] = [
  { id: 'github', type: 'custom', custom: 'github' },
  { id: 'page', type: 'article', article: 'page', text: 'tried three approaches' },
  { id: 'album', type: 'album', album: 'album' },
  { id: 'picture', type: 'image', media: pic },
];
const config = (items = picks) => ({ label: 'Highlights', enabled: true, peek: true, arrows: false, pager: 'filmstrip-wrap' as const, display: 'fit' as const, background: true, rounded: false, shadow: true, items });
const index = (): ContentIndex => {
  const d = docs();
  d['/content/highlights.json'] = config();
  return loadContent(d, masters);
};
const fails = (change: (d: Record<string, unknown>) => void) => {
  const d = docs(); d['/content/highlights.json'] = config();
  change(d);
  expect(() => loadContent(d, masters)).toThrow(ContentError);
};

describe('home highlights contract', () => {
  it('loads every kind, order and every shared article-carousel setting', () => {
    expect(index().highlights).toEqual(config());
    expect(checkHighlights(index())).toEqual([]);
  });
  it.each(['peek', 'arrows', 'background', 'rounded', 'shadow'])('refuses malformed %s', (name) => {
    expect(highlightsFile.safeParse({ ...config(), [name]: 'yes' }).success).toBe(false);
  });
  it('refuses unknown fields/custom renderers, invalid pager/display, long excerpts/labels', () => {
    for (const c of [
      { ...config(), html: '<script>' }, { ...config(), pager: 'none' }, { ...config(), display: 'stretch' },
      { ...config(), label: 'x'.repeat(81) }, { ...config(), items: [{ id: 'x', type: 'custom', custom: 'html' }] },
      { ...config(), items: [{ id: 'page', type: 'article', article: 'page', text: 'x'.repeat(281) }] },
    ]) expect(highlightsFile.safeParse(c).success).toBe(false);
  });
  it('rejects duplicates and the precise maximum; empty is valid', () => {
    expect(highlightsFile.safeParse(config([picks[0], picks[0]])).success).toBe(false);
    expect(highlightsFile.safeParse(config([picks[0], { ...picks[0], id: 'another' }])).success).toBe(false);
    const items: HighlightItem[] = Array.from({ length: HIGHLIGHT_MAX + 1 }, (_, n) => ({ id: `image-${n}`, type: 'image', media: `library/pic-${n}` }));
    expect(highlightsFile.safeParse(config(items.slice(0, HIGHLIGHT_MAX))).success).toBe(true);
    expect(highlightsFile.safeParse(config(items)).success).toBe(false);
    expect(highlightsFile.safeParse(config([])).success).toBe(true);
  });
  it('checks literal source text through Markdown and whitespace, not invented copy', () => {
    fails((d) => d['/content/highlights.json'] = config([{ id: 'page', type: 'article', article: 'page', text: 'Won a design award' }]));
    const c = index();
    expect(highlightState(c, picks[1]).text).toBe('tried three approaches');
    expect(highlightState(c, { id: 'page', type: 'article', article: 'page' }).text).toBe(page('page').summary);
  });
  it('rejects missing sources, even disabled, and public-to-private transitions', () => {
    for (const item of [
      { id: 'x', type: 'article', article: 'missing' },
      { id: 'x', type: 'album', album: 'missing' },
      { id: 'x', type: 'image', media: 'library/missing' },
    ]) fails((d) => d['/content/highlights.json'] = { ...config([item as HighlightItem]), enabled: false });
    fails((d) => { delete d['/content/articles/page.json']; d['/private/articles/page.json'] = page('page'); });
    fails((d) => d['/content/articles/page.json'] = { ...page('page'), visibility: 'privateDiscussionOnly' });
  });
  it('waits through draft/unplaced/no lead/cover, then returns at the same position', () => {
    const c = index();
    expect(highlightState(c, picks[1])).toMatchObject({ title: 'A shared direction', href: '/work/page/', media: pic });
    expect(highlightState(c, picks[2]).reason).toMatch(/Publish/);
    c.routes.find((r) => r.node.id === 'album')!.published = true;
    expect(highlightState(c, picks[2]).reason).toBeUndefined();
    c.routes = c.routes.filter((r) => r.node.id !== 'page');
    expect(highlightState(c, picks[1]).reason).toMatch(/Place/);
    c.articles.set('page', article.parse({ ...page('page'), hero: undefined }));
    c.routes.push({ path: '/work/page/', node: { id: 'page', kind: 'item', item: { type: 'article', id: 'page' } }, ancestors: [], title: 'A shared direction', label: 'A page', published: true, access: 'open' });
    expect(highlightState(c, picks[1]).reason).toMatch(/lead picture/);
    c.albums.set('album', album.parse({ ...c.albums.get('album'), items: [] }));
    expect(highlightState(c, picks[2]).reason).toMatch(/cover picture/);
    expect(c.highlights!.items.map((i) => i.id)).toEqual(picks.map((i) => i.id));
  });
  it('shows only the slides that are ready, in order, and none while turned off', () => {
    const c = index();
    // no GitHub snapshot and a draft album: those two wait, the page and the picture show
    expect(visibleHighlights(c).map((s) => s.item.id)).toEqual(['page', 'picture']);
    expect(visibleHighlights(c).every((s) => !s.state.reason)).toBe(true);
    c.highlights = { ...c.highlights!, enabled: false };
    expect(visibleHighlights(c)).toEqual([]);
  });
  it('does not offer private/unpublishable media or private pages/albums', () => {
    const c = index();
    c.origins.set('page', 'private'); c.origins.set('album', 'private');
    c.media.get(pic)!.origin = 'private';
    expect(highlightCandidates(c)).toEqual([]);
    expect(checkHighlights(c)).toHaveLength(3);
    expect(highlightState(c, picks[1]).title).toBe('Unavailable source');
  });
  it('counts direct and derived image uses once', () => {
    expect(highlightMedia(index())).toEqual([pic]);
  });
  it('requires alt text for a highlighted library image and reports a broken configuration without stopping every dev page', () => {
    const d = docs();
    d['/content/highlights.json'] = config([picks[3]]);
    delete d['/content/articles/page.json'];
    d['/content/structures/site.json'] = { home: { id: 'home', kind: 'hub', slug: '', title: 'A person' } };
    delete d['/content/albums/album.json'];
    d['/content/media/library/picture.json'] = { kind: 'image', file: 'picture.webp', visibility: 'public' };
    expect(() => loadContent(d, masters)).toThrow(/needs alt text/);
    const recovered = loadContentLeavingOut(d, masters);
    expect(recovered.highlights).toBeUndefined();
    expect(recovered.problems.some((p) => p.file.endsWith('highlights.json'))).toBe(true);
  });
  it('preserves absent-file compatibility but never restores intentionally empty picks', () => {
    const c = loadContent(docs(), masters);
    expect(defaultHighlights(c).items).toEqual([]);
    c.github = { login: 'octocat', fetchedAt: '', through: '', days: [] };
    expect(defaultHighlights(c).items).toEqual([picks[0]]);
    c.highlights = config([]);
    expect(defaultHighlights(c).items).toEqual([]);
    expect(highlightState(c, picks[0]).reason).toBeUndefined();
  });
});
