/**
 * Cover's issue (documentation/home-views/cover.md §3, §4): numbered cover lines in the view's order, each with its
 * feature's evidence, and the cover story and picture chosen as the settings, the lens and the highlights say.
 */
import { describe, expect, it } from 'vitest';
import { COVER_DEFAULTS, coverIssue, coverSettings } from '../../src/site/home/cover';
import { env, highlight, page, picks, strength } from './homeFixtures';

describe("Cover's issue", () => {
  it('a numbered cover line per strength shown, with its label, picture and evidence', () => {
    const issue = coverIssue(picks([strength('lead', { picture: 'm/lead' }), strength('gone', { shown: false }), strength('ai', { details: [page('cloner', 'built'), page('draft', 'wrote')] })]), COVER_DEFAULTS, env);
    expect(issue.lines.map((l) => [l.number, l.id])).toEqual([['01', 'lead'], ['02', 'ai']]);
    expect(issue.lines[0]).toMatchObject({ name: 'Name lead', short: 'lead', line: 'Line of lead', label: 'Built · 2 pieces of evidence', picture: 'm/lead' });
    // a draft leads nowhere, so it isn't evidence
    expect(issue.lines[1].details.map((d) => d.href)).toEqual(['/base/work/cloner/']);
    expect(issue.lines[1].picture).toBeUndefined();
  });

  it('strongest first, unless a lens orders them', () => {
    const p = picks([strength('a', { weight: 0.2 }), strength('b', { weight: 0.9 })]);
    expect(coverIssue(p, { ...COVER_DEFAULTS, order: 'strongest' }, env).lines.map((l) => l.id)).toEqual(['b', 'a']);
    expect(coverIssue({ ...p, lens: 'x' }, { ...COVER_DEFAULTS, order: 'strongest' }, env).lines.map((l) => l.id)).toEqual(['a', 'b']);
  });

  it("the story: the person's choice by ID or ref, else the lens's first strength's, else the first; only an open page of a strength shown", () => {
    const strengths = [strength('a'), strength('b'), strength('hidden', { shown: false })];
    const highlights = [highlight('draft', 'a'), highlight('secret', 'hidden'), highlight('one', 'a', 'm/one'), highlight('two', 'b', 'm/two')];
    const p = picks(strengths, { highlights });
    expect(coverIssue(p, COVER_DEFAULTS, env).story).toEqual({ id: 'one', href: '/base/work/one/', title: 'Title one', capability: 'a', picture: 'm/one' });
    expect(coverIssue(p, { ...COVER_DEFAULTS, story: 'two' }, env).story?.id).toBe('two');
    expect(coverIssue(p, { ...COVER_DEFAULTS, story: 'ref:article/two' }, env).story?.id).toBe('two');
    // a story that isn't a highlight the view shows falls back
    expect(coverIssue(p, { ...COVER_DEFAULTS, story: 'secret' }, env).story?.id).toBe('one');
    // a lens that puts b first puts its story on the cover
    expect(coverIssue(picks([strengths[1], strengths[0]], { highlights, lens: 'b-role' }), COVER_DEFAULTS, env).story?.id).toBe('two');
    expect(coverIssue(picks(strengths), COVER_DEFAULTS, env).story).toBeUndefined();
  });

  it("the picture: the person's, else the story's, else the first strength's that has one", () => {
    const p = picks([strength('a'), strength('b', { picture: 'm/b' })], { highlights: [highlight('one', 'a', 'm/one')] });
    expect(coverIssue(p, { ...COVER_DEFAULTS, picture: 'm/mine' }, env).picture).toBe('m/mine');
    expect(coverIssue(p, COVER_DEFAULTS, env).picture).toBe('m/one');
    expect(coverIssue({ ...p, highlights: [highlight('one', 'a')] }, COVER_DEFAULTS, env).picture).toBe('m/b');
    expect(coverIssue(picks([strength('a')]), COVER_DEFAULTS, env).picture).toBeUndefined();
  });

  it("reads the view's settings, anything unknown as its default", () => {
    expect(coverSettings()).toEqual(COVER_DEFAULTS);
    expect(coverSettings({ density: 'calm', order: 'strongest', picture: ' m/x ', story: 'one' })).toEqual({ density: 'calm', order: 'strongest', picture: 'm/x', story: 'one' });
    expect(coverSettings({ density: 'loud', order: 'random', picture: '', story: 3 })).toEqual(COVER_DEFAULTS);
  });
});
