/**
 * Home views in the browser (documentation/home-views/plan.md, stages 2, 4 and 5; bento.md, cover.md, proof-grid.md,
 * spotlight.md): every strength in view on the first screen in every view, Bento's three levels (names at rest, a
 * colleague's words on hover and focus, the evidence drawer by press, Esc and `#cap-<id>`), the Cover's jumps, the
 * Proof grid's cells (keys, the address, Esc and Close, a phone's accordion), Spotlight's stage (Next, the keys, the
 * rail, Jump to, the details that follow, `#h-<id>`, motion only when asked for), Keywords (keywords.md: one Tab
 * stop, a pick and what it brings forward, `?pick=`, Remove, Clear all, Or type a skill, a phone's rows), axe in
 * both modes, a phone's reflow and targets, the role lens (`?for=`), and the page for a view the site doesn't offer.
 * `/` is the default view, whichever it is (H2), so these hold on any default.
 */
import { devices, expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';

// the default view (content/structures/ways.json): what `/` shows; and a view to choose that isn't it
const HOME = (JSON.parse(readFileSync(new URL('../../content/structures/ways.json', import.meta.url), 'utf8')) as { home?: { default?: string } }).home?.default ?? 'classic';
const PICK = HOME === 'bento' ? 'cover' : 'bento';

const BENTO = '/views/bento/';
const COVER = '/views/cover/';
const GRID = '/views/proof-grid/';
const SPOT = '/views/spotlight/';
const KEYS = '/views/keywords/';
const VIEWS = [BENTO, COVER, GRID, SPOT, KEYS];

// axe reads colours: the animations that end (a fade, a rise) are over first; a scroll-driven one never ends, and only moves
const settled = (page: Page) =>
  page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.playState === 'running' && a.timeline instanceof DocumentTimeline && Number.isFinite(Number(a.effect?.getComputedTiming().endTime)))
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );

const noSeriousViolations = async (page: Page) => {
  await settled(page);
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
};

