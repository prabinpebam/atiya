/**
 * The Content Security Policy in the browser (src/site/services/csp.ts; security review F4, P4), on the test
 * build, whose policy allows only its made-up services (https://contact.test, https://telemetry.test): every
 * kind of page the site has, and what each does that the policy could stop (the inline head scripts, the
 * client-side router, a private page decrypted with its pictures and video, the contact form, telemetry, an
 * embedded video, the planet with its reading frame), with not one violation.
 */
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readerOf, withAgreement, type Agreed } from '../../src/site/access/agreement';

const FIX = join(import.meta.dirname, '../fixtures/private-pages');
const grants = JSON.parse(readFileSync(join(FIX, 'access.json'), 'utf8')).grants as { id: string; name?: string; recipient: { name: string; organisation?: string }; purpose: string; secret: { words?: string } }[];
const ALL = (() => {
  const g = grants.find((x) => x.id === 'gfixall22')!;
  return `${g.name}-${g.secret.words}`;
})();
const PRE_AGREED = JSON.stringify(grants.reduce<Agreed>((a, g) => withAgreement(a, g.id, readerOf(g), '2026-10-08T00:00:00.000Z'), {}));
const SERVICE = 'https://contact.test';

/** Every violation the page (or a frame in it) reports, by its event and on the console, across navigations. */
async function watch(page: Page) {
  const seen: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && /Content Security Policy/i.test(m.text())) seen.push(m.text());
  });
  await page.exposeFunction('__cspViolation', (v: string) => seen.push(v));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => (window as unknown as { __cspViolation(v: string): void }).__cspViolation(`${e.violatedDirective} blocked ${e.blockedURI || 'inline'} on ${location.pathname}`), true);
  });
  return seen;
}

/** The page's policy: one meta, first in the head, scripts by hash only, no eval. */
async function policyOf(page: Page) {
  const metas = page.locator('meta[http-equiv="Content-Security-Policy"]');
  await expect(metas).toHaveCount(1);
  const policy = (await metas.getAttribute('content'))!;
  const first = await page.evaluate(() => [...document.head.children].slice(0, 3).map((e) => e.getAttribute('http-equiv') ?? e.getAttribute('name') ?? e.getAttribute('charset')));
  expect(first).toEqual(['utf-8', 'Content-Security-Policy', 'referrer']);
  expect(policy).not.toContain("'unsafe-eval'");
  expect(/script-src ([^;]*)/.exec(policy)?.[1]).not.toContain("'unsafe-inline'");
  return policy;
}

