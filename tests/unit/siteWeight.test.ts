import { describe, expect, it } from 'vitest';
import { WEIGHT_FAIL, WEIGHT_WARN, weightVerdict } from '../../scripts/lib/siteWeight.mjs';

describe('the site weight check (gallery spec §11)', () => {
  it('passes a site under 750 MB', () => expect(weightVerdict(WEIGHT_WARN).level).toBe('ok'));
  it('warns past 750 MB', () => expect(weightVerdict(WEIGHT_WARN + 1).level).toBe('warn'));
  it('fails past 950 MB, saying what to do', () => {
    const v = weightVerdict(WEIGHT_FAIL + 1);
    expect(v.level).toBe('fail');
    expect(v.words).toMatch(/remove or shrink/);
  });
});
