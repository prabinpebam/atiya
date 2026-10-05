/**
 * Edit mode's access (documentation/access/spec.md §8; benchmark QB10), on the editor's fixture server: a
 * throwaway copy of content/ whose private-pages/ is a submodule of the made-up fixtures, each with its own
 * bare remote, never the real ones. Codes and links are made and withdrawn; a page is locked in its place;
 * and the existing Publish sends the private commit first, then the public one with the pointer, never
 * with your words when anything private changed; a refused private push is pushed again.
 */
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FIXTURE, PRIVATE, PRIVATE_REMOTE, REMOTE, reset } from '../../scripts/editor-test-server.mjs';

const remoteLog = (dir: string, format = '%s') => execFileSync('git', [`--git-dir=${dir}`, 'log', '-1', `--format=${format}`, 'main'], { encoding: 'utf8' }).trim();
const grants = () => (JSON.parse(readFileSync(join(PRIVATE, 'access.json'), 'utf8')) as { grants: { id: string; kind: string; recipient: { name: string }; revokedAt?: string; expiresAt?: string; scope: { sections?: string[]; pages?: string[] } }[] }).grants;
const confirmAll = (page: Page) => page.on('dialog', (d) => d.accept());

test.describe('editor: access', () => {
  test.beforeEach(() => reset());
  test.afterAll(() => reset());

  test('makes an access code and a magic link, each with a message to copy, and withdraws one', async ({ page }) => {
    confirmAll(page);
    await page.goto('/_edit/access/');
    const form = page.locator('[data-access-new]');
    await form.getByLabel('Their name').fill('Jane Doe');
    await form.getByLabel('Organisation').fill('Contoso');
    await form.getByLabel('Why you’re sharing it').or(form.getByLabel("Why you're sharing it")).fill('Design manager role');
    await form.locator('label', { hasText: 'Side projects' }).first().click();
    await form.getByRole('button', { name: 'Make it' }).click();
    const message = form.locator('textarea[name="message"]');
    await expect(message).toHaveValue(/^Hi Jane, here is access .*\/sign-in\/ and sign in with this access code: [a-z]+(-[a-z]+){4}\. It works until /);
    expect(grants().at(-1)).toMatchObject({ kind: 'code', recipient: { name: 'Jane Doe' } });
    await expect(page.locator('[data-region="access-grants"]')).toContainText('Jane Doe');

    await form.locator('label', { hasText: 'Magic link' }).first().click();
    await form.getByLabel('Their name').fill('Sam Lee');
    await form.locator('label', { hasText: 'Fixture private two' }).first().click();
    await form.getByRole('button', { name: 'Make it' }).click();
    await expect(message).toHaveValue(/\/p\/privtwo333\/#a=g[a-z2-7]{8}\.[\w-]{43}/);
    expect(grants().at(-1)).toMatchObject({ kind: 'link', recipient: { name: 'Sam Lee' } });

    const row = page.locator('[data-grant]', { hasText: 'Jane Doe' });
    // extend: a new last day
    await row.locator('input[type="date"]').fill('2027-03-31');
    await row.getByRole('button', { name: 'Set end date' }).click();
    await expect.poll(() => grants().find((g) => g.recipient.name === 'Jane Doe')?.expiresAt).toMatch(/^2027-03-31T/);
    // rescope: every locked page in Work as well
    const jane = page.locator('[data-grant]', { hasText: 'Jane Doe' });
    await jane.getByText('Change what it opens').click();
    await jane.locator('[data-access-scope] label', { hasText: 'Work' }).first().click();
    await jane.getByRole('button', { name: 'Save what it opens' }).click();
    await expect.poll(() => grants().find((g) => g.recipient.name === 'Jane Doe')?.scope.sections?.sort()).toEqual(['side-projects', 'work']);
    await page.locator('[data-grant]', { hasText: 'Jane Doe' }).getByRole('button', { name: 'Withdraw now' }).click();
    await expect(page.locator('[data-grant]', { hasText: 'Jane Doe' })).toContainText('Withdrawn');
    expect(grants().find((g) => g.recipient.name === 'Jane Doe')?.revokedAt).toBeTruthy();
  });

  test('locks a page in its place, then the existing Publish sends the private commit first and keeps your words out of public history (QB10)', async ({ page }) => {
    confirmAll(page);
    await page.goto('/_edit/access/');
    const section = page.locator('[data-access-section="side-projects"]');
    const order = async () => section.locator('[data-access-page]').evaluateAll((els) => els.map((e) => e.getAttribute('data-access-page')));
    const before = await order();
    await section.locator('[data-access-page="watai"]').getByRole('button', { name: 'Lock', exact: true }).click();
    await expect(section.locator('[data-access-page="watai"]')).toHaveAttribute('data-access', 'locked');
    expect(await order()).toEqual(before);
    expect(existsSync(join(PRIVATE, 'articles/watai.json'))).toBe(true);
    expect(existsSync(join(FIXTURE, 'content/articles/watai.json'))).toBe(false);

    // the top bar's Publish counts the changes in both folders
    await expect(page.locator('[data-region="editor-pending"]')).toContainText(/changes? to publish/);
    await page.goto('/_edit/publish/');
    await expect(page.getByText(/this message goes on the private commit only/)).toBeVisible();
    await page.getByLabel('Message').fill('Lock Watai for the Contoso panel');
    await page.getByRole('button', { name: 'Publish', exact: true }).last().click();
    await expect(page.getByRole('heading', { name: 'Published' })).toBeVisible({ timeout: 30_000 });
    // the private repository has your words; the public one doesn't, and points at the private commit
    expect(remoteLog(PRIVATE_REMOTE)).toBe('Lock Watai for the Contoso panel');
    const pub = remoteLog(REMOTE);
    expect(pub).toMatch(/Private pages: update$/);
    expect(pub).not.toMatch(/Contoso/);
    const pointer = execFileSync('git', [`--git-dir=${REMOTE}`, 'ls-tree', 'main', 'private-pages'], { encoding: 'utf8' }).split(/\s+/)[2];
    expect(pointer).toBe(remoteLog(PRIVATE_REMOTE, '%H'));
  });

  test('a refused private push holds back the public one, says why, and Push again sends both, re-pointed after a rebase', async ({ page }) => {
    confirmAll(page);
    // someone else pushed to the private repository first
    const other = join(tmpdir(), `editor-e2e-private-${Date.now()}`);
    execFileSync('git', ['clone', '-q', PRIVATE_REMOTE, other]);
    execFileSync('git', ['-c', 'user.name=O', '-c', 'user.email=o@localhost', 'commit', '-q', '--allow-empty', '-m', 'elsewhere'], { cwd: other });
    execFileSync('git', ['push', '-q'], { cwd: other });
    rmSync(other, { recursive: true, force: true });
    const publicBefore = remoteLog(REMOTE, '%H');

    await page.goto('/_edit/access/');
    await page.locator('[data-access-new]').getByLabel('Their name').fill('Ana Ruiz');
    await page.locator('[data-access-new] label', { hasText: 'Work' }).first().click();
    await page.locator('[data-access-new]').getByRole('button', { name: 'Make it' }).click();
    await expect(page.locator('textarea[name="message"]')).toHaveValue(/Hi Ana/);
    await page.goto('/_edit/publish/');
    await page.getByLabel('Message').fill('Access for Ana');
    await page.getByRole('button', { name: 'Publish', exact: true }).last().click();
    await expect(page.locator('[data-publish-push-issue]')).toContainText('the private pages: the remote has newer commits', { timeout: 30_000 });
    expect(remoteLog(REMOTE, '%H')).toBe(publicBefore);

    execFileSync('git', ['-c', 'user.name=O', '-c', 'user.email=o@localhost', 'pull', '-q', '--rebase'], { cwd: PRIVATE });
    await page.getByRole('button', { name: 'Push again' }).click();
    await expect(page.getByRole('heading', { name: 'Published' })).toBeVisible({ timeout: 30_000 });
    expect(remoteLog(PRIVATE_REMOTE)).toBe('Access for Ana');
    const pointer = execFileSync('git', [`--git-dir=${REMOTE}`, 'ls-tree', 'main', 'private-pages'], { encoding: 'utf8' }).split(/\s+/)[2];
    expect(pointer).toBe(remoteLog(PRIVATE_REMOTE, '%H'));
    expect(remoteLog(REMOTE)).not.toMatch(/Ana/);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`the Access screen has no serious axe findings, ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/_edit/access/');
      await expect(page.getByRole('heading', { name: 'Access codes and links' })).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    });
  }
});
