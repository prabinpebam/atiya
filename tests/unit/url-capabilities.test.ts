import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildPlaySearch, classicHrefFor, parsePlayUrl, playHrefFor } from '../../src/game/platform/url';
import { decide, probeCapabilities } from '../../src/game/platform/capabilities';

describe('url state', () => {
  it('parses at/open/page/mode', () => {
    expect(parsePlayUrl('?at=library&open=1')).toEqual({ at: 'library', open: true, page: null, mode: null });
    expect(parsePlayUrl('?at=lighthouse&open=1&page=do-what-makes-you-proud')).toEqual({ at: 'lighthouse', open: true, page: 'do-what-makes-you-proud', mode: null });
    expect(parsePlayUrl('?mode=classic')).toEqual({ at: null, open: false, page: null, mode: 'classic' });
    expect(parsePlayUrl('')).toEqual({ at: null, open: false, page: null, mode: null });
  });

  it('flags malformed ids as invalid', () => {
    expect(parsePlayUrl('?at=<script>').at).toBe('__invalid__');
    expect(parsePlayUrl('?mode=weird').mode).toBeNull();
    expect(parsePlayUrl('?at=lighthouse&open=1&page=<b>').page).toBeNull();
  });

  it('builds searches and hrefs', () => {
    expect(buildPlaySearch('workshop')).toBe('?at=workshop');
    expect(buildPlaySearch('workshop', true)).toBe('?at=workshop&open=1');
    expect(buildPlaySearch('lighthouse', true, 'proud')).toBe('?at=lighthouse&open=1&page=proud');
    expect(buildPlaySearch('lighthouse', false, 'proud')).toBe('?at=lighthouse');
    expect(buildPlaySearch(null)).toBe('');
    expect(classicHrefFor()).toBe('/#sections');
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

describe('capability probe', () => {
  /** A fake browser: which WebGL2 contexts it can make, and how many the probe asked for. */
  function device(kind: 'gpu' | 'software' | 'none') {
    let contexts = 0;
    const canvas = {
      getContext: (type: string, attrs?: WebGLContextAttributes) => {
        if (type !== 'webgl2' || kind === 'none') return null;
        if (kind === 'software' && attrs?.failIfMajorPerformanceCaveat) return null;
        contexts++;
        return { getExtension: () => ({ loseContext: () => {} }) };
      },
    };
    vi.stubGlobal('document', { createElement: () => canvas });
    vi.stubGlobal('navigator', {});
    return { contexts: () => contexts };
  }
  afterEach(() => vi.unstubAllGlobals());

  it('needs a single context on a capable device', () => {
    const d = device('gpu');
    expect(probeCapabilities()).toEqual({ webgl2: true, majorPerformanceCaveat: false, saveData: false });
    expect(d.contexts()).toBe(1);
  });
  it('still detects software rendering and missing WebGL2', () => {
    device('software');
    expect(probeCapabilities()).toEqual({ webgl2: true, majorPerformanceCaveat: true, saveData: false });
    device('none');
    expect(probeCapabilities()).toEqual({ webgl2: false, majorPerformanceCaveat: false, saveData: false });
  });
});
