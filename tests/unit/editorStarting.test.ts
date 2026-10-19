/**
 * Edit mode's starting page (security review F1, P1): `to` never leaves edit mode's address or reaches a
 * script, the page's one script is a constant allowed by its hash, and the page loads only as a top-level
 * page from this computer. The last group drives the dev integration's own middleware.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { STARTING_HEADERS, escapeHtml, startingGuard, startingPage, startingTarget } from '../../src/site/editor/model/starting';
import editor from '../../integrations/editor.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/[\\/]$/, '');
const EDIT = '/_edit/';

const HOSTILE = [
  '/_edit/</script><script>alert(1)</script>',
  '/_edit/"><script>alert(1)</script>',
  '/_edit/\'onmouseover=alert(1)//',
  '/_edit/&lt;/script&gt;',
  'javascript:alert(1)',
  ' javascript:alert(1)',
  '/_edit/javascript:alert(1)',
  '//evil.example/_edit/',
  '/_edit//evil.example/',
  '/_edit/..',
  '/_edit/../',
  '/_edit/../../etc/passwd',
  '/_edit/%2e%2e/',
  '/_edit/%2F%2Fevil.example',
  '/_edit/%3C/script%3E',
  '/_edit/\\evil.example',
  '/_edit/\\\\evil.example',
  '/_edit/media/\u2028alert(1)',
  '/_edit/media/\u2029',
  '/_edit/media/\u0000',
  '/_edit/media/\n<script>',
  '/_edit/media/?q=</script><script>alert(1)</script>',
  '/_edit/media/?q="><x',
  '/_edit/media/?q=\u2028',
  '/_edit/media/#frag',
  '/_edit/__starting?to=/_edit/',
  '/_edit/__warm',
  '/_EDIT/media/',
  '/_editx/',
  '/elsewhere/',
  'https://evil.example/_edit/',
  '',
];

/** The page's scripts, and every element that could run one. */
const scripts = (html: string) => [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
const hrefOf = (html: string) => /<a href="([^"]*)" data-starting-open>/.exec(html)?.[1];
const unescape = (s: string) => s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

describe('the starting page: where it opens', () => {
  it('keeps a screen under edit mode, with its plain query', () => {
    for (const to of ['/_edit/', '/_edit/media/', '/_edit/articles/my-article_2/', '/_edit/canvas/articles/a', '/_edit/media/?id=img-1', '/_edit/sections/?tab=settings&section=work', '/_edit/articles/a/?picker=2'])
      expect(startingTarget(to, EDIT), to).toBe(to);
  });

  it('opens the dashboard for anything else', () => {
    for (const to of HOSTILE) expect(startingTarget(to, EDIT), JSON.stringify(to)).toBe(EDIT);
    expect(startingTarget(null, EDIT)).toBe(EDIT);
    expect(startingTarget(undefined, EDIT)).toBe(EDIT);
  });

  it('follows the base path', () => {
    const edit = '/atiya/_edit/';
    expect(startingTarget('/atiya/_edit/media/', edit)).toBe('/atiya/_edit/media/');
    expect(startingTarget('/_edit/media/', edit)).toBe(edit);
    expect(startingTarget('/atiya/_edit/../', edit)).toBe(edit);
  });
});

