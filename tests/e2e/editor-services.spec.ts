/**
 * Contact and visitor counts (desktop spec §9.5; desktop plan 11.3, 11.6): edit mode's Contact and Visitor counts
 * cards on the Settings screen, the Contact page following each choice at once (Email me, the site's own form
 * sent through Web3Forms, an embedded form), values checked as they're typed, and axe in light and dark. The
 * editor project, on the fixture server (port 4330); Web3Forms and Tally are intercepted, so nothing leaves.
 *
 *   npx playwright test --project=editor -g "editor: contact and visitor counts"
 */
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURE, reset } from '../../scripts/editor-test-server.mjs';

const KEY = '0f8fad5b-d9cb-469f-a165-70867728950e';
const siteJson = () => JSON.parse(readFileSync(join(FIXTURE, 'content/site.json'), 'utf8'));
const status = (page: Page) => page.locator('[data-editor-status]');
const card = (page: Page, name: 'Contact' | 'Visitor counts') => page.getByRole('form', { name });

async function choose(page: Page, cardName: 'Contact' | 'Visitor counts', option: string) {
  await card(page, cardName).getByRole('radio', { name: new RegExp(`^${option}`) }).check();
}

async function save(page: Page, cardName: 'Contact' | 'Visitor counts', button: string) {
  await card(page, cardName).getByRole('button', { name: button }).click();
  await expect(status(page)).toContainText(button === 'Save contact' ? 'Saved contact' : 'Saved visitor counts', { timeout: 30_000 });
}

