/**
 * The Questions view's answers (documentation/home-views/questions.md §4, plan.md stage 7): question 1 maps every
 * strength shown in the lens's or the person's order (DoD 7.1), each answer's evidence is its pins then its
 * strengths' details in turn, three to five, once each, and the catalogue's fills add the strengths deepest first,
 * the résumé items to ask about and the ways to get in touch.
 */
import { describe, expect, it } from 'vitest';
import { normalise, type Evidence, type EvidenceIndex } from '../../src/site/home/evidence';
import { MAX_EVIDENCE, QUESTIONS_DEFAULTS, questionsOf, questionsSettings } from '../../src/site/home/questions';
import type { Showcase, Topic } from '../../src/site/home/schema';
import { env, page, picks, resume, said, strength } from './homeFixtures';

const ev = (id: string, summary = `Summary of ${id}`): Evidence => ({
  ref: `ref:article/${id}`,
  id,
  title: `Title ${id}`,
  summary,
  topics: [],
  time: 0,
  year: 2026,
  words: 100,
  figures: 0,
  numbers: 0,
  depth: 0.1,
  linksIn: 0,
  stale: false,
  text: { title: normalise(`Title ${id}`), summary: normalise(summary), headings: [], body: '' },
});
const PAGES = ['lead-a', 'lead-b', 'lead-c', 'ai-a', 'ai-b', 'ai-c', 'craft-a', 'craft-b', 'pinned'].map((id) => ev(id));
const evidence: EvidenceIndex = {
  pages: PAGES,
  byId: new Map(PAGES.map((p) => [p.id, p])),
  open: new Set(PAGES.map((p) => p.id)),
  sections: new Map(),
  topicsInUse: new Set(),
  recommendations: [
    { id: 'ana', name: 'Ana Ruiz', text: 'Ana here. A rare leader. She stays deeply involved.' },
    { id: 'bo', name: 'Bo Chen', text: 'He builds things with care. Highly recommended.' },
  ] as EvidenceIndex['recommendations'],
  now: 0,
};
const TOPICS = [{ id: 'gen-ai', label: 'Generative AI', synonyms: ['GenAI'] }] as Topic[];

const lead = strength('lead', {
  details: [page('lead-a', 'led'), page('lead-b', 'led'), page('lead-c', 'wrote')],
  all: [page('lead-a', 'led'), page('lead-b', 'led'), page('lead-c', 'wrote'), resume('Built the org from scratch', 'led'), said('ana')],
  voice: { recommendation: 'ana', quote: 'A rare leader' },
  weight: 1,
});
const ai = strength('ai', {
  details: [page('ai-a', 'built'), page('ai-b', 'shipped'), page('ai-c', 'wrote')],
  all: [page('ai-a', 'built'), page('ai-b', 'shipped'), page('ai-c', 'wrote'), resume('Led the AI program', 'led'), resume('Built the org from scratch', 'led')],
  keywords: ['Agents'],
  capability: { id: 'ai', name: 'Name ai', short: 'ai', line: 'Line of ai', match: { topics: ['gen-ai'] } },
  weight: 3,
});
const craft = strength('craft', { details: [page('craft-a', 'built'), page('craft-b', 'built')], weight: 2 });
const hidden = strength('hidden', { shown: false, details: [], all: [], total: 0 });

const Q = (id: string, capabilities: string[], over: Partial<NonNullable<Showcase['questions']>[number]> = {}) => ({ id, question: `Question ${id}?`, answer: `Answer ${id}.`, capabilities, ...over });
const QUESTIONS: NonNullable<Showcase['questions']> = [
  Q('kind', ['lead', 'ai', 'craft'], { proof: [{ recommendation: 'ana' }] }),
  Q('outcomes', ['lead', 'ai'], { proof: [{ ref: 'ref:article/pinned', kind: 'shipped' }, { ref: 'ref:article/ai-a' }] }),
  Q('breadth', ['lead', 'ai', 'craft']),
  Q('public', ['lead', 'ai']),
  Q('contact', []),
  Q('my-own', ['craft'], { question: 'Do you mentor?' }),
];
const model = (over: { lens?: string; order?: 'yours' | 'strongest'; ask?: 'on' | 'off'; gridHref?: string; questions?: Showcase['questions'] } = {}) =>
  questionsOf({
    questions: over.questions ?? QUESTIONS,
    picks: picks([lead, hidden, ai, craft], over.lens ? { lens: over.lens } : {}),
    evidence,
    topics: TOPICS,
    settings: questionsSettings({ ...(over.order ? { order: over.order } : {}), ...(over.ask ? { ask: over.ask } : {}) }),
    env,
    ...(over.gridHref ? { gridHref: over.gridHref } : {}),
  });
