/**
 * Bento's tiles and what every view shows the same way (documentation/home-views/bento.md §4, foundation.md §7,
 * for-every-site.md §4): labels, evidence links, voices, the lead, the layouts for 3 to 6 strengths and the settings.
 */
import { describe, expect, it } from 'vitest';
import { BENTO_DEFAULTS, SPANS, bentoSettings, bentoTiles, evidenceLabel } from '../../src/site/home/bento';
import { askHref, evidenceOf, leadOf, strongestKind, voicesOf } from '../../src/site/home/present';
import { capabilityFromHash } from '../../src/site/scripts/homeAddress';
import { env, page, picks, strength } from './homeFixtures';

describe("what every view shows the same way", () => {
  it("a proof item's kind and where it leads: a page, a résumé line with Ask me about it, a recommendation", () => {
    const s = strength('ai', {
      details: [page('cloner', 'built'), { source: 'resume', resume: 'Led the AI program', kind: 'led', pinned: true, reason: 'Pinned by you' }, { source: 'recommendation', recommendation: 'ana', kind: 'said', pinned: true, reason: 'Pinned by you' }, page('draft', 'wrote'), page('secret', 'led', { ask: true })],
    });
    expect(evidenceOf(s, env)).toEqual([
      { key: 'page:cloner', source: 'page', title: 'Title cloner', href: '/base/work/cloner/', kind: 'built', kindLabel: 'Built' },
      { key: 'resume:Led the AI program', source: 'resume', title: 'Led the AI program', href: '/base/resume/', kind: 'led', kindLabel: 'Led', ask: '/base/contact/?topic=Name%20ai' },
      { key: 'said:ana', source: 'recommendation', title: 'Ana Ruiz, in their words', kind: 'said', kindLabel: 'Said' },
      { key: 'page:secret', source: 'page', title: 'Title secret', href: '/base/work/secret/', kind: 'led', kindLabel: 'Led', ask: '/base/contact/?topic=Name%20ai' },
    ]);
    expect(askHref(undefined, 'AI')).toBeUndefined();
  });

  it("the strongest kind follows the goal's kinds first", () => {
    expect(strongestKind({ all: [page('a', 'wrote'), page('b', 'led'), page('c', 'built')] }, 'hired')).toBe('led');
    expect(strongestKind({ all: [page('a', 'wrote'), page('c', 'built')] }, 'hired')).toBe('built');
    expect(strongestKind({ all: [page('a')] }, 'hired')).toBeUndefined();
  });

  it('in their words: the lead voice first, one quote per person, none without a known writer', () => {
    const p = picks([strength('a', { voice: { recommendation: 'bo', quote: 'Bo on a' } }), strength('b', { voice: { recommendation: 'ana', quote: 'Ana on b' } }), strength('c', { voice: { recommendation: 'bo', quote: 'Bo on c' } }), strength('d', { voice: { recommendation: 'zed', quote: 'Who?' } })], { leadVoice: { recommendation: 'ana' } });
    expect(voicesOf(p, env)).toEqual([
      { recommendation: 'ana', quote: 'Ana on b', name: 'Ana Ruiz', title: 'VP, Example Co' },
      { recommendation: 'bo', quote: 'Bo on a', name: 'Bo Chen' },
    ]);
  });

  it("the lead: the person's role, positioning only when written, facts, and the goal's two actions", () => {
    const lead = leadOf({ name: 'Ana', role: 'Designer', positioning: '  ', showcase: { facts: [{ id: 'y', text: '9 years', source: 'ref:article/cv' }] }, goal: 'hired', resumeHref: '/r/', contactHref: '/c/' });
    expect(lead).toEqual({ name: 'Ana', role: 'Designer', facts: ['9 years'], primary: { label: 'Read résumé', href: '/r/' }, secondary: { label: 'Contact me', href: '/c/' } });
    expect(leadOf({ name: 'Ana', showcase: { actions: { primary: 'See my CV' } }, goal: 'hired', resumeHref: '/r/' })).toEqual({ name: 'Ana', facts: [], primary: { label: 'See my CV', href: '/r/' } });
  });
});

