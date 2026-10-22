/**
 * Telemetry's rules (documentation/access/spec.md §9; benchmark QB6): the opt-outs, links and videos as
 * described, and `before_send`: fragments stripped on every page, and on protected pages only the
 * allowlist, with neutral addresses, titles and referrers.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { optOut } from '../../src/site/scripts/telemetryRules';
import { ALLOWLIST, lightboxProps, linkKind, maskTokens, mediaId, neutralTitle, sanitize as sanitizeAt, videoProps, type CaptureEvent } from '../../src/site/scripts/telemetrySanitize';
import { addInteraction, clsOf, inpOf, lcpOf, pageKind, rating, rounded, VITALS_PROPS, vitalsProps } from '../../src/site/scripts/webVitals';
import type { PageFacts } from '../../src/site/scripts/telemetryRules';

const open: PageFacts = { mode: 'open', signIn: false, origin: 'https://site.example', pathname: '/atiya/work/' };
const locked: PageFacts = { mode: 'allowlist', access: 'locked', signIn: false, origin: 'https://site.example', pathname: '/atiya/work/k7d2q9xh/' };
const privatePage: PageFacts = { ...locked, access: 'private', pathname: '/atiya/work/privone222/' };
/** The site's base path in these tests. */
const sanitize = (e: CaptureEvent | null, page: PageFacts) => sanitizeAt(e, page, '/atiya');
const signIn: PageFacts = { mode: 'allowlist', signIn: true, origin: 'https://site.example', pathname: '/atiya/sign-in/' };

const device = { token: 'phc_x', distinct_id: 'gfixall22', $os: 'Windows', $browser: 'Chrome', $device_type: 'Desktop', $session_id: 's', $lib: 'web', $time: 1 };

describe('opting out', () => {
  it('Global Privacy Control and Do Not Track send nothing', () => {
    expect(optOut({ gpc: true, search: '', stored: null }).off).toBe(true);
    expect(optOut({ dnt: '1', search: '', stored: null }).off).toBe(true);
    expect(optOut({ dnt: '0', gpc: false, search: '', stored: null }).off).toBe(false);
  });
  it('?telemetry=off stops it on the device until ?telemetry=on', () => {
    expect(optOut({ search: '?telemetry=off', stored: null })).toEqual({ off: true, store: 'off' });
    expect(optOut({ search: '', stored: 'off' })).toEqual({ off: true, store: undefined });
    expect(optOut({ search: '?telemetry=on', stored: 'off' })).toEqual({ off: false, store: null });
    expect(optOut({ search: '?telemetry=on', stored: 'off', gpc: true }).off).toBe(true);
  });
});

describe('links and videos', () => {
  const here = 'https://site.example/atiya/work/k7d2q9xh/';
  it('a followed link is internal, a download, or outbound with its domain only', () => {
    expect(linkKind('/atiya/work/', here, '/atiya')).toEqual({ kind: 'internal' });
    expect(linkKind('/atiya/media/resume.pdf', here, '/atiya')).toEqual({ kind: 'download' });
    expect(linkKind('https://github.com/someone/secret-project?x=1#y', here, '/atiya')).toEqual({ kind: 'outbound', domain: 'github.com' });
    expect(linkKind('mailto:me@example.com', here, '/atiya')).toEqual({ kind: 'outbound', domain: 'mailto' });
    expect(linkKind('javascript:void(0)', here, '/atiya')).toBeNull();
  });
  it("a played video's media ID comes from a published file only", () => {
    expect(mediaId('https://site.example/atiya/media/tidepool.mp4', '/atiya')).toBe('tidepool');
    expect(mediaId('blob:https://site.example/1234', '/atiya')).toBeNull();
    expect(mediaId('https://site.example/atiya/_sealed/b/x.bin', '/atiya')).toBeNull();
  });
  it('neutral titles', () => {
    expect([neutralTitle('private', false), neutralTitle(undefined, true), neutralTitle(undefined, false)]).toEqual(['Private page', 'Sign in', 'Page']);
  });
});

