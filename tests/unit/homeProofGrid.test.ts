/**
 * Proof grid's table (documentation/home-views/proof-grid.md §4, §9; for-every-site.md §3.3): the columns, a cell's
 * count, state and name, a row's evidence groups, the settings, and what an address opens.
 */
import { describe, expect, it } from 'vitest';
import { MAX_COLUMNS, PROOF_GRID_DEFAULTS, cellLabel, gridColumns, proofGrid, proofGridSettings } from '../../src/site/home/proofGrid';
import { splitLast } from '../../src/site/design/typography';
import { gridTarget } from '../../src/site/scripts/homeAddress';
import { env, page, picks, resume, said, strength } from './homeFixtures';

const ai = strength('ai', {
  details: [page('cloner', 'built')],
  all: [page('cloner', 'built'), page('watai', 'built'), resume('Led the AI program', 'led'), resume('Shipped Copilot', 'shipped'), said('ana'), said('zed'), page('draft', 'wrote'), page('essay', 'wrote'), page('untyped')],
});
const lead = strength('lead', { all: [resume('Built the org', 'led'), page('family', 'shipped'), page('talk', 'spoke')] });

describe("Proof grid's table", () => {
  it("the columns: the kinds the strengths shown use most, five at most, in the kinds' own order", () => {
    // ai: built 2, led 1, shipped 1, said 1 (zed is no one), wrote 1 (the draft leads nowhere); lead: led 1, shipped 1, spoke 1
    expect(gridColumns([ai, lead], {}, env)).toEqual(['shipped', 'led', 'built', 'wrote', 'spoke']);
    expect(gridColumns([ai], {}, env)).toEqual(['shipped', 'led', 'built', 'wrote', 'said']);
    expect(gridColumns([ai, lead], { columns: ['said', 'built'] }, env)).toEqual(['said', 'built']);
  });

  it("a cell: its count, filled when something is on the site, outlined when it's all résumé lines, empty when none", () => {
    const grid = proofGrid(picks([ai, lead]), { ...PROOF_GRID_DEFAULTS, columns: ['shipped', 'led', 'built', 'said', 'recognised'] }, env);
    const cells = Object.fromEntries(grid.rows[0].cells.map((c) => [c.kind, [c.count, c.onSite, c.state]]));
    expect(cells).toEqual({ shipped: [1, 0, 'outlined'], led: [1, 0, 'outlined'], built: [2, 2, 'filled'], said: [1, 1, 'filled'], recognised: [0, 0, 'empty'] });
    expect(grid.rows[0].cells.map((c) => c.label)).toEqual([
      'Name ai, shipped: 1 item, on the résumé',
      'Name ai, led: 1 item, on the résumé',
      'Name ai, built: 2 items, 2 on the site',
      'Name ai, said: 1 item, 1 on the site',
      'Name ai, recognised: none',
    ]);
  });

  it("a row: every proof it can show; its cells add up to those of the columns' kinds; its evidence grouped by column, then the rest", () => {
    const grid = proofGrid(picks([ai, lead]), { ...PROOF_GRID_DEFAULTS, columns: ['built', 'led'] }, env);
    const row = grid.rows[0];
    expect(row).toMatchObject({ id: 'ai', name: 'Name ai', short: 'ai', line: 'Line of ai', total: 7 });
    expect(row.cells.reduce((n, c) => n + c.count, 0)).toBe(3);
    expect(row.groups.map((g) => [g.kind, g.heading, g.items.length])).toEqual([['built', 'Built', 2], ['led', 'Led', 1], ['other', 'Other evidence', 4]]);
    // every piece of evidence is in exactly one group
    for (const r of grid.rows) expect(r.groups.reduce((n, g) => n + g.items.length, 0)).toBe(r.total);
  });

  it('rows in the view\'s order: strongest first unless a lens orders them; strengths without proof are left out', () => {
    const p = picks([strength('a', { weight: 0.2 }), strength('b', { weight: 0.9 }), strength('c', { shown: false })]);
    expect(proofGrid(p, { ...PROOF_GRID_DEFAULTS, order: 'strongest' }, env).rows.map((r) => r.id)).toEqual(['b', 'a']);
    expect(proofGrid({ ...p, lens: 'x' }, { ...PROOF_GRID_DEFAULTS, order: 'strongest' }, env).rows.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('a cell\'s name says one item or several', () => {
    expect(cellLabel('AI', 'wrote', 1, 1)).toBe('AI, wrote: 1 item, 1 on the site');
    expect(cellLabel('AI', 'wrote', 3, 0)).toBe('AI, wrote: 3 items, on the résumé');
  });

  it("a name's last word is cut off whole, so its chevron wraps with it; the parts make the name again", () => {
    expect(splitLast('Systems and operating models')).toEqual(['Systems and operating ', 'models']);
    expect(splitLast('Hands-on making')).toEqual(['Hands-on ', 'making']);
    expect(splitLast('Craft')).toEqual(['', 'Craft']);
    expect(splitLast('AI work ')).toEqual(['AI ', 'work']);
    for (const name of ['Design leadership', 'Writing and speaking', 'X']) expect(splitLast(name).join('')).toBe(name);
  });

  it("reads the view's settings, anything unknown as its default; columns only as a list of up to five distinct kinds", () => {
    expect(proofGridSettings()).toEqual(PROOF_GRID_DEFAULTS);
    expect(proofGridSettings({ density: 'calm', order: 'strongest', columns: ['said', 'led'], empty: 'hide' })).toEqual({ density: 'calm', order: 'strongest', columns: ['said', 'led'], empty: 'hide' });
    for (const columns of [['led', 'led'], ['made'], [], 'led', ['shipped', 'led', 'built', 'wrote', 'spoke', 'said']]) expect(proofGridSettings({ columns }).columns).toBeUndefined();
    expect(MAX_COLUMNS).toBe(5);
  });
});

describe('an address in the proof grid', () => {
  const ids = ['ai', 'ai-tools', 'lead'];
  const kinds = ['shipped', 'led', 'built'];
  it('#cap-<id> opens a row, #cap-<id>-<kind> a cell; the longest ID wins', () => {
    expect(gridTarget('#cap-ai', ids, kinds)).toEqual({ id: 'ai', kind: 'all' });
    expect(gridTarget('#cap-ai-led', ids, kinds)).toEqual({ id: 'ai', kind: 'led' });
    expect(gridTarget('#cap-ai-tools', ids, kinds)).toEqual({ id: 'ai-tools', kind: 'all' });
    expect(gridTarget('#cap-ai-tools-built', ids, kinds)).toEqual({ id: 'ai-tools', kind: 'built' });
  });
  it('nothing else', () => {
    for (const hash of ['', '#main', '#cap-', '#cap-ai-wrote', '#cap-nobody', '#cap-ai-']) expect(gridTarget(hash, ids, kinds)).toBeNull();
  });
});
