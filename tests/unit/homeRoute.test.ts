import { describe, expect, it } from 'vitest';
import { HOME_KEYS, HOME_ROUTER, homeAttrs, type HomeRouting } from '../../src/site/scripts/homeRoute';
import { HUB_WAYS } from '../../src/site/scripts/hub';

// the router runs in the page's head; here it runs against a stand-in document, location, history and storage
function store(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return {
    m,
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
  };
}

const SITE: Omit<HomeRouting, 'at' | 'view'> = {
  default: 'classic',
  offered: ['classic', 'bento'],
  known: ['classic', 'bento', 'cover', 'proof-grid'],
  lenses: ['leader', 'ai'],
  base: '/atiya',
};

interface Run {
  page: Partial<HomeRouting> & Pick<HomeRouting, 'at' | 'view'>;
  url: string;
  local?: Record<string, string>;
  session?: Record<string, string>;
  blocked?: boolean;
}

function run({ page, url, local = {}, session = {}, blocked = false }: Run) {
  const attrs = homeAttrs({ ...SITE, ...page });
  const u = new URL(url, 'https://example.test');
  const out: { replaced: string | null; pushed: string | null } = { replaced: null, pushed: null };
  const ls = store(local);
  const ss = store(session);
  const window = blocked
    ? Object.defineProperties({}, { localStorage: { get: () => { throw new Error('blocked'); } }, sessionStorage: { get: () => { throw new Error('blocked'); } } })
    : { localStorage: ls, sessionStorage: ss };
  const document = { documentElement: { getAttribute: (n: string) => attrs[n] ?? null } };
  const location = { pathname: u.pathname, search: u.search, hash: u.hash, replace: (to: string) => void (out.replaced = to) };
  const history = { state: null, replaceState: (_s: unknown, _t: string, to: string) => void (out.pushed = to) };
  new Function('window', 'document', 'location', 'history', 'URLSearchParams', HOME_ROUTER)(window, document, location, history, URLSearchParams);
  return { ...out, local: Object.fromEntries(ls.m), session: Object.fromEntries(ss.m) };
}

const ROOT = { at: 'root' as const, view: 'classic' };
const BENTO = { at: 'view' as const, view: 'bento' };

describe('home router: which view /', () => {
  it('stays on the default with nothing stored or asked', () => {
    expect(run({ page: ROOT, url: '/atiya/' })).toMatchObject({ replaced: null, pushed: null });
  });

  it("follows the visitor's stored pick when it's offered, and says so", () => {
    const r = run({ page: ROOT, url: '/atiya/', local: { [HOME_KEYS.view]: 'bento' } });
    expect(r.replaced).toBe('/atiya/views/bento/');
    expect(r.session[HOME_KEYS.arrival]).toBe('stored');
  });

  it("stays when the stored pick is the default", () => {
    const r = run({ page: { ...ROOT, view: 'bento', default: 'bento' }, url: '/atiya/', local: { [HOME_KEYS.view]: 'bento' } });
    expect(r.replaced).toBeNull();
  });

  it('forgets a stored pick the site no longer offers', () => {
    const r = run({ page: ROOT, url: '/atiya/', local: { [HOME_KEYS.view]: 'cover' } });
    expect(r.replaced).toBeNull();
    expect(r.local[HOME_KEYS.view]).toBeUndefined();
  });

  it('puts a link before the stored pick, and never stores it', () => {
    const r = run({ page: { ...ROOT, view: 'bento', default: 'bento' }, url: '/atiya/?view=classic', local: { [HOME_KEYS.view]: 'bento' } });
    expect(r.replaced).toBe('/atiya/views/classic/');
    expect(r.session[HOME_KEYS.arrival]).toBe('link');
    expect(r.local[HOME_KEYS.view]).toBe('bento');
  });

  it("sends a link to a view the site doesn't offer to that view's own page (which says so)", () => {
    expect(run({ page: ROOT, url: '/atiya/?view=cover' }).replaced).toBe('/atiya/views/cover/');
  });

  it('ignores a link to a view no site has', () => {
    const r = run({ page: ROOT, url: '/atiya/?view=nope' });
    expect(r.replaced).toBeNull();
    expect(r.pushed).toBe('/atiya/');
  });

  it('drops ?view= naming the default, keeping other parameters and the fragment', () => {
    const r = run({ page: { ...ROOT, view: 'bento', default: 'bento' }, url: '/atiya/?view=bento&telemetry=off#sections' });
    expect(r.replaced).toBeNull();
    expect(r.pushed).toBe('/atiya/?telemetry=off#sections');
  });

  it('keeps other parameters and the fragment through a redirect', () => {
    expect(run({ page: ROOT, url: '/atiya/?telemetry=off#x', local: { [HOME_KEYS.view]: 'bento' } }).replaced).toBe('/atiya/views/bento/?telemetry=off#x');
  });

  it("leaves the classic hub's ways in (?mode=) alone", () => {
    const r = run({ page: ROOT, url: '/atiya/?mode=play', local: { [HOME_KEYS.view]: 'bento' } });
    expect(r).toMatchObject({ replaced: null, pushed: null });
  });

  it('works without a base path', () => {
    expect(run({ page: { ...ROOT, base: '' }, url: '/', local: { [HOME_KEYS.view]: 'bento' } }).replaced).toBe('/views/bento/');
  });

  it('follows the address alone when storage is blocked', () => {
    expect(run({ page: ROOT, url: '/atiya/', blocked: true })).toMatchObject({ replaced: null, pushed: null });
    expect(run({ page: ROOT, url: '/atiya/?view=bento', blocked: true }).replaced).toBe('/atiya/views/bento/');
  });
});