test.describe('editor: contact and visitor counts', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(240_000);
  test.beforeEach(() => reset());
  test.afterAll(() => reset());

  test('the Settings screen offers both cards in three tiers, with axe in light and dark', async ({ page }) => {
    for (const scheme of ['dark', 'light'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/_edit/settings/');
      await expect(card(page, 'Contact')).toBeVisible();
      const r = await new AxeBuilder({ page }).include('[data-editor-services]').analyze();
      expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${scheme}: ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    }
    // the owner's own service and PostHog stay chosen, kept as they are
    await expect(card(page, 'Contact').getByRole('radio', { name: /^Your contact service/ })).toBeChecked();
    await expect(card(page, 'Visitor counts').getByRole('radio', { name: /^PostHog/ })).toBeChecked();
    // every tier is offered, each saying what it gives and asks
    for (const name of ['Email me', 'Web3Forms', 'Tally', 'Google Forms', 'Jotform', 'Cal.com', 'Another form']) await expect(card(page, 'Contact').getByRole('radio', { name: new RegExp(`^${name}`) })).toHaveCount(1);
    await expect(card(page, 'Contact').getByText(/^Simple\. A button that opens the visitor's email app/)).toBeVisible();
    for (const name of ['GoatCounter', 'Umami Cloud', 'Google Analytics', "Don't count visits"]) await expect(card(page, 'Visitor counts').getByRole('radio', { name: new RegExp(`^${name}`) })).toHaveCount(1);
  });

  test('Email me, then the site form through Web3Forms, then an embedded form: the Contact page follows each at once', async ({ page }) => {
    await page.goto('/_edit/settings/');
    // Email me: the address checked as it's typed
    await choose(page, 'Contact', 'Email me');
    const address = card(page, 'Contact').getByRole('textbox', { name: 'Your email address' });
    await expect(address).toBeVisible();
    await address.fill('123+ada@users.noreply.github.com');
    await expect(card(page, 'Contact').getByText(/GitHub's no-reply address/)).toBeVisible();
    await address.fill('ada@example.com');
    await expect(card(page, 'Contact').getByText(/GitHub's no-reply address/)).toBeHidden();
    await save(page, 'Contact', 'Save contact');
    expect(siteJson().services.contact).toEqual({ kind: 'email', address: 'ada@example.com' });
    expect(siteJson().services.telemetry?.key).toMatch(/^phc_/);
    await page.goto('/contact/');
    await expect(page.getByRole('link', { name: 'Email me' })).toHaveAttribute('href', 'mailto:ada@example.com');
    await expect(page.getByText('ada@example.com', { exact: true })).toBeVisible();

    // Web3Forms: a key of the wrong shape is refused, the right one makes the site's own form
    await page.goto('/_edit/settings/');
    await choose(page, 'Contact', 'Web3Forms');
    const key = card(page, 'Contact').getByRole('textbox', { name: 'Access key' });
    await key.fill('not-a-key');
    await expect(card(page, 'Contact').getByText(/^That doesn't look right: A UUID/)).toBeVisible();
    await card(page, 'Contact').getByRole('button', { name: 'Save contact' }).click();
    await expect(card(page, 'Contact').getByRole('alert').filter({ hasText: /doesn't look right/ })).toBeVisible();
    await key.fill(KEY);
    await save(page, 'Contact', 'Save contact');
    expect(siteJson().services.contact).toEqual({ kind: 'web3forms', key: KEY });

    const sent: Record<string, string>[] = [];
    await page.route('https://api.web3forms.com/submit', async (route) => {
      sent.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'Email sent successfully!' }) });
    });
    await page.goto('/contact/');
    const form = page.getByRole('region', { name: 'Send a message' });
    await form.getByRole('textbox', { name: 'Your name' }).fill('Grace Hopper');
    await form.getByRole('textbox', { name: 'Your email' }).fill('grace@example.com');
    await form.getByRole('textbox', { name: 'Message' }).fill('Hello from the test.');
    await form.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByRole('heading', { name: 'Message sent' })).toBeVisible({ timeout: 15_000 });
    expect(sent).toEqual([{ access_key: KEY, subject: 'A message from Grace Hopper', from_name: 'Grace Hopper', name: 'Grace Hopper', email: 'grace@example.com', message: 'Hello from the test.' }]);

    // an embed: a link from another host is refused; Tally's shows in a frame, with the new-tab link
    await page.goto('/_edit/settings/');
    await choose(page, 'Contact', 'Tally');
    const link = card(page, 'Contact').getByRole('textbox', { name: "The form's link" });
    await link.fill('https://evil.example/form');
    await expect(card(page, 'Contact').getByText(/isn't on a service the site can show/)).toBeVisible();
    await link.fill('https://tally.so/r/test');
    await save(page, 'Contact', 'Save contact');
    expect(siteJson().services.contact).toEqual({ kind: 'embed', url: 'https://tally.so/r/test' });
    await page.route('https://tally.so/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Form</title><p>A test form</p>' }));
    await page.goto('/contact/');
    await expect(page.locator('iframe[title="Contact form (Tally)"]')).toHaveAttribute('src', 'https://tally.so/r/test');
    await expect(page.getByRole('link', { name: /Open the form in a new tab/ })).toHaveAttribute('href', 'https://tally.so/r/test');
  });

  test("Visitor counts: GoatCounter for the site's address with Clarity beside it, then none at all", async ({ page }) => {
    await page.goto('/_edit/settings/');
    await choose(page, 'Visitor counts', 'GoatCounter');
    const counts = card(page, 'Visitor counts');
    await counts.getByRole('textbox', { name: 'Your code name' }).fill('Ada!');
    await expect(counts.getByText(/^That doesn't look right: 2 to 50 lowercase/)).toBeVisible();
    await counts.getByRole('textbox', { name: 'Your code name' }).fill('ada');
    await expect(counts.getByRole('link', { name: 'Open my dashboard' }).first()).toHaveAttribute('href', 'https://ada.goatcounter.com/');
    await expect(counts.getByRole('textbox', { name: "Your site's address" })).toHaveValue('https://prabinpebam.github.io/atiya/');
    await counts.getByRole('textbox', { name: /^Microsoft Clarity project ID/ }).fill('abc123def4');
    await save(page, 'Visitor counts', 'Save visitor counts');
    expect(siteJson().services).toMatchObject({ counts: { kind: 'goatcounter', code: 'ada', site: 'https://prabinpebam.github.io/atiya/' }, clarity: { id: 'abc123def4' } });
    expect(siteJson().services.telemetry).toBeUndefined();
    // PostHog was replaced: it's no longer offered
    await expect(counts.getByRole('radio', { name: /^GoatCounter/ })).toBeChecked();
    await expect(counts.getByRole('radio', { name: /^PostHog/ })).toHaveCount(0);

    // off: nothing counts, Clarity included
    await choose(page, 'Visitor counts', "Don't count visits");
    await expect(counts.getByRole('textbox', { name: "Your site's address" })).toBeHidden();
    await save(page, 'Visitor counts', 'Save visitor counts');
    expect(siteJson().services.counts).toBeUndefined();
    expect(siteJson().services.clarity).toBeUndefined();
    expect(siteJson().services.contact.endpoint).toMatch(/^https:/);
  });
});
