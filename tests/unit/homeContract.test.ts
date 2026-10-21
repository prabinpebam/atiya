/**
 * The home page's content contract (documentation/home-views/foundation.md §2, curation.md §2, plan.md stage 1):
 * the spine (content/showcase.json), the vocabulary (content/topics.json) and the ways file's home key. A failing
 * and a passing case for each refusal, on a small made-up site.
 */
import { describe, expect, it } from 'vitest';
import { ContentError, loadContent, loadContentLeavingOut } from '../../src/site/content/load';
import { article } from '../../src/site/content/schema';
import { capability, proofItem, showcaseFile, type Showcase } from '../../src/site/home/schema';
import { buildEvidence } from '../../src/site/home/evidence';
import { curate } from '../../src/site/home/curate';
import { questionsOf, QUESTIONS_DEFAULTS } from '../../src/site/home/questions';

const page = (id: string, extra: Record<string, unknown> = {}) => ({
  id, type: 'article', kind: 'note', slug: id, title: id.toUpperCase(), summary: 'S', status: 'published', visibility: 'public', updatedAt: '2026-09-30', locale: 'en', body: [], ...extra,
});
const text = (markdown: string) => ({ type: 'text', markdown });
const item = (id: string) => ({ id, kind: 'item', item: { type: 'article', id } });

const SHOWCASE: Showcase = {
  goal: 'hired',
  facts: [{ id: 'years', text: '12 years', source: 'ref:article/case' }],
  capabilities: [
    {
      id: 'lead', name: 'Leadership', short: 'Lead', line: 'Built the org', lens: ['boss'],
      proof: [{ kind: 'led', resume: 'Built the design org from scratch' }],
      voice: { recommendation: 'ana', quote: "she's a great manager who stays deeply involved" },
    },
    { id: 'strat', name: 'Strategy', short: 'Strategy', line: 'Grew it to 3,530', match: { topics: ['strategy'], sections: ['work'] }, proof: [{ kind: 'shipped', ref: 'ref:article/case' }] },
    { id: 'ai', name: 'AI', short: 'AI', line: 'Builds with AI', match: { topics: ['ai'] }, media: 'articles/case/pic' },
  ],
  lenses: [{ id: 'boss', label: 'Leader', order: ['lead', 'strat'], voice: 'ana' }],
  highlights: [{ id: 'tool', ref: 'ref:article/tool', capability: 'ai' }],
};

const docs = (over: { showcase?: unknown; topics?: unknown; ways?: unknown; site?: Record<string, unknown> } = {}) => ({
  '/content/site.json': { name: 'N', description: 'D', owner: 'p', locale: 'en', contactPage: 'contact', resumePage: 'resume', ...over.site },
  '/content/people/p.json': { id: 'p', name: 'P' },
  '/content/structures/site.json': {
    home: {
      id: 'home', kind: 'hub', slug: '', title: 'Home',
      children: [
        { id: 'work', kind: 'hub', slug: 'work', title: 'Work', children: [item('case'), item('draft')] },
        { id: 'projects', kind: 'hub', slug: 'projects', title: 'Projects', children: [item('tool'), item('essay')] },
        { id: 'about', kind: 'hub', slug: 'about', title: 'About', children: [item('resume'), item('contact')] },
      ],
    },
  },
  '/content/media/articles/case/pic.json': { kind: 'image', file: 'pic.webp', alt: 'A picture.', visibility: 'public' },
  '/content/articles/case.json': page('case', { contribution: 'shipped', topics: ['strategy'], publishedAt: '2025-05-01', hero: { media: 'articles/case/pic' }, body: [text('We grew it to 3,530 people over 12 years.')] }),
  '/content/articles/draft.json': page('draft', { status: 'draft' }),
  '/content/articles/tool.json': page('tool', { contribution: 'built', topics: ['ai'], hero: { media: 'articles/case/pic' } }),
  '/content/articles/essay.json': page('essay', { topics: ['ai'] }),
  '/content/articles/resume.json': page('resume', { kind: 'page', body: [text('Built the design org from scratch. Managing teams of 5–9 designers.')] }),
  '/content/articles/contact.json': page('contact', { kind: 'page' }),
  '/private/articles/secret.json': page('secret'),
  '/private/structures/overlay.json': { sections: [{ section: 'work', pages: [{ id: 'secret', token: 'secretaaa2', item: { type: 'article', id: 'secret' } }] }] },
  '/content/recommendations.json': {
    items: [
      { id: 'ana', name: 'Ana', title: 'VP', text: 'Ana here. She’s a great manager who stays deeply involved in the work.' },
      { id: 'bo', name: 'Bo', title: 'Director', text: 'Bo says he builds things.', hidden: true },
    ],
  },
  '/content/topics.json': over.topics ?? { topics: [{ id: 'ai', label: 'AI' }, { id: 'strategy', label: 'Strategy', synonyms: ['roadmap'] }] },
  '/content/showcase.json': over.showcase ?? SHOWCASE,
  ...(over.ways ? { '/content/structures/ways.json': over.ways } : {}),
});
const masters = new Set(['/content/media/articles/case/pic.webp']);

