/**
 * Edit mode's AI screen (documentation/editor/ai-services.md §7, §8; plan: ai-plan.md S4): the writer, Found on
 * this computer, a card per service with its key, Test and Remove, and Add a service. Against the tests'
 * stand-in AI service (scripts/lib/ai-stand-in.mjs), whose models named after a failure fail that way; the
 * fixture server's environment has a key for "Stand-in cloud" only, and Credential Manager reading off.
 *
 *   npx playwright test --project=editor tests/e2e/editor-ai-screen.spec.ts
 */
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AI_STAND_IN, FIXTURE, reset } from '../../scripts/editor-test-server.mjs';

type Settings = { writer: string | null; services: { id: string; model: string; privatePages: boolean; acceptedAt?: string; lastTest?: { ok: boolean; state?: string } }[] };
const settings = (): Settings => JSON.parse(readFileSync(join(FIXTURE, '.atiya', 'ai.json'), 'utf8'));
const card = (page: Page, name: string) => page.getByRole('region', { name, exact: true });
const writer = (page: Page) => page.getByRole('region', { name: 'Writer' });
const addForm = (page: Page) => page.getByRole('form', { name: 'Add a service' });
const state = (page: Page, name: string) => card(page, name).locator('[data-ai-state]');

async function pick(page: Page, combobox: ReturnType<Page['getByRole']>, option: RegExp | string) {
  await combobox.click();
  await page.getByRole('option', typeof option === 'string' ? { name: option, exact: true } : { name: option }).click();
}

async function addCloud(page: Page, o: { kind?: RegExp; name: string; base?: string; model: string }) {
  const form = addForm(page);
  if (o.kind) await pick(page, form.getByRole('combobox', { name: 'Kind' }), o.kind);
  await form.getByRole('textbox', { name: 'Name' }).fill(o.name);
  if (o.base) await form.getByRole('textbox', { name: 'Base URL' }).fill(o.base);
  await form.getByRole('textbox', { name: 'Model' }).fill(o.model);
  await form.getByRole('checkbox', { name: 'I understand where my words go' }).check();
  await form.getByRole('button', { name: 'Add the service' }).click();
  await expect(card(page, o.name)).toBeVisible({ timeout: 30_000 });
}

