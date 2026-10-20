import { describe, expect, it } from 'vitest';
import { homeEvents } from '../../src/site/scripts/homeRoute';

const bento = { view: 'bento', at: 'view', lens: '' };

describe('homeEvents (documentation/home-views/switcher.md §8)', () => {
  it('says how a visitor came to a view: a link to its address', () => {
    expect(homeEvents(bento, null, null)).toEqual({ events: [['home_view', { view: 'bento', lens: 'none', source: 'link' }]], announce: false });
  });

  it('says the default at the root, unless the router said otherwise', () => {
    expect(homeEvents({ ...bento, at: 'root' }, null, null).events[0][1].source).toBe('default');
    expect(homeEvents({ ...bento, at: 'root' }, 'stored', null).events[0][1].source).toBe('stored');
  });

  it('names the lens, or none', () => {
    expect(homeEvents({ ...bento, lens: 'research' }, null, null).events[0][1].lens).toBe('research');
  });

  it('reports a switch and announces the new view', () => {
    const r = homeEvents(bento, 'stored', { from: 'classic', to: 'bento' });
    expect(r.events).toEqual([
      ['home_view', { view: 'bento', lens: 'none', source: 'stored' }],
      ['view_switch', { from: 'classic', to: 'bento' }],
    ]);
    expect(r.announce).toBe(true);
  });

  it('reports Use the default', () => {
    const r = homeEvents({ view: 'classic', at: 'root', lens: '' }, 'default', { from: 'bento', default: true });
    expect(r.events[1]).toEqual(['view_default', { from: 'bento' }]);
    expect(r.announce).toBe(true);
  });

  it('reports nothing for choosing the view already showing', () => {
    const r = homeEvents(bento, 'stored', { from: 'bento', to: 'bento' });
    expect(r.events).toHaveLength(1);
    expect(r.announce).toBe(false);
  });
});