const answer = (id: string, m = model()) => m.answers.find((a) => a.id === id)!;

describe('Questions settings', () => {
  it('fills in the defaults: your order, Ask something else on', () => {
    expect(questionsSettings()).toEqual(QUESTIONS_DEFAULTS);
    expect(QUESTIONS_DEFAULTS).toEqual({ order: 'yours', ask: 'on' });
  });

  it('takes anything unknown as its default', () => {
    expect(questionsSettings({ order: 'random', ask: 'maybe' })).toEqual(QUESTIONS_DEFAULTS);
    expect(questionsSettings({ order: 'strongest', ask: 'off' })).toEqual({ order: 'strongest', ask: 'off' });
    expect(model({ ask: 'off' }).ask).toBe(false);
    expect(model().ask).toBe(true);
  });
});

describe('Questions answers', () => {
  it('keeps the person’s questions in their order, numbered from 1, each pointing to the next', () => {
    const m = model();
    expect(m.answers.map((a) => [a.n, a.id])).toEqual([
      [1, 'kind'],
      [2, 'outcomes'],
      [3, 'breadth'],
      [4, 'public'],
      [5, 'contact'],
      [6, 'my-own'],
    ]);
    expect(m.answers[0].next).toEqual({ n: 2, question: 'Question outcomes?' });
    expect(m.answers.at(-1)!.next).toBeUndefined();
  });

  it('takes the catalogue’s full question when the person gives none', () => {
    expect(answer('outcomes').full).toBe('What outcomes have they influenced?');
    expect(answer('my-own').full).toBeUndefined();
    expect(answer('kind', model({ questions: [Q('kind', ['lead'], { full: 'Their own words?' })] })).full).toBe('Their own words?');
  });

  it('question 1 maps every strength shown, in the person’s order, each with its line, total, headline and details (DoD 7.1)', () => {
    const fill = model().answers[0].fill;
    expect(fill?.kind).toBe('map');
    if (fill?.kind !== 'map') return;
    expect(fill.strengths.map((s) => s.id)).toEqual(['lead', 'ai', 'craft']);
    expect(fill.strengths[0]).toMatchObject({ name: 'Name lead', line: 'Line of lead', total: 3, headline: { key: 'page:lead-a', href: '/base/work/lead-a/' } });
    expect(fill.strengths[0].evidence.map((e) => e.key)).toEqual(['page:lead-a', 'page:lead-b', 'page:lead-c']);
  });

  it('question 1 maps them in the lens’s order, which beats Strongest first, and Strongest first without one', () => {
    const order = (m: ReturnType<typeof model>) => (m.answers[0].fill?.kind === 'map' ? m.answers[0].fill.strengths.map((s) => s.id) : []);
    expect(order(model({ order: 'strongest' }))).toEqual(['ai', 'craft', 'lead']);
    // the lens's order is the picks' order: strengthsInOrder keeps it
    expect(order(model({ order: 'strongest', lens: 'leader' }))).toEqual(['lead', 'ai', 'craft']);
  });

  it('question 1 is the map whatever its ID, so no strength goes unseen', () => {
    const m = model({ questions: [Q('contact', ['lead']), Q('kind', ['lead'])] });
    expect(m.answers[0].fill?.kind).toBe('map');
    expect(m.answers[1].fill).toBeUndefined();
  });

  it('tags an answer with the strengths it names that are shown, in the view’s order', () => {
    expect(answer('kind').tags.map((t) => t.id)).toEqual(['lead', 'ai', 'craft']);
    expect(answer('outcomes', model({ order: 'strongest' })).tags.map((t) => t.id)).toEqual(['ai', 'lead']);
    expect(answer('kind', model({ questions: [Q('kind', ['hidden', 'craft'])] })).tags).toEqual([{ id: 'craft', name: 'Name craft', short: 'craft' }]);
  });

  it('matches a typed question by its strengths in the question’s own order, whatever the view’s', () => {
    const words = answer('outcomes', model({ order: 'strongest' })).words;
    expect(words.strengths.map((s) => s[0])).toEqual(['Name lead', 'Name ai']);
    expect(words.proof.map((p) => p[0])).toEqual(['Title lead-a', 'Title ai-a']);
  });

  it('shows an answer’s pins first, then its strengths’ details in turn, once each, at most five', () => {
    const keys = answer('outcomes').evidence.map((e) => e.key);
    // pinned, ai-a (pinned, so not again), then lead-a, ai-b (ai-a taken), lead-b, …
    expect(keys).toEqual(['page:pinned', 'page:ai-a', 'page:lead-a', 'page:lead-b', 'page:ai-b']);
    expect(keys.length).toBe(MAX_EVIDENCE);
    expect(answer('my-own').evidence.map((e) => e.key)).toEqual(['page:craft-a', 'page:craft-b']);
  });

  it('gives each item its line: its page’s summary, or the colleague’s quote (their first sentence without one)', () => {
    expect(answer('outcomes').evidence[0]).toMatchObject({ title: 'Title pinned', kind: 'shipped', kindLabel: 'Shipped', line: 'Summary of pinned' });
    expect(answer('kind').evidence[0]).toMatchObject({ key: 'said:ana', title: 'Ana Ruiz, in their words', line: 'A rare leader' });
    const bo = answer('kind', model({ questions: [Q('kind', ['lead'], { proof: [{ recommendation: 'bo' }] })] }));
    expect(bo.evidence[0].line).toBe('He builds things with care.');
  });

  it('leaves out a pin to a page that isn’t open', () => {
    expect(answer('kind', model({ questions: [Q('kind', ['lead'], { proof: [{ ref: 'ref:article/gone' }] })] })).evidence).toEqual([]);
  });

  it('question 1 and the filled answers show only their pins: the fill holds the rest', () => {
    expect(answer('kind').evidence.map((e) => e.key)).toEqual(['said:ana']);
    expect(answer('breadth').evidence).toEqual([]);
  });

  it('breadth shows the strengths deepest first, with their counts and the Proof grid when it’s offered', () => {
    const fill = answer('breadth', model({ gridHref: '/base/views/proof-grid/' })).fill;
    expect(fill).toEqual({
      kind: 'depth',
      strengths: [
        { id: 'ai', name: 'Name ai', short: 'ai', line: 'Line of ai', total: 3 },
        { id: 'craft', name: 'Name craft', short: 'craft', line: 'Line of craft', total: 2 },
        { id: 'lead', name: 'Name lead', short: 'lead', line: 'Line of lead', total: 3 },
      ],
      grid: '/base/views/proof-grid/',
    });
    expect(answer('breadth').fill).not.toHaveProperty('grid');
  });

  it('public lists every résumé item once, grouped by strength, each with Ask me about it', () => {
    const fill = answer('public').fill;
    expect(fill?.kind).toBe('ask');
    if (fill?.kind !== 'ask') return;
    expect(fill.groups.map((g) => [g.id, g.items.map((i) => [i.title, i.ask])])).toEqual([
      ['lead', [['Built the org from scratch', '/base/contact/?topic=Name%20lead']]],
      ['ai', [['Led the AI program', '/base/contact/?topic=Name%20ai']]],
    ]);
  });

  it('contact offers the résumé and the contact page; a question of the person’s own gets no fill', () => {
    expect(answer('contact').fill).toEqual({ kind: 'contact', resume: '/base/resume/', contact: '/base/contact/' });
    expect(answer('my-own').fill).toBeUndefined();
    const { resumeHref: _r, contactHref: _c, ...bare } = env;
    const none = questionsOf({ questions: [Q('kind', []), Q('contact', [])], picks: picks([lead]), evidence, settings: QUESTIONS_DEFAULTS, env: bare });
    expect(none.answers[1].fill).toEqual({ kind: 'contact' });
  });

  it('gives a typed question its words: the question’s, each strength’s (names, keywords, topics and synonyms) in its order, its evidence’s titles, and each strength’s proof’s titles', () => {
    expect(answer('outcomes').words).toEqual({
      question: ['Question outcomes?', 'What outcomes have they influenced?'],
      strengths: [
        ['Name lead', 'lead'],
        ['Name ai', 'ai', 'Agents', 'Generative AI', 'GenAI'],
      ],
      evidence: ['Title pinned', 'Title ai-a', 'Title lead-a', 'Title lead-b', 'Title ai-b'],
      proof: [
        ['Title lead-a', 'Title lead-b', 'Title lead-c', 'Built the org from scratch', 'Ana Ruiz, in their words'],
        ['Title ai-a', 'Title ai-b', 'Title ai-c', 'Led the AI program', 'Built the org from scratch'],
      ],
    });
  });

  it('has no answers without questions', () => {
    expect(questionsOf({ questions: undefined, picks: picks([lead]), evidence, settings: QUESTIONS_DEFAULTS, env }).answers).toEqual([]);
  });
});
