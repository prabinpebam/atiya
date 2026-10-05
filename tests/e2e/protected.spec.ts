/**
 * Locked and private pages in the browser (documentation/access/spec.md §2, §5, §7; benchmark QB3 to QB9):
 * on the test build, sealed from the made-up fixtures (tests/fixtures/private-pages), whose codes are
 * known here. Signed out, nothing protected is readable; a grant sees exactly its scope; a magic link
 * opens its page and leaves no secret behind; pictures, the lightbox and videos work once open; sign-out
 * leaves nothing in any tab; every failure has its message; and it's accessible and fast enough.
 */
import { expect, test, type Page, type Response } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FIX = join(import.meta.dirname, '../fixtures/private-pages');
const grants = JSON.parse(readFileSync(join(FIX, 'access.json'), 'utf8')).grants as { id: string; name?: string; secret: { words?: string; key?: string } }[];
const code = (id: string) => {
  const g = grants.find((x) => x.id === id)!;
  return `${g.name}-${g.secret.words}`;
};
const ALL = code('gfixall22');
const ONE = code('gfixone22');
const LINK = `/p/privone222/#a=gfixlink2.${grants.find((g) => g.id === 'gfixlink2')!.secret.key}`;
const title = (id: string) => (JSON.parse(readFileSync(join(FIX, 'articles', `${id}.json`), 'utf8')) as { title: string }).title;
const TITLES = ['fx-locked-alpha', 'fx-locked-beta', 'fx-locked-gamma', 'fx-locked-delta', 'fx-private-one', 'fx-private-two'].map((id) => [id, title(id)] as const);
const SECTION = '/side-projects/';
const ALPHA = '/side-projects/alphaaaaa2/';
const BETA = '/side-projects/betabbbbb3/';

const noSeriousViolations = async (page: Page) => {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
};
/** The protected titles anywhere in the page's DOM (its text and its attributes). */
const titlesIn = async (page: Page) => {
  const all = await page.evaluate(() => document.documentElement.outerHTML + document.title);
  return TITLES.filter(([, t]) => all.includes(t)).map(([id]) => id);
};
const cards = (page: Page) => page.evaluate(() => [...document.querySelectorAll('[data-cards] > [data-node]')].map((e) => e.getAttribute('data-node')));
async function signIn(page: Page, value: string, remember = false) {
  await page.locator('input[name="code"]').fill(value);
  if (remember) await page.locator('input[name="remember"]').check({ force: true });
  await page.locator('[data-unlock-submit]').click({ force: true });
}

