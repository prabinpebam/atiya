/**
 * The home page's picks and health (documentation/home-views/curation.md §4 to §9, for-every-site.md §5, plan.md
 * stage 1): the person always wins (pins, hides, Hold), the rules are reproducible, a lens never moves proof, the
 * health report and the views' minimums are right, and sites of 3, 40 and 500 pages work.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { loadContent } from '../../src/site/content/load';
import type { Recommendation } from '../../src/site/content/recommendations';
import { CATALOGUE, viewSettings } from '../../src/site/home/catalogue';
import { curate, MAX_HIGHLIGHTS, proofItems, snapshot, type HomePicks } from '../../src/site/home/curate';
import { buildEvidence, normalise, type Evidence, type EvidenceIndex } from '../../src/site/home/evidence';
import { countsOf, effectiveViews, health, shortOf, spineRefs } from '../../src/site/home/health';
import { toRef, type Capability, type Showcase } from '../../src/site/home/schema';

type Row = Partial<Omit<Evidence, 'text'>> & { body?: string; date?: string };
const ev = (id: string, o: Row = {}): Evidence => {
  const title = o.title ?? `Page ${id}`;
  const summary = o.summary ?? '';
  const time = Date.parse(o.date ?? '2026-01-01');
  return {
    ref: toRef(id), id, title, summary, section: o.section, topics: o.topics ?? [], kind: o.kind, time, year: new Date(time).getUTCFullYear(),
    words: 500, figures: 0, numbers: 0, depth: o.depth ?? 0.5, picture: 'picture' in o ? o.picture : `pics/${id}`, linksIn: o.linksIn ?? 0, stale: o.stale ?? false,
    text: { title: normalise(title), summary: normalise(summary), headings: [], body: normalise(o.body ?? '') },
  };
};
const rec = (id: string): Recommendation => ({ id, name: id.toUpperCase(), title: 'T', text: 'Words.' }) as Recommendation;
const evidence = (pages: Evidence[], recs: Recommendation[] = []): EvidenceIndex => ({
  pages, byId: new Map(pages.map((p) => [p.id, p])), open: new Set(pages.map((p) => p.id)), sections: new Map([['work', 'Work'], ['projects', 'Projects']]),
  topicsInUse: new Set(pages.flatMap((p) => p.topics)), recommendations: recs, now: Math.max(0, ...pages.map((p) => p.time)),
});
const cap = (id: string, o: Partial<Capability> = {}): Capability => ({ id, name: id[0].toUpperCase() + id.slice(1), short: id, line: 'A line', ...o });
const run = (showcase: Partial<Showcase> & Pick<Showcase, 'capabilities'>, pages: Evidence[], lens?: string, recs?: Recommendation[]) =>
  curate({ showcase: showcase as Showcase, evidence: evidence(pages, recs), topics: [{ id: 'ai', label: 'AI', synonyms: ['machine learning'] }], lens });
const ids = (list: { id?: string; resume?: string }[]) => list.map((p) => p.id ?? p.resume);
const strength = (p: HomePicks, id: string) => p.strengths.find((s) => s.id === id)!;

describe('the person always wins', () => {
  const pages = [ev('best', { topics: ['ai'], kind: 'shipped', depth: 1, linksIn: 3 }), ev('weak', { topics: ['ai'], kind: 'wrote', depth: 0, picture: undefined }), ev('mid', { topics: ['ai'], kind: 'built' })];

  it('a pin comes first, in the person’s order, whatever its score', () => {
    const p = run({ capabilities: [cap('ai', { match: { topics: ['ai'] }, proof: [{ ref: 'ref:article/weak' }, { kind: 'led', resume: 'Led AI' }] })] }, pages);
    const s = strength(p, 'ai');
    expect(ids(s.details)).toEqual(['weak', 'Led AI', 'best', 'mid']);
    expect(s.details.slice(0, 2).every((d) => d.pinned && d.reason === 'Pinned by you')).toBe(true);
    expect(s.headline?.id).toBe('weak');
  });

  it('a pin’s kind is the person’s, over the page’s', () => {
    const p = run({ capabilities: [cap('ai', { proof: [{ kind: 'led', ref: 'ref:article/mid' }] })] }, pages);
    expect(strength(p, 'ai').details[0].kind).toBe('led');
  });

  it('a hidden page is never shown for that strength, whatever its score', () => {
    const p = run({ capabilities: [cap('ai', { match: { topics: ['ai'] }, hide: ['ref:article/best'] }), cap('other', { match: { topics: ['ai'] } })] }, pages);
    expect(ids(strength(p, 'ai').all)).not.toContain('best');
    expect(p.highlights.filter((h) => h.capability === 'ai').map((h) => h.id)).not.toContain('best');
    expect(ids(strength(p, 'other').all)).toContain('best');
  });

  it('left out: a section, a topic or a kind is never proof', () => {
    const rows = [ev('a', { topics: ['ai'], section: 'work', kind: 'built' }), ev('b', { topics: ['ai', 'old'], kind: 'shipped' }), ev('c', { topics: ['ai'], kind: 'spoke' })];
    const caps = [cap('ai', { match: { topics: ['ai'] } })];
    expect(ids(strength(run({ capabilities: caps }, rows), 'ai').all).sort()).toEqual(['a', 'b', 'c']);
    expect(ids(strength(run({ capabilities: caps, curation: { leaveOut: { sections: ['work'] } } }, rows), 'ai').all).sort()).toEqual(['b', 'c']);
    expect(ids(strength(run({ capabilities: caps, curation: { leaveOut: { topics: ['old'] } } }, rows), 'ai').all).sort()).toEqual(['a', 'c']);
    expect(ids(strength(run({ capabilities: caps, curation: { leaveOut: { kinds: ['spoke'] } } }, rows), 'ai').all).sort()).toEqual(['a', 'b']);
  });

  it('a pinned page that isn’t open is left out (the content check refuses it)', () => {
    const p = run({ capabilities: [cap('ai', { proof: [{ ref: 'ref:article/private' }, { ref: 'ref:article/best' }] })] }, pages);
    expect(ids(strength(p, 'ai').all)).toEqual(['best']);
  });
});

describe('matching (curation §4)', () => {
  const caps = [cap('ai', { keywords: ['Agents'], match: { topics: ['ai'], sections: ['projects'] } })];
  const rows = [
    ev('topic', { topics: ['ai'] }),
    ev('section', { section: 'projects' }),
    ev('title', { title: 'Building agents at work' }),
    ev('synonym', { summary: 'Notes on machine learning in practice' }),
    ev('body', { body: 'agents here, agents there, and agents everywhere' }),
    ev('once', { body: 'one agents mention' }),
    ev('partial', { title: 'Reagents and chemistry' }),
  ];
  const why = (p: HomePicks) => Object.fromEntries(strength(p, 'ai').all.map((d) => [d.id, d.reason]));

  it('a topic, a section, then words: the strongest wins, and says why', () => {
    const r = why(run({ capabilities: caps }, rows));
    expect(r.topic).toMatch(/^Auto: topic AI, /);
    expect(r.section).toMatch(/^Auto: section Projects, /);
    expect(r.title).toMatch(/^Auto: words in its title, /);
    expect(r.synonym).toMatch(/^Auto: words in its summary, /);
    expect(r.body).toBeUndefined(); // words alone (0.3) are under the balanced threshold (0.4)
    expect(r.once).toBeUndefined();
    expect(r.partial).toBeUndefined(); // whole words only
  });

  it('the threshold follows How strict', () => {
    expect(Object.keys(why(run({ capabilities: caps, curation: { strict: 'loose' } }, rows))).sort()).toEqual(['body', 'section', 'synonym', 'title', 'topic']);
    expect(Object.keys(why(run({ capabilities: caps, curation: { strict: 'strict' } }, rows))).sort()).toEqual(['section', 'title', 'topic']);
  });

  it('the reason names the kind, the year and the links in', () => {
    const p = run({ capabilities: [cap('ai', { match: { topics: ['ai'] } })] }, [ev('x', { topics: ['ai'], kind: 'built', date: '2024-05-01', linksIn: 2 })]);
    expect(strength(p, 'ai').all[0].reason).toBe('Auto: topic AI, built, 2024, 2 pages link here');
  });

  it('the goal’s kinds count most, then depth, recency, links in and a picture; a stale page halves', () => {
    const rows2 = [ev('led', { topics: ['ai'], kind: 'led', depth: 0 }), ev('wrote', { topics: ['ai'], kind: 'wrote', depth: 0 }), ev('stale', { topics: ['ai'], kind: 'led', depth: 0, stale: true })];
    const s = strength(run({ capabilities: [cap('ai', { match: { topics: ['ai'] } })] }, rows2), 'ai');
    expect(ids(s.all)).toEqual(['led', 'wrote', 'stale']);
    const score = Object.fromEntries(s.all.map((d) => [d.id, d.score]));
    expect(score.stale).toBeCloseTo(score.led! / 2, 3);
  });

  it('recent work is preferred as asked, against the content’s own newest date', () => {
    const rows2 = [ev('old', { topics: ['ai'], kind: 'shipped', depth: 1, date: '2016-01-01' }), ev('new', { topics: ['ai'], kind: 'shipped', depth: 0.8, date: '2026-01-01' })];
    const order = (recent: 'off' | 'some' | 'strong') => ids(strength(run({ capabilities: [cap('ai', { match: { topics: ['ai'] } })], curation: { recent } }, rows2), 'ai').all);
    expect(order('off')).toEqual(['old', 'new']);
    expect(order('strong')).toEqual(['new', 'old']);
  });
});

describe('placing (curation §6)', () => {
  it('details balance the kinds: at most 2 of one while other kinds wait', () => {
    const rows = [1, 2, 3, 4].map((i) => ev(`w${i}`, { topics: ['ai'], kind: 'wrote', depth: 1 - i / 10 })).concat(ev('b', { topics: ['ai'], kind: 'built', depth: 0, picture: undefined }));
    const s = strength(run({ capabilities: [cap('ai', { match: { topics: ['ai'] } })], curation: { detail: 3 } }, rows), 'ai');
    expect(ids(s.details)).toEqual(['w1', 'w2', 'b']);
    expect(s.total).toBe(5);
    expect(ids(s.all)).toEqual(['w1', 'w2', 'w3', 'w4', 'b']);
  });

  it('no page leads two strengths while another can', () => {
    const rows = [ev('top', { topics: ['ai', 'web'], kind: 'shipped', depth: 1 }), ev('ai2', { topics: ['ai'] }), ev('web2', { topics: ['web'] })];
    const p = run({ capabilities: [cap('ai', { match: { topics: ['ai'] } }), cap('web', { match: { topics: ['web'] } })] }, rows);
    expect(strength(p, 'ai').headline?.id).toBe('top');
    expect(strength(p, 'web').headline?.id).toBe('web2');
  });

  it('a pinned page leads its strength first; a résumé line leads only when no page can', () => {
    const rows = [ev('top', { topics: ['ai'], kind: 'shipped', depth: 1 }), ev('mine', { topics: ['web'] })];
    const p = run({ capabilities: [cap('ai', { match: { topics: ['ai'] } }), cap('web', { proof: [{ ref: 'ref:article/top' }] }), cap('cv', { proof: [{ kind: 'led', resume: 'Led it' }] })] }, rows);
    expect(strength(p, 'web').headline?.id).toBe('top');
    expect(strength(p, 'ai').headline?.id).toBe('top'); // its only page leads another: shared rather than none
    expect(strength(p, 'cv').headline?.resume).toBe('Led it');
  });

  it('a strength with nothing to prove it isn’t shown', () => {
    const p = run({ capabilities: [cap('ai', { match: { topics: ['ai'] } }), cap('ghost', { match: { topics: ['nothing'] } })] }, [ev('a', { topics: ['ai'] })]);
    expect(strength(p, 'ghost').shown).toBe(false);
    expect(p.highlights.every((h) => h.capability !== 'ghost')).toBe(true);
  });

  it('a strength’s picture is its own, else its headline’s', () => {
    const p = run({ capabilities: [cap('ai', { match: { topics: ['ai'] } }), cap('own', { match: { topics: ['ai'] }, media: 'shared/mine' })] }, [ev('a', { topics: ['ai'] }), ev('b', { topics: ['ai'] })]);
    expect(strength(p, 'ai').picture).toBe('pics/a');
    expect(strength(p, 'own').picture).toBe('shared/mine');
  });

  it('keywords: the person’s first, then the topics of its proof, each once, 8 at most', () => {
    const rows = [ev('a', { topics: ['ai', 'web'] }), ev('b', { topics: ['ai', 'tools'] })];
    const s = strength(run({ capabilities: [cap('ai', { keywords: ['Agents', 'AI'], match: { topics: ['ai'] } })] }, rows), 'ai');
    expect(s.keywords).toEqual(['Agents', 'AI', 'tools', 'web']);
  });
});

describe('highlights and the reel', () => {
  const six = ['a', 'b', 'c', 'd', 'e', 'f'];
  const rows = six.flatMap((t) => [1, 2, 3].map((i) => ev(`${t}${i}`, { topics: [t], depth: 1 - i / 10 })));
  const caps = six.map((t) => cap(t, { match: { topics: [t] } }));

  it('one per strength in order, the best with a picture, round after round, 8 at most, no page twice', () => {
    const p = run({ capabilities: caps }, rows);
    expect(p.highlights).toHaveLength(MAX_HIGHLIGHTS);
    expect(p.highlights.map((h) => h.id)).toEqual(['a1', 'b1', 'c1', 'd1', 'e1', 'f1', 'a2', 'b2']);
    expect(new Set(p.highlights.map((h) => h.id)).size).toBe(MAX_HIGHLIGHTS);
    expect(p.highlights[0].reason).toBe('Auto: the best of a with a picture');
  });

  it('pins first; a hidden highlight never shows; a page without a picture is never picked by the rules', () => {
    const rows2 = rows.map((r) => (r.id === 'b1' ? { ...r, picture: undefined } : r));
    const p = run({ capabilities: caps, highlights: [{ ref: 'ref:article/f3', capability: 'f' }], hideHighlights: ['ref:article/a1'] }, rows2);
    expect(p.highlights[0]).toMatchObject({ id: 'f3', pinned: true, reason: 'Pinned by you' });
    expect(p.highlights.map((h) => h.id)).not.toContain('a1');
    expect(p.highlights.map((h) => h.id)).not.toContain('b1');
  });

  it('the reel keeps 2 per strength at most', () => {
    const p = run({ capabilities: caps, highlights: ['a1', 'a2', 'a3'].map((id) => ({ ref: `ref:article/${id}`, capability: 'a' })) }, rows);
    expect(p.highlights.filter((h) => h.capability === 'a').length).toBeGreaterThan(2);
    expect(p.reel.filter((h) => h.capability === 'a')).toHaveLength(2);
  });
});

describe('a lens orders, never moves', () => {
  const rows = [ev('l1', { topics: ['lead'], kind: 'led' }), ev('a1', { topics: ['ai'], kind: 'built' }), ev('both', { topics: ['lead', 'ai'], kind: 'shipped', depth: 1 })];
  const showcase = {
    capabilities: [
      cap('lead', { match: { topics: ['lead'] }, voice: { recommendation: 'ana', quote: 'A leader' } }),
      cap('ai', { match: { topics: ['ai'] }, voice: { recommendation: 'bo', quote: 'An AI person' }, lens: ['tech'] }),
      cap('craft', { proof: [{ kind: 'led', resume: 'Led craft' }] }),
    ],
    lenses: [{ id: 'maker', label: 'Maker', order: ['ai'], voice: 'bo' }, { id: 'tech', label: 'Tech' }],
  };

  it('a lens’s order comes first, the rest follow in the person’s order; its voice leads', () => {
    const plain = run(showcase, rows);
    const maker = run(showcase, rows, 'maker');
    expect(plain.strengths.map((s) => s.id)).toEqual(['lead', 'ai', 'craft']);
    expect(plain.leadVoice).toEqual({ recommendation: 'ana', quote: 'A leader' });
    expect(maker.lens).toBe('maker');
    expect(maker.strengths.map((s) => s.id)).toEqual(['ai', 'lead', 'craft']);
    expect(maker.leadVoice).toEqual({ recommendation: 'bo', quote: 'An AI person' });
    // a lens without an order: the strengths that name it first
    expect(run(showcase, rows, 'tech').strengths.map((s) => s.id)).toEqual(['ai', 'lead', 'craft']);
    // an unknown lens is the person's order
    expect(run(showcase, rows, 'nope').strengths.map((s) => s.id)).toEqual(['lead', 'ai', 'craft']);
  });

  it('every strength keeps its headline and its proof under any lens', () => {
    const proof = (p: HomePicks) => Object.fromEntries(p.strengths.map((s) => [s.id, { head: s.headline?.id ?? s.headline?.resume, all: ids(s.all) }]));
    const plain = proof(run(showcase, rows));
    expect(plain.lead.head).toBe('both');
    expect(plain.ai.head).toBe('a1');
    for (const lens of ['maker', 'tech']) expect(proof(run(showcase, rows, lens))).toEqual(plain);
    expect(run(showcase, rows, 'maker').strengths).toHaveLength(3);
  });
});

describe('reproducible, and held when asked', () => {
  const rows = [ev('a', { topics: ['ai'], kind: 'built' }), ev('b', { topics: ['ai'], kind: 'built' }), ev('c', { topics: ['web'], date: '2025-01-01' }), ev('d', { summary: 'An AI summary' })];
  const showcase: Showcase = { capabilities: [cap('ai', { match: { topics: ['ai'] } }), cap('web', { match: { topics: ['web'] } })] };

  it('the same content gives the same picks, in any order it’s read', () => {
    const first = run(showcase, rows);
    expect(run(showcase, rows)).toEqual(first);
    expect(run(showcase, [...rows].reverse())).toEqual(first);
    // ties are broken by date, then ID: never by the order read
    expect(ids(strength(first, 'ai').all)).toEqual(['a', 'b', 'd']);
  });

  it('Hold keeps the automatic picks as stored, while new work waits; pins still change', () => {
    const before = run(showcase, rows);
    const held = snapshot(before);
    expect(held.proof).toEqual({ ai: ['ref:article/a', 'ref:article/b', 'ref:article/d'], web: ['ref:article/c'] });
    expect(held.highlights.map((h) => h.ref)).toEqual(['ref:article/a', 'ref:article/c', 'ref:article/b', 'ref:article/d']);
    const more = [...rows, ev('new', { topics: ['ai'], kind: 'shipped', depth: 1 })];
    expect(ids(strength(run(showcase, more), 'ai').all)).toContain('new');
    const frozen = run({ ...showcase, curation: { hold: true }, held }, more);
    expect(frozen.held).toBe(true);
    expect(ids(strength(frozen, 'ai').all)).toEqual(['a', 'b', 'd']);
    expect(strength(frozen, 'ai').all[0].reason).toBe('Held: as it was when you held it');
    expect(frozen.highlights.map((h) => h.id)).toEqual(['a', 'c', 'b', 'd']);
    const pinned = run({ ...showcase, capabilities: [cap('ai', { match: { topics: ['ai'] }, proof: [{ ref: 'ref:article/new' }] }), showcase.capabilities[1]], curation: { hold: true }, held }, more);
    expect(ids(strength(pinned, 'ai').all)).toEqual(['new', 'a', 'b', 'd']);
    // Hold without a stored set is no hold
    expect(run({ ...showcase, curation: { hold: true } }, more).held).toBe(false);
  });

  it('the proof items are each counted once across the strengths', () => {
    const p = run({ capabilities: [cap('ai', { match: { topics: ['ai'] }, proof: [{ kind: 'led', resume: 'Led AI' }] }), cap('also', { match: { topics: ['ai'] }, proof: [{ kind: 'led', resume: 'led  AI' }] })] }, rows);
    expect(proofItems(p).map((x) => x.id ?? x.resume)).toEqual(['Led AI', 'a', 'b', 'd']);
  });

  it('the spine’s own pages are known (the editor’s tags)', () => {
    expect([...spineRefs({ capabilities: [cap('ai', { proof: [{ ref: 'ref:article/a' }, { kind: 'led', resume: 'x y z' }], hide: ['ref:article/b'] })], highlights: [{ ref: 'ref:article/c', capability: 'ai' }] })].sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('the health report (curation §8)', () => {
  it('names what’s missing, what’s weak and what’s waiting, blocking first', () => {
    const rows = [
      ev('old', { topics: ['history'], date: '2015-01-01' }),
      ev('fresh', { topics: ['ai'], date: '2026-06-01' }),
      ev('fresh2', { topics: ['ai'], date: '2026-05-01', stale: true }),
      ev('nobody', { topics: ['misc'] }),
      ev('bare', {}),
    ];
    const showcase: Showcase = {
      capabilities: [
        cap('ai', { match: { topics: ['ai'] }, voice: { recommendation: 'ana', quote: 'q' } }),
        cap('history', { match: { topics: ['history'] } }),
        cap('cv', { proof: [{ kind: 'led', resume: 'Led it' }] }),
        cap('ghost', { match: { topics: ['nothing'] } }),
        cap('twin', { proof: [{ ref: 'ref:article/old' }] }),
      ],
    };
    const p = run(showcase, rows, undefined, [rec('ana'), rec('bo')]);
    const report = health(p, showcase, evidence(rows, [rec('ana'), rec('bo')]), { default: 'classic', offered: ['classic', 'spotlight'] });
    const codes = report.map((h) => `${h.level}:${h.code}${h.capability ? `:${h.capability}` : ''}`);
    expect(codes[0]).toBe('blocking:no-proof:ghost');
    expect(codes).toEqual(
      expect.arrayContaining([
        'warning:resume-only:cv', 'warning:one-proof:cv', 'warning:no-picture:cv', 'warning:old-proof:history', 'warning:one-proof:history',
        'warning:stale:ai', 'warning:shared-headline', 'warning:below-minimum', 'opportunity:unused-pages', 'opportunity:unused-voices', 'opportunity:no-topics',
      ]),
    );
    expect(codes).not.toContain('warning:old-proof:ai');
    expect(report.find((h) => h.code === 'unused-pages')?.items).toEqual(['ref:article/nobody', 'ref:article/bare']);
    expect(report.find((h) => h.code === 'unused-voices')?.items).toEqual(['bo']);
    // twin's pin leads it, so history's only page is shared rather than history shown without a headline
    expect(report.find((h) => h.code === 'shared-headline')).toMatchObject({ items: ['old'], message: 'History and Twin lead with the same page. Pin another page to one of them' });
    expect(report.find((h) => h.code === 'below-minimum')).toMatchObject({ view: 'spotlight', message: 'Spotlight needs 4 highlights with pictures; you have 3' });
    const levels = report.map((h) => h.level);
    expect(levels).toEqual([...levels].sort((a, b) => ['blocking', 'warning', 'opportunity'].indexOf(a) - ['blocking', 'warning', 'opportunity'].indexOf(b)));
    // old work is only flagged while recent work is preferred
    expect(health(run({ ...showcase, curation: { recent: 'off' } }, rows), { ...showcase, curation: { recent: 'off' } }, evidence(rows)).map((h) => h.code)).not.toContain('old-proof');
  });
});

describe('the views’ minimums (for-every-site §5)', () => {
  const built = Object.fromEntries(Object.entries(CATALOGUE.views).map(([v, s]) => [v, s.built]));
  afterEach(() => {
    for (const [v, b] of Object.entries(built)) CATALOGUE.views[v as keyof typeof CATALOGUE.views].built = b;
  });
  const counts = (o: Partial<ReturnType<typeof countsOf>> = {}) => ({ strengths: 3, pictures: 3, highlights: 3, everyPicture: true, keywords: 12, proof: 8, kinds: 3, answers: 0, ...o });

  it('each view says what it still needs', () => {
    expect(shortOf('classic', counts({ strengths: 0 }))).toEqual([]);
    expect(shortOf('bento', counts({ strengths: 2 }))).toEqual(['Bento needs 3 strengths with proof; you have 2']);
    expect(shortOf('showreel', counts({ highlights: 4, everyPicture: false }))).toEqual(['Showreel needs 5 highlights with pictures; you have 4', 'Showreel needs a picture for every strength']);
    expect(shortOf('questions', counts())).toEqual(['Questions needs 5 answered questions; you have 0']);
    expect(shortOf('keywords', counts({ keywords: 11, proof: 8 }))).toEqual(['Keywords needs 12 keywords; you have 11']);
  });

  it('only built views are offered; nothing chosen is Classic', () => {
    const was = CATALOGUE.views.bento.built;
    CATALOGUE.views.bento.built = false;
    try {
      expect(effectiveViews({}, counts())).toEqual({ default: 'classic', offered: ['classic'] });
      expect(effectiveViews({ default: 'bento', offered: ['bento', 'classic'] }, counts())).toEqual({ default: 'classic', offered: ['classic'] });
    } finally {
      CATALOGUE.views.bento.built = was;
    }
  });

  it('a default below its minimum falls back to Bento, else Classic; Classic is always there', () => {
    CATALOGUE.views.bento.built = true;
    CATALOGUE.views.spotlight.built = true;
    expect(effectiveViews({ default: 'bento', offered: ['classic', 'bento'] }, counts())).toEqual({ default: 'bento', offered: ['classic', 'bento'] });
    expect(effectiveViews({ default: 'spotlight', offered: ['spotlight', 'bento'] }, counts())).toEqual({ default: 'bento', offered: ['bento'] });
    expect(effectiveViews({ default: 'spotlight', offered: ['spotlight', 'bento'] }, counts({ strengths: 2 }))).toEqual({ default: 'classic', offered: ['classic'] });
    expect(effectiveViews({ default: 'spotlight', offered: ['spotlight', 'bento'] }, counts({ highlights: 4 }))).toEqual({ default: 'spotlight', offered: ['bento', 'spotlight'] });
  });

  it('a view the site is ready for, built but not offered, is an opportunity', () => {
    CATALOGUE.views.bento.built = true;
    const rows = ['a', 'b', 'c'].map((t) => ev(t, { topics: [t] }));
    const showcase: Showcase = { capabilities: ['a', 'b', 'c'].map((t) => cap(t, { match: { topics: [t] } })) };
    const p = run(showcase, rows);
    expect(health(p, showcase, evidence(rows), { default: 'classic' }).filter((h) => h.code === 'view-ready').map((h) => h.view)).toEqual(['bento']);
    expect(health(p, showcase, evidence(rows), { default: 'bento' }).some((h) => h.code === 'view-ready')).toBe(false);
  });

  it('a view’s settings are its defaults with the person’s own over them', () => {
    expect(viewSettings('bento', { density: 'full' })).toEqual({ lead: 'who', density: 'full', pictures: 'work', order: 'yours', words: 'on' });
    expect(viewSettings('classic')).toEqual({});
  });
});

describe('sites of any size (curation §9)', () => {
  const TOPICS = ['ai', 'web', 'leadership', 'systems', 'craft', 'research', 'tools', 'teaching'];
  const KINDS = ['shipped', 'led', 'built', 'wrote', 'spoke', undefined];
  const WORDS = ['agents', 'roadmap', 'hiring', 'tokens', 'motion', 'interviews', 'plugins', 'workshops'];
  /** A made-up site of n pages over 4 sections and 8 years, loaded through the real loader. */
  const site = (n: number) => {
    const docs: Record<string, unknown> = {
      '/content/site.json': { name: 'N', description: 'D', owner: 'p', locale: 'en' },
      '/content/people/p.json': { id: 'p', name: 'P' },
      '/content/media/shared/pic.json': { kind: 'image', file: 'pic.webp', alt: 'A picture.', visibility: 'public' },
    };
    const sections = ['work', 'projects', 'writing', 'talks'].map((s) => ({ id: s, kind: 'hub', slug: s, title: s, children: [] as unknown[] }));
    for (let i = 0; i < n; i++) {
      const id = `p${i}`;
      const t = TOPICS[i % TOPICS.length];
      const kind = KINDS[i % KINDS.length];
      sections[i % 4].children.push({ id, kind: 'item', item: { type: 'article', id } });
      docs[`/content/articles/${id}.json`] = {
        id, type: 'article', kind: 'note', slug: id, title: `Page ${i} on ${WORDS[(i * 3) % 8]}`, summary: `About ${t}`, status: 'published', visibility: 'public',
        publishedAt: `${2019 + (i % 8)}-0${1 + (i % 9)}-15`, updatedAt: '2026-10-01', locale: 'en', ...(i % 5 ? { topics: [t, TOPICS[(i + 3) % 8]] } : {}), ...(kind ? { contribution: kind } : {}),
                ...(i % 3 ? { hero: { media: 'shared/pic' } } : {}),
                body: [{ type: 'text', markdown: `${WORDS[i % 8]} and ${WORDS[(i + 1) % 8]}, ${WORDS[i % 8]} again: ${i * 7} people. `.repeat(1 + (i % 12)) }],
      };
    }
    docs['/content/structures/site.json'] = { home: { id: 'home', kind: 'hub', slug: '', title: 'Home', children: sections } };
    return loadContent(docs, new Set(['/content/media/shared/pic.webp']));
  };
  const showcase: Showcase = {
    capabilities: [
      cap('ai', { keywords: ['Agents'], match: { topics: ['ai'] } }),
      cap('lead', { keywords: ['Hiring'], match: { topics: ['leadership'], sections: ['talks'] } }),
      cap('systems', { keywords: ['Tokens'], match: { topics: ['systems'] } }),
      cap('craft', { keywords: ['Motion'], match: { topics: ['craft'] } }),
    ],
  };

  for (const n of [3, 40, 500]) {
    it(`${n} pages: every strength with proof is placed, highlights are found, the report is ready`, () => {
      const index = site(n);
      const evidenceIndex = buildEvidence(index);
      expect(evidenceIndex.pages).toHaveLength(n);
      const t = performance.now();
      const p = curate({ showcase, evidence: evidenceIndex });
      const ms = performance.now() - t;
      if (n === 500) expect(ms).toBeLessThan(150);
      const shown = p.strengths.filter((s) => s.shown);
      expect(shown.length).toBe(4);
      const withPicture = new Set(shown.flatMap((s) => s.all.flatMap((x) => (x.id && x.picture ? [x.id] : []))));
      expect(p.highlights.length).toBe(Math.min(MAX_HIGHLIGHTS, withPicture.size));
      expect(p.highlights.every((h) => h.picture)).toBe(true);
      for (const s of shown) expect(s.details.length).toBeLessThanOrEqual(5);
      const report = health(p, showcase, evidenceIndex);
      expect(report.every((h) => h.message.length > 0)).toBe(true);
      expect(curate({ showcase, evidence: evidenceIndex })).toEqual(p);
    });
  }
});