test.describe('content security policy', () => {
  test.beforeEach(({ page }) => page.addInitScript((v) => localStorage.setItem('site.access.agreed', v), PRE_AGREED));

  test('the site: home, a section, the design library (its router), the sign-in page and telemetry, with no violation', async ({ page }) => {
    const seen = await watch(page);
    const sent: string[] = [];
    await page.route('https://telemetry.test/**', (r) => (sent.push(r.request().url()), r.fulfill({ status: 200, contentType: 'application/json', body: '{"status":1}' })));
    await page.addInitScript(() => localStorage.setItem('site.test.telemetry', '1'));
    await page.goto('/');
    const policy = await policyOf(page);
    expect(policy).toContain(`connect-src 'self' blob: ${SERVICE} https://telemetry.test`);
    expect(await page.locator('meta[name="referrer"]').getAttribute('content')).toBe('strict-origin-when-cross-origin');
    // the theme set before the first paint: the inline head script ran
    await page.evaluate(() => localStorage.setItem('site.theme', 'dark'));
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    // telemetry reaches its host
    await expect.poll(() => sent.length, { timeout: 20_000 }).toBeGreaterThan(0);
    await page.goto('/work/');
    await policyOf(page);
    // the design library changes pages without a reload: the swapped-in page's scripts run under the first one's policy
    await page.goto('/design/');
    const before = await page.evaluate(() => performance.timeOrigin);
    await page.locator('a[href*="/design/fundamentals/"]').first().click();
    await page.waitForURL(/\/design\/fundamentals\//);
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(before);
    await page.goto('/sign-in/');
    await expect(page.locator('input[name="code"]')).toBeVisible();
    expect(seen).toEqual([]);
  });

  test('an article with a video: the player is framed', async ({ page }) => {
    const seen = await watch(page);
    await page.route(/youtube(-nocookie)?\.com|ytimg\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>player</title>' }));
    await page.goto('/leadership/do-what-makes-you-proud/');
    await policyOf(page);
    const play = page.getByRole('link', { name: /^Play video:/ }).first();
    await play.scrollIntoViewIfNeeded();
    await play.click();
    const frame = page.locator('iframe.video-embed-frame');
    await expect(frame).toHaveAttribute('src', /^https:\/\/www\.youtube-nocookie\.com\/embed\//);
    await expect.poll(() => page.frames().some((f) => f.url().includes('youtube-nocookie.com/embed/'))).toBe(true);
    expect(seen).toEqual([]);
  });

  test('a private page: signed in, it decrypts with its scripts, pictures and video; the agreement and contact form post to the service', async ({ page }) => {
    const seen = await watch(page);
    await page.route(`${SERVICE}/**`, (r) => {
      if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST' } });
      if (r.request().url().endsWith('/challenge')) {
        const challenge = Buffer.from(JSON.stringify({ s: 'salt'.padEnd(32, '0'), e: Date.now() + 600_000, d: 4 })).toString('base64url');
        return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ challenge, signature: 'signature', difficulty: 4 }) });
      }
      return r.fulfill({ status: 202, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"ok":true}' });
    });
    await page.goto('/side-projects/alphaaaaa2/');
    await policyOf(page);
    expect(await page.locator('meta[name="referrer"]').getAttribute('content')).toBe('same-origin');
    await page.locator('input[name="code"]').fill(ALL);
    await page.locator('[data-unlock-submit]').click({ force: true });
    await expect(page.locator('[data-access-gate]')).toBeHidden();
    const lead = page.locator('main img[src^="blob:"]').first();
    await lead.scrollIntoViewIfNeeded();
    await expect.poll(() => lead.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
    await page.goto('/side-projects/betabbbbb3/');
    const video = page.locator('main video').first();
    await video.scrollIntoViewIfNeeded();
    await expect(video).toHaveAttribute('poster', /^blob:/);
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThan(0);
    // the contact form: a message sent through the service
    await page.goto('/contact/');
    const form = page.locator('#contact-form');
    await form.getByLabel('Your name', { exact: false }).fill('Ada Lovelace');
    await form.getByLabel('Your email', { exact: false }).fill('ada@example.com');
    await form.getByLabel('Message', { exact: false }).fill('I read your piece on learning loops and would like to talk.');
    await form.getByRole('button', { name: 'Send message' }).click();
    await expect(form.getByRole('status')).toContainText('Message sent', { timeout: 15_000 });
    expect(seen).toEqual([]);
  });

  test('the planet: it loads, goes live and opens a building’s pages in its frame', async ({ page }) => {
    const seen = await watch(page);
    await page.addInitScript(() => {
      localStorage.setItem('game.test.grassDensity', '0.25');
      localStorage.setItem('game.test.welcome', '0');
      localStorage.setItem('game.test.lantern', '0');
      localStorage.setItem('game.test.pop', '0');
    });
    await page.goto('/play/');
    await policyOf(page);
    await page.waitForFunction(() => (window as any).__game || document.querySelector('[data-gate-continue]'));
    const cont = page.getByRole('button', { name: 'Continue anyway' });
    if (await cont.isVisible()) await cont.click();
    await page.waitForFunction(() => (window as any).__game && (window as any).__game.getState().phase !== 'loading', null, { timeout: 30_000 });
    await page.waitForFunction(() => (window as any).__game.loadStage().tier === 'complete', null, { timeout: 60_000 });
    // a building's pages, the site's own, framed over the planet
    await page.evaluate(() => (window as any).__game.teleport('library'));
    await page.getByTestId('preview-card').getByRole('button', { name: /Open/ }).click();
    await expect(page.frameLocator('[data-testid="reading-frame"]').getByRole('heading', { level: 1, name: 'Library' })).toBeVisible();
    expect(seen).toEqual([]);
  });
});
