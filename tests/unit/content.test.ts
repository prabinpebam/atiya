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
import { ContentError, headingId, loadContent } from '../../src/site/content/load';
import { content } from '../../src/site/content/repository';
import { pageMeasure, pictureCount, readingMinutes } from '../../src/site/content/reading';
import { article, block, siteStructure, type Article, type SiteStructure } from '../../src/site/content/schema';
import { exploreHref, siteNav } from '../../src/site/content/navigation';
import { renderInlineMarkdown } from '../../src/site/content/markdown';

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
  const tree = (children: unknown[]): SiteStructure => ({ home: { id: 'home', kind: 'hub', slug: '', title: 'Home', children } }) as SiteStructure;
  const section = (id: string, children: unknown[] = [], extra: object = {}) => ({ id, kind: 'hub', slug: id, title: id, ...extra, children });

  it('a path is the chain of slugs; an item node takes its item slug; the trail runs from the home page', () => {
    const { routes, errors } = buildRoutes(
      tree([{ id: 'leadership', kind: 'hub', slug: 'leadership', title: 'Leadership', view: 'bento', children: [{ id: 'n', kind: 'item', item: { type: 'article', id: 'a' } }] }]),
      found({ a: { slug: 'a-story', title: 'A story' } }),
    );
    expect(errors).toEqual([]);
    expect(routes.map((r) => r.path)).toEqual(['/', '/leadership/', '/leadership/a-story/']);
    const story = routes[2];
    expect(story.title).toBe('A story');
    expect(story.ancestors.map((c) => c.path)).toEqual(['/', '/leadership/']);
    expect(story.parent?.id).toBe('leadership');
    expect(story.label).toBe('A story');
  });

  it('refuses a reserved path, an item placed twice (V12), a missing item and a taken path', () => {
    const { errors } = buildRoutes(
      tree([
        section('play'),
        section('s', [
          { id: 'x1', kind: 'item', item: { type: 'article', id: 'a' } },
          { id: 'x2', kind: 'item', slug: 'other', item: { type: 'article', id: 'a' } },
          { id: 'x3', kind: 'item', item: { type: 'article', id: 'missing' } },
          { id: 'x4', kind: 'item', slug: 'a', item: { type: 'article', id: 'b' } },
        ]),
      ]),
      found({ a: { slug: 'a', title: 'A' }, b: { slug: 'b', title: 'B' } }),
    );
    expect(errors.join('\n')).toMatch(/\/play\/ is reserved/);
    expect(errors.join('\n')).toMatch(/placed twice/);
    expect(errors.join('\n')).toMatch(/"missing", which doesn't exist/);
    expect(errors.join('\n')).toMatch(/\/s\/a\/ is already taken/);
  });

  it('is three levels, home, sections and pages (V22), and every node has its own ID (V21)', () => {
    const lookup = found({ a: { slug: 'a', title: 'A' }, b: { slug: 'b', title: 'B' } });
    const errs = (t: SiteStructure) => buildRoutes(t, lookup).errors.join('\n');
    expect(errs(tree([section('s', [{ id: 'n', kind: 'item', item: { type: 'article', id: 'a' } }])]))).toBe('');
    expect(errs(tree([{ id: 'n', kind: 'item', item: { type: 'article', id: 'a' } }]))).toMatch(/a page belongs in a section/);
    expect(errs(tree([section('s', [section('t')])]))).toMatch(/a section can't hold another section/);
    expect(errs(tree([section('s', [{ id: 's', kind: 'item', item: { type: 'article', id: 'a' } }])]))).toMatch(/node s: another node has this ID/);
  });

  it('a section keeps its view, and a hub or a structure that names another item type is refused', () => {
    const ok = siteStructure.safeParse(tree([section('s', [], { view: 'list' })]));
    expect(ok.success).toBe(true);
    expect(siteStructure.safeParse(tree([section('s', [], { view: 'carousel' })])).success).toBe(false);
    expect(siteStructure.safeParse(tree([section('s', [], { template: 'workIndex' })])).success).toBe(false);
    expect(siteStructure.safeParse(tree([section('s', [{ id: 'n', kind: 'item', item: { type: 'caseStudy', id: 'a' } }])])).success).toBe(false);
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
    '/content/structures/site.json': { home: { id: 'home', kind: 'hub', slug: '', title: 'Home', children: [{ id: 's', kind: 'hub', slug: 's', title: 'S', children: [{ id: 'a', kind: 'item', item: { type: 'article', id: 'a' } }] }] } },
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
    expect(c.canonical.get('article/a')).toBe('/s/a/');
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
    expect(c.routes.find((r) => r.path === '/s/a/')?.published).toBe(false);
    expect(c.canonical.has('article/a')).toBe(false);
    // a node placing something that doesn't exist still fails
    const s = base['/content/structures/site.json'] as { home: { children: unknown[] } };
    const broken = { home: { ...s.home, children: [{ id: 's', kind: 'hub', slug: 's', title: 'S', children: [{ id: 'x', kind: 'item', item: { type: 'article', id: 'nope' } }] }] } };
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

describe('the tiles block (short labelled statements)', () => {
  const tile = (label: string, text: string) => ({ label, text });
  const ok = (b: unknown) => block.safeParse(b).success;

  it('takes two to six tiles, each a short label and one paragraph, and a width', () => {
    expect(ok({ type: 'tiles', items: [tile('Challenge', 'Re-energize the team.'), tile('Intent', 'Own the outcome.')] })).toBe(true);
    expect(ok({ type: 'tiles', items: [tile('Challenge', 'x'), tile('Intent', 'y')], width: 'wide' })).toBe(true);
    expect(ok({ type: 'tiles', items: [tile('Only one', 'x')] })).toBe(false);
    expect(ok({ type: 'tiles', items: Array.from({ length: 7 }, (_, n) => tile(`T${n}`, 'x')) })).toBe(false);
    expect(ok({ type: 'tiles', items: [tile('x'.repeat(41), 'x'), tile('Intent', 'y')] })).toBe(false);
    expect(ok({ type: 'tiles', items: [tile('Challenge', 'one\n\ntwo'), tile('Intent', 'y')] })).toBe(false);
    expect(ok({ type: 'tiles', items: [tile('Challenge', 'x'), tile('Intent', 'y')], width: 'full' })).toBe(false);
  });

  it("renders a tile's text inline: bold, italic and links, with no paragraph around it", () => {
    expect(renderInlineMarkdown('**Do what makes you proud.** A standard chosen from within.')).toBe('<strong>Do what makes you proud.</strong> A standard chosen from within.');
    expect(renderInlineMarkdown('See [the story](ref:article/a).', { resolveRef: () => '/work/a/' })).toBe('See <a href="/work/a/">the story</a>.');
    expect(renderInlineMarkdown('<script>')).toBe('&lt;script&gt;');
  });
});

describe('captions can be hidden', () => {
  it('takes showCaption on a picture, a gallery, a carousel, a video and a lead picture, and only as true or false', () => {
    const ok = (b: unknown) => block.safeParse(b).success;
    expect(ok({ type: 'figure', media: 'shared/x', showCaption: false })).toBe(true);
    expect(ok({ type: 'gallery', items: [{ media: 'shared/x' }, { media: 'shared/y' }], showCaption: false })).toBe(true);
    expect(ok({ type: 'carousel', items: [{ media: 'shared/x' }, { media: 'shared/y' }], label: 'L', showCaption: false })).toBe(true);
    expect(ok({ type: 'video', embed: { provider: 'youtube', id: 'abcdef' }, title: 'V', poster: 'shared/x', showCaption: false })).toBe(true);
    expect(ok({ type: 'figure', media: 'shared/x', showCaption: 'no' })).toBe(false);
    expect(article.safeParse({ id: 'a', type: 'article', kind: 'note', slug: 'a', title: 'A', summary: 'S', status: 'draft', visibility: 'public', updatedAt: '2026-09-30', locale: 'en', body: [], hero: { media: 'shared/x', showCaption: false } }).success).toBe(true);
  });
});

// ---------- sections, pages and the navigation (documentation/sections/spec.md §3, §4) ----------
describe('the navigation and the redirects', () => {
  const page = (id: string, extra: Partial<Article> = {}) => ({
    id, type: 'article', kind: 'note', slug: id, title: id.toUpperCase(), summary: 'S', status: 'published', visibility: 'public', updatedAt: '2026-09-30', locale: 'en', body: [], ...extra,
  });
  const docs = (menus: unknown, redirects?: unknown, drafts: string[] = []) => ({
    '/content/site.json': { name: 'N', description: 'D', owner: 'p', locale: 'en' },
    '/content/people/p.json': { id: 'p', name: 'P' },
    '/content/articles/a.json': page('a'),
    '/content/articles/b.json': page('b', { navLabel: 'Bee', ...(drafts.includes('b') ? { status: 'draft' } : {}) }),
    '/content/structures/site.json': {
      home: {
        id: 'home', kind: 'hub', slug: '', title: 'Home',
        children: [
          { id: 'work', kind: 'hub', slug: 'work', title: 'Work', navLabel: 'Our work', children: [{ id: 'a', kind: 'item', item: { type: 'article', id: 'a' } }] },
          { id: 'about', kind: 'hub', slug: 'about', title: 'About', children: [{ id: 'b', kind: 'item', item: { type: 'article', id: 'b' } }] },
        ],
      },
      ...(menus ? { menus } : {}),
    },
    ...(redirects ? { '/content/redirects.json': redirects } : {}),
  });
  const problems = (d: Record<string, unknown>) => {
    try {
      loadContent(d, new Set());
      return '';
    } catch (e) {
      return (e as ContentError).problems.join('\n');
    }
  };

  it('lists the entries in order, with their labels and addresses; a section is current on its pages; a link never is', () => {
    const c = loadContent(docs({ primary: [{ node: 'work' }, { node: 'about', label: 'Me' }, { node: 'b' }, { label: 'GitHub', href: 'https://github.com/x' }, { label: 'Docs', href: '/docs/' }] }), new Set());
    const built = c.routes.filter((r) => r.published);
    const at = (path: string) => built.find((r) => r.path === path);
    expect(siteNav(c.structure, built)).toEqual([
      { label: 'Our work', href: '/work/' },
      { label: 'Me', href: '/about/' },
      { label: 'Bee', href: '/about/b/' },
      { label: 'GitHub', href: 'https://github.com/x' },
      { label: 'Docs', href: '/docs/' },
    ]);
    expect(siteNav(c.structure, built, at('/work/a/')).filter((e) => e.current).map((e) => e.label)).toEqual(['Our work']);
    expect(siteNav(c.structure, built, at('/about/b/')).filter((e) => e.current).map((e) => e.label)).toEqual(['Me', 'Bee']);
    expect(siteNav(c.structure, built, at('/')).some((e) => e.current)).toBe(false);
  });

  it("a draft page's entry waits until it's published; no menu, no navigation", () => {
    const c = loadContent(docs({ primary: [{ node: 'work' }, { node: 'b' }] }, undefined, ['b']), new Set());
    expect(siteNav(c.structure, c.routes.filter((r) => r.published)).map((e) => e.label)).toEqual(['Our work']);
    const none = loadContent(docs(undefined), new Set());
    expect(siteNav(none.structure, none.routes)).toEqual([]);
  });

  it('refuses an entry that points nowhere, a bad address, more than eight entries or a long label (V17)', () => {
    expect(problems(docs({ primary: [{ node: 'nowhere' }] }))).toMatch(/menus\.primary\.0: node "nowhere" isn't in the site's tree/);
    expect(problems(docs({ primary: [{ label: 'Gone', href: '/gone/' }] }))).toMatch(/\/gone\/ isn't a page of this site/);
    expect(problems(docs({ primary: [{ label: 'X', href: 'javascript:alert(1)' }] }))).toMatch(/an https, http or mailto address/);
    expect(problems(docs({ primary: Array.from({ length: 9 }, () => ({ node: 'work' })) }))).toMatch(/at most eight entries/);
    expect(problems(docs({ primary: [{ node: 'work', label: 'x'.repeat(25) }] }))).toMatch(/menus\.primary\.0\.label/);
    expect(problems(docs({ primary: [{ label: 'Planet', href: '/play/' }, { label: 'Mail', href: 'mailto:a@b.c' }] }))).toBe('');
  });

  it('keeps a redirect from an old address to a built page; one that no longer fits is skipped with a warning, never refused (V19)', () => {
    const ok = loadContent(docs(undefined, [{ from: '/classic/', to: '/#sections' }, { from: '/classic/x/', to: '/work/' }]), new Set());
    expect(ok.redirects).toHaveLength(2);
    const stale = loadContent(docs(undefined, [{ from: '/work/', to: '/about/' }, { from: '/old/', to: '/nowhere/' }, { from: '/x/', to: '/work/' }, { from: '/x/', to: '/about/' }]), new Set());
    expect(stale.redirects).toEqual([{ from: '/x/', to: '/work/' }]);
    expect(stale.warnings.join('\n')).toMatch(/\/work\/ → \/about\/ is skipped: its address is a page of the site/);
    expect(stale.warnings.join('\n')).toMatch(/\/nowhere\/ isn't a published page/);
    expect(stale.warnings.join('\n')).toMatch(/another redirect has its address/);
  });

  it('"Explore in 3D" goes to a page, open in its building; to the building that points to a section; else the plaza', () => {
    const c = loadContent(docs(undefined), new Set());
    const at = (path: string) => c.routes.find((r) => r.path === path);
    const planet = { places: [{ id: 'workshop' as const, title: 'Workshop', kicker: 'K', summary: 'S', site: 'work', pages: [{ type: 'article' as const, id: 'b' }] }] };
    expect(exploreHref(at('/work/'), planet)).toBe('/play/?at=workshop');
    expect(exploreHref(at('/about/b/'), planet)).toBe('/play/?at=workshop&open=1&page=b');
    expect(exploreHref(at('/work/a/'), planet)).toBe('/play/');
    expect(exploreHref(at('/about/'), planet)).toBe('/play/');
    expect(exploreHref(at('/'), planet)).toBe('/play/');
    expect(exploreHref()).toBe('/play/');
  });
});

describe('the planet structure (documentation/sections/spec.md §5)', () => {
  const ALL = ['workshop', 'town-hall', 'lighthouse', 'library', 'amphitheater', 'greenhouse', 'post-office'];
  const places = (over: Record<string, object> = {}) => ALL.map((id) => ({ id, title: id, kicker: 'K', summary: 'S', pages: [], ...(over[id] ?? {}) }));
  const docs = (planet: unknown, placed = true) => ({
    '/content/site.json': { name: 'N', description: 'D', owner: 'p', locale: 'en' },
    '/content/people/p.json': { id: 'p', name: 'P' },
    '/content/articles/a.json': { id: 'a', type: 'article', kind: 'note', slug: 'a', title: 'A', summary: 'S', status: 'published', visibility: 'public', updatedAt: '2026-09-30', locale: 'en', body: [] },
    '/content/articles/b.json': { id: 'b', type: 'article', kind: 'note', slug: 'b', title: 'B', summary: 'S', status: 'draft', visibility: 'public', updatedAt: '2026-09-30', locale: 'en', body: [] },
    '/content/structures/site.json': { home: { id: 'home', kind: 'hub', slug: '', title: 'Home', children: [{ id: 'work', kind: 'hub', slug: 'work', title: 'Work', children: placed ? [{ id: 'a', kind: 'item', item: { type: 'article', id: 'a' } }] : [] }] } },
    '/content/structures/planet.json': planet,
  });
  const problems = (d: Record<string, unknown>) => {
    try {
      loadContent(d, new Set());
      return '';
    } catch (e) {
      return (e as ContentError).problems.join('\n');
    }
  };

  it('loads each building once, with its pages and its section', () => {
    const c = loadContent(docs({ places: places({ workshop: { site: 'work', view: 'tiles', pages: [{ type: 'article', id: 'a' }] } }) }), new Set());
    expect(c.planet?.places.find((p) => p.id === 'workshop')?.pages).toEqual([{ type: 'article', id: 'a' }]);
  });

  it('refuses a missing or doubled building (V14), an unknown one, a page in two (V15), a page off the site (V13) and a site that isn’t a section (V16)', () => {
    expect(problems(docs({ places: places().filter((p) => p.id !== 'library') }))).toMatch(/the library is missing/);
    expect(problems(docs({ places: [...places(), places()[0]] }))).toMatch(/the workshop is listed 2 times/);
    expect(problems(docs({ places: [...places(), { ...places()[0], id: 'castle' }] }))).toMatch(/places\.7\.id/);
    const both = { pages: [{ type: 'article', id: 'a' }] };
    expect(problems(docs({ places: places({ workshop: both, library: both }) }))).toMatch(/page "a" is in the workshop and the library/);
    expect(problems(docs({ places: places({ workshop: both }) }, false))).toMatch(/page "a" isn't on the site/);
    expect(problems(docs({ places: places({ workshop: { pages: [{ type: 'article', id: 'nope' }] } }) }))).toMatch(/page "nope" doesn't exist/);
    expect(problems(docs({ places: places({ workshop: { site: 'home' } }) }))).toMatch(/"home" isn't a section of the site/);
    expect(problems(docs({ places: places({ workshop: { site: 'nowhere' } }) }))).toMatch(/"nowhere" isn't a section/);
  });

  it('a draft can be in a building; only published pages are listed', () => {
    const d = docs({ places: places({ workshop: { pages: [{ type: 'article', id: 'b' }] } }) });
    const s = d['/content/structures/site.json'] as { home: { children: { children: unknown[] }[] } };
    s.home.children[0].children.push({ id: 'b', kind: 'item', item: { type: 'article', id: 'b' } });
    expect(problems(d)).toBe('');
  });
});

describe('a page opens as its kind reads', () => {
  const base = { id: 'x', type: 'article', slug: 'x', title: 'X', summary: 'S', status: 'published', visibility: 'public', updatedAt: '2026-09-30', locale: 'en' } as const;
  const words = { type: 'text', markdown: 'word '.repeat(440).trim() } as const;
  const pictures = [
    { type: 'figure', media: 'a/one' },
    { type: 'gallery', items: [{ media: 'a/two' }, { media: 'a/three' }, { media: 'a/one' }] },
  ] as const;

  it('an article measures its reading time, a gallery its pictures (each once), a page nothing', () => {
    const a = article.parse({ ...base, kind: 'note', body: [words] });
    expect(pageMeasure(a)).toBe('2 min read');
    const g = article.parse({ ...base, kind: 'gallery', body: pictures });
    expect(pictureCount(g)).toBe(3);
    expect(pageMeasure(g)).toBe('3 pictures');
    expect(pageMeasure(article.parse({ ...base, kind: 'gallery', body: [pictures[0]] }))).toBe('1 picture');
    expect(pageMeasure(article.parse({ ...base, kind: 'page', body: [words] }))).toBeUndefined();
  });
});

describe('the real content is three levels, with its navigation and redirects', () => {
  it('seven sections in the navigation, the first story in Leadership, and every classic address redirected', () => {
    const c = content();
    const sections = c.structure.home.children ?? [];
    expect(sections.map((n) => n.id)).toEqual(['work', 'about', 'leadership', 'writing', 'talks', 'side-projects', 'contact']);
    expect(sections.every((n) => n.kind === 'hub' && n.summary && n.view)).toBe(true);
    expect((c.structure.menus?.primary ?? []).map((e) => ('node' in e ? e.node : e.label))).toEqual(sections.map((n) => n.id));
    expect(c.canonical.get('article/do-what-makes-you-proud')).toBe('/leadership/do-what-makes-you-proud/');
    const froms = c.redirects.map((r) => r.from);
    for (const id of ['workshop', 'town-hall', 'lighthouse', 'library', 'amphitheater', 'greenhouse', 'post-office']) expect(froms).toContain(`/classic/${id}/`);
    expect(froms).toContain('/classic/');
  });
});