describe('field data (web_vitals)', () => {
  it("rates each metric against Web Vitals' thresholds: good up to the first, poor beyond the second", () => {
    expect([rating('lcp', 2500), rating('lcp', 2501), rating('lcp', 4000), rating('lcp', 4001)]).toEqual(['good', 'needs-improvement', 'needs-improvement', 'poor']);
    expect([rating('inp', 200), rating('inp', 201), rating('inp', 500), rating('inp', 501)]).toEqual(['good', 'needs-improvement', 'needs-improvement', 'poor']);
    expect([rating('cls', 0.1), rating('cls', 0.11), rating('cls', 0.25), rating('cls', 0.26)]).toEqual(['good', 'needs-improvement', 'needs-improvement', 'poor']);
  });

  it('rounds what it sends: 10 ms, and CLS to three decimals', () => {
    expect([rounded('lcp', 1234.5), rounded('inp', 16), rounded('cls', 0.123456)]).toEqual([1230, 20, 0.123]);
  });

  it("CLS is the largest session window: shifts under 1 s apart, for at most 5 s, not after the reader's input", () => {
    expect(clsOf([])).toBe(0);
    // one window: 0.1 + 0.2 + 0.05
    expect(clsOf([{ startTime: 100, value: 0.1 }, { startTime: 900, value: 0.2 }, { startTime: 1800, value: 0.05 }])).toBeCloseTo(0.35);
    // a gap of a second or more starts a new window; the larger one wins
    expect(clsOf([{ startTime: 0, value: 0.1 }, { startTime: 1000, value: 0.05 }, { startTime: 1500, value: 0.08 }])).toBeCloseTo(0.13);
    // a window lasts at most 5 s
    const steady = Array.from({ length: 12 }, (_, i) => ({ startTime: i * 900, value: 0.01 }));
    expect(clsOf(steady)).toBeCloseTo(0.06);
    // shifts just after input don't count
    expect(clsOf([{ startTime: 0, value: 0.3, hadRecentInput: true }, { startTime: 200, value: 0.02 }])).toBeCloseTo(0.02);
  });

  it("INP is each interaction's longest event, leaving out one in 50 (the 98th percentile); nothing without one", () => {
    const m = new Map<number, number>();
    expect(inpOf(m)).toBeUndefined();
    addInteraction(m, { interactionId: 0, duration: 900 }); // not an interaction (a mouse move)
    addInteraction(m, { interactionId: 7, duration: 48 });
    addInteraction(m, { interactionId: 7, duration: 120 }); // the same tap's click
    addInteraction(m, { interactionId: 9, duration: 64 });
    expect(inpOf(m)).toBe(120);
    // with 50 or more interactions on the page, the longest is left out
    expect(inpOf(m, 50)).toBe(64);
    expect(inpOf(m, 120)).toBe(64);
  });

  it('LCP is the last candidate before the page was first hidden, from its activation', () => {
    expect(lcpOf([])).toBeUndefined();
    expect(lcpOf([{ startTime: 300 }, { startTime: 700 }])).toBe(700);
    expect(lcpOf([{ startTime: 300 }, { startTime: 7000 }], { hiddenAt: 5000 })).toBe(300);
    expect(lcpOf([{ startTime: 900 }], { activationStart: 600 })).toBe(300);
    expect(lcpOf([{ startTime: 100 }], { activationStart: 600 })).toBe(0);
  });

  it("a page's kind is coarse: never its address, title or ID", () => {
    expect(pageKind({ path: '/', signIn: false })).toBe('home');
    expect(pageKind({ path: '', signIn: false })).toBe('home');
    expect(pageKind({ path: '/work/', signIn: false })).toBe('section');
    expect(pageKind({ path: '/work/some-story/', signIn: false })).toBe('page');
    expect(pageKind({ path: '/work/k7d2q9xh/', access: 'private', signIn: false })).toBe('private');
    expect(pageKind({ path: '/sign-in/', signIn: true })).toBe('sign-in');
    expect(pageKind({ path: '/play/', signIn: false })).toBe('planet');
    expect(pageKind({ path: '/play/workshop/', signIn: false, frame: 'planet' })).toBe('planet-page');
    expect(pageKind({ path: '/design/tokens/', signIn: false })).toBe('library');
  });

  it('the event carries its kind and each measured metric with its rating, and nothing when none was measured', () => {
    expect(vitalsProps('section', { lcp: 2600, cls: 0 })).toEqual({ kind: 'section', lcp: 2600, lcp_rating: 'needs-improvement', cls: 0, cls_rating: 'good' });
    expect(vitalsProps('home', { inp: 640 })).toEqual({ kind: 'home', inp: 640, inp_rating: 'poor' });
    expect(vitalsProps('home', {})).toBeNull();
    expect(vitalsProps('home', { lcp: Number.NaN, inp: -1 })).toBeNull();
    for (const p of [vitalsProps('page', { lcp: 1, inp: 1, cls: 1 })!]) expect(Object.keys(p).every((k) => (VITALS_PROPS as readonly string[]).includes(k))).toBe(true);
  });
});

