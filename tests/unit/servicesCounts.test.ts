import { describe, expect, it } from 'vitest';
import { cleanReferrer, COUNT_HOSTS, goatcounterHit, mayCount, needsConsent, scriptOf, toolsOf, type CountPage, type Tool } from '../../src/site/scripts/countsRules';
import { COUNT_HOSTS as LEAK_CHECK_HOSTS, countingScriptIn } from '../../scripts/verify-sealed.mjs';
import { readFileSync } from 'node:fs';

/** The other counting tools (desktop spec §9.5, plan stage 11.4 and 11.5). */
const open: CountPage = { signedIn: false, sealed: false, hash: '', search: '' };
const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

describe('which pages the counting tools may count', () => {
  it('an open page, never a private one, the Sign in page, a page that can show shared cards, a magic link or anything while signed in', () => {
    expect(mayCount(open)).toBe(true);
    expect(mayCount({ ...open, access: 'private' })).toBe(false);
    expect(mayCount({ ...open, sealed: true })).toBe(false);
    expect(mayCount({ ...open, signedIn: true })).toBe(false);
    expect(mayCount({ ...open, hash: '#a=abc' })).toBe(false);
    expect(mayCount({ ...open, hash: '#x&a=abc' })).toBe(false);
  });

  it('Clarity, which records the page and its whole address, also stays off a page opened with a query or a fragment', () => {
    const clarity: Tool = { tool: 'clarity', id: 'abc123def4' };
    expect(mayCount(open, clarity)).toBe(true);
    expect(mayCount({ ...open, search: '?access=work' }, clarity)).toBe(false);
    expect(mayCount({ ...open, hash: '#contact-form' }, clarity)).toBe(false);
    expect(mayCount({ ...open, search: '?access=work' }, { tool: 'goatcounter', code: 'ada' })).toBe(true);
  });

  it('a referrer is cut to its origin and path', () => {
    expect(cleanReferrer('https://ada.github.io/work/?k=secret#a=abc')).toBe('https://ada.github.io/work/');
    expect(cleanReferrer('')).toBe('');
    expect(cleanReferrer('android-app://x')).toBe('');
  });

  it('only the tools that set cookies wait for consent', () => {
    expect(toolsOf('[{"tool":"goatcounter","code":"a"},{"tool":"umami","id":"x"},{"tool":"ga4","id":"G-1"},{"tool":"clarity","id":"c"}]').map(needsConsent)).toEqual([false, false, true, true]);
  });

  it("reads the build's list, and anything unreadable is none", () => {
    expect(toolsOf('')).toEqual([]);
    expect(toolsOf(undefined)).toEqual([]);
    expect(toolsOf('not json')).toEqual([]);
    expect(toolsOf('{"tool":"goatcounter"}')).toEqual([]);
    expect(toolsOf('[{"tool":"evil"},{"tool":"goatcounter","code":"ada"}]')).toEqual([{ tool: 'goatcounter', code: 'ada' }]);
  });
});

describe("each tool's script and what it is told", () => {
  it('GoatCounter counts by hand (no count on load), at the code name', () => {
    expect(scriptOf({ tool: 'goatcounter', code: 'ada' })).toEqual({ src: 'https://gc.zgo.at/count.js', attrs: { 'data-goatcounter': 'https://ada.goatcounter.com/count', 'data-goatcounter-settings': '{"no_onload":true}' } });
  });
  it("GoatCounter's hit is the site's own: its count.js would add the page's query", () => {
    const hit = new URL(goatcounterHit('ada', { path: '/contact/', referrer: 'https://ada.github.io/work/', title: 'Contact', rnd: 'x1' }));
    expect(hit.origin).toBe('https://ada.goatcounter.com');
    expect(hit.pathname).toBe('/count');
    expect(Object.fromEntries(hit.searchParams)).toEqual({ p: '/contact/', r: 'https://ada.github.io/work/', t: 'Contact', rnd: 'x1' });
    expect(new URL(goatcounterHit('ada', { path: '/', referrer: '', title: 'Home', rnd: 'y' })).searchParams.has('r')).toBe(false);
    expect(readFileSync('src/site/scripts/countsClient.ts', 'utf8')).not.toMatch(/goatcounter\?\.count|load\(t\)\.then\(\(\) => w\.goatcounter/);
  });
  it('Umami tracks by hand, never the query or the fragment, on its cloud or the host given', () => {
    expect(scriptOf({ tool: 'umami', id: ID })).toEqual({ src: 'https://cloud.umami.is/script.js', attrs: { 'data-website-id': ID, 'data-auto-track': 'false', 'data-exclude-search': 'true', 'data-exclude-hash': 'true' } });
    expect(scriptOf({ tool: 'umami', id: ID, host: 'https://umami.example/' }).src).toBe('https://umami.example/script.js');
  });
  it('Google Analytics and Clarity load their tags with the ID', () => {
    expect(scriptOf({ tool: 'ga4', id: 'G-AB12' }).src).toBe('https://www.googletagmanager.com/gtag/js?id=G-AB12');
    expect(scriptOf({ tool: 'clarity', id: 'abc123def4' }).src).toBe('https://www.clarity.ms/tag/abc123def4');
  });
  it('the loader tells every tool the path alone: never the query or the fragment', () => {
    const src = readFileSync('src/site/scripts/countsClient.ts', 'utf8');
    const told = src.slice(src.indexOf('function countOne'), src.indexOf('function countPage'));
    expect(told).not.toMatch(/location\.(href|search|hash)/);
    expect(told).toMatch(/const path = location\.pathname/);
    expect(told).toMatch(/send_page_view: false/);
    // Google Analytics' own events (engagement, scrolls) name the page by its path too, and stop where it may not count
    expect(told).toMatch(/gtag\('set', \{ page_location: `\$\{location\.origin\}\$\{path\}`/);
    expect(src).toMatch(/ga-disable-\$\{t\.id\}`\] = true/);
  });

  it('a session is read where the sign-in runtime keeps it, not only from the root attribute the router swaps away', () => {
    const src = readFileSync('src/site/scripts/countsClient.ts', 'utf8');
    expect(src).toMatch(/sessionStorage\.getItem\('site\.access'\) \|\| localStorage\.getItem\('site\.access'\)/);
    expect(src).toMatch(/signedIn: signedIn\(\)/);
  });
});

describe('the leak check (plan stage 11.5)', () => {
  it("finds a counting tool's script in a page", () => {
    expect(countingScriptIn('<script async src="https://gc.zgo.at/count.js" data-goatcounter="x"></script>')).toBe(true);
    expect(countingScriptIn('<script src="https://www.googletagmanager.com/gtag/js?id=G-1"></script>')).toBe(true);
    expect(countingScriptIn('<script src="https://www.clarity.ms/tag/abc"></script>')).toBe(true);
    expect(countingScriptIn('<script type="module" src="/atiya/_astro/page.js"></script>')).toBe(false);
    expect(countingScriptIn('<p>gc.zgo.at</p>')).toBe(false);
  });
  it('knows the same hosts as the loader', () => {
    expect(LEAK_CHECK_HOSTS).toEqual(COUNT_HOSTS);
    for (const t of [{ tool: 'goatcounter', code: 'a' }, { tool: 'umami', id: ID }, { tool: 'ga4', id: 'G-1' }, { tool: 'clarity', id: 'c' }] as Tool[])
      expect(countingScriptIn(`<script src="${scriptOf(t).src}"></script>`), t.tool).toBe(true);
  });
});