test.describe('protected content', () => {
  test('signed out: a section lists its open pages only, and nothing protected is readable anywhere', async ({ page }) => {
    const bodies: string[] = [];
    page.on('response', async (r: Response) => {
      if (/text|json|javascript/.test(r.headers()['content-type'] ?? '')) bodies.push(await r.text().catch(() => ''));
    });
    await page.goto(SECTION);
    expect((await cards(page)).filter((n) => n?.startsWith('fx-'))).toEqual([]);
    await expect(page.locator('[data-sign-in-line]')).toBeVisible();
    await expect(page.locator('template[data-sealed="card"]')).toHaveCount(3);
    expect(await titlesIn(page)).toEqual([]);
    // a section with only locked pages: its empty state, and the sign-in line
    await page.goto('/work/');
    await expect(page.locator('[data-cards-empty]')).toBeVisible();
    await expect(page.locator('[data-sign-in-line]')).toBeVisible();
    // a locked page's shell: neutral, kept out of search, the sign-in panel in place of the page
    await page.goto(ALPHA);
    await expect(page).toHaveTitle('Locked page');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
    await expect(page.locator('[data-access-gate] [data-unlock-form]')).toBeVisible();
    expect(await titlesIn(page)).toEqual([]);
    await page.goto('/p/privtwo333/');
    await expect(page).toHaveTitle('Private page');
    await expect(page.locator('[data-unlock-panel="private"]')).toBeVisible();
    expect(await titlesIn(page)).toEqual([]);
    for (const [id, t] of TITLES) expect(bodies.some((b) => b.includes(t)), `${id}'s title in a response`).toBe(false);
  });

  test('signing in on the Sign in page returns to the section, with the shared cards in their places (QB3)', async ({ page }) => {
    await page.goto(`/sign-in/?return=${encodeURIComponent(SECTION)}`);
    await signIn(page, ALL.replace(/-/g, ' ').toUpperCase());
    await page.waitForURL(`**${SECTION}`);
    await expect(page.locator('[data-shared]')).toHaveCount(3);
    expect((await cards(page)).slice(0, 6)).toEqual(['atiya', 'fx-locked-alpha', 'watai', 'fx-locked-beta', 'story', 'fx-locked-gamma']);
    await expect(page.locator('[data-shared]').first()).toContainText('Shared with you');
    await expect(page.locator('[data-access-bar]')).toBeVisible();
    await expect(page.locator('[data-access-bar]')).toContainText('until 1 January 2099');
    await expect(page.locator('[data-sign-in-line]')).toBeHidden();
    // the other section's locked page, the same sign-in
    await page.goto('/work/');
    await expect(page.locator('[data-shared]')).toHaveCount(1);
    await expect(page.locator('[data-cards-empty]')).toBeHidden();
    // moving between pages needs no code: the page opens at once
    await page.goto(BETA);
    await expect(page.locator('h1')).toHaveText(title('fx-locked-beta'));
    await expect(page).toHaveTitle(new RegExp(title('fx-locked-beta')));
  });

  test('a grant sees its scope and nothing else: one page, no private ones (QB3)', async ({ page }) => {
    await page.goto(ALPHA);
    await signIn(page, ONE);
    await expect(page.locator('h1')).toHaveText(title('fx-locked-alpha'));
    expect(await titlesIn(page)).toEqual(['fx-locked-alpha']);
    await page.goto(SECTION);
    await expect(page.locator('[data-shared]')).toHaveCount(1);
    expect((await cards(page)).filter((n) => n?.startsWith('fx-'))).toEqual(['fx-locked-alpha']);
    expect(await titlesIn(page)).toEqual(['fx-locked-alpha']);
    await page.goto(BETA);
    await expect(page.locator('[data-access-gate] [data-unlock-status]')).toHaveText("This page isn't shared with your access. Get in touch if you'd like to see it.");
    expect(await titlesIn(page)).toEqual([]);
    // a code never opens a private page
    await page.goto('/p/privone222/');
    await expect(page.locator('[data-unlock-status]')).toHaveText("Your link doesn't open this page.");
    expect(await titlesIn(page)).toEqual([]);
  });

  test('a magic link opens its private page, takes its secret out of the address bar, and opens nothing else (QB3)', async ({ page }) => {
    await page.goto(LINK);
    await expect(page.locator('h1')).toHaveText(title('fx-private-one'));
    expect(new URL(page.url()).hash).toBe('');
    expect(await page.evaluate(() => sessionStorage.getItem('site.access'))).not.toMatch(/gfixlink2\.[\w-]{43}/);
    expect(await titlesIn(page)).toEqual(['fx-private-one']);
    await page.goto('/p/privtwo333/');
    await expect(page.locator('[data-unlock-status]')).toHaveText("Your link doesn't open this page.");
    await page.goto(SECTION);
    await expect(page.locator('[data-shared]')).toHaveCount(0);
  });

  test('a locked page opened directly: signing in there opens it in place, with its pictures, the lightbox and its video (QB7a)', async ({ page }) => {
    await page.goto(ALPHA);
    await signIn(page, ALL);
    await expect(page.locator('h1')).toHaveText(title('fx-locked-alpha'));
    await expect(page.locator('h1')).toBeFocused();
    await expect(page.locator('[data-access-gate]')).toBeHidden();
    // the time it took: deriving the key and opening the keyring, then swapping the page in
    const [derive, swap] = await page.evaluate(() => ['access:derive', 'access:swap'].map((n) => performance.getEntriesByName(n)[0]?.duration ?? -1));
    expect(derive).toBeGreaterThan(0);
    expect(derive).toBeLessThan(2000);
    expect(swap).toBeLessThan(200);
    // the lead picture: decrypted to a blob, and drawn
    const lead = page.getByAltText('Fixture picture: a harbour lantern glowing over still water at dusk.').first();
    await lead.scrollIntoViewIfNeeded();
    await expect(lead).toHaveAttribute('src', /^blob:/);
    await expect.poll(() => lead.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
    // the lightbox, from the figure's link
    const link = page.locator('main a[data-lightbox]').first();
    await link.scrollIntoViewIfNeeded();
    await link.click();
    await expect(page.locator('[data-lightbox-image]')).toHaveAttribute('src', /^blob:/);
    await page.keyboard.press('Escape');
    // the video and its poster
    await page.goto(BETA);
    const video = page.locator('main video').first();
    await video.scrollIntoViewIfNeeded();
    await expect(video).toHaveAttribute('poster', /^blob:/);
    await expect(video.locator('source')).toHaveAttribute('src', /^blob:/);
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThan(0);
  });

  test("a picture's dark version is decrypted in dark mode", async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(ALPHA);
    await signIn(page, ALL);
    const source = page.locator('main picture source[data-dark]').first();
    await source.scrollIntoViewIfNeeded();
    await expect(source).toHaveAttribute('srcset', /^blob:/);
  });

  test('Remember on this device keeps the key; sign-out clears it here, in another tab, and from Back (QB5)', async ({ page, context }) => {
    await page.goto(SECTION);
    await page.goto(ALPHA);
    await signIn(page, ALL, true);
    await expect(page.locator('h1')).toHaveText(title('fx-locked-alpha'));
    expect(await page.evaluate(() => !!localStorage.getItem('site.access'))).toBe(true);
    const other = await context.newPage();
    await other.goto(SECTION);
    await expect(other.locator('[data-shared]')).toHaveCount(3);
    await page.locator('[data-access-sign-out]').click({ force: true });
    await page.waitForURL(`**${SECTION}`);
    expect(await page.evaluate(() => [sessionStorage.getItem('site.access'), localStorage.getItem('site.access')])).toEqual([null, null]);
    await expect(page.locator('[data-shared]')).toHaveCount(0);
    await expect(page.locator('[data-sign-in-line]')).toBeVisible();
    // the other tab signs out too, and shows nothing shared
    await expect(other.locator('[data-shared]')).toHaveCount(0);
    expect(await titlesIn(other)).toEqual([]);
    // sign-out replaced the decrypted page in the history: Back can't bring it back
    await page.goBack();
    await expect(page).toHaveURL(/\/side-projects\/$/);
    await expect(page.locator('[data-shared]')).toHaveCount(0);
    expect(await titlesIn(page)).toEqual([]);
  });

  test('every failure says what happened (QB9)', async ({ page }) => {
    await page.goto('/sign-in/');
    await signIn(page, 'harbor maple river cloud wrong');
    await expect(page.locator('[data-unlock-status]')).toHaveText("That access code doesn't work. Check it and try again, or get in touch for a new one.");
    await expect(page.locator('input[name="code"]')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('input[name="code"]')).toBeFocused();
    await signIn(page, 'four words only here');
    await expect(page.locator('[data-unlock-status]')).toHaveText(/doesn't work/);
    // the expired and withdrawn grants have no keyring in this build: a typed code doesn't work
    await signIn(page, code('gfixexp22'));
    await expect(page.locator('[data-unlock-status]')).toHaveText(/doesn't work/);
    await signIn(page, code('gfixrev22'));
    await expect(page.locator('[data-unlock-status]')).toHaveText(/doesn't work/);
    // a remembered key past its grant's end says so
    await page.evaluate(() => sessionStorage.setItem('site.access', JSON.stringify({ v: 1, grant: 'gfixall22', lookup: 'c/harbor', kek: 'A'.repeat(43), via: 'code', expiresAt: '2026-01-05T00:00:00+05:30' })));
    await page.goto(ALPHA);
    await expect(page.locator('[data-access-gate] [data-unlock-status]')).toHaveText('This access expired on 5 January 2026. Get in touch for a new one.');
    // offline
    await page.route('**/_access/**', (r) => r.abort());
    await signIn(page, ALL);
    await expect(page.locator('[data-access-gate] [data-unlock-status]')).toHaveText("Couldn't reach the site to sign in. Check your connection and try again.");
  });

  test('a page from another deploy reloads once, then says the access no longer works, never "wrong code" (QB4)', async ({ page }) => {
    await page.goto(ALPHA);
    await signIn(page, ALL);
    await expect(page.locator('h1')).toHaveText(title('fx-locked-alpha'));
    let asked = 0;
    await page.route('**/_access/**', (r) => {
      asked++;
      return r.fulfill({ status: 404, body: '' });
    });
    await page.goto(BETA);
    await expect(page.locator('[data-access-gate] [data-unlock-status]')).toHaveText('This access code no longer works. Get in touch for a new one.');
    expect(asked).toBe(2);
  });

  test('a browser without Web Crypto is told so', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(globalThis.crypto, 'subtle', { value: undefined }));
    await page.goto('/sign-in/');
    await expect(page.locator('[data-unlock-status]')).toHaveText(/This browser can't open shared pages/);
  });

  test('decrypting a 10 MB video takes under 1.5 s (QB7a)', async ({ page }) => {
    await page.goto('/sign-in/');
    const ms = await page.evaluate(async () => {
      const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const plain = new Uint8Array(10 * 1024 * 1024);
      const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
      const t0 = performance.now();
      const out = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, sealed);
      URL.revokeObjectURL(URL.createObjectURL(new Blob([out], { type: 'video/mp4' })));
      return performance.now() - t0;
    });
    expect(ms).toBeLessThan(1500);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`no serious axe findings on the Sign in page, a signed-in section, a locked page and a private note, ${scheme} (QB8)`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/sign-in/');
      await noSeriousViolations(page);
      await page.goto('/p/privtwo333/');
      await noSeriousViolations(page);
      await page.goto(ALPHA);
      await noSeriousViolations(page);
      await signIn(page, ALL);
      await expect(page.locator('h1')).toHaveText(title('fx-locked-alpha'));
      await noSeriousViolations(page);
      await page.goto(SECTION);
      await expect(page.locator('[data-shared]')).toHaveCount(3);
      await noSeriousViolations(page);
    });
  }

  test('on a 320 px phone: no sideways scroll, and every control is a 44 px target (QB8)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/sign-in/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    for (const sel of ['input[name="code"]', '[data-unlock-submit]', '[data-unlock-show]']) {
      const box = await page.locator(sel).boundingBox();
      expect(box!.height, sel).toBeGreaterThanOrEqual(44);
    }
    await signIn(page, ALL);
    await expect(page.locator('[data-unlock-status]')).toHaveText('Signed in.');
    await page.goto(SECTION);
    await expect(page.locator('[data-access-bar]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    const out = await page.locator('[data-access-sign-out]').boundingBox();
    expect(out!.height).toBeGreaterThanOrEqual(44);
  });
});

