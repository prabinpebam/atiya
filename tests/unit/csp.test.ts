import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BASE, cspPolicy, cspSources, headFindings, inlineScripts, parsePolicy, policyIn, POSTHOG_DEFAULT, serialize, TEST_TELEMETRY, UMAMI_DEFAULT, withScriptHashes, type Directive, type PolicyInput } from '../../src/site/services/csp';
import { catalogue } from '../../src/site/services/services';
import { cspVar } from '../../integrations/services.mjs';
import { finishPolicies } from '../../integrations/csp.mjs';

/** The site's Content Security Policy (security review P4): made from its services, each adding exactly its hosts. */
const hash = (t: string) => `sha256-${createHash('sha256').update(t, 'utf8').digest('base64')}`;
const base = cspSources({});
/** What an input adds to the base, by directive. */
function added(input: PolicyInput): Partial<Record<Directive, string[]>> {
  const s = cspSources(input);
  return Object.fromEntries(Object.entries(s).flatMap(([d, list]) => {
    const extra = list.filter((v) => !base[d as Directive].includes(v));
    return extra.length ? [[d, extra]] : [];
  }));
}
/** Any host or scheme (blob: is allowed for connections: only the page's own scripts make blob URLs). */
const WILD = (v: string) => v === '*' || /^(https?|wss?|data):?$/i.test(v);

describe('the policy every site starts from', () => {
  it('is its own files only, with objects off, its base fixed and forms posting home', () => {
    expect(serialize(base)).toBe(
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' blob:; frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com; media-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'",
    );
    expect(cspPolicy({})).not.toMatch(/unsafe-eval|frame-ancestors|report-uri/);
  });

  it('frames the video players VideoEmbed builds, and only those', () => {
    // VideoEmbed builds its players from the one list of providers
    const embed = readFileSync('src/site/content/providers.ts', 'utf8');
    for (const host of ['https://www.youtube-nocookie.com/embed/', 'https://player.vimeo.com/video/']) expect(embed).toContain(host);
    expect(base['frame-src']).toEqual(["'self'", 'https://www.youtube-nocookie.com', 'https://player.vimeo.com']);
  });

  it('names the defaults the browser code uses', () => {
    expect(readFileSync('src/site/scripts/telemetryClient.ts', 'utf8')).toContain(`'${POSTHOG_DEFAULT}'`);
    expect(readFileSync('src/site/scripts/countsRules.ts', 'utf8')).toContain(`'${UMAMI_DEFAULT}'`);
    expect(readFileSync('src/site/scripts/telemetry.ts', 'utf8')).toContain(`TEST_HOST = '${TEST_TELEMETRY}'`);
  });
});

