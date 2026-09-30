/**
 * The content platform's first slice (documentation/content/plan.md): the Markdown subset, the routes
 * the site structure gives, the loader's checks, and the real content/ folder, which must validate and
 * keep its media within budget (documentation/content/media.md §4).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import sharp from 'sharp';
import { normalize, parseInline, runs, parseMarkdown, plainText, renderMarkdown, serializeBlocks, serializeInline, type Inline } from '../../src/site/content/markdown';
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
    expect(() => renderMarkdown('[bad](javascript:void0)')).toThrow(/https, http, mailto or ref/);
    // a target with brackets or spaces isn't a link at all: it stays (escaped) text
    expect(renderMarkdown('[bad](javascript:alert(1))')).toBe('<p>[bad](javascript:alert(1))</p>');
    expect(() => renderMarkdown('[gone](ref:caseStudy/nope)', { resolveRef: () => undefined })).toThrow(/unknown link target/);
  });

  it('marks nest (strong and emphasis), code holds plain text, a link holds marks but no link', () => {
    expect(parseInline('*a **b** c*')).toEqual([{ t: 'em', c: [{ t: 'text', v: 'a ' }, { t: 'strong', c: [{ t: 'text', v: 'b' }] }, { t: 'text', v: ' c' }] }]);
    expect(parseInline('`**x**`')).toEqual([{ t: 'code', v: '**x**' }]);
    expect(parseInline('[a [b](https://x.y) c](https://z.z)')[0]).toMatchObject({ t: 'link', href: 'https://z.z' });
    expect(renderMarkdown('[**bold** link](https://x.y)')).toBe('<p><a href="https://x.y"><strong>bold</strong> link</a></p>');
  });

  it('backslash escapes and double-backtick code make the delimiters literal', () => {
    expect(renderMarkdown('2 \\* 3 \\_ x \\[y\\]')).toBe('<p>2 * 3 _ x [y]</p>');
    expect(renderMarkdown('`` a`b ``')).toBe('<p><code>a`b</code></p>');
    expect(renderMarkdown('snake_case stays')).toBe('<p>snake_case stays</p>');
  });

  it('the serializer writes a tree back so it parses to the same tree (compared by meaning)', () => {
    const trees: Inline[][] = [
      [{ t: 'text', v: 'plain * star _ under [br] \\ back' }],
      [{ t: 'strong', c: [{ t: 'text', v: 'bold ' }] }, { t: 'text', v: 'after' }],
      [{ t: 'em', c: [{ t: 'text', v: 'soft ' }, { t: 'strong', c: [{ t: 'text', v: 'both' }] }] }],
      [{ t: 'code', v: 'a`b' }, { t: 'br' }, { t: 'link', href: 'ref:caseStudy/x', c: [{ t: 'em', c: [{ t: 'text', v: 'see' }] }] }],
      [{ t: 'text', v: '- not a list\n1. nor this' }],
      [{ t: 'text', v: 'un' }, { t: 'em', c: [{ t: 'text', v: 'believ' }] }, { t: 'text', v: 'able' }],
    ];
    for (const tree of trees) expect(normalize(parseInline(serializeInline(tree))), serializeInline(tree)).toEqual(normalize(tree));
    const md = '- one **a**\n- two';
    expect(serializeBlocks(parseMarkdown(md))).toBe(md);
  });

  it('fuzzed: any tree of text, marks, code, links and breaks survives serialize then parse, by meaning', () => {
    let seed = Number(process.env.FUZZ_SEED ?? 7);
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
    const CHARS = ['a', 'b', 'x', ' ', '*', '_', '`', '[', ']', '\\', '-', '.', '1', 'é', '(', ')'];
    const text = () => Array.from({ length: 1 + Math.floor(rnd() * 5) }, () => pick(CHARS)).join('');
    const tree = (depth: number, inLink: boolean): Inline[] =>
      Array.from({ length: 1 + Math.floor(rnd() * 3) }, (): Inline => {
        const r = rnd();
        if (depth <= 0 || r < 0.35) return { t: 'text', v: text() };
        if (r < 0.5) return { t: 'strong', c: tree(depth - 1, inLink) };
        if (r < 0.65) return { t: 'em', c: tree(depth - 1, inLink) };
        if (r < 0.75) return { t: 'code', v: text().replace(/\s+/g, 'y') };
        if (r < 0.82) return { t: 'br' };
        return inLink ? { t: 'text', v: text() } : { t: 'link', href: pick(['https://x.y/a_b', 'mailto:a@b.c', 'ref:article/x']), c: tree(depth - 1, true) };
      });
    const wordy = (nodes: Inline[]) => nodes; // keep the shape
    for (let n = 0; n < Number(process.env.FUZZ_N ?? 3000); n++) {
      const t = wordy(tree(3, false));
      const md = serializeInline(t);
      expect(runs(parseInline(md)), JSON.stringify({ md, t })).toEqual(runs(normalize(t)));
    }
  });

  it('plain text drops the markup', () => {
    expect(plainText('**Bold** and *soft* [link](https://x.y)\\\nnext')).toBe('Bold and soft link\nnext');
  });
});

describe('routes from the site structure', () => {
  const found = (items: Record<string, { slug: string; title: string }>) => (type: string, id: string) => (type === 'article' && items[id] ? { ...items[id], published: true } : undefined);
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

  it('a draft can be placed: its address is resolved and checked, but only published items are built', () => {
    const article = base['/content/articles/a.json'];
    const c = loadContent({ ...base, '/content/articles/a.json': { ...article, status: 'draft' } }, masters);
    expect(c.routes.find((r) => r.path === '/a/')?.published).toBe(false);
    expect(c.canonical.has('article/a')).toBe(false);
    // a node placing something that doesn't exist still fails
    const s = base['/content/structures/site.json'] as { home: { children: unknown[] } };
    const broken = { home: { ...s.home, children: [{ id: 'x', kind: 'item', item: { type: 'article', id: 'nope' } }] } };
    expect(problems({ ...base, '/content/structures/site.json': broken }).join('\n')).toMatch(/"nope", which doesn't exist/);
  });

  it('a text block is one paragraph or one list', () => {
    const article = base['/content/articles/a.json'];
    expect(problems({ ...base, '/content/articles/a.json': { ...article, body: [{ type: 'text', markdown: 'one\n\ntwo' }] } }).join('\n')).toMatch(/one paragraph or one list/);
  });

  it('issues name the file, the field and what is wrong', () => {
    const article = base['/content/articles/a.json'];
    try {
      loadContent({ ...base, '/content/articles/a.json': { ...article, summary: '' } }, masters);
    } catch (e) {
      expect((e as ContentError).issues).toContainEqual(expect.objectContaining({ file: 'content/articles/a.json', path: 'summary' }));
    }
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