/**
 * Telemetry (documentation/access/spec.md §9; benchmark QB6): the test build sends to a fake host when a
 * test asks; every request to it is captured and decoded here, and nothing secret may be in any of them.
 */
type Sent = { event: string; properties: Record<string, unknown> };
const HOST = 'https://telemetry.test';
const ALLOWED: Record<string, string[]> = {
  $pageview: ['$current_url', '$pathname', '$title', '$referrer', '$referring_domain'],
  $identify: ['$anon_distinct_id'],
  access_signed_in: ['grant', 'via'],
  access_opened: ['grant', 'place', 'cards'],
  access_failed: ['reason'],
  access_signed_out: ['grant'],
  access_link: ['kind', 'domain'],
  video_played: ['place'],
};

function decode(body: string): Sent[] {
  const parse = (s: string): Sent[] => {
    const v = JSON.parse(s) as Sent | Sent[] | { batch: Sent[] };
    return Array.isArray(v) ? v : 'batch' in v ? v.batch : [v];
  };
  try {
    return parse(body);
  } catch {
    const data = new URLSearchParams(body).get('data');
    return data ? parse(Buffer.from(data, 'base64').toString('utf8')) : [];
  }
}

async function capture(page: Page, init: () => void = () => {}) {
  const raw: string[] = [];
  const sent: (Sent & { at: string })[] = [];
  await page.addInitScript(() => localStorage.setItem('site.test.telemetry', '1'));
  await page.addInitScript(init);
  await page.context().route(`${HOST}/**`, async (route) => {
    const req = route.request();
    const body = req.postData() ?? '';
    raw.push(`${req.url()}\n${body}`);
    if (body) for (const e of decode(body)) sent.push({ ...e, at: new URL(String(e.properties?.$current_url ?? 'https://x/')).pathname });
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":1}' });
  });
  return { raw, sent, events: () => sent.map((e) => e.event) };
}

