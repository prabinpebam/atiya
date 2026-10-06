/**
 * The contact form in the browser (documentation/contact/spec.md; plan CD2 to CD7), on the test build, whose
 * service address (.env.test) is a made-up host every test intercepts: the real service is never called.
 * Its challenges are easy (4 bits), so the browser's proof of work is solved at once.
 */
import { expect, test, type Page, type Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { accessRequest } from '../../contact-api/src/rules.mjs';

const SERVICE = 'https://contact.test';
const CONTACT = '/contact/';
const ADA = { name: 'Ada Lovelace', email: 'ada@example.com', message: 'I read your piece on learning loops and would like to talk.' };

type Answer = { status: number; body: Record<string, unknown> } | 'offline';

/** The service, faked: a challenge for every ask, and the answers given in order (the last one repeats). */
async function service(page: Page, answers: Answer[] = [{ status: 202, body: { ok: true } }]) {
  const posts: Record<string, unknown>[] = [];
  let challenges = 0;
  await page.route(`${SERVICE}/api/contact/challenge`, (route: Route) => {
    challenges++;
    const challenge = Buffer.from(JSON.stringify({ s: `salt${challenges}`.padEnd(32, '0'), e: Date.now() + 600_000, d: 4 })).toString('base64url');
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ challenge, signature: `signature${challenges}`, difficulty: 4 }) });
  });
  await page.route(`${SERVICE}/api/contact`, (route: Route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST' } });
    posts.push(JSON.parse(route.request().postData() ?? '{}'));
    const a = answers[Math.min(posts.length - 1, answers.length - 1)];
    if (a === 'offline') return route.abort('failed');
    return route.fulfill({ status: a.status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(a.body) });
  });
  return { posts, challenges: () => challenges };
}

const form = (page: Page) => page.locator('#contact-form');
const field = (page: Page, label: 'Your name' | 'Your email' | 'Message') => form(page).getByLabel(label, { exact: false });
async function fill(page: Page, v = ADA) {
  await field(page, 'Your name').fill(v.name);
  await field(page, 'Your email').fill(v.email);
  await field(page, 'Message').fill(v.message);
}
const send = (page: Page) => form(page).getByRole('button', { name: 'Send message' });

