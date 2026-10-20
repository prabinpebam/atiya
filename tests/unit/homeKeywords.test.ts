import { describe, expect, it } from 'vitest';
import { KEYWORDS_DEFAULTS, keywordsField, keywordsSettings, sizeOf } from '../../src/site/home/keywords';
import { normalise, type Evidence, type EvidenceIndex } from '../../src/site/home/evidence';
import type { Topic } from '../../src/site/home/schema';
import { askAbout, fold, matchesFor, pickStatus, picksFrom, slugOf, suggest, withPicks, type IndexedKeyword } from '../../src/site/scripts/keywordsRules';
import { env, page, picks, resume, said, strength } from './homeFixtures';

/** A page of evidence: its words as given, normalised as the index keeps them. */
const ev = (id: string, o: { title?: string; summary?: string; headings?: string[]; body?: string; topics?: string[] } = {}): Evidence => {
  const title = o.title ?? `Title ${id}`;
  const summary = o.summary ?? `Summary of ${id}`;
  return {
    ref: `ref:article/${id}`,
    id,
    title,
    summary,
    topics: o.topics ?? [],
    time: 0,
    year: 2026,
    words: 100,
    figures: 0,
    numbers: 0,
    depth: 0.1,
    linksIn: 0,
    stale: false,
    text: { title: normalise(title), summary: normalise(summary), headings: (o.headings ?? []).map(normalise), body: normalise(o.body ?? '') },
  };
};

const index = (pages: Evidence[], recommendations: EvidenceIndex['recommendations'] = []): EvidenceIndex => ({
  pages,
  byId: new Map(pages.map((p) => [p.id, p])),
  open: new Set(pages.map((p) => p.id)),
  sections: new Map(),
  topicsInUse: new Set(pages.flatMap((p) => p.topics)),
  recommendations,
  now: 0,
});

const TOPICS: Topic[] = [
  { id: 'ai', label: 'AI', synonyms: ['generative AI'] },
  { id: 'figma-plugin', label: 'Figma plugin', synonyms: ['Figma plugins'] },
] as Topic[];

describe('Keywords settings', () => {
  it('fills in the defaults: lively, your order, typing on, 6 to a group', () => {
    expect(keywordsSettings()).toEqual(KEYWORDS_DEFAULTS);
    expect(KEYWORDS_DEFAULTS).toEqual({ motion: 'lively', order: 'yours', typing: 'on', perGroup: 6 });
  });

  it('keeps Per group between 4 and 8, and takes anything unknown as its default', () => {
    expect(keywordsSettings({ perGroup: 2 }).perGroup).toBe(4);
    expect(keywordsSettings({ perGroup: 20 }).perGroup).toBe(8);
    expect(keywordsSettings({ perGroup: 5.4 }).perGroup).toBe(5);
    expect(keywordsSettings({ motion: 'wild', order: 'random', typing: 'maybe' })).toEqual(KEYWORDS_DEFAULTS);
    expect(keywordsSettings({ motion: 'still', order: 'strongest', typing: 'off' })).toMatchObject({ motion: 'still', order: 'strongest', typing: 'off' });
  });
});