describe('home router: the lens', () => {
  it('opens a view under ?for=, keeps the lens for the visit, and drops it from the address', () => {
    const r = run({ page: BENTO, url: '/atiya/views/bento/?for=ai' });
    expect(r.replaced).toBe('/atiya/views/bento/for/ai/');
    expect(r.session[HOME_KEYS.lens]).toBe('ai');
  });

  it("takes ?for= on the classic hub to the first view that can order (the hub can't)", () => {
    const r = run({ page: ROOT, url: '/atiya/?for=leader' });
    expect(r.replaced).toBe('/atiya/views/bento/for/leader/');
    expect(r.session[HOME_KEYS.lens]).toBe('leader');
  });

  it("keeps the visit's lens on the next home page", () => {
    expect(run({ page: BENTO, url: '/atiya/views/bento/', session: { [HOME_KEYS.lens]: 'ai' } }).replaced).toBe('/atiya/views/bento/for/ai/');
    expect(run({ page: { ...ROOT, view: 'bento', default: 'bento' }, url: '/atiya/', session: { [HOME_KEYS.lens]: 'ai' } }).replaced).toBe('/atiya/views/bento/for/ai/');
  });

  it("doesn't take the classic hub to a lens it can't show", () => {
    expect(run({ page: ROOT, url: '/atiya/', session: { [HOME_KEYS.lens]: 'ai' } }).replaced).toBeNull();
  });

  it("a lensed page keeps its own lens, and stays", () => {
    const r = run({ page: { ...BENTO, lens: 'leader' }, url: '/atiya/views/bento/for/leader/', session: { [HOME_KEYS.lens]: 'ai' } });
    expect(r.replaced).toBeNull();
    expect(r.session[HOME_KEYS.lens]).toBe('leader');
  });

  it('an empty ?for= clears the lens', () => {
    const r = run({ page: { ...BENTO, lens: 'ai' }, url: '/atiya/views/bento/for/ai/?for=', session: { [HOME_KEYS.lens]: 'ai' } });
    expect(r.replaced).toBe('/atiya/views/bento/');
    expect(r.session[HOME_KEYS.lens]).toBeUndefined();
  });

  it('ignores an unknown lens, and forgets a stored one the site no longer has', () => {
    expect(run({ page: BENTO, url: '/atiya/views/bento/?for=nope' }).pushed).toBe('/atiya/views/bento/');
    const r = run({ page: BENTO, url: '/atiya/views/bento/', session: { [HOME_KEYS.lens]: 'gone' } });
    expect(r.replaced).toBeNull();
    expect(r.session[HOME_KEYS.lens]).toBeUndefined();
  });

  it("never moves a view's own page to another view", () => {
    expect(run({ page: BENTO, url: '/atiya/views/bento/', local: { [HOME_KEYS.view]: 'classic' } }).replaced).toBeNull();
  });
});

describe('homeAttrs', () => {
  it("writes the build's knowledge as data attributes, lists space-separated", () => {
    expect(homeAttrs({ ...SITE, ...BENTO })).toEqual({
      'data-home-at': 'view',
      'data-home-view': 'bento',
      'data-home-default': 'classic',
      'data-home-offered': 'classic bento',
      'data-home-known': 'classic bento cover proof-grid',
      'data-home-lenses': 'leader ai',
      'data-home-lens': '',
      'data-home-base': '/atiya',
    });
  });
});

// the hub's ways in: an inline script after its buttons, run here against stand-in links
function ways({ modes, mode = null, at = 'root', url = '/atiya/' }: { modes: string[]; mode?: string | null; at?: 'root' | 'view'; url?: string }) {
  const links = modes.map((m) => {
    const attrs: Record<string, string> = { 'data-mode': m, 'data-variant': 'secondary' };
    return { attrs, getAttribute: (n: string) => attrs[n] ?? null, setAttribute: (n: string, v: string) => void (attrs[n] = v), closest: () => null };
  });
  const document = {
    documentElement: { getAttribute: (n: string) => (n === 'data-home-at' ? at : null) },
    querySelectorAll: () => links,
  };
  const localStorage = store(mode ? { 'site.mode': mode } : {});
  const location = new URL(url, 'https://example.test');
  new Function('document', 'location', 'localStorage', 'URLSearchParams', HUB_WAYS)(document, location, localStorage, URLSearchParams);
  return Object.fromEntries(links.map((l) => [l.attrs['data-mode'], l.attrs['data-variant']]));
}

describe("the hub's ways in", () => {
  it('makes the planet primary until the visitor has chosen the site', () => {
    expect(ways({ modes: ['classic', 'play'] })).toEqual({ classic: 'secondary', play: 'primary' });
    expect(ways({ modes: ['classic', 'play'], mode: 'play' })).toEqual({ classic: 'secondary', play: 'primary' });
    expect(ways({ modes: ['classic', 'play'], mode: 'classic' })).toEqual({ classic: 'primary', play: 'secondary' });
  });

  it('makes the site primary when there is no planet', () => {
    expect(ways({ modes: ['classic'], mode: 'play' })).toEqual({ classic: 'primary' });
  });

  it('takes ?mode=classic at the root as the choice, but not at the view address', () => {
    expect(ways({ modes: ['classic', 'play'], url: '/atiya/?mode=classic' })).toEqual({ classic: 'primary', play: 'secondary' });
    expect(ways({ modes: ['classic', 'play'], at: 'view', url: '/atiya/views/classic/?mode=classic' })).toEqual({ classic: 'secondary', play: 'primary' });
  });
});