test.describe('contact form', () => {
  test('sends a message: the request carries the fields and the solved challenge, and the confirmation takes the focus', async ({ page }) => {
    const s = await service(page);
    await page.goto(CONTACT);
    await expect(form(page).getByRole('heading', { name: 'Send a message' })).toBeVisible();
    await fill(page);
    await send(page).click();
    const sent = form(page).getByRole('status');
    await expect(sent).toBeFocused({ timeout: 15_000 });
    await expect(sent).toContainText('Message sent');
    await expect(sent).toContainText("Thanks, Ada. I'll reply to ada@example.com.");
    expect(s.posts).toHaveLength(1);
    const p = s.posts[0];
    expect(p).toMatchObject({ ...ADA, website: '', challenge: expect.any(String), signature: 'signature1', nonce: expect.stringMatching(/^\d+$/) });
    // a person who sends at once still waits out the service's minimum time on the form
    expect(p.elapsed as number).toBeGreaterThanOrEqual(3000);
    expect(p).not.toHaveProperty('about');
    // the draft goes once it's sent; Send another message brings back an empty form
    expect(await page.evaluate(() => sessionStorage.getItem('site.contact.draft'))).toBeNull();
    await form(page).getByRole('button', { name: 'Send another message' }).click();
    await expect(field(page, 'Your name')).toBeFocused();
    await expect(field(page, 'Message')).toHaveValue('');
  });

  test("each field's error is said under it, the first takes the focus, and it clears once fixed", async ({ page }) => {
    const s = await service(page);
    await page.goto(CONTACT);
    await send(page).click();
    await expect(field(page, 'Your name')).toBeFocused();
    await expect(form(page)).toContainText('Enter your name.');
    await expect(form(page)).toContainText('Enter your email so I can reply.');
    await expect(form(page)).toContainText('Write your message.');
    await expect(field(page, 'Your name')).toHaveAttribute('aria-invalid', 'true');
    await expect(field(page, 'Your name')).toHaveAttribute('aria-describedby', /contact-form-name-error/);
    await field(page, 'Your name').fill('Ada');
    await expect(form(page)).not.toContainText('Enter your name.');
    await expect(field(page, 'Your name')).not.toHaveAttribute('aria-invalid');
    // checked as it's left
    await field(page, 'Your email').fill('ada@example');
    await field(page, 'Message').focus();
    await expect(form(page)).toContainText('Enter an email address like name@example.com.');
    await field(page, 'Message').fill('https://a.b http://c.d www.e.f https://g.h and more');
    await send(page).click();
    await expect(field(page, 'Your email')).toBeFocused();
    await expect(form(page)).toContainText('Take out some links: up to 3 are allowed.');
    expect(s.posts).toHaveLength(0);
  });

  test('every failure says why, keeps what was typed, and a retry sends', async ({ page }) => {
    const s = await service(page, [{ status: 429, body: { error: 'rate' } }, { status: 429, body: { error: 'daily' } }, { status: 500, body: {} }, 'offline', { status: 400, body: { error: 'invalid', fields: { email: 'format' } } }, { status: 202, body: { ok: true } }]);
    await page.goto(CONTACT);
    await fill(page);
    const alert = form(page).getByRole('alert');
    for (const said of [
      "You've sent several messages in a short time. Try again in an hour.",
      'The form is resting for today. Try again tomorrow.',
      'Something went wrong on my side. Try again in a few minutes.',
      "Your message didn't send. Check your connection and try again.",
    ]) {
      await send(page).click();
      await expect(alert).toHaveText(said, { timeout: 15_000 });
      await expect(send(page)).toBeEnabled();
      await expect(field(page, 'Message')).toHaveValue(ADA.message);
    }
    // a field the service refused: its error under it
    await send(page).click();
    await expect(field(page, 'Your email')).toBeFocused({ timeout: 15_000 });
    await expect(form(page)).toContainText('Enter an email address like name@example.com.');
    await send(page).click();
    await expect(form(page).getByRole('status')).toBeFocused({ timeout: 15_000 });
    // each try used its own challenge
    expect(new Set(s.posts.map((p) => p.signature)).size).toBe(s.posts.length);
  });

  test('a stale challenge is fetched again and the message sent, unseen', async ({ page }) => {
    const s = await service(page, [{ status: 403, body: { error: 'challenge' } }, { status: 202, body: { ok: true } }]);
    await page.goto(CONTACT);
    await fill(page);
    await send(page).click();
    await expect(form(page).getByRole('status')).toBeFocused({ timeout: 15_000 });
    expect(s.posts).toHaveLength(2);
    await expect(form(page).getByRole('alert')).toBeHidden();
  });

  test('Ask for access starts the request for its section; the draft survives a reload and is never replaced', async ({ page }) => {
    const s = await service(page);
    await page.goto('/side-projects/');
    await page.locator('[data-sign-in-line]').getByRole('link', { name: 'Ask for access' }).click();
    await expect(page).toHaveURL(/\/contact\/\?access=Side%20projects#contact-form$/);
    await expect(field(page, 'Message')).toHaveValue(accessRequest('Side projects'));
    await field(page, 'Your name').fill('Ada Lovelace');
    await field(page, 'Message').fill('My own words about access, please.');
    await page.reload();
    await expect(field(page, 'Your name')).toHaveValue('Ada Lovelace');
    await expect(field(page, 'Message')).toHaveValue('My own words about access, please.');
    await field(page, 'Your email').fill(ADA.email);
    await send(page).click();
    await expect(form(page).getByRole('status')).toBeFocused({ timeout: 15_000 });
    expect(s.posts[0]).toMatchObject({ about: 'Side projects', message: 'My own words about access, please.' });
    // Get in touch on the Sign in page: the shared work in general
    await page.goto('/sign-in/');
    await page.getByRole('link', { name: 'Get in touch' }).click();
    await expect(field(page, 'Message')).toHaveValue(accessRequest(''));
  });

  test('the honeypot is out of reach: hidden from assistive tech, no tab stop', async ({ page }) => {
    await service(page);
    await page.goto(CONTACT);
    const trap = form(page).locator('input[name="website"]');
    await expect(trap).toHaveAttribute('tabindex', '-1');
    await expect(form(page).locator('[aria-hidden="true"]:has(input[name="website"])')).toHaveCount(1);
    await field(page, 'Message').focus();
    await page.keyboard.press('Tab');
    await expect(send(page)).toBeFocused();
  });

  test('nothing typed leaves the browser for telemetry', async ({ page }) => {
    const raw: string[] = [];
    await page.addInitScript(() => localStorage.setItem('site.test.telemetry', '1'));
    await page.context().route('https://telemetry.test/**', async (route) => {
      raw.push(`${route.request().url()}\n${route.request().postData() ?? ''}`);
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":1}' });
    });
    await service(page);
    await page.goto(CONTACT);
    await expect.poll(() => raw.length, { timeout: 15_000 }).toBeGreaterThan(0);
    await fill(page);
    await field(page, 'Your name').click();
    await send(page).click();
    await expect(form(page).getByRole('status')).toBeFocused({ timeout: 15_000 });
    await form(page).getByRole('status').click();
    await page.waitForTimeout(1500);
    const all = raw.join('\n');
    for (const v of [ADA.name, ADA.email, ADA.message.slice(0, 30), 'Ada']) expect(all, v).not.toContain(v);
  });

  for (const scheme of ['light', 'dark'] as const)
    test(`no serious axe findings, ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await service(page);
      await page.goto(CONTACT);
      await send(page).click();
      await expect(form(page)).toContainText('Enter your name.');
      const r = await new AxeBuilder({ page }).include('#contact-form').analyze();
      expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    });

  test('on a 320 px phone: no sideways scroll, and every control is a 44 px target', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await service(page);
    await page.goto(CONTACT);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    for (const el of [field(page, 'Your name'), field(page, 'Your email'), send(page)]) {
      const b = await el.boundingBox();
      expect(b!.height, await el.evaluate((e) => e.outerHTML.slice(0, 60))).toBeGreaterThanOrEqual(44);
    }
    await ctx.close();
  });
});
