import { describe, expect, it } from 'vitest';
import { buildPlaySearch, classicHrefFor, parsePlayUrl, playHrefFor } from '../../src/game/platform/url';
import { decide } from '../../src/game/platform/capabilities';

describe('url state', () => {
  it('parses at/open/mode', () => {
    expect(parsePlayUrl('?at=library&open=1')).toEqual({ at: 'library', open: true, mode: null });
    expect(parsePlayUrl('?mode=classic')).toEqual({ at: null, open: false, mode: 'classic' });
    expect(parsePlayUrl('')).toEqual({ at: null, open: false, mode: null });
  });

  it('flags malformed ids as invalid', () => {
    expect(parsePlayUrl('?at=<script>').at).toBe('__invalid__');
    expect(parsePlayUrl('?mode=weird').mode).toBeNull();
  });

  it('builds searches and hrefs', () => {
    expect(buildPlaySearch('workshop')).toBe('?at=workshop');
    expect(buildPlaySearch('workshop', true)).toBe('?at=workshop&open=1');
    expect(buildPlaySearch(null)).toBe('');
    expect(classicHrefFor('workshop')).toBe('/classic/workshop/');
    expect(classicHrefFor(null)).toBe('/classic/');
    expect(playHrefFor('library')).toBe('/play/?at=library');
  });
});

describe('capability gate decision', () => {
  it('falls back without WebGL2', () => {
    expect(decide({ webgl2: false, majorPerformanceCaveat: false, saveData: false })).toEqual({ kind: 'fallback', reason: 'no-webgl2' });
  });
  it('offers a choice for software rendering or save-data', () => {
    expect(decide({ webgl2: true, majorPerformanceCaveat: true, saveData: false }).kind).toBe('offer');
    expect(decide({ webgl2: true, majorPerformanceCaveat: false, saveData: true })).toEqual({ kind: 'offer', reason: 'save-data' });
  });
  it('loads on capable devices', () => {
    expect(decide({ webgl2: true, majorPerformanceCaveat: false, saveData: false })).toEqual({ kind: 'load' });
  });
});
