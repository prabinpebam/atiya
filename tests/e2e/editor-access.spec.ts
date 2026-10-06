/**
 * Edit mode's private pages (documentation/access/spec.md §8; benchmark QB10), on the editor's fixture
 * server: a throwaway copy of content/ whose private-pages/ is a submodule of the made-up fixtures, each with
 * its own bare remote, never the real ones. Private pages are listed with the rest (Pages, Sections, Media),
 * each tagged Private and filterable; a page is made private in its own settings and shared from its Share
 * dialog; the Access screen lists every code and link by state beside the chosen one's details, where each
 * is made, changed, withdrawn and deleted. The existing Publish sends the private commit first, then the
 * public one with the pointer, never with your words when anything private changed; a refused private push
 * is pushed again.
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
const overlay = () => JSON.parse(readFileSync(join(PRIVATE, 'structures/overlay.json'), 'utf8')) as { sections: { section: string; order?: string[]; pages: { id: string; token: string; item: { id: string } }[] }[] };
const confirmAll = (page: Page) => page.on('dialog', (d) => d.accept());
const choose = async (page: Page, scope: Pick<Page, 'getByRole'>, name: string, option: RegExp) => {
  await scope.getByRole('combobox', { name }).click();
  await page.getByRole('option', { name: option }).click();
};

test.describe('editor: private pages', () => {
  test.beforeEach(() => reset());
  test.afterAll(() => reset());

  test('the Access screen lists every code and link by state beside the chosen one, and makes, changes, withdraws and deletes them', async ({ page }) => {
    // sharing left Settings for its own screen
    await page.goto('/_edit/settings/');
    await expect(page.locator('[data-access-new]')).toHaveCount(0);
    await page.locator('nav').getByRole('link', { name: 'Access', exact: true }).click();
    await expect(page).toHaveURL(/\/_edit\/access\/$/);
    const list = page.getByRole('navigation', { name: 'Access codes and magic links' });
    const detail = page.locator('[data-region="access-detail"]');
    const items = list.locator('[data-access-item]:visible');
    // grouped by state (the fixtures have working, expired and withdrawn ones), and the first one shown
    for (const group of [/^Active/, /^Expired/, /^Withdrawn/]) await expect(list.getByRole('heading', { name: group })).toBeVisible();
    await expect(list.locator('[aria-current="true"]')).toHaveCount(1);
    await expect(detail.getByRole('heading', { level: 2 })).toHaveText((await list.locator('[aria-current="true"] .name').textContent()) ?? '');
    // Find and Show narrow the list
    const all = await items.count();
    await list.getByLabel('Find someone').fill('expired');
    await expect(items).toHaveCount(1);
    await list.getByLabel('Find someone').fill('');
    await choose(page, list, 'Show', /^Withdrawn$/);
    await expect(items).toHaveCount(1);
    await choose(page, list, 'Show', /^Every state$/);
    await expect(items).toHaveCount(all);
    // choosing one shows it beside the list, in the address too
    await list.locator('[data-access-item="gfixlink2"] a').click();
    await expect(page).toHaveURL(/grant=gfixlink2$/);
    await expect(detail.getByRole('heading', { level: 2 })).toHaveText('Fixture Reader Link');
    await expect(detail.locator('[data-grant-text="secret"]')).toHaveText(/#a=gfixlink2\./);

    // a new access code: who it's for, and every private page in a section, found by name
    await list.getByRole('link', { name: 'Share with someone' }).click();
    await expect(page).toHaveURL(/grant=new$/);
    await expect(detail.getByRole('heading', { level: 2, name: 'Share with someone' })).toBeVisible();
    await detail.getByLabel('Their name').fill('Jane Doe');
    await detail.getByLabel('Organisation').fill('Contoso');
    await detail.getByLabel(/Why you.re sharing it/).fill('Design manager role');
    await detail.getByLabel('Find a section or page').fill('side');
    await expect(detail.locator('[data-scope-group="writing"]')).toBeHidden();
    await detail.locator('[data-scope-section="side-projects"]').click();
    await expect(detail.locator('[data-scope-line]')).toHaveText('Opens every private page in Side projects');
    await detail.getByRole('button', { name: 'Share it' }).click();
    await expect(detail.getByRole('heading', { level: 2, name: 'Jane Doe' })).toBeVisible();
    await expect(detail.locator('[data-grant-text="message"]')).toHaveText(/^Hi Jane, here is access .*\/sign-in\/ and sign in with this access code: [a-z]+(-[a-z]+){4}\. It works until /);
    const jane = grants().at(-1)!;
    expect(jane).toMatchObject({ kind: 'code', recipient: { name: 'Jane Doe', organisation: 'Contoso' }, scope: { sections: ['side-projects'] } });
    await expect(page).toHaveURL(new RegExp(`grant=${jane.id}$`));
    await expect(list.locator('[aria-current="true"]')).toContainText('Jane Doe');

    // a section covers its pages: checked, and they can't be changed on their own
    await expect(detail.locator('[data-scope-page="fx-private-alpha"] input')).toBeChecked();
    await expect(detail.locator('[data-scope-page="fx-private-alpha"] input')).toBeDisabled();
    // who it's for, a single page more and its last day, in one save
    await detail.getByLabel('Role').fill('Design manager');
    await detail.locator('[data-scope-page="fx-private-one"] label').click();
    await detail.getByLabel('Last day it works').fill('2027-03-31');
    await detail.getByRole('button', { name: 'Save changes' }).click();
    await expect.poll(() => grants().find((g) => g.id === jane.id)).toMatchObject({ recipient: { role: 'Design manager' }, scope: { sections: ['side-projects'], pages: ['fx-private-one'] } });
    expect(grants().find((g) => g.id === jane.id)?.expiresAt).toMatch(/^2027-03-31T/);
    await expect(detail.locator('[data-scope-line]')).toHaveText('Opens every private page in Side projects, and Fixture private one: velvet compass memo');

    // a magic link to one page: its address is the page's own, in its section
    await list.getByRole('link', { name: 'Share with someone' }).click();
    await expect(detail.getByRole('heading', { level: 2, name: 'Share with someone' })).toBeVisible();
    await detail.locator('label', { hasText: 'Magic link' }).first().click();
    await detail.getByLabel('Their name').fill('Sam Lee');
    await detail.locator('[data-scope-page="fx-private-two"] label').click();
    await detail.getByRole('button', { name: 'Share it' }).click();
    await expect(detail.locator('[data-grant-text="secret"]')).toHaveText(/\/writing\/privtwo333\/#a=g[a-z2-7]{8}\.[\w-]{43}$/);
    expect(grants().at(-1)).toMatchObject({ kind: 'link', recipient: { name: 'Sam Lee' }, scope: { pages: ['fx-private-two'] } });

    // withdrawn: it keeps its record, in its own group; then deleted, it goes
    await list.locator(`[data-access-item="${jane.id}"] a`).click();
    await expect(detail.getByRole('heading', { level: 2 })).toHaveText('Jane Doe');
    await detail.locator('[data-dialog-open="grant-withdraw"]').click();
    await page.locator('#grant-withdraw').getByRole('button', { name: 'Withdraw now' }).click();
    await expect(detail.getByText(/^Withdrawn on /)).toBeVisible();
    expect(grants().find((g) => g.id === jane.id)?.revokedAt).toBeTruthy();
    await expect(list.locator('[data-access-group="withdrawn"]')).toContainText('Jane Doe');
    await detail.locator('[data-dialog-open="grant-delete"]').click();
    await page.locator('#grant-delete').getByRole('button', { name: 'Delete' }).click();
    await expect.poll(() => grants().some((g) => g.id === jane.id)).toBe(false);
    await expect(list).not.toContainText('Jane Doe');
    await expect(list.locator('[aria-current="true"]')).toHaveCount(1);
  });

  test('private pages are listed with the rest: Pages filters them, Sections orders them among open ones, Media tags them', async ({ page }) => {
    // Pages: every page in one table, the private ones tagged, and a filter
    await page.goto('/_edit/articles/');
    const rows = page.locator('[data-editor-articles] [data-row]:visible');
    const all = await rows.count();
    const alpha = page.locator('tr', { hasText: 'Fixture private alpha' });
    await expect(alpha).toContainText('Private');
    await expect(alpha).toContainText('Side projects');
    await expect(page.locator('tr', { hasText: 'Fixture private one' })).toContainText('Writing');
    await choose(page, page.locator('[data-editor-articles]'), 'Who can see it', /^Private$/);
    await expect(rows).toHaveCount(6);
    await choose(page, page.locator('[data-editor-articles]'), 'Who can see it', /^Everyone$/);
    await expect(rows).toHaveCount(all - 6);

    // Sections: a section's open and private pages in one order; a private page moves with the keys
    await page.goto('/_edit/sections/?section=side-projects');
    const list = page.locator('[data-manager-list="side-projects"] [data-manager-row]');
    const ids = () => list.evaluateAll((els) => els.map((e) => e.getAttribute('data-manager-row')));
    expect((await ids()).slice(0, 6)).toEqual(['atiya', 'fx-private-alpha', 'watai', 'fx-private-beta', 'story', 'fx-private-gamma']);
    await expect(page.locator('[data-manager-row="fx-private-alpha"]')).toContainText('Private');
    await page.locator('[data-manager-grip="fx-private-alpha"]').focus();
    await page.keyboard.press('Alt+ArrowDown');
    await expect.poll(() => overlay().sections.find((s) => s.section === 'side-projects')?.order?.slice(0, 3)).toEqual(['atiya', 'watai', 'fx-private-alpha']);
    await expect(page.locator('[data-manager-grip="fx-private-alpha"]')).toBeFocused({ timeout: 15_000 });

    // Media: a private page's picture in the library, tagged, filtered, and its details saved where it lives
    await page.goto('/_edit/media/');
    const card = page.locator('[data-media-card="articles/fx-private-alpha/harbour"]');
    await expect(card).toContainText('Private');
    await choose(page, page.locator('[data-editor-media-grid]'), 'Who can see it', /^Private$/);
    // the fixtures' private media: a picture (with its dark version) and a video
    await expect(page.locator('[data-media-card]:visible')).toHaveCount(2);
    await card.locator('button').click();
    const details = page.locator('[data-editor-media-form]');
    await expect(page.locator('[data-editor-media-details]')).toContainText('Private');
    await details.getByLabel('Caption').fill('A private caption.');
    await details.getByRole('button', { name: 'Save the details' }).click();
    await expect.poll(() => (JSON.parse(readFileSync(join(PRIVATE, 'media/articles/fx-private-alpha/harbour.json'), 'utf8')) as { caption?: string }).caption).toBe('A private caption.');
    expect(existsSync(join(FIXTURE, 'content/media/articles/fx-private-alpha/harbour.json'))).toBe(false);
  });

  test('makes a page private in its place from its settings, then the existing Publish sends the private commit first and keeps your words out of public history (QB10)', async ({ page }) => {
    confirmAll(page);
    await page.goto('/_edit/sections/?section=side-projects');
    const ids = () => page.locator('[data-manager-list="side-projects"] [data-manager-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-manager-row')));
    const before = await ids();
    await page.goto('/_edit/articles/watai/');
    await page.getByRole('tab', { name: 'Page' }).click();
    await choose(page, page, 'Who can see it', /^Private/);
    await expect(page.locator('header').getByText('Private', { exact: true })).toBeVisible({ timeout: 15_000 });
    expect(existsSync(join(PRIVATE, 'articles/watai.json'))).toBe(true);
    expect(existsSync(join(FIXTURE, 'content/articles/watai.json'))).toBe(false);
    await page.goto('/_edit/sections/?section=side-projects');
    expect(await ids()).toEqual(before);
    await expect(page.locator('[data-manager-row="watai"]')).toContainText('Private');

    // the top bar's Publish counts the changes in both folders
    await expect(page.locator('[data-region="editor-pending"]')).toContainText(/changes? to publish/);
    await page.goto('/_edit/publish/');
    await expect(page.getByText(/this message goes on the private commit only/)).toBeVisible();
    await page.getByLabel('Message').fill('Make Watai private for the Contoso panel');
    await page.getByRole('button', { name: 'Publish', exact: true }).last().click();
    await expect(page.getByRole('heading', { name: 'Published' })).toBeVisible({ timeout: 30_000 });
    // the private repository has your words; the public one doesn't, and points at the private commit
    expect(remoteLog(PRIVATE_REMOTE)).toBe('Make Watai private for the Contoso panel');
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

    await page.goto('/_edit/access/?grant=new');
    const detail = page.locator('[data-region="access-detail"]');
    await detail.getByLabel('Their name').fill('Ana Ruiz');
    await detail.locator('[data-scope-section="work"]').click();
    await detail.getByRole('button', { name: 'Share it' }).click();
    await expect(detail.locator('[data-grant-text="message"]')).toHaveText(/Hi Ana/);
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

  test('a new article is private from the start, shared from its own settings with a magic link, then made public and private again', async ({ page }) => {
    confirmAll(page);
    await page.goto('/_edit/articles/');
    await page.locator('[data-dialog-open="new-article"]').click();
    const dialog = page.locator('#new-article');
    await dialog.getByLabel('Title').fill('A private case study');
    await dialog.getByLabel('Summary').fill('For invited readers only.');
    await choose(page, dialog, 'Section', /^Work/);
    await choose(page, dialog, 'Who can see it', /^Private/);
    await dialog.getByRole('button', { name: 'Create the draft' }).click();
    await expect(page).toHaveURL(/\/_edit\/articles\/a-private-case-study\/$/);
    const ready = () => expect(page.frameLocator('[data-editor-frame]').locator('h1')).toHaveText('A private case study', { timeout: 30_000 });
    await ready();
    const file = 'articles/a-private-case-study.json';
    expect(existsSync(join(PRIVATE, file))).toBe(true);
    expect(existsSync(join(FIXTURE, 'content', file))).toBe(false);
    const tag = () => page.locator('header').getByText('Private', { exact: true });
    await expect(tag()).toBeVisible();
    const token = () => overlay().sections.find((s) => s.section === 'work')!.pages.find((p) => p.item.id === 'a-private-case-study')?.token;
    expect(token()).toMatch(/^[a-z2-7]{10}$/);

    // shared from its settings: a magic link to this page
    await page.getByRole('tab', { name: 'Page' }).click();
    await page.getByRole('button', { name: 'Share', exact: true }).click();
    const share = page.locator('#share-page');
    // already open to a grant that covers every private page in Work, now and later
    await expect(share.locator('[data-grant]', { hasText: 'Fixture Reader All' })).toBeVisible();
    await share.locator('label', { hasText: 'Magic link' }).first().click();
    await share.getByLabel('Their name').fill('Lee Park');
    await share.getByRole('button', { name: 'Share it' }).click();
    await expect(share.locator('textarea[name="message"]')).toHaveValue(new RegExp(`/work/${token()}/#a=g[a-z2-7]{8}\\.[\\w-]{43}`));
    expect(grants().at(-1)).toMatchObject({ kind: 'link', recipient: { name: 'Lee Park' }, scope: { pages: ['a-private-case-study'] } });
    await expect(share.locator('[data-grant]', { hasText: 'Lee Park' })).toBeVisible();
    await page.keyboard.press('Escape');

    // public, from the page's settings: the file moves to content/, in Work, and the link's grant lets it go
    await page.getByRole('tab', { name: 'Page' }).click();
    await choose(page, page, 'Who can see it', /^Everyone/);
    await expect(tag()).toHaveCount(0, { timeout: 15_000 });
    await ready();
    expect(existsSync(join(FIXTURE, 'content', file))).toBe(true);
    expect(existsSync(join(PRIVATE, file))).toBe(false);
    expect(grants().find((g) => g.recipient.name === 'Lee Park')?.scope.pages ?? []).not.toContain('a-private-case-study');
    await page.getByRole('tab', { name: 'Page' }).click();
    await expect(page.getByRole('combobox', { name: 'Who can see it' })).toContainText('Everyone');
    await expect(page.getByRole('combobox', { name: 'Section' })).toContainText('Work');

    // private again: back into private-pages/, still in Work
    await choose(page, page, 'Who can see it', /^Private/);
    await expect(tag()).toBeVisible({ timeout: 15_000 });
    expect(existsSync(join(PRIVATE, file))).toBe(true);
    expect(existsSync(join(FIXTURE, 'content', file))).toBe(false);
    expect(token()).toMatch(/^[a-z2-7]{10}$/);
    await page.goto('/_edit/articles/');
    await expect(page.locator('tr', { hasText: 'A private case study' })).toContainText('Private');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`the Access screen and a private page's Share dialog have no serious axe findings, ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      const serious = async () => {
        const results = await new AxeBuilder({ page }).analyze();
        return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
      };
      await page.goto('/_edit/access/');
      await expect(page.getByRole('navigation', { name: 'Access codes and magic links' })).toBeVisible();
      expect(await serious()).toEqual([]);
      await page.goto('/_edit/access/?grant=new');
      await expect(page.getByRole('heading', { level: 2, name: 'Share with someone' })).toBeVisible();
      expect(await serious()).toEqual([]);
      await page.goto('/_edit/articles/fx-private-alpha/');
      await page.getByRole('tab', { name: 'Page' }).click();
      await page.getByRole('button', { name: 'Share', exact: true }).click();
      await expect(page.locator('#share-page').getByRole('heading', { name: 'Who it’s shared with' })).toBeVisible();
      expect(await serious()).toEqual([]);
    });
  }
});