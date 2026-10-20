/**
 * Home views in the browser (documentation/home-views/plan.md, stages 2 and 4; bento.md, cover.md, proof-grid.md):
 * every strength in view on the first screen in every view, Bento's three levels (names at rest, a colleague's words
 * on hover and focus, the evidence drawer by press, Esc and `#cap-<id>`), the Cover's jumps, the Proof grid's cells
 * (keys, the address, Esc and Close, a phone's accordion), axe in both modes, a phone's reflow and targets, and the
 * page for a view the site doesn't offer. `/` stays the hub.
 */
import { devices, expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BENTO = '/views/bento/';
const COVER = '/views/cover/';
const GRID = '/views/proof-grid/';
const VIEWS = [BENTO, COVER, GRID];

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
    const response = await page.goto('/views/spotlight/');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/This view isn.t offered/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    await expect(page.locator('main[data-home-view]')).toHaveCount(0);
    await page.getByRole('link', { name: 'Go to the home page' }).click();
    expect(new URL(page.url()).pathname).toBe('/');
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

  test('telemetry hears the view, the lens and how the visitor came, a switch and the evidence opened', async ({ page }) => {
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
    // a proof grid's cell: the strength, the view and the kind, nothing else
    await page.goto(GRID);
    const cell = page.locator('[data-proof-grid] button.cell').first();
    const [id, kind] = await cell.evaluate((b) => [b.dataset.gridOpen, b.dataset.kind]);
    await cell.click();
    await expect
      .poll(() => sent.filter((e) => e.event === 'capability_l3_open').map((e) => ({ id: e.properties.id, view: e.properties.view, kind: e.properties.kind })), { timeout: 15_000 })
      .toEqual([{ id, view: 'proof-grid', kind }]);
  });
});