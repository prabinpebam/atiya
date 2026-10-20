/**
 * Home views in the browser (documentation/home-views/plan.md, stage 2; bento.md): every strength in view on
 * the first screen, Bento's three levels (names at rest, a colleague's words on hover and focus, the evidence
 * drawer by press, Esc and `#cap-<id>`), axe in both modes, and a phone's reflow and targets. `/` stays the hub.
 */
import { devices, expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BENTO = '/views/bento/';

const noSeriousViolations = async (page: Page) => {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
};

const strengths = (page: Page) => page.locator('[data-bento-toggle]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.bentoToggle!));

// the strengths with nothing marked for them in view, unscrolled: a tile's top (its name), or on a phone its index entry
const outOfView = (page: Page) =>
  page.evaluate(() => {
    const ids = [...document.querySelectorAll<HTMLElement>('[data-bento-toggle]')].map((e) => e.dataset.bentoToggle!);
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
  test('coverage: every strength is in the first screen’s HTML and in view, wide and on a phone', async ({ page, request }) => {
    const html = await (await request.get(BENTO)).text();
    await page.goto(BENTO);
    const ids = await strengths(page);
    expect(ids.length).toBeGreaterThanOrEqual(3);
    for (const id of ids) expect(html, id).toContain(`data-capability="${id}"`);
    for (const [width, height] of [
      [1280, 800],
      [360, 740],
    ]) {
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.setViewportSize({ width, height });
        await page.emulateMedia({ colorScheme });
        await page.goto(BENTO);
        expect(await outOfView(page), `${width} by ${height}, ${colorScheme}`).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${width}: no sideways scroll`).toBe(0);
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
      const drawer = page.locator(`[data-bento-drawer="${id}"]`);
      await expect(drawer).toBeVisible();
      // its fade-in over: axe counts a part-faded link as low contrast
      await drawer.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));
      await noSeriousViolations(page);
    }
  });

  test('the home page is still the hub, and the view names it as the canonical address', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-bento]')).toHaveCount(0);
    await expect(page.locator('main[data-home-view]')).toHaveCount(0);
    // while the hub is the default, `/` offers no Change view (plan.md 2.6)
    await expect(page.locator('[data-dialog-open="change-view"]')).toHaveCount(0);
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
      return [...document.querySelectorAll('main a[href], main button')]
        .filter((e) => {
          const b = e.getBoundingClientRect();
          return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !inText(e) && !stretched(e);
        })
        .map((e) => ({ e, b: e.getBoundingClientRect() }))
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
    await page.goto(BENTO);
    expect(await shown(page)).toBe('bento');
    expect(await kept(page)).toBeNull();
    await page.goto('/');
    expect(new URL(page.url()).pathname).toBe('/');
    expect(await shown(page)).toBe('classic');
    await page.goto('/?view=bento#top');
    await expect(page).toHaveURL(/\/views\/bento\/#top$/);
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
    await dialog.locator('a[data-view-choice="bento"]').click();
    await expect(page).toHaveURL(/\/views\/bento\/$/);
    expect(await kept(page)).toBe('bento');
    await expect(page.locator('[data-home-status]')).toHaveText('Showing the Bento view');
    // `/` is replaced before it's shown: going back skips it
    const section = await page.getByRole('list', { name: 'Sections' }).getByRole('link').first().getAttribute('href');
    await page.goto(section!);
    await page.locator('header .brand a').click();
    await expect(page).toHaveURL(/\/views\/bento\/$/);
    await page.goBack();
    expect(new URL(page.url()).pathname).toBe(section);
    await page.goForward();
    await expect(page).toHaveURL(/\/views\/bento\/$/);
    // Use the default: back to `/`, nothing kept
    await (await openChoices(page)).locator('a[data-view-default]').click();
    await expect(page).toHaveURL(/\/$/);
    expect(await shown(page)).toBe('classic');
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

  test('telemetry hears the view, the lens and how the visitor came, and a switch', async ({ page }) => {
    const sent: Sent[] = [];
    await page.addInitScript(() => localStorage.setItem('site.test.telemetry', '1'));
    await page.context().route(`${TELEMETRY}/**`, async (route) => {
      const body = route.request().postData() ?? '';
      if (body) sent.push(...decode(body));
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":1}' });
    });
    await page.goto('/views/classic/');
    await (await openChoices(page)).locator('a[data-view-choice="bento"]').click();
    await expect(page).toHaveURL(/\/views\/bento\/$/);
    const ours = (name: string) => sent.filter((e) => e.event === name).map((e) => ({ view: e.properties.view, lens: e.properties.lens, source: e.properties.source, from: e.properties.from, to: e.properties.to }));
    await expect.poll(() => ours('view_switch'), { timeout: 15_000 }).toEqual([{ view: undefined, lens: undefined, source: undefined, from: 'classic', to: 'bento' }]);
    await expect.poll(() => ours('home_view'), { timeout: 15_000 }).toEqual([
      { view: 'classic', lens: 'none', source: 'link', from: undefined, to: undefined },
      { view: 'bento', lens: 'none', source: 'stored', from: undefined, to: undefined },
    ]);
  });
});