const strengths = (page: Page) => page.locator('[data-bento-toggle]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.bentoToggle!));

// the strengths a view shows: every element marked for one carries its ID
const capabilities = (page: Page) => page.evaluate(() => [...new Set([...document.querySelectorAll<HTMLElement>('main [data-capability]')].map((e) => e.dataset.capability!))]);

// the strengths with nothing marked for them in view, unscrolled: a tile's top, a cover line, a grid row (its name)
const outOfView = (page: Page) =>
  page.evaluate(() => {
    const ids = [...new Set([...document.querySelectorAll<HTMLElement>('main [data-capability]')].map((e) => e.dataset.capability!))];
    return ids.filter(
      (id) =>
        ![...document.querySelectorAll(`[data-capability="${CSS.escape(id)}"]`)].some((e) => {
          const b = e.getBoundingClientRect();
          return e.checkVisibility() && b.width > 0 && b.top >= 0 && b.top + Math.min(b.height, 44) <= innerHeight;
        }),
    );
  });

const description = (page: Page, id: string) =>
  page.locator(`[data-bento-toggle="${id}"]`).evaluate((t) =>
    (t.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .map((ref) => document.getElementById(ref)?.textContent ?? '')
      .join(' ')
      .replace(/\s+/g, ' '),
  );

test.describe('home views', () => {
  test('coverage: every view shows every strength in its first screen’s HTML and in view, wide and on a phone', async ({ page, request }) => {
    await page.goto(BENTO);
    const ids = (await strengths(page)).sort();
    expect(ids.length).toBeGreaterThanOrEqual(3);
    for (const view of VIEWS) {
      const html = await (await request.get(view)).text();
      for (const id of ids) expect(html, `${view} ${id}`).toContain(`data-capability="${id}"`);
      for (const [width, height] of [
        [1280, 800],
        [360, 740],
      ]) {
        for (const colorScheme of ['light', 'dark'] as const) {
          await page.setViewportSize({ width, height });
          await page.emulateMedia({ colorScheme });
          await page.goto(view);
          expect((await capabilities(page)).sort(), view).toEqual(ids);
          expect(await outOfView(page), `${view} at ${width} by ${height}, ${colorScheme}`).toEqual([]);
          expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${view} at ${width}: no sideways scroll`).toBe(0);
        }
      }
    }
  });

  test('bento: names at rest, a quote on focus and hover (and in the description), the drawer by press, Close, Esc and #cap-', async ({ page }) => {
    await page.goto(BENTO);
    const ids = await strengths(page);
    const tile = page.locator('article[data-capability]').filter({ has: page.locator('.quote') }).first();
    const id = (await tile.getAttribute('data-capability'))!;
    const toggle = page.locator(`[data-bento-toggle="${id}"]`);
    const quote = tile.locator('.quote');
    const words = (await quote.textContent())!.replace(/\s+/g, ' ').trim();
    // the quote is the toggle's description, so a screen reader hears it without hovering
    expect(await description(page, id)).toContain(words.slice(0, 20));
    const opacity = () => quote.evaluate((e) => getComputedStyle(e).opacity);
    if (await tile.locator('.picture').count()) {
      await expect.poll(opacity).toBe('0');
      await toggle.focus();
      await expect.poll(opacity).toBe('1');
      await toggle.blur();
      await expect.poll(opacity).toBe('0');
      await tile.hover();
      await expect.poll(opacity).toBe('1');
    }

    // a press opens the drawer; Esc closes it and the keyboard is back on the tile
    const drawer = page.locator(`[data-bento-drawer="${id}"]`);
    await expect(drawer).toBeHidden();
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('link').first()).toBeVisible();
    expect(new URL(page.url()).hash).toBe(`#cap-${id}`);
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
    expect(new URL(page.url()).hash).toBe('');

    // Close does the same; one drawer at a time
    const other = ids.find((i) => i !== id)!;
    await toggle.click();
    await page.locator(`[data-bento-toggle="${other}"]`).click();
    await expect(drawer).toBeHidden();
    await expect(page.locator(`[data-bento-drawer="${other}"]`)).toBeVisible();
    await page.locator(`[data-bento-close="${other}"]`).click();
    await expect(page.locator(`[data-bento-drawer="${other}"]`)).toBeHidden();
    await expect(page.locator(`[data-bento-toggle="${other}"]`)).toBeFocused();

    // an address with #cap-<id> opens that strength, a link a colleague forwarded
    const last = ids[ids.length - 1];
    await page.goto(`${BENTO}#cap-${last}`);
    await expect(page.locator(`[data-bento-toggle="${last}"]`)).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator(`[data-bento-drawer="${last}"]`)).toBeInViewport();
  });

  test('axe finds nothing serious in light or dark, with a drawer open', async ({ page }) => {
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await page.goto(BENTO);
      await noSeriousViolations(page);
      const id = (await strengths(page))[0];
      await page.locator(`[data-bento-toggle="${id}"]`).click();
      await expect(page.locator(`[data-bento-drawer="${id}"]`)).toBeVisible();
      await noSeriousViolations(page);
    }
  });

  test('cover: an entry jumps to its feature under the header, Also leads to the voices, and nothing runs on its own', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(COVER);
    const ids = await capabilities(page);
    await expect(page.locator('a.entry')).toHaveCount(ids.length);
    // the features are the page's sections, one heading each under the page's one title
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.locator('section.feature h2')).toHaveCount(ids.length);
    const last = ids.at(-1)!;
    await page.locator(`a.entry[href="#cap-${last}"]`).click();
    expect(new URL(page.url()).hash).toBe(`#cap-${last}`);
    const feature = page.locator(`section.feature#cap-${last}`);
    await expect(feature.getByRole('heading', { level: 2 })).toBeInViewport();
    const below = await page.evaluate(() => document.querySelector('header')!.getBoundingClientRect().bottom);
    expect(await feature.evaluate((e) => e.getBoundingClientRect().top)).toBeGreaterThanOrEqual(below - 1);
    await expect(feature.locator('[data-evidence]').first()).toBeVisible();
    // In their words: a jump to the voices at the foot
    const words = page.locator('.also').getByRole('link', { name: 'In their words' });
    if (await words.count()) {
      const to = (await words.getAttribute('href'))!.slice(1);
      await words.click();
      await expect(page.locator(`[id="${to}"]`)).toBeInViewport();
    }
    // a cover has no script: nothing opens, nothing turns
    await expect(page.locator('main [aria-expanded]')).toHaveCount(0);
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await page.goto(COVER);
      await noSeriousViolations(page);
    }
  });

  test('spotlight: Next, the keys, the rail and Jump to change the highlight in place, the details follow, #h- addresses, nothing moves by itself', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(SPOT);
    const root = page.locator('[data-spotlight]');
    await expect(root).toHaveAttribute('data-ready', '');
    const ids = await page.locator('[data-slide]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.slide!));
    expect(ids.length).toBeGreaterThanOrEqual(4);
    const current = page.locator('[data-slide][data-current]');
    const on = async (id: string) => {
      await expect(current).toHaveCount(1);
      await expect(current).toHaveAttribute('data-slide', id);
      await expect(current).toBeVisible();
      await expect(page.locator(`[data-rail="${id}"]`)).toHaveAttribute('aria-current', 'true');
      await expect(page.locator('[data-rail][aria-current]')).toHaveCount(1);
    };
    // nothing moves by itself
    await page.waitForTimeout(1500);
    await on(ids[0]);
    expect(new URL(page.url()).hash).toBe('');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

    // Next: in place, the address follows, the status line says it, the keyboard stays on Next
    await current.locator('[data-step="next"]').click();
    await on(ids[1]);
    expect(new URL(page.url()).hash).toBe(`#h-${ids[1]}`);
    await expect(page.locator('[data-spotlight-status]')).toHaveText(new RegExp(`^2 of ${ids.length}: `));
    await current.locator('[data-step="next"]').focus();
    await page.keyboard.press('ArrowLeft');
    await on(ids[0]);
    await expect(current.locator('[data-step="next"]')).toBeFocused();
    // Previous from the first goes round to the last
    await current.locator('[data-step="prev"]').click();
    await on(ids.at(-1)!);

    // the rail
    await page.locator(`[data-rail="${ids[2]}"]`).click();
    await on(ids[2]);

    // the details: open on one, and they stay open as the highlight changes
    const toggle = current.locator('[data-spotlight-details]');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(current.locator('.details')).toBeVisible();
    await expect(current.locator('.details a').first()).toBeVisible();
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await noSeriousViolations(page);
    }
    await current.locator('[data-step="next"]').click();
    await on(ids[3]);
    await expect(current.locator('[data-spotlight-details]')).toHaveAttribute('aria-expanded', 'true');
    await expect(current.locator('.details')).toBeVisible();
    await current.locator('[data-spotlight-details]').click();
    await expect(current.locator('.details')).toBeHidden();

    // Jump to: a strength's first highlight, then its next; the chip is marked
    const chips = await page.locator('a[data-jump]').evaluateAll((els) => els.map((e) => ({ id: (e as HTMLElement).dataset.jump!, slides: ((e as HTMLElement).dataset.slides ?? '').split(' ').filter(Boolean) })));
    const many = chips.find((c) => c.slides.length > 1) ?? chips.find((c) => c.slides.length > 0)!;
    const chip = page.locator(`a[data-jump="${many.id}"]`);
    await chip.click();
    await on(many.slides[0]);
    await expect(chip).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('a[data-jump][aria-current]')).toHaveCount(1);
    await chip.click();
    await on(many.slides[1 % many.slides.length]);

    // an address names a highlight, on the page (a hash change) and on arrival; one it doesn't know changes nothing,
    // and on arrival shows the first
    await page.goto(`${SPOT}#h-${ids[2]}`);
    await on(ids[2]);
    await page.goto(`${SPOT}#h-no-such-highlight`);
    await on(ids[2]);
    await page.goto('about:blank');
    await page.goto(`${SPOT}#h-${ids[4] ?? ids[1]}`);
    await on(ids[4] ?? ids[1]);
    await page.goto('about:blank');
    await page.goto(`${SPOT}#h-no-such-highlight`);
    await on(ids[0]);
  });

  test('spotlight: a change moves only as the site asks, and never for a visitor who asks for less motion', async ({ page }) => {
    const moving = () => page.locator('[data-slide][data-current]').evaluate((e) => getComputedStyle(e).animationName);
    await page.goto(SPOT);
    await expect(page.locator('[data-spotlight]')).toHaveAttribute('data-ready', '');
    // the first highlight's arrival isn't a change
    expect(await moving()).toBe('none');
    await page.locator('[data-slide][data-current] [data-step="next"]').click();
    expect(await moving()).not.toBe('none');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(SPOT);
    await expect(page.locator('[data-spotlight]')).toHaveAttribute('data-ready', '');
    await page.locator('[data-slide][data-current] [data-step="next"]').click();
    await expect(page.locator('[data-slide][data-current]')).toBeVisible();
    expect(await moving()).toBe('none');
  });

  test('proof grid: one tab stop, arrows between the cells, a cell opens its kind and a name all of it, Esc and Close, #cap-', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(GRID);
    const ids = await capabilities(page);
    const row = (id: string) => page.locator(`tr[data-row="${id}"]`);
    const name = page.locator(`[data-grid-open="${ids[0]}"][data-kind="all"]`);
    const evidence = page.locator(`[data-grid-evidence="${ids[0]}"]`);
    const groups = () => evidence.locator('[data-group]').evaluateAll((gs) => gs.filter((g) => !(g as HTMLElement).hidden).map((g) => (g as HTMLElement).dataset.group));
    // one tab stop for the whole table
    await expect(page.locator('[data-grid-open][tabindex="0"]')).toHaveCount(1);
    await expect(name).toHaveAttribute('tabindex', '0');
    // nothing open on a wide screen
    await expect(page.locator('tr[data-open]')).toHaveCount(0);

    // right to the row's first cell with proof; its name says it all, so the fill isn't the only cue
    await name.focus();
    await page.keyboard.press('ArrowRight');
    const cell = row(ids[0]).locator('button.cell').first();
    await expect(cell).toBeFocused();
    await expect(cell).toHaveAttribute('aria-label', /\d/);
    const kind = (await cell.getAttribute('data-kind'))!;
    await page.keyboard.press('Enter');
    await expect(evidence).toBeVisible();
    await expect(cell).toHaveAttribute('aria-expanded', 'true');
    await expect(row(ids[0])).toHaveAttribute('data-open', '');
    await expect(evidence).toHaveAttribute('aria-label', /.+/);
    expect(await groups()).toEqual([kind]);
    expect(new URL(page.url()).hash).toBe(`#cap-${ids[0]}-${kind}`);
    await noSeriousViolations(page);

    // Esc: closed, the keyboard back on the cell (Tab back in lands there), the address clear
    await page.keyboard.press('Escape');
    await expect(evidence).toBeHidden();
    await expect(cell).toBeFocused();
    await expect(cell).toHaveAttribute('aria-expanded', 'false');
    await expect(cell).toHaveAttribute('tabindex', '0');
    expect(new URL(page.url()).hash).toBe('');

    // Home: the row's name, which opens all of it; Close puts the keyboard back on the name
    await page.keyboard.press('Home');
    await expect(name).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(evidence).toBeVisible();
    expect(await groups()).toEqual(await evidence.locator('[data-group]').evaluateAll((gs) => gs.map((g) => (g as HTMLElement).dataset.group)));
    expect(new URL(page.url()).hash).toBe(`#cap-${ids[0]}`);
    await evidence.locator('[data-grid-close]').click();
    await expect(evidence).toBeHidden();
    await expect(name).toBeFocused();

    // Ctrl+End: the table's last cell; one row open at a time
    const last = ids.at(-1)!;
    const end = row(last).locator('[data-grid-open]').last();
    await page.keyboard.press('Control+End');
    await expect(end).toBeFocused();
    await name.click();
    await end.click();
    await expect(evidence).toBeHidden();
    await expect(page.locator(`[data-grid-evidence="${last}"]`)).toBeVisible();
    await expect(page.locator('tr[data-open]')).toHaveCount(1);

    // an address opens it, a link a colleague forwarded
    const far = row(ids[1]).locator('button.cell').first();
    const farKind = (await far.getAttribute('data-kind'))!;
    await page.goto('about:blank');
    await page.goto(`${GRID}#cap-${ids[1]}-${farKind}`);
    await expect(far).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator(`[data-grid-evidence="${ids[1]}"]`)).toBeInViewport();
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await noSeriousViolations(page);
    }
  });

  test('a view the site doesn’t offer says so, isn’t indexed and leads home', async ({ page }) => {
    const response = await page.goto('/views/showreel/');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/This view isn.t offered/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    await expect(page.locator('main[data-home-view]')).toHaveCount(0);
    await page.getByRole('link', { name: 'Go to the home page' }).click();
    expect(new URL(page.url()).pathname).toBe('/');
  });

  test('the home page is the default view, and a view names it as the canonical address', async ({ page }) => {
    await page.goto('/');
    if (HOME === 'classic') {
      await expect(page.locator('[data-bento]')).toHaveCount(0);
      await expect(page.locator('main[data-home-view]')).toHaveCount(0);
      // while the hub is the default, `/` offers no Change view (plan.md 2.6)
      await expect(page.locator('[data-dialog-open="change-view"]')).toHaveCount(0);
    } else {
      await expect(page.locator(`main[data-home-view="${HOME}"]`)).toHaveCount(1);
      await expect(page.locator('[data-dialog-open="change-view"]').first()).toBeVisible();
      await expect(page.getByRole('list', { name: 'Sections' })).toBeVisible();
    }
    await page.goto(BENTO);
    await expect(page.locator('main[data-home-view="bento"]')).toHaveCount(1);
    expect(new URL((await page.locator('link[rel="canonical"]').getAttribute('href'))!).pathname).toBe('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('list', { name: 'Sections' })).toBeVisible();
  });
});

