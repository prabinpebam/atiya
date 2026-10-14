/**
 * The mode host's calls (src/game/platform/host.ts; plan M1.2) and the mode kit's types kept equal to the
 * site's lists. The host runs in the gate, so this stubs the few browser globals it touches.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHost, siteAddress, STORAGE_CAP_BYTES } from '../../src/game/platform/host';
import { PAGE_KINDS, SECTION_VIEWS } from '../../src/site/content/schema';
import type { ModeData, ModePageKind, ModeSectionView } from '../../packages/mode-kit/types';

const data: ModeData = {
  api: 1,
  mode: { id: 'little-planet', mount: 'play', settings: {} },
  site: { name: 'Ada', description: 'Hers', locale: 'en', base: '/', owner: { name: 'Ada' } },
  sections: [{ id: 'work', title: 'Work', summary: '', view: 'list', url: '/work/', hasPrivate: false, pages: [{ id: 'engine', title: 'Engine', summary: '', kind: 'note', url: '/work/engine/' }] }],
  slots: [
    { id: 'workshop', section: 'work', words: {} },
    { id: 'library', section: null, words: {} },
  ],
  entry: {},
  links: { home: '/', signIn: '/sign-in/' },
};

/** A Storage stand-in, enough for the host. */
function fakeStorage() {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    map: m,
  };
}

describe('the mode host (M1.2)', () => {
  let events: CustomEvent[];
  let storage: ReturnType<typeof fakeStorage>;
  beforeEach(() => {
    events = [];
    storage = fakeStorage();
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('CustomEvent', class extends Event {
      detail: unknown;
      constructor(type: string, init?: { detail?: unknown }) {
        super(type);
        this.detail = init?.detail;
      }
    });
    vi.stubGlobal('document', { documentElement: { dataset: { theme: 'dark' }, classList: { contains: (c: string) => c === 'text-lg' } }, dispatchEvent: (e: CustomEvent) => events.push(e) });
    vi.stubGlobal('location', { pathname: '/play/' });
    vi.stubGlobal('history', { state: null, replaceState: vi.fn() });
  });
  afterEach(() => vi.unstubAllGlobals());

  const host = () => createHost(data, 'high', new AbortController().signal);

  it('gives the mode its data, the gate\'s tier and the page\'s prefs', () => {
    const h = host();
    expect(h.data).toBe(data);
    expect(h.tier).toBe('high');
    expect(h.prefs).toMatchObject({ scheme: 'dark', largerText: true, reducedMotion: false });
  });

  it('keeps the mode\'s storage in its own namespace, as JSON, and refuses more than the cap', () => {
    const h = host();
    h.storage.set('backpack', { slots: [1, 2] });
    expect(storage.map.get('mode.little-planet.backpack')).toBe('{"slots":[1,2]}');
    expect(h.storage.get('backpack')).toEqual({ slots: [1, 2] });
    expect(h.storage.get('missing')).toBeUndefined();
    storage.setItem('site.theme', 'dark');
    h.storage.remove('backpack');
    expect([...storage.map.keys()]).toEqual(['site.theme']);
    expect(() => h.storage.set('huge', 'x'.repeat(STORAGE_CAP_BYTES / 2))).toThrow(/used its 256 KB/);
  });

  it('opens a section through the overlay\'s event, reports through the page\'s allowlist, and keeps the address current', () => {
    const h = host();
    h.open({ slot: 'workshop' });
    h.track({ name: 'planet_opened', props: { ms: 1200 } });
    expect(events.map((e) => [e.type, e.detail])).toEqual([
      ['mode:open', { slot: 'workshop' }],
      ['planet:event', { event: 'planet_opened', props: { ms: 1200 } }],
    ]);
    h.setAddress({ slot: 'workshop' });
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '/play/?at=workshop');
  });

  it('leads to the site: the page, else the slot\'s section, else home', () => {
    expect(siteAddress(data, { slot: 'workshop', page: 'engine' })).toBe('/work/engine/');
    expect(siteAddress(data, { slot: 'workshop' })).toBe('/work/');
    expect(siteAddress(data, { slot: 'library' })).toBe('/');
    expect(siteAddress(data)).toBe('/');
  });
});

describe("the mode kit's types follow the site's lists", () => {
  it('section views and page kinds are the same', () => {
    const views: readonly ModeSectionView[] = SECTION_VIEWS;
    const kinds: readonly ModePageKind[] = PAGE_KINDS;
    expect([...views].sort()).toEqual(['bento', 'features', 'list', 'tiles']);
    expect([...kinds].sort()).toEqual(['gallery', 'note', 'page', 'talk']);
  });
});
