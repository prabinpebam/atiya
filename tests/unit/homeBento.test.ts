/**
 * Bento's tiles and what every view shows the same way (documentation/home-views/bento.md §4, foundation.md §7,
 * for-every-site.md §4): labels, evidence links, voices, the lead, the layouts for 3 to 6 strengths and the settings.
 */
import { describe, expect, it } from 'vitest';
import { BENTO_DEFAULTS, ROLES, ROLE_SIZE, bentoColumns, bentoRoles, bentoSettings, bentoTiles, evidenceLabel, pack } from '../../src/site/home/bento';
import { askHref, evidenceOf, leadOf, strongestKind, voicesOf } from '../../src/site/home/present';
import { capabilityFromHash } from '../../src/site/scripts/homeAddress';
import { bentoPictures } from '../../src/site/design/bentoPictures';
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
    expect(tiles[0]).toMatchObject({ name: 'Name a', short: 'a', line: 'Line of a', label: 'Built · 2 pieces of evidence', pictures: { wide: 'm/a', thumbnail: 'm/a', square: 'm/a' }, role: 'feature', keywords: [], quote: { quote: 'Great', name: 'Ana Ruiz' } });
    expect(tiles[1].label).toBe('Shipped · 1 piece of evidence');
    expect(tiles[1].details.map((d) => d.href)).toEqual(['/base/work/x/']);
  });

  it('packs like CSS grid dense flow: each tile at the first place it fits', () => {
    expect(pack([[2, 2], [1, 1], [1, 2], [1, 1]], 4)).toEqual({ at: [[0, 0], [0, 2], [0, 3], [1, 2]], whole: true, inOrder: true });
    // a hole: a single, then a wide that can't fit beside it
    expect(pack([[1, 1], [2, 1]], 2).whole).toBe(false);
    // a tile wider than the grid takes the whole row
    expect(pack([[2, 1]], 1)).toEqual({ at: [[0, 0]], whole: true, inOrder: true });
  });

  it('every count from 1 to 6 has an arrangement that fills a whole rectangle at its columns and at two', () => {
    for (let n = 1; n <= 6; n++) {
      const roles = bentoRoles(Array.from({ length: n }, () => ({ picture: true, quote: false, total: 1 })));
      expect([...roles].sort()).toEqual([...ROLES[n]].sort());
      expect(pack(roles.map((r) => ROLE_SIZE[r].four), bentoColumns(n)).whole).toBe(true);
      expect(pack(roles.map((r) => ROLE_SIZE[r].two), 2).whole).toBe(true);
    }
    expect(bentoColumns(1)).toBe(2);
    expect(bentoColumns(6)).toBe(4);
  });

  it('the biggest places go to tiles with a picture, then a quote, then the most proof, then the earlier; the order is never changed', () => {
    const t = (picture: boolean, quote = false, total = 1) => ({ picture, quote, total });
    // all alike: the first is the feature
    expect(bentoRoles([t(true), t(true), t(true), t(true), t(true), t(true)])[0]).toBe('feature');
    // the owner's case: the second has no picture, so it's a single; the first the feature, a tall beside it
    expect(bentoRoles([t(true, true, 9), t(false, false, 9), t(true), t(true), t(true), t(true)])).toEqual(['feature', 'single', 'tall', 'single', 'wide', 'wide']);
    // a picture earns the feature over an earlier tile without one
    expect(bentoRoles([t(false), t(true), t(false)])).toEqual(['wide', 'feature', 'wide']);
    // a quote breaks the tie between pictures
    expect(bentoRoles([t(true), t(true, true), t(true)])).toEqual(['wide', 'feature', 'wide']);
    // more proof alone doesn't move it from the first place
    expect(bentoRoles([t(true), t(true), t(true, false, 40)])).toEqual(['feature', 'wide', 'wide']);
  });

  it("each tile keeps every shape of its picture and a few keywords other than its name", () => {
    const shaped = (id: string) => ({ wide: `${id}/wide`, thumbnail: `${id}/thumb`, square: `${id}/square` });
    const tiles = bentoTiles(picks(['a', 'b', 'c'].map((id) => strength(id, { picture: `${id}/wide`, pictures: shaped(id), keywords: [`Name ${id}`, 'One', 'Two', 'Three', 'Four', 'Five'] }))), BENTO_DEFAULTS, env);
    expect(tiles.map((t) => [t.role, t.pictures])).toEqual([
      ['feature', shaped('a')],
      ['wide', shaped('b')],
      ['wide', shaped('c')],
    ]);
    expect(tiles[0].keywords).toEqual(['One', 'Two', 'Three', 'Four']);
    // the strength's own picture, chosen, is every shape
    expect(bentoTiles(picks([strength('a', { capability: { id: 'a', name: 'A', short: 'A', line: 'L', media: 'm/own' }, pictures: shaped('a') })]), { ...BENTO_DEFAULTS, pictures: 'chosen' }, env)[0].pictures).toEqual({ wide: 'm/own', thumbnail: 'm/own', square: 'm/own' });
  });

  it('settings: pictures from the work, chosen only or none; strongest first unless a lens orders them', () => {
    const p = picks([strength('a', { weight: 0.2, picture: 'm/proof' }), strength('b', { weight: 0.9, capability: { id: 'b', name: 'B', short: 'B', line: 'L', media: 'm/chosen' }, picture: 'm/chosen' })]);
    expect(bentoTiles(p, { ...BENTO_DEFAULTS, pictures: 'chosen' }, env).map((t) => t.pictures?.thumbnail)).toEqual([undefined, 'm/chosen']);
    expect(bentoTiles(p, { ...BENTO_DEFAULTS, pictures: 'none' }, env).every((t) => !t.pictures)).toBe(true);
    expect(bentoTiles(p, { ...BENTO_DEFAULTS, order: 'strongest' }, env).map((t) => t.id)).toEqual(['b', 'a']);
    expect(bentoTiles({ ...p, lens: 'ai' }, { ...BENTO_DEFAULTS, order: 'strongest' }, env).map((t) => t.id)).toEqual(['a', 'b']);
  });

  it("under a lens, its first strength takes the first tile (the feature, when they're alike) and none is left out", () => {
    // curate puts the lens's order in picks.strengths; the view keeps it, whatever its own order setting
    const lensed = picks(['e', 'a', 'b', 'c', 'd'].map((id, i) => strength(id, { weight: i / 10 })), { lens: 'maker' });
    const tiles = bentoTiles(lensed, { ...BENTO_DEFAULTS, order: 'strongest' }, env);
    expect(tiles.map((t) => [t.id, t.role])).toEqual([['e', 'feature'], ['a', 'single'], ['b', 'single'], ['c', 'single'], ['d', 'single']]);
  });
  it("reads the view's settings, anything unknown as its default", () => {
    expect(bentoSettings()).toEqual(BENTO_DEFAULTS);
    expect(bentoSettings({ lead: 'voice', density: 'loud', pictures: 'none', order: 'strongest', words: 'off', corners: 'rounded' })).toEqual({ lead: 'voice', density: 'calm', pictures: 'none', order: 'strongest', words: 'off', corners: 'rounded' });
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

describe("Bento's pictures", () => {
  const pic = (w: number, h: number) => ({ src: `/p-${w}.webp`, srcset: '', alt: 'x', width: w, height: h });

  it('draws the shape each layout’s frame takes when the strength has it, else its thumbnail, whole and square-cornered', () => {
    const tall = bentoPictures('tall', { thumbnail: pic(600, 400), square: pic(500, 500) }, 4);
    expect(tall.map((p) => [p.shape, p.at])).toEqual([['square', ['four', 'two']], ['thumbnail', ['one']]]);
    expect(tall[0].image).toMatchObject({ ratio: '1/1', display: 'fit', rounded: false });
    expect(bentoPictures('wide', { thumbnail: pic(600, 400) }, 4).map((p) => [p.shape, p.at])).toEqual([['thumbnail', ['four', 'two', 'one']]]);
    expect(bentoPictures('single', undefined, 4)).toEqual([]);
  });

  it('keeps rounded corners only when the picture asks', () => {
    expect(bentoPictures('single', { thumbnail: { ...pic(600, 400), rounded: true } }, 4)[0].image.rounded).toBe(true);
  });
});