describe('the starting page: its markup', () => {
  const ref = startingPage(EDIT, EDIT);
  const [script] = scripts(ref);

  it('has one script, the same for every request, allowed by its hash', () => {
    expect(scripts(ref)).toHaveLength(1);
    const hash = createHash('sha256').update(script, 'utf8').digest('base64');
    expect(STARTING_HEADERS['Content-Security-Policy']).toContain(`script-src 'sha256-${hash}'`);
    // it reads where to go from the page, never from a value written into it
    expect(script).not.toMatch(/_edit|"\/|'\//);
  });

  it('round-trips a good target through the link the script reads', () => {
    for (const to of ['/_edit/media/', '/_edit/sections/?tab=settings&section=work']) {
      const html = startingPage(to, EDIT);
      expect(unescape(hrefOf(html) ?? '')).toBe(to);
      expect(scripts(html)).toEqual([script]);
    }
  });

  it('never makes a second script, or leaves edit mode, for a hostile target', () => {
    for (const to of HOSTILE) {
      const html = startingPage(to, EDIT);
      expect(scripts(html), JSON.stringify(to)).toEqual([script]);
      expect((html.match(/<script/gi) ?? []).length).toBe(1);
      expect(html).not.toMatch(/\son[a-z]+=/i);
      expect(html).not.toMatch(/javascript:/i);
      expect(html).not.toMatch(/[\u2028\u2029]/);
      expect(unescape(hrefOf(html) ?? '')).toBe(EDIT);
    }
  });

  it('escapes what it writes into markup', () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe('&#60;a href=&#34;x&#34; title=&#39;y&#39;&#62;&#38;&#60;/a&#62;');
    // a base path with markup in it stays an attribute's text
    const html = startingPage('/"><script>/_edit/', '/"><script>/_edit/');
    expect((html.match(/<script/gi) ?? []).length).toBe(1);
  });

  it('is never framed, never sniffed and never cached', () => {
    expect(STARTING_HEADERS).toMatchObject({ 'X-Frame-Options': 'DENY', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
    const csp = STARTING_HEADERS['Content-Security-Policy'];
    for (const d of ["default-src 'none'", "frame-ancestors 'none'", "base-uri 'none'", "form-action 'none'", "connect-src 'self'"]) expect(csp).toContain(d);
    expect(csp).not.toContain('unsafe-inline');
  });
});

describe('the starting page: who may load it', () => {
  const req = (o: { method?: string; ip?: string; headers?: Record<string, string> } = {}) => {
    const headers: Record<string, string> = { host: 'localhost:4321', ...(o.headers ?? {}) };
    return { method: o.method ?? 'GET', url: new URL('http://localhost:4321/_edit/__starting'), clientAddress: 'ip' in o ? o.ip : '127.0.0.1', header: (n: string) => headers[n.toLowerCase()] ?? null };
  };
  const nav = (site: string, dest = 'document') => ({ 'sec-fetch-site': site, 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': dest });

  it('a page load from this computer: a link here, the address bar, the app, a script without fetch metadata', () => {
    expect(startingGuard(req()).ok).toBe(true);
    expect(startingGuard(req({ headers: nav('same-origin') })).ok).toBe(true);
    expect(startingGuard(req({ headers: nav('none') })).ok).toBe(true);
    expect(startingGuard(req({ method: 'HEAD' })).ok).toBe(true);
  });

  it('never from another site, another port, a frame, another computer or another host name', () => {
    expect(startingGuard(req({ headers: nav('cross-site') })).ok).toBe(false);
    expect(startingGuard(req({ headers: nav('same-site') })).ok).toBe(false);
    for (const dest of ['iframe', 'frame', 'embed', 'object', 'script']) expect(startingGuard(req({ headers: nav('same-origin', dest) })).ok, dest).toBe(false);
    expect(startingGuard(req({ ip: '192.168.1.20' })).ok).toBe(false);
    expect(startingGuard(req({ headers: { host: 'evil.example:4321' } })).ok).toBe(false);
    expect(startingGuard(req({ method: 'POST', headers: { 'x-editor': '1', origin: 'http://localhost:4321', 'content-type': 'application/json' } })).ok).toBe(false);
  });
});

describe('the dev integration serves it', () => {
  const env = { SITE_EDITOR: process.env.SITE_EDITOR, CONTENT_ROOT: process.env.CONTENT_ROOT, ATIYA_LAUNCH_TOKEN: process.env.ATIYA_LAUNCH_TOKEN };
  type Mw = (req: unknown, res: unknown, next: () => void) => void;
  let starting: Mw;
  beforeAll(() => {
    delete process.env.SITE_EDITOR;
    delete process.env.CONTENT_ROOT;
    delete process.env.ATIYA_LAUNCH_TOKEN;
    const integration = editor();
    (integration.hooks['astro:config:setup'] as unknown as (o: unknown) => void)({
      command: 'dev',
      config: { root: pathToFileURL(`${ROOT}/`), base: '/' },
      injectRoute: () => {},
      injectScript: () => {},
      addMiddleware: () => {},
      updateConfig: () => {},
      logger: { info: vi.fn() },
    });
    const used: Mw[] = [];
    (integration.hooks['astro:server:setup'] as unknown as (o: unknown) => void)({
      server: { middlewares: { use: (fn: Mw) => used.push(fn) }, watcher: { add: () => {}, on: () => {} }, environments: {}, config: {} },
    });
    starting = used.at(-1)!;
  });
  afterAll(() => {
    for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  });

  const call = (url: string, headers: Record<string, string> = {}, ip = '127.0.0.1') => {
    const res = { statusCode: 200, headers: {} as Record<string, string>, body: '', setHeader(n: string, v: string) { this.headers[n.toLowerCase()] = v; }, end(b = '') { this.body = String(b); } };
    let passed = false;
    starting({ method: 'GET', url, headers: { host: 'localhost:4321', ...headers }, socket: { remoteAddress: ip } }, res, () => (passed = true));
    return { ...res, passed };
  };

  it('opens a good target, with its headers', () => {
    const r = call('/_edit/__starting?to=%2F_edit%2Fmedia%2F', { 'sec-fetch-site': 'none', 'sec-fetch-dest': 'document' });
    expect(r.statusCode).toBe(200);
    expect(r.headers).toMatchObject({ 'x-frame-options': 'DENY', 'content-type': 'text/html; charset=utf-8' });
    expect(r.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(unescape(hrefOf(r.body) ?? '')).toBe('/_edit/media/');
  });

  it('turns a hostile target into the dashboard, encoded or not', () => {
    for (const to of HOSTILE) {
      const r = call(`/_edit/__starting?to=${encodeURIComponent(to)}`);
      expect(r.statusCode, JSON.stringify(to)).toBe(200);
      expect((r.body.match(/<script/gi) ?? []).length).toBe(1);
      expect(unescape(hrefOf(r.body) ?? '')).toBe(EDIT);
    }
    const raw = call('/_edit/__starting?to=/_edit/</script><script>alert(1)</script>');
    expect((raw.body.match(/<script/gi) ?? []).length).toBe(1);
  });

  it('refuses another site, a frame, another computer and another host name', () => {
    for (const [headers, ip] of [
      [{ 'sec-fetch-site': 'cross-site', 'sec-fetch-dest': 'document' }, '127.0.0.1'],
      [{ 'sec-fetch-site': 'same-origin', 'sec-fetch-dest': 'iframe' }, '127.0.0.1'],
      [{}, '192.168.1.20'],
      [{ host: 'evil.example' }, '127.0.0.1'],
    ] as const) {
      const r = call('/_edit/__starting?to=/_edit/', headers, ip);
      expect(r.statusCode).toBe(403);
      expect(r.body).toBe('Forbidden');
      expect(r.headers['x-frame-options']).toBe('DENY');
    }
  });

  it('guards the warm-up status too, and leaves every other address alone', () => {
    expect(JSON.parse(call('/_edit/__warm').body)).toHaveProperty('started');
    expect(call('/_edit/__warm', { host: 'evil.example' }).statusCode).toBe(403);
    expect(call('/_edit/media/').passed).toBe(true);
    expect(call('/about/').passed).toBe(true);
  });
});
