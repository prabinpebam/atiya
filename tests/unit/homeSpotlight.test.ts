import { describe, expect, it } from 'vitest';
import { SPOTLIGHT_DEFAULTS, spotlightSettings, spotlightShow, MAX_DETAILS } from '../../src/site/home/spotlight';
import { highlightFromHash, jumpTarget } from '../../src/site/scripts/homeAddress';
import { env, highlight, page, picks, resume, strength } from './homeFixtures';

const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe('Spotlight settings', () => {
  it('fills in the defaults: gentle, your order, 8, titles', () => {
    expect(spotlightSettings()).toEqual(SPOTLIGHT_DEFAULTS);
    expect(SPOTLIGHT_DEFAULTS).toEqual({ motion: 'gentle', order: 'yours', count: 8, rail: 'titles' });
  });

  it('keeps the count between 4 and 8, and takes anything unknown as its default', () => {
    expect(spotlightSettings({ count: 2 }).count).toBe(4);
    expect(spotlightSettings({ count: 12 }).count).toBe(8);
    expect(spotlightSettings({ count: 5.6 }).count).toBe(6);
    expect(spotlightSettings({ count: 'six' }).count).toBe(8);
    expect(spotlightSettings({ motion: 'wild', order: 'random', rail: 'cards' })).toEqual(SPOTLIGHT_DEFAULTS);
    expect(spotlightSettings({ motion: 'still', order: 'strongest', rail: 'thumbnails' })).toMatchObject({ motion: 'still', order: 'strongest', rail: 'thumbnails' });
  });
});

describe('Spotlight show', () => {
  const two = [strength('ai'), strength('systems', { weight: 3 })];
  const lights = [highlight('a1', 'ai', 'm1'), highlight('a2', 'ai'), highlight('s1', 'systems', 'm2'), highlight('s2', 'systems')];

  it('in your order keeps the picks\' order, and each slide names its strength', () => {
    const show = spotlightShow(picks(two, { highlights: lights }), SPOTLIGHT_DEFAULTS, env);
    expect(ids(show.slides)).toEqual(['a1', 'a2', 's1', 's2']);
    expect(show.slides[0]).toMatchObject({ href: '/base/work/a1/', title: 'Title a1', picture: 'm1', capability: { id: 'ai', name: 'Name ai', short: 'ai' } });
    expect(show.slides[1].picture).toBeUndefined();
  });

  it('strongest first deals the highlights out over the strengths, the strongest\'s first', () => {
    const show = spotlightShow(picks(two, { highlights: lights }), { ...SPOTLIGHT_DEFAULTS, order: 'strongest' }, env);
    expect(ids(show.slides)).toEqual(['s1', 'a1', 's2', 'a2']);
    expect(ids(show.jump)).toEqual(['systems', 'ai']);
  });

  it('under a lens the lens\'s strength leads, whatever the order setting', () => {
    const lensed = picks([strength('systems'), strength('ai')], { highlights: lights, lens: 'design-systems' });
    expect(ids(spotlightShow(lensed, SPOTLIGHT_DEFAULTS, env).slides)).toEqual(['s1', 'a1', 's2', 'a2']);
  });

  it('leaves out a highlight whose page isn\'t open or whose strength isn\'t shown, and stops at the count', () => {
    const hidden = strength('hidden', { shown: false });
    const many = [...lights, highlight('draft', 'ai'), highlight('h1', 'hidden'), highlight('a3', 'ai'), highlight('a4', 'ai'), highlight('a5', 'ai')];
    const show = spotlightShow(picks([...two, hidden], { highlights: many }), { ...SPOTLIGHT_DEFAULTS, count: 4 }, env);
    expect(ids(show.slides)).toEqual(['a1', 'a2', 's1', 's2']);
    expect(ids(show.jump)).toEqual(['ai', 'systems']);
  });

  it('a slide\'s details are its own page first, then its strength\'s evidence, at most 5, none twice', () => {
    const details = [page('x', 'built'), page('a1', 'shipped'), resume('Led 12 designers', 'led'), page('y'), page('z'), page('w')];
    const ai = strength('ai', { details, all: details });
    const show = spotlightShow(picks([ai], { highlights: [highlight('a1', 'ai')] }), SPOTLIGHT_DEFAULTS, env);
    const d = show.slides[0].details;
    expect(d.map((e) => e.key)).toEqual(['page:a1', 'page:x', 'resume:Led 12 designers', 'page:y', 'page:z']);
    expect(d).toHaveLength(MAX_DETAILS);
    expect(d[0]).toMatchObject({ kindLabel: 'Shipped', href: '/base/work/a1/' });
  });

  it('a highlight not among its strength\'s proof still leads with its own page', () => {
    const show = spotlightShow(picks([strength('ai')], { highlights: [highlight('solo', 'ai')] }), SPOTLIGHT_DEFAULTS, env);
    expect(show.slides[0].details.map((e) => e.key)).toEqual(['page:solo', 'page:ai-a', 'page:ai-b']);
  });

  it('Jump to names every strength shown: its highlights, else its first evidence, else no address', () => {
    const bare = strength('bare', { details: [page('draft')], all: [page('draft')] });
    const show = spotlightShow(picks([strength('ai'), strength('ops'), bare], { highlights: [highlight('a1', 'ai'), highlight('a2', 'ai')] }), SPOTLIGHT_DEFAULTS, env);
    expect(show.jump).toEqual([
      { id: 'ai', name: 'Name ai', short: 'ai', slides: ['a1', 'a2'], href: '#h-a1' },
      { id: 'ops', name: 'Name ops', short: 'ops', slides: [], href: '/base/work/ops-a/' },
      { id: 'bare', name: 'Name bare', short: 'bare', slides: [] },
    ]);
  });

  it('with no highlights the stage is empty but Jump to still covers every strength', () => {
    const show = spotlightShow(picks(two), SPOTLIGHT_DEFAULTS, env);
    expect(show.slides).toEqual([]);
    expect(show.jump.map((j) => j.href)).toEqual(['/base/work/ai-a/', '/base/work/systems-a/']);
  });
});

describe('Spotlight addresses', () => {
  const ids = ['family', 'cloner-pro', 'h-2'];

  it('#h-<id> names a highlight the show has, an escaped one too; anything else is null', () => {
    expect(highlightFromHash('#h-family', ids)).toBe('family');
    expect(highlightFromHash('#h-h-2', ids)).toBe('h-2');
    expect(highlightFromHash('#h-cloner%2Dpro', ids)).toBe('cloner-pro');
    expect(highlightFromHash('#h-gone', ids)).toBeNull();
    expect(highlightFromHash('#cap-family', ids)).toBeNull();
    expect(highlightFromHash('', ids)).toBeNull();
    expect(highlightFromHash('#h-%E0', ids)).toBeNull();
  });

  it('Jump to goes to a strength\'s first highlight, then on to its next, round to the first', () => {
    expect(jumpTarget(['a1', 'a2'], 's1')).toBe('a1');
    expect(jumpTarget(['a1', 'a2'], null)).toBe('a1');
    expect(jumpTarget(['a1', 'a2'], 'a1')).toBe('a2');
    expect(jumpTarget(['a1', 'a2'], 'a2')).toBe('a1');
    expect(jumpTarget(['a1'], 'a1')).toBe('a1');
    expect(jumpTarget([], 'a1')).toBeNull();
  });
});
