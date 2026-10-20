// @ts-check
/** AI services' keys in Atiya Studio: stage S6's Definition of Done (documentation/editor/ai-plan.md §2.6). */
import { expect, test } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startFakeGitHub } from '../src/core/setup/fake-github.mjs';
import { launchSetup, pageMatching, quitGracefully } from './launch.mjs';

const fake = () => startFakeGitHub({ root: join(mkdtempSync(join(tmpdir(), 'atiya-e2e-ai-')), 'remotes'), buildMs: 800, deviceApproveAfterMs: 300, deviceInterval: 0 });
const AI = 'http://localhost:4381/_edit/ai/';

/** Makes a site through the first run and waits for edit mode. @param {import('@playwright/test').ElectronApplication} app */
async function makeSite(app) {
  const welcome = await pageMatching(app, /welcome\.html/);
  await welcome.getByRole('button', { name: 'Make my site' }).click();
  const setup = await pageMatching(app, /setup\.html/);
  await setup.getByRole('button', { name: 'Continue with GitHub' }).click();
  await setup.getByRole('button', { name: 'Create my site' }).click({ timeout: 20_000 });
  return pageMatching(app, /localhost:4381\/_edit\//, 30_000);
}

/** Every file under a folder (its git objects aside) that holds the text. @param {string} dir @param {string} text @returns {string[]} */
function filesHolding(dir, text) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const at = join(dir, d.name);
    if (d.isDirectory()) return d.name === '.git' ? [] : filesHolding(at, text);
    return readFileSync(at).includes(text) ? [at] : [];
  });
}

test.describe('desktop: AI keys', () => {
  test('S6 the key dialog keeps a key the running site uses at once and after a restart, never in edit mode or the site, and Remove deletes it', async () => {
    const gh = await fake();
    const KEY = `sk-e2e-${randomBytes(12).toString('hex')}`;
    const env = { STUB_AI_EXPECT: KEY };
    const first = await launchSetup({ fakeUrl: gh.url, env });
    const store = join(first.root, 'data', 'ai-keys.json');
    try {
      const body = await makeSite(first.app);
      await body.goto(AI);
      // everything edit mode's page sends and hears
      /** @type {Promise<string>[]} */
      const seen = [];
      body.on('request', (r) => seen.push(Promise.resolve(`${r.url()} ${r.postData() ?? ''}`)));
      body.on('response', (r) => seen.push(r.text().catch(() => '')));
      const frame = await pageMatching(first.app, /frame\.html/);
      const result = body.locator('#ai-result');
      await body.locator('#ai-test').click();
      await expect(result).toHaveText('key-missing');

      // the app's own dialog, over edit mode; Cancel (Escape) saves nothing
      await body.locator('#ai-enter').click();
      const dialog = frame.getByRole('dialog', { name: "OpenAI's key" });
      await expect(dialog).toBeVisible();
      const field = dialog.getByRole('textbox', { name: "OpenAI's key" });
      await expect(field).toBeFocused();
      await expect(dialog).toContainText('Kept encrypted on this computer by Atiya Studio.');
      await field.fill(KEY);
      await frame.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(result).toHaveText('not saved');

      // what isn't a key is refused, and the dialog stays; Enter saves
      await body.locator('#ai-enter').click();
      await expect(field).toHaveValue('');
      await field.fill('not a key');
      await dialog.getByRole('button', { name: 'Save key' }).click();
      await expect(dialog.getByRole('alert')).toHaveText("That isn't a key. Paste it again, without spaces.");
      await expect(field).toHaveAttribute('aria-invalid', 'true');
      await field.fill(KEY);
      await field.press('Enter');
      await expect(dialog).toBeHidden();
      await expect(result).toHaveText('saved');
      // the field doesn't keep it
      await expect(frame.locator('#keys-input')).toHaveValue('');

      // S6.1: the running site uses it, with no restart
      await body.locator('#ai-test').click();
      await expect(result).toHaveText('works');

      // S6.2: never in edit mode's page, what it sent or heard, or the site's folder; kept encrypted
      expect(await body.content()).not.toContain(KEY);
      expect((await Promise.all(seen)).join('\n')).not.toContain(KEY);
      expect(filesHolding(join(first.root, 'home', 'Atiya', 'ada.github.io'), KEY)).toEqual([]);
      const kept = readFileSync(store, 'utf8');
      expect(kept).not.toContain(KEY);
      expect(Object.values(JSON.parse(kept).sites).map((s) => Object.keys(/** @type {object} */ (s)))).toEqual([['openai']]);
    } finally {
      await quitGracefully(first.app);
    }

    // S6.1 after a restart: the site's server starts with it
    const again = await launchSetup({ fakeUrl: gh.url, root: first.root, env });
    try {
      const body = await pageMatching(again.app, /localhost:4381\/_edit\//, 30_000);
      await body.goto(AI);
      const result = body.locator('#ai-result');
      await body.locator('#ai-test').click();
      await expect(result).toHaveText('works');

      // S6.3: removing the service deletes its key, at once
      await body.locator('#ai-remove').click();
      await expect(result).toHaveText('removed');
      await body.locator('#ai-test').click();
      await expect(result).toHaveText('key-missing');
      expect(JSON.parse(readFileSync(store, 'utf8')).sites).toEqual({});
    } finally {
      await quitGracefully(again.app);
      await gh.close();
    }
  });
});