const problems = (d: Record<string, unknown>) => {
  try {
    loadContent(d, masters);
    return '';
  } catch (e) {
    if (!(e instanceof ContentError)) throw e;
    return e.problems.join('\n');
  }
};
/** The problems of the spine with one change made to a copy of it. */
const withShowcase = (change: (s: Showcase) => void) => {
  const s = structuredClone(SHOWCASE);
  change(s);
  return problems(docs({ showcase: s }));
};
const withHome = (home: unknown) => problems(docs({ ways: { modes: [], primary: 'site', home } }));

describe('the spine loads', () => {
  it('a valid spine and vocabulary load, with the ways file’s home key', () => {
    expect(problems(docs({ ways: { modes: [], primary: 'site', home: { default: 'classic', offered: ['classic'], settings: { bento: { density: 'full' } } } } }))).toBe('');
    const c = loadContent(docs(), masters);
    expect(c.showcase?.capabilities.map((x) => x.id)).toEqual(['lead', 'strat', 'ai']);
    expect(c.topics?.topics).toHaveLength(2);
  });

  it('a site without a spine or a vocabulary loads as before', () => {
    const d: Record<string, unknown> = docs();
    delete d['/content/showcase.json'];
    delete d['/content/topics.json'];
    const c = loadContent(d, masters);
    expect(c.showcase).toBeNull();
    expect(c.topics).toBeNull();
  });

  it('a page’s part in the work is one of the kinds of proof', () => {
    expect(article.safeParse(page('x', { contribution: 'built' })).success).toBe(true);
    expect(article.safeParse(page('x', { contribution: 'invented' })).success).toBe(false);
  });

  it('the résumé page is a page, never a section', () => {
    expect(problems(docs({ site: { resumePage: 'about' } }))).toMatch(/resumePage "about" is a section/);
    expect(problems(docs({ site: { resumePage: 'nowhere' } }))).toMatch(/resumePage/);
  });
});

describe('the shapes refuse', () => {
  it('a proof item points at exactly one thing, with a kind that fits it', () => {
    const ok = (p: unknown) => proofItem.safeParse(p).success;
    expect(ok({ ref: 'ref:article/a' })).toBe(true);
    expect(ok({ kind: 'led', resume: 'Led the team' })).toBe(true);
    expect(ok({ recommendation: 'ana' })).toBe(true);
    expect(ok({ kind: 'said', recommendation: 'ana' })).toBe(true);
    expect(ok({})).toBe(false);
    expect(ok({ ref: 'ref:article/a', recommendation: 'ana' })).toBe(false);
    expect(ok({ resume: 'Led the team' })).toBe(false);
    expect(ok({ kind: 'led', recommendation: 'ana' })).toBe(false);
    expect(ok({ kind: 'said', ref: 'ref:article/a' })).toBe(false);
    expect(ok({ ref: 'ref:media/a' })).toBe(false);
  });

  it('a strength’s line is 6 words at most, its short name 12 characters, its quote 12 words', () => {
    const base = { id: 'x', name: 'X', short: 'X', line: 'One two three four five six' };
    expect(capability.safeParse(base).success).toBe(true);
    expect(capability.safeParse({ ...base, line: 'One two three four five six seven' }).success).toBe(false);
    expect(capability.safeParse({ ...base, short: 'Thirteen char' }).success).toBe(false);
    expect(capability.safeParse({ ...base, voice: { recommendation: 'a', quote: 'one two three four five six seven eight nine ten eleven twelve thirteen' } }).success).toBe(false);
  });

  it('six strengths at most', () => {
    const cap = (id: string) => ({ id, name: id, short: id, line: 'A line' });
    expect(showcaseFile.safeParse({ capabilities: ['a', 'b', 'c', 'd', 'e', 'f'].map(cap) }).success).toBe(true);
    const seven = showcaseFile.safeParse({ capabilities: ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(cap) });
    expect(seven.success).toBe(false);
    expect(JSON.stringify(seven.error?.issues)).toMatch(/six strengths at most/);
  });
});

