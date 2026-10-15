/**
 * Edit mode in Atiya Studio (documentation/desktop/spec.md §7.2, plan stage 7B): asked with the app's request header,
 * a screen comes without its own header row, describes that header to the app's bridge (here a stand-in that
 * records it), and carries out the row's commands. In a browser nothing changes.
 */
import { expect, test, type Page } from '@playwright/test';
import { reset } from '../../scripts/editor-test-server.mjs';

type Header = { context: Item[]; controls: Item[]; theme: string; busy: boolean };
type Item = { kind: string; id?: string; label?: string; text?: string; icon?: string; variant?: string; state?: string; value?: string; options?: { value: string }[] };

/** The app's view: its request header, and a bridge that keeps what's published and can send commands. */
async function asTheApp(page: Page) {
  await page.setExtraHTTPHeaders({ 'X-Atiya-Studio': '1' });
  await page.addInitScript(() => {
    const w = window as unknown as { atiyaStudio: unknown; __published: unknown[]; __send: (c: unknown) => void };
    w.__published = [];
    let listener: ((c: unknown) => void) | null = null;
    w.__send = (c) => listener?.(c);
    w.atiyaStudio = { publish: (h: unknown) => w.__published.push(h), onCommand: (cb: (c: unknown) => void) => ((listener = cb), () => (listener = null)) };
  });
}
const latest = (page: Page) => page.evaluate(() => (window as unknown as { __published: Header[] }).__published.at(-1) as Header);
const send = (page: Page, c: { id: string; action: 'click' | 'select'; value?: string }) => page.evaluate((cmd) => (window as unknown as { __send: (c: unknown) => void }).__send(cmd), c);
const find = (h: Header, f: (i: Item) => boolean) => [...h.context, ...h.controls].find(f);

test.describe('editor: in Atiya Studio', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(() => reset());
  test.afterAll(() => reset());

  test('a screen comes without its header row and describes it: the save status and Save to remote, not the theme (the app chooses it)', async ({ page }) => {
    await asTheApp(page);
    await page.goto('/_edit/');
    await expect(page.locator('[data-editor-app]')).toHaveAttribute('data-studio', '');
    await expect(page.locator('.top')).toBeHidden();
    await expect.poll(async () => (await latest(page))?.controls.length ?? 0).toBeGreaterThan(0);
    const h = await latest(page);
    expect(h.controls.some((i) => i.kind === 'status')).toBe(true);
    // the app chooses the theme for the whole app: edit mode's own switch isn't in the description
    expect(find(h, (i) => i.kind === 'select' && i.label === 'Colour theme')).toBeUndefined();
    const save = find(h, (i) => i.label === 'Save to remote');
    expect(save).toMatchObject({ kind: 'link', text: 'Save to remote', icon: expect.any(String) });
    // nothing in the description is markup
    expect(JSON.stringify(h)).not.toMatch(/<[a-z]/i);
    // the main column starts at the top: no row of its own
    expect((await page.locator('#main').boundingBox())?.y).toBeLessThan(2);

    // a press from the row: Save to remote goes where it goes
    await send(page, { id: save!.id!, action: 'click' });
    await expect(page).toHaveURL(/\/_edit\/publish\/$/);
  });

  test('an article describes its title and its tools, and the row presses them', async ({ page }) => {
    await asTheApp(page);
    await page.goto('/_edit/articles/');
    const first = page.locator('a[href*="/_edit/articles/"]').filter({ hasNotText: 'Pages' }).first();
    await page.goto((await first.getAttribute('href'))!);
    await expect.poll(async () => (await latest(page))?.context.length ?? 0).toBeGreaterThan(0);
    const h = await latest(page);
    expect(h.context.some((i) => i.kind === 'link' && i.label === 'Pages')).toBe(true);
    expect(h.context.some((i) => i.kind === 'tag')).toBe(true);
    // the device widths are one choice (a single button and its menu in the row), not three toggles
    for (const label of ['Desktop width', 'Tablet width', 'Phone width']) expect(find(h, (i) => i.label === label)).toBeUndefined();
    const widths = find(h, (i) => i.label === 'Preview width');
    expect(widths).toMatchObject({ kind: 'select', value: 'desktop' });
    expect(widths?.options?.map((o) => o.value)).toEqual(['desktop', 'tablet', 'phone']);
    await send(page, { id: widths!.id!, action: 'select', value: 'phone' });
    await expect(page.locator('[data-editor-device="phone"]')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => find(await latest(page), (i) => i.label === 'Preview width')?.value).toBe('phone');
    // what became of the last save to remote isn't in the row
    expect(JSON.stringify(await latest(page))).not.toContain('Saved to remote');
  });

  test('in a browser, edit mode keeps its own header', async ({ page }) => {
    await page.goto('/_edit/');
    await expect(page.locator('[data-editor-app]')).not.toHaveAttribute('data-studio', '');
    await expect(page.locator('.top')).toBeVisible();
    await expect(page.locator('[data-editor-theme-switch]')).toBeVisible();
  });
});
