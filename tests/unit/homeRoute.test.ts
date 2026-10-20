import { describe, expect, it } from 'vitest';
import { HOME_KEYS, HOME_MOVES, HOME_NAMES, HOME_ROUTER, homeAttrs, homeMoves, type HomeRouting } from '../../src/site/scripts/homeRoute';
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

// the transition names (switcher.md §4) run against a stand-in page: elements with a box, hidden, faded,
// covered or inside a parent that clips them; `blind` hit-tests only the root, as Chromium does in `pageswap`
interface Box {
  id: string;
  box: [number, number, number, number];
  hidden?: boolean;
  faded?: boolean;
  covered?: boolean;
  clip?: [number, number, number, number];
}

function names(boxes: Box[], dialogs = 0, blind = false) {
  const on: Record<string, (e: unknown) => void> = {};
  const cover = { cover: true };
  const root = { root: true };
  const rect = (b: number[]) => ({ left: b[0], top: b[1], right: b[2], bottom: b[3] });
  const els = boxes.map((b) => ({
    b,
    style: { viewTransitionName: '' },
    getAttribute: () => b.id,
    getClientRects: () => (b.hidden ? [] : [b.box]),
    getBoundingClientRect: () => rect(b.box),
    checkVisibility: () => !b.faded,
    parentElement: b.clip ? { clips: true, getBoundingClientRect: () => rect(b.clip!), parentElement: root } : root,
    contains: (x: unknown): boolean => x === els.find((e) => e.b === b),
  }));
  const closed: number[] = [];
  const open = Array.from({ length: dialogs }, (_, i) => ({ close: () => void closed.push(i) }));
  const document = {
    documentElement: root,
    querySelectorAll: (s: string) => (s === 'dialog[open]' ? open : els),
    elementFromPoint: (x: number, y: number) => {
      if (blind) return root;
      const at = [...els].reverse().find((e) => !e.b.hidden && x >= e.b.box[0] && x < e.b.box[2] && y >= e.b.box[1] && y < e.b.box[3]);
      return at?.b.covered ? cover : (at ?? null);
    },
  };
  const window = {
    innerWidth: 1280,
    innerHeight: 800,
    addEventListener: (t: string, f: (e: unknown) => void) => void (on[t] = f),
    getComputedStyle: (p: { clips?: boolean }) => (p.clips ? { overflowX: 'auto', overflowY: 'hidden' } : { overflowX: 'visible', overflowY: 'visible' }),
  };
  new Function('window', 'document', HOME_NAMES)(window, document);
  const named = () => Object.fromEntries(els.filter((e) => e.style.viewTransitionName).map((e) => [e.b.box.join(','), e.style.viewTransitionName]));
  return { on, named, closed };
}

describe('home views: transition names', () => {
  const finished = () => {
    let done!: () => void;
    const p = new Promise<void>((r) => (done = r));
    return { finished: p, done };
  };

  it('names each strength once, on its largest element in view', () => {
    const p = names([
      { id: 'lead', box: [0, 80, 300, 100] },
      { id: 'lead', box: [0, 200, 600, 500] },
      { id: 'craft', box: [620, 200, 1200, 500] },
    ]);
    p.on.pageswap({ viewTransition: {} });
    expect(p.named()).toEqual({ '0,200,600,500': 'cap-lead', '620,200,1200,500': 'cap-craft' });
  });

  it('leaves out what is off screen, hidden or covered, and counts only the part on screen', () => {
    const p = names([
      { id: 'below', box: [0, 900, 600, 1200] },
      { id: 'hidden', box: [0, 100, 600, 400], hidden: true },
      { id: 'covered', box: [0, 450, 600, 700], covered: true },
      { id: 'part', box: [0, 700, 1280, 2000] },
      { id: 'part', box: [0, 100, 300, 300] },
    ]);
    p.on.pagereveal({ viewTransition: finished() });
    expect(p.named()).toEqual({ '0,700,1280,2000': 'cap-part' });
  });

  it('leaves out what is faded or scrolled out of a strip, and counts only the part the strip shows', () => {
    const p = names([
      { id: 'faded', box: [0, 100, 600, 400], faded: true },
      { id: 'away', box: [1300, 100, 1600, 400], clip: [0, 0, 1280, 800] },
      { id: 'away', box: [900, 100, 1200, 400], clip: [0, 0, 1000, 800] },
      { id: 'edge', box: [0, 450, 400, 700], clip: [0, 0, 1280, 800] },
      { id: 'edge', box: [800, 450, 1200, 700], clip: [1100, 0, 1280, 800] },
    ]);
    p.on.pagereveal({ viewTransition: finished() });
    expect(p.named()).toEqual({ '900,100,1200,400': 'cap-away', '0,450,400,700': 'cap-edge' });
  });

  it('names the old page by its geometry when the browser can hit-test only the root (pageswap)', () => {
    const p = names(
      [
        { id: 'seen', box: [0, 100, 600, 400], covered: true },
        { id: 'strip', box: [1300, 100, 1600, 400], clip: [0, 0, 1280, 800] },
        { id: 'below', box: [0, 900, 600, 1200] },
      ],
      0,
      true,
    );
    p.on.pageswap({ viewTransition: {} });
    expect(p.named()).toEqual({ '0,100,600,400': 'cap-seen' });
  });

  it('opts every view but the classic hub into the transition, and never under reduced motion', () => {
    const at = { at: 'root' as const, default: 'bento', offered: [], known: [], lenses: [], base: '' };
    expect(homeMoves({ ...at, view: 'bento' })).toBe(true);
    expect(homeMoves({ ...at, view: 'cover' })).toBe(true);
    expect(homeMoves({ ...at, view: 'classic' })).toBe(false);
    expect(HOME_MOVES).toMatch(/^@media \(prefers-reduced-motion: no-preference\) \{ @view-transition \{ navigation: auto; \} \}$/);
  });

  it('closes an open dialog before naming the old page', () => {
    const p = names([{ id: 'a', box: [0, 0, 100, 100] }], 2);
    p.on.pageswap({ viewTransition: {} });
    expect(p.closed).toEqual([0, 1]);
  });

  it('names nothing without a transition (reduced motion, or the hub), and clears the names once it ends', async () => {
    const p = names([{ id: 'odd id', box: [0, 0, 100, 100] }], 1);
    p.on.pageswap({ viewTransition: null });
    p.on.pagereveal({ viewTransition: null });
    expect(p.named()).toEqual({});
    expect(p.closed).toEqual([]);
    const vt = finished();
    p.on.pagereveal({ viewTransition: vt });
    expect(p.named()).toEqual({ '0,0,100,100': 'cap-odd-id' });
    vt.done();
    await vt.finished;
    await Promise.resolve();
    expect(p.named()).toEqual({});
  });
});
