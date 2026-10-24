/**
 * The Albums screen's list view (documentation/editor/list-and-details.md B8): choosing between the gallery's setup
 * and an album opens another page, but nothing above the list moves: the same heading and line, the list and the
 * details at the same place, and the details open with a heading either way. The editor project, on the fixture
 * server (port 4330, with the gallery fixture's `fixture-album`).
 *
 *   npx playwright test --project=editor -g "editor: albums: list"
 */
import { expect, test, type Page } from '@playwright/test';
import { reset } from '../../scripts/editor-test-server.mjs';

const top = async (page: Page, selector: string) => Math.round((await page.locator(selector).first().boundingBox())!.y);

async function layout(page: Page, details: string) {
  await expect(page.locator('main h1')).toBeVisible();
  return {
    heading: await page.locator('main h1').innerText(),
    line: await page.locator('.screen-head p').first().innerText(),
    head: await top(page, '.screen-head'),
    list: await top(page, '[data-album-list]'),
    details: await top(page, details),
  };
}

test.describe('editor: albums: list and details', () => {
  test.beforeEach(() => reset());

  test('the header stays put between the gallery and an album', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/_edit/albums/?view=list');
    const gallery = await layout(page, '#gallery-setup-title');
    expect(gallery.heading).toBe('Albums');

    await page.goto('/_edit/albums/fixture-album/');
    const album = await layout(page, '[data-album-words] h2');
    expect(album).toEqual(gallery);
  });

  test("typing the album's title renames its details' heading and the top bar's", async ({ page }) => {
    await page.goto('/_edit/albums/fixture-album/');
    await page.locator('[data-album-words]').getByLabel('Title', { exact: true }).fill('Harbour walks');
    await expect(page.locator('#album-words-title')).toHaveText('Harbour walks');
    await expect(page.locator('[data-title-line][data-album-heading]')).toHaveText('Harbour walks');
  });

  test('choosing items shows the selection bar with its count, and Clear selection hides it', async ({ page }) => {
    await page.goto('/_edit/albums/fixture-album/');
    const bar = page.getByRole('group', { name: 'Selected items' });
    await expect(bar).toBeHidden();
    const items = page.locator('[data-album-items] li[data-item]');
    await items.nth(0).click({ modifiers: ['Control'] });
    await items.nth(1).click({ modifiers: ['Control'] });
    await expect(bar).toBeVisible();
    await expect(bar.getByRole('status')).toHaveText('2 selected');
    await bar.getByRole('button', { name: 'Clear selection' }).click();
    await expect(bar).toBeHidden();
  });
});
