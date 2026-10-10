/**
 * The site's design system in the browser (docs: documentation/site-ui/design-system.md, dod.md):
 * the colour theme (no flash, remembered), the custom select's keyboard, the lightbox, the carousel,
 * and axe on the design library and the layouts in both modes. No WebGL here: these pages are fast.
 */
import { devices, expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { headingIds } from '../../src/site/content/load';
import { renderMarkdown } from '../../src/site/content/markdown';
import type { Article, HubNode, SiteStructure } from '../../src/site/content/schema';

const noSeriousViolations = async (page: Page) => {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
};

test.describe('site design system', () => {
  test('the table keeps rich headings and semantic row and column scopes', async ({ page }) => {
    await page.goto('/design/compounds/table/');
    const table = page.locator('.example', { has: page.getByRole('heading', { name: 'A comparison', exact: true }) }).getByRole('table');
    await expect(table.locator('thead strong')).toHaveText('Typeface');
    expect(await table.locator('thead th').evaluateAll((cells) => cells.every((cell) => cell.getAttribute('scope') === 'col'))).toBe(true);
    const rowNames = page.locator('.example', { has: page.getByRole('heading', { name: 'Rows named by their first column', exact: true }) }).getByRole('table').locator('tbody th');
    expect(await rowNames.evaluateAll((cells) => cells.length > 0 && cells.every((cell) => cell.getAttribute('scope') === 'row'))).toBe(true);
  });

  test('links keep the parent domain in this tab and label links that leave it', async ({ page }) => {
    await page.goto('/side-projects/atiya/');
    const sameParent = page.locator('main a[href="https://prabinpebam.github.io/atiya/"]');
    await expect(sameParent).not.toHaveAttribute('target', '_blank');
    const offParent = page.locator('main a[href^="https://github.com/"]').first();
    await expect(offParent).toHaveAttribute('target', '_blank');
    await expect(offParent).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(offParent).toHaveAccessibleName(/opens in a new tab/);

    await page.goto('/docs/#engineering/overview.md');
    await expect(page.locator('#document h1')).toContainText('Engineering');
    await expect(page.locator('#document a[href="https://prabinpebam.github.io/atiya/"]').first()).not.toHaveAttribute('target', '_blank');
    const docsOffParent = page.locator('#document a[href^="https://github.com/"]').first();
    await expect(docsOffParent).toHaveAttribute('target', '_blank');
    await expect(docsOffParent).toHaveAccessibleName(/opens in a new tab/);
  });

  test('the theme: follows the system, a choice is kept and applied before the first paint', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
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
    // it opens under its button, their right edges lined up (the list is in the top layer, placed by the script)
    const [button, list] = await Promise.all([combo.boundingBox(), page.locator('header [data-theme-switch] [role="listbox"]').first().boundingBox()]);
    expect(Math.abs(button!.x + button!.width - (list!.x + list!.width))).toBeLessThan(2);
    expect(list!.y).toBeGreaterThanOrEqual(button!.y + button!.height);
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await expect(combo).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await bg()).toBe(dark);
    // on the next page it's there before anything paints (the inline script in the head)
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => ((window as any).__themeAtLoad = document.documentElement.dataset.theme), { once: true });
    });
    await page.goto('/leadership/do-what-makes-you-proud/');
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

  test('a justified gallery keeps equal row heights, exact full-row edges and a natural final row', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/design/compounds/gallery/');
    const gallery = page.locator('[data-justified-gallery]').first();
    await expect(gallery).toHaveAttribute('data-ready', '');
    const geometry = () =>
      gallery.evaluate((list) => {
        const outer = list.getBoundingClientRect();
        const cards = [...list.querySelectorAll<HTMLElement>('[data-gallery-item]')].map((card) => {
          const box = card.getBoundingClientRect();
          return { top: box.top, right: box.right, width: box.width, height: box.height };
        });
        return { outer: { right: outer.right, width: outer.width }, cards };
      });
    const desktop = await geometry();
    expect(new Set(desktop.cards.map((card) => card.height))).toEqual(new Set([224]));
    expect(desktop.cards.filter((card) => card.top === desktop.cards[0]!.top)).toHaveLength(3);
    expect(Math.abs(desktop.cards[2]!.right - desktop.outer.right)).toBeLessThan(1);
    expect(desktop.cards[3]!.width).toBeLessThan(desktop.outer.width);

    await page.setViewportSize({ width: 360, height: 800 });
    await expect.poll(async () => (await geometry()).cards[0]!.height).toBe(160);
    const phone = await geometry();
    expect(new Set(phone.cards.map((card) => card.height))).toEqual(new Set([160]));
    expect(await page.locator('html').evaluate((html) => html.scrollWidth)).toBe(360);
  });

  test('a tall picture spans two rows beside two exactly justified rows, and stays in a row on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/design/compounds/gallery/');
    const gallery = page.locator('.example', { has: page.getByRole('heading', { name: 'Tall pictures span two rows', exact: true }) }).locator('[data-justified-gallery]');
    await gallery.scrollIntoViewIfNeeded();
    await expect(gallery).toHaveAttribute('data-ready', '');
    const geometry = () =>
      gallery.evaluate((list) => {
        const outer = list.getBoundingClientRect();
        return [...list.querySelectorAll<HTMLElement>('[data-gallery-item]')].map((card) => {
          const box = card.getBoundingClientRect();
          return { left: box.left - outer.left, top: box.top - outer.top, right: outer.right - box.right, width: box.width, height: box.height, tall: card.hasAttribute('data-tall') };
        });
      });
    const desktop = await geometry();
    const tall = desktop.filter((card) => card.tall);
    expect(tall).toHaveLength(1);
    expect(tall[0]).toMatchObject({ left: 0, top: 0, height: 2 * 224 + 12 });
    for (const top of [0, 236]) {
      const beside = desktop.filter((card) => !card.tall && card.top === top);
      expect(beside.length).toBeGreaterThan(0);
      expect(beside[0]!.left).toBeCloseTo(tall[0]!.width + 12, 0);
      expect(Math.abs(beside.at(-1)!.right)).toBeLessThan(1);
      expect(new Set(beside.map((card) => card.height))).toEqual(new Set([224]));
    }

    await page.setViewportSize({ width: 360, height: 800 });
    await expect.poll(async () => (await geometry()).filter((card) => card.tall).length).toBe(0);
    expect(new Set((await geometry()).map((card) => card.height))).toEqual(new Set([160]));
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

  test('a video set to autoplay plays muted only while in view, never under reduced motion, and a carousel plays only the slide shown', async ({ page, browser }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/design/fundamentals/video/');
    const auto = page.locator('video[data-autoplay]').first();
    const state = () => auto.evaluate((v: HTMLVideoElement) => ({ paused: v.paused, muted: v.muted, loop: v.loop }));
    await auto.scrollIntoViewIfNeeded();
    await expect.poll(async () => (await state()).paused).toBe(false);
    expect(await state()).toEqual({ paused: false, muted: true, loop: true });
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(async () => (await state()).paused).toBe(true);
    // the reader paused it: it stays paused when it comes back into view
    await auto.scrollIntoViewIfNeeded();
    await expect.poll(async () => (await state()).paused).toBe(false);
    await auto.evaluate((v: HTMLVideoElement) => v.pause());
    await page.evaluate(() => window.scrollTo(0, 0));
    await auto.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    expect((await state()).paused).toBe(true);
    // actual size: its own width (960 px) at most
    const actual = await page.locator('video[data-actual]').first().boundingBox();
    expect(actual!.width).toBeLessThanOrEqual(960);

    const still = await browser.newPage({ reducedMotion: 'reduce' });
    await still.goto('/design/fundamentals/video/');
    const quiet = still.locator('video[data-autoplay]').first();
    await quiet.scrollIntoViewIfNeeded();
    await still.waitForTimeout(1000);
    expect(await quiet.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
    await still.close();

    await page.goto('/design/compounds/carousel/');
    const carousel = page.getByRole('region', { name: 'Scenes and a tour' });
    await carousel.scrollIntoViewIfNeeded();
    const clip = carousel.locator('video');
    await page.waitForTimeout(800);
    expect(await clip.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
    await carousel.getByRole('button', { name: 'Next slide' }).click();
    await expect.poll(() => clip.evaluate((v: HTMLVideoElement) => v.paused)).toBe(false);
    await carousel.getByRole('button', { name: 'Next slide' }).click();
    await expect.poll(() => clip.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
    // a video slide isn't a lightbox link
    await expect(carousel.locator('a[data-lightbox] video')).toHaveCount(0);
  });

  test('a carousel is as tall as its tallest picture: no taller than 80% of the screen, no shorter than 300 px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/design/compounds/carousel/');
    const frame = (name: string) => page.getByRole('region', { name }).locator('.slide-frame').first();
    const size = async (name: string) => (await frame(name).boundingBox())!;
    // all landscape (3:2): the frame is that shape, the slide's whole width
    const landscape = await size('Painted planet tour');
    expect(Math.abs(landscape.height - (landscape.width * 1067) / 1600)).toBeLessThan(2);
    // a portrait among them: the frame is the portrait's shape, but stops at 80% of the screen's height
    const mixed = await size('Landscape and portrait scenes');
    expect(Math.round(mixed.height)).toBe(720);
    expect(mixed.width).toBeGreaterThan(mixed.height);
    // a phone: landscape pictures would make it short, so it keeps 300 px; the portrait's shape fits under the cap
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(async () => Math.round((await size('Painted planet tour')).height)).toBe(300);
    const phone = await size('Landscape and portrait scenes');
    expect(Math.abs(phone.height - (phone.width * 1067) / 711)).toBeLessThan(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });

  test('carousel variants: no arrows, a filmstrip that scrolls and keeps its frame in view, one that wraps', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/design/compounds/carousel/');
    const example = (name: string) => page.locator('.example', { has: page.getByRole('heading', { name, exact: true }) }).locator('[data-carousel]');

    const bare = example('Without the arrows');
    await expect(bare.getByRole('button', { name: 'Next slide' })).toHaveCount(0);
    await bare.getByRole('button', { name: 'Show slide 3' }).click();
    await expect(bare.locator('[data-carousel-counter]')).toHaveText('3 of 5');

    const film = example('With a filmstrip that scrolls');
    const strip = film.locator('[data-carousel-strip]');
    expect(await strip.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    await film.getByRole('button', { name: /^Show slide 2:/ }).click();
    await expect(film.locator('[data-carousel-counter]')).toHaveText('2 of 14');
    for (let i = 0; i < 11; i++) await film.getByRole('button', { name: 'Next slide' }).click();
    await expect(film.locator('[data-carousel-counter]')).toHaveText('13 of 14');
    await page.waitForTimeout(600);
    const inView = await strip.evaluate((el) => {
      const s = el.getBoundingClientRect();
      const r = el.querySelector('[aria-current="true"]')!.getBoundingClientRect();
      return r.left >= s.left - 1 && r.right <= s.right + 1;
    });
    expect(inView).toBe(true);
    // the glide ends where it was sent
    await page.waitForTimeout(1500);
    await expect(film.locator('[data-carousel-counter]')).toHaveText('13 of 14');

    const wrapped = example('With a filmstrip that wraps');
    const rows = await wrapped.locator('[data-carousel-strip] button').evaluateAll((bs) => new Set(bs.map((b) => Math.round(b.getBoundingClientRect().top))).size);
    expect(rows).toBeGreaterThanOrEqual(2);
    expect(await wrapped.locator('[data-carousel-strip]').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await expect(wrapped.getByRole('button', { name: 'Previous slide' })).toHaveCount(0);
    await wrapped.getByRole('button', { name: /^Show slide 14:/ }).click();
    await expect(wrapped.locator('[data-carousel-counter]')).toHaveText('14 of 14');
  });

  test('a carousel with a peek: neighbours smaller under the carousel\'s own fade, reaching beside it where there is room, and a neighbour brings itself to the middle', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/design/demo/article-layout/');
    const car = page.locator('[data-carousel][data-peek]').first();
    await car.scrollIntoViewIfNeeded();
    // the fade is the carousel's, not the slides': mid-glide no slide fades, and the mask stays put
    const faded = () =>
      car.evaluate((el) => ({
        mask: getComputedStyle(el.querySelector('.viewport')!).maskImage,
        slides: [...el.querySelectorAll('.slide-body')].filter((b) => getComputedStyle(b).opacity !== '1' || getComputedStyle(b).maskImage !== 'none').length,
      }));
    const before = await faded();
    await car.getByRole('button', { name: 'Next slide' }).click();
    await page.waitForTimeout(120);
    expect(await faded()).toEqual({ mask: before.mask, slides: 0 });
    await expect(car.locator('[data-carousel-counter]')).toHaveText(/^2 of /);
    await page.waitForTimeout(800);
    const g = await car.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const v = el.querySelector('.viewport')!.getBoundingClientRect();
      const bodies = [...el.querySelectorAll('.slide-body')];
      const scale = (b: Element) => new DOMMatrix(getComputedStyle(b).transform).a;
      const current = el.querySelectorAll('[data-carousel-slide]')[1].getBoundingClientRect();
      return {
        reachesOut: v.left < r.left - 50 && v.right > r.right + 50,
        centred: Math.abs(current.left + current.width / 2 - (r.left + r.width / 2)),
        scales: [scale(bodies[0]), scale(bodies[1]), scale(bodies[2])],
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(g.reachesOut).toBe(true);
    expect(g.centred).toBeLessThan(2);
    expect(g.scales[1]).toBeCloseTo(1, 2);
    expect(g.scales[0]).toBeCloseTo(0.88, 2);
    expect(g.scales[2]).toBeCloseTo(0.88, 2);
    expect(before.mask).toContain('linear-gradient');
    expect(g.pageOverflow).toBe(0);

    // choosing the neighbour on the right moves to it, and doesn't open the lightbox
    const next = car.locator('[data-carousel-slide]').nth(2);
    const box = (await next.boundingBox())!;
    await page.mouse.click(Math.min(box.x + 40, 1430), box.y + box.height / 3);
    await expect(car.locator('[data-carousel-counter]')).toHaveText(/^3 of /);
    await expect(page.locator('dialog[open]')).toHaveCount(0);
  });

  test('the design library and the layouts pass axe in light and dark', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const path of ['/design/', '/design/tokens/color/', '/design/fundamentals/select/', '/design/fundamentals/checkbox/', '/design/compounds/gallery/', '/design/compounds/collection/', '/design/demo/article-layout/', '/design/demo/index-layout/', '/']) {
        await page.goto(path);
        await noSeriousViolations(page);
      }
    }
  });

  test("a collection's timelines: down a line, each mark by its time; sideways, a named strip whose marks stay level and whose buttons scroll it", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/design/compounds/collection/');
    // down a line: each item reads its time first; the marks are drawn, hidden from assistive tech
    const down = page.locator('[data-collection][data-layout="timeline"]').first();
    const first = down.getByRole('listitem').first();
    await expect(first.locator(':scope > :not([aria-hidden])').first()).toHaveText('July 2019 to now');
    await expect(down.locator('.mark[aria-hidden="true"]')).toHaveCount(await down.getByRole('listitem').count());
    // each time sits before its mark, and the words after it
    const [when, mark, body] = await Promise.all(['.when', '.mark', '.body'].map((s) => first.locator(s).boundingBox()));
    expect(when!.x + when!.width).toBeLessThanOrEqual(mark!.x + 1);
    expect(mark!.x + mark!.width).toBeLessThanOrEqual(body!.x + 1);
    // sideways: a named region with a list that scrolls, every mark on one line
    const strip = page.getByRole('region', { name: 'A walk round the planet' });
    await strip.scrollIntoViewIfNeeded();
    const items = strip.getByRole('listitem');
    await expect(items).toHaveCount(5);
    const tops = await strip.locator('.mark').evaluateAll((ms) => ms.map((m) => Math.round(m.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
    const prev = strip.getByRole('button', { name: 'Previous' });
    const next = strip.getByRole('button', { name: 'Next' });
    await expect(prev).toBeDisabled();
    await next.click();
    await expect(prev).toBeEnabled();
    await expect.poll(() => strip.getByRole('list').evaluate((l) => l.scrollLeft)).toBeGreaterThan(0);
    // on a phone, the line runs down the start: the time over its words, and nothing scrolls sideways
    await page.setViewportSize({ width: 320, height: 800 });
    const [w, b] = await Promise.all([first.locator('.when').boundingBox(), first.locator('.body').boundingBox()]);
    expect(w!.y + w!.height).toBeLessThanOrEqual(b!.y + 1);
    // (polled: the overlay scrollbars' handles take a moment to follow a resize)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test('a collection strip peeks beside its column, fading to nothing there, and spans the window at full width', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/design/compounds/collection/');
    const strip = page.getByRole('region', { name: 'Places, peeking' });
    await strip.scrollIntoViewIfNeeded();
    const list = strip.getByRole('list');
    // the list reaches out beside the column (at most an item and its gap), under a fade across that room
    await expect.poll(() => strip.evaluate((r) => parseFloat(r.style.getPropertyValue('--bleed-end')) || 0)).toBeGreaterThan(0);
    const [root, items, item] = await Promise.all([strip.boundingBox(), list.boundingBox(), list.getByRole('listitem').first().boundingBox()]);
    const reach = await strip.evaluate((r) => parseFloat(r.style.getPropertyValue('--bleed-end')));
    expect(items!.x + items!.width).toBeCloseTo(root!.x + root!.width + reach, 0);
    expect(reach).toBeLessThanOrEqual(item!.width + 16 + 1);
    expect(await list.evaluate((l) => getComputedStyle(l).maskImage)).toContain('linear-gradient');
    // at rest its first item sits at the column's start; Next moves it by the column's width
    expect(Math.abs(item!.x - root!.x)).toBeLessThanOrEqual(1);
    await strip.getByRole('button', { name: 'Next' }).click();
    await expect.poll(() => list.evaluate((l) => l.scrollLeft)).toBeGreaterThan(root!.width * 0.9);
    // a phone shows a plain strip: no room taken beside it
    await page.setViewportSize({ width: 390, height: 800 });
    await expect.poll(() => strip.evaluate((r) => r.style.getPropertyValue('--bleed-end'))).toBe('0px');
    // full width: the strip spans its frame inside the gutters, and doesn't peek; a row too long even with its items at their narrowest (here) scrolls from the gutter
    await page.setViewportSize({ width: 1400, height: 900 });
    const full = page.getByRole('region', { name: 'A walk, full width' });
    await full.scrollIntoViewIfNeeded();
    await expect(full).toHaveAttribute('data-breakout', 'full');
    await expect(full).not.toHaveAttribute('data-peek', /.*/);
    const [f, first, gutter] = await Promise.all([full.boundingBox(), full.getByRole('listitem').first().boundingBox(), page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('[aria-label="A walk, full width"] [role="list"]')!).paddingInlineStart))]);
    expect(gutter).toBeGreaterThan(0);
    expect(first!.x - f!.x).toBeCloseTo(gutter, 0);
    // when every item fits, they're centred, and with nothing to scroll there are no buttons and no tab stop
    const few = page.getByRole('region', { name: 'Two places, full width' });
    await few.scrollIntoViewIfNeeded();
    const [box, a, b] = await Promise.all([few.boundingBox(), few.getByRole('listitem').first().boundingBox(), few.getByRole('listitem').last().boundingBox()]);
    expect(Math.abs(a!.x - box!.x - (box!.x + box!.width - (b!.x + b!.width)))).toBeLessThanOrEqual(2);
    await expect(few.getByRole('button', { name: 'Next' })).toBeHidden();
    await expect(few.getByRole('list')).not.toHaveAttribute('tabindex', /.*/);
    // a strip that scrolls keeps them
    await expect(full.getByRole('button', { name: 'Next' })).toBeVisible();
    await expect(full.getByRole('list')).toHaveAttribute('tabindex', '0');
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

  test('the switch: its thumb sits as far from the top and the bottom as from the end it rests at, off and on', async ({ page }) => {
    await page.goto('/design/fundamentals/switch/');
    const sw = page.getByRole('main').getByRole('switch').first();
    const gaps = () =>
      sw.evaluate((el) => {
        const s = getComputedStyle(el);
        const b = getComputedStyle(el, '::before');
        const t = parseFloat(b.height);
        const above = parseFloat(b.top) + parseFloat(b.marginTop) + parseFloat(s.borderTopWidth);
        const start = parseFloat(b.left) + parseFloat(b.marginLeft) + parseFloat(s.borderLeftWidth) + new DOMMatrix(b.transform).m41;
        const w = parseFloat(s.width);
        return { above, below: parseFloat(s.height) - above - t, rest: (el as HTMLInputElement).checked ? w - start - t : start };
      });
    for (let i = 0; i < 2; i++) {
      await page.waitForTimeout(400); // the thumb's slide
      const g = await gaps();
      expect(Math.abs(g.above - g.below), JSON.stringify(g)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(g.rest - g.above), JSON.stringify(g)).toBeLessThanOrEqual(0.5);
      await sw.click();
    }
    // forced colours: the track keeps an outline and the thumb shows where it sits
    await page.emulateMedia({ forcedColors: 'active' });
    const off = page.getByRole('main').getByRole('switch').nth(1);
    await expect(off).toHaveCSS('outline-style', 'solid');
    expect(await off.evaluate((el) => getComputedStyle(el, '::before').forcedColorAdjust)).toBe('none');
  });

  test('overlay scrollbars: no gutter anywhere, and a frosted handle over the edge in use that follows the scroll and drags', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/design/fundamentals/select/');
    // no native bar: the page and the side nav keep their whole width
    expect(await page.evaluate(() => innerWidth - document.documentElement.clientWidth)).toBe(0);
    const nav = page.locator('nav[aria-label="Design library"] .scroll');
    expect(await nav.evaluate((el: HTMLElement) => el.offsetWidth - el.clientWidth)).toBe(0);
    const thumb = page.locator('nav[aria-label="Design library"] .scroll + .sb-thumb[data-axis="y"]');
    await page.mouse.move(1400, 850);
    await expect(thumb).not.toHaveAttribute('data-show', '');

    await nav.hover();
    await expect(thumb).toHaveAttribute('data-show', '');
    expect(await thumb.evaluate((t) => getComputedStyle(t).backdropFilter)).toContain('blur');
    // it sits over the scroller's far edge, inside it
    const edge = await nav.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const tr = document.querySelector('nav[aria-label="Design library"] .scroll + .sb-thumb[data-axis="y"]')!.getBoundingClientRect();
      return { right: r.right - tr.right, inside: tr.top >= r.top - 1 && tr.bottom <= r.bottom + 1 };
    });
    expect(edge.right).toBeGreaterThan(0);
    expect(edge.right).toBeLessThan(8);
    expect(edge.inside).toBe(true);

    await nav.evaluate((el) => el.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(100);
    const top0 = (await thumb.boundingBox())!.y;
    await page.mouse.wheel(0, 300);
    await expect.poll(async () => (await thumb.boundingBox())!.y).toBeGreaterThan(top0);

    // dragging the handle scrolls the list
    const before = await nav.evaluate((el) => el.scrollTop);
    const b = (await thumb.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + 80, { steps: 5 });
    await page.mouse.up();
    expect(await nav.evaluate((el) => el.scrollTop)).toBeGreaterThan(before + 40);

    // the page's own handle shows while the page scrolls
    await page.mouse.move(700, 450);
    await page.mouse.wheel(0, 500);
    await expect(page.locator('body > .sb-thumb[data-page][data-axis="y"]')).toHaveAttribute('data-show', '');
  });

  test('the footer rests on the bottom edge of a short page, and follows the content of a long one', async ({ page }) => {
    const footer = () =>
      page.evaluate(() => {
        const f = document.querySelector('footer.site-footer')!.getBoundingClientRect();
        // + 0 turns a rounded -0 into 0
        return { toViewportBottom: Math.round(innerHeight - f.bottom) + 0, belowIt: Math.round(document.documentElement.scrollHeight - (f.bottom + scrollY)) + 0 };
      });
    // taller than the article: no gap under the footer
    await page.setViewportSize({ width: 1440, height: 2400 });
    await page.goto('/work/');
    expect(await footer()).toEqual({ toViewportBottom: 0, belowIt: 0 });
    // shorter than the article: the footer is below the fold, the last thing on the page
    await page.setViewportSize({ width: 1440, height: 800 });
    await page.goto('/leadership/do-what-makes-you-proud/');
    const long = await footer();
    expect(long.toViewportBottom).toBeLessThan(0);
    expect(long.belowIt).toBe(0);
    // the header still sticks, and a centred layout keeps its width
    await page.evaluate(() => window.scrollTo(0, 400));
    expect(await page.evaluate(() => Math.round(document.querySelector('.site-header')!.getBoundingClientRect().top))).toBe(0);
    await page.setViewportSize({ width: 1440, height: 2400 });
    await page.goto('/work/');
    expect(await page.evaluate(() => Math.round(document.querySelector('main')!.getBoundingClientRect().width))).toBeGreaterThan(1100);
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
    await page.getByRole('banner').getByRole('link', { name: 'Visit the site' }).first().click();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/');
    expect(await page.evaluate(() => (window as unknown as { kept?: number }).kept)).toBeUndefined();
  });

  test('the end of a story: three unread stories to read next, read ones last and marked, and back to top', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const shown = () =>
      page.locator('[data-related-item]:not([hidden])').evaluateAll((els) => els.map((el) => ({ id: (el as HTMLElement).dataset.relatedItem!, read: !(el.querySelector('[data-related-read]') as HTMLElement).hidden })));
    await page.goto('/side-projects/liquid-glass-pro/');
    const region = page.getByRole('region', { name: 'Keep exploring' });
    await expect(region).toBeVisible();
    const first = await shown();
    expect(first).toHaveLength(3);
    expect(first.every((s) => !s.read)).toBe(true);

    // reading the first suggestion takes it out of the three, and remembers both pages
    await region.getByRole('link', { name: /./ }).first().click();
    await expect(page).toHaveURL(new RegExp(`/${first[0].id}/$`));
    await page.goBack();
    await expect.poll(async () => (await shown()).map((s) => s.id)).not.toContain(first[0].id);
    expect(Object.keys(JSON.parse((await page.evaluate(() => localStorage.getItem('site.visited'))) ?? '{}'))).toEqual(expect.arrayContaining(['liquid-glass-pro', first[0].id]));

    // with every candidate read, the longest ago come back, marked Read
    const all = await page.locator('[data-related-item]').evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.relatedItem!));
    await page.evaluate((ids) => localStorage.setItem('site.visited', JSON.stringify(Object.fromEntries(ids.map((id, i) => [id, Date.now() - i * 1000])))), all);
    await page.reload();
    const again = await shown();
    expect(again.map((s) => s.id)).toEqual(all.slice(-3).reverse());
    expect(again.every((s) => s.read)).toBe(true);
    await expect(region.getByText('Read', { exact: true }).first()).toBeVisible();

    // back to top: the top of the page, and the focus on the main region
    await page.getByRole('link', { name: 'Back to top' }).click();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    await expect(page.locator('#main')).toBeFocused();
  });
});

