/**
 * The content platform's first slice (documentation/content/plan.md): the Markdown subset, the routes
 * the site structure gives, the loader's checks, and the real content/ folder, which must validate and
 * keep its media within budget (documentation/content/media.md §4).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import sharp from 'sharp';
import { plainText, renderMarkdown } from '../../src/site/content/markdown';
import { buildRoutes } from '../../src/site/content/routes';
import { ContentError, headingId, loadContent, mediaUsed } from '../../src/site/content/load';
import { content } from '../../src/site/content/repository';
import { readingMinutes } from '../../src/site/content/reading';
import type { SiteStructure } from '../../src/site/content/schema';

const ROOT = join(__dirname, '../..');
const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
const key = (f: string) => '/' + relative(ROOT, f).split(sep).join('/');

describe('the Markdown subset', () => {
  it('paragraphs, strong, emphasis, code and lists', () => {
    expect(renderMarkdown('One **two** *three* `four`.\n\nNext.')).toBe('<p>One <strong>two</strong> <em>three</em> <code>four</code>.</p>\n<p>Next.</p>');
    expect(renderMarkdown('- a\n- b')).toBe('<ul><li>a</li><li>b</li></ul>');
    expect(renderMarkdown('1. a\n2. b')).toBe('<ol><li>a</li><li>b</li></ol>');
  });

  it('hard line breaks: a backslash or two spaces at the end of a line (the poem)', () => {
    expect(renderMarkdown('**Title**\\\nline one,  \nline two.')).toBe('<p><strong>Title</strong><br>\nline one,<br>\nline two.</p>');
  });

  it('escapes HTML, so raw markup never reaches a page', () => {
    expect(renderMarkdown('<script>alert(1)</script> & "x"')).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;</p>');
  });

  it('links go only to https, http, mailto or a ref: that resolves', () => {
    expect(renderMarkdown('[site](https://example.com/a_b_c)')).toBe('<p><a href="https://example.com/a_b_c">site</a></p>');
    expect(renderMarkdown('[a case](ref:caseStudy/x)', { resolveRef: (r) => (r === 'caseStudy/x' ? '/work/x/' : undefined) })).toBe('<p><a href="/work/x/">a case</a></p>');
    expect(() => renderMarkdown('[bad](javascript:alert(1))')).toThrow(/https, http, mailto or ref/);
    expect(() => renderMarkdown('[gone](ref:caseStudy/nope)', { resolveRef: () => undefined })).toThrow(/unknown link target/);
  });

  it('plain text drops the markup', () => {
    expect(plainText('**Bold** and *soft* [link](https://x.y)\\\nnext')).toBe('Bold and soft link\nnext');
  });
});

describe('routes from the site structure', () => {
  const found = (items: Record<string, { slug: string; title: string }>) => (type: string, id: string) => (type === 'article' ? items[id] : undefined);
  const tree = (children: unknown[]): SiteStructure => ({ home: { id: 'home', kind: 'hub', slug: '', title: 'Home', template: 'home', children } }) as SiteStructure;

  it('a path is the chain of slugs; an item node takes its item slug; the trail runs from the home page', () => {
    const { routes, errors } = buildRoutes(
      tree([{ id: 'leadership', kind: 'hub', slug: 'leadership', title: 'Leadership', template: 'leadershipOverview', children: [{ id: 'n', kind: 'item', item: { type: 'article', id: 'a' } }] }]),
      found({ a: { slug: 'a-story', title: 'A story' } }),
    );
    expect(errors).toEqual([]);
    expect(routes.map((r) => r.path)).toEqual(['/', '/leadership/', '/leadership/a-story/']);
    const story = routes[2];
    expect(story.title).toBe('A story');
    expect(story.ancestors.map((c) => c.path)).toEqual(['/', '/leadership/']);
    expect(story.parent?.id).toBe('leadership');
  });

  it('refuses a reserved path, an item placed twice (V12), a missing item and a taken path', () => {
    const { errors } = buildRoutes(
      tree([
        { id: 'play', kind: 'hub', slug: 'play', title: 'Play', template: 'notesIndex' },
        { id: 'x1', kind: 'item', item: { type: 'article', id: 'a' } },
        { id: 'x2', kind: 'item', slug: 'other', item: { type: 'article', id: 'a' } },
        { id: 'x3', kind: 'item', item: { type: 'article', id: 'missing' } },
        { id: 'x4', kind: 'item', slug: 'a', item: { type: 'article', id: 'b' } },
      ]),
      found({ a: { slug: 'a', title: 'A' }, b: { slug: 'b', title: 'B' } }),
    );
    expect(errors.join('\n')).toMatch(/\/play\/ is reserved/);
    expect(errors.join('\n')).toMatch(/placed twice/);
    expect(errors.join('\n')).toMatch(/"missing", which doesn't exist/);
    expect(errors.join('\n')).toMatch(/\/a\/ is already taken/);
  });

  it('heading anchors come from their words', () => {
    expect(headingId('\u201cBe better than yesterday.\u201d')).toBe('be-better-than-yesterday');
    expect(headingId('Don\u2019t optimize for approval.')).toBe('dont-optimize-for-approval');
  });
});

describe('the loader checks what it is given', () => {
  const base = {
    '/content/site.json': { name: 'N', description: 'D', owner: 'p', locale: 'en' },
    '/content/people/p.json': { id: 'p', name: 'P' },
    '/content/structures/site.json': { home: { id: 'home', kind: 'hub', slug: '', title: 'Home', template: 'home', children: [{ id: 'a', kind: 'item', item: { type: 'article', id: 'a' } }] } },
    '/content/media/articles/a/pic.json': { kind: 'image', file: 'pic.webp', alt: 'A picture.', visibility: 'public' },
    '/content/articles/a.json': {
      id: 'a', type: 'article', kind: 'note', slug: 'a', title: 'A', summary: 'S', status: 'published', visibility: 'public', updatedAt: '2026-09-29', locale: 'en',
      body: [{ type: 'figure', media: 'articles/a/pic' }],
    },
  };
  const masters = new Set(['/content/media/articles/a/pic.webp']);
  const problems = (docs: Record<string, unknown>, m = masters) => {
    try {
      loadContent(docs, m);
      return [];
    } catch (e) {
      return (e as ContentError).problems;
    }
  };

  it('a valid set loads, with the item at its canonical path', () => {
    const c = loadContent(base, masters);
    expect(c.canonical.get('article/a')).toBe('/a/');
    expect(c.media.get('articles/a/pic')?.master).toBe('/content/media/articles/a/pic.webp');
  });

  it('names the file and field of each problem', () => {
    const article = base['/content/articles/a.json'];
    expect(problems({ ...base, '/content/articles/a.json': { ...article, colour: 'red' } }).join('\n')).toMatch(/content\/articles\/a\.json: .*colour/);
    expect(problems({ ...base, '/content/media/articles/a/pic.json': { kind: 'image', file: 'pic.webp', visibility: 'public' } }).join('\n')).toMatch(/pic\.json: alt: an image needs alt text/);
    expect(problems(base, new Set()).join('\n')).toMatch(/its master content\/media\/articles\/a\/pic\.webp is missing/);
    expect(problems(base, new Set([...masters, '/content/media/articles/a/stray.webp'])).join('\n')).toMatch(/stray\.webp: a master without its sidecar/);
    expect(problems({ ...base, '/content/articles/a.json': { ...article, body: [{ type: 'figure', media: 'articles/a/nope' }] } }).join('\n')).toMatch(/media "articles\/a\/nope" doesn't exist/);
    expect(problems({ ...base, '/content/articles/a.json': { ...article, summary: 'x'.repeat(161) } }).join('\n')).toMatch(/summary/);
  });

  it('a draft is not placed: its node fails, since only published items have pages', () => {
    const article = base['/content/articles/a.json'];
    expect(problems({ ...base, '/content/articles/a.json': { ...article, status: 'draft' } }).join('\n')).toMatch(/doesn't exist or isn't published/);
  });
});

describe('the content in content/', () => {
  const c = content();
  const masters = walk(join(ROOT, 'content/media')).filter((f) => /\.(webp|jpe?g|png|avif)$/.test(f));

  it('validates, and every published article has a page', () => {
    expect(c.warnings).toEqual([]);
    expect(c.canonical.get('article/do-what-makes-you-proud')).toBe('/leadership/do-what-makes-you-proud/');
  });

  it('every master is within its budget: 2560 px on the long side and 1.5 MB, with no location data', async () => {
    const over: string[] = [];
    for (const f of masters) {
      const m = await sharp(f).metadata();
      if (Math.max(m.width ?? 0, m.height ?? 0) > 2560) over.push(`${key(f)}: ${m.width}x${m.height}`);
      if (statSync(f).size > 1.5 * 1024 * 1024) over.push(`${key(f)}: ${(statSync(f).size / 1048576).toFixed(2)} MB`);
      if (m.exif && /GPS/i.test(m.exif.toString('latin1'))) over.push(`${key(f)}: has GPS data`);
    }
    expect(over).toEqual([]);
  });

  it('every master is used by something (the repository never carries dead media)', () => {
    const used = new Set([...c.articles.values()].flatMap(mediaUsed));
    for (const p of c.people.values()) if (p.avatar) used.add(p.avatar);
    const ids = masters.map((f) => key(f).replace(/^\/content\/media\//, '').replace(/\.\w+$/, ''));
    expect(ids.filter((id) => !used.has(id))).toEqual([]);
  });

  it('the article reads in a few minutes, from its words', () => {
    const a = c.articles.get('do-what-makes-you-proud')!;
    expect(readingMinutes(a)).toBeGreaterThanOrEqual(3);
    expect(readingMinutes(a)).toBeLessThanOrEqual(6);
  });

  it('content JSON is UTF-8 without a byte-order mark, two-space indented (line endings as git checks them out)', () => {
    for (const f of walk(join(ROOT, 'content')).filter((x) => x.endsWith('.json'))) {
      const s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
      expect(s.charCodeAt(0), key(f)).not.toBe(0xfeff);
      expect(s, key(f)).toBe(JSON.stringify(JSON.parse(s), null, 2) + '\n');
    }
  });
});
