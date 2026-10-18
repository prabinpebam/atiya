import { expect, test } from '@playwright/test';

test('Writing: storytelling article has eight themed illustrations and five pull quotes', async ({ page }) => {
  await page.goto('/writing/');
  await page.getByRole('link', { name: "You don't have a storytelling problem", exact: true }).first().click();
  await expect(page).toHaveURL(/\/writing\/you-dont-have-a-storytelling-problem\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("You don't have a storytelling problem");
  const article = page.locator('article.article');
  const illustrations = article.locator('picture:has(source[data-dark]) img');
  await expect(illustrations).toHaveCount(8);
  await expect(article.locator('source[data-dark]')).toHaveCount(8);
  await expect(article.locator('figure.quote[data-variant="pull"]')).toHaveCount(5);
  await expect(article).toContainText("Mathematical reasoning eventually led to the prediction of Neptune's existence");
  await expect(article).toContainText('How do I make a product that has a good story to tell?');

  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await page.evaluate(() => {
      localStorage.removeItem('site.theme');
      document.documentElement.removeAttribute('data-theme');
    });
    await page.reload();
    const images = illustrations;
    await images.evaluateAll(async (elements) => {
      await Promise.all(elements.map(async (image) => {
        if (!(image instanceof HTMLImageElement)) throw new Error('Expected an article image');
        image.loading = 'eager';
        await image.decode();
      }));
    });
    const selected = await images.evaluateAll((elements) => elements.map((image) => {
      if (!(image instanceof HTMLImageElement)) throw new Error('Expected an article image');
      return { alt: image.alt, width: image.naturalWidth, dark: image.currentSrc.includes('.dark') };
    }));
    for (const image of selected) {
      expect(image.alt.length).toBeGreaterThan(0);
      expect(image.width).toBeGreaterThan(0);
      expect(image.dark).toBe(theme === 'dark');
    }
    await page.screenshot({ path: test.info().outputPath(`storytelling-${theme}.png`) });
  }
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
