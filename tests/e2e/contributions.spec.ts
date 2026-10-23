import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { columnAt, contributionScene } from '../../src/site/scripts/contributionRules';
import type { GitHubSnapshot } from '../../src/site/content/github';

const snapshot = JSON.parse(readFileSync(new URL('../../content/github.json', import.meta.url), 'utf8')) as GitHubSnapshot;

test.describe('GitHub contribution hero', () => {
  test('shows the real public snapshot, not the planet image, with an accessible daily alternative', async ({ page }) => {
    await page.goto('/');
    const hero = page.locator('[data-contributions]');
    await expect(hero).toHaveAttribute('data-ready', '');
    await expect(hero).toHaveAttribute('data-mode', '3d');
    await expect(hero).toHaveAttribute('data-orientation', 'isometric');
    await expect(page.locator('h1')).toHaveText('Prabin Pebam');
    await expect(page.locator('main img[src*="/poster/landing-"]')).toHaveCount(0);
    const total = snapshot.days.reduce((n, d) => n + d.count, 0);
    await expect(hero.locator('.total')).toHaveText(total.toLocaleString('en'));
    await expect(hero.getByRole('link', { name: /View GitHub profile/ })).toHaveAttribute('href', `https://github.com/${snapshot.login}`);
    await expect(hero.locator('[data-icon="github"]')).toBeVisible();
    await expect(hero.getByText('Read daily activity', { exact: true })).toHaveCount(0);
    await expect(hero.locator('[data-contribution-selection]')).toHaveClass('sr-only');
    await expect(hero.locator('[data-contribution-status]')).toBeHidden();
    await expect(hero.locator('tbody tr')).toHaveCount(365);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? '')).map((v) => v.id)).toEqual([]);
  });

  test('switches 2D and 3D, glows on hover, exposes the exact day and supports keyboard exploration', async ({ page }) => {
    await page.goto('/');
    const hero = page.locator('[data-contributions]');
    await expect(hero).toHaveAttribute('data-ready', '');
    await hero.getByRole('button', { name: '2D', exact: true }).click();
    await expect(hero).toHaveAttribute('data-mode', '2d');
    await expect(hero.getByRole('button', { name: '2D', exact: true })).toHaveAttribute('aria-pressed', 'true');
    const canvas = hero.locator('canvas');
    const box = (await canvas.boundingBox())!;
    const scene = contributionScene(snapshot.days, box.width, box.height, '2d');
    const col = scene.columns.find((c) => snapshot.days[c.index].count > 0)!;
    const face = col.faces[0];
    const p = { x: face.reduce((s, p) => s + p.x, 0) / 4, y: face.reduce((s, p) => s + p.y, 0) / 4 };
    expect(columnAt(scene, p)).toBe(col.index);
    await page.mouse.move(box.x + p.x, box.y + p.y);
    await expect(hero).toHaveAttribute('data-active-date', snapshot.days[col.index].date);
    await expect(hero.getByRole('tooltip')).toBeVisible();
    await expect(hero.getByRole('tooltip').locator('strong')).toContainText(snapshot.days[col.index].count.toLocaleString('en'));
    await canvas.focus();
    await page.keyboard.press('Home');
    await expect(hero).toHaveAttribute('data-active-date', snapshot.days[0].date);
    await page.keyboard.press('ArrowRight');
    await expect(hero).toHaveAttribute('data-active-date', snapshot.days[7].date);
    await page.keyboard.press('End');
    await expect(hero).toHaveAttribute('data-active-date', snapshot.through);
    await hero.getByRole('button', { name: '3D', exact: true }).click();
    await expect(hero).toHaveAttribute('data-mode', '3d');
    const scene3d = contributionScene(snapshot.days, box.width, box.height, '3d');
    const visible = scene3d.columns.map((c) => {
      const face = c.faces.at(-1)!;
      return { index: c.index, point: { x: face.reduce((s, p) => s + p.x, 0) / 4, y: face.reduce((s, p) => s + p.y, 0) / 4 } };
    }).find((c) => snapshot.days[c.index].count > 0 && columnAt(scene3d, c.point) === c.index)!;
    const resting = await canvas.screenshot();
    const hoverBox = (await canvas.boundingBox())!;
    await page.mouse.move(hoverBox.x + visible.point.x, hoverBox.y + visible.point.y);
    await expect(hero).toHaveAttribute('data-active-date', snapshot.days[visible.index].date);
    expect((await canvas.screenshot()).equals(resting)).toBe(false);
    await expect(hero.getByRole('tooltip').locator('strong')).toContainText(snapshot.days[visible.index].count.toLocaleString('en'));
  });

  test('bounds the tumble and returns to exact isometric on release, including reduced motion', async ({ page }) => {
    await page.goto('/');
    const hero = page.locator('[data-contributions]');
    await expect(hero).toHaveAttribute('data-ready', '');
    const canvas = hero.locator('canvas');
    const box = (await canvas.boundingBox())!;
    for (const reducedMotion of ['no-preference', 'reduce'] as const) {
      await page.emulateMedia({ reducedMotion });
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width - 10, box.y + 10, { steps: 5 });
      await expect(hero).toHaveAttribute('data-orientation', 'tumbled');
      await page.mouse.up();
      await expect(hero).toHaveAttribute('data-orientation', 'isometric');
    }
  });

  test('follows light and dark and fits a phone without sideways scrolling', async ({ page }) => {
    await page.goto('/');
    const hero = page.locator('[data-contributions]');
    await expect(hero).toHaveAttribute('data-ready', '');
    const colour = () => hero.locator('[data-contribution-colour="4"]').evaluate((e) => getComputedStyle(e).color);
    await page.evaluate(() => document.documentElement.dataset.theme = 'light');
    const light = await colour();
    await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
    expect(await colour()).not.toBe(light);
    await page.setViewportSize({ width: 320, height: 740 });
    expect(await page.locator('html').evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
    await expect(hero.getByRole('button', { name: '2D', exact: true })).toBeVisible();
  });

  test('keeps the snapshot readable without JavaScript and makes no live GitHub data requests', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    const requests: string[] = [];
    page.on('request', (r) => { if (/github\.com|api\.github\.com/.test(r.url())) requests.push(r.url()); });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'A year on GitHub', exact: true })).toBeVisible();
    await expect(page.locator('[data-contributions] tbody tr')).toHaveCount(365);
    expect(requests).toEqual([]);
    await context.close();
  });

  test('supports touch tumble and day selection while keeping vertical page scrolling', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.goto('/');
    const hero = page.locator('[data-contributions]');
    await expect(hero).toHaveAttribute('data-ready', '');
    const canvas = hero.locator('canvas');
    await canvas.scrollIntoViewIfNeeded();
    const box = (await canvas.boundingBox())!;
    const cdp = await context.newCDPSession(page);
    const x = Math.round(box.x + box.width / 2), y = Math.round(box.y + box.height / 2);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 60, y }] });
    await expect(hero).toHaveAttribute('data-orientation', 'tumbled');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(hero).toHaveAttribute('data-orientation', 'isometric');
    const before = await page.evaluate(() => scrollY);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let d = 20; d <= 100; d += 20) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - d }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before);
    await hero.getByRole('button', { name: '2D', exact: true }).click();
    await canvas.scrollIntoViewIfNeeded();
    const flatBox = (await canvas.boundingBox())!;
    const scene = contributionScene(snapshot.days, flatBox.width, flatBox.height, '2d');
    const col = scene.columns[100];
    const point = { x: col.faces[0].reduce((s, p) => s + p.x, 0) / 4, y: col.faces[0].reduce((s, p) => s + p.y, 0) / 4 };
    await page.touchscreen.tap(flatBox.x + point.x, flatBox.y + point.y);
    await expect(hero).toHaveAttribute('data-active-date', snapshot.days[col.index].date);
    await expect(hero.getByRole('tooltip')).toBeVisible();
    await context.close();
  });
});
