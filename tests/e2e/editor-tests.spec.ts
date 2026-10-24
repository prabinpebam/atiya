/**
 * Edit mode's Tests screen (documentation/editor/test-runs.md §8): a run folder written here is shown as it
 * would be live: its health and reason, a failure pinned with its verdict, the tree that follows the running
 * test, a test's live steps with their clocks, and the top bar's status on another screen. The run's
 * heartbeat is kept fresh by the test, then stopped, so the screen must say it has gone quiet.
 */
import { expect, test } from '@playwright/test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ID = `zz-fixture-${Date.now().toString(36)}`;
const DIR = join(process.cwd(), '.test-runs', ID);
const write = (name: string, value: unknown) => writeFileSync(join(DIR, name), JSON.stringify(value));

const info = (id: string, title: string, group = 'crafting') => ({ id, project: 'chromium', file: 'tests/e2e/planet.spec.ts', path: [group, title], line: 10, timeout: 300_000, retries: 0 });

function state(now: number, beat = now) {
  return {
    v: 1,
    startedAt: now - 600_000,
    updatedAt: beat,
    beat,
    cpu: 72,
    phase: 'tests',
    tests: {
      a: { ...info('a', 'the table: its own prompt'), status: 'passed', start: now - 500_000, end: now - 450_000, duration: 50_000, retry: 0, steps: [], out: [] },
      b: { ...info('b', 'the swing: pick jute and build it'), status: 'timedOut', start: now - 440_000, end: now - 140_000, duration: 300_000, retry: 0, error: { message: 'Test timeout of 300000ms exceeded.', snippet: '> 1844 | const craft = …' }, steps: [{ title: 'page.evaluate', category: 'pw:api', start: now - 400_000, end: now - 140_000, count: 1, children: [] }], out: [] },
      c: { ...info('c', 'the viewing deck: three builds up the cliff'), status: 'running', start: now - 200_000, retry: 0, steps: [{ title: 'build the deck', category: 'test.step', start: now - 190_000, count: 1, children: [{ title: 'expect.poll', category: 'expect', start: now - 100_000, count: 37, children: [] }] }], out: [] },
      d: { ...info('d', 'the plaza at night', 'planet'), status: 'queued', retry: 0, steps: [], out: [] },
    },
    order: ['a', 'b', 'c', 'd'],
    errors: [],
  };
}

test.describe('editor: the Tests screen', () => {
  test.beforeAll(() => {
    mkdirSync(DIR, { recursive: true });
    write('run.json', { id: ID, by: 'agent', purpose: 'Check the crafting tests', cwd: process.cwd(), branch: 'design-system-audit', commit: 'ff10aa1', startedAt: Date.now() - 600_000, pid: process.pid, launcher: true, servers: [{ port: 4329, reused: false }] });
    write('state.json', state(Date.now()));
  });
  test.afterAll(() => rmSync(DIR, { recursive: true, force: true }));

  test('shows a live run simply, then in detail on request, and says when it goes quiet', async ({ page }) => {
    // keep the run's heartbeat fresh while the screen is checked
    const beating = setInterval(() => write('state.json', state(Date.now())), 500);
    try {
      await page.goto(`/_edit/tests/?run=${ID}`);
      const runs = page.locator('[data-test-runs]');
      await expect(runs.locator('[data-t="label"]')).toHaveText('Slower than usual');
      await expect(runs.locator('[data-t="counts"]')).toHaveText('2 of 4 done');
      await expect(runs.locator('[data-t="failed"]')).toHaveText('1 failed');
      await expect(runs.locator('[data-t="who"]')).toContainText('Started by an agent');
      await expect(runs.locator('[data-t="who"]')).toContainText('“Check the crafting tests”');
      await expect(runs.locator('[data-t="who"]')).toContainText("your site on localhost:4321 isn't touched");
      // what it's doing now, with the step's own clock ticking
      const now = runs.locator('[data-t="now"]');
      await expect(now).toContainText('The planet › crafting › the viewing deck');
      await expect(now).toContainText('expect.poll (37 tries)');
      const first = await now.locator('strong').first().textContent();
      await expect.poll(() => now.locator('strong').first().textContent(), { timeout: 10_000 }).not.toBe(first);
      // the failure, pinned, with its verdict (no stable-tree run to compare with here)
      await expect(runs.locator('.fail')).toHaveCount(1);
      await expect(runs.locator('.fail-verdict')).toHaveText('Not compared: no run of it on the stable tree yet');
      // the tree followed the running test: its area, group and steps are open
      const tree = page.getByRole('tree', { name: 'Tests' });
      const deck = tree.getByRole('treeitem', { name: /the viewing deck/ });
      await expect(deck).toHaveAttribute('aria-expanded', 'true');
      await expect(deck.locator('.step-title')).toContainText(['build the deck', 'expect.poll']);
      // a closed test opens by keyboard, with its error
      const swing = tree.getByRole('treeitem', { name: /the swing/ });
      await swing.locator('.row').click();
      await expect(swing).toHaveAttribute('aria-expanded', 'true');
      await expect(swing.locator('.d-message')).toHaveText('Test timeout of 300000ms exceeded.');
      await page.keyboard.press('ArrowLeft');
      await expect(swing).toHaveAttribute('aria-expanded', 'false');
      // a filter shows only the failures
      await runs.getByRole('button', { name: 'Failed' }).click();
      await expect(deck).toBeHidden();
      await expect(swing).toBeVisible();
      // the top bar shows the newest active run (here, the run doing this test) on every screen
      await expect(page.locator('[data-test-status]')).toContainText('Tests:');
    } finally {
      clearInterval(beating);
    }
    // the heartbeat stops: within seconds the screen says the run has gone quiet, and its process is there
    await expect(page.locator('[data-test-runs] [data-t="label"]')).toHaveText('No word', { timeout: 12_000 });
    await expect(page.locator('[data-test-runs] [data-t="reason"]')).toContainText('its process is still running');
  });
});