test.describe('editor: AI screen', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(180_000);
  test.beforeEach(() => reset());
  test.afterAll(() => reset());

  test('the writer: remove it, add Ollama back from Found on this computer by keyboard, test it, add a cloud service, make it the writer, remove it and the writer falls back', async ({ page }) => {
    await page.goto('/_edit/ai/');
    await expect(card(page, 'Ollama')).toBeVisible();
    await expect(card(page, 'Ollama').getByText('Writer', { exact: true })).toBeVisible();
    await expect(state(page, 'Ollama')).toHaveText('Untested');
    await expect(writer(page).getByText('Nothing new is running here.', { exact: false })).toBeVisible();

    // Remove, after the confirm: no writer, and Ollama is offered as found on this computer
    page.once('dialog', (d) => void d.accept());
    await card(page, 'Ollama').getByRole('button', { name: 'Remove' }).click();
    await expect(card(page, 'Ollama')).toHaveCount(0);
    await expect(writer(page).getByText('No service yet.')).toBeVisible();
    await expect(writer(page).getByText('Ollama is running on this computer, with 5 models.')).toBeVisible();
    expect(settings()).toMatchObject({ writer: null, services: [] });

    // Add it with the keyboard: it becomes the writer, and the focus goes to its Test
    await writer(page).getByRole('button', { name: 'Add Ollama' }).focus();
    await page.keyboard.press('Enter');
    await expect(card(page, 'Ollama')).toBeVisible();
    await expect(card(page, 'Ollama').getByRole('button', { name: 'Test' })).toBeFocused();
    expect(settings()).toMatchObject({ writer: 'ollama', services: [{ id: 'ollama', model: 'stand-in' }] });

    // Test: it works, said on the card and announced
    await page.keyboard.press('Enter');
    await expect(state(page, 'Ollama')).toHaveText('Ready', { timeout: 30_000 });
    await expect(card(page, 'Ollama').locator('[data-ai-last]')).toHaveText(/^Works: answered in \d+\.\d s, just now\.$/);
    expect(settings().services[0].lastTest).toMatchObject({ ok: true, state: 'ok' });

    // a cloud service (other OpenAI-compatible), with its key in the environment: Key found, and it tests
    await addCloud(page, { kind: /^Other OpenAI-compatible/, name: 'Stand-in cloud', base: `${AI_STAND_IN}/v1`, model: 'stand-in' });
    await expect(card(page, 'Stand-in cloud').getByText('Key found.')).toBeVisible();
    await expect(card(page, 'Stand-in cloud').getByText('Cloud', { exact: true })).toBeVisible();
    expect(settings().services[1]).toMatchObject({ id: 'stand-in-cloud', privatePages: true, acceptedAt: expect.any(String) });
    await card(page, 'Stand-in cloud').getByRole('button', { name: 'Test' }).click();
    await expect(state(page, 'Stand-in cloud')).toHaveText('Ready', { timeout: 30_000 });

    // Don't send private pages saves at once
    await card(page, 'Stand-in cloud').getByRole('switch', { name: "Don't send private pages" }).check();
    await expect.poll(() => settings().services[1].privatePages).toBe(false);

    // the writer through its Select
    await pick(page, writer(page).getByRole('combobox', { name: 'Service' }), /^Stand-in cloud/);
    await expect(card(page, 'Stand-in cloud').getByText('Writer', { exact: true })).toBeVisible();
    await expect(card(page, 'Ollama').getByText('Writer', { exact: true })).toHaveCount(0);
    expect(settings().writer).toBe('stand-in-cloud');

    // removing the writer makes the next service the writer
    page.once('dialog', (d) => void d.accept());
    await card(page, 'Stand-in cloud').getByRole('button', { name: 'Remove' }).click();
    await expect(card(page, 'Stand-in cloud')).toHaveCount(0);
    await expect(card(page, 'Ollama').getByText('Writer', { exact: true })).toBeVisible();
    expect(settings().writer).toBe('ollama');
  });

  test('keys: a cloud service without its key names the Credential Manager entry and sends nothing; no key reaches the page or the settings', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/_edit/ai/');
    // nothing accepted: refused, and said why
    const form = addForm(page);
    await form.getByRole('textbox', { name: 'Model' }).fill('gpt-test');
    await form.evaluate((f: HTMLFormElement) => f.querySelector<HTMLInputElement>('[name="accepted"]')!.removeAttribute('required'));
    await form.getByRole('button', { name: 'Add the service' }).click();
    await expect(form.getByText('Accept where your words go to add it.')).toBeVisible();

    await addCloud(page, { name: 'OpenAI', model: 'gpt-test' });
    const openai = card(page, 'OpenAI');
    await expect(state(page, 'OpenAI')).toHaveText('Key missing');
    await expect(openai.getByText('Add the key to Windows Credential Manager as atiya-ai-openai, then restart the site.')).toBeVisible();
    await expect(openai.getByText(/cmdkey \/generic:atiya-ai-openai .*ATIYA_AI_OPENAI_KEY/)).toBeVisible();
    await expect(openai.getByRole('link', { name: /^Read the disclaimer/ })).toHaveAttribute('href', /openai\.com/);
    await openai.getByRole('button', { name: 'Copy name' }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('atiya-ai-openai');

    // Test sends nothing without a key
    await openai.getByRole('button', { name: 'Test' }).click();
    await expect(openai.locator('[data-ai-last]')).toHaveText(/^Add its key, then restart the site\. Tested just now\.$/);
    await expect(state(page, 'OpenAI')).toHaveText('Key missing');

    // the disclaimer follows the kind; a service with its key in the environment: the page and the settings never hold it
    await pick(page, addForm(page).getByRole('combobox', { name: 'Kind' }), /^Other OpenAI-compatible/);
    await expect(addForm(page).locator('[data-ai-disclaimer]')).toHaveText(/^Runs wherever its address points, under its own terms\. Private pages are sent too/);
    await addCloud(page, { name: 'Stand-in cloud', base: `${AI_STAND_IN}/v1`, model: 'stand-in' });
    expect(await page.content()).not.toContain('not-a-real-key');
    expect(readFileSync(join(FIXTURE, '.atiya', 'ai.json'), 'utf8')).not.toContain('not-a-real-key');
  });

  test('a failed test says what went wrong: key refused, out of credit, busy, and a model that cannot follow the shape', async ({ page }) => {
    await page.goto('/_edit/ai/');
    const ollama = card(page, 'Ollama');
    for (const [model, label, words] of [
      ['key-refused', 'Key refused', /key/i],
      ['no-credit', 'Out of credit', /credit/i],
      ['busy', 'Busy', /busy/i],
      ['no-shape', "Can't follow the shape", /didn't return the shape edit mode needs/],
    ] as const) {
      await pick(page, ollama.getByRole('combobox', { name: 'Model' }), model);
      await expect.poll(() => settings().services[0].model).toBe(model);
      // a new model hasn't been tested
      await expect(state(page, 'Ollama')).toHaveText('Untested');
      await ollama.getByRole('button', { name: 'Test' }).click();
      await expect(state(page, 'Ollama')).toHaveText(label, { timeout: 30_000 });
      await expect(ollama.locator('[data-ai-last]')).toHaveText(words);
      expect(settings().services[0].lastTest).toMatchObject({ ok: false });
    }
  });

  test('axe in light and dark, with a card in each state and Found on this computer', async ({ page }) => {
    await page.goto('/_edit/ai/');
    await addCloud(page, { name: 'OpenAI', model: 'gpt-test' });
    for (const scheme of ['dark', 'light'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/_edit/ai/');
      await expect(card(page, 'OpenAI')).toBeVisible();
      const r = await new AxeBuilder({ page }).include('main').analyze();
      expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${scheme}: ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    }
  });
});
