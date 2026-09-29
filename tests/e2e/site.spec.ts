/**
 * The site's design system in the browser (docs: documentation/site-ui/design-system.md, dod.md):
 * the colour theme (no flash, remembered), the custom select's keyboard, the lightbox, the carousel,
 * and axe on the design library and the layouts in both modes. No WebGL here: these pages are fast.
 */
import { devices, expect, test, type Page } from '@playwright/test';
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
    // a little room between options, so a hovered one never merges with the chosen one
    const optionGaps = await field.getByRole('option').evaluateAll((os) => os.slice(1).map((o, i) => o.getBoundingClientRect().top - os[i].getBoundingClientRect().bottom));
    expect(Math.min(...optionGaps)).toBeGreaterThanOrEqual(2);
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
    // the side navigation's items keep a little room between them (the current pill and a hovered one never touch)
    const navGaps = await page.locator('nav[aria-label="Design library"] section').nth(2).locator('a').evaluateAll((as) => as.slice(1).map((a, i) => a.getBoundingClientRect().top - as[i].getBoundingClientRect().bottom));
    expect(Math.min(...navGaps)).toBeGreaterThanOrEqual(2);
    for (const href of links) {
      const res = await page.goto(href);
      expect(res?.status(), href).toBe(200);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
    expect(errors).toEqual([]);
  });

  test('no example spills out of its frame, on a desktop or a phone', async ({ page }) => {
    for (const size of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(size);
      await page.goto('/design/');
      const links = await page.locator('nav[aria-label="Design library"] a').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href')!));
      for (const href of links.filter((h) => /\/(fundamentals|compounds)\//.test(h))) {
        await page.goto(href);
        // what's shown (not a closed disclosure, not inside something that scrolls or clips) stays inside the canvas
        const spills = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>('[data-canvas]:not([data-bleed])')].flatMap((c) => {
            const cb = c.getBoundingClientRect();
            const clipped = (e: Element) => {
              for (let p = e.parentElement; p && p !== c; p = p.parentElement) if (getComputedStyle(p).overflow !== 'visible') return true;
              return false;
            };
            return [...c.querySelectorAll('*')]
              .filter((e) => e.checkVisibility() && !clipped(e) && !e.closest('dialog, [role="listbox"]'))
              .filter((e) => {
                const b = e.getBoundingClientRect();
                return b.height > 0 && (b.bottom > cb.bottom + 2 || b.right > cb.right + 2);
              })
              .slice(0, 1)
              .map((e) => `${c.closest('.example')?.querySelector('h3')?.textContent?.trim()}: ${e.tagName.toLowerCase()}.${e.className}`);
          }),
        );
        expect(spills, `${href} at ${size.width}`).toEqual([]);
      }
    }
  });

  test('the library changes pages without a reload: the side nav keeps its scroll and the theme, and the new page works', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => localStorage.setItem('site.theme', 'dark'));
    await page.goto('/design/fundamentals/button/');
    await page.evaluate(() => ((window as unknown as { kept: number }).kept = 1));
    const nav = page.locator('nav[aria-label="Design library"]');
    const scroll = nav.locator('.scroll');
    // scroll the nav until Select is part-way down it
    const top = await scroll.evaluate((el) => {
      const a = [...el.querySelectorAll('a')].find((x) => x.textContent?.trim() === 'Select')!;
      el.scrollTop += a.getBoundingClientRect().top - el.getBoundingClientRect().top - 200;
      return el.scrollTop;
    });
    expect(top).toBeGreaterThan(0);

    await nav.getByRole('link', { name: 'Select', exact: true }).click();
    await expect(page).toHaveURL(/\/design\/fundamentals\/select\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Select');
    expect(await page.evaluate(() => (window as unknown as { kept?: number }).kept)).toBe(1);
    expect(Math.abs((await scroll.evaluate((el) => el.scrollTop)) - top)).toBeLessThanOrEqual(1);
    await expect(nav.getByRole('link', { name: 'Select', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(nav.getByRole('link', { name: 'Button', exact: true })).not.toHaveAttribute('aria-current', 'page');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // the swapped-in page's scripts are set up: a select opens
    const combo = page.getByRole('main').getByRole('combobox').first();
    await combo.click();
    await expect(combo).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');

    // back works without a reload too
    await page.goBack();
    await expect(page).toHaveURL(/\/design\/fundamentals\/button\/$/);
    await expect(nav.getByRole('link', { name: 'Button', exact: true })).toHaveAttribute('aria-current', 'page');
    expect(await page.evaluate(() => (window as unknown as { kept?: number }).kept)).toBe(1);

    // leaving the library is an ordinary page load
    await page.getByRole('banner').getByRole('link', { name: 'Classic site' }).first().click();
    await expect(page).toHaveURL(/\/classic\/$/);
    expect(await page.evaluate(() => (window as unknown as { kept?: number }).kept)).toBeUndefined();
  });
});

/** The classic site on a phone (documentation/site-ui/mobile-audit.md). */
const { defaultBrowserType: _browser, ...PIXEL } = devices['Pixel 7'];