describe('each service adds exactly its own hosts', () => {
  it('the contact service: its origin, for the form and the agreement', () => {
    expect(added({ contactEndpoint: 'https://atiya-contact.azurewebsites.net/' })).toEqual({ 'connect-src': ['https://atiya-contact.azurewebsites.net'] });
    expect(added({ contact: { endpoint: 'https://c.example' } })).toEqual({});
  });

  it('each contact option from the catalogue', () => {
    expect(added({ contact: { kind: 'email', address: 'ada@example.com' } })).toEqual({});
    expect(added({ contact: { kind: 'web3forms', key: '0f8fad5b-d9cb-469f-a165-70867728950e' } })).toEqual({ 'connect-src': ['https://api.web3forms.com'] });
    for (const o of catalogue.contact.filter((c) => c.kind === 'embed')) {
      const url = o.value.example;
      expect(added({ contact: { kind: 'embed', url } }), o.id).toEqual({ 'frame-src': [new URL(url).origin] });
    }
    // an allowed host that isn't a named option is framed the same way; a host no longer allowed adds nothing
    expect(added({ contact: { kind: 'embed', url: 'https://forms.office.com/r/abc' } })).toEqual({ 'frame-src': ['https://forms.office.com'] });
    expect(added({ contact: { kind: 'embed', url: 'https://evil.example/x' } })).toEqual({});
  });

  it('telemetry: PostHog posts to its host only (its build loads no script)', () => {
    expect(added({ telemetryHost: 'https://us.i.posthog.com' })).toEqual({ 'connect-src': ['https://us.i.posthog.com'] });
    expect(added({ telemetryHost: TEST_TELEMETRY })).toEqual({ 'connect-src': [TEST_TELEMETRY] });
  });

  it('each counting tool', () => {
    // GoatCounter: the site sends its hit as an image, so no script and no connection
    expect(added({ counts: [{ tool: 'goatcounter', code: 'ada' }] })).toEqual({ 'img-src': ['https://ada.goatcounter.com'] });
    expect(added({ counts: [{ tool: 'umami', id: 'x' }] })).toEqual({
      'script-src': ['https://cloud.umami.is'],
      'connect-src': ['https://cloud.umami.is', 'https://gateway.umami.is', 'https://api-gateway.umami.dev', 'https://eu.umami.is', 'https://api-gateway-eu.umami.dev'],
    });
    expect(added({ counts: [{ tool: 'umami', id: 'x', host: 'https://stats.ada.dev/' }] })['script-src']).toEqual(['https://stats.ada.dev']);
    expect(added({ counts: [{ tool: 'ga4', id: 'G-AB12' }] })).toEqual({
      'script-src': ['https://www.googletagmanager.com'],
      'connect-src': ['https://*.google-analytics.com', 'https://*.analytics.google.com', 'https://*.googletagmanager.com'],
      'img-src': ['https://*.google-analytics.com', 'https://*.googletagmanager.com'],
    });
    expect(added({ counts: [{ tool: 'clarity', id: 'abc123' }] })).toEqual({
      'script-src': ['https://www.clarity.ms', 'https://scripts.clarity.ms'],
      'connect-src': ['https://*.clarity.ms', 'https://c.bing.com'],
      'img-src': ['https://*.clarity.ms', 'https://c.bing.com'],
    });
  });

  it("the tools' scripts are the hosts countsRules loads them from", () => {
    const rules = readFileSync('src/site/scripts/countsRules.ts', 'utf8');
    expect(rules).toContain('https://www.googletagmanager.com/gtag/js');
    expect(rules).toContain('https://www.clarity.ms/tag/');
  });

  it('nothing malformed or unsafe gets in: a bad code, a plain-http host, a value with spaces', () => {
    expect(added({ counts: [{ tool: 'goatcounter', code: 'x y; script-src *' }] })).toEqual({});
    expect(added({ contactEndpoint: 'http://contact.example' })).toEqual({});
    expect(added({ contactEndpoint: 'javascript:alert(1)' })).toEqual({});
    expect(added({ counts: [{ tool: 'umami', id: 'x', host: 'http://stats.example' }] })['script-src']).toBeUndefined();
  });

  it('no service ever opens scripts or connections to any host or scheme', () => {
    const all: PolicyInput = {
      contact: { kind: 'web3forms', key: 'k' },
      contactEndpoint: 'https://c.example',
      telemetryHost: 'https://eu.i.posthog.com',
      counts: [{ tool: 'goatcounter', code: 'ada' }, { tool: 'umami', id: 'x' }, { tool: 'ga4', id: 'G-AB12' }, { tool: 'clarity', id: 'abc123' }],
    };
    const s = cspSources(all);
    for (const d of ['script-src', 'connect-src'] as const) expect(s[d].filter(WILD), d).toEqual([]);
    for (const o of [...catalogue.contact, ...catalogue.counts, ...catalogue.addons]) {
      if (!('csp' in o)) continue;
      for (const list of Object.values(o.csp as Record<string, string[]>)) for (const v of list) expect(v, o.id).toMatch(/^(https:\/\/[\w.*{}-]+|\{\w+\})$/);
    }
  });
});

