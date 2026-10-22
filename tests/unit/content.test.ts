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
import { ContentError, headingId, headingIds, loadContent, mediaUsed } from '../../src/site/content/load';
import { content, placePages, placeSection } from '../../src/site/content/repository';
import { pageMeasure, pictureCount, readingMinutes } from '../../src/site/content/reading';
import { article, block, siteStructure, type Article, type SiteStructure } from '../../src/site/content/schema';
import { exploreHref, siteNav } from '../../src/site/content/navigation';
import { renderInlineMarkdown } from '../../src/site/content/markdown';
import { MAX_GIF_BYTES, MAX_VIDEO_BYTES } from '../../src/site/editor/model/upload';

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
    expect(renderMarkdown('[site](https://example.com/a_b_c)')).toBe('<p><a href="https://example.com/a_b_c" target="_blank" rel="noopener noreferrer">site<span class="sr-only"> (opens in a new tab)</span></a></p>');
    expect(renderMarkdown('[Atiya](https://prabinpebam.github.io/atiya/)')).toBe('<p><a href="https://prabinpebam.github.io/atiya/">Atiya</a></p>');
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
    expect(renderMarkdown('[**bold** link](https://x.y)')).toBe('<p><a href="https://x.y" target="_blank" rel="noopener noreferrer"><strong>bold</strong> link<span class="sr-only"> (opens in a new tab)</span></a></p>');
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
    for (const view of ['tiles', 'bento', 'features']) expect(siteStructure.safeParse(tree([section('s', [], { view })])).success, view).toBe(true);
    expect(siteStructure.safeParse(tree([section('s', [], { view: 'carousel' })])).success).toBe(false);
    expect(siteStructure.safeParse(tree([section('s', [], { template: 'workIndex' })])).success).toBe(false);
    expect(siteStructure.safeParse(tree([section('s', [{ id: 'n', kind: 'item', item: { type: 'caseStudy', id: 'a' } }])])).success).toBe(false);
  });

  it('heading anchors come from their words', () => {
    expect(headingId('\u201cBe better than yesterday.\u201d')).toBe('be-better-than-yesterday');
    expect(headingId('Don\u2019t optimize for approval.')).toBe('dont-optimize-for-approval');
  });

  it('headings with the same words each get their own anchor, the first the plain one; one set by hand is kept', () => {
    const h = (text: string, id?: string) => ({ type: 'heading', text, ...(id ? { id } : {}) });
    expect(headingIds([h('What shipped'), { type: 'text' }, h('What shipped'), h('What shipped')])).toEqual(['what-shipped', undefined, 'what-shipped-2', 'what-shipped-3']);
    // a hand-set anchor wins its name; the words' one steps round it
    expect(headingIds([h('What shipped'), h('Later', 'what-shipped')])).toEqual(['what-shipped-2', 'what-shipped']);
    expect(headingIds([h('!!!')])).toEqual(['section']);
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
    expect(problems({ ...base, '/content/articles/a.json': { ...article, summary: 'x'.repeat(241) } }).join('\n')).toMatch(/summary/);
  });

  it('a file to download (a PDF): its sidecar names it; a link to it (ref:media/<id>) needs it, public; a page can have a portrait', () => {
    const article = base['/content/articles/a.json'];
    const doc = { '/content/media/articles/a/cv.json': { kind: 'document', file: 'cv.pdf', title: 'The CV', visibility: 'public' } };
    const withDoc = new Set([...masters, '/content/media/articles/a/cv.pdf']);
    const linking = { ...article, portrait: 'articles/a/pic', body: [{ type: 'text', markdown: 'Read [the CV](ref:media/articles/a/cv).' }] };
    const c = loadContent({ ...base, ...doc, '/content/articles/a.json': linking }, withDoc);
    expect(c.documents.get('articles/a/cv')).toMatchObject({ title: 'The CV', master: '/content/media/articles/a/cv.pdf' });
    expect(c.media.has('articles/a/cv')).toBe(false);
    expect(problems({ ...base, ...doc }, masters).join('\n')).toMatch(/cv\.json: its file content\/media\/articles\/a\/cv\.pdf is missing/);
    expect(problems({ ...base, '/content/articles/a.json': linking }, masters).join('\n')).toMatch(/the file to download "media\/articles\/a\/cv" doesn't exist/);
    expect(problems({ ...base, ...doc, '/content/media/articles/a/cv.json': { ...doc['/content/media/articles/a/cv.json'], visibility: 'notPublishable' }, '/content/articles/a.json': linking }, withDoc).join('\n')).toMatch(/isn't public/);
    expect(problems({ ...base, '/content/articles/a.json': { ...article, portrait: 'articles/a/nope' } }).join('\n')).toMatch(/media "articles\/a\/nope" doesn't exist/);
  });

  it("a picture's dark version: named by its sidecar, beside its master, and nowhere else", () => {
    const pic = base['/content/media/articles/a/pic.json'];
    const withDark = { ...base, '/content/media/articles/a/pic.json': { ...pic, dark: { file: 'pic.dark.webp' } } };
    const both = new Set([...masters, '/content/media/articles/a/pic.dark.webp']);
    expect(loadContent(withDark, both).media.get('articles/a/pic')?.darkMaster).toBe('/content/media/articles/a/pic.dark.webp');
    expect(loadContent(base, masters).media.get('articles/a/pic')?.darkMaster).toBeUndefined();
    expect(problems(withDark, masters).join('\n')).toMatch(/pic\.json: dark\.file: its dark version content\/media\/articles\/a\/pic\.dark\.webp is missing/);
    expect(problems(base, both).join('\n')).toMatch(/pic\.dark\.webp: a dark version its picture doesn't name/);
    expect(problems({ ...base, '/content/media/articles/a/pic.json': { ...pic, dark: { file: 'other.dark.webp' } } }, new Set([...masters, '/content/media/articles/a/other.dark.webp'])).join('\n')).toMatch(/must share the sidecar's name/);
    expect(problems({ ...base, '/content/media/articles/a/pic.json': { ...pic, dark: { file: 'pic-dark.webp' } } }, both).join('\n')).toMatch(/dark\.file/);
  });

  it("an animated picture names its still poster, including an animated dark version", () => {
    const pic = base['/content/media/articles/a/pic.json'];
    const animated = {
      ...base,
      '/content/media/articles/a/pic.json': {
        ...pic,
        animation: { poster: 'pic.poster.webp' },
        dark: { file: 'pic.dark.webp', animation: { poster: 'pic.dark.poster.webp' } },
      },
    };
    const files = new Set([...masters, '/content/media/articles/a/pic.poster.webp', '/content/media/articles/a/pic.dark.webp', '/content/media/articles/a/pic.dark.poster.webp']);
    expect(loadContent(animated, files).media.get('articles/a/pic')).toMatchObject({
      posterMaster: '/content/media/articles/a/pic.poster.webp',
      darkMaster: '/content/media/articles/a/pic.dark.webp',
      darkPosterMaster: '/content/media/articles/a/pic.dark.poster.webp',
    });
    expect(problems(animated, new Set([...files].filter((file) => !file.endsWith('pic.poster.webp')))).join('\n')).toMatch(/animation\.poster: its animation poster .* is missing/);
    expect(problems(base, new Set([...masters, '/content/media/articles/a/pic.poster.webp'])).join('\n')).toMatch(/a poster its picture doesn't name/);
  });

  it('a video file (media.md §12): its sidecar names it and its poster; a video block shows it, or embeds one with its title and poster', () => {
    const article = base['/content/articles/a.json'];
    const clip = { '/content/media/articles/a/clip.json': { kind: 'video', file: 'clip.webm', title: 'A walk through', width: 1280, height: 720, duration: 12.5, poster: { file: 'clip.poster.webp' }, caption: 'The demo.', visibility: 'public' } };
    const files = new Set([...masters, '/content/media/articles/a/clip.webm', '/content/media/articles/a/clip.poster.webp']);
    const showing = { ...article, body: [{ type: 'video', media: 'articles/a/clip' }] };
    const c = loadContent({ ...base, ...clip, '/content/articles/a.json': showing }, files);
    expect(c.videos.get('articles/a/clip')).toMatchObject({ title: 'A walk through', master: '/content/media/articles/a/clip.webm', posterMaster: '/content/media/articles/a/clip.poster.webp' });
    expect(c.media.has('articles/a/clip')).toBe(false);
    // its files: the video and the poster it names, nothing else
    expect(problems({ ...base, ...clip }, masters).join('\n')).toMatch(/clip\.json: its video content\/media\/articles\/a\/clip\.webm is missing/);
    expect(problems({ ...base, ...clip }, new Set([...masters, '/content/media/articles/a/clip.webm'])).join('\n')).toMatch(/poster\.file: its poster .* is missing/);
    expect(problems(base, new Set([...masters, '/content/media/articles/a/clip.poster.webp'])).join('\n')).toMatch(/clip\.poster\.webp: a master without its sidecar/);
    const noPoster = { '/content/media/articles/a/clip.json': { ...clip['/content/media/articles/a/clip.json'], poster: undefined } };
    expect(problems({ ...base, ...noPoster }, files).join('\n')).toMatch(/clip\.poster\.webp: a poster its video doesn't name/);
    expect(problems({ ...base, '/content/media/articles/a/clip.json': { ...clip['/content/media/articles/a/clip.json'], file: 'clip.mov' } }, files).join('\n')).toMatch(/file/);
    // the block: a video file or an embed, not both nor neither; an embed with its title and poster; the file has to exist
    const embed = { provider: 'youtube', id: 'abc123' };
    const block = (b: object) => ({ ...base, ...clip, '/content/articles/a.json': { ...article, body: [{ type: 'video', ...b }] } });
    expect(problems(block({ media: 'articles/a/clip', embed, title: 'T', poster: 'articles/a/pic' }), files).join('\n')).toMatch(/one of the two/);
    expect(problems(block({}), files).join('\n')).toMatch(/one of the two/);
    expect(problems(block({ embed, poster: 'articles/a/pic' }), files).join('\n')).toMatch(/body\.0\.title: an embedded video needs its title/);
    expect(problems(block({ embed, title: 'T' }), files).join('\n')).toMatch(/body\.0\.poster: an embedded video needs a poster/);
    expect(problems(block({ embed, title: 'T', poster: 'articles/a/pic' }), files)).toEqual([]);
    expect(problems(block({ media: 'articles/a/nope' }), files).join('\n')).toMatch(/the video "articles\/a\/nope" doesn't exist/);
    // a picture isn't a video, nor a video a picture
    expect(problems(block({ media: 'articles/a/pic' }), files).join('\n')).toMatch(/the video "articles\/a\/pic" doesn't exist/);
    expect(problems({ ...base, ...clip, '/content/articles/a.json': { ...article, body: [{ type: 'figure', media: 'articles/a/clip' }] } }, files).join('\n')).toMatch(/media "articles\/a\/clip" doesn't exist/);
  });

  it("a video file's options: its own poster picture, actual size, autoplay and loop; an embed takes none of them but the poster", () => {
    const article = base['/content/articles/a.json'];
    const clip = { '/content/media/articles/a/clip.json': { kind: 'video', file: 'clip.webm', title: 'A walk through', width: 1280, height: 720, visibility: 'public' } };
    const files = new Set([...masters, '/content/media/articles/a/clip.webm']);
    const block = (b: object) => ({ ...base, ...clip, '/content/articles/a.json': { ...article, body: [{ type: 'video', ...b }] } });
    expect(problems(block({ media: 'articles/a/clip', poster: 'articles/a/pic', width: 'actual', autoplay: true, loop: true }), files)).toEqual([]);
    expect(problems(block({ media: 'articles/a/clip', poster: 'articles/a/nope' }), files).join('\n')).toMatch(/media "articles\/a\/nope" doesn't exist/);
    const embed = { embed: { provider: 'youtube', id: 'abc123' }, title: 'T', poster: 'articles/a/pic' };
    expect(problems(block({ ...embed, autoplay: true }), files).join('\n')).toMatch(/autoplay and loop are for a video file/);
    expect(problems(block({ ...embed, loop: false }), files).join('\n')).toMatch(/autoplay and loop are for a video file/);
    expect(problems(block({ ...embed, width: 'actual' }), files).join('\n')).toMatch(/body\.0\.width: actual size is for a video file/);
  });

  it('a gallery or a carousel can hold video files beside pictures; autoplay and loop are a video\'s', () => {
    const article = base['/content/articles/a.json'];
    const clip = { '/content/media/articles/a/clip.json': { kind: 'video', file: 'clip.webm', title: 'A walk through', width: 1280, height: 720, visibility: 'public' } };
    const files = new Set([...masters, '/content/media/articles/a/clip.webm']);
    const set = (type: string, items: object[]) => ({ ...base, ...clip, '/content/articles/a.json': { ...article, body: [{ type, items, ...(type === 'carousel' ? { label: 'Scenes' } : {}) }] } });
    for (const type of ['gallery', 'carousel']) {
      expect(problems(set(type, [{ media: 'articles/a/pic' }, { media: 'articles/a/clip', autoplay: true, loop: true }]), files), type).toEqual([]);
      expect(problems(set(type, [{ media: 'articles/a/pic', autoplay: true }, { media: 'articles/a/clip' }]), files).join('\n')).toMatch(/body\.0\.items\.0: autoplay and loop are for a video file, not a picture/);
      expect(problems(set(type, [{ media: 'articles/a/pic' }, { media: 'articles/a/nope' }]), files).join('\n')).toMatch(/media "articles\/a\/nope" doesn't exist \(a picture or a video file\)/);
    }
    // a video in a set is used, so it can't be deleted from under it (the editor's reference graph)
    expect(mediaUsed(set('gallery', [{ media: 'articles/a/pic' }, { media: 'articles/a/clip' }])['/content/articles/a.json'] as Article)).toContain('articles/a/clip');
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

  it('headings may repeat their words (each gets its own anchor), but two anchors set by hand must differ', () => {
    const article = base['/content/articles/a.json'];
    const heading = (text: string, id?: string) => ({ type: 'heading', level: 3, text, ...(id ? { id } : {}) });
    expect(problems({ ...base, '/content/articles/a.json': { ...article, body: [heading('What shipped'), heading('What shipped')] } })).toEqual([]);
    expect(problems({ ...base, '/content/articles/a.json': { ...article, body: [heading('One', 'shipped'), heading('Two', 'shipped')] } }).join('\n')).toMatch(/two headings have the anchor "shipped"/);
  });
  it('a block may carry a key (six letters and digits), and no two blocks of an article share one (ai-editing.md §3)', () => {
    const article = base['/content/articles/a.json'];
    const text = (key?: string) => ({ type: 'text', markdown: 'One.', ...(key ? { key } : {}) });
    expect(problems({ ...base, '/content/articles/a.json': { ...article, body: [text('k1a2b3'), text('x9y8z7'), text()] } })).toEqual([]);
    expect(problems({ ...base, '/content/articles/a.json': { ...article, body: [text('k1a2b3'), text('k1a2b3')] } }).join('\n')).toMatch(/two blocks have the key "k1a2b3"/);
    expect(block.safeParse({ type: 'figure', media: 'articles/a/pic', key: 'abc123' }).success).toBe(true);
    for (const bad of ['ABC123', 'abc12', 'abc1234', 'abc-12']) expect(block.safeParse({ type: 'divider', key: bad }).success).toBe(false);
  });
  it('a paragraph can ask for a drop cap (off unless it does)', () => {
    expect(block.safeParse({ type: 'text', markdown: 'Once.', dropcap: true }).success).toBe(true);
    expect(block.safeParse({ type: 'text', markdown: 'Once.' }).success).toBe(true);
    expect(block.safeParse({ type: 'text', markdown: 'Once.', dropcap: 'yes' }).success).toBe(false);
  });

  it('a heading 2 can carry a margin mark (shown unless switched off), and a section marker is a short line', () => {
    expect(block.safeParse({ type: 'heading', level: 2, text: 'Learning the medium', marker: '1' }).success).toBe(true);
    expect(block.safeParse({ type: 'heading', level: 2, text: 'Learning', marker: '1', showMarker: false }).success).toBe(true);
    expect(block.safeParse({ type: 'heading', level: 2, text: 'Learning', marker: '  ' }).success).toBe(false);
    expect(block.safeParse({ type: 'heading', level: 2, text: 'Learning', marker: 'x'.repeat(41) }).success).toBe(false);
    expect(block.safeParse({ type: 'marker', text: 'Chapter 1' }).success).toBe(true);
    expect(block.safeParse({ type: 'marker', text: '' }).success).toBe(false);
    expect(block.safeParse({ type: 'marker', text: 'x'.repeat(61) }).success).toBe(false);
  });

  it('a subheading is plain words, nothing more', () => {
    expect(block.safeParse({ type: 'subheading', text: 'What it was for' }).success).toBe(true);
    expect(block.safeParse({ type: 'subheading', text: '' }).success).toBe(false);
    expect(block.safeParse({ type: 'subheading', text: 'Words', level: 2 }).success).toBe(false);
  });

  it('issues name the file, the field and what is wrong', () => {
    const article = base['/content/articles/a.json'];
    try {
      loadContent({ ...base, '/content/articles/a.json': { ...article, summary: '' } }, masters);
    } catch (e) {
      expect((e as ContentError).issues).toContainEqual(expect.objectContaining({ file: 'content/articles/a.json', path: 'summary' }));
    }
  });

  it('an article that fails its own check is reported once: the node placing it is not also "missing"', () => {
    const article = base['/content/articles/a.json'];
    const issues = (() => {
      try {
        loadContent({ ...base, '/content/articles/a.json': { ...article, summary: 'x'.repeat(241) } }, masters);
        return [];
      } catch (e) {
        return (e as ContentError).issues;
      }
    })();
    expect(issues.map((i) => i.path)).toEqual(['summary']);
    // an article that really isn't there still is
    const { ['/content/articles/a.json']: _gone, ...without } = base;
    expect(problems(without).join('\n')).toMatch(/places article "a", which doesn't exist/);
  });
});

describe('albums: the content check (documentation/gallery/spec.md §16, V38 to V51)', () => {
  const M = '/content/media/articles/g/';
  const pic = (name: string, extra: Record<string, unknown> = {}) => ({ [`${M}${name}.json`]: { kind: 'image', file: `${name}.webp`, alt: `Picture ${name}.`, visibility: 'public', ...extra } });
  const page = (id: string, extra: Record<string, unknown>) => ({ id, type: 'article', kind: 'note', slug: id, title: id.toUpperCase(), summary: 'S', status: 'published', visibility: 'public', updatedAt: '2026-09-29', locale: 'en', body: [], ...extra });
  const base: Record<string, unknown> = {
    '/content/site.json': { name: 'N', description: 'D', owner: 'p', locale: 'en' },
    '/content/people/p.json': { id: 'p', name: 'P' },
    '/content/structures/site.json': {
      home: { id: 'home', kind: 'hub', slug: '', title: 'Home', children: [{ id: 's', kind: 'hub', slug: 's', title: 'S', view: 'albums', children: [{ id: 'a', kind: 'item', item: { type: 'article', id: 'a' } }, { id: 'g', kind: 'item', item: { type: 'article', id: 'g' } }] }] },
    },
    ...pic('one', { taken: '2026-03-12' }),
    ...pic('two'),
    [`${M}plan.json`]: { kind: 'image', file: 'plan.svg', alt: 'A floor plan.', visibility: 'public' },
    [`${M}clip.json`]: { kind: 'video', file: 'clip.mp4', title: 'A walk', width: 1920, height: 1080, captions: [{ file: 'clip.en.vtt', srclang: 'en', label: 'English' }], visibility: 'public' },
    '/content/articles/a.json': page('a', { body: [{ type: 'text', markdown: 'Words.' }] }),
    '/content/articles/g.json': page('g', {
      kind: 'gallery',
      album: {
        items: [
          { id: 'one', media: 'articles/g/one', place: 'Imphal' },
          { id: 'two', media: 'articles/g/two' },
          { id: 'plan', media: 'articles/g/plan' },
          { id: 'clip', media: 'articles/g/clip' },
          { id: 'talk', embed: { provider: 'youtube', id: 'dQw4w9WgXcQ' }, title: 'A talk', poster: 'articles/g/one' },
        ],
      },
    }),
  };
  const masters = new Set([`${M}one.webp`, `${M}two.webp`, `${M}plan.svg`, `${M}clip.mp4`, `${M}clip.en.vtt`]);
  type Docs = Record<string, any>;
  const edit = (change: (d: Docs) => void) => {
    const d = structuredClone(base) as Docs;
    change(d);
    return d;
  };
  const album = (d: Docs) => d['/content/articles/g.json'].album;
  const problems = (change: (d: Docs) => void, m = masters, sizes?: Map<string, number>) => {
    try {
      loadContent(edit(change), m, [], new Set(), sizes);
      return '';
    } catch (e) {
      return (e as ContentError).problems.join('\n');
    }
  };
  const warnings = (change: (d: Docs) => void, m = masters) => loadContent(edit(change), m).warnings.join('\n');

  it('a good album loads, in a section of the Albums view, with no warning', () => {
    const c = loadContent(base, masters);
    expect(c.articles.get('g')?.album?.items).toHaveLength(5);
    expect(c.media.get('articles/g/plan')?.master).toBe(`${M}plan.svg`);
    expect(c.videos.get('articles/g/clip')?.captions?.[0].file).toBe('clip.en.vtt');
    expect(c.warnings).toEqual([]);
  });

  it("a video's caption tracks are beside it, and named by it", () => {
    expect(problems(() => {}, new Set([...masters].filter((m) => !m.endsWith('.vtt'))))).toMatch(/clip\.json: captions: its caption track .*clip\.en\.vtt is missing/);
    expect(problems(() => {}, new Set([...masters, `${M}clip.fr.vtt`]))).toMatch(/clip\.fr\.vtt: a caption track no video names/);
    expect(problems((d) => (d[`${M}clip.json`].captions[0].file = 'other.en.vtt'), new Set([...masters, `${M}other.en.vtt`]))).toMatch(/must share the sidecar's name/);
  });

  it('V38: a published album has items, each with a unique ID, one of media and embed, a picture or a video file, and alt text', () => {
    expect(problems((d) => (album(d).items = []))).toMatch(/album\.items: a published album has at least one item.*V38/);
    expect(problems((d) => ((album(d).items = []), (d['/content/articles/g.json'].status = 'draft')))).toBe('');
    expect(problems((d) => (album(d).items[1].id = 'one'))).toMatch(/two items have the ID "one".*V38/);
    expect(problems((d) => (album(d).items[1].embed = { provider: 'youtube', id: 'dQw4w9WgXcQ' }))).toMatch(/exactly one of the two \(V38\)/);
    expect(problems((d) => (album(d).items[1].id = 'Not An ID'))).toMatch(/V38/);
    expect(problems((d) => (d[`${M}two.json`] = { kind: 'image', file: 'two.webp', decorative: true, visibility: 'public' }))).toMatch(/needs alt text.*never decorative.*V38/);
    expect(
      problems(
        (d) => ((d[`${M}cv.json`] = { kind: 'document', file: 'cv.pdf', title: 'CV', visibility: 'public' }), album(d).items.push({ id: 'cv', media: 'articles/g/cv' })),
        new Set([...masters, `${M}cv.pdf`]),
      ),
    ).toMatch(/media "articles\/g\/cv" doesn't exist \(a picture or a video file\)/);
  });

  it('V39: tiles name items once, inside the grid, never overlapping', () => {
    expect(problems((d) => (album(d).showcase = { tiles: [{ item: 'one', x: 0, y: 0, w: 6, h: 4 }, { item: 'two', x: 4, y: 2, w: 6, h: 4 }] }))).toMatch(/album\.showcase\.tiles\.1: the tiles of "one" and "two" overlap \(V39\)/);
    expect(problems((d) => (album(d).showcase = { tiles: [{ item: 'one', x: 8, y: 0, w: 6, h: 4 }] }))).toMatch(/inside the 12 columns \(V39\)/);
    expect(problems((d) => (album(d).showcase = { tiles: [{ item: 'nope', x: 0, y: 0, w: 6, h: 4 }] }))).toMatch(/"nope" isn't an item of the album \(V39\)/);
    expect(problems((d) => (album(d).showcase = { tiles: [] }))).toMatch(/at least one tile.*V39/);
  });

  it('V40: warns, never refuses: a hole, a tall band, a video without captions', () => {
    expect(warnings((d) => (album(d).showcase = { tiles: [{ item: 'one', x: 0, y: 0, w: 6, h: 10 }] }))).toMatch(/content\/articles\/g\.json: the band has .* empty cells.*V40[\s\S]*10 rows tall.*V40/);
    expect(warnings((d) => delete d[`${M}clip.json`].captions, new Set([...masters].filter((m) => !m.endsWith('.vtt'))))).toMatch(/"articles\/g\/clip" has no captions.*V40/);
  });

  it("V41: an item's caption and description, and the album's description, keep to their limits", () => {
    expect(problems((d) => (album(d).items[0].caption = 'x'.repeat(201)))).toMatch(/caption is at most 200 characters \(V41\)/);
    expect(problems((d) => (album(d).items[0].description = 'One.\n\nTwo.\n\nThree.\n\nFour.\n\nFive.'))).toMatch(/at most 4 paragraphs or lists \(V41\)/);
    expect(problems((d) => (album(d).description = 'x'.repeat(1501)))).toMatch(/at most 1500 characters \(V41\)/);
    expect(problems((d) => (album(d).description = 'The **trip**, in [pictures](https://example.com).'))).toBe('');
  });

  it('V42: a drawing is at most 200 KB, its dark version a drawing too, and never animated', () => {
    expect(problems(() => {}, masters, new Map([[`${M}plan.svg`, 300 * 1024]]))).toMatch(/plan\.json: file: the drawing is 300 KB: a drawing is at most 200 KB \(V42\)/);
    expect(problems((d) => (d[`${M}plan.json`].dark = { file: 'plan.dark.webp' }), new Set([...masters, `${M}plan.dark.webp`]))).toMatch(/V42/);
    expect(problems((d) => (d[`${M}plan.json`].dark = { file: 'plan.dark.svg' }), new Set([...masters, `${M}plan.dark.svg`]))).toBe('');
    expect(problems((d) => (d[`${M}plan.json`].animation = { poster: 'plan.poster.webp' }), new Set([...masters, `${M}plan.poster.webp`]))).toMatch(/a drawing has no animation.*V42/);
  });

  it('V43: an album only on a gallery page; a gallery page from before albums reads as an empty one', () => {
    expect(problems((d) => (d['/content/articles/a.json'].album = { items: [] }))).toMatch(/a\.json: album: an album belongs to a page of kind gallery, and this one is a note \(V43\)/);
    const legacy = edit((d) => (delete d['/content/articles/g.json'].album, (d['/content/articles/g.json'].body = [{ type: 'gallery', items: [{ media: 'articles/g/one' }, { media: 'articles/g/two' }] }])));
    expect(loadContent(legacy, masters).articles.get('g')?.album).toEqual({ items: [] });
  });

  it("V44: a private album's videos are at most 10 MB, and an open album shows nothing private (V25)", () => {
    const toPrivate = (d: Docs) => {
      d['/private/articles/g.json'] = d['/content/articles/g.json'];
      delete d['/content/articles/g.json'];
      d['/content/structures/site.json'].home.children[0].children.pop();
      d['/private/structures/overlay.json'] = { sections: [{ section: 's', pages: [{ id: 'g', token: 'secretaaa2', item: { type: 'article', id: 'g' } }] }] };
    };
    expect(problems(toPrivate)).toBe('');
    expect(problems(toPrivate, masters, new Map([[`${M}clip.mp4`, 11 * 1024 * 1024]]))).toMatch(/private\/articles\/g\.json: album\.items\.3\.media: .* at most 10 MB.*V44/);
    expect(problems(() => {}, masters, new Map([[`${M}clip.mp4`, 11 * 1024 * 1024]]))).toBe('');
    const privatePic = (d: Docs) => {
      d['/private/media/articles/g/two.json'] = d[`${M}two.json`];
      delete d[`${M}two.json`];
    };
    expect(problems(privatePic, new Set([...[...masters].filter((m) => !m.endsWith('two.webp')), '/private/media/articles/g/two.webp']))).toMatch(/media "articles\/g\/two" is private.*V25/);
  });

  it("V45: an embed is a provider's, with an ID of its shape, a title and a picture as its poster", () => {
    expect(problems((d) => (album(d).items[4].embed = { provider: 'vimeo', id: 'abc' }))).toMatch(/isn't a vimeo video's ID \(V45\)/);
    expect(problems((d) => (album(d).items[4].embed = { provider: 'dailymotion', id: 'x1' }))).toMatch(/album\.items\.4\.embed\.provider/);
    expect(problems((d) => delete album(d).items[4].title)).toMatch(/needs its title \(V45\)/);
    expect(problems((d) => delete album(d).items[4].poster)).toMatch(/needs a poster picture \(V45\)/);
    expect(problems((d) => (album(d).items[4].poster = 'articles/g/plan'))).toMatch(/poster is a picture.*V45/);
    expect(problems((d) => (album(d).items[4].poster = 'articles/g/clip'))).toMatch(/poster is a picture.*V45/);
  });

  it("V46: a page's social image is never a drawing", () => {
    expect(problems((d) => (d['/content/articles/g.json'].seo = { image: 'articles/g/plan' }))).toMatch(/seo\.image: a social image is a picture.*V46/);
    expect(problems((d) => (d['/content/articles/g.json'].seo = { image: 'articles/g/one' }))).toBe('');
  });

  it('V47: the phone arrangement names exactly the tiles shown on phones, never overlapping', () => {
    const tiles = [{ item: 'one', x: 0, y: 0, w: 6, h: 4 }, { item: 'two', x: 6, y: 0, w: 6, h: 4 }];
    const good = [{ item: 'one', x: 0, y: 0, w: 6, h: 4 }, { item: 'two', x: 0, y: 4, w: 6, h: 4 }];
    expect(problems((d) => (album(d).showcase = { tiles, phone: { tiles: good } }))).toBe('');
    expect(problems((d) => (album(d).showcase = { tiles, phone: { tiles: [good[0]] } }))).toMatch(/"two" is shown on phones but has no place there \(V47\)/);
    expect(problems((d) => (album(d).showcase = { tiles, phone: { tiles: [good[0], { ...good[1], y: 2 }] } }))).toMatch(/overlap \(V47\)/);
    expect(problems((d) => (album(d).showcase = { tiles: [{ ...tiles[0], onPhones: false }] }))).toMatch(/at least one tile is shown on phones \(V47\)/);
    expect(problems((d) => (album(d).showcase = { tiles, phone: { tiles: [{ item: 'one', x: 4, y: 0, w: 4, h: 4 }, good[1]] } }))).toMatch(/inside the 6 columns \(V47\)/);
  });

  it('V48: focus on a filled tile, play on a video file or an animated picture, two at most', () => {
    expect(problems((d) => (album(d).showcase = { tiles: [{ item: 'plan', x: 0, y: 0, w: 12, h: 6, focus: '20% 20%' }] }))).toMatch(/focus point is for a filled tile.*V48/);
    expect(problems((d) => (album(d).showcase = { tiles: [{ item: 'one', x: 0, y: 0, w: 12, h: 6, play: true }] }))).toMatch(/only a video file or an animated picture can play.*V48/);
    expect(problems((d) => (album(d).showcase = { tiles: [{ item: 'clip', x: 0, y: 0, w: 12, h: 6, play: true }] }))).toBe('');
    expect(problems((d) => (album(d).showcase = { tiles: [{ item: 'clip', x: 0, y: 0, w: 12, h: 6, play: true }] }), masters, new Map([[`${M}clip.mp4`, 11 * 1024 * 1024]]))).toMatch(/11 MB.*V48/);
  });

  it('V49: captions only with the grid; never a download or autoplay on an embed; autoplay is for a video file', () => {
    expect(problems((d) => Object.assign(album(d), { layout: 'story', captions: true }))).toMatch(/V49/);
    expect(problems((d) => Object.assign(album(d), { layout: 'story', download: true }))).toBe('');
    expect(problems((d) => (album(d).items[4].download = true))).toMatch(/an embed can't be downloaded.*V49/);
    expect(problems((d) => (album(d).items[0].autoplay = true))).toMatch(/not a picture \(V49\)/);
    expect(problems((d) => (album(d).items[3].loop = true))).toBe('');
  });

  it("V50: a place is one line of at most 80; a picture's date is real and not in the future; large only on a still picture over 2560 px", () => {
    expect(problems((d) => (album(d).items[0].place = 'x'.repeat(81)))).toMatch(/at most 80 characters \(V50\)/);
    expect(problems((d) => (album(d).items[0].place = 'Imphal\nManipur'))).toMatch(/one line.*V50/);
    expect(problems((d) => (d[`${M}one.json`].taken = '2026-02-30'))).toMatch(/one\.json: taken: a real date/);
    expect(problems((d) => (d[`${M}one.json`].taken = '2999-01-01'))).toMatch(/hasn't come yet.*V50/);
    const facts = (width: number) => ({ width, height: 2000, bg: 'rgb(0 0 0)', bytes: 900_000 });
    expect(problems((d) => Object.assign(d[`${M}one.json`], { large: true, facts: facts(3600) }))).toBe('');
    expect(problems((d) => Object.assign(d[`${M}one.json`], { large: true, facts: facts(2400) }))).toMatch(/more than 2560 px.*V50/);
    expect(problems((d) => Object.assign(d[`${M}plan.json`], { large: true }))).toMatch(/only a still picture is kept large.*V50/);
  });

  it('V51: an album block shows an open gallery page, not its own, published wherever its page is', () => {
    const block = (d: Docs, on: string, albumId: string) => d[`/content/articles/${on}.json`].body.push({ type: 'album', album: albumId, width: 'full' });
    expect(problems((d) => block(d, 'a', 'g'))).toBe('');
    expect(problems((d) => block(d, 'a', 'a'))).toMatch(/a page can't show its own album.*V51/);
    expect(problems((d) => block(d, 'g', 'g'))).toMatch(/a page can't show its own album.*V51/);
    expect(problems((d) => block(d, 'g', 'a'))).toMatch(/"a" is a note, not an album.*V51/);
    expect(problems((d) => block(d, 'a', 'nope'))).toMatch(/the album "nope" doesn't exist \(V51\)/);
    expect(problems((d) => (block(d, 'a', 'g'), (d['/content/articles/g.json'].status = 'draft')))).toMatch(/a\.json: body\.1\.album: the album "g" isn't published.*V51/);
    expect(problems((d) => (block(d, 'a', 'g'), (d['/content/articles/a.json'].status = 'draft'), (d['/content/articles/g.json'].status = 'draft')))).toBe('');
    const privateAlbum = (d: Docs) => {
      block(d, 'a', 'g');
      d['/private/articles/g.json'] = d['/content/articles/g.json'];
      delete d['/content/articles/g.json'];
      d['/content/structures/site.json'].home.children[0].children.pop();
      d['/private/structures/overlay.json'] = { sections: [{ section: 's', pages: [{ id: 'g', token: 'secretaaa2', item: { type: 'article', id: 'g' } }] }] };
    };
    expect(problems(privateAlbum)).toMatch(/"g" is a private album.*V51/);
  });
});

describe('the content in content/', () => {
  const c = content();
  const masters = walk(join(ROOT, 'content/media')).filter((f) => /\.(webp|jpe?g|png|avif|gif)$/.test(f));

  it('validates, and every published article has a page', () => {
    // dev leaves a broken file out (loadContentLeavingOut); the real content may leave nothing out
    expect(c.problems).toEqual([]);
    expect(c.warnings).toEqual([]);
    expect(c.canonical.get('article/do-what-makes-you-proud')).toBe('/leadership/do-what-makes-you-proud/');
  });

  it('every master is within its budget: 2560 px on the long side (3840 for a picture kept large) and 1.5 MB (a GIF, kept as it is, under 100 MB), with no location data', async () => {
    const over: string[] = [];
    // a picture kept large (gallery spec §4, V50) says so in its sidecar
    const large = (f: string) => {
      try {
        return JSON.parse(readFileSync(f.replace(/(\.dark)?(\.poster)?\.\w+$/, '.json'), 'utf8')).large === true;
      } catch {
        return false;
      }
    };
    for (const f of masters) {
      const m = await sharp(f).metadata();
      if (Math.max(m.width ?? 0, m.pageHeight ?? m.height ?? 0) > (large(f) ? 3840 : 2560)) over.push(`${key(f)}: ${m.width}x${m.pageHeight ?? m.height}`);
      const budget = f.endsWith('.gif') ? MAX_GIF_BYTES - 1 : (large(f) ? 3.5 : 1.5) * 1024 * 1024;
      if (statSync(f).size > budget) over.push(`${key(f)}: ${(statSync(f).size / 1048576).toFixed(2)} MB`);
      if (m.exif && /GPS/i.test(m.exif.toString('latin1'))) over.push(`${key(f)}: has GPS data`);
    }
    expect(over).toEqual([]);
  });

  it('every drawing is within its budget: an SVG of at most 200 KB (gallery spec §4.1)', () => {
    const over = walk(join(ROOT, 'content/media'))
      .filter((f) => /\.svg$/.test(f) && statSync(f).size > 200 * 1024)
      .map((f) => `${key(f)}: ${(statSync(f).size / 1024).toFixed(0)} KB`);
    expect(over).toEqual([]);
  });

  it('every file to download is within its budget: a PDF of at most 2 MB', () => {
    const pdfs = walk(join(ROOT, 'content/media')).filter((f) => f.endsWith('.pdf'));
    const over = pdfs.filter((f) => statSync(f).size > 2 * 1024 * 1024 || readFileSync(f).subarray(0, 5).toString('latin1') !== '%PDF-').map(key);
    expect(over).toEqual([]);
  });

  it('every video is under 100 MB, so GitHub takes it (media.md §12)', () => {
    const videos = walk(join(ROOT, 'content/media')).filter((f) => /\.(mp4|webm)$/.test(f));
    expect(videos.filter((f) => statSync(f).size >= MAX_VIDEO_BYTES).map(key)).toEqual([]);
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

describe('the collection block (items of one shape, in any layout)', () => {
  const ok = (b: unknown) => block.safeParse(b).success;
  const of = (items: unknown[], more: object = {}) => ({ type: 'collection', layout: 'tiles', items, ...more });

  it('takes items with any of a heading, a picture, a subtext and words, and at least one of them', () => {
    expect(ok(of([{ heading: 'Challenge', text: 'Re-energize the team.' }]))).toBe(true);
    expect(ok(of([{ heading: 'Year', subtext: '2024' }, { media: 'articles/a/cover' }, { text: 'Only words.' }]))).toBe(true);
    expect(ok(of([{}]))).toBe(false);
    expect(ok(of([]))).toBe(false);
    expect(ok(of([{ heading: 'x'.repeat(81) }]))).toBe(false);
    expect(ok(of([{ subtext: 'x'.repeat(161) }]))).toBe(false);
    // its words: a paragraph or a few (a blank line between), never blank, at most six
    expect(ok(of([{ text: 'one\n\ntwo' }]))).toBe(true);
    expect(ok(of([{ text: ' \n\n ' }]))).toBe(false);
    expect(ok(of([{ text: Array.from({ length: 7 }, (_, n) => `p${n}`).join('\n\n') }]))).toBe(false);
    expect(ok(of([{ label: 'the old tiles field' }]))).toBe(false);
    expect(ok(of(Array.from({ length: 25 }, (_, n) => ({ heading: `T${n}` }))))).toBe(false);
  });

  it("an item can say when it was, in a few words, but that alone isn't an item", () => {
    expect(ok(of([{ when: 'July 2019 to now', heading: 'Principal Design Manager', subtext: 'Microsoft' }], { layout: 'timeline' }))).toBe(true);
    expect(ok(of([{ when: '2016', media: 'articles/a/cover' }], { layout: 'timeline-scroll', label: 'Year by year' }))).toBe(true);
    expect(ok(of([{ when: '2016' }]))).toBe(false);
    expect(ok(of([{ when: '', heading: 'a' }]))).toBe(false);
    expect(ok(of([{ when: '   ', heading: 'a' }]))).toBe(false);
    expect(ok(of([{ when: 'x'.repeat(41), heading: 'a' }]))).toBe(false);
  });

  it('a strip can span the viewport and peek beside its column; any layout takes them, and shows full as wide where it must', () => {
    expect(ok(of([{ heading: 'a' }], { layout: 'carousel', width: 'full' }))).toBe(true);
    expect(ok(of([{ heading: 'a' }], { layout: 'timeline-scroll', peek: true }))).toBe(true);
    expect(ok(of([{ heading: 'a' }], { layout: 'tiles', width: 'full', peek: false }))).toBe(true);
    expect(ok(of([{ heading: 'a' }], { peek: 'yes' }))).toBe(false);
  });

  it('a single item, tiles one to a row, and prominent tiles', () => {
    expect(ok(of([{ heading: 'Core idea', text: 'Do what makes you proud.' }], { columns: 1, prominent: true }))).toBe(true);
    expect(ok(of([{ heading: 'a' }], { columns: 0 }))).toBe(false);
    expect(ok(of([{ heading: 'a' }], { prominent: 'yes' }))).toBe(false);
  });

  it('an item can be drawn by an illustration in its colours’ roles, instead of a picture', () => {
    const svg = '<svg viewBox="0 0 200 100"><title>Rising</title><path d="M0 90 L200 10" data-line="accent" pathLength="1" data-motion="draw"/></svg>';
    expect(ok(of([{ heading: '+20 pts', subtext: 'Share completion', svg }], { layout: 'stats' }))).toBe(true);
    expect(ok(of([{ svg }]))).toBe(true);
    expect(ok(of([{ svg, media: 'articles/a/cover' }]))).toBe(false);
    expect(ok(of([{ heading: 'a', svg: '<svg viewBox="0 0 1 1"><script>alert(1)</script></svg>' }]))).toBe(false);
    expect(ok(of([{ heading: 'a', svg: '<svg viewBox="0 0 1 1"><rect fill="#f00" width="1" height="1"/></svg>' }]))).toBe(false);
    expect(ok(of([{ heading: 'a', svg: '<img src="x">' }]))).toBe(false);
  });

  it('lays them out any of eight ways, with the options every picture has', () => {
    for (const layout of ['rows', 'columns', 'tiles', 'masonry', 'carousel', 'timeline', 'timeline-scroll', 'stats']) expect(ok(of([{ heading: 'a' }], { layout })), layout).toBe(true);
    expect(ok(of([{ heading: 'a' }], { layout: 'grid' }))).toBe(false);
    expect(ok({ type: 'collection', items: [{ heading: 'a' }] })).toBe(false);
    expect(ok(of([{ heading: 'a' }], { columns: 4, headings: 'title', label: 'Places', width: 'wide', ratio: '3/2', display: 'tile', background: true, rounded: false, shadow: true }))).toBe(true);
    expect(ok(of([{ heading: 'a' }], { columns: 5 }))).toBe(false);
    expect(ok(of([{ heading: 'a' }], { width: 'bleed' }))).toBe(false);
    expect(ok({ type: 'facts', items: [{ label: 'a', value: 'b' }] })).toBe(false);
    expect(ok({ type: 'tiles', items: [{ label: 'a', text: 'b' }, { label: 'c', text: 'd' }] })).toBe(false);
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

  it('"Explore in 3D" goes to a page, open in the building showing its section; to the building showing a section; else the plaza', () => {
    const c = loadContent(docs(undefined), new Set());
    const at = (path: string) => c.routes.find((r) => r.path === path);
    const planet = { places: [{ id: 'workshop' as const, title: 'Workshop', kicker: 'K', summary: 'S', site: 'work' }] };
    expect(exploreHref(at('/work/'), planet)).toBe('/play/?at=workshop');
    expect(exploreHref(at('/work/a/'), planet)).toBe('/play/?at=workshop&open=1&page=a');
    expect(exploreHref(at('/about/b/'), planet)).toBe('/play/');
    expect(exploreHref(at('/about/'), planet)).toBe('/play/');
    expect(exploreHref(at('/'), planet)).toBe('/play/');
    expect(exploreHref()).toBe('/play/');
  });
});

describe('the planet structure (documentation/sections/spec.md §5)', () => {
  const ALL = ['workshop', 'town-hall', 'lighthouse', 'library', 'amphitheater', 'greenhouse', 'post-office'];
  const places = (over: Record<string, object> = {}) => ALL.map((id) => ({ id, title: id, kicker: 'K', summary: 'S', site: `s-${id}`, ...(over[id] ?? {}) }));
  const page = (id: string, status = 'published') => ({ id, type: 'article', kind: 'note', slug: id, title: id.toUpperCase(), summary: 'S', status, visibility: 'public', updatedAt: '2026-09-30', locale: 'en', body: [] });
  const docs = (planet: unknown) => ({
    '/content/site.json': { name: 'N', description: 'D', owner: 'p', locale: 'en' },
    '/content/people/p.json': { id: 'p', name: 'P' },
    '/content/articles/a.json': page('a'),
    '/content/articles/b.json': page('b', 'draft'),
    '/content/articles/c.json': page('c'),
    '/content/structures/site.json': {
      home: {
        id: 'home',
        kind: 'hub',
        slug: '',
        title: 'Home',
        children: ALL.map((id) => ({
          id: `s-${id}`,
          kind: 'hub',
          slug: id,
          title: id,
          children: id === 'workshop' ? ['c', 'b', 'a'].map((p) => ({ id: p, kind: 'item', item: { type: 'article', id: p } })) : [],
        })),
      },
    },
    '/content/structures/modes/little-planet.json': planet,
  });
  const problems = (d: Record<string, unknown>) => {
    try {
      loadContent(d, new Set());
      return '';
    } catch (e) {
      return (e as ContentError).problems.join('\n');
    }
  };

  it('loads each building once, with the section it shows', () => {
    const c = loadContent(docs({ places: places() }), new Set());
    expect(c.planet?.places.find((p) => p.id === 'workshop')?.site).toBe('s-workshop');
  });

  it('refuses a missing or doubled building (V14), an unknown one, a section shown by two (V15) and a site that isn’t a section (V16)', () => {
    expect(problems(docs({ places: places().filter((p) => p.id !== 'library') }))).toMatch(/the library is missing/);
    expect(problems(docs({ places: [...places(), places()[0]] }))).toMatch(/the workshop is listed 2 times/);
    expect(problems(docs({ places: [...places(), { ...places()[0], id: 'castle' }] }))).toMatch(/places\.7\.id/);
    expect(problems(docs({ places: places({ library: { site: 's-workshop' } }) }))).toMatch(/the workshop and the library both show "s-workshop"/);
    expect(problems(docs({ places: places({ workshop: { site: 'home' } }) }))).toMatch(/"home" isn't a section of the site/);
    expect(problems(docs({ places: places({ workshop: { site: 'nowhere' } }) }))).toMatch(/"nowhere" isn't a section/);
    expect(problems(docs({ places: places().map(({ site, ...p }) => p) }))).toMatch(/places\.0\.site/);
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
  it('renames Talks to Gallery without changing its identity or amphitheater mapping, and shows its albums (gallery G2)', () => {
    const c = content();
    const section = c.routes.find((r) => r.node.id === 'talks');
    expect(section).toMatchObject({
      path: '/gallery/',
      label: 'Gallery',
      node: { id: 'talks', kind: 'hub', slug: 'gallery', title: 'Gallery', summary: 'A visual way to explore my work.', view: 'albums', children: [] },
    });
    expect(c.routes.some((r) => r.path === '/talks/')).toBe(false);
    const nav = siteNav(c.structure, c.routes, section);
    expect(nav).toContainEqual({ label: 'Gallery', href: '/gallery/', current: true });
    expect(nav.some((n) => n.label === 'Talks')).toBe(false);
    expect(c.planet?.places.find((p) => p.id === 'amphitheater')).toMatchObject({
      title: 'Amphitheater', kicker: 'Gallery', summary: 'A visual way to explore my work.', site: 'talks',
    });
    expect(placeSection('amphitheater')).toBe(section);
    expect(placePages('amphitheater')).toEqual([]);
    expect(exploreHref(section, c.planet)).toBe('/play/?at=amphitheater');
    expect(c.redirects).toContainEqual({ from: '/classic/amphitheater/', to: '/gallery/' });
  });

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
