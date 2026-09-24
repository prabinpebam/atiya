import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

type GameState = {
  phase: string;
  pLocal: [number, number, number];
  nearby: string | null;
  open: string | null;
  menuOpen: boolean;
  traveling: string | null;
  atSpawn: boolean;
  autoWalk: boolean;
  avatar: 'model' | 'procedural';
  quality: 'high' | 'low';
  postLevel: 1 | 2;
  postFx: string;
  dpr: number;
  hours: number;
  night: number;
  glow: number;
  timeMode: 'cycle' | 'local' | 'day';
};

const state = (page: Page) => page.evaluate(() => (window as any).__game.getState() as GameState);

/** Load /play, accept the software-rendering interstitial (headless SwiftShader), wait for the game. */
async function openPlanet(page: Page, path = '/play/') {
  await page.goto(path);
  const cont = page.getByRole('button', { name: 'Continue anyway' });
  await page.waitForFunction(() => (window as any).__game || document.querySelector('[data-gate-continue]'));
  if (await cont.isVisible()) await cont.click();
  await page.waitForFunction(() => (window as any).__game && (window as any).__game.getState().phase !== 'loading', null, { timeout: 30_000 });
}

async function startPlanet(page: Page) {
  await openPlanet(page);
  await page.getByRole('button', { name: 'Start exploring' }).click();
  await expect.poll(async () => (await state(page)).phase).toBe('playing');
}

const noSeriousViolations = async (page: Page) => {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
};