test.describe('site on a phone', () => {
  test.use(PIXEL);

  const CLASSIC = ['/', '/classic/', '/classic/workshop/'];
  // controls smaller than 44 px, leaving out links inside a sentence and stretched links (their card is the target)
  const smallTargets = (page: Page) =>
    page.evaluate(() => {
      const inText = (e: Element) => {
        const p = e.parentElement;
        return e.tagName === 'A' && !!p && ['P', 'LI', 'FIGCAPTION', 'SPAN', 'EM', 'STRONG', 'DIV'].includes(p.tagName) && p.textContent!.trim().length > e.textContent!.trim().length + 5;
      };
      const stretched = (e: Element) => getComputedStyle(e, '::after').position === 'absolute';
      return [...document.querySelectorAll('a[href], button, [role="combobox"], input:not([type="hidden"]), summary')]
        .filter((e) => {
          const b = e.getBoundingClientRect();
          return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !inText(e) && !stretched(e);
        })
        .map((e) => ({ e, b: e.getBoundingClientRect() }))
        .filter(({ b }) => b.height < 44 || b.width < 44)
        .map(({ e, b }) => `${e.tagName} "${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24)}" ${Math.round(b.width)}x${Math.round(b.height)}`);
    });

  test('no sideways scroll, and every control at least 44 px, from 320 px wide to a phone on its side', async ({ page }) => {
    for (const size of [
      { width: 320, height: 640 },
      { width: 360, height: 780 },
      { width: 430, height: 932 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(size);
      for (const path of CLASSIC) {
        await page.goto(path);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${path} at ${size.width}`).toBe(0);
        expect(await smallTargets(page), `${path} at ${size.width}`).toEqual([]);
      }
    }
  });

  test('the first screen shows the name and the way in, upright and on its side', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/');
    const cta = page.getByRole('main').getByRole('link', { name: 'Explore the planet' });
    expect((await cta.boundingBox())!.y + (await cta.boundingBox())!.height).toBeLessThanOrEqual(640);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto('/');
    expect((await page.getByRole('heading', { level: 1 }).boundingBox())!.y).toBeLessThan(200);
    // the compact header: no more than a seventh of a phone on its side
    expect((await page.locator('[data-site-header]').boundingBox())!.height).toBeLessThanOrEqual(58);
  });

  test('the menu carries the way into the planet, closes on a tap outside, and scrolls inside on a phone on its side', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/classic/workshop/');
    const toggle = page.locator('[data-menu-toggle]');
    await toggle.tap();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle).toHaveAttribute('aria-label', 'Close menu');
    const nav = page.getByRole('navigation', { name: 'Sections' });
    await expect(nav.getByRole('link', { name: 'Explore in 3D' })).toHaveAttribute('href', '/play/?at=workshop');
    await expect(nav.getByRole('link', { name: 'Workshop' })).toHaveAttribute('aria-current', 'page');
    await noSeriousViolations(page);
    await page.touchscreen.tap(180, 700);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(nav).toBeHidden();
    await page.setViewportSize({ width: 844, height: 390 });
    await toggle.tap();
    const box = (await nav.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(390);
  });

  test('the header tucks away while reading down, and comes back on the way up or to focus', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto('/classic/workshop/');
    const header = page.locator('[data-site-header]');
    await page.mouse.wheel(0, 600);
    await expect(header).toHaveAttribute('data-tucked', '');
    await page.mouse.wheel(0, -150);
    await expect(header).not.toHaveAttribute('data-tucked', '');
    await page.mouse.wheel(0, 400);
    await expect(header).toHaveAttribute('data-tucked', '');
    await page.locator('[data-menu-toggle]').focus();
    await expect(header).not.toHaveAttribute('data-tucked', '');
  });

  test('contrast settings: Increase Contrast strengthens muted text and rules; forced colours keep the current page marked', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    const muted = () => page.locator('.contents .text').first().evaluate((e) => getComputedStyle(e).color);
    await page.goto('/classic/');
    const normal = await muted();
    await page.emulateMedia({ contrast: 'more' });
    expect(await muted()).not.toBe(normal);
    await page.emulateMedia({ contrast: 'no-preference', forcedColors: 'active' });
    await page.goto('/classic/workshop/');
    await page.locator('[data-menu-toggle]').tap();
    const current = page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Workshop' });
    expect(await current.evaluate((e) => getComputedStyle(e).textDecorationLine)).toBe('underline');
  });

  test('an article loads its own cut of the fonts: under 250 KB of type, none of it the full Fraunces', async ({ page }) => {
    const fonts: { url: string; size: number }[] = [];
    page.on('response', async (r) => {
      if (r.request().resourceType() === 'font') fonts.push({ url: r.url(), size: (await r.body()).length });
    });
    await page.goto('/classic/workshop/');
    await page.evaluate(() => document.fonts.ready);
    await expect.poll(() => fonts.length).toBeGreaterThanOrEqual(4);
    expect(fonts.filter((f) => /latin-full/.test(f.url))).toEqual([]);
    expect(fonts.reduce((n, f) => n + f.size, 0)).toBeLessThan(250 * 1024);
  });
});
