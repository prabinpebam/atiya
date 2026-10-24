import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';

const homeSummary: string = JSON.parse(readFileSync(new URL('../../content/structures/site.json', import.meta.url), 'utf8')).home.summary;
const [introduction, ...supportingNotes] = homeSummary.split(/\n+/).map((line) => line.trim()).filter(Boolean);

test.describe('home highlights', () => {
  test('a single configured GitHub slide has no fake controls and retains the home introduction', async ({ page }) => {
    await page.goto('/');
    const carousel = page.locator('#home-highlights');
    await expect(carousel).toHaveAttribute('data-ready', '');
    await expect(carousel.locator('[data-carousel-slide]')).toHaveCount(1);
    await expect(carousel.getByRole('button', { name: /slide/ })).toHaveCount(0);
    await expect(page.locator('h1')).toHaveText('Prabin Pebam');
    await expect(page.getByRole('link', { name: 'Read the site', exact: true })).toHaveCount(1);
    await expect(page.locator('[data-contributions]')).toHaveAttribute('data-embedded', '');
    await expect(page.locator('main img[src*="/poster/landing-"]')).toHaveCount(0);
  });

  test('keeps the home notice small and muted below the introduction and actions', async ({ page }) => {
    await page.goto('/');
    const intro = page.getByText(introduction, { exact: true });
    await expect(intro).toHaveAttribute('data-variant', 'standfirst');
    expect(supportingNotes.length).toBeGreaterThan(0);
    for (const note of supportingNotes) {
      const subtext = page.getByText(note, { exact: true });
      await expect(subtext).toHaveAttribute('data-variant', 'small');
      await expect(subtext).toHaveAttribute('data-tone', 'muted');
      for (const width of [360, 1280]) {
        await page.setViewportSize({ width, height: 800 });
        const subtextSize = await subtext.evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
        const introSize = await intro.evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
        expect(subtextSize).toBeGreaterThanOrEqual(14);
        expect(subtextSize).toBeLessThan(introSize);
        expect((await subtext.boundingBox())!.y).toBeGreaterThan((await page.getByRole('link', { name: 'Read the site', exact: true }).boundingBox())!.y);
      }
    }
  });

  test('mixed content shares article chrome, preserves inner keys, moves by track keys and excludes offscreen focus', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/design/compounds/carousel/');
    const carousel = page.getByRole('region', { name: 'Mixed home highlights', exact: true });
    await carousel.scrollIntoViewIfNeeded();
    await expect(carousel).toHaveAttribute('data-ready', '');
    const count = carousel.locator('[data-carousel-counter]');
    const chart = carousel.locator('[data-contributions]');
    await expect(chart).toHaveAttribute('data-ready', '');
    await chart.locator('canvas').focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    await expect(chart).toHaveAttribute('data-active-date', CONTRIBUTION_SECOND_WEEK);
    await expect(count).toHaveText('1 of 4');
    expect(await carousel.locator('[data-carousel-slide]').nth(1).locator('.slide-body').evaluate((e) => (e as HTMLElement).inert)).toBe(true);
    const before = await carousel.locator('[data-carousel-track]').boundingBox();
    await carousel.locator('[data-carousel-track]').focus();
    await page.keyboard.press('ArrowRight');
    await expect(count).toHaveText('2 of 4');
    await expect(carousel.getByRole('heading', { name: 'Finding a shared direction' })).toBeVisible();
    await expect(carousel.getByText('A small team tried three approaches together.', { exact: true })).toBeVisible();
    await expect(carousel.getByRole('link', { name: 'Finding a shared direction', exact: true })).toHaveAttribute('href', '#example-page');
    const after = await carousel.locator('[data-carousel-track]').boundingBox();
    expect(after!.height).toBeCloseTo(before!.height, 0);
    await carousel.getByRole('button', { name: 'Next slide' }).click();
    await expect(carousel.getByRole('link', { name: 'An afternoon outdoors' })).toHaveAttribute('href', '#example-album');
    await carousel.getByRole('button', { name: 'Show slide 4', exact: true }).click();
    await expect(count).toHaveText('4 of 4');
    await carousel.locator('[data-carousel-slide]').last().locator('[data-lightbox]').click();
    await expect(page.locator('dialog[open]')).toHaveCount(1);
    await page.locator('dialog[open]').getByRole('button', { name: 'Close', exact: true }).click();
    await expect(carousel.getByRole('button', { name: 'Next slide' })).toBeDisabled();
  });

  test('mixed slides reflow at 320px and remain accessible in both themes', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto('/design/compounds/carousel/');
    const carousel = page.getByRole('region', { name: 'Mixed home highlights', exact: true });
    await carousel.scrollIntoViewIfNeeded();
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => document.documentElement.dataset.theme = value, theme);
      expect(await page.locator('html').evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
      const report = await new AxeBuilder({ page }).include('#example-trusted-mixed-highlights').analyze();
      expect(report.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? '')).map((v) => v.id)).toEqual([]);
    }
  });
});

const CONTRIBUTION_SECOND_WEEK = '2025-10-31';