describe('the build', () => {
  it('the owner-style build allows what its services use; dev has no policy; a test build its made-up hosts', () => {
    const site = { services: { contact: { endpoint: 'https://c.example' } } };
    const vars = { PUBLIC_CONTACT_ENDPOINT: 'https://c.example', PUBLIC_POSTHOG_KEY: 'phc_x', PUBLIC_POSTHOG_HOST: '', PUBLIC_COUNTS: '[{"tool":"goatcounter","code":"ada"}]' };
    const p = parsePolicy(cspVar(site, vars, { command: 'build' }));
    expect(p.get('connect-src')).toEqual(["'self'", 'blob:', 'https://c.example', POSTHOG_DEFAULT]);
    expect(p.get('img-src')).toContain('https://ada.goatcounter.com');
    expect(cspVar(site, vars, { command: 'dev' })).toBe('');
    expect(parsePolicy(cspVar(site, null, { command: 'build', testEndpoint: 'https://contact.test' })).get('connect-src')).toEqual(["'self'", 'blob:', 'https://contact.test', TEST_TELEMETRY]);
  });

  it("inline scripts are allowed by their hashes, one list for the whole site, and a page without the policy gets it", () => {
    const policy = cspPolicy({});
    const meta = `<meta http-equiv="Content-Security-Policy" content="${policy.replace(/'/g, '&#39;')}"><meta name="referrer" content="strict-origin-when-cross-origin">`;
    const pages = new Map([
      ['a.html', `<!DOCTYPE html><html><head><meta charset="utf-8">${meta}<script>one()</script><script type="module" src="/x.js"></script></head><body><script type="application/json">{"a":1}</script></body></html>`],
      ['b.html', `<!DOCTYPE html><html><head><meta charset="utf-8">${meta}<script type="module">two()</script></head></html>`],
      ['redirect.html', '<!doctype html><title>Redirecting</title><meta http-equiv="refresh" content="0;url=/">'],
    ]);
    const done = finishPolicies(pages, policy);
    expect(done.hashes).toBe(2);
    expect(done.added).toBe(1);
    for (const [file, html] of done.pages) {
      const p = policyIn(html)!;
      expect(p, file).toBe(withScriptHashes(policy, [hash('one()'), hash('two()')]));
      expect(parsePolicy(p).get('script-src'), file).not.toContain("'unsafe-inline'");
      expect(headFindings(html, hash), file).toEqual([]);
    }
  });

  it('hashes what the browser hashes: line breaks as the parser leaves them, no JSON data, no src scripts', () => {
    expect(inlineScripts('<script>a()\r\nb()</script><script src="/x.js"></script><script type="application/ld+json">{}</script><script type="text/javascript">c()</script>')).toEqual(['a()\nb()', 'c()']);
  });

  it('the page check: the policy and referrer first, hashes only, no eval, no inline handlers', () => {
    const policy = withScriptHashes(cspPolicy({}), [hash('ok()')]);
    const head = (p: string, extra = '') => `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${p}"><meta name="referrer" content="strict-origin-when-cross-origin">${extra}`;
    expect(headFindings(head(policy, '<script>ok()</script></head><body></body>'), hash)).toEqual([]);
    expect(headFindings(head(policy, '<script>evil()</script>'), hash)).toEqual(['an inline script the policy has no hash for']);
    expect(headFindings(head(policy, '<button onclick="x()">'), hash)).toEqual(['an inline event handler (no policy can allow it by hash)']);
    expect(headFindings(head(cspPolicy({})), hash)).toEqual(["the policy allows any inline script ('unsafe-inline')"]);
    expect(headFindings(head(`${policy.replace("script-src 'self'", "script-src 'self' 'unsafe-eval' *")}`), hash)).toEqual(["the policy allows 'unsafe-eval'", 'script-src allows any host or scheme']);
    expect(headFindings('<!DOCTYPE html><html><head><script>ok()</script><meta http-equiv="Content-Security-Policy" content="x">', hash)).toEqual([
      'no Content Security Policy before the first script, link or style',
      'no referrer policy before the first script, link or style',
    ]);
  });

  it('BASE is every directive the meta may carry (frame-ancestors and report-uri are ignored there)', () => {
    expect(Object.keys(BASE)).not.toContain('frame-ancestors');
    expect(Object.keys(BASE)).not.toContain('report-uri');
  });
});
