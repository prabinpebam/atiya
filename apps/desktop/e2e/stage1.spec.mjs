// @ts-check
/** Stage 1's Definition of Done (documentation/desktop/plan.md): the owner's app, on a stand-in dev server. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isListening } from '../src/core/ports.mjs';
import { launch, pageMatching } from './launch.mjs';

/** @param {import('@playwright/test').ElectronApplication} app */
const quit = async (app) => {
  await app.evaluate(({ app: a }) => a.quit()).catch(() => {});
  await app.close().catch(() => {});
};

test.describe('desktop: developer workspace', () => {
  test('1.1 one window: the frame, and edit mode from the checkout\'s own dev server', async () => {
    const { app } = await launch();
    try {
      const frame = await pageMatching(app, /frame\.html/);
      const welcome = await pageMatching(app, /welcome\.html/);
      await welcome.getByRole('button', { name: 'Open this checkout' }).click();
      const editor = await pageMatching(app, /localhost:4391\/_edit\//);
      await expect(editor.locator('h1')).toHaveText('Edit mode (stand-in)');
      await expect(frame.locator('#site-name')).toHaveText('Test Site');
      await expect(frame.locator('#state')).toHaveText('Edit mode ready');
      await frame.getByRole('button', { name: 'Site' }).click();
      await expect.poll(() => editor.url()).toBe('http://localhost:4391/');
      await expect(frame.getByRole('button', { name: 'Site' })).toHaveAttribute('aria-pressed', 'true');
      expect(await app.evaluate(({ BaseWindow }) => BaseWindow.getAllWindows().length)).toBe(1);
    } finally {
      await quit(app);
    }
  });

  test('1.2 the checkout is remembered; a folder that isn\'t one is refused with why', async () => {
    const first = await launch();
    const welcome = await pageMatching(first.app, /welcome\.html/);
    await welcome.getByRole('button', { name: 'Open this checkout' }).click();
    await pageMatching(first.app, /_edit\//);
    await quit(first.app);

    const again = await launch({ root: first.root });
    try {
      const editor = await pageMatching(again.app, /localhost:4391\/_edit\//);
      await expect(editor.locator('h1')).toHaveText('Edit mode (stand-in)');
    } finally {
      await quit(again.app);
    }

    const other = mkdtempSync(join(tmpdir(), 'atiya-not-'));
    mkdirSync(other, { recursive: true });
    writeFileSync(join(other, 'package.json'), JSON.stringify({ name: 'something-else' }));
    const refused = await launch({ suggest: other });
    try {
      const welcome = await pageMatching(refused.app, /welcome\.html/);
      // a newcomer's welcome says nothing of it; the developer's page (File, Open a source folder) says why
      await expect(welcome.getByRole('button', { name: 'Open this checkout' })).toBeHidden();
      await welcome.evaluate(() => /** @type {any} */ (window).atiya.show('source'));
      const w = await pageMatching(refused.app, /source\.html/);
      await expect(w.locator('#suggested-reason')).toHaveText(/another project/);
      await expect(w.getByRole('button', { name: 'Open this checkout' })).toBeHidden();
      const r = await w.evaluate((dir) => /** @type {any} */ (window).atiya.openWorkspace(dir), other);
      expect(r).toMatchObject({ ok: false, reason: expect.stringContaining('another project') });
    } finally {
      await quit(refused.app);
    }
  });

  test('1.3 closing the window keeps the server; quitting stops it and frees the port', async () => {
    const { app, port } = await launch({ port: 4393 });
    const welcome = await pageMatching(app, /welcome\.html/);
    await welcome.getByRole('button', { name: 'Open this checkout' }).click();
    await pageMatching(app, /_edit\//);
    await app.evaluate(({ BaseWindow }) => BaseWindow.getAllWindows()[0].close());
    await expect.poll(() => app.evaluate(({ BaseWindow }) => BaseWindow.getAllWindows()[0].isVisible())).toBe(false);
    expect(await isListening(port)).toBe(true);
    const closed = app.waitForEvent('close');
    await app.evaluate(({ app: a }) => a.quit());
    await closed;
    await expect.poll(() => isListening(port), { timeout: 10_000 }).toBe(false);
  });

  test('1.4 a server that stops is restarted after 1, 2 then 4 seconds, then the app says why, with the log', async () => {
    const { app } = await launch({ port: 4394, stubMode: 'exit-after-ready' });
    try {
      const frame = await pageMatching(app, /frame\.html/);
      const welcome = await pageMatching(app, /welcome\.html/);
      await welcome.getByRole('button', { name: 'Open this checkout' }).click();
      await expect(frame.locator('#state')).toHaveText('Restarting edit mode…', { timeout: 15_000 });
      const page = await pageMatching(app, /server\.html|_edit\//);
      await expect.poll(() => page.url(), { timeout: 30_000 }).toMatch(/server\.html/);
      await expect(page.locator('h1')).toHaveText('Edit mode stopped', { timeout: 30_000 });
      await expect(page.locator('#message')).toHaveText(/restarting it didn't help/, { timeout: 30_000 });
      await expect(page.getByRole('button', { name: 'Restart' })).toBeVisible();
      await expect(page.locator('#log')).toContainText('stand-in: listening');
      await expect(page.locator('#log-box')).toHaveAttribute('open', '');
    } finally {
      await quit(app);
    }
  });

  test('1.5 a taken port is named, and Use it opens edit mode on that server', async () => {
    const blocker = createServer((req, res) => res.end(`<!doctype html><title>t</title><h1>Already running ${req.url}</h1>`));
    await new Promise((r) => blocker.listen(4395, 'localhost', () => r(null)));
    const { app } = await launch({ port: 4395 });
    try {
      const welcome = await pageMatching(app, /welcome\.html/);
      await welcome.getByRole('button', { name: 'Open this checkout' }).click();
      const page = await pageMatching(app, /server\.html/);
      await expect(page.locator('h1')).toHaveText('Port 4395 is in use');
      await expect(page.locator('#message')).toContainText('(process ');
      await page.getByRole('button', { name: 'Use it' }).click();
      await expect.poll(() => page.url()).toBe('http://localhost:4395/_edit/');
      await expect(page.locator('h1')).toHaveText('Already running /_edit/');
    } finally {
      await quit(app);
      blocker.close();
    }
  });

  test('1.6 views have no Node and no bridge on the dev server; outside links open in the browser', async () => {
    const { app, externals } = await launch({ port: 4396 });
    try {
      const frame = await pageMatching(app, /frame\.html/);
      expect(await frame.evaluate(() => [typeof (/** @type {any} */ (window).require), typeof (/** @type {any} */ (window).process)])).toEqual(['undefined', 'undefined']);
      const welcome = await pageMatching(app, /welcome\.html/);
      await welcome.getByRole('button', { name: 'Open this checkout' }).click();
      const editor = await pageMatching(app, /_edit\//);
      await expect(editor.locator('h1')).toHaveText('Edit mode (stand-in)');
      expect(await editor.evaluate(() => [typeof (/** @type {any} */ (window).require), typeof (/** @type {any} */ (window).atiya)])).toEqual(['undefined', 'undefined']);
      // the app stops this navigation, so click from inside the page (Playwright would wait for it)
      await editor.evaluate(() => document.getElementById('out')?.click());
      await expect.poll(externals).toContain('https://example.com/');
      expect(editor.url()).toBe('http://localhost:4396/_edit/');
      await editor.evaluate(() => document.getElementById('in')?.click());
      await expect.poll(() => editor.url()).toBe('http://localhost:4396/');
    } finally {
      await quit(app);
    }
  });

  test('1.7 the frame, the welcome and the server page pass axe in light and dark, and work by keyboard', async () => {
    const { app } = await launch({ port: 4397, stubMode: 'never-listen' });
    try {
      const frame = await pageMatching(app, /frame\.html/);
      const welcome = await pageMatching(app, /welcome\.html/);
      for (const scheme of /** @type {const} */ (['light', 'dark'])) {
        for (const p of [frame, welcome]) {
          await p.emulateMedia({ colorScheme: scheme });
          // the frame is window chrome in a view of its own, like a browser's toolbar: it has no main content to mark
          const axe = new AxeBuilder({ page: p }).setLegacyMode(true);
          const r = await (p === frame ? axe.disableRules(['landmark-one-main']) : axe).analyze();
          expect(r.violations.map((v) => `${scheme} ${p.url()}: ${v.id}`)).toEqual([]);
        }
      }
      await expect(welcome.getByRole('button', { name: 'Make my site' })).toBeFocused();
      await welcome.keyboard.press('Tab');
      await welcome.keyboard.press('Tab');
      await expect(welcome.getByRole('button', { name: 'Open this checkout' })).toBeFocused();
      await welcome.keyboard.press('Enter');
      const page = await pageMatching(app, /server\.html/);
      await expect(page.locator('h1')).toHaveText('Edit mode stopped', { timeout: 30_000 });
      for (const scheme of /** @type {const} */ (['light', 'dark'])) {
        await page.emulateMedia({ colorScheme: scheme });
        const r = await new AxeBuilder({ page }).setLegacyMode(true).analyze();
        expect(r.violations.map((v) => `${scheme} server: ${v.id}`)).toEqual([]);
      }
    } finally {
      await quit(app);
    }
  });
});
