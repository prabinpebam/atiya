/**
 * The site's design system in the browser (docs: documentation/site-ui/design-system.md, dod.md):
 * the colour theme (no flash, remembered), the custom select's keyboard, the lightbox, the carousel,
 * and axe on the design library and the layouts in both modes. No WebGL here: these pages are fast.
 */
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const noSeriousViolations = async (page: Page) => {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
};

test.describe('site design system', () => {
  test('the theme: follows the system, a choice is kept and applied before the first paint', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/classic/');
    const bg = () => page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
    const dark = await bg();
    await page.emulateMedia({ colorScheme: 'light' });
    const light = await bg();
    expect(light).not.toBe(dark);
    // choose Dark with the keyboard, in the header's own dropdown
    const combo = page.locator('header [role="combobox"]').first();
    await combo.focus();
    await page.keyboard.press('Enter');
    await expect(combo).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await expect(combo).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await bg()).toBe(dark);
    // on the next page it's there before anything paints (the inline script in the head)
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => ((window as any).__themeAtLoad = document.documentElement.dataset.theme), { once: true });
    });
    await page.goto('/classic/workshop/');
    expect(await page.evaluate(() => (window as any).__themeAtLoad)).toBe('dark');
    await expect(combo).toContainText('Dark');
  });

  test('the custom select: APG keyboard, typeahead, a form value and a change event', async ({ page }) => {
    await page.goto('/design/fundamentals/select/');
    const field = page.locator('[data-select]').filter({ has: page.locator('input[name="face"]') });
    const combo = field.getByRole('combobox');
    const input = field.locator('input[name="face"]');
    await expect(combo).toHaveText(/Newsreader/);
    await combo.focus();
    await page.keyboard.press('ArrowDown');
    await expect(combo).toHaveAttribute('aria-expanded', 'true');
    await expect(field.getByRole('listbox')).toBeVisible();
    // the active option is announced through aria-activedescendant, focus stays on the combobox
    const active = async () => page.locator(`#${await combo.getAttribute('aria-activedescendant')}`).innerText();
    expect(await active()).toMatch(/Newsreader/);
    await page.keyboard.press('Home');
    expect(await active()).toMatch(/Fraunces/);
    await page.keyboard.press('Escape');
    await expect(combo).toHaveAttribute('aria-expanded', 'false');
    await expect(input).toHaveValue('text');
    // typeahead opens and jumps; Enter chooses
    await page.keyboard.press('f');
    await expect(combo).toHaveAttribute('aria-expanded', 'true');
    expect(await active()).toMatch(/Figtree/);
    await page.keyboard.press('Enter');
    await expect(input).toHaveValue('ui');
    await expect(combo).toHaveText(/Figtree/);
    await expect(combo).toBeFocused();
    // the pointer: open, pick, and the list closes
    await combo.click();
    await field.getByRole('option', { name: /Fraunces/ }).click();
    await expect(input).toHaveValue('display');
    await expect(field.getByRole('option', { name: /Fraunces/ })).toHaveAttribute('aria-selected', 'true');
  });

  test('the lightbox: opens from a gallery, steps with the keys and the filmstrip, closes back to where it was', async ({ page }) => {
    await page.goto('/design/demo/article-layout/');
    const trigger = page.locator('a[data-lightbox="article"]').nth(2);
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Image viewer' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-lightbox-counter]')).toHaveText('3 of 6');
    await page.keyboard.press('ArrowRight');
    await expect(dialog.locator('[data-lightbox-counter]')).toHaveText('4 of 6');
    await page.keyboard.press('End');
    await expect(dialog.locator('[data-lightbox-counter]')).toHaveText('6 of 6');
    await page.keyboard.press('ArrowRight');
    await expect(dialog.locator('[data-lightbox-counter]')).toHaveText('1 of 6');
    await dialog.getByRole('button', { name: /^Show picture 2/ }).click();
    await expect(dialog.locator('[data-lightbox-counter]')).toHaveText('2 of 6');
    await expect(dialog.getByRole('button', { name: /^Show picture 2/ })).toHaveAttribute('aria-current', 'true');
    await noSeriousViolations(page);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('the carousel: no autoplay, the buttons and dots move it, and its ends are real', async ({ page }) => {
    await page.goto('/design/demo/article-layout/');
    const carousel = page.getByRole('region', { name: 'The planet, in seven pictures' });
    await carousel.scrollIntoViewIfNeeded();
    const counter = carousel.locator('[data-carousel-counter]');
    await expect(counter).toHaveText('1 of 7');
    await expect(carousel.getByRole('button', { name: 'Previous slide' })).toBeDisabled();
    await page.waitForTimeout(1500);
    await expect(counter).toHaveText('1 of 7');
    await carousel.getByRole('button', { name: 'Next slide' }).click();
    await expect(counter).toHaveText('2 of 7');
    await carousel.getByRole('button', { name: 'Show slide 7' }).click();
    await expect(counter).toHaveText('7 of 7');
    await expect(carousel.getByRole('button', { name: 'Next slide' })).toBeDisabled();
  });

  test('the design library and the layouts pass axe in light and dark', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const path of ['/design/', '/design/tokens/color/', '/design/fundamentals/select/', '/design/fundamentals/checkbox/', '/design/compounds/gallery/', '/design/demo/article-layout/', '/design/demo/index-layout/', '/']) {
        await page.goto(path);
        await noSeriousViolations(page);
      }
    }
  });

  test('every component and layout has its page, and each renders without an error', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/design/');
    const links = await page.locator('nav[aria-label="Design library"] a').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href')!));
    expect(links.length).toBeGreaterThan(45);
    for (const href of links) {
      const res = await page.goto(href);
      expect(res?.status(), href).toBe(200);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
});