test.describe('landing & classic', () => {
  test('landing ships no game JS and offers both modes', async ({ page }) => {
    const scripts: string[] = [];
    page.on('request', (r) => r.resourceType() === 'script' && scripts.push(r.url()));
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Explore the planet' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Classic site' })).toBeVisible();
    expect(scripts.filter((s) => /_astro\//.test(s))).toEqual([]);
    await noSeriousViolations(page);
  });

  test('classic pages render content and link back into 3D', async ({ page }) => {
    await page.goto('/classic/workshop/');
    await expect(page.getByRole('heading', { level: 1, name: 'Workshop' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Explore in 3D' })).toHaveAttribute('href', '/play/?at=workshop');
    await noSeriousViolations(page);
    await page.goto('/classic/');
    await noSeriousViolations(page);
  });

  test('?mode=classic redirects to the classic site and remembers it', async ({ page }) => {
    await page.goto('/play/?mode=classic');
    await expect(page).toHaveURL(/\/classic\/$/);
    expect(await page.evaluate(() => localStorage.getItem('site.mode'))).toBe('classic');
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Classic site' })).toHaveClass(/primary/);
  });
});

test.describe('capability gate', () => {
  test('no WebGL2 → classic fallback, and the game bundle is never requested', async ({ page }) => {
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        if (type === 'webgl2' || type === 'webgl') return null;
        return (orig as any).call(this, type, ...rest);
      } as typeof orig;
    });
    const scripts: string[] = [];
    page.on('request', (r) => r.resourceType() === 'script' && scripts.push(r.url()));
    await page.goto('/play/');
    await expect(page.getByRole('heading', { name: "Your browser can't show the 3D planet" })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to the classic site' })).toBeFocused();
    await page.waitForTimeout(500);
    expect(scripts.filter((s) => /game-mount|client\./.test(s))).toEqual([]);
    await noSeriousViolations(page);
  });

  test('bundle load failure → Retry / Classic', async ({ page }) => {
    await page.route('**/game-mount*.js', (r) => r.abort());
    await page.goto('/play/');
    const cont = page.getByRole('button', { name: 'Continue anyway' });
    if (await cont.isVisible().catch(() => false)) await cont.click();
    await expect(page.getByRole('heading', { name: "The planet couldn't be loaded." })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to the classic site' })).toBeVisible();
  });
});

test.describe('rendering', () => {
  test('tilt-shift survives adaptive quality falling all the way back', async ({ page }) => {
    await openPlanet(page, '/play/?quality=high');
    await page.getByRole('button', { name: 'Start exploring' }).click();
    await expect.poll(async () => (await state(page)).postFx).toBe('tilt-shift+bloom+vignette');
    await page.evaluate(() => {
      for (let i = 0; i < 8; i++) (window as any).__game.adaptiveStep(-1);
    });
    await expect.poll(async () => (await state(page)).postFx).toBe('tilt-shift');
    const s = await state(page);
    expect(s.quality).toBe('high');
    expect(s.dpr).toBe(1);
    expect(s.postLevel).toBe(1);
    await page.evaluate(() => (window as any).__game.adaptiveStep(1));
    await expect.poll(async () => (await state(page)).postFx).toBe('tilt-shift+bloom+vignette');
  });

  test('the low quality tier still has the tilt-shift', async ({ page }) => {
    await openPlanet(page, '/play/?quality=low');
    await page.getByRole('button', { name: 'Start exploring' }).click();
    expect((await state(page)).quality).toBe('low');
    await expect.poll(async () => (await state(page)).postFx).toBe('tilt-shift');
  });
});

test.describe('day–night', () => {
  test('the clock runs, and at night the lamps glow and the badge shows the moon', async ({ page }) => {
    await startPlanet(page);
    const start = await state(page);
    expect(start.timeMode).toBe('cycle');
    expect(start.night).toBe(0);
    await expect.poll(async () => (await state(page)).hours, { timeout: 5_000 }).toBeGreaterThan(start.hours + 0.02);
    await page.evaluate(() => (window as any).__game.setTime(22));
    await expect.poll(async () => (await state(page)).night).toBeGreaterThan(0.9);
    expect((await state(page)).glow).toBeGreaterThan(1.3);
    await expect(page.getByTestId('time-badge')).toContainText('10:00 PM');
    await expect(page.getByTestId('time-badge')).toContainText('☾');
  });

  test('“Always daytime” holds the day and is remembered', async ({ page }) => {
    await startPlanet(page);
    await page.evaluate(() => {
      (window as any).__game.setTime(22);
      (window as any).__game.setTime(null);
    });
    await page.getByTestId('menu-button').click();
    await page.getByRole('radio', { name: 'Always daytime' }).check();
    // rendering idles while a dialog is open; the sky sweeps to the new time once it closes
    await page.getByRole('button', { name: 'Close' }).click();
    await expect.poll(async () => (await state(page)).hours, { timeout: 8_000 }).toBeCloseTo(10.5, 2);
    expect((await state(page)).night).toBe(0);
    expect(await page.evaluate(() => localStorage.getItem('site.timeMode'))).toBe('day');
    await page.reload();
    await startPlanet(page);
    const s = await state(page);
    expect(s.timeMode).toBe('day');
    expect(s.hours).toBeCloseTo(10.5, 2);
  });

  test('pausing ambient motion freezes the clock', async ({ page }) => {
    await startPlanet(page);
    await page.getByTestId('menu-button').click();
    await page.getByRole('checkbox', { name: 'Pause ambient motion' }).check();
    await page.getByRole('button', { name: 'Close' }).click();
    const h = (await state(page)).hours;
    await page.waitForTimeout(1500);
    expect((await state(page)).hours).toBe(h);
  });
});

test.describe('player character', () => {
  test('loads the rigged CC0 character model', async ({ page }) => {
    const glb: string[] = [];
    page.on('response', (r) => r.url().endsWith('/models/character.glb') && glb.push(String(r.status())));
    await startPlanet(page);
    await expect.poll(async () => (await state(page)).avatar, { timeout: 20_000 }).toBe('model');
    expect(glb).toEqual(['200']);
  });

  test('falls back to the procedural avatar if the model cannot load', async ({ page }) => {
    await page.route('**/models/character.glb', (r) => r.abort());
    await startPlanet(page);
    await page.waitForTimeout(1500);
    expect((await state(page)).avatar).toBe('procedural');
    // still fully playable
    const before = await state(page);
    await page.locator('.game-region').focus();
    await page.keyboard.down('w');
    await page.waitForTimeout(600);
    await page.keyboard.up('w');
    expect((await state(page)).pLocal[2]).toBeLessThan(before.pLocal[2]);
  });
});

test.describe('planet', () => {
  test('start button, then WASD moves the player; keys are ignored when a HUD button has focus', async ({ page }) => {
    await openPlanet(page);
    const startBtn = page.getByRole('button', { name: 'Start exploring' });
    await expect(startBtn).toBeFocused();
    await startBtn.click();
    await expect(page.locator('.game-region')).toBeFocused();
    await expect(page.getByTestId('controls-hint')).toBeVisible();

    const before = await state(page);
    await page.keyboard.down('w');
    await page.waitForTimeout(700);
    await page.keyboard.up('w');
    const after = await state(page);
    expect(after.pLocal[2]).toBeLessThan(before.pLocal[2] - 0.02);

    await page.getByTestId('menu-button').focus();
    const s1 = await state(page);
    await page.keyboard.down('d');
    await page.waitForTimeout(400);
    await page.keyboard.up('d');
    const s2 = await state(page);
    expect(Math.abs(s2.pLocal[0] - s1.pLocal[0])).toBeLessThan(1e-6);
  });

  test('spawn view shows the Workshop straight ahead', async ({ page }) => {
    await startPlanet(page);
    for (const part of ['base', 'door'] as const) {
      const p = await page.evaluate((pt) => (window as any).__game.projectLandmark('workshop', pt), part);
      expect(Math.abs(p.x)).toBeLessThan(0.2);
      expect(p.y).toBeGreaterThan(-1);
      expect(p.y).toBeLessThan(0.95);
    }
  });

  test('proximity preview, open with E, close with Esc (focus + URL restored)', async ({ page }) => {
    await startPlanet(page);
    await page.evaluate(() => (window as any).__game.teleport('workshop'));
    const card = page.getByTestId('preview-card');
    await expect(card).toBeVisible();
    await expect(card.getByRole('heading', { name: 'Workshop' })).toBeVisible();
    await expect(page.getByTestId('live-region')).toContainText('Near Workshop');

    await page.locator('.game-region').focus();
    await page.keyboard.press('e');
    const dialog = page.getByTestId('landmark-dialog');
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\?at=workshop&open=1$/);
    await expect(dialog.getByRole('link', { name: /Open full page/ })).toHaveAttribute('href', '/classic/workshop/');
    await noSeriousViolations(page);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/play\/(\?at=workshop)?$/);
    await expect(page.locator('.game-region')).toBeFocused();
  });

  test('preview-card Open returns focus to the card button after closing', async ({ page }) => {
    await startPlanet(page);
    await page.evaluate(() => (window as any).__game.teleport('library'));
    const open = page.getByTestId('preview-card').getByRole('button', { name: /Open/ });
    await open.click();
    await expect(page.getByTestId('landmark-dialog')).toBeVisible();
    await page.getByTestId('landmark-dialog').getByRole('button', { name: 'Close' }).click();
    await expect(page.getByTestId('landmark-dialog')).toBeHidden();
    await expect(open).toBeFocused();
  });

  test('deep link opens the dialog; Back closes it without leaving the site', async ({ page }) => {
    await page.goto('/classic/');
    await openPlanet(page, '/play/?at=library&open=1');
    const dialog = page.getByTestId('landmark-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Library' })).toBeVisible();
    await page.goBack();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/play\/\?at=library$/);
    expect((await state(page)).nearby).toBe('library');
  });

  test('invalid deep link falls back to the Plaza with a status message', async ({ page }) => {
    await openPlanet(page, '/play/?at=nowhere');
    await expect(page.getByTestId('live-region')).toContainText("Couldn't find that place");
    expect((await state(page)).atSpawn).toBe(true);
    await expect(page).toHaveURL(/\/play\/$/);
  });

  test('context-preserving switch to classic, and Explore in 3D returns to the same place', async ({ page }) => {
    await startPlanet(page);
    await page.evaluate(() => (window as any).__game.teleport('workshop'));
    await expect(page.getByTestId('preview-card')).toBeVisible();
    await page.locator('.play-header').getByRole('link', { name: 'Classic site' }).click();
    await expect(page).toHaveURL(/\/classic\/workshop\/$/);
    await page.getByRole('link', { name: 'Explore in 3D' }).click();
    await openPlanet(page, page.url());
    expect((await state(page)).nearby).toBe('workshop');
  });

  test('fast travel from the menu reaches the landmark and shows its preview', async ({ page }) => {
    await startPlanet(page);
    await page.locator('.game-region').focus();
    await page.keyboard.press('m');
    const menu = page.getByTestId('menu-dialog');
    await expect(menu).toBeVisible();
    await noSeriousViolations(page);
    await menu.getByRole('button', { name: /Post Office/ }).click();
    await expect(menu).toBeHidden();
    await expect.poll(async () => (await state(page)).nearby, { timeout: 10_000 }).toBe('post-office');
    await expect(page.getByTestId('preview-card').getByRole('heading', { name: 'Post Office' })).toBeVisible();
  });

  test('reduced motion makes fast travel a short fade', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await startPlanet(page);
    await page.evaluate(() => {
      (window as any).__game.pause();
      (window as any).__game.travelTo('greenhouse');
    });
    expect((await state(page)).traveling).toBe('fade');
    await page.evaluate(() => (window as any).__game.resume());
    await expect.poll(async () => (await state(page)).nearby, { timeout: 5_000 }).toBe('greenhouse');
  });

  test('route test: every landmark is reachable from spawn in ≤ 8 s of running', async ({ page }) => {
    await startPlanet(page);
    const ids: string[] = await page.evaluate(() => (window as any).__game.landmarks());
    const results = await page.evaluate((list) => {
      const g = (window as any).__game;
      g.pause();
      return list.map((id: string) => {
        g.teleport('plaza');
        g.autoWalkTo(id);
        let frames = 0;
        while (g.getState().autoWalk && frames < 480) {
          g.advance(1);
          frames++;
        }
        return { id, seconds: frames / 60, distance: g.distanceTo(id) };
      });
    }, ids);
    for (const r of results) {
      expect(r.seconds, r.id).toBeLessThanOrEqual(8);
      expect(r.distance, r.id).toBeLessThan(0.6);
    }
  });

  test('parallel landmark nav is keyboard reachable and travels', async ({ page }) => {
    await startPlanet(page);
    await page.locator('.game-region').focus();
    await page.keyboard.press('Tab');
    const nav = page.getByRole('navigation', { name: 'Planet landmarks' });
    await expect(nav.getByRole('button').first()).toBeFocused();
    await nav.getByRole('button', { name: /Town Hall/ }).click();
    await expect.poll(async () => (await state(page)).nearby, { timeout: 10_000 }).toBe('town-hall');
  });

  test('WebGL context loss shows Reload / Classic', async ({ page }) => {
    await startPlanet(page);
    await page.evaluate(() => {
      const c = document.querySelector('.game-region canvas') as HTMLCanvasElement;
      (c.getContext('webgl2') as WebGL2RenderingContext).getExtension('WEBGL_lose_context')!.loseContext();
    });
    await expect(page.getByRole('heading', { name: 'The 3D view stopped working' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reload planet' })).toBeVisible();
  });
});