/** The classic site on a phone (documentation/site-ui/mobile-audit.md). */
const { defaultBrowserType: _browser, ...PIXEL } = devices['Pixel 7'];

test.describe('site on a phone', () => {
  test.use(PIXEL);

  const CLASSIC = ['/', '/work/', '/leadership/', '/leadership/do-what-makes-you-proud/'];
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
          // the article minimap's rows are 24 px on touch (WCAG 2.5.8): an extra way to move, the page scrolls as usual
          return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !inText(e) && !stretched(e) && !e.closest('[data-minimap]');
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
        // scrolled down too, the header tucked away (a transform: a closed dropdown under it once widened the page)
        await page.mouse.wheel(0, 800);
        await page.waitForTimeout(400);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${path} at ${size.width}, scrolled`).toBe(0);
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
    await page.goto('/leadership/do-what-makes-you-proud/');
    const toggle = page.locator('[data-menu-toggle]');
    await toggle.tap();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle).toHaveAttribute('aria-label', 'Close menu');
    const nav = page.getByRole('navigation', { name: 'Sections' });
    await expect(nav.getByRole('link', { name: 'Explore in 3D' })).toHaveAttribute('href', /^\/play\//);
    await expect(nav.getByRole('link', { name: 'Leadership' })).toHaveAttribute('aria-current', 'page');
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
    await page.goto('/leadership/do-what-makes-you-proud/');
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
    await page.goto('/');
    const normal = await muted();
    await page.emulateMedia({ contrast: 'more' });
    expect(await muted()).not.toBe(normal);
    await page.emulateMedia({ contrast: 'no-preference', forcedColors: 'active' });
    await page.goto('/leadership/do-what-makes-you-proud/');
    await page.locator('[data-menu-toggle]').tap();
    const current = page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Leadership' });
    expect(await current.evaluate((e) => getComputedStyle(e).textDecorationLine)).toBe('underline');
  });

  test('an article loads its own cut of the fonts: under 250 KB of type, none of it the full Fraunces', async ({ page }) => {
    const fonts: { url: string; size: number }[] = [];
    page.on('response', async (r) => {
      if (r.request().resourceType() === 'font') fonts.push({ url: r.url(), size: (await r.body()).length });
    });
    await page.goto('/leadership/do-what-makes-you-proud/');
    await page.evaluate(() => document.fonts.ready);
    await expect.poll(() => fonts.length).toBeGreaterThanOrEqual(4);
    expect(fonts.filter((f) => /latin-full/.test(f.url))).toEqual([]);
    expect(fonts.reduce((n, f) => n + f.size, 0)).toBeLessThan(250 * 1024);
  });
});

/** The article minimap (documentation/site-ui/minimap.md). */
test.describe('article minimap', () => {
  const outline = 'nav[aria-label="Article outline"]';
  const state = (page: Page, nav = outline) =>
    page.locator(nav).evaluate((n) => {
      const rows = [...n.querySelectorAll<HTMLElement>('.row')];
      const tip = n.querySelector('[data-minimap-tip]')!;
      return {
        kinds: rows.map((r) => r.dataset.kind! + (r.dataset.level ?? '')),
        current: rows.findIndex((r) => r.getAttribute('aria-current') === 'location'),
        active: rows.findIndex((r) => r.hasAttribute('data-active')),
        tip: tip.hasAttribute('data-show') ? [...tip.children].map((c) => c.textContent!.trim()).join(' | ') : null,
      };
    });
  const current = (page: Page) => state(page).then((s) => s.current);

  test('one indicator per landmark, where the reader is, a preview on hover or focus, and a jump that lands below the header', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/design/demo/article-layout/');
    const nav = page.getByRole('navigation', { name: 'Article outline' });
    await expect(nav).toBeVisible();
    const rows = nav.locator('.row');
    let s = await state(page);
    // the lead picture, three headings, a picture, a gallery, a carousel; not the title (the page's own), the author's avatar or the video's poster
    expect(s.kinds).toEqual(['image', 'heading2', 'image', 'heading2', 'gallery', 'gallery', 'heading2']);
    expect(s.current).toBe(0);
    // only the strip takes pointer input
    expect(await nav.evaluate((n) => [n, n.querySelector('.strip')!, n.querySelector('[data-minimap-tip]')!].map((e) => getComputedStyle(e).pointerEvents))).toEqual(['none', 'auto', 'none']);
    await expect(rows.nth(1)).toHaveAccessibleName('Jump to heading: Paper, ink and one spot colour');
    await expect(rows.nth(4)).toHaveAccessibleName(/^Jump to gallery: /);

    // hover: active, a preview, and the wave
    await rows.nth(2).hover();
    s = await state(page);
    expect(s.active).toBe(2);
    expect(s.tip).toMatch(/lighthouse.* \| Image$/i);
    const waves = await rows.evaluateAll((rs) => rs.map((r) => Number((r as HTMLElement).style.getPropertyValue('--wave') || 0)));
    expect(waves[2]).toBe(1);
    expect(waves[1]).toBeGreaterThan(waves[0]);
    expect(waves[3]).toBe(waves[1]);
    expect(waves[6]).toBe(0);

    // a jump: the landmark lands 18% down below the sticky header, and is the one being read
    await rows.nth(3).click();
    await expect.poll(() => current(page)).toBe(3);
    await page.waitForTimeout(600);
    const top = await page.locator('#pictures').evaluate((h) => h.getBoundingClientRect().top);
    expect(Math.abs(top - (72 + 0.18 * 900))).toBeLessThan(24);

    // the keyboard: focus previews, Enter jumps
    await rows.nth(6).focus();
    expect((await state(page)).tip).toBe('Moving pictures | Heading 2');
    await page.keyboard.press('Enter');
    await expect.poll(() => current(page)).toBe(6);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });

  test('opening at a heading anchor marks it current, and the heading keeps its id', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/design/demo/article-layout/#pictures');
    await expect.poll(() => current(page)).toBe(3);
    await expect(page.locator('h2#pictures')).toHaveCount(1);
  });

  test('content that changes after load: the list rebuilds, and landmarks moved down move the reading position', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/design/demo/article-layout/');
    await page.evaluate(() => {
      const h = document.createElement('h3');
      h.textContent = 'Added later';
      document.querySelector('.article .prose')!.append(h);
    });
    await expect.poll(() => state(page).then((s) => s.kinds.length)).toBe(8);
    expect((await state(page)).kinds.at(-1)).toBe('heading3');
    // at the second heading, then a tall block (a late picture) pushes everything below the lead down
    await page.locator('#paper-and-ink').evaluate((h) => window.scrollTo(0, h.getBoundingClientRect().top + scrollY - 100));
    await expect.poll(() => current(page)).toBe(1);
    // as a late picture does (scroll anchoring off, as when it loads below the reader's anchor)
    await page.evaluate(() => {
      document.documentElement.style.overflowAnchor = 'none';
      const tall = document.createElement('div');
      tall.style.height = '1600px';
      document.querySelector('.article .prose')!.prepend(tall);
    });
    await expect.poll(() => current(page)).toBe(0);
  });

  test('in a box of its own: the strip sits inside it, scrolls on its own without chaining, and auto-scrolls near its edges', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/design/compounds/article-minimap/');
    const nav = page.getByRole('navigation', { name: 'Long article outline' });
    await page.getByRole('region', { name: 'A long article', exact: true }).scrollIntoViewIfNeeded();
    const g = await nav.evaluate((el) => {
      const box = el.parentElement!.querySelector('[role="region"]')!.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const strip = el.querySelector('.strip')!;
      return { inside: r.left >= box.left && r.right <= box.right - 8 && r.top >= box.top && r.bottom <= box.bottom, rows: strip.children.length, overflow: strip.scrollHeight > strip.clientHeight };
    });
    expect(g).toEqual({ inside: true, rows: 36, overflow: true });
    const strip = nav.locator('.strip');
    const b = (await strip.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height - 4);
    // it runs to the end of the list (however far it overflows)
    await expect.poll(() => strip.evaluate((s) => s.scrollHeight - s.clientHeight - s.scrollTop)).toBeLessThan(1);
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    const at = await strip.evaluate((s) => s.scrollTop);
    await page.waitForTimeout(300);
    expect(await strip.evaluate((s) => s.scrollTop)).toBe(at);
    // at its end, the wheel doesn't pass on to the page
    await strip.evaluate((s) => (s.scrollTop = s.scrollHeight));
    const y = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => scrollY)).toBe(y);
    // only pictures; a gallery first, the heading inside it not listed
    expect((await state(page, 'nav[aria-label="Pictures outline"]')).kinds).toEqual(['image', 'image', 'image', 'image', 'image']);
    expect((await state(page, 'nav[aria-label="Gallery article outline"]')).kinds).toEqual(['gallery', 'heading2', 'heading2']);
  });

  test('touch: a tap selects and jumps at once, a second tap takes over, and the first tap\u2019s timer leaves it be', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ ...PIXEL, viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(new URL('/design/demo/article-layout/', baseURL).href);
    const rows = page.locator(`${outline} .row`);
    expect((await rows.first().boundingBox())!.height).toBeGreaterThanOrEqual(24);
    await rows.nth(3).tap();
    let s = await state(page);
    expect(s.active).toBe(3);
    expect(s.tip).toMatch(/^Pictures, given room/);
    await expect.poll(() => current(page)).toBe(3);
    await page.waitForTimeout(2000);
    await rows.nth(1).tap();
    // past the first tap's 3.6 s: the second selection stays
    await page.waitForTimeout(2200);
    s = await state(page);
    expect(s.active).toBe(1);
    expect(s.tip).toMatch(/^Paper, ink/);
    await expect.poll(() => state(page).then((x) => x.active), { timeout: 5000 }).toBe(-1);
    await ctx.close();
  });

  test('on a phone the strip stays out of the way of the text', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ ...PIXEL });
    const page = await ctx.newPage();
    await page.goto(new URL('/design/demo/article-layout/', baseURL).href);
    await expect(page.locator(outline)).toBeHidden();
    await ctx.close();
  });
});


// ---------- content ----------
test.describe('content', () => {
  const ARTICLE = '/leadership/do-what-makes-you-proud/';
  // the article as it is in content/ (edit mode changes it): the page is checked against it, never a copy
  const CONTENT = new URL('../../content/', import.meta.url);
  const doc = JSON.parse(readFileSync(new URL('articles/do-what-makes-you-proud.json', CONTENT), 'utf8')) as Article;
  const of = <T extends Article['body'][number]['type']>(type: T) => doc.body.filter((b): b is Extract<Article['body'][number], { type: T }> => b.type === type);

  test('an article from content/: the site structure gives its path, its hub lists it, and its blocks render', async ({ page }) => {
    await page.goto('/leadership/');
    await expect(page.getByRole('heading', { level: 1, name: 'Leadership' })).toBeVisible();
    await page.getByRole('link', { name: doc.title }).first().click();
    await expect(page).toHaveURL(new RegExp(`${ARTICLE}$`));

    await expect(page).toHaveTitle(`${doc.title} \u2014 Prabin Pebam`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(doc.title);
    const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(crumbs.getByRole('link')).toHaveText(['Home', 'Leadership']);
    // the facts: a collection laid out as columns, each heading over its subtext
    const facts = of('collection').find((c) => c.layout === 'columns');
    if (facts) {
      const first = page.locator('article [data-collection][data-layout="columns"]').first();
      await expect(first.locator('.heading').first()).toHaveText(facts.items[0].heading!);
      await expect(first.locator('.subtext').first()).toHaveText(facts.items[0].subtext!);
    }
    // every heading block, with its anchor; the quotes; the text's line breaks
    const headings = of('heading');
    await expect(page.locator('article h2')).toHaveCount(headings.filter((h) => h.level === 2).length);
    const anchors = headingIds(headings);
    for (const [k, h] of headings.entries()) await expect(page.locator(`[id="${anchors[k]}"]`)).toHaveText(h.text);
    for (const q of of('quote')) await expect(page.locator('article blockquote', { hasText: q.text.slice(0, 40) })).toHaveCount(1);
    // every collection, in its layout: a list of its items, each heading in order
    const collections = page.locator('article [data-collection]');
    await expect(collections).toHaveCount(of('collection').length);
    for (const [n, c] of of('collection').entries()) {
      await expect(collections.nth(n)).toHaveAttribute('data-layout', c.layout);
      await expect(collections.nth(n).locator('.heading')).toHaveText(c.items.flatMap((i) => (i.heading ? [i.heading] : [])));
    }
    const breaks = of('text').reduce((n, t) => n + (renderMarkdown(t.markdown).match(/<br>/g) ?? []).length, 0);
    expect(await page.locator('article p br, article li br').count()).toBeGreaterThanOrEqual(breaks);

    // every picture in a figure has alt text and sizes to choose from (the byline's avatar is decorative)
    const imgs = await page.locator('article figure img').evaluateAll((els) => (els as HTMLImageElement[]).map((i) => ({ alt: i.alt, srcset: i.srcset })));
    expect(imgs.length).toBeGreaterThanOrEqual(of('figure').length + of('gallery').reduce((n, g) => n + g.items.length, 0) + (doc.hero ? 1 : 0));
    expect(imgs.filter((i) => !i.alt || !/\b\d+w\b/.test(i.srcset))).toEqual([]);
    const gallery = of('gallery')[0];
    if (gallery) {
      const first = page.locator('[data-gallery] img').first();
      await first.scrollIntoViewIfNeeded();
      await expect.poll(() => first.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
      await expect(first).toHaveAttribute('data-fit', gallery.fit ?? 'cover');
    }
    // the minimap lists the headings and the pictures
    expect(await page.locator('nav[aria-label="Article outline"] button').count()).toBeGreaterThanOrEqual(headings.length);
  });

  test('pictures have no background colour of their own: a transparent one sits straight on the page', async ({ page }) => {
    await page.goto(ARTICLE);
    // (unless its page asked for its colour behind it, data-bg: media.md §9.1); wait for them to load, so no shimmer is counted
    await page.waitForFunction(() => [...document.querySelectorAll('main [data-picture]')].every((p) => (p as HTMLElement).dataset.state !== 'loading' || !(p as HTMLElement).checkVisibility()));
    const painted = await page.locator('main img:not([data-bg])').evaluateAll((els) =>
      els.flatMap((e) => [e, e.closest('.image-shell')].filter((x): x is Element => !!x)).map((x) => getComputedStyle(x).backgroundColor).filter((c) => c !== 'rgba(0, 0, 0, 0)'),
    );
    expect(painted).toEqual([]);
  });

  test('the video: our own poster and play button, its length, and the player only after Play', async ({ page }) => {
    const remote: string[] = [];
    const referers: string[] = [];
    await page.route(/youtube(-nocookie)?\.com|ytimg\.com/, (route) => {
      remote.push(route.request().url());
      if (route.request().url().includes('/embed/')) referers.push(route.request().headers().referer ?? '');
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>player</title>' });
    });
    await page.goto(ARTICLE);
    await page.evaluate(() => {
      const referrer = document.createElement('meta');
      referrer.name = 'referrer';
      referrer.content = 'same-origin';
      document.head.append(referrer);
    });
    const play = page.getByRole('link', { name: 'Play video: The team video (2 minutes 20 seconds)' });
    await play.scrollIntoViewIfNeeded();
    await expect(play.locator('img')).toHaveAttribute('srcset', /\d+w/);
    await expect(page.locator('.video-embed .duration')).toHaveText('2:20');
    expect(remote).toEqual([]);
    await play.click();
    const frame = page.locator('iframe.video-embed-frame');
    await expect(frame).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/vIVX-KVUWAE?autoplay=1');
    await expect(frame).toHaveAttribute('title', 'The team video');
    await expect(frame).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    await expect.poll(() => remote.some((u) => u.includes('youtube-nocookie.com/embed/vIVX-KVUWAE'))).toBe(true);
    await expect.poll(() => referers).toContain(`${new URL(page.url()).origin}/`);
  });

  const STRUCTURE = JSON.parse(readFileSync(new URL('structures/site.json', CONTENT), 'utf8')) as SiteStructure;
  const SECTIONS = (STRUCTURE.home.children ?? []).filter((n): n is HubNode => n.kind === 'hub');

  test("the navigation is the site structure's: its entries on every page, in the header and the phone menu, the current one marked", async ({ page }) => {
    const entries = (STRUCTURE.menus?.primary ?? []).map((e) => ('node' in e ? (e.label ?? SECTIONS.find((n) => n.id === e.node)?.navLabel ?? SECTIONS.find((n) => n.id === e.node)?.title) : e.label));
    const nav = page.getByRole('navigation', { name: 'Sections' });
    for (const path of ['/', '/work/', ARTICLE]) {
      await page.goto(path);
      await expect(nav.getByRole('link').filter({ hasNotText: /Explore in 3D|Sign in/ }), path).toHaveText(entries as string[]);
    }
    await expect(nav.getByRole('link', { name: 'Leadership' })).toHaveAttribute('aria-current', 'page');
    await expect(nav.locator('[aria-current]')).toHaveCount(1);
    await page.goto('/work/');
    await expect(nav.getByRole('link', { name: 'Work' })).toHaveAttribute('aria-current', 'page');
    // on a phone, the same entries fold into the menu
    await page.setViewportSize({ width: 390, height: 800 });
    await page.locator('[data-menu-toggle]').click();
    await expect(nav.getByRole('link').filter({ hasNotText: /Explore in 3D|Sign in/ })).toHaveText(entries as string[]);
  });

  test('each section lists its pages in its view, and an empty one says so; the home page lists the sections', async ({ page }) => {
    // the test build's private pages (tests/fixtures/private-pages): a section holding only those isn't empty
    const withPrivate = new Set((JSON.parse(readFileSync(new URL('../fixtures/private-pages/structures/overlay.json', import.meta.url), 'utf8')) as { sections: { section: string }[] }).sections.map((x) => x.section));
    for (const s of SECTIONS) {
      await page.goto(`/${s.slug}/`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(s.title);
      await expect(page.locator('main [data-view]')).toHaveAttribute('data-view', s.view ?? 'tiles');
      // a draft isn't listed: only the published pages count
      const published = (c: { item?: { id: string } }) => !c.item || ['published', 'stale'].includes((JSON.parse(readFileSync(new URL(`articles/${c.item.id}.json`, CONTENT), 'utf8')) as Article).status);
      const pages = (s.children ?? []).filter((c) => published(c as { item?: { id: string } })).length;
      if (pages) {
        await expect(page.locator('main article.card')).toHaveCount(pages);
        // a card shows its picture whole, never cropped (documentation/content/media.md §9)
        for (const img of await page.locator('main article.card img').all()) await expect(img).toHaveCSS('object-fit', 'contain');
      } else if (withPrivate.has(s.id)) {
        await expect(page.locator('[data-sign-in-line]').getByRole('heading', { level: 2 })).toHaveText('The work here is shared with invited readers');
        await expect(page.getByText('Nothing here yet. This section is being written.')).toHaveCount(0);
      } else await expect(page.getByText('Nothing here yet. This section is being written.')).toBeVisible();
    }
    await page.goto('/');
    const list = page.getByRole('list', { name: 'Sections' });
    await expect(list.getByRole('heading')).toHaveText(SECTIONS.map((s) => s.title));
    await expect(list.getByText('Being written')).toHaveCount(SECTIONS.filter((s) => !(s.children ?? []).length).length);
    // Read the site goes down to them, below the header
    await page.getByRole('main').getByRole('link', { name: 'Read the site' }).click();
    await expect.poll(() => page.evaluate(() => Math.round(document.getElementById('sections')!.getBoundingClientRect().top))).toBeGreaterThanOrEqual(56);
  });

  test('the article and its hub pass axe in light and dark', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const path of ['/', '/leadership/', '/work/', '/about/', ARTICLE]) {
        await page.goto(path);
        await noSeriousViolations(page);
      }
    }
  });
});