describe('before_send', () => {
  it('strips fragments from every address on every page, at any depth', () => {
    const e = sanitize(
      { event: '$pageview', properties: { ...device, $current_url: 'https://site.example/atiya/p/privone222/#a=gfixlink2.secret', $referrer: 'https://x.example/#k', nested: { url: '/a#b' } }, $set: { $initial_current_url: 'https://site.example/#a=s' } },
      open,
    )!;
    expect(JSON.stringify(e)).not.toMatch(/#|secret/);
    expect(e.properties!.$current_url).toBe('https://site.example/atiya/p/private/');
  });

  it("keeps the event's timestamp a Date on every page (PostHog refuses an event whose timestamp isn't one)", () => {
    const at = new Date('2026-10-05T08:00:00Z');
    for (const page of [open, locked]) {
      const e = sanitize({ event: '$pageview', timestamp: at, uuid: 'u', properties: { ...device, $current_url: 'https://site.example/a#b' } }, page)!;
      expect(e.timestamp).toBeInstanceOf(Date);
      expect(JSON.parse(JSON.stringify(e)).timestamp).toBe('2026-10-05T08:00:00.000Z');
    }
  });

  it('on open pages keeps PostHog\'s own capture', () => {
    const e = sanitize({ event: '$autocapture', properties: { ...device, $el_text: 'Download résumé' } }, open)!;
    expect(e.properties!.$el_text).toBe('Download résumé');
  });

  for (const [name, page] of [
    ['a locked page', locked],
    ['a private page', privatePage],
    ['the Sign in page', signIn],
  ] as const) {
    it(`on ${name}, drops every event not on the allowlist`, () => {
      for (const event of ['$autocapture', '$pageleave', '$rageclick', '$exception', '$set', 'custom']) expect(sanitize({ event, properties: { ...device } }, page)).toBeNull();
    });
    it(`on ${name}, a page view carries a neutral address, title and referrer`, () => {
      const e = sanitize(
        {
          event: '$pageview',
          properties: { ...device, $current_url: `https://site.example${page.pathname}?q=Secret+Title#a=x.y`, $pathname: page.pathname, $title: 'Secret project — Prabin', $referrer: 'https://site.example/atiya/work/k7d2q9xh/?from=x', $el_text: 'Secret' },
          $set: { name: 'Secret' },
          $set_once: { $initial_title: 'Secret' },
        },
        page,
      )!;
      // a private page's token never leaves: its address is its section's, then private
      expect(e.properties!.$current_url).toBe(`https://site.example${page.pathname.replace('privone222', 'private')}`);
      expect(e.properties!.$title).toBe(neutralTitle(page.access, page.signIn));
      expect(e.properties!.$referrer).toBe('https://site.example');
      expect(JSON.stringify(e)).not.toMatch(/Secret|\?|#/);
      expect(e.properties!.$os).toBe('Windows');
    });
  }

  it('keeps only each allowlisted event\'s own properties', () => {
    const e = sanitize({ event: 'access_failed', properties: { ...device, reason: 'wrong', code: 'harbor-maple-river-cloud-seven', title: 'Secret' } }, signIn)!;
    expect(e.properties).toEqual({ ...device, reason: 'wrong' });
    const v = sanitize({ event: 'video_played', properties: { ...device, media: 'secret-clip', place: '/work/k7d2q9xh/' } }, locked)!;
    expect(v.properties).toEqual({ ...device, place: '/work/k7d2q9xh/' });
  });

  it('the allowlist is the spec\'s', () => {
    expect(Object.keys(ALLOWLIST).sort()).toEqual(['$identify', '$pageview', 'access_agreed', 'access_failed', 'access_link', 'access_opened', 'access_signed_in', 'access_signed_out', 'lightbox_opened', 'video_played', 'web_vitals'].sort());
    expect(ALLOWLIST.web_vitals).toEqual([...VITALS_PROPS]);
    expect(ALLOWLIST.lightbox_opened).toEqual(['place', 'kind']);
  });

  it("lightbox_opened says where and what kind, never which (gallery spec §14)", () => {
    expect(lightboxProps({ place: 'album', kind: 'video', id: 'reel', title: 'Secret' }, false)).toEqual({ place: 'album', kind: 'video' });
    expect(lightboxProps({ place: 'band', kind: 'picture' }, true)).toEqual({ place: 'section', kind: 'picture' });
    expect(lightboxProps({ place: 'band', kind: 'animated' }, false)).toEqual({ place: 'block', kind: 'animated' });
    expect(lightboxProps({ place: 'page', kind: 'drawing' }, false)).toEqual({ place: 'article', kind: 'drawing' });
    for (const place of ['section', 'article', 'block']) expect(lightboxProps({ place, kind: 'embed' }, false)).toEqual({ place, kind: 'embed' });
    for (const d of [undefined, null, {}, { place: 'album' }, { place: '/gallery/fx-private-album/', kind: 'picture' }, { place: 'album', kind: 'fixture-album' }, { place: 1, kind: 'picture' }]) expect(lightboxProps(d, true)).toBeNull();
    const e = sanitize({ event: 'lightbox_opened', properties: { ...device, place: 'album', kind: 'picture', item: 'p01', album: 'Secret' } }, locked)!;
    expect(e.properties).toEqual({ ...device, place: 'album', kind: 'picture' });
  });

  it("video_played: nothing for a band's tile playing on its own, only the place from the lightbox", () => {
    const at = (sel: string | null) => ({ closest: (s: string) => (s === sel ? ({} as Element) : null) });
    const q = { src: '/atiya/media/clip.mp4', place: '/gallery/fixture-album/', open: true };
    expect(videoProps({ ...q, v: at('[data-band-motion]') }, '/atiya')).toBeNull();
    expect(videoProps({ ...q, v: at('[data-lightbox-dialog]') }, '/atiya')).toEqual({ place: 'lightbox' });
    expect(videoProps({ ...q, v: at(null) }, '/atiya')).toEqual({ media: 'clip' });
    expect(videoProps({ ...q, open: false }, '/atiya')).toEqual({ place: '/gallery/fixture-album/' });
  });

  for (const [name, page] of [
    ['an open page', open],
    ['a private page', privatePage],
    ['the Sign in page', signIn],
  ] as const) {
    it(`on ${name}, web_vitals leaves with its numbers, ratings and kind (and, where allowlisted, nothing else)`, () => {
      const props = vitalsProps(pageKind({ path: page.pathname.slice('/atiya'.length), access: page.access, signIn: page.signIn }), { lcp: 1234.5, inp: 87, cls: 0.04321 })!;
      const e = sanitize({ event: 'web_vitals', properties: { ...device, ...props, $current_url: `https://site.example${page.pathname}#x`, $title: 'Secret' } }, page)!;
      expect(e.properties).toMatchObject({ lcp: 1230, lcp_rating: 'good', inp: 90, inp_rating: 'good', cls: 0.043, cls_rating: 'good' });
      if (page.mode === 'allowlist') expect(e.properties).toEqual({ ...device, ...props });
      expect(JSON.stringify(e)).not.toMatch(/#/);
    });
  }

  it('the always-on part never imports PostHog (it is fetched on idle, its own chunk)', () => {
    const shim = readFileSync('src/site/scripts/telemetry.ts', 'utf8');
    expect(shim).not.toMatch(/from 'posthog-js/);
    expect(shim).toMatch(/import\('\.\/telemetryClient'\)/);
    expect(readFileSync('src/site/scripts/telemetryClient.ts', 'utf8')).toMatch(/from 'posthog-js\/dist\/module\.no-external'/);
  });
});

describe("a private page's token never leaves (security review P7)", () => {
  const TOK = 'privone222';
  it('is replaced by private in an address, a path, a place, and inside a longer string, under any base', () => {
    expect(maskTokens(`https://site.example/atiya/work/${TOK}/`, '/atiya')).toBe('https://site.example/atiya/work/private/');
    expect(maskTokens(`https://site.example/atiya/work/${TOK}/?x=1`, '/atiya')).toBe('https://site.example/atiya/work/private/?x=1');
    expect(maskTokens(`/atiya/work/${TOK}/`, '/atiya')).toBe('/atiya/work/private/');
    expect(maskTokens(`/atiya/work/${TOK}`, '/atiya')).toBe('/atiya/work/private');
    expect(maskTokens(`/work/${TOK}/`, '')).toBe('/work/private/');
    expect(maskTokens(`http://localhost:4329/side-projects/${TOK}/`, '')).toBe('http://localhost:4329/side-projects/private/');
    expect(maskTokens(`a:href="/atiya/work/${TOK}/"nth-child="2";span:text="x"`, '/atiya')).toBe('a:href="/atiya/work/private/"nth-child="2";span:text="x"');
    expect(maskTokens(`https://site.example/atiya/sign-in/?return=%2Fatiya%2Fwork%2F${TOK}%2F`, '/atiya')).toBe('https://site.example/atiya/sign-in/?return=%2Fatiya%2Fwork%2Fprivate%2F');
  });
  it("leaves alone what isn't one: other lengths and letters, the code's own addresses, other places in a path, and the open page being sent", () => {
    for (const v of ['/atiya/work/', '/atiya/work/k7d2q9xh/', '/atiya/work/abcdefghijk/', '/atiya/work/abcdefgh18/', '/atiya/work/Privone222/', '/atiya/play/lighthouse/', '/atiya/design/typography/', '/atiya/abcdefghij/', 'https://other.example/x/y/work/privone222/'])
      expect(maskTokens(v, '/atiya')).toBe(v);
    // a public page whose slug has the shape keeps its own address, but not as another page's referrer
    expect(maskTokens('https://site.example/atiya/writing/typography/', '/atiya', '/atiya/writing/typography/')).toBe('https://site.example/atiya/writing/typography/');
    expect(maskTokens('https://site.example/atiya/writing/typography/', '/atiya', '/atiya/work/')).toBe('https://site.example/atiya/writing/private/');
  });
  it('on an open page: in every address PostHog adds (the referrers, the previous page, the session and the person properties)', () => {
    const at = `https://site.example/atiya/work/${TOK}/`;
    const e = sanitize(
      {
        event: '$pageview',
        properties: { ...device, $current_url: 'https://site.example/atiya/work/', $pathname: '/atiya/work/', $referrer: at, $initial_referrer: at, $prev_pageview_pathname: `/atiya/work/${TOK}/`, $session_entry_url: at, $session_entry_pathname: `/atiya/work/${TOK}/`, $elements_chain: `a:href="/atiya/work/${TOK}/"` },
        $set_once: { $initial_current_url: at, $initial_pathname: `/atiya/work/${TOK}/` },
      },
      open,
    )!;
    expect(JSON.stringify(e)).not.toContain(TOK);
    expect(e.properties).toMatchObject({ $current_url: 'https://site.example/atiya/work/', $referrer: 'https://site.example/atiya/work/private/', $prev_pageview_pathname: '/atiya/work/private/' });
  });
  it("on a private page: its page view, and the place an event names", () => {
    const pv = sanitize({ event: '$pageview', properties: { ...device, $current_url: `https://site.example${privatePage.pathname}`, $pathname: privatePage.pathname } }, privatePage)!;
    expect(pv.properties).toMatchObject({ $current_url: 'https://site.example/atiya/work/private/', $pathname: '/atiya/work/private/', $title: 'Private page' });
    expect(sanitize({ event: 'access_opened', properties: { ...device, grant: 'gfixall22', place: `/work/${TOK}/` } }, privatePage)!.properties!.place).toBe('/work/private/');
    expect(sanitize({ event: 'video_played', properties: { ...device, place: `/work/${TOK}/` } }, privatePage)!.properties!.place).toBe('/work/private/');
    // a section's place is its own
    expect(sanitize({ event: 'access_opened', properties: { ...device, grant: 'gfixall22', place: '/work/', cards: 2 } }, { ...open, mode: 'allowlist' })!.properties!.place).toBe('/work/');
  });
});