test.describe('protected content: telemetry (QB6)', () => {
  test('nothing secret leaves the browser, protected pages send only the allowlist, and sign-out resets the identity', async ({ page }) => {
    const t = await capture(page);
    // an open page: PostHog's own capture, without the fragment
    await page.goto('/#about-the-fragment');
    await expect.poll(() => t.sent.find((e) => e.event === '$pageview')?.properties.$current_url, { timeout: 15_000 }).toMatch(/\/$/);
    // signing in: the Sign in page is allowlisted, and the visitor becomes the grant
    await page.goto(`/sign-in/?return=${encodeURIComponent(SECTION)}`);
    await expect.poll(() => t.sent.some((e) => e.event === '$pageview' && e.properties.$title === 'Sign in'), { timeout: 15_000 }).toBe(true);
    await signIn(page, 'wrong-words-that-are-not-a-code');
    await expect.poll(() => t.sent.find((e) => e.event === 'access_failed')?.properties.reason, { timeout: 15_000 }).toBe('wrong');
    await signIn(page, ALL);
    await page.waitForURL(`**${SECTION}`);
    await expect(page.locator('[data-shared]')).toHaveCount(3);
    await expect.poll(() => t.events(), { timeout: 15_000 }).toEqual(expect.arrayContaining(['access_signed_in', '$identify', 'access_opened']));
    expect(t.sent.find((e) => e.event === 'access_signed_in')?.properties).toMatchObject({ grant: 'gfixall22', via: 'code', distinct_id: 'gfixall22' });
    expect(t.sent.find((e) => e.event === 'access_opened')?.properties).toMatchObject({ grant: 'gfixall22', place: SECTION, cards: 3 });
    // a locked page: a neutral page view, and a followed link as its kind only
    await page.goto(ALPHA);
    await expect(page.locator('h1')).toHaveText(title('fx-locked-alpha'));
    await expect.poll(() => t.sent.some((e) => e.event === '$pageview' && e.properties.$title === 'Locked page'), { timeout: 15_000 }).toBe(true);
    await page.locator('main a[href*="/side-projects/"]').first().click();
    await expect.poll(() => t.sent.find((e) => e.event === 'access_link')?.properties.kind, { timeout: 15_000 }).toBe('internal');
    // sign out: the next page's events are anonymous again
    await page.goto(SECTION);
    await expect(page.locator('[data-access-bar]')).toBeVisible();
    await page.locator('[data-access-sign-out]').click({ force: true });
    await expect(page.locator('[data-sign-in-line]')).toBeVisible();
    const before = t.sent.length;
    await page.goto('/');
    await expect.poll(() => t.sent.slice(before).find((e) => e.event === '$pageview')?.properties.distinct_id, { timeout: 15_000 }).toBeTruthy();
    expect(t.sent.slice(before).every((e) => e.properties.distinct_id !== 'gfixall22')).toBe(true);

    // nothing secret, anywhere: no protected title or sentence, no code, no link secret, no fragment, no recipient
    const all = t.raw.join('\n');
    for (const [id, words] of TITLES) expect(all.includes(words), `${id}'s title`).toBe(false);
    expect(all).not.toContain('Fixture paragraph');
    expect(all).not.toContain('harbor-maple-river');
    expect(all).not.toContain('wrong-words-that-are-not-a-code');
    expect(all).not.toMatch(/#|%23/);
    for (const g of grants) if (g.secret.key) expect(all).not.toContain(g.secret.key);
    // protected pages and the Sign in page sent only the allowlist
    const guarded = t.sent.filter((e) => e.at === '/sign-in/' || e.at.startsWith(ALPHA) || e.event.startsWith('access_'));
    for (const e of guarded) {
      expect(Object.keys(ALLOWED), e.event).toContain(e.event);
      const own = Object.keys(e.properties).filter((k) => !k.startsWith('$') && !['token', 'distinct_id'].includes(k));
      expect(own.filter((k) => !ALLOWED[e.event].includes(k)), e.event).toEqual([]);
    }
  });

  test('a magic link sends its grant, never its secret', async ({ page }) => {
    const t = await capture(page);
    await page.goto(LINK);
    await expect(page.locator('h1')).toHaveText(title('fx-private-one'));
    await expect.poll(() => t.sent.find((e) => e.event === 'access_signed_in')?.properties.via, { timeout: 15_000 }).toBe('link');
    await expect.poll(() => t.sent.some((e) => e.event === '$pageview' && e.properties.$title === 'Private page'), { timeout: 15_000 }).toBe(true);
    const all = t.raw.join('\n');
    expect(all).not.toContain(grants.find((g) => g.id === 'gfixlink2')!.secret.key!);
    expect(all).not.toContain(title('fx-private-one'));
    expect(all).not.toMatch(/#|%23/);
  });

  for (const [name, init, path] of [
    ['Global Privacy Control', () => Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true }), '/'],
    ['Do Not Track', () => Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' }), '/'],
    ['?telemetry=off, and it stays off on the device', () => {}, '/?telemetry=off'],
  ] as const) {
    test(`${name} sends nothing`, async ({ page }) => {
      const t = await capture(page, init);
      await page.goto(path);
      await page.goto(SECTION);
      await page.waitForTimeout(5000);
      expect(t.raw).toEqual([]);
    });
  }
});
