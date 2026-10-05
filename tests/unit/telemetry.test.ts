/**
 * Telemetry's rules (documentation/access/spec.md §9; benchmark QB6): the opt-outs, links and videos as
 * described, and `before_send`: fragments stripped on every page, and on protected pages only the
 * allowlist, with neutral addresses, titles and referrers.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { optOut } from '../../src/site/scripts/telemetryRules';
import { ALLOWLIST, linkKind, mediaId, neutralTitle, sanitize } from '../../src/site/scripts/telemetrySanitize';
import type { PageFacts } from '../../src/site/scripts/telemetryRules';

const open: PageFacts = { mode: 'open', signIn: false, origin: 'https://site.example', pathname: '/atiya/work/' };
const locked: PageFacts = { mode: 'allowlist', access: 'locked', signIn: false, origin: 'https://site.example', pathname: '/atiya/work/k7d2q9xh/' };
const privatePage: PageFacts = { ...locked, access: 'private', pathname: '/atiya/p/privone222/' };
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
    expect([neutralTitle('locked', false), neutralTitle('private', false), neutralTitle(undefined, true)]).toEqual(['Locked page', 'Private page', 'Sign in']);
  });
});

describe('before_send', () => {
  it('strips fragments from every address on every page, at any depth', () => {
    const e = sanitize(
      { event: '$pageview', properties: { ...device, $current_url: 'https://site.example/atiya/p/privone222/#a=gfixlink2.secret', $referrer: 'https://x.example/#k', nested: { url: '/a#b' } }, $set: { $initial_current_url: 'https://site.example/#a=s' } },
      open,
    )!;
    expect(JSON.stringify(e)).not.toMatch(/#|secret/);
    expect(e.properties!.$current_url).toBe('https://site.example/atiya/p/privone222/');
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
      expect(e.properties!.$current_url).toBe(`https://site.example${page.pathname}`);
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
    expect(Object.keys(ALLOWLIST).sort()).toEqual(['$identify', '$pageview', 'access_failed', 'access_link', 'access_opened', 'access_signed_in', 'access_signed_out', 'video_played'].sort());
  });

  it('the always-on part never imports PostHog (it is fetched on idle, its own chunk)', () => {
    const shim = readFileSync('src/site/scripts/telemetry.ts', 'utf8');
    expect(shim).not.toMatch(/from 'posthog-js/);
    expect(shim).toMatch(/import\('\.\/telemetryClient'\)/);
    expect(readFileSync('src/site/scripts/telemetryClient.ts', 'utf8')).toMatch(/from 'posthog-js\/dist\/module\.no-external'/);
  });
});