const { defaultBrowserType: _browser, ...PIXEL } = devices['Pixel 7'];

test.describe('home views on a phone', () => {
  test.use(PIXEL);

  // controls smaller than 44 px, leaving out links inside a sentence and stretched links (their card is the target)
  const smallTargets = (page: Page) =>
    page.evaluate(() => {
      const inText = (e: Element) => {
        const p = e.parentElement;
        return e.tagName === 'A' && !!p && ['P', 'LI', 'FIGCAPTION', 'SPAN', 'EM', 'STRONG', 'DIV'].includes(p.tagName) && p.textContent!.trim().length > e.textContent!.trim().length + 5;
      };
      const stretched = (e: Element) => getComputedStyle(e, '::after').position === 'absolute';
      // a small control's touch area can be a ::before set out round it (IconButton's sm): count that area
      const hit = (e: Element) => {
        const b = e.getBoundingClientRect();
        const s = getComputedStyle(e, '::before');
        if (s.position !== 'absolute' || s.content === 'none') return b;
        const px = (v: string) => parseFloat(v) || 0;
        return { width: b.width - px(s.left) - px(s.right), height: b.height - px(s.top) - px(s.bottom) };
      };
      return [...document.querySelectorAll('main a[href], main button')]
        .filter((e) => {
          const b = e.getBoundingClientRect();
          return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !inText(e) && !stretched(e);
        })
        .map((e) => ({ e, b: hit(e) }))
        .filter(({ b }) => b.height < 44 || b.width < 44)
        .map(({ e, b }) => `${e.tagName} "${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24)}" ${Math.round(b.width)}x${Math.round(b.height)}`);
    });

  test('no sideways scroll and 44 px targets from 320 px, with a drawer open', async ({ page }) => {
    for (const size of [
      { width: 320, height: 640 },
      { width: 360, height: 740 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(size);
      await page.goto(BENTO);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${size.width}`).toBe(0);
      expect(await smallTargets(page), `${size.width}`).toEqual([]);
      const id = (await strengths(page))[0];
      await page.locator(`[data-bento-toggle="${id}"]`).click();
      await expect(page.locator(`[data-bento-drawer="${id}"]`)).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${size.width}, open`).toBe(0);
      expect(await smallTargets(page), `${size.width}, open`).toEqual([]);
    }
  });

  test('the cover and the proof grid: no sideways scroll and 44 px targets from 320 px, with evidence open', async ({ page }) => {
    for (const size of [
      { width: 320, height: 640 },
      { width: 360, height: 740 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(size);
      for (const view of [COVER, GRID]) {
        await page.goto(view);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${view} at ${size.width}`).toBe(0);
        expect(await smallTargets(page), `${view} at ${size.width}`).toEqual([]);
      }
      const id = (await capabilities(page))[1];
      await page.locator(`[data-grid-open="${id}"][data-kind="all"]`).click();
      await expect(page.locator(`[data-grid-evidence="${id}"]`)).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${size.width}, open`).toBe(0);
      expect(await smallTargets(page), `${size.width}, open`).toEqual([]);
    }
  });

  test('spotlight on a phone: no sideways scroll and 44 px targets from 320 px with the details open, and a swipe changes the highlight', async ({ page }) => {
    for (const size of [
      { width: 320, height: 640 },
      { width: 360, height: 740 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(size);
      await page.goto(SPOT);
      await expect(page.locator('[data-spotlight]')).toHaveAttribute('data-ready', '');
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${size.width}`).toBe(0);
      expect(await smallTargets(page), `${size.width}`).toEqual([]);
      await page.locator('[data-slide][data-current] [data-spotlight-details]').click();
      await expect(page.locator('[data-slide][data-current] .details')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${size.width}, open`).toBe(0);
      expect(await smallTargets(page), `${size.width}, open`).toEqual([]);
    }
    // a swipe to the left is Next, to the right Previous (real touch events)
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(SPOT);
    await expect(page.locator('[data-spotlight]')).toHaveAttribute('data-ready', '');
    const ids = await page.locator('[data-slide]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.slide!));
    const cdp = await page.context().newCDPSession(page);
    const swipe = async (dx: number) => {
      const picture = page.locator('[data-slide][data-current] .picture, [data-slide][data-current] .panel').first();
      await picture.scrollIntoViewIfNeeded();
      const b = (await picture.boundingBox())!;
      const y = b.y + Math.min(b.height / 2, 60);
      const x0 = b.x + b.width / 2 - dx / 2;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
      for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (dx * i) / 6, y }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    await swipe(-160);
    await expect(page.locator('[data-slide][data-current]')).toHaveAttribute('data-slide', ids[1]);
    await swipe(160);
    await expect(page.locator('[data-slide][data-current]')).toHaveAttribute('data-slide', ids[0]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  });

  test('keywords on a phone: rows that open their keywords, no sideways scroll and 44 px targets from 320 px, with picks made', async ({ page }) => {
    for (const size of [
      { width: 320, height: 640 },
      { width: 360, height: 740 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(size);
      await page.goto(KEYS);
      await expect(page.locator('[data-keywords]')).toHaveAttribute('data-ready', '');
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${size.width}`).toBe(0);
      expect(await smallTargets(page), `${size.width}`).toEqual([]);
      const group = page.locator('[data-kw-group]').first();
      const row = group.locator('[data-kw-row]');
      const chip = group.locator('[data-kw]').first();
      if (size.width < 576) {
        // a row per strength, closed: its keywords are out of the Tab order until it opens
        await expect(row).toBeVisible();
        await expect(row).toHaveAttribute('aria-expanded', 'false');
        await expect(chip).toBeHidden();
        await row.click();
        await expect(row).toHaveAttribute('aria-expanded', 'true');
        await expect(chip).toBeVisible();
        await expect(chip).toHaveAttribute('tabindex', '0');
      } else await expect(row).toBeHidden();
      await chip.click();
      await expect(chip).toHaveAttribute('aria-pressed', 'true');
      if (size.width < 576) await expect(row).toContainText('1 picked');
      await expect(page.locator('[data-kw-tray]')).toBeVisible();
      await page.locator('[data-kw-cards] [data-kw-item]:not([hidden]) [data-kw-open]').first().click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${size.width}, picked`).toBe(0);
      expect(await smallTargets(page), `${size.width}, picked`).toEqual([]);
    }
  });

  test('proof grid on a phone: an accordion, the first row open on its kinds, a kind opens its evidence', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(GRID);
    const ids = await capabilities(page);
    const first = page.locator(`tr[data-row="${ids[0]}"]`);
    // no table head; the first row shows its kinds, each a button with its name and count, its evidence a press away
    await expect(page.locator('[data-proof-grid] thead')).toBeHidden();
    await expect(first).toHaveAttribute('data-open', '');
    await expect(page.locator('tr[data-open]')).toHaveCount(1);
    const kind = first.locator('button.cell').first();
    await expect(kind).toBeVisible();
    await expect(kind.locator('.kind')).toBeVisible();
    await expect(page.locator(`[data-grid-evidence="${ids[0]}"]`)).toBeHidden();
    // the closed rows say how much proves them
    await expect(page.locator(`tr[data-row="${ids[1]}"] .total`)).toHaveText(/\d+ proofs?/);
    expect(new URL(page.url()).hash).toBe('');
    await kind.click();
    await expect(page.locator(`[data-grid-evidence="${ids[0]}"]`)).toBeVisible();
    // another row's name: that one opens, the first closes
    await page.locator(`[data-grid-open="${ids[2]}"][data-kind="all"]`).click();
    await expect(page.locator(`[data-grid-evidence="${ids[0]}"]`)).toBeHidden();
    await expect(page.locator(`[data-grid-evidence="${ids[2]}"]`)).toBeVisible();
    await expect(page.locator('tr[data-open]')).toHaveCount(1);
    await noSeriousViolations(page);
  });

  test('the index jumps to a tile and puts the keyboard on it, without opening it', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(BENTO);
    const ids = await strengths(page);
    const last = ids[ids.length - 1];
    await page.locator(`[data-bento-jump="${last}"]`).click();
    const toggle = page.locator(`[data-bento-toggle="${last}"]`);
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeInViewport();
  });
});

// Change view (switcher.md; plan.md 2b): a link shows a view, a choice keeps it on this device, `/` follows it
// before the first paint, Use the default clears it, and telemetry hears view IDs only
const TELEMETRY = 'https://telemetry.test';
type Sent = { event: string; properties: Record<string, unknown> };
const decode = (body: string): Sent[] => {
  const parse = (s: string): Sent[] => {
    const v = JSON.parse(s) as Sent | Sent[] | { batch: Sent[] };
    return Array.isArray(v) ? v : 'batch' in v ? v.batch : [v];
  };
  try {
    return parse(body);
  } catch {
    const data = new URLSearchParams(body).get('data');
    return data ? parse(Buffer.from(data, 'base64').toString('utf8')) : [];
  }
};
const kept = (page: Page) => page.evaluate(() => localStorage.getItem('site.homeView'));
const shown = (page: Page) => page.evaluate(() => document.documentElement.dataset.homeView);
const openChoices = async (page: Page) => {
  await page.locator('[data-dialog-open="change-view"]').first().click();
  const dialog = page.getByRole('dialog', { name: 'Change view' });
  await expect(dialog).toBeVisible();
  return dialog;
};

test.describe('home views: change view', () => {
  test('a link shows its view without keeping it, and `?view=` at the root does the same', async ({ page }) => {
    await page.goto(`/views/${PICK}/`);
    expect(await shown(page)).toBe(PICK);
    expect(await kept(page)).toBeNull();
    await page.goto('/');
    expect(new URL(page.url()).pathname).toBe('/');
    expect(await shown(page)).toBe(HOME);
    await page.goto(`/?view=${PICK}#top`);
    await expect(page).toHaveURL(new RegExp(`/views/${PICK}/#top$`));
    expect(await kept(page)).toBeNull();
  });

  test('a card keeps the choice, `/` and an in-site link to it follow it, and Use the default clears it', async ({ page }) => {
    await page.goto('/views/classic/');
    expect(await shown(page)).toBe('classic');
    const dialog = await openChoices(page);
    // the view showing is marked, and has the focus
    const current = dialog.locator('a[data-view-choice="classic"]');
    await expect(current).toHaveAttribute('aria-current', 'page');
    await expect(current).toBeFocused();
    const picked = new RegExp(`/views/${PICK}/$`);
    const label = (JSON.parse(readFileSync(new URL('../../src/site/home/catalogue.json', import.meta.url), 'utf8')) as { views: Record<string, { label: string }> }).views[PICK].label;
    await dialog.locator(`a[data-view-choice="${PICK}"]`).click();
    await expect(page).toHaveURL(picked);
    expect(await kept(page)).toBe(PICK);
    await expect(page.locator('[data-home-status]')).toHaveText(`Showing the ${label} view`);
    // `/` is replaced before it's shown: going back skips it
    const section = await page.getByRole('list', { name: 'Sections' }).getByRole('link').first().getAttribute('href');
    await page.goto(section!);
    await page.locator('header .brand a').click();
    await expect(page).toHaveURL(picked);
    await page.goBack();
    expect(new URL(page.url()).pathname).toBe(section);
    await page.goForward();
    await expect(page).toHaveURL(picked);
    // Use the default: back to `/`, nothing kept
    await (await openChoices(page)).locator('a[data-view-default]').click();
    await expect(page).toHaveURL(/\/$/);
    expect(await shown(page)).toBe(HOME);
    expect(await kept(page)).toBeNull();
  });

  test('a kept choice the site no longer offers is dropped', async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem('site.homeView', 'no-such-view');
      }
    });
    await page.goto('/');
    expect(new URL(page.url()).pathname).toBe('/');
    expect(await kept(page)).toBeNull();
  });

  test('the dialog: keyboard, Esc back to its opener, and axe in both modes', async ({ page }) => {
    await page.goto(BENTO);
    const opener = page.locator('[data-dialog-open="change-view"]').last();
    await opener.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Change view' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('a[data-view-choice="bento"]')).toBeFocused();
    // (axe reads colours: wait for the dialog's rise to end)
    await dialog.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
      await noSeriousViolations(page);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('telemetry hears the view, the lens and how the visitor came, a switch and the evidence opened', async ({ page }) => {
    const sent: Sent[] = [];
    await page.addInitScript(() => localStorage.setItem('site.test.telemetry', '1'));
    await page.context().route(`${TELEMETRY}/**`, async (route) => {
      const body = route.request().postData() ?? '';
      if (body) sent.push(...decode(body));
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":1}' });
    });
    await page.goto('/views/classic/');
    await (await openChoices(page)).locator(`a[data-view-choice="${PICK}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/views/${PICK}/$`));
    const ours = (name: string) => sent.filter((e) => e.event === name).map((e) => ({ view: e.properties.view, lens: e.properties.lens, source: e.properties.source, from: e.properties.from, to: e.properties.to }));
    await expect.poll(() => ours('view_switch'), { timeout: 15_000 }).toEqual([{ view: undefined, lens: undefined, source: undefined, from: 'classic', to: PICK }]);
    await expect.poll(() => ours('home_view'), { timeout: 15_000 }).toEqual([
      { view: 'classic', lens: 'none', source: 'link', from: undefined, to: undefined },
      { view: PICK, lens: 'none', source: 'stored', from: undefined, to: undefined },
    ]);
    // a proof grid's cell: the strength, the view and the kind, nothing else
    await page.goto(GRID);
    const cell = page.locator('[data-proof-grid] button.cell').first();
    const [id, kind] = await cell.evaluate((b) => [b.dataset.gridOpen, b.dataset.kind]);
    await cell.click();
    await expect
      .poll(() => sent.filter((e) => e.event === 'capability_l3_open').map((e) => ({ id: e.properties.id, view: e.properties.view, kind: e.properties.kind })), { timeout: 15_000 })
      .toEqual([{ id, view: 'proof-grid', kind }]);
    // a spotlight's change: the highlight and how it was reached
    await page.goto(SPOT);
    await expect(page.locator('[data-spotlight]')).toHaveAttribute('data-ready', '');
    const next = await page.locator('[data-slide]').nth(1).getAttribute('data-slide');
    await page.locator('[data-slide][data-current] [data-step="next"]').click();
    await expect
      .poll(() => sent.filter((e) => e.event === 'highlight_view').map((e) => ({ id: e.properties.id, how: e.properties.how })), { timeout: 15_000 })
      .toEqual([{ id: next, how: 'next' }]);
  });
});

// The role lens (foundation.md §6; plan.md 2c): `?for=` orders every view for a role and keeps it for the visit;
// it puts the role's strength first and never hides one; Use usual order clears it
const lensKept = (page: Page) => page.evaluate(() => sessionStorage.getItem('site.homeLens'));
const arrived = async (page: Page, url: RegExp) => {
  await expect(page).toHaveURL(url);
  await page.waitForLoadState();
};

test.describe('home views: role lens', () => {
  test('`?for=` puts the role’s strength first in every view, hides none, is kept for the visit and cleared by Use usual order', async ({ page }) => {
    await page.goto(BENTO);
    const all = (await capabilities(page)).sort();
    await page.goto('/?for=ai');
    await arrived(page, /\/views\/[\w-]+\/for\/ai\/$/);
    expect(await lensKept(page)).toBe('ai');
    for (const view of VIEWS) {
      // a view's own address follows the lens kept for the visit
      await page.goto(view);
      await arrived(page, new RegExp(`${view}for/ai/$`));
      const shownIds = await capabilities(page);
      expect(shownIds[0], view).toBe('ai');
      expect([...shownIds].sort(), view).toEqual(all);
      const note = page.locator('[data-lens-clear]').first().locator('..');
      await expect(note).toContainText('Ordered for');
      await expect(note).toContainText('AI and design');
    }
    // on a phone the note gives way, so every strength stays in the first screen; Change view still names the lens
    await page.setViewportSize({ width: 360, height: 740 });
    for (const view of VIEWS) {
      await page.goto(`${view}for/ai/`);
      expect(await outOfView(page), `${view}for/ai/ on a phone`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${view}for/ai/: no sideways scroll`).toBe(0);
      await expect(page.getByText('Ordered for')).toBeHidden();
    }
    await expect((await openChoices(page)).locator('a[data-lens-choice][aria-current]')).toHaveText('AI and design');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BENTO}for/ai/`);
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await noSeriousViolations(page);
    }
    // Change view names the lens showing and offers the others
    const dialog = await openChoices(page);
    await expect(dialog.locator('a[data-lens-choice][aria-current]')).toHaveText('AI and design');
    await dialog.locator('a[data-lens-choice]', { hasText: 'Design leader' }).click();
    await arrived(page, /\/views\/bento\/for\/leader\/$/);
    expect(await lensKept(page)).toBe('leader');
    await expect(page.locator('[data-lens-clear]').first().locator('..')).toContainText('Design leader');
    // Use usual order: the view without a lens, nothing kept
    await page.locator('[data-lens-clear]').first().click();
    await arrived(page, /\/views\/bento\/$/);
    expect(await lensKept(page)).toBeNull();
    await expect(page.getByText('Ordered for')).toHaveCount(0);
    await page.goto(COVER);
    await arrived(page, /\/views\/cover\/$/);
  });
});

// Keywords (keywords.md; plan.md stage 6): the field is one Tab stop; a pick brings its matches forward, says so and
// is kept in the address; Remove and Clear all; Or type a skill finds labels and synonyms, and says honestly when the
// site shows nothing for a skill
type IndexedKeyword = { id: string; label: string; synonyms: string[]; matches: string[] };
const keywordIndex = (page: Page) => page.locator('[data-kw-index]').evaluate((e) => JSON.parse(e.textContent!) as IndexedKeyword[]);
const matchCount = (n: number) => (n === 1 ? '1 match' : `${n} matches`);
const picksIn = (page: Page) => new URL(page.url()).searchParams.get('pick');

test.describe('home views: keywords', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(KEYS);
    await expect(page.locator('[data-keywords]')).toHaveAttribute('data-ready', '');
  });

  test('one Tab stop, the arrows, a pick says what it found and brings it forward, the address keeps the picks, Remove and Clear all', async ({ page }) => {
    const words = await keywordIndex(page);
    expect(words.length).toBeGreaterThanOrEqual(3);
    const chips = page.locator('[data-kw]');
    const status = page.locator('[data-kw-status]');
    expect(await chips.evaluateAll((els) => els.filter((e) => (e as HTMLElement).tabIndex === 0).length)).toBe(1);
    await expect(page.locator('[data-kw-tray]')).toBeHidden();
    await expect(page.locator('[data-kw-summaries]')).toBeVisible();

    // the arrows move the one stop; Space picks
    await chips.first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(chips.nth(1)).toBeFocused();
    await expect(chips.nth(1)).toHaveAttribute('tabindex', '0');
    await expect(chips.first()).toHaveAttribute('tabindex', '-1');
    await page.keyboard.press('Space');
    const a = words[1];
    await expect(chips.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(status).toHaveText(`${a.label} picked. ${matchCount(a.matches.length)}.`);
    expect(picksIn(page)).toBe(a.id);
    await expect(page.locator(`[data-kw-tray-item="${a.id}"]`)).toBeVisible();
    await expect(page.locator('[data-kw-summaries]')).toBeHidden();
    await expect(page.locator('[data-kw-heading]')).toHaveText(`${matchCount(a.matches.length)}, best first`);
    const cards = page.locator('[data-kw-cards] [data-kw-item]:visible');
    await expect(cards).toHaveCount(Math.min(a.matches.length, 6));
    await expect(cards.first().locator('[data-kw-why]')).toHaveText(`Match: ${a.label}`);
    // a match opens its links
    const open = cards.first().locator('[data-kw-open]');
    await open.click();
    await expect(open).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator(`#${await open.getAttribute('aria-controls')}`)).toBeVisible();

    // End, then Space: a second pick, both in the address in the order picked
    await chips.nth(1).focus();
    await page.keyboard.press('End');
    await expect(chips.last()).toBeFocused();
    await page.keyboard.press('Space');
    const b = words[words.length - 1];
    expect(picksIn(page)).toBe(`${a.id},${b.id}`);

    // the address brings the picks back
    await page.reload();
    await expect(page.locator('[data-keywords]')).toHaveAttribute('data-ready', '');
    await expect(page.locator(`[data-kw="${a.id}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(`[data-kw="${b.id}"]`)).toHaveAttribute('aria-pressed', 'true');
    expect(await page.locator('[data-kw-tray-item]:visible').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.kwTrayItem))).toEqual([a.id, b.id]);

    // Remove keeps the keyboard in the tray
    await page.locator(`[data-kw-remove="${a.id}"]`).click();
    await expect(page.locator(`[data-kw-remove="${b.id}"]`)).toBeFocused();
    await expect(status).toHaveText(`${a.label} removed. ${matchCount(b.matches.length)}.`);
    expect(picksIn(page)).toBe(b.id);

    // Clear all: every strength again, the keyboard back in the field, the address clean
    await page.locator('[data-kw-clear]').click();
    await expect(status).toHaveText('Picks cleared. Showing every strength.');
    await expect(page.locator('[data-kw-tray]')).toBeHidden();
    await expect(page.locator('[data-kw-summaries]')).toBeVisible();
    await expect(page.locator('[data-kw][tabindex="0"]')).toBeFocused();
    expect(picksIn(page)).toBeNull();
  });

  test('Or type a skill: a synonym finds its keyword, the arrows and Enter pick it, Esc closes, and a skill the site doesn’t show says so', async ({ page }) => {
    const words = await keywordIndex(page);
    const k = words.find((w) => w.synonyms.some((s) => s.length >= 3 && !w.label.toLowerCase().includes(s)));
    expect(k, 'a keyword with a synonym').toBeTruthy();
    const synonym = k!.synonyms.find((s) => s.length >= 3 && !k!.label.toLowerCase().includes(s))!;
    const input = page.locator('[data-kw-type] input');
    await input.fill(synonym);
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    const shown = await page.locator('[data-kw-option]:visible').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.kwOption!));
    expect(shown).toContain(k!.id);
    for (let i = 0; i <= shown.indexOf(k!.id); i++) await page.keyboard.press('ArrowDown');
    const option = page.locator(`[data-kw-option="${k!.id}"]`);
    await expect(option).toHaveAttribute('aria-selected', 'true');
    await expect(input).toHaveAttribute('aria-activedescendant', (await option.getAttribute('id'))!);
    await page.keyboard.press('Enter');
    await expect(page.locator(`[data-kw="${k!.id}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(input).toHaveValue('');
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('[data-kw-status]')).toHaveText(`${k!.label} picked. ${matchCount(k!.matches.length)}.`);

    // Esc closes the suggestions, then clears the text
    await input.fill(synonym);
    await expect(page.locator('[data-kw-suggestions]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-kw-suggestions]')).toBeHidden();
    await expect(input).toHaveValue(synonym);
    await page.keyboard.press('Escape');
    await expect(input).toHaveValue('');

    // nothing on the site for it: said plainly, and Ask me about it carries the skill
    const skill = 'Underwater basket weaving';
    await input.fill(skill);
    await expect(page.locator('[data-kw-suggestions]')).toBeHidden();
    await page.keyboard.press('Enter');
    const none = page.locator('[data-kw-none]');
    await expect(none).toBeVisible();
    await expect(none).toContainText(`Nothing on the site shows ${skill} yet.`);
    await expect(page.locator('[data-kw-status]')).toHaveText(`Nothing on the site shows ${skill} yet.`);
    const ask = none.locator('[data-kw-none-ask]');
    if (await ask.count()) expect(new URL((await ask.getAttribute('href'))!, page.url()).searchParams.get('topic')).toBe(skill);
  });

  test('axe finds nothing serious in light or dark, with picks made and a match open', async ({ page }) => {
    const words = await keywordIndex(page);
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await page.goto(KEYS);
      await noSeriousViolations(page);
      await page.goto(`${KEYS}?pick=${words[0].id},${words[words.length - 1].id}`);
      await expect(page.locator('[data-kw-tray]')).toBeVisible();
      await page.locator('[data-kw-cards] [data-kw-item]:not([hidden]) [data-kw-open]').first().click();
      await page.locator('[data-kw-type] input').fill('Underwater basket weaving');
      await page.keyboard.press('Enter');
      await expect(page.locator('[data-kw-none]')).toBeVisible();
      await noSeriousViolations(page);
    }
  });

  test('telemetry hears a pick and whether a typed skill matched, never the words typed', async ({ page }) => {
    const sent: Sent[] = [];
    await page.addInitScript(() => localStorage.setItem('site.test.telemetry', '1'));
    await page.context().route(`${TELEMETRY}/**`, async (route) => {
      const body = route.request().postData() ?? '';
      if (body) sent.push(...decode(body));
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":1}' });
    });
    await page.goto(KEYS);
    await expect(page.locator('[data-keywords]')).toHaveAttribute('data-ready', '');
    const words = await keywordIndex(page);
    await page.locator(`[data-kw="${words[0].id}"]`).click();
    await page.locator(`[data-kw="${words[0].id}"]`).click();
    const input = page.locator('[data-kw-type] input');
    await input.fill(words[1].label);
    await page.keyboard.press('Enter');
    await input.fill('Underwater basket weaving');
    await page.keyboard.press('Enter');
    await expect
      .poll(() => sent.filter((e) => e.event === 'keyword_pick').map((e) => e.properties), { timeout: 15_000 })
      .toEqual([expect.objectContaining({ id: words[0].id, on: true }), expect.objectContaining({ id: words[0].id, on: false }), expect.objectContaining({ id: words[1].id, on: true })]);
    await expect.poll(() => sent.filter((e) => e.event === 'skill_typed').map((e) => e.properties.matched), { timeout: 15_000 }).toEqual([true, false]);
    expect(JSON.stringify(sent)).not.toContain('basket');
  });
});