describe('Keywords field', () => {
  const pages = [
    ev('agent', { title: 'An agentic assistant', summary: 'Shipped agentic AI to millions', topics: ['ai'] }),
    ev('plugin', { title: 'Cloner Pro', summary: 'A Figma plugin', topics: ['figma-plugin'] }),
    ev('essay', { title: 'On craft', body: 'Prototyping matters. Prototyping in code matters more.' }),
    ev('once', { title: 'A note', body: 'One mention of prototyping.' }),
    ev('team', { title: 'Hiring a team', headings: ['How we hire'] }),
  ];
  const ai = strength('ai', { keywords: ['AI', 'Agentic AI', 'Prototyping'], details: [page('agent', 'shipped'), page('essay', 'wrote')], all: [page('agent', 'shipped'), page('essay', 'wrote'), page('once', 'wrote')], total: 3 });
  const making = strength('making', { keywords: ['Figma plugins', 'Prototyping', 'Culture'], details: [page('plugin', 'built')], all: [page('plugin', 'built'), page('essay', 'wrote')], total: 2 });
  const field = keywordsField(picks([ai, making]), index(pages), TOPICS, KEYWORDS_DEFAULTS, env);
  const kw = (id: string) => field.groups.flatMap((g) => g.keywords).find((k) => k.id === id)!;

  it('makes a group per strength shown, in order, each its name, line and keywords', () => {
    expect(field.groups.map((g) => [g.id, g.name, g.line, g.keywords.map((k) => k.label)])).toEqual([
      ['ai', 'Name ai', 'Line of ai', ['AI', 'Agentic AI', 'Prototyping']],
      ['making', 'Name making', 'Line of making', ['Figma plugins', 'Culture']],
    ]);
  });

  it('keeps a keyword found in two groups only in its first', () => {
    expect(field.groups[1].keywords.map((k) => k.id)).not.toContain('prototyping');
  });

  it('leaves a strength its own keywords: an earlier group\'s topic labels never take one', () => {
    const cap = (id: string, keywords: string[]) => ({ id, name: `Name ${id}`, short: id, line: `Line of ${id}`, keywords });
    // leadership's proof is tagged AI, so AI is among its topic labels; AI is the ai strength's own keyword
    const lead = strength('leadership', { capability: cap('leadership', ['Hiring']), keywords: ['Hiring', 'AI', 'Culture'] });
    const own = strength('ai', { capability: cap('ai', ['AI', 'Copilot']), keywords: ['AI', 'Copilot'] });
    const f = keywordsField(picks([lead, own]), index([ev('leadership-a'), ev('leadership-b'), ev('ai-a'), ev('ai-b')]), [], KEYWORDS_DEFAULTS, env);
    expect(f.groups.map((g) => g.keywords.map((k) => k.label))).toEqual([
      ['Hiring', 'Culture'],
      ['AI', 'Copilot'],
    ]);
  });

  it('takes a singular and its plural as one keyword: the first one met stays', () => {
    const cap = (id: string, keywords: string[]) => ({ id, name: `Name ${id}`, short: id, line: `Line of ${id}`, keywords });
    const sys = strength('systems', { capability: cap('systems', ['Design systems']), keywords: ['Design systems', 'Design system', 'Tools'] });
    const make = strength('making', { keywords: ['Tool', 'Web apps', 'Web app'] });
    const f = keywordsField(picks([sys, make]), index([ev('systems-a'), ev('systems-b'), ev('making-a'), ev('making-b')]), [], KEYWORDS_DEFAULTS, env);
    expect(f.groups.map((g) => g.keywords.map((k) => k.label))).toEqual([
      ['Design systems', 'Tools'],
      ['Web apps'],
    ]);
  });

  it('matches by topic, by the words in a title, summary or heading, and by a body that uses them twice', () => {
    expect(kw('ai').matches).toEqual(['page:agent']);
    expect(kw('agentic-ai').matches).toEqual(['page:agent']);
    expect(kw('figma-plugins').matches).toEqual(['page:plugin']);
    expect(kw('prototyping').matches).toEqual(['page:essay']);
  });

  it('carries a keyword\'s synonyms from the topic vocabulary, by label or synonym', () => {
    expect(kw('ai').synonyms).toEqual(['generative ai']);
    expect(kw('figma-plugins').synonyms.sort()).toEqual(['figma plugin']);
  });

  it('a keyword nothing matches leads to its strength\'s headline, at the smallest size', () => {
    expect(kw('culture')).toMatchObject({ size: 1, matches: ['page:plugin'] });
  });

  it('sizes a keyword by its matches: one, two or three, four or more', () => {
    expect([0, 1, 2, 3, 4, 9].map(sizeOf)).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it('lists every proof item once, under the first strength that has it, best kind first', () => {
    expect(field.items.map((x) => [x.key, x.capability])).toEqual([
      ['page:agent', 'ai'],
      ['page:plugin', 'making'],
      ['page:essay', 'ai'],
      ['page:once', 'ai'],
    ]);
    expect(field.items[0]).toMatchObject({ title: 'Title agent', kindLabel: 'Shipped', href: '/base/work/agent/', line: 'Shipped agentic AI to millions' });
  });

  it('a group knows its headline and how much proof it has', () => {
    expect(field.groups.map((g) => [g.headline, g.total])).toEqual([
      ['page:agent', 3],
      ['page:plugin', 2],
    ]);
  });

  it('caps each group at Per group', () => {
    const many = strength('ai', { keywords: ['One', 'Two', 'Three', 'Four', 'Five', 'Six'] });
    const f = keywordsField(picks([many]), index([ev('ai-a'), ev('ai-b')]), [], { ...KEYWORDS_DEFAULTS, perGroup: 4 }, env);
    expect(f.groups[0].keywords).toHaveLength(4);
  });

  it('a strength without keywords offers its own name', () => {
    const f = keywordsField(picks([strength('ai')]), index([ev('ai-a'), ev('ai-b')]), [], KEYWORDS_DEFAULTS, env);
    expect(f.groups[0].keywords.map((k) => k.label)).toEqual(['Name ai']);
  });

  it('matches a résumé line and a colleague\'s words, and leaves out what leads nowhere', () => {
    const rec = { id: 'ana', name: 'Ana Ruiz', title: 'VP', text: 'The best design leader I have hired.' };
    const lead = strength('leadership', {
      keywords: ['Design leader', 'Hiring'],
      voice: { recommendation: 'ana', quote: 'The best design leader' },
      details: [resume('Hiring for 40 designers', 'led'), said('ana'), page('draft', 'led')],
      all: [resume('Hiring for 40 designers', 'led'), said('ana'), page('draft', 'led')],
    });
    const f = keywordsField(picks([lead]), index([], [rec]), [], KEYWORDS_DEFAULTS, env);
    expect(f.items.map((x) => x.key)).toEqual(['resume:Hiring for 40 designers', 'said:ana']);
    expect(f.items[1]).toMatchObject({ title: 'Ana Ruiz, in their words', line: 'The best design leader' });
    expect(f.groups[0].keywords.map((k) => k.matches)).toEqual([['said:ana'], ['resume:Hiring for 40 designers']]);
  });

  it('Strongest first and a lens order the groups as every view does', () => {
    const weak = strength('ai', { weight: 1 });
    const strong = strength('systems', { weight: 3 });
    expect(keywordsField(picks([weak, strong]), index([]), [], { ...KEYWORDS_DEFAULTS, order: 'strongest' }, env).groups.map((g) => g.id)).toEqual(['systems', 'ai']);
    expect(keywordsField(picks([weak, strong], { lens: 'x' }), index([]), [], { ...KEYWORDS_DEFAULTS, order: 'strongest' }, env).groups.map((g) => g.id)).toEqual(['ai', 'systems']);
  });

  it('leaves out a strength nothing proves', () => {
    const f = keywordsField(picks([strength('ai'), strength('none', { shown: false })]), index([]), [], KEYWORDS_DEFAULTS, env);
    expect(f.groups.map((g) => g.id)).toEqual(['ai']);
  });
});

describe('Keywords in the browser', () => {
  const K: IndexedKeyword[] = [
    { id: 'ai', label: 'AI', synonyms: ['generative ai', 'artificial intelligence'], matches: ['page:a', 'page:b'] },
    { id: 'agentic-ai', label: 'Agentic AI', synonyms: [], matches: ['page:b', 'page:c'] },
    { id: 'design-systems', label: 'Design systems', synonyms: ['design system'], matches: ['page:d'] },
    { id: 'operating-models', label: 'Operating models', synonyms: ['design ops'], matches: ['page:d', 'page:e'] },
  ];

  it('a keyword\'s ID is its label as an address segment', () => {
    expect(['Agentic AI', 'Motion & 3D', '  Ways of working ', 'Café design'].map(slugOf)).toEqual(['agentic-ai', 'motion-3d', 'ways-of-working', 'cafe-design']);
    expect(fold('  Don\u2019t   Stop ')).toBe(normalise('  Don\u2019t   Stop '));
  });

  it('reads ?pick= as known IDs, each once, in order', () => {
    const known = new Set(K.map((k) => k.id));
    expect(picksFrom('?pick=agentic-ai,nope,ai,agentic-ai', known)).toEqual(['agentic-ai', 'ai']);
    expect(picksFrom('?for=ai', known)).toEqual([]);
  });

  it('writes the picks into the query, keeping everything else and the commas readable', () => {
    expect(withPicks('?utm=x', ['ai', 'agentic-ai'])).toBe('?utm=x&pick=ai,agentic-ai');
    expect(withPicks('?pick=ai&utm=x', [])).toBe('?utm=x');
    expect(withPicks('', [])).toBe('');
  });

  it('matches any pick, the items matching more picks first, then in the page\'s order', () => {
    const order = ['page:c', 'page:b', 'page:a'];
    expect(matchesFor(['ai', 'agentic-ai'], K, order)).toEqual([
      { key: 'page:b', matched: ['ai', 'agentic-ai'] },
      { key: 'page:c', matched: ['agentic-ai'] },
      { key: 'page:a', matched: ['ai'] },
    ]);
    expect(matchesFor([], K, order)).toEqual([]);
    expect(matchesFor(['gone'], K, order)).toEqual([]);
  });

  it('suggests keywords by label first, then by synonym, and nothing for one letter', () => {
    expect(suggest('a', K)).toEqual([]);
    expect(suggest('ai', K).map((k) => k.id)).toEqual(['ai', 'agentic-ai']);
    expect(suggest('Design', K).map((k) => k.id)).toEqual(['design-systems', 'operating-models']);
    expect(suggest('generative', K).map((k) => k.id)).toEqual(['ai']);
    expect(suggest('an agentic ai lead', K).map((k) => k.id)).toEqual(['ai', 'agentic-ai']);
    expect(suggest('Kotlin', K)).toEqual([]);
  });

  it('Ask about these names the picks as the topic; without a contact page there\'s none', () => {
    expect(askAbout('/base/contact/', ['Agentic AI', 'Hiring'])).toBe('/base/contact/?topic=Agentic%20AI%2C%20Hiring');
    expect(askAbout(undefined, ['AI'])).toBeUndefined();
    expect(askAbout('/base/contact/', [])).toBeUndefined();
  });

  it('says what changed, politely and in words', () => {
    expect(pickStatus({ label: 'Agentic AI', on: true }, 3, 1)).toBe('Agentic AI picked. 3 matches.');
    expect(pickStatus({ label: 'AI', on: true }, 1, 2)).toBe('AI picked. 1 match.');
    expect(pickStatus({ label: 'AI', on: false }, 0, 0)).toBe('AI removed. Showing every strength.');
    expect(pickStatus({ cleared: true }, 0, 0)).toBe('Picks cleared. Showing every strength.');
  });
});