describe('the content check refuses', () => {
  it('a page that isn’t a page of the site', () => {
    expect(withShowcase((s) => s.capabilities[1].proof!.push({ ref: 'ref:article/gone' }))).toMatch(/"gone" isn't a page of the site/);
  });

  it('saved page picks can wait for publication in every home-view reference', () => {
    expect(withShowcase((s) => {
      s.capabilities[1].proof!.push({ ref: 'ref:article/draft' });
      s.capabilities[2].hide = ['ref:article/draft'];
      s.highlights!.push({ ref: 'ref:article/draft', capability: 'ai' });
      s.hideHighlights = ['ref:article/draft'];
      s.held = { proof: { ai: ['ref:article/draft'] }, highlights: [{ ref: 'ref:article/draft', capability: 'ai' }] };
      s.questions = [{ id: 'q', question: 'Why?', answer: 'Because.', capabilities: ['ai'], proof: [{ ref: 'ref:article/draft' }] }];
      s.reel = { chapters: [{ capability: 'ai', highlight: 'ref:article/draft' }] };
    })).toBe('');
  });

  it('facts still need a published source because their words are shown directly', () => {
    expect(withShowcase((s) => {
      s.facts = [{ id: 'draft-fact', text: 'S', source: 'ref:article/draft' }];
    })).toMatch(/"draft" isn't published/);
  });

  it('a private page, wherever the spine names it', () => {
    const msg = /"secret" is a private page: the home page names open pages only/;
    expect(withShowcase((s) => s.capabilities[1].proof!.push({ ref: 'ref:article/secret' }))).toMatch(msg);
    expect(withShowcase((s) => (s.capabilities[1].hide = ['ref:article/secret']))).toMatch(msg);
    expect(withShowcase((s) => s.highlights!.push({ ref: 'ref:article/secret', capability: 'ai' }))).toMatch(msg);
    expect(withShowcase((s) => (s.held = { proof: { ai: ['ref:article/secret'] }, highlights: [] }))).toMatch(msg);
    expect(withShowcase((s) => (s.facts = [{ id: 'x', text: 'S', source: 'ref:article/secret' }]))).toMatch(msg);
  });

  it('the résumé or contact page as proof: a line from it instead', () => {
    expect(withShowcase((s) => s.capabilities[0].proof!.push({ kind: 'led', ref: 'ref:article/resume' }))).toMatch(/"resume" is the résumé page: pin a line from it instead/);
    expect(withShowcase((s) => s.capabilities[0].proof!.push({ ref: 'ref:article/contact' }))).toMatch(/"contact" is the contact page/);
  });

  it('a résumé line, a quote or a fact that isn’t word for word in its source', () => {
    expect(withShowcase((s) => s.capabilities[0].proof!.push({ kind: 'led', resume: 'Built the design org in a week' }))).toMatch(/isn't on the résumé page word for word/);
    // case and spacing and curly quotes don't matter; the words do
    expect(withShowcase((s) => s.capabilities[0].proof!.push({ kind: 'led', resume: 'managing  TEAMS of 5–9 designers' }))).toBe('');
    expect(withShowcase((s) => (s.capabilities[0].voice!.quote = 'a great manager who stays far away'))).toMatch(/isn't in Ana's recommendation word for word/);
    expect(withShowcase((s) => (s.facts = [{ id: 'years', text: '20 years', source: 'ref:article/case' }]))).toMatch(/"20 years" isn't on "case" word for word/);
  });

  it('a quotation in an answer that isn’t word for word in a shown recommendation or an open page', () => {
    const answer = (text: string) => withShowcase((s) => (s.questions = [{ id: 'q', question: 'Q?', answer: text, capabilities: ['lead'] }]));
    expect(answer('Ana calls her “a great manager who stays deeply involved”.')).toBe('');
    // the résumé page is an open page too, and the words are matched as normalised
    expect(answer('On the résumé: "managing  TEAMS of 5–9 designers".')).toBe('');
    expect(answer('No quotation, so nothing to find.')).toBe('');
    expect(answer('Ana calls her “a great manager who stays far away”.')).toMatch(/"a great manager who stays far away" isn't in a recommendation or an open page word for word/);
    // a hidden recommendation, and a draft's words, aren't sources
    expect(answer('Bo says “he builds things”.')).toMatch(/"he builds things" isn't in a recommendation/);
  });

  it('a résumé line on a site without a résumé page', () => {
    const d = docs();
    const site = { ...(d['/content/site.json'] as Record<string, unknown>) };
    delete site.resumePage;
    expect(problems({ ...d, '/content/site.json': site })).toMatch(/a résumé line needs the site's résumé page/);
  });

  it('a recommendation that doesn’t exist or is hidden', () => {
    expect(withShowcase((s) => (s.capabilities[0].voice = { recommendation: 'cy', quote: 'hello' }))).toMatch(/the recommendation "cy" doesn't exist/);
    expect(withShowcase((s) => (s.capabilities[0].voice = { recommendation: 'bo', quote: 'he builds things' }))).toMatch(/the recommendation "bo" is hidden/);
    expect(withShowcase((s) => (s.lenses![0].voice = 'cy'))).toMatch(/the recommendation "cy" doesn't exist/);
  });

  it('two of anything with one ID', () => {
    expect(withShowcase((s) => s.capabilities.push({ ...s.capabilities[2] }))).toMatch(/two strengths have the ID "ai"/);
    expect(withShowcase((s) => s.lenses!.push({ id: 'boss', label: 'Again' }))).toMatch(/two lenses have the ID "boss"/);
    expect(withShowcase((s) => (s.highlights = [{ id: 'h', ref: 'ref:article/tool', capability: 'ai' }, { id: 'h', ref: 'ref:article/essay', capability: 'ai' }]))).toMatch(/two highlights have the ID "h"/);
    expect(problems(docs({ topics: { topics: [{ id: 'ai', label: 'AI' }, { id: 'ai', label: 'Again' }] } }))).toMatch(/the topic "ai" is listed twice/);
  });

  it('a page both pinned and hidden, or pinned twice', () => {
    expect(withShowcase((s) => (s.capabilities[1].hide = ['ref:article/case']))).toMatch(/Strategy both pins and hides "case"/);
    expect(withShowcase((s) => (s.capabilities[1].hide = ['ref:article/essay']))).toBe('');
    expect(withShowcase((s) => s.capabilities[1].proof!.push({ ref: 'ref:article/case' }))).toMatch(/Strategy pins the same thing twice/);
  });

  it('a strength, lens, topic or section that doesn’t exist', () => {
    expect(withShowcase((s) => (s.highlights![0].capability = 'nope'))).toMatch(/"nope" isn't one of your strengths/);
    expect(withShowcase((s) => s.lenses![0].order!.push('nope'))).toMatch(/"nope" isn't one of your strengths/);
    expect(withShowcase((s) => s.lenses![0].order!.push('lead'))).toMatch(/the lens "Leader" lists "lead" twice/);
    expect(withShowcase((s) => (s.capabilities[0].lens = ['nope']))).toMatch(/"nope" isn't one of your lenses/);
    expect(withShowcase((s) => (s.capabilities[2].match = { topics: ['quantum'] }))).toMatch(/"quantum" is neither in content\/topics.json nor a topic of an open page/);
    expect(withShowcase((s) => (s.curation = { leaveOut: { sections: ['nowhere'] } }))).toMatch(/"nowhere" isn't a section of the site/);
    expect(withShowcase((s) => (s.questions = [{ id: 'q', question: 'Q?', answer: 'A.', capabilities: ['nope'] }]))).toMatch(/"nope" isn't one of your strengths/);
    expect(withShowcase((s) => (s.reel = { chapters: [{ capability: 'nope' }] }))).toMatch(/"nope" isn't one of your strengths/);
  });

  it('a topic of an open page is fine without the vocabulary', () => {
    expect(problems(docs({ topics: { topics: [] } }))).toBe('');
  });

  it('a picture that doesn’t exist', () => {
    expect(withShowcase((s) => (s.capabilities[2].media = 'articles/case/gone'))).toMatch(/media "articles\/case\/gone" doesn't exist/);
  });
});

describe('unpublishing home-view evidence', () => {
  it.each([false, true])('keeps pins but hides unpublished evidence and restores it on republish (held: %s)', (held) => {
    const s = structuredClone(SHOWCASE);
    s.capabilities[2].proof = [{ ref: 'ref:article/tool' }];
    s.questions = [{ id: 'q', question: 'Why?', answer: 'Because.', capabilities: ['ai'], proof: [{ ref: 'ref:article/tool' }] }];
    if (held) {
      s.curation = { hold: true };
      s.held = { proof: { ai: ['ref:article/tool'] }, highlights: [{ ref: 'ref:article/tool', capability: 'ai' }] };
    }
    const d = docs({ showcase: s });
    const model = () => {
      const c = loadContent(d, masters);
      const evidence = buildEvidence(c);
      const picks = curate({ showcase: c.showcase!, evidence });
      const questions = questionsOf({
        questions: c.showcase!.questions, picks, evidence, settings: QUESTIONS_DEFAULTS,
        env: { pageHref: (id) => evidence.byId.has(id) ? `/pages/${id}/` : undefined, person: () => undefined },
      });
      return { c, evidence, picks, questions };
    };
    expect(model().questions.answers[0].evidence.some((p) => p.key === 'page:tool')).toBe(true);
    d['/content/articles/tool.json'] = page('tool', { status: 'draft' });
    const draft = model();
    expect(draft.c.showcase).toEqual(s);
    expect(draft.evidence.open.has('tool')).toBe(false);
    expect(draft.picks.strengths.flatMap((p) => p.all).some((p) => p.id === 'tool')).toBe(false);
    expect(draft.picks.highlights.some((p) => p.id === 'tool')).toBe(false);
    expect(draft.picks.reel.some((p) => p.id === 'tool')).toBe(false);
    expect(draft.questions.answers[0].evidence.some((p) => p.key === 'page:tool')).toBe(false);
    d['/content/articles/tool.json'] = page('tool');
    expect(model().questions.answers[0].evidence.some((p) => p.key === 'page:tool')).toBe(true);
    expect(model().picks.highlights.some((p) => p.id === 'tool')).toBe(true);
  });
});

describe('the ways file’s home key', () => {
  it('the default is one of the views offered', () => {
    expect(withHome({ default: 'classic', offered: ['classic'] })).toBe('');
    expect(withHome({ default: 'classic' })).toBe('');
    expect(withHome({ default: 'classic', offered: [] })).toMatch(/the default view, Classic, isn't one of the views offered/);
  });

  it('only a view built in this engine is offered', () => {
    expect(withHome({ default: 'classic', offered: ['classic', 'showreel'] })).toMatch(/Showreel isn't built in this engine yet/);
    expect(withHome({ default: 'classic', offered: ['classic', 'questions'] })).toBe('');
    expect(withHome({ default: 'classic', offered: ['classic', 'classic'] })).toMatch(/Classic is offered twice/);
    expect(withHome({ default: 'unknown' })).not.toBe('');
  });

  it('a setting the view has, with a value it takes', () => {
    expect(withHome({ settings: { bento: { density: 'full', order: 'strongest' }, spotlight: { count: 6 }, 'proof-grid': { columns: ['led', 'said'] }, cover: { story: 'tool' } } })).toBe('');
    expect(withHome({ settings: { bento: { loudness: 'high' } } })).toMatch(/Bento has no setting "loudness"/);
    expect(withHome({ settings: { bento: { density: 'loud' } } })).toMatch(/is one of calm, full/);
    expect(withHome({ settings: { spotlight: { count: 9 } } })).toMatch(/a whole number from 4 to 8/);
    expect(withHome({ settings: { 'proof-grid': { columns: ['led', 'led'] } } })).toMatch(/a list of kinds of proof/);
    expect(withHome({ settings: { cover: { story: 'ref:article/essay' } } })).toMatch(/one of your highlights/);
    expect(withHome({ settings: { cover: { picture: 'articles/case/gone' } } })).toMatch(/a public picture/);
  });
});

describe('dev leaves a broken spine out, not the site', () => {
  it('a broken spine or vocabulary is left out and reported; the home page is then the Classic hub', () => {
    const broken = structuredClone(SHOWCASE);
    broken.capabilities[1].proof!.push({ ref: 'ref:article/gone' });
    const c = loadContentLeavingOut(docs({ showcase: broken }), masters);
    expect(c.showcase).toBeNull();
    expect(c.problems.map((p) => p.file)).toContain('content/showcase.json');
    expect(loadContentLeavingOut(docs({ topics: { topics: 'none' } }), masters).topics).toBeNull();
  });

  it('a broken home key in the ways file isn’t left out: it stops dev as it stops a build', () => {
    expect(() => loadContentLeavingOut(docs({ ways: { modes: [], primary: 'site', home: { default: 'classic', offered: [] } } }), masters)).toThrow(ContentError);
  });

  it('a page already failing its own check isn’t reported again through the spine', () => {
    const d = docs();
    const c = loadContentLeavingOut({ ...d, '/content/articles/case.json': { ...(d['/content/articles/case.json'] as object), summary: '' } }, masters);
    expect(c.problems.map((p) => p.file)).toEqual(['content/articles/case.json']);
    expect(c.showcase).not.toBeNull();
  });
});