describe("Bento's tiles", () => {
  it('names, lines, the label, the quote, the picture and the evidence; strengths without proof are left out', () => {
    const tiles = bentoTiles(picks([strength('a', { picture: 'm/a', voice: { recommendation: 'ana', quote: 'Great' } }), strength('b', { shown: false }), strength('c', { total: 1, all: [page('x', 'shipped')], details: [page('x', 'shipped')] })]), BENTO_DEFAULTS, env);
    expect(tiles.map((t) => t.id)).toEqual(['a', 'c']);
    expect(tiles[0]).toMatchObject({ name: 'Name a', short: 'a', line: 'Line of a', label: 'Built · 2 pieces of evidence', picture: 'm/a', quote: { quote: 'Great', name: 'Ana Ruiz' } });
    expect(tiles[1].label).toBe('Shipped · 1 piece of evidence');
    expect(tiles[1].details.map((d) => d.href)).toEqual(['/base/work/x/']);
  });

  it('lays out 3 to 6 strengths as for every site §4 says: three tall, two by two, two wide then three, two rows of three', () => {
    const spans = (n: number) => bentoTiles(picks(Array.from({ length: n }, (_, i) => strength(`s${i}`))), BENTO_DEFAULTS, env).map((t) => t.span);
    expect(spans(3)).toEqual([4, 4, 4]);
    expect(spans(4)).toEqual([6, 6, 6, 6]);
    expect(spans(5)).toEqual([6, 6, 4, 4, 4]);
    expect(spans(6)).toEqual([4, 4, 4, 4, 4, 4]);
    // every row fills the 12 columns
    for (const n of [3, 4, 5, 6]) expect(SPANS[n].reduce((a, b) => a + b, 0) % 12).toBe(0);
  });

  it('settings: pictures from the work, chosen only or none; strongest first unless a lens orders them', () => {
    const p = picks([strength('a', { weight: 0.2, picture: 'm/proof' }), strength('b', { weight: 0.9, capability: { id: 'b', name: 'B', short: 'B', line: 'L', media: 'm/chosen' }, picture: 'm/chosen' })]);
    expect(bentoTiles(p, { ...BENTO_DEFAULTS, pictures: 'chosen' }, env).map((t) => t.picture)).toEqual([undefined, 'm/chosen']);
    expect(bentoTiles(p, { ...BENTO_DEFAULTS, pictures: 'none' }, env).every((t) => !t.picture)).toBe(true);
    expect(bentoTiles(p, { ...BENTO_DEFAULTS, order: 'strongest' }, env).map((t) => t.id)).toEqual(['b', 'a']);
    expect(bentoTiles({ ...p, lens: 'ai' }, { ...BENTO_DEFAULTS, order: 'strongest' }, env).map((t) => t.id)).toEqual(['a', 'b']);
  });

  it("under a lens, its first strength takes the first tile (the widest, when the count makes one) and none is left out", () => {
    // curate puts the lens's order in picks.strengths; the view keeps it, whatever its own order setting
    const lensed = picks(['e', 'a', 'b', 'c', 'd'].map((id, i) => strength(id, { weight: i / 10 })), { lens: 'maker' });
    const tiles = bentoTiles(lensed, { ...BENTO_DEFAULTS, order: 'strongest' }, env);
    expect(tiles.map((t) => [t.id, t.span])).toEqual([['e', 6], ['a', 6], ['b', 4], ['c', 4], ['d', 4]]);
  });

  it("reads the view's settings, anything unknown as its default", () => {
    expect(bentoSettings()).toEqual(BENTO_DEFAULTS);
    expect(bentoSettings({ lead: 'voice', density: 'loud', pictures: 'none', order: 'strongest', words: 'off' })).toEqual({ lead: 'voice', density: 'calm', pictures: 'none', order: 'strongest', words: 'off' });
  });

  it('the label without a kind is just the count', () => {
    expect(evidenceLabel({ all: [page('a')], total: 3 }, 'hired')).toBe('3 pieces of evidence');
  });
});

describe('a strength in the address', () => {
  it('reads #cap-<id>, decoded, and nothing else', () => {
    expect(capabilityFromHash('#cap-ai')).toBe('ai');
    expect(capabilityFromHash('#cap-r%C3%A9sum%C3%A9')).toBe('résumé');
    expect(capabilityFromHash('#cap-%E0%A4')).toBe('%E0%A4');
    expect(capabilityFromHash('#main')).toBeNull();
    expect(capabilityFromHash('#cap-')).toBeNull();
    expect(capabilityFromHash('')).toBeNull();
  });
});
