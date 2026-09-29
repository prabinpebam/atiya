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
  character: 'skater' | 'sunny';
  avatarModel: 'skater' | 'sunny' | null;
  quality: 'high' | 'low';
  postLevel: 1 | 2;
  postFx: string;
  dpr: number;
  hours: number;
  night: number;
  glow: number;
  timeMode: 'cycle' | 'local' | 'day';
  heading: number;
  pitch: number;
  north: number;
  lift: number;
  /** Height (u) above the ground during a fly-over. */
  hover: number;
  /** Occlusion-outline twins on the current avatar. */
  outlines: number;
  /** Benches: the seat on offer, whether you're sitting, the motion stage and pose, and the distance (u) to the bench. */
  seatNear: string | null;
  seated: boolean;
  seatStage: 'sitting' | 'seated' | 'standing' | null;
  seatPose: number;
  benchD: number;
  /** Resting on the grass (rest.md): sitting or lying, the pose's blend; a jump's height (u); a shooting star in the sky. */
  rest: 'sit' | 'lie' | null;
  restK: number;
  jump: number;
  meteor: boolean;
  target: { kind: string; key: string; label: string } | null;
  acting: 'shake' | 'mine' | 'pick' | 'open' | 'water' | null;
  invScreen: 'backpack' | 'chest' | null;
  /** Chopper's profile card is open. */
  chopperOpen: boolean;
  /** Talking with one of the family. */
  talk: { id: string; name: string; lines: string[]; index: number } | null;
  wind: { strength: number; gust: number; leaves: number; swirls: number };
  textures: { loaded: number; failed: number; pending: number };
};

const ground = (page: Page) =>
  page.evaluate(
    () =>
      (window as any).__game.groundInfo() as {
        lift: number;
        height: number;
        walk: number;
        riverD: number;
        riverHalfWidth: number;
        water: number;
        wade: number;
        speedFactor: number;
        ripples: number;
        collar: boolean;
      },
  );

const state = (page: Page) => page.evaluate(() => (window as any).__game.getState() as GameState);

/**
 * Load /play, accept the software-rendering interstitial (headless SwiftShader), wait for the game.
 * The blade grass is thinned to a quarter (a dev/test-only flag) unless `grass: 'full'`: only its own
 * tests need all of it, and it's the costliest thing to draw in software. Prabin's welcome (the talk
 * that opens as the game starts) is off too (another test-only flag), unless `welcome`, and so is the
 * lantern the visitor starts with (so the backpack starts empty), unless `lantern`. The planet's summoning
 * (progressive-loading.md) runs without its pops (another test-only flag: the order and the gating stay),
 * unless `pop`, and it waits for the planet to be complete unless `complete: false`.
 */
async function openPlanet(
  page: Page,
  path = '/play/',
  {
    grass = 'thin',
    welcome = false,
    lantern = false,
    pop = false,
    complete = true,
    beforeGame,
  }: { grass?: 'thin' | 'full'; welcome?: boolean; lantern?: boolean; pop?: boolean; complete?: boolean; beforeGame?: () => Promise<void> } = {},
) {
  await page.addInitScript(([d, w, l, p]) => {
    localStorage.setItem('game.test.grassDensity', d);
    localStorage.setItem('game.test.welcome', w);
    localStorage.setItem('game.test.lantern', l);
    localStorage.setItem('game.test.pop', p);
  }, [grass === 'full' ? '1' : '0.25', welcome ? '1' : '0', lantern ? '1' : '0', pop ? '1' : '0']);
  await page.goto(path);
  const cont = page.getByRole('button', { name: 'Continue anyway' });
  await page.waitForFunction(() => (window as any).__game || (window as any).__loadScreen || document.querySelector('[data-gate-continue]'));
  if (await cont.isVisible()) await cont.click();
  await beforeGame?.();
  await page.waitForFunction(() => (window as any).__game && (window as any).__game.getState().phase !== 'loading', null, { timeout: 30_000 });
  if (complete) await page.waitForFunction(() => (window as any).__game.loadStage().tier === 'complete', null, { timeout: 60_000 });
}

async function startPlanet(page: Page) {
  await openPlanet(page);
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
    // painted key art: sized (no layout shift), loaded, and the social card is advertised
    const poster = page.locator('.landing-poster img');
    await expect(poster).toHaveAttribute('width', '1200');
    await expect.poll(() => poster.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    const og = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(og).toMatch(/\/og-image\.jpg$/);
    expect((await page.request.get('/og-image.jpg')).status()).toBe(200);
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

test.describe('loading', () => {
  test('the planet is playable before it is complete: the rest is summoned group by group, and nothing is solid or usable before it appears', async ({ page }) => {
    test.setTimeout(180_000);
    // (a tier-2 texture is held back, so the planet stays live, not complete, while it's checked)
    let release = () => {};
    const held = new Promise<void>((r) => (release = r));
    await page.route('**/textures/conifer-atlas*', async (r) => {
      await held;
      await r.continue();
    });
    await openPlanet(page, '/play/', { pop: true, complete: false });
    const live = await page.evaluate(() => (window as any).__game.loadStage());
    expect(live.tier).toBe('live');
    expect(live.revealed).toEqual([]);
    expect(live.held).toBeGreaterThan(0);
    expect(await page.evaluate(() => (window as any).__game.summoned('hardwood', 0))).toBe(false);
    expect(await page.evaluate(() => (window as any).__game.__gfx()?.scene.getObjectByName('summon-props')?.visible ?? false)).toBe(false);
    // it plays at once
    await page.locator('.game-region').focus();
    const before = await state(page);
    await page.keyboard.down('w');
    await page.waitForTimeout(700);
    await page.keyboard.up('w');
    expect((await state(page)).pLocal[2]).toBeLessThan(before.pLocal[2] - 0.02);

    release();
    await page.waitForFunction(() => (window as any).__game.loadStage().tier === 'complete', null, { timeout: 120_000 });
    const done = await page.evaluate(() => (window as any).__game.loadStage());
    expect(done.revealed).toEqual(['prabin', 'props', 'home', 'grass', 'craft', 'wildlife', 'clouds']);
    expect(done.held).toBe(0);
    expect(done.marks['game:live']).toBeLessThan(done.marks['game:group:prabin']);
    expect(done.marks['game:group:clouds']).toBeLessThanOrEqual(done.marks['game:complete']);
    expect(await page.evaluate(() => (window as any).__game.__gfx()?.scene.getObjectByName('summon-props')?.visible)).toBe(true);
    // the trees come out as the wave reaches them
    await expect.poll(() => page.evaluate(() => [0, 1, 2].every((i) => (window as any).__game.summoned('hardwood', i))), { timeout: 20_000 }).toBe(true);
  });
});

test.describe('rendering', () => {
  test('hand-painted textures all load, the first tier before the planet is live (no procedural fallback)', async ({ page }) => {
    const statuses: number[] = [];
    const urls = new Set<string>();
    page.on('response', (r) => r.url().includes('/textures/') && statuses.push(r.status()) && urls.add(r.url()));
    await openPlanet(page, '/play/', { complete: false });
    // (the ground's, the buildings' and the character's textures are in by the time the planet is playable)
    const first = await page.evaluate(() => (window as any).__game.tierTextures(1) as { name: string; ready: boolean }[]);
    expect(first.filter((t) => !t.ready).map((t) => t.name)).toEqual([]);
    await page.waitForFunction(() => (window as any).__game.loadStage().tier === 'complete', null, { timeout: 60_000 });
    // (the moon's comes last, when the browser is idle)
    await expect.poll(async () => (await state(page)).textures.pending, { timeout: 15_000 }).toBe(0);
    const s = await state(page);
    expect(s.textures.failed).toBe(0);
    expect(s.textures.pending).toBe(0);
    expect(s.textures.loaded).toBeGreaterThanOrEqual(12);
    // (the page warms the first tier's, so those are fetched twice, the second time from the cache)
    expect(urls.size).toBe(s.textures.loaded);
    expect(statuses.every((c) => c === 200)).toBe(true);
  });

  test('tilt-shift survives adaptive quality falling all the way back', async ({ page }) => {
    await openPlanet(page, '/play/?quality=high');
    // this test drives the steps itself (forced steps bypass the flag); the monitor would otherwise
    // step down on its own at SwiftShader's frame rate, part-way through
    await page.evaluate(() => (window as any).__game.setAdaptiveQuality(false));
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

  test('the tilt-shift replaces the image rather than adding to it, so the frame is exposed once and highlights keep their range', async ({ page }) => {
    await openPlanet(page, '/play/?quality=high');
    const grading = () => page.evaluate(() => (window as any).__game.grading());
    await expect.poll(async () => (await grading()).tiltBlend).toBe('NORMAL');
    await page.evaluate(() => (window as any).__game.setTime(12));
    await expect.poll(async () => (await grading()).exposure).toBeCloseTo(1.3, 3);
    await page.waitForTimeout(3000);
    // share of the 3D view (below the header) with a channel clipped to white
    const png = (await page.screenshot({ clip: { x: 0, y: 70, width: 1280, height: 640 } })).toString('base64');
    const clipped = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const cv = document.createElement('canvas');
      cv.width = img.width;
      cv.height = img.height;
      const ctx = cv.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (Math.max(d[i], d[i + 1], d[i + 2]) >= 250) n++;
      return n / (d.length / 4);
    }, png);
    expect(clipped).toBeLessThan(0.06);
    await page.evaluate(() => (window as any).__game.setTime(0));
    await expect.poll(async () => (await grading()).exposure).toBeCloseTo(1.7, 3);
  });

  test('the low quality tier still has the tilt-shift', async ({ page }) => {
    await openPlanet(page, '/play/?quality=low');
    expect((await state(page)).quality).toBe('low');
    await expect.poll(async () => (await state(page)).postFx).toBe('tilt-shift');
    expect((await page.evaluate(() => (window as any).__game.grading())).tiltBlend).toBe('NORMAL');
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
    await expect(page.getByTestId('time-badge').locator('[data-icon="moon"]')).toBeVisible();
  });

  test('the bridge lanterns are dark by day and light up (real lights) at night', async ({ page }) => {
    await startPlanet(page);
    const lamps = () => page.evaluate(() => (window as any).__game.bridgeLamps());
    await page.evaluate(() => (window as any).__game.setTime(11));
    await expect.poll(async () => (await lamps()).lit).toBe(0);
    const day = await lamps();
    expect(day.count).toBe(2);
    expect(day.intensity).toBe(0);
    await page.evaluate(() => (window as any).__game.setTime(22));
    await expect.poll(async () => (await lamps()).lit).toBeGreaterThan(0.9);
    expect((await lamps()).intensity).toBeGreaterThan(1.5);
    // back to morning: they go out again
    await page.evaluate(() => (window as any).__game.setTime(9));
    await expect.poll(async () => (await lamps()).intensity).toBe(0);
  });

  test('after dusk the plaza lamps, an open door and the stage spot really light the scene (none by day)', async ({ page }) => {
    // (two fly-overs under software rendering)
    test.setTimeout(120_000);
    await startPlanet(page);
    const lamps = () => page.evaluate(() => (window as any).__game.lamps() as number);
    await page.evaluate(() => (window as any).__game.setTime(11));
    await expect.poll(lamps).toBe(0);
    await page.evaluate(() => (window as any).__game.setTime(22));
    await expect.poll(lamps).toBeGreaterThanOrEqual(3);
    const plaza = await lamps();
    // walking up to the Workshop opens its door: its lamplight joins in
    await page.evaluate(() => (window as any).__game.travelTo('workshop'));
    await expect.poll(lamps, { timeout: 30_000 }).toBe(plaza + 1);
    // the Amphitheater's stage spot replaces it
    await page.evaluate(() => (window as any).__game.travelTo('amphitheater'));
    await expect.poll(lamps, { timeout: 30_000 }).toBe(plaza + 1);
    await page.evaluate(() => (window as any).__game.teleport('plaza'));
    await expect.poll(lamps, { timeout: 10_000 }).toBe(plaza);
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

  test('the town-hall clock shows the device’s local time', async ({ page }) => {
    // 10:10:30 local time on the visitor's device
    await page.clock.setFixedTime(new Date(2026, 8, 25, 10, 10, 30));
    await startPlanet(page);
    await page.evaluate(() => (window as any).__game.teleport('town-hall'));
    const TAU = Math.PI * 2;
    await expect.poll(async () => page.evaluate(() => (window as any).__game.clockHands()), { timeout: 10_000 }).not.toBeNull();
    const a = await page.evaluate(() => (window as any).__game.clockHands());
    expect(a.hour).toBeCloseTo(((10 + 10.5 / 60) / 12) * TAU, 5);
    expect(a.minute).toBeCloseTo((10.5 / 60) * TAU, 5);
    expect(a.second).toBeCloseTo(TAU / 2, 5);
    // an hour later on the device clock, the hands follow
    await page.clock.setFixedTime(new Date(2026, 8, 25, 11, 45, 0));
    await expect.poll(async () => (await page.evaluate(() => (window as any).__game.clockHands())).minute, { timeout: 10_000 }).toBeCloseTo((45 / 60) * TAU, 5);
    expect((await page.evaluate(() => (window as any).__game.clockHands())).hour).toBeCloseTo(((11 + 45 / 60) / 12) * TAU, 5);
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

  test('dragging the time badge winds the clock (the pointer hides while dragging); the cycle carries on; keys and clicks step it', async ({ page }) => {
    // (many small steps, each waiting for frames under software rendering)
    test.setTimeout(240_000);
    // saved "Always daytime": a hand-set time switches this visit to the cycle, without changing the saved choice
    await page.addInitScript(() => localStorage.setItem('site.timeMode', 'day'));
    await startPlanet(page);
    const badge = page.getByTestId('time-badge');
    await expect(badge).toHaveAttribute('role', 'slider');
    // (the game's own resize cursor, with the system's as its fallback: cursors.css)
    expect(await badge.evaluate((el) => getComputedStyle(el).cursor)).toMatch(/ew-resize$/);
    const start = (await state(page)).hours;
    expect(start).toBeCloseTo(10.5, 2);
    const box = (await badge.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 100, y, { steps: 5 });
    const hidden = () =>
      page.evaluate(() => ({
        scrubbing: document.documentElement.classList.contains('time-scrubbing'),
        badge: getComputedStyle(document.querySelector('[data-testid="time-badge"]')!).cursor,
        canvas: getComputedStyle(document.querySelector('canvas')!).cursor,
      }));
    expect(await hidden()).toEqual({ scrubbing: true, badge: 'none', canvas: 'none' });
    // 20 px per hour: +230 px from 10:30 AM is 10:00 PM, and the world follows straight away
    await page.mouse.move(x + 230, y, { steps: 5 });
    await page.waitForTimeout(400);
    expect((await state(page)).hours).toBeCloseTo(22, 1); // held while the button is down
    await expect.poll(async () => (await state(page)).night).toBeGreaterThan(0.9);
    await expect(badge).toContainText('10:00 PM');
    await expect(badge.locator('[data-icon="moon"]')).toBeVisible();
    await page.mouse.up();
    expect((await hidden()).scrubbing).toBe(false);
    // (the game's own resize cursor, with the system's as its fallback: cursors.css)
    expect(await badge.evaluate((el) => getComputedStyle(el).cursor)).toMatch(/ew-resize$/);
    const s = await state(page);
    expect(s.timeMode).toBe('cycle');
    expect(await page.evaluate(() => localStorage.getItem('site.timeMode'))).toBe('day');
    // the cycle runs on from the new time, and focus is back on the planet for walking
    await expect.poll(async () => (await state(page)).hours, { timeout: 5_000 }).toBeGreaterThan(s.hours + 0.02);
    expect(await page.evaluate(() => document.activeElement?.classList.contains('game-region'))).toBe(true);
    // hold the cycle (Pause ambient motion) so the steps can be measured exactly
    await page.getByTestId('menu-button').click();
    await page.getByRole('checkbox', { name: 'Pause ambient motion' }).check();
    await page.getByRole('button', { name: 'Close' }).click();
    // keyboard: Page Down steps back an hour, an arrow a quarter-hour (differences wrap round midnight)
    const stepped = (a: number, b: number) => ((b - a + 36) % 24) - 12;
    await badge.focus();
    let before = (await state(page)).hours;
    await page.keyboard.press('PageDown');
    expect(stepped(before, (await state(page)).hours)).toBeCloseTo(-1, 1);
    before = (await state(page)).hours;
    await page.keyboard.press('ArrowRight');
    expect(stepped(before, (await state(page)).hours)).toBeCloseTo(0.25, 1);
    await expect(badge).toHaveAttribute('aria-valuetext', /^\d{1,2}:\d{2} (AM|PM)$/);
    // a plain click on the right half steps an hour on
    before = (await state(page)).hours;
    const now = (await badge.boundingBox())!;
    await badge.click({ position: { x: now.width * 0.8, y: now.height / 2 } });
    expect(stepped(before, (await state(page)).hours)).toBeCloseTo(1, 1);
  });
});

test.describe('view controls', () => {
  test("compass shows north and stands alone; the menu's View buttons turn the view; the compass faces north again", async ({ page }) => {
    await startPlanet(page);
    expect((await state(page)).north).toBeCloseTo(0, 3);
    const compass = page.getByTestId('compass');
    await expect(compass).toHaveAttribute('aria-label', /facing north\./);
    // the header's icon buttons have names; by the compass there's only Reset (crafting-screen.md §3)
    await expect(page.getByRole('button', { name: 'Sound', exact: true })).toHaveAttribute('aria-pressed', /true|false/);
    await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeVisible();
    await expect(page.getByTestId('view-controls').getByRole('button')).toHaveCount(2);
    // turning and tilting without a drag (WCAG 2.5.7) are in the menu
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.getByRole('group', { name: 'Turn and tilt the view' }).getByRole('button', { name: /^Rotate right/ }).click();
    await expect.poll(async () => (await state(page)).north).toBeCloseTo(45, 0);
    await expect(compass).toHaveAttribute('aria-label', /facing north-west/);
    const pitch = (await state(page)).pitch;
    await page.getByRole('button', { name: /^Tilt to side/ }).click();
    await expect.poll(async () => (await state(page)).pitch).toBeLessThan(pitch - 1);
    // Space closes the menu, even with one of its buttons focused (Enter presses that)
    await page.keyboard.press('Space');
    await expect(page.getByRole('group', { name: 'Turn and tilt the view' })).toBeHidden();
    await compass.click();
    await expect.poll(async () => (await state(page)).north).toBeCloseTo(0, 1);
    await expect(compass).toHaveAttribute('aria-label', /facing north\./);
    expect((await state(page)).atSpawn).toBe(true);
  });

  test('a tap walks, but dragging tumbles the view without walking', async ({ page }) => {
    // a long real-time sequence (a drag of many moves / two fly-overs); headless SwiftShader renders slowly
    test.setTimeout(120_000);
    await startPlanet(page);
    await page.mouse.click(640, 610);
    await expect.poll(async () => (await state(page)).atSpawn).toBe(false);
    await page.evaluate(() => (window as any).__game.teleport('plaza'));
    const before = await state(page);
    await page.mouse.move(640, 600);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(640 + i * 20, 600 - i * 6);
    await page.mouse.up();
    await expect.poll(async () => (await state(page)).pitch).toBeLessThan(before.pitch - 10);
    const s = await state(page);
    expect(s.north).toBeLessThan(-30); // dragged right → scene turned counter-clockwise
    expect(s.atSpawn).toBe(true);
    expect(s.autoWalk).toBe(false);
  });

  test('keyboard: , . rotate, PgUp/PgDn tilt within limits, N faces north, H resets position and direction', async ({ page }) => {
    // a long sequence of real-time key holds; headless SwiftShader renders slowly
    test.setTimeout(120_000);
    await startPlanet(page);
    await page.locator('.game-region').focus();
    await page.keyboard.down('.');
    await page.waitForTimeout(500);
    await page.keyboard.up('.');
    expect((await state(page)).north).toBeGreaterThan(5);
    await page.keyboard.down('PageDown');
    await page.waitForTimeout(1500);
    await page.keyboard.up('PageDown');
    await expect.poll(async () => (await state(page)).pitch).toBeCloseTo(30, 1);
    await page.keyboard.press('n');
    await expect.poll(async () => (await state(page)).north).toBeCloseTo(0, 1);
    await expect.poll(async () => (await state(page)).pitch).toBeCloseTo(48, 1);
    // walk away and turn, then reset
    await page.keyboard.down('w');
    await page.waitForTimeout(800);
    await page.keyboard.up('w');
    await page.keyboard.down(',');
    await page.waitForTimeout(400);
    await page.keyboard.up(',');
    await page.keyboard.down('PageUp');
    await page.waitForTimeout(400);
    await page.keyboard.up('PageUp');
    const away = await state(page);
    expect(away.atSpawn).toBe(false);
    expect(Math.abs(away.north)).toBeGreaterThan(5);
    await page.keyboard.press('h');
    await expect.poll(async () => (await state(page)).atSpawn, { timeout: 15_000 }).toBe(true);
    await expect.poll(async () => (await state(page)).traveling).toBeNull();
    const s = await state(page);
    expect(s.north).toBeCloseTo(0, 3);
    expect(s.pitch).toBeCloseTo(48, 1);
    await expect(page.getByTestId('live-region')).toContainText('Back at the plaza');
  });

  test('the Reset button flies the character back over the rooftops to the plaza, drops it onto the ground, facing north', async ({ page }) => {
    await startPlanet(page);
    await page.evaluate(() => (window as any).__game.teleport('library'));
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.getByRole('button', { name: /^Rotate left/ }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /Reset position and direction/ }).click();
    // mid-flight (sim stepped by hand): high above the tallest trees and the lighthouse
    await page.evaluate(() => {
      (window as any).__game.pause();
      (window as any).__game.advance(40);
    });
    const mid = await state(page);
    expect(mid.traveling).toBe('flyover');
    expect(mid.hover).toBeGreaterThan(5.2);
    await page.evaluate(() => (window as any).__game.resume());
    await expect.poll(async () => (await state(page)).atSpawn, { timeout: 15_000 }).toBe(true);
    await expect.poll(async () => (await state(page)).traveling).toBeNull();
    expect((await state(page)).hover).toBe(0);
    expect((await state(page)).north).toBeCloseTo(0, 3);
  });
});

test.describe('landscape & wind', () => {
  test('the Greenhouse path crosses the river on an arched bridge', async ({ page }) => {
    await startPlanet(page);
    // step the sim at a fixed dt so the short arch can't be missed between slow headless frames
    const walk = await page.evaluate(() => {
      const g = (window as any).__game;
      g.pause();
      g.autoWalkTo('greenhouse');
      let maxLift = 0;
      let frames = 0;
      for (; frames < 60 * 30 && g.getState().autoWalk; frames++) {
        g.advance(1, 1 / 60);
        maxLift = Math.max(maxLift, g.groundInfo().lift);
      }
      g.resume();
      return { maxLift, seconds: frames / 60, nearby: g.getState().nearby as string | null };
    });
    // the character rode up over the arched deck and arrived at the Greenhouse
    expect(walk.maxLift).toBeGreaterThan(0.2);
    expect(walk.seconds).toBeLessThan(30);
    expect(walk.nearby).toBe('greenhouse');
  });

  test('you can wade across the stream: the character sinks in, slows down and leaves ripples', async ({ page }) => {
    await startPlanet(page);
    // step at a fixed dt from the bank out into the middle of the stream
    const into = await page.evaluate(() => {
      const g = (window as any).__game;
      g.visitFeature('river', 2);
      g.pause();
      g.setIntent(0, 1);
      let minLift = Infinity;
      let minFactor = 1;
      let deepest = 0;
      for (let f = 0; f < 60 * 8; f++) {
        g.advance(1, 1 / 60);
        const gi = g.groundInfo();
        minLift = Math.min(minLift, gi.lift);
        minFactor = Math.min(minFactor, gi.speedFactor);
        deepest = Math.max(deepest, gi.water);
        if (gi.water > 0.15) break;
      }
      g.clearIntent();
      g.advance(40, 1 / 60);
      g.resume();
      return { minLift, minFactor, deepest, now: g.groundInfo() };
    });
    expect(into.deepest).toBeGreaterThan(0.15);
    expect(into.now.riverD).toBeLessThan(into.now.riverHalfWidth);
    expect(into.now.lift).toBeLessThan(-0.2); // settled on the stream bed, below the water surface (−0.13)
    expect(Math.min(into.minFactor, into.now.speedFactor)).toBeLessThan(0.75); // wading is slower
    // standing in the water: foam around the legs and slow ripples spreading out
    await expect.poll(async () => (await ground(page)).collar, { timeout: 10_000 }).toBe(true);
    await expect.poll(async () => (await ground(page)).ripples, { timeout: 10_000 }).toBeGreaterThan(0);
    // Pause ambient motion hides the spreading rings but keeps the (still) foam collar
    await page.getByTestId('menu-button').click();
    await page.getByRole('checkbox', { name: 'Pause ambient motion' }).check();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect.poll(async () => (await ground(page)).ripples).toBe(0);
    expect((await ground(page)).collar).toBe(true);
    // keep going and climb out on the far bank
    const out = await page.evaluate(() => {
      const g = (window as any).__game;
      g.pause();
      g.setIntent(0, 1);
      let f = 0;
      for (; f < 60 * 8; f++) {
        g.advance(1, 1 / 60);
        const gi = g.groundInfo();
        if (gi.water === 0 && gi.riverD > gi.riverHalfWidth + 0.5) break;
      }
      g.clearIntent();
      g.resume();
      return { seconds: f / 60, gi: g.groundInfo() };
    });
    expect(out.seconds).toBeLessThan(8);
    expect(out.gi.water).toBe(0);
    expect(out.gi.speedFactor).toBe(1);
  });

  test('gusts send leaves and wind swirls flying; Pause ambient motion stills them', async ({ page }) => {
    await startPlanet(page);
    await page.evaluate(() => (window as any).__game.setWind(1));
    await expect.poll(async () => (await state(page)).wind.leaves, { timeout: 20_000 }).toBeGreaterThan(8);
    await expect.poll(async () => (await state(page)).wind.swirls, { timeout: 20_000 }).toBeGreaterThan(0);
    expect((await state(page)).wind.strength).toBeCloseTo(1, 5);
    await page.getByTestId('menu-button').click();
    await page.getByRole('checkbox', { name: 'Pause ambient motion' }).check();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect.poll(async () => (await state(page)).wind.leaves).toBe(0);
    expect((await state(page)).wind.swirls).toBe(0);
  });

  test('blade grass grows at full density in three draws, with knee-high meadows in open country', async ({ page }) => {
    test.setTimeout(120_000);
    await openPlanet(page, '/play/', { grass: 'full' });
    await expect.poll(async () => (await state(page)).phase).toBe('playing');
    const grass = () => page.evaluate(() => (window as any).__game.grass() as { stats: Record<string, number> | null; meadows: number });
    const g = await grass();
    expect(g.stats).not.toBeNull();
    expect(g.stats!.density).toBe(1);
    expect(g.stats!.draws).toBe(3);
    expect(g.stats!.blades).toBeGreaterThan(60_000);
    expect(g.stats!.tufts).toBeGreaterThan(1_000);
    expect(g.meadows).toBeGreaterThan(3);
    const names = await page.evaluate(() => {
      const out: string[] = [];
      (window as any).__game.__gfx().scene.traverse((o: { name: string; visible: boolean }) => o.name.startsWith('grass-') && o.visible && out.push(o.name));
      return out.sort();
    });
    expect(names).toEqual(['grass-blade', 'grass-flower', 'grass-tuft']);
    // the grass never blocks: the character walks through a knee-high meadow
    expect(await page.evaluate(() => (window as any).__game.visitMeadow(0))).toBe(true);
    const from = (await state(page)).pLocal;
    await page.evaluate(() => (window as any).__game.setIntent(0, 1));
    await expect.poll(async () => Math.hypot(...(await state(page)).pLocal.map((v, i) => v - from[i])), { timeout: 15_000 }).toBeGreaterThan(0.03);
    await page.evaluate(() => (window as any).__game.clearIntent());
  });
});

test.describe('doors', () => {
  test('a door opens as you walk up and shuts when you leave; after dusk lamplight spills out; the amphitheater raises its curtain', async ({ page }) => {
    // a long real-time sequence (a drag of many moves / two fly-overs); headless SwiftShader renders slowly
    test.setTimeout(120_000);
    await startPlanet(page);
    const doors = () => page.evaluate(() => (window as any).__game.doors() as Record<string, number>);
    const light = () => page.evaluate(() => (window as any).__game.doorLight() as { id: string | null; intensity: number });
    await page.evaluate(() => (window as any).__game.setTime(11));
    await expect.poll(async () => Object.keys(await doors()).length).toBe(7);
    expect(Object.values(await doors()).every((o) => o === 0)).toBe(true);
    await page.evaluate(() => (window as any).__game.travelTo('workshop'));
    await expect.poll(async () => (await doors()).workshop, { timeout: 15_000 }).toBe(1);
    expect((await light()).id).toBeNull(); // daylight: no lamp needed
    await page.evaluate(() => (window as any).__game.setTime(22));
    await expect.poll(async () => (await light()).id).toBe('workshop');
    expect((await light()).intensity).toBeGreaterThan(2);
    // walk off to the amphitheater: the workshop shuts, the curtain goes up and the light follows
    await page.evaluate(() => (window as any).__game.travelTo('amphitheater'));
    await expect.poll(async () => (await doors()).amphitheater, { timeout: 15_000 }).toBe(1);
    expect((await doors()).workshop).toBe(0);
    await expect.poll(async () => (await light()).id).toBe('amphitheater');
    // leaving it: the curtain comes down and the lamp goes out
    await page.evaluate(() => (window as any).__game.teleport('plaza'));
    await expect.poll(async () => (await doors()).amphitheater).toBe(0);
    expect((await light()).id).toBeNull();
  });
});

test.describe('sound', () => {
  type Sound = {
    enabled: boolean;
    state: string;
    loaded: number;
    levels: { stream: number; wind: number; birds: boolean; crickets: number; frogs: number };
    lastSurface: string | null;
    events: Array<{ kind: string; detail?: string; played: boolean }>;
    music: { on: boolean; playing: boolean; track: number; url: string | null };
  };
  const sound = (page: Page) => page.evaluate(() => (window as any).__game.sound() as Sound);
  const played = async (page: Page, kind: string) => (await sound(page)).events.filter((e) => e.kind === kind && e.played).length;

  test('starts with the Start click (nothing loads before), steps follow the ground, doors and the curtain have cues, and the toggle mutes and is remembered', async ({ page }) => {
    test.setTimeout(150_000); // two planet loads
    const mp3: string[] = [];
    page.on('request', (r) => r.url().endsWith('.mp3') && mp3.push(r.url()));
    await openPlanet(page);
    expect(mp3).toEqual([]);
    // (by day: the night's crickets and frogs aren't fetched until night falls)
    await page.evaluate(() => (window as any).__game.setTime(11));
    // (audio starts from the visitor's first press, not before)
    await page.keyboard.press('Shift');
    await expect.poll(async () => (await sound(page)).loaded, { timeout: 20_000 }).toBe(7);
    expect((await sound(page)).state).toBe('running');
    // the background music streams in and plays (one of the two tracks)
    await expect.poll(async () => (await sound(page)).music.playing, { timeout: 20_000 }).toBe(true);
    expect((await sound(page)).music.url).toMatch(/\/audio\/music-\d\.mp3$/);
    await expect(page.getByTestId('sound-button')).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(() => (window as any).__game.setTime(11));
    // footsteps on the plaza's stone
    await page.evaluate(() => (window as any).__game.setIntent(0, 1));
    await expect.poll(() => played(page, 'step'), { timeout: 20_000 }).toBeGreaterThan(0);
    await page.evaluate(() => (window as any).__game.clearIntent());
    expect((await sound(page)).lastSurface).toBe('stone');
    // the wind always blows; the stream is loud on its bank
    expect((await sound(page)).levels.wind).toBeGreaterThan(0.3);
    expect((await sound(page)).levels.birds).toBe(true);
    await page.evaluate(() => (window as any).__game.visitFeature('river'));
    await expect.poll(async () => (await sound(page)).levels.stream).toBeGreaterThan(0.3);
    // at night the crickets sing everywhere and the frogs call by the water; their sounds load only now
    expect(mp3.filter((u) => /crickets|frogs|croaks/.test(u))).toEqual([]);
    await page.evaluate(() => (window as any).__game.setTime(23));
    await expect.poll(async () => (await sound(page)).loaded, { timeout: 20_000 }).toBe(10);
    await expect.poll(async () => (await sound(page)).levels.crickets).toBeGreaterThan(0.9);
    expect((await sound(page)).levels.frogs).toBeGreaterThan(0.3);
    expect((await sound(page)).levels.birds).toBe(false);
    await page.evaluate(() => (window as any).__game.setTime(11));
    // walking up to a house: a chime and its door; moving on: it shuts and the curtain rises
    await page.evaluate(() => (window as any).__game.travelTo('workshop'));
    await expect.poll(() => played(page, 'doorOpen'), { timeout: 15_000 }).toBe(1);
    expect(await played(page, 'chime')).toBe(1);
    await page.evaluate(() => (window as any).__game.travelTo('amphitheater'));
    await expect.poll(() => played(page, 'curtain'), { timeout: 15_000 }).toBe(1);
    expect(await played(page, 'doorClose')).toBe(1);
    await page.keyboard.press('e');
    await expect.poll(() => played(page, 'sparkle')).toBe(1);
    await page.keyboard.press('Escape');
    // the menu's music switch stops the music, and it's remembered
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('checkbox', { name: 'Background music' }).uncheck();
    await expect.poll(async () => (await sound(page)).music.playing).toBe(false);
    expect(await page.evaluate(() => localStorage.getItem('site.music'))).toBe('0');
    await page.getByRole('checkbox', { name: 'Background music' }).check();
    await expect.poll(async () => (await sound(page)).music.playing).toBe(true);
    await page.keyboard.press('Escape');
    // mute: the audio stops, the choice is remembered, and a muted visit loads no sound at all
    await page.getByTestId('sound-button').click();
    await expect(page.getByTestId('sound-button')).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(async () => (await sound(page)).state).toBe('suspended');
    expect(await page.evaluate(() => localStorage.getItem('site.sound'))).toBe('0');
    mp3.length = 0;
    await startPlanet(page);
    await expect(page.getByTestId('sound-button')).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.getByRole('checkbox', { name: 'Sound effects' })).not.toBeChecked();
    expect(mp3).toEqual([]);
    expect((await sound(page)).state).toBe('none');
  });
});

test.describe('wildlife', () => {
  test('rabbits, a duck with ducklings, fish and birds live on the planet, and shy away from the character', async ({ page }) => {
    test.setTimeout(120_000);
    await startPlanet(page);
    const wild = () =>
      page.evaluate(
        () =>
          (window as any).__game.wildlife() as {
            rabbits: { state: string; d: number }[];
            duck: { state: string; d: number } | null;
            fish: { state: string; d: number; stream: boolean }[];
            birds: { state: string; d: number; alt: number }[];
          },
      );
    await page.evaluate(() => (window as any).__game.setTime(11));
    const w = await wild();
    expect(w.rabbits.length).toBeGreaterThan(0);
    expect(w.duck).not.toBeNull();
    expect(w.fish.some((f) => f.stream)).toBe(true);
    expect(w.fish.some((f) => !f.stream)).toBe(true);
    expect(w.birds.length).toBeGreaterThan(0);
    // walk up to a rabbit: it bolts
    expect(await page.evaluate(() => (window as any).__game.nearAnimal('rabbit', 0, 1.4))).toBe(true);
    await expect.poll(async () => (await wild()).rabbits[0].state, { timeout: 20_000 }).toBe('flee');
    // walk up to a bird pecking on the ground: it takes off
    const pecking = (await wild()).birds.findIndex((b) => b.state === 'peck');
    if (pecking >= 0) {
      expect(await page.evaluate(() => (window as any).__game.nearAnimal('bird', 0, 1.2))).toBe(true);
      await expect.poll(async () => (await wild()).birds.filter((b) => b.state === 'fly').length, { timeout: 20_000 }).toBeGreaterThan(w.birds.filter((b) => b.state === 'fly').length);
    }
    // the duck paddles off from a character wading up to her
    expect(await page.evaluate(() => (window as any).__game.nearAnimal('duck', 0, 1.2))).toBe(true);
    await expect.poll(async () => (await wild()).duck!.state, { timeout: 20_000 }).toBe('flee');
  });
});

test.describe('touch', () => {
  // a phone held upright, with a real touchscreen (touch.md §5)
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });

  test('drag anywhere summons the stick: walk, push to run, a second finger turns the view, lifting stops; a tap still walks', async ({ page }) => {
    test.setTimeout(180_000);
    await openPlanet(page);
    await expect(page.locator('html')).toHaveAttribute('data-input', 'touch');
    await expect.poll(async () => (await state(page)).phase).toBe('playing');
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: string, pts: [number, number, number][]) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) } as any);
    const step = (n: number) =>
      page.evaluate((f) => {
        const g = (window as any).__game;
        g.pause();
        g.advance(f);
        g.resume();
      }, n);
    const stick = page.getByTestId('stick');

    // one finger, dragged up the screen: the stick appears where it landed and the character walks
    await touch('touchStart', [[120, 560, 1]]);
    for (let i = 1; i <= 6; i++) await touch('touchMove', [[120, 560 - i * 5, 1]]);
    await expect(stick).toHaveClass(/\bon\b/);
    await expect(stick).not.toHaveClass(/\brun\b/);
    await step(40);
    const walked = await state(page);
    expect(walked.atSpawn).toBe(false);
    expect(walked.autoWalk).toBe(false);
    // pushed to the rim: it runs
    await touch('touchMove', [[120, 480, 1]]);
    await expect(stick).toHaveClass(/\brun\b/);
    // a second finger turns the view while the first keeps walking
    const north0 = (await state(page)).north;
    await touch('touchStart', [[120, 480, 1], [330, 460, 2]]);
    for (let i = 1; i <= 8; i++) await touch('touchMove', [[120, 480, 1], [330 - i * 15, 460, 2]]);
    // (CDP: a point missing from the next event has lifted; touchEnd lifts them all)
    await touch('touchMove', [[120, 480, 1]]);
    expect(Math.abs((await state(page)).north - north0)).toBeGreaterThan(20);
    await expect(stick).toHaveClass(/\bon\b/);
    // lifting: the stick goes and the character stops
    await touch('touchEnd', []);
    await expect(stick).not.toHaveClass(/\bon\b/);
    await step(20);
    const a = (await state(page)).pLocal;
    await step(20);
    const b = (await state(page)).pLocal;
    expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])).toBeLessThan(1e-4);

    // a tap still walks (WCAG 2.5.7: a single-pointer alternative to the drag)
    await page.evaluate(() => (window as any).__game.teleport('plaza'));
    await page.touchscreen.tap(195, 470);
    await expect.poll(async () => {
      const s = await state(page);
      return s.autoWalk || !s.atSpawn;
    }).toBe(true);

    // the compass, Reset and the header's icon buttons are 44 px under a thumb, and prompts show no keycaps
    for (const b of [page.getByTestId('compass'), page.getByRole('button', { name: /Reset position/ }), page.getByTestId('sound-button'), page.getByRole('button', { name: 'Menu', exact: true })]) {
      const box = (await b.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.evaluate(() => (window as any).__game.nearBench(1.1));
    const sit = page.getByTestId('seat-prompt').getByRole('button', { name: /Sit on the bench/ });
    await expect(sit).toBeVisible();
    await expect(sit.locator('kbd')).toBeHidden();
  });
});

test.describe('touch inventory', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });

  test('a dragged stack floats above the finger, its slot dims and the slot under the finger shows where it goes; lifting puts it there (no Move toggle)', async ({ page }) => {
    test.setTimeout(150_000);
    await openPlanet(page);
    await page.evaluate(() => (window as any).__game.giveItem('stone', 5));
    const from = (await page.evaluate(() => (window as any).__game.inventory().backpack as (string | null)[])).indexOf('stone:5');
    expect(from).toBeGreaterThanOrEqual(0);
    await page.getByTestId('backpack-button').tap();
    const screen = page.getByTestId('inventory-screen');
    await expect(screen.getByRole('dialog', { name: 'Backpack' })).toBeVisible();
    await expect(screen.getByRole('button', { name: /^Move/ })).toHaveCount(0);
    const src = screen.locator(`[data-slot="backpack:${from}"]`);
    const dst = screen.locator('[data-slot="backpack:12"]');
    const a = (await src.boundingBox())!;
    const b = (await dst.boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: string, pts: [number, number][]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y]) => ({ x, y, id: 1 })) } as any);
    const [x0, y0] = [a.x + a.width / 2, a.y + a.height / 2];
    const [x1, y1] = [b.x + b.width / 2, b.y + b.height / 2];
    await touch('touchStart', [[x0, y0]]);
    for (let i = 1; i <= 8; i++) await touch('touchMove', [[x0 + ((x1 - x0) * i) / 8, y0 + ((y1 - y0) * i) / 8]]);
    // carried: it floats a size up above the fingertip, its own slot waits dimmed, the slot under the finger is marked
    const cursor = page.getByTestId('inventory-cursor');
    await expect(cursor).toHaveClass(/carrying/);
    const c = (await cursor.boundingBox())!;
    expect(c.y + c.height).toBeLessThan(y1 - 10);
    await expect(src).toHaveClass(/lifting/);
    await expect(dst).toHaveClass(/drop-target/);
    await touch('touchEnd', []);
    await expect(cursor).not.toHaveClass(/carrying/);
    const inv = await page.evaluate(() => (window as any).__game.inventory());
    expect(inv.backpack[12]).toBe('stone:5');
    expect(inv.backpack[from]).toBeNull();
    expect(inv.held).toBeNull();
  });
});

test.describe('benches', () => {
  test('walking up to the plaza bench offers a seat; E sits, Space stands up (not the menu), and a movement key stands up and walks off', async ({ page }) => {
    test.setTimeout(120_000);
    await startPlanet(page);
    const prompt = page.getByTestId('seat-prompt');
    await expect(prompt).toHaveCount(0);
    await page.evaluate(() => (window as any).__game.nearBench(1.1));
    await expect(prompt.getByRole('button', { name: /Sit on the bench/ })).toBeVisible();
    // E sits: the character settles onto the seat and the prompt offers to stand up
    await page.keyboard.press('KeyE');
    await expect.poll(async () => (await state(page)).seatStage, { timeout: 30_000 }).toBe('seated');
    let s = await state(page);
    expect(s.seated).toBe(true);
    expect(s.seatPose).toBe(1);
    expect(s.benchD).toBeLessThan(0.1);
    await expect(prompt.getByRole('button', { name: /Stand up/ })).toBeVisible();
    await expect(prompt.getByRole('button', { name: /Stand up/ }).locator('kbd')).toHaveText('Space');
    // Space stands up in front of the bench, and doesn't open the menu
    await page.keyboard.press('Space');
    await expect.poll(async () => (await state(page)).seatStage, { timeout: 30_000 }).toBeNull();
    s = await state(page);
    expect(s.menuOpen).toBe(false);
    expect(s.seated).toBe(false);
    expect(s.seatPose).toBe(0);
    expect(s.benchD).toBeGreaterThan(0.87);
    // the prompt's button sits too (and hands focus back to the planet)
    await prompt.getByRole('button', { name: /Sit on the bench/ }).click();
    await expect.poll(async () => (await state(page)).seatStage, { timeout: 30_000 }).toBe('seated');
    await expect(page.locator('.game-region')).toBeFocused();
    // walking stands you up and away (the bench faces screen-down here, so S walks off it)
    await page.keyboard.down('KeyS');
    await expect.poll(async () => (await state(page)).benchD, { timeout: 30_000 }).toBeGreaterThan(1.3);
    await page.keyboard.up('KeyS');
    s = await state(page);
    expect(s.seated).toBe(false);
    expect(s.seatStage).toBeNull();
  });

  test('on the pond bench E feeds the ducks (crumbs on the water, the ducks drawn to them) and Escape stands up too (Space is the key shown)', async ({ page }) => {
    test.setTimeout(150_000);
    await startPlanet(page);
    const prompt = page.getByTestId('seat-prompt');
    const ducks = () => page.evaluate(() => (window as any).__game.ducks() as { canFeed: boolean; fed: number; tosses: number; spot: boolean });
    await page.evaluate(() => (window as any).__game.nearPondBench(1.1));
    await expect(prompt.getByRole('button', { name: /Sit on the bench/ })).toBeVisible();
    await page.keyboard.press('KeyE');
    await expect.poll(async () => (await state(page)).seatStage, { timeout: 30_000 }).toBe('seated');
    // two choices: feed the ducks (E) or stand up (Space)
    await expect(prompt.getByRole('button', { name: /Feed the ducks/ })).toBeVisible();
    await expect(prompt.getByRole('button', { name: /Stand up/ })).toBeVisible();
    expect((await ducks()).canFeed).toBe(true);
    // E tosses a handful (and doesn't stand you up)
    await page.keyboard.press('KeyE');
    await expect.poll(async () => (await ducks()).fed, { timeout: 30_000 }).toBe(1);
    let d = await ducks();
    expect(d.spot).toBe(true);
    expect(d.tosses).toBeGreaterThan(0);
    expect((await state(page)).seated).toBe(true);
    // the button feeds too, once the last handful has left the hand
    await page.evaluate(() => {
      const g = (window as any).__game;
      g.pause();
      g.advance(60);
      g.resume();
    });
    await prompt.getByRole('button', { name: /Feed the ducks/ }).click();
    await expect.poll(async () => (await ducks()).fed, { timeout: 30_000 }).toBe(2);
    await expect(page.locator('.game-region')).toBeFocused();
    // Escape stands up as well as Space, and the feeding choice goes with the seat
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await state(page)).seatStage, { timeout: 30_000 }).toBeNull();
    d = await ducks();
    expect(d.canFeed).toBe(false);
    expect((await state(page)).menuOpen).toBe(false);
  });
});

test.describe('rest, jump & lantern', () => {
  const frames = (page: Page, n: number) =>
    page.evaluate((n) => {
      const g = (window as any).__game;
      g.pause();
      g.advance(n);
      g.resume();
    }, n);

  test('Space jumps when there is nothing to go back from; X sits on the grass and Z lies back, anywhere; Space, the key again or a step gets you up; the menu has them too', async ({ page }) => {
    test.setTimeout(150_000);
    await startPlanet(page);
    // a hop: up and down again, and it doesn't open anything (the sim held still, so the frames drawn in
    // software between the press and the check don't run the whole hop)
    await page.evaluate(() => (window as any).__game.pause());
    await page.keyboard.press('Space');
    const air = await page.evaluate(() => {
      const g = (window as any).__game;
      g.advance(10);
      return g.getState().jump as number;
    });
    expect(air).toBeGreaterThan(0.15);
    await page.evaluate(() => (window as any).__game.resume());
    let s = await state(page);
    expect(s.menuOpen).toBe(false);
    await frames(page, 40);
    expect((await state(page)).jump).toBe(0);
    // X: sit on the grass; the prompt offers to stand up, and Space does (no jump)
    const prompt = page.getByTestId('seat-prompt');
    await page.keyboard.press('KeyX');
    await frames(page, 70);
    s = await state(page);
    expect([s.rest, s.restK, s.seated]).toEqual(['sit', 1, true]);
    await expect(page.getByTestId('live-region')).toContainText('Sitting on the grass.');
    await expect(prompt.getByRole('button', { name: /Stand up/ })).toBeVisible();
    // Z from there lies back (going on from the sit), and X sits up again
    await page.keyboard.press('KeyZ');
    await frames(page, 70);
    s = await state(page);
    expect([s.rest, s.restK]).toEqual(['lie', 1]);
    await page.keyboard.press('KeyX');
    await frames(page, 70);
    s = await state(page);
    expect([s.rest, s.restK]).toEqual(['sit', 1]);
    await page.keyboard.press('Space');
    await frames(page, 70);
    s = await state(page);
    expect([s.rest, s.seated, s.jump]).toEqual([null, false, 0]);
    // the same key again stands you up; so does a step, and then you walk on
    await page.keyboard.press('KeyZ');
    await frames(page, 70);
    await page.keyboard.press('KeyZ');
    await frames(page, 70);
    expect((await state(page)).rest).toBeNull();
    await page.keyboard.press('KeyX');
    await frames(page, 70);
    const at = (await state(page)).pLocal;
    await page.keyboard.down('KeyW');
    await expect.poll(async () => (await state(page)).rest, { timeout: 30_000 }).toBeNull();
    await expect.poll(async () => { const p = (await state(page)).pLocal; return Math.hypot(p[0] - at[0], p[1] - at[1], p[2] - at[2]); }, { timeout: 30_000 }).toBeGreaterThan(0.02);
    await page.keyboard.up('KeyW');
    // the menu's Rest group (for touch and the mouse): Sit down, Lie down
    await page.keyboard.press('KeyM');
    const menu = page.getByTestId('menu-dialog');
    await expect(menu.getByRole('heading', { name: 'Rest' })).toBeVisible();
    await menu.getByRole('button', { name: /Lie down/ }).click();
    await expect(menu).toBeHidden();
    await frames(page, 70);
    expect((await state(page)).rest).toBe('lie');
    await prompt.getByRole('button', { name: /Stand up/ }).click();
    await frames(page, 70);
    expect((await state(page)).rest).toBeNull();
  });

  test('the visitor starts with a lantern: held while it is the selected hotbar slot, it lights up at night (a real lamp), set down while resting; and shooting stars cross the night sky', async ({ page }) => {
    test.setTimeout(240_000);
    await openPlanet(page, '/play/', { lantern: true });
    await expect.poll(async () => (await state(page)).phase).toBe('playing');
    const lantern = async () => (await page.evaluate(() => (window as any).__game.craft().lantern)) as { held: boolean; lamp: number };
    const inv = () => page.evaluate(() => (window as any).__game.inventory().backpack as (string | null)[]);
    expect((await inv())[0]).toBe('lantern:1');
    await page.evaluate(() => (window as any).__game.setTime(12));
    await frames(page, 5);
    // in the hand (slot 1 is selected), dark by day
    expect(await lantern()).toEqual({ held: true, lamp: 0 });
    await page.evaluate(() => (window as any).__game.setTime(22));
    await frames(page, 5);
    expect((await lantern()).lamp).toBeGreaterThan(1);
    expect(await page.evaluate(() => (window as any).__game.lamps())).toBeGreaterThan(0);
    // another slot: put away, and the light goes with it
    await page.keyboard.press('Digit2');
    await frames(page, 5);
    expect(await lantern()).toEqual({ held: false, lamp: 0 });
    await page.keyboard.press('Digit1');
    // given only once: still one after a reload
    await startPlanet(page);
    expect((await inv()).filter((x) => x?.startsWith('lantern')).length).toBe(1);
    // a shooting star soon after night falls (they run on the rendered frames, which are slow in software)
    await page.evaluate(() => (window as any).__game.setTime(23));
    await expect.poll(async () => (await state(page)).meteor, { timeout: 90_000, intervals: [100] }).toBe(true);
    // and none by day
    await page.evaluate(() => (window as any).__game.setTime(12));
    await page.waitForTimeout(1500);
    for (let i = 0; i < 10; i++) {
      expect((await state(page)).meteor).toBe(false);
      await page.waitForTimeout(300);
    }
  });
});

test.describe('Chopper', () => {
  type Dog = { d: number; speed: number; behaviour: string; stage: number; clip: string; whistles: number };
  const dog = (page: Page) => page.evaluate(() => (window as any).__game.chopper() as Dog);
  const fastForward = (page: Page, seconds: number) =>
    page.evaluate((s) => {
      const g = (window as any).__game;
      g.pause();
      g.advance(Math.round(s * 60));
      g.resume();
    }, seconds);

  test('Chopper keeps near the character on his own, and comes running when whistled (F, or the hotbar button)', async ({ page }) => {
    test.setTimeout(120_000);
    await startPlanet(page);
    // he's there from the start, beside the character
    let c = await dog(page);
    expect(c.d).toBeLessThan(4);
    // left to himself for a minute he wanders, sniffs and settles, but never strays past the far band
    for (let i = 0; i < 6; i++) {
      await fastForward(page, 10);
      c = await dog(page);
      expect(c.d).toBeLessThan(10);
    }
    // F: the character whistles, and he drops everything and comes
    await page.keyboard.press('KeyF');
    c = await dog(page);
    expect(c.behaviour).toBe('whistled');
    expect(c.whistles).toBe(1);
    const cues = await page.evaluate(() => ((window as any).__game.sound().events as { kind: string }[]).map((e) => e.kind));
    expect(cues).toContain('whistle');
    await fastForward(page, 5);
    c = await dog(page);
    expect(['whistled', 'heel']).toContain(c.behaviour);
    expect(c.d).toBeLessThan(2.2);
    // the hotbar's whistle button does the same (after the whistle's cooldown), and hands the keys back to the planet
    await page.waitForTimeout(2100);
    await page.getByTestId('whistle-button').click();
    expect((await dog(page)).whistles).toBe(2);
    await expect(page.locator('.game-region')).toBeFocused();
  });

  test('Meet Chopper: E opens his card with his photo and a 3D Chopper; it passes axe; Space closes it (even on a button) and hands back the planet', async ({ page }) => {
    test.setTimeout(120_000);
    await startPlanet(page);
    await page.evaluate(() => {
      const g = (window as any).__game;
      g.chopperDo('sit');
      g.nearChopper(0.7);
    });
    await expect(page.getByTestId('seat-prompt').getByRole('button', { name: /Meet Chopper/ })).toBeVisible();
    await page.keyboard.press('KeyE');
    const card = page.getByTestId('chopper-dialog');
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card.getByRole('heading', { name: 'Chopper' })).toBeVisible();
    expect((await state(page)).chopperOpen).toBe(true);
    const photo = page.getByTestId('chopper-photo');
    await expect(photo).toHaveAttribute('alt', /Lhasa Apso/);
    await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(page.getByTestId('chopper-3d').locator('canvas')).toHaveCount(1);
    await noSeriousViolations(page);
    // the other photo
    await card.getByRole('button', { name: 'Photo 2' }).click();
    await expect(photo).toHaveAttribute('src', /chopper-2/);
    // Space closes it (not the menu), even with a photo button focused, and the keys go back to the planet
    await page.keyboard.press('Space');
    await expect(card).toBeHidden();
    const s = await state(page);
    expect(s.chopperOpen).toBe(false);
    expect(s.menuOpen).toBe(false);
    await expect(page.locator('.game-region')).toBeFocused();
    // its little canvas is gone with it (the WebGL context is released)
    await expect(page.getByTestId('chopper-3d')).toHaveCount(0);
  });
});

test.describe('home & family', () => {
  type Person = { id: string; activity: string; pose: string; speed: number; chatting: boolean; indoors: boolean; d: number; home: number };
  const family = (page: Page) => page.evaluate(() => (window as any).__game.family() as Person[]);

  test('the family lives by the house at the pond, busy with their own things', async ({ page }) => {
    test.setTimeout(120_000);
    await startPlanet(page);
    let f = await family(page);
    expect(f.map((p) => p.id)).toEqual(['rojina', 'laija', 'lingjel', 'prabin']);
    await page.evaluate(() => {
      const g = (window as any).__game;
      g.pause();
      g.advance(60 * 60);
      g.resume();
    });
    f = await family(page);
    // (Prabin roams the whole planet)
    for (const p of f) if (p.id !== 'prabin') expect(p.home, p.id).toBeLessThan(8.5);
    // at the home: the house, the campsite and the picnic are drawn
    expect(await page.evaluate(() => (window as any).__game.visitHome())).toBe(true);
    const names = await page.evaluate(() => {
      const { scene } = (window as any).__game.__gfx();
      const out: string[] = [];
      scene.traverse((o: { name: string }) => o.name && (o.name === 'home' || o.name.startsWith('npc-')) && out.push(o.name));
      return out;
    });
    expect(names).toEqual(expect.arrayContaining(['home', 'npc-rojina', 'npc-laija', 'npc-lingjel']));
    // their heads stay on their shoulders: turned at most a little from the neck, frame after frame
    const turn = await page.evaluate(async () => {
      const { scene } = (window as any).__game.__gfx();
      const heads: any[] = [];
      for (const id of ['rojina', 'laija', 'lingjel']) scene.getObjectByName(`npc-${id}`).traverse((o: any) => o.isBone && o.name === 'Head' && heads.push(o));
      let most = 0;
      for (let i = 0; i < 12; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        for (const h of heads) {
          const a = h.getWorldQuaternion(h.quaternion.clone());
          const b = h.parent.getWorldQuaternion(h.quaternion.clone());
          most = Math.max(most, a.angleTo(b));
        }
      }
      return most;
    });
    expect(turn).toBeLessThan(1.3);
    // their clips really play: walking, their arms swing (no frozen T-pose)
    await page.evaluate(() => {
      const g = (window as any).__game;
      for (const id of ['rojina', 'laija', 'lingjel']) g.npcDo(id, 'wander');
    });
    const swing = await page.evaluate(async () => {
      const { scene } = (window as any).__game.__gfx();
      const arms: any[] = [];
      for (const id of ['rojina', 'laija', 'lingjel']) scene.getObjectByName(`npc-${id}`).traverse((o: any) => o.isBone && o.name === 'LeftArm' && arms.push(o));
      const first = arms.map((a) => a.quaternion.clone());
      const most = arms.map(() => 0);
      for (let i = 0; i < 12; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        arms.forEach((a, k) => (most[k] = Math.max(most[k], a.quaternion.angleTo(first[k]))));
      }
      return most;
    });
    for (const m of swing) expect(m).toBeGreaterThan(0.05);
  });

  test('Prabin: he starts by the crafting table; Talk to Prabin opens the dialog with his name, his talking head and a welcome', async ({ page }) => {
    test.setTimeout(120_000);
    await startPlanet(page);
    const f = await family(page);
    const p = f.find((x) => x.id === 'prabin')!;
    expect(p.indoors).toBe(false);
    expect(await page.evaluate(() => (window as any).__game.nearNpc('prabin', 0.95))).toBe(true);
    const talk = page.getByTestId('seat-prompt').getByRole('button', { name: /Talk to Prabin/ });
    await expect(talk).toBeVisible();
    await page.keyboard.press('KeyE');
    const box = page.getByTestId('talk-box');
    await expect(box).toBeVisible();
    await expect(box.locator('.talk-name')).toHaveText('Prabin');
    // his face, beside his name, nodding along while the line types out
    const head = box.getByTestId('talk-head');
    await expect(head).toBeVisible();
    await expect(head.locator('img')).toHaveAttribute('src', /\/avatars\/npc\/prabin\.webp$/);
    await expect.poll(() => head.locator('img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(192);
    expect((await state(page)).talk!.lines.length).toBeGreaterThanOrEqual(2);
    await page.keyboard.press('Escape');
    await expect(box).toHaveCount(0);
    await expect(page.locator('.game-region')).toBeFocused();
  });

  test('Prabin plays the guitar in his lap with both elbows bent (the hands on the strings and the neck)', async ({ page }) => {
    test.setTimeout(150_000);
    await startPlanet(page);
    await page.evaluate(() => {
      const g = (window as any).__game;
      g.npcDo('rojina', 'read');
      g.npcDo('prabin', 'guitar');
    });
    // (fast-forward the simulation: at SwiftShader's frame rate the walk from the crafting table takes minutes)
    await expect
      .poll(
        async () => {
          await page.evaluate(() => {
            const g = (window as any).__game;
            g.pause();
            g.advance(600);
            g.resume();
          });
          return (await family(page)).find((x) => x.id === 'prabin');
        },
        { timeout: 90_000 },
      )
      .toMatchObject({ pose: 'guitar', held: 'guitar', seat: 'camp0:on' });
    await page.waitForTimeout(1500);
    // the elbow angles of the drawn rig (shoulder–elbow–wrist): straight arms were ≈ 172°
    const elbows = await page.evaluate(() => {
      const { scene } = (window as any).__game.__gfx();
      const root = scene.getObjectByName('npc-prabin');
      const V = root.position.constructor;
      const at = (n: string) => {
        const v = new V();
        root.getObjectByName(n).getWorldPosition(v);
        return v;
      };
      return ['Left', 'Right'].map((side) => {
        const s = at(`${side}Arm`);
        const e = at(`${side}ForeArm`);
        const h = at(`${side}Hand`);
        return (Math.acos(Math.max(-1, Math.min(1, s.clone().sub(e).normalize().dot(h.clone().sub(e).normalize())))) * 180) / Math.PI;
      });
    });
    for (const a of elbows) {
      expect(a).toBeGreaterThan(55);
      expect(a).toBeLessThan(140);
    }
  });

  test('one thing asks at a time: talking by a landmark shows only the talk box, and E advances the talk', async ({ page }) => {
    test.setTimeout(120_000);
    await startPlanet(page);
    const placed = await page.evaluate(() => {
      const g = (window as any).__game;
      g.teleport(g.landmarks()[1]);
      const [x, y, z] = g.getState().pLocal;
      return g.npcPlace('prabin', [x + 0.02, y, z + 0.02]) && g.nearNpc('prabin', 0.8);
    });
    expect(placed).toBe(true);
    await expect(page.getByTestId('seat-prompt').getByRole('button', { name: /Talk to Prabin/ })).toBeVisible();
    await page.keyboard.press('KeyE');
    const box = page.getByTestId('talk-box');
    await expect(box).toBeVisible();
    // the landmark is still near, but its card yields to the talk
    expect((await state(page)).nearby).not.toBeNull();
    await expect(page.getByTestId('preview-card')).toHaveCount(0);
    await expect(page.getByTestId('seat-prompt')).toHaveCount(0);
    const before = (await state(page)).talk!.index;
    await page.waitForTimeout(400);
    // an E while the line is still typing only finishes it; the next turns the page
    for (let i = 0; i < 3 && (await state(page)).talk!.index === before; i++) {
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(150);
    }
    expect((await state(page)).talk!.index).toBe(before + 1);
    await expect(page.getByTestId('preview-card')).toHaveCount(0);
  });

  test('bedtime: the front door swings open, they climb the steps and go in one at a time, and it shuts after them', async ({ page }) => {
    test.setTimeout(150_000);
    await startPlanet(page);
    await page.evaluate(() => {
      const g = (window as any).__game;
      g.visitHome();
      g.nearTarget('site', undefined, 3);
      g.setTime(20.2);
    });
    let sawOpen = 0;
    let most = 0;
    for (let i = 0; i < 90; i++) {
      const r = await page.evaluate(() => {
        const g = (window as any).__game;
        g.pause();
        g.advance(30);
        g.resume();
        const f = g.family() as Array<{ link: string | null; indoors: boolean }>;
        return { door: g.homeDoor() as number, passing: f.filter((p) => p.link === 'in:walk').length, inside: f.filter((p) => p.indoors).length };
      });
      most = Math.max(most, r.passing);
      if (r.passing) sawOpen = Math.max(sawOpen, r.door);
      if (r.inside === 4) break;
    }
    expect(most).toBe(1);
    expect(sawOpen).toBeGreaterThan(0.84);
    expect((await family(page)).every((p) => p.indoors)).toBe(true);
    await page.evaluate(() => {
      const g = (window as any).__game;
      g.pause();
      g.advance(120);
      g.resume();
    });
    expect(await page.evaluate(() => (window as any).__game.homeDoor())).toBe(0);
  });

  test("Chopper's house at night: its lantern is lit and he goes inside to lie on his bed", async ({ page }) => {
    test.setTimeout(150_000);
    await page.addInitScript(() => localStorage.setItem('site.dogHouse', JSON.stringify({ built: true, colour: 'original' })));
    await startPlanet(page);
    const before = await page.evaluate(() => {
      const g = (window as any).__game;
      g.setTime(12);
      return g.lamps() as number;
    });
    // over to his house (he comes when whistled), then a nap inside it
    await page.evaluate(() => {
      const g = (window as any).__game;
      g.setTime(22);
      g.nearTarget('site', undefined, 2.4);
      g.whistle();
      g.pause();
      g.advance(60 * 16);
      g.resume();
      g.chopperDo('house');
    });
    let dog = { behaviour: '', stage: 0 };
    for (let i = 0; i < 20 && !(dog.behaviour === 'house' && dog.stage >= 2); i++) {
      dog = await page.evaluate(() => {
        const g = (window as any).__game;
        g.pause();
        g.advance(30);
        g.resume();
        return g.chopper();
      });
    }
    expect(dog.behaviour).toBe('house');
    expect(dog.stage).toBeGreaterThanOrEqual(2);
    // lamps are lit after dark (the lantern among them), and there are never more than the lamp list holds
    await page.waitForTimeout(500);
    const night = await page.evaluate(() => (window as any).__game.lamps() as number);
    expect(night).toBeGreaterThan(before);
    expect(night).toBeLessThanOrEqual(10);
    const inside = await page.evaluate(() => {
      const { scene } = (window as any).__game.__gfx();
      return Boolean(scene.getObjectByName('dog-house'));
    });
    expect(inside).toBe(true);
  });

  test('the routine: after the clock is set to night they wait a moment, then go inside; in the morning they come out', async ({ page }) => {
    test.setTimeout(120_000);
    await startPlanet(page);
    const fastForward = (s: number) =>
      page.evaluate((sec) => {
        const g = (window as any).__game;
        g.pause();
        g.advance(Math.round(sec * 60));
        g.resume();
      }, s);
    await page.evaluate(() => (window as any).__game.setTime(21));
    await fastForward(3);
    expect((await family(page)).every((p) => !p.indoors)).toBe(true);
    await fastForward(50);
    expect((await family(page)).every((p) => p.indoors)).toBe(true);
    // nobody to talk to at night
    await page.evaluate(() => (window as any).__game.visitHome());
    await fastForward(1);
    expect((await state(page)).target?.kind).not.toBe('npc');
    await page.evaluate(() => (window as any).__game.setTime(7));
    await fastForward(30);
    expect((await family(page)).every((p) => !p.indoors)).toBe(true);
  });

  test('talk to Rojina: E opens the dialog with her name, E finishes and goes on, Space ends it and hands back the planet', async ({ page }) => {
    test.setTimeout(120_000);
    await startPlanet(page);
    await page.evaluate(() => {
      const g = (window as any).__game;
      g.npcDo('rojina', 'watch');
      g.nearNpc('rojina', 0.9);
    });
    await expect(page.getByTestId('seat-prompt').getByRole('button', { name: /Talk to Rojina/ })).toBeVisible({ timeout: 20_000 });
    await page.keyboard.press('KeyE');
    const box = page.getByTestId('talk-box');
    await expect(box).toBeVisible();
    await expect(box).toHaveAttribute('aria-label', 'Talking with Rojina');
    let s = await state(page);
    expect(s.talk?.name).toBe('Rojina');
    expect(s.talk!.lines.length).toBeGreaterThanOrEqual(2);
    expect((await family(page)).find((p) => p.id === 'rojina')!.chatting).toBe(true);
    // the line types out; E shows all of it, the next E goes on to the next line
    await page.keyboard.press('KeyE');
    await expect(page.getByTestId('talk-line')).toHaveText(s.talk!.lines[0]);
    await page.keyboard.press('KeyE');
    await expect.poll(async () => (await state(page)).talk?.index).toBe(1);
    // the live region reads each line
    await expect(page.getByTestId('live-region')).toContainText('Rojina:');
    await noSeriousViolations(page);
    // while talking, walking keys do nothing
    const at = (await state(page)).pLocal;
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(400);
    await page.keyboard.up('KeyW');
    expect((await state(page)).pLocal).toEqual(at);
    // Space ends it (the close button says so)
    await expect(box.getByRole('button', { name: 'Stop talking' }).locator('kbd')).toHaveText('Space');
    await page.keyboard.press('Space');
    await expect(box).toBeHidden();
    s = await state(page);
    expect(s.talk).toBeNull();
    expect(s.menuOpen).toBe(false);
    await expect(page.locator('.game-region')).toBeFocused();
    expect((await family(page)).find((p) => p.id === 'rojina')!.chatting).toBe(false);
  });

  test('the visitor picks up the watering can, waters a plant and puts the can back', async ({ page }) => {
    test.setTimeout(120_000);
    await startPlanet(page);
    type G = { holder: string | null; wet: number[]; plants: number };
    const garden = () => page.evaluate(() => (window as any).__game.garden() as G);
    const prompt = page.getByTestId('seat-prompt');
    expect((await garden()).plants).toBe(12);
    // by the can nobody else takes it (the visitor has priority); if Rojina or Prabin already has it, they bring it back
    expect(await page.evaluate(() => (window as any).__game.nearCan())).toBe(true);
    for (let i = 0; i < 20 && (await garden()).holder; i++) {
      await page.evaluate(() => {
        const g = (window as any).__game;
        g.pause();
        g.advance(600);
        g.resume();
        g.nearCan();
      });
    }
    await expect(prompt.getByRole('button', { name: /Pick up the watering can/ })).toBeVisible();
    await page.keyboard.press('KeyE');
    await expect.poll(async () => (await garden()).holder).toBe('visitor');
    // by a plant, E waters it: the soil round it is wet
    expect(await page.evaluate(() => (window as any).__game.nearPlant(0, 0))).toBe(true);
    await expect(prompt.getByRole('button', { name: /Water the (cabbage|tomato plant)/ })).toBeVisible();
    const before = (await garden()).wet;
    await page.keyboard.press('KeyE');
    await expect.poll(async () => (await state(page)).acting).toBe('water');
    await page.evaluate(() => {
      const g = (window as any).__game;
      g.pause();
      g.advance(150);
      g.resume();
    });
    const after = (await garden()).wet;
    expect(after.some((w, i) => w > 0.9 && w > before[i])).toBe(true);
    await expect(page.getByTestId('live-region')).toContainText(/Watered the|Every plant is watered/);
    // back by the beds, E puts it down
    expect(await page.evaluate(() => (window as any).__game.nearCan())).toBe(true);
    await expect(prompt.getByRole('button', { name: /Put the can back/ })).toBeVisible();
    await page.keyboard.press('KeyE');
    await expect.poll(async () => (await garden()).holder).toBeNull();
    await noSeriousViolations(page);
  });
});

test.describe('collecting & inventory', () => {
  type Inv = { backpack: (string | null)[]; chest: (string | null)[]; held: string | null; selected: number };
  const inv = (page: Page) => page.evaluate(() => (window as any).__game.inventory() as Inv);
  const count = (list: (string | null)[], id: string) => list.reduce((n, s) => n + (s && s.split(':')[0] === id ? Number(s.split(':')[1]) : 0), 0);
  /** Hold the live loop and run the simulation forward (deterministic and fast under software rendering). */
  const fastForward = (page: Page, seconds: number) =>
    page.evaluate((s) => {
      const g = (window as any).__game;
      g.pause();
      g.advance(Math.round(s * 60));
      g.resume();
    }, seconds);
  const prompt = (page: Page) => page.getByTestId('seat-prompt');

  test('shaking a fruit tree: fruit, a log and leaves fall and fly into the hotbar; the fruit is gone until it regrows', async ({ page }) => {
    test.setTimeout(120_000);
    await startPlanet(page);
    expect(await page.evaluate(() => (window as any).__game.nearTarget('tree', 'apple'))).toMatch(/^tree:apple:/);
    await expect(prompt(page).getByRole('button', { name: /Shake tree/ })).toBeVisible();
    await page.keyboard.press('KeyE');
    await expect.poll(async () => (await state(page)).acting).toBe('shake');
    await fastForward(page, 6);
    const i = await inv(page);
    expect(count(i.backpack, 'apple')).toBe(6);
    expect(count(i.backpack, 'log')).toBe(1);
    expect(count(i.backpack, 'leaves')).toBe(2);
    expect(await page.evaluate(() => (window as any).__game.drops().length)).toBe(0);
    // the hotbar shows the haul: apples first (hotbar order), with their count
    await expect(page.getByTestId('hotbar').getByRole('button', { name: 'Hotbar slot 1: Apple, 6' })).toBeVisible();
    await expect(page.getByTestId('hotbar').locator('img').first()).toHaveAttribute('src', /\/icons\/apple\.webp$/);
    // shaking again (same fixed cycle) gives no fruit until it regrows
    await page.keyboard.press('KeyE');
    await fastForward(page, 6);
    expect(count((await inv(page)).backpack, 'apple')).toBe(6);
    expect(count((await inv(page)).backpack, 'log')).toBe(2);
  });

  test('mining a boulder yields three stones; picking a flower collects that flower', async ({ page }) => {
    test.setTimeout(120_000);
    await startPlanet(page);
    expect(await page.evaluate(() => (window as any).__game.nearTarget('boulder'))).toMatch(/^boulder:/);
    await expect(prompt(page).getByRole('button', { name: /Mine boulder/ })).toBeVisible();
    await page.keyboard.press('KeyE');
    await expect.poll(async () => (await state(page)).acting).toBe('mine');
    await fastForward(page, 6);
    expect(count((await inv(page)).backpack, 'stone')).toBe(3);
    expect(await page.evaluate(() => (window as any).__game.nearTarget('flower', undefined, 0.6))).toMatch(/^flower:/);
    const pick = prompt(page).getByRole('button', { name: /^Pick (red|pink|yellow|white|orange|purple|blue) (tulip|cosmos|pansy)/ });
    await expect(pick).toBeVisible();
    const name = (await pick.textContent())!.match(/Pick (\w+) (\w+)/)!;
    await page.keyboard.press('KeyE');
    await fastForward(page, 4);
    expect(count((await inv(page)).backpack, `${name[2]}-${name[1]}`)).toBe(1);
  });

  test('the chest by the Workshop: Shift+click moves stacks both ways; I opens the backpack; hotbar keys, Q and the saved inventory', async ({ page }) => {
    test.setTimeout(150_000);
    await startPlanet(page);
    await page.evaluate(() => {
      const g = (window as any).__game;
      g.giveItem('apple', 10);
      g.giveItem('stone', 7);
    });
    expect(await page.evaluate(() => (window as any).__game.nearTarget('chest'))).toBe('chest');
    await expect(prompt(page).getByRole('button', { name: /Open chest/ })).toBeVisible();
    await page.keyboard.press('KeyE');
    await fastForward(page, 1);
    const screen = page.getByTestId('inventory-screen');
    await expect(screen.getByRole('dialog', { name: 'Chest' })).toBeVisible();
    await noSeriousViolations(page);
    await page.locator('[data-slot="backpack:0"]').last().click({ modifiers: ['Shift'] });
    let i = await inv(page);
    expect(i.chest[0]).toBe('apple:10');
    expect(i.backpack[0]).toBeNull();
    await page.locator('[data-slot="chest:0"]').click({ modifiers: ['Shift'] });
    i = await inv(page);
    expect(i.chest[0]).toBeNull();
    expect(i.backpack[8]).toBe('apple:10'); // chest → hotbar from the right, as in Minecraft
    // right-click takes half onto the cursor; Escape puts it back and closes
    await page.locator('[data-slot="backpack:1"]').last().click({ button: 'right' });
    expect((await inv(page)).held).toBe('stone:4');
    await page.keyboard.press('Escape');
    await expect(screen).toHaveCount(0);
    expect(count((await inv(page)).backpack, 'stone')).toBe(7);
    expect((await inv(page)).held).toBeNull();
    await expect(page.locator('.game-region')).toBeFocused();
    // I opens the backpack screen (no chest section); I closes it again
    await page.keyboard.press('KeyI');
    await expect(screen.getByRole('dialog', { name: 'Backpack' })).toBeVisible();
    await expect(screen.locator('[data-slot^="chest:"]')).toHaveCount(0);
    await page.keyboard.press('KeyI');
    await expect(screen).toHaveCount(0);
    // hotbar: 9 selects slot 9 (the apples); Q throws one ahead, which comes back after its pick-up delay
    await page.keyboard.press('Digit9');
    expect((await inv(page)).selected).toBe(8);
    await page.keyboard.press('KeyQ');
    expect((await inv(page)).backpack[8]).toBe('apple:9');
    expect(await page.evaluate(() => (window as any).__game.drops().length)).toBe(1);
    // it lands ~1.8 u ahead, out of the magnet's reach: still there after the delay
    await fastForward(page, 3);
    expect(await page.evaluate(() => (window as any).__game.drops().length)).toBe(1);
    // the inventory is saved
    await page.waitForTimeout(400);
    await page.reload();
    await page.waitForFunction(() => (window as any).__game && (window as any).__game.getState().phase !== 'loading', null, { timeout: 60_000 });
    i = await inv(page);
    expect(i.backpack[8]).toBe('apple:9');
    expect(i.selected).toBe(8);
  });

  test('organising in the chest screen: Shift+double-click moves every stack of an item, a drag previews its spread, the wheel moves one, Sort, Take all and Store all', async ({ page }) => {
    test.setTimeout(180_000);
    await startPlanet(page);
    await page.evaluate(() => {
      const g = (window as any).__game;
      g.giveItem('apple', 70);
      g.giveItem('log', 5);
    });
    expect(await page.evaluate(() => (window as any).__game.nearTarget('chest'))).toBe('chest');
    await page.keyboard.press('KeyE');
    await fastForward(page, 1);
    const screen = page.getByTestId('inventory-screen');
    await expect(screen.getByRole('dialog', { name: 'Chest' })).toBeVisible();
    // (the section tools are labelled buttons in a named group)
    await noSeriousViolations(page);
    const slot = (k: string) => page.locator(`[data-slot="${k}"]`).last();
    // Shift+double-click: both apple stacks go to the chest
    await slot('backpack:0').dblclick({ modifiers: ['Shift'] });
    let i = await inv(page);
    expect(count(i.chest, 'apple')).toBe(70);
    expect(count(i.backpack, 'apple')).toBe(0);
    await expect(page.getByTestId('live-region')).toContainText('Moved every stack of apple');
    // pick up the logs and drag across three slots: they show the spread before the release
    await slot('backpack:2').click();
    expect((await inv(page)).held).toBe('log:5');
    const box = async (k: string) => (await slot(k).boundingBox())!;
    const a = await box('backpack:9');
    const c = await box('backpack:11');
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2, { steps: 8 });
    await expect(screen.locator('.slot.spread')).toHaveCount(3);
    await page.mouse.up();
    i = await inv(page);
    expect(i.backpack.slice(9, 12)).toEqual(['log:1', 'log:1', 'log:1']);
    expect(i.held).toBe('log:2');
    await slot('backpack:12').click();
    // the wheel over a stack moves one to the other side
    const w = await box('backpack:9');
    await page.mouse.move(w.x + w.width / 2, w.y + w.height / 2);
    await page.mouse.wheel(0, 100);
    await expect.poll(async () => count((await inv(page)).chest, 'log')).toBe(1);
    // Sort merges the backpack's logs; Take all and Store all move everything
    await screen.getByRole('button', { name: 'Sort backpack' }).click();
    i = await inv(page);
    expect(i.backpack[9]).toBe('log:4');
    await expect(page.getByTestId('live-region')).toContainText('Backpack sorted.');
    await screen.getByRole('button', { name: 'Take all' }).click();
    i = await inv(page);
    expect(i.chest.every((s) => !s)).toBe(true);
    expect(count(i.backpack, 'apple')).toBe(70);
    await screen.getByRole('button', { name: 'Store all' }).click();
    i = await inv(page);
    expect(i.backpack.every((s) => !s)).toBe(true);
    await expect(page.getByTestId('live-region')).toContainText('Stored 75 items in the chest.');
  });
});

test.describe("crafting & Chopper's house", () => {
  type Inv = { backpack: (string | null)[] };
  type Craft = {
    built: boolean;
    colour: string;
    building: boolean;
    ghost: number;
    near: boolean;
    swing: { built: boolean; building: boolean; ghost: number; near: boolean; angle: number; rider: string | null; jute: number[] } | null;
    deck: { stage: number; ghost: number; near: boolean; building: boolean; deckH: number; bench: { visitor: boolean; family: string | null }; route: Array<[number, number, number]> } | null;
    furnace: { built: boolean; building: boolean; ghost: number; near: boolean; heat: number; clay: Array<{ n: [number, number, number]; water: string; left: number }> } | null;
  };
  const inv = (page: Page) => page.evaluate(() => (window as any).__game.inventory() as Inv);
  const count = (list: (string | null)[], id: string) => list.reduce((n, s) => n + (s && s.split(':')[0] === id ? Number(s.split(':')[1]) : 0), 0);
  const craft = (page: Page) => page.evaluate(() => (window as any).__game.craft() as Craft);
  const fastForward = (page: Page, seconds: number) =>
    page.evaluate((s) => {
      const g = (window as any).__game;
      g.pause();
      g.advance(Math.round(s * 60));
      g.resume();
    }, seconds);
  const prompt = (page: Page) => page.getByTestId('seat-prompt');
  const give = (page: Page, items: Array<[string, number]>) =>
    page.evaluate((list) => {
      for (const [id, n] of list) (window as any).__game.giveItem(id, n);
    }, items);

  test('the chest and the crafting table show they are ready: the chest wiggles and rests ajar, glowing; the tools come to life', async ({ page }) => {
    test.setTimeout(150_000);
    await startPlanet(page);
    type Cue = { on: number; since: number; wakes: number };
    const cues = () => page.evaluate(() => (window as any).__game.readyCues() as { chest: Cue; craft: Cue });
    const look = () =>
      page.evaluate(() => {
        const { scene } = (window as any).__game.__gfx();
        const body = scene.getObjectByName('chest-body');
        const lid = body.children[body.children.length - 1];
        const table = scene.getObjectByName('crafting-table');
        const tools = table.children.filter((o: any) => o.name.startsWith('tool-'));
        const glow = body.children.find((o: any) => o.isMesh && o.material?.isMeshBasicMaterial);
        const sparks = [scene.getObjectByName('chest'), table].map((g: any) => g.children.find((o: any) => o.isInstancedMesh)?.count ?? -1);
        return { lid: -lid.rotation.x, glow: glow.material.color.r, tools: tools.length, moved: tools.some((t: any) => t.position.y - t.userData.y0 > 0.003 || Math.abs(t.quaternion.w) < 0.9999), sparks };
      });
    // at rest: shut, dark, no glints
    let v = await look();
    expect(v.lid).toBeCloseTo(0, 3);
    expect(v.glow).toBe(0);
    expect(v.sparks).toEqual([0, 0]);
    expect(v.tools).toBe(6);
    await page.evaluate(() => {
      const t = (window as any).__game.__gfx().scene.getObjectByName('crafting-table');
      for (const o of t.children) if (o.name.startsWith('tool-')) o.userData.y0 = o.position.y;
    });
    // walking up to the chest wakes it (once); it then rests ajar, glowing, with glints over it
    expect(await page.evaluate(() => (window as any).__game.nearTarget('chest'))).toBe('chest');
    await expect.poll(async () => (await cues()).chest.on, { timeout: 20_000 }).toBeGreaterThan(0.95);
    expect((await cues()).chest.wakes).toBe(1);
    v = await look();
    expect(v.lid).toBeGreaterThan(0.1);
    expect(v.glow).toBeGreaterThan(0.5);
    expect(v.sparks[0]).toBeGreaterThan(0);
    // the crafting table: its tools hop to life and keep moving while you stay
    expect(await page.evaluate(() => (window as any).__game.nearTarget('craft'))).toBe('craft');
    await expect.poll(async () => (await cues()).craft.on, { timeout: 20_000 }).toBeGreaterThan(0.95);
    expect((await cues()).chest.on).toBeLessThan(0.5);
    await expect.poll(async () => (await look()).moved, { timeout: 20_000 }).toBe(true);
    expect((await look()).sparks[1]).toBeGreaterThan(0);
    // and the chest has settled shut again
    await expect.poll(async () => (await look()).lid, { timeout: 20_000 }).toBeLessThan(0.01);
  });

  test('the crafting table: its own prompt, the recipe book beside the backpack at a fixed size, the controls in a help popover, have / need, bulk crafting by keyboard, the landing, Space hands back the planet', async ({ page }) => {
    test.setTimeout(240_000);
    await startPlanet(page);
    await give(page, [
      ['log', 3],
      ['stone', 4],
    ]);
    expect(await page.evaluate(() => (window as any).__game.nearTarget('craft'))).toBe('craft');
    await expect(prompt(page).getByRole('button', { name: /Use crafting table/ })).toBeVisible();
    // (it has the E key even if a building's preview area reaches it: the card makes way)
    await expect(page.getByTestId('preview-card')).toHaveCount(0);
    await page.keyboard.press('KeyE');
    const screen = page.getByTestId('craft-screen');
    await expect(screen.getByRole('dialog', { name: 'Crafting table' })).toBeVisible();
    await noSeriousViolations(page);
    // Minecraft's layout: the recipes over your backpack and hotbar; the grid is icons, the name is in the detail
    await expect(screen.locator('[data-slot="backpack:0"]')).toBeVisible();
    await expect(screen.locator('[data-slot="backpack:35"]')).toBeVisible();
    await expect(screen.getByRole('listbox', { name: 'Recipes' })).not.toContainText(/Planks|beam|slab/i);
    await expect(screen.getByTestId('craft-detail').getByRole('heading', { name: 'Planks' })).toBeVisible();
    // planks are selected: 1 log makes 4; three logs make 12
    await expect(screen.getByRole('option', { name: /Planks/ })).toHaveAttribute('aria-selected', 'true');
    await expect(screen.getByTestId('craft-need')).toHaveCount(1);
    await expect(screen.getByTestId('craft-need').first()).toContainText('3 / 1');
    await expect(screen.getByTestId('craft-need').first()).toHaveClass(/ok/);
    await expect(screen.getByTestId('recipe-planks')).toContainText('×12');
    // the controls are behind the help button (shown on hover), not written under the panel
    const help = screen.getByTestId('help-card');
    await expect(help).toBeHidden();
    await screen.getByTestId('help-button').hover();
    await expect(help).toBeVisible();
    await expect(help).toContainText('Shift+Enter');
    await expect(help).toContainText('Right-click');
    await page.mouse.move(2, 400);
    await expect(help).toBeHidden();
    const size = () => screen.locator('.inv-panel').evaluate((el: HTMLElement) => `${el.offsetWidth}x${el.offsetHeight}`);
    const shown = await size();
    // + two at once, Enter crafts (a short hammering)
    await page.keyboard.press('Equal');
    await expect(screen.getByTestId('craft-qty')).toHaveText('8');
    await expect(screen.getByTestId('craft-need').first()).toContainText('3 / 2');
    await page.keyboard.press('Enter');
    await fastForward(page, 1);
    let i = await inv(page);
    expect(count(i.backpack, 'planks')).toBe(8);
    expect(count(i.backpack, 'log')).toBe(1);
    // it says where they went (the log and the stones are in slots 1 and 2)
    await expect(page.getByTestId('live-region')).toContainText('Crafted 8 planks: in hotbar slot 3.');
    // a beam needs two logs: with one left it's short, and Enter makes nothing
    await page.keyboard.press('ArrowRight');
    await expect(screen.getByRole('option', { name: /Wooden beam/ })).toHaveAttribute('aria-selected', 'true');
    await expect(screen.getByTestId('craft-need').first()).toContainText('1 / 2');
    await expect(screen.getByTestId('craft-need').first()).toHaveClass(/short/);
    // the panel holds its size whatever is picked
    expect(await size()).toBe(shown);
    await page.keyboard.press('Enter');
    await fastForward(page, 1);
    expect(count((await inv(page)).backpack, 'beam')).toBe(0);
    // a stone slab from two stones (and it lands: flies to its slot, which pops)
    const watchLanding = () =>
      page.evaluate(() => {
        const w = window as any;
        w.__landings = 0;
        w.__landObs?.disconnect();
        const seen = (el: Element) => el.classList.contains('craft-fly') || el.classList.contains('landed');
        w.__landObs = new MutationObserver((ms) => ms.forEach((m) => (m.type === 'attributes' ? seen(m.target as Element) : [...m.addedNodes].some((n) => n instanceof Element && seen(n))) && w.__landings++));
        w.__landObs.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
      });
    const landings = () => page.evaluate(() => (window as any).__landings as number);
    await watchLanding();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await fastForward(page, 1);
    i = await inv(page);
    expect(count(i.backpack, 'slab')).toBe(1);
    expect(count(i.backpack, 'stone')).toBe(2);
    expect(await size()).toBe(shown);
    await expect.poll(landings).toBeGreaterThan(0);
    await page.keyboard.press('Space');
    await expect(screen).toHaveCount(0);
    // opened again, it doesn't replay the last landing
    await watchLanding();
    await expect(prompt(page).getByRole('button', { name: /Use crafting table/ })).toBeVisible();
    await page.keyboard.press('KeyE');
    await expect(screen.getByRole('dialog', { name: 'Crafting table' })).toBeVisible();
    await page.waitForTimeout(1500);
    expect(await landings()).toBe(0);
    await page.keyboard.press('Space');
    await expect(screen).toHaveCount(0);
    await expect(page.locator('.game-region')).toBeFocused();
    expect((await state(page)).phase).toBe('playing');
  });

  test('the swing: pick jute behind the garden, twist it into rope, build the swing under the old oak, ride it, push a child on it; it is remembered', async ({ page }) => {
    test.setTimeout(200_000);
    await startPlanet(page);
    // a jute plant: its prompt, the pick, two bundles fall and come to the backpack, and it's cut until it regrows
    expect(await page.evaluate(() => (window as any).__game.nearTarget('jute', 'jute:0'))).toBe('jute:0');
    await expect(prompt(page).getByRole('button', { name: /Pick jute/ })).toBeVisible();
    await page.keyboard.press('KeyE');
    await fastForward(page, 3);
    await expect.poll(async () => count((await inv(page)).backpack, 'jute'), { timeout: 20_000 }).toBe(2);
    expect((await craft(page)).swing!.jute[0]).toBeGreaterThan(60);
    await expect(prompt(page).getByRole('button', { name: /Pick jute/ })).toHaveCount(0);
    // rope at the crafting table: 3 jute each
    await give(page, [['jute', 4]]);
    expect(await page.evaluate(() => (window as any).__game.nearTarget('craft'))).toBe('craft');
    await page.keyboard.press('KeyE');
    const screen = page.getByTestId('craft-screen');
    for (let k = 0; k < 3; k++) await page.keyboard.press('ArrowRight');
    await expect(screen.getByRole('option', { name: /Jute rope/ })).toHaveAttribute('aria-selected', 'true');
    await expect(screen.getByTestId('craft-need').first()).toContainText('6 / 3');
    await page.keyboard.press('Equal');
    await page.keyboard.press('Enter');
    await fastForward(page, 1);
    let i = await inv(page);
    expect(count(i.backpack, 'rope')).toBe(2);
    expect(count(i.backpack, 'jute')).toBe(0);
    await page.keyboard.press('Escape');
    // the swing's site: its ghost, its card (have / need), and it builds with everything there
    expect(await page.evaluate(() => (window as any).__game.nearTarget('site', 'site:swing'))).toBe('site:swing');
    await fastForward(page, 0.2);
    expect((await craft(page)).swing!.ghost).toBeGreaterThan(0.85);
    const card = page.getByTestId('site-card');
    await expect(card).toHaveAttribute('data-site', 'swing');
    await expect(card.getByRole('heading', { name: 'The swing' })).toBeVisible();
    await expect(card.getByTestId('site-need')).toHaveText([/Jute ropes\s*2 \/ 2/, /Planks\s*0 \/ 3/]);
    await expect(prompt(page).getByRole('button', { name: /See what the swing needs/ })).toBeVisible();
    await give(page, [['planks', 3]]);
    await expect(prompt(page).getByRole('button', { name: /Build the swing/ })).toBeVisible();
    await page.keyboard.press('KeyE');
    await fastForward(page, 3);
    let c = await craft(page);
    expect(c.swing!.built).toBe(true);
    expect(c.swing!.building).toBe(false);
    i = await inv(page);
    expect([count(i.backpack, 'rope'), count(i.backpack, 'planks')]).toEqual([0, 0]);
    await expect(page.getByTestId('site-card')).toHaveCount(0);
    await expect(page.getByTestId('live-region')).toContainText('You build the swing!');
    // ride it (swing.md §6): sit on it, E pumps it higher, Space gets off and it settles
    await expect(prompt(page).getByRole('button', { name: /Sit on the swing/ })).toBeVisible();
    await page.keyboard.press('KeyE');
    await fastForward(page, 1);
    expect((await craft(page)).swing!.rider).toBe('visitor');
    await expect(prompt(page)).toHaveAttribute('data-kind', 'seat-action');
    await expect(prompt(page).getByRole('button', { name: /Swing higher/ })).toBeVisible();
    await expect(prompt(page).getByRole('button', { name: /Stand up/ })).toBeVisible();
    for (let k = 0; k < 8; k++) {
      await page.keyboard.press('KeyE');
      await fastForward(page, 0.5);
    }
    const peak = await page.evaluate(() => {
      const g = (window as any).__game;
      g.pause();
      let peak = 0;
      for (let f = 0; f < 150; f++) {
        g.advance(1);
        peak = Math.max(peak, Math.abs(g.craft().swing.angle));
      }
      g.resume();
      return peak;
    });
    expect(peak).toBeGreaterThan(0.2);
    await page.keyboard.press('Space');
    await fastForward(page, 1);
    expect((await craft(page)).swing!.rider).not.toBe('visitor');
    expect((await page.evaluate(() => (window as any).__game.getState())).seated).toBe(false);
    // one of the children has a go (Laija, asked to, unless Lingjel got there first), and you can give them a push
    // (a meal comes first: ask again once it's over)
    await expect
      .poll(
        async () => {
          const rider = await page.evaluate(() => {
            const g = (window as any).__game;
            const laija = g.family().find((f: { id: string }) => f.id === 'laija');
            if (laija.activity !== 'swing' && !g.craft().swing.rider) g.npcDo('laija', 'swing');
            g.pause();
            g.advance(240);
            g.resume();
            const rider = g.craft().swing.rider;
            return g.family().find((f: { id: string }) => f.id === rider)?.seat ?? null;
          });
          return rider;
        },
        { timeout: 120_000 },
      )
      .toBe('swing:on');
    expect(['laija', 'lingjel']).toContain((await craft(page)).swing!.rider);
    expect(await page.evaluate(() => (window as any).__game.nearTarget('site', 'site:swing'))).toBe('site:swing');
    await expect(prompt(page).getByRole('button', { name: /Push the swing/ })).toBeVisible();
    // remembered
    await startPlanet(page);
    expect((await craft(page)).swing!.built).toBe(true);
  });

  test('the viewing deck: iron ore from a rusty boulder, nails from an ingot at the table, three builds up the cliff, a real climb to its bench; it is remembered', async ({ page }) => {
    test.setTimeout(300_000);
    await startPlanet(page);
    const g = (f: string, ...a: unknown[]) => page.evaluate(([f, a]) => (window as any).__game[f as string](...(a as unknown[])), [f, a] as const);
    const deck = async () => (await craft(page)).deck!;
    // iron: a rust-streaked boulder says so, and mining it gives iron ore with the stones
    expect(await g('nearTarget', 'boulder', 'boulder:1')).toBe('boulder:1');
    await expect(prompt(page).getByRole('button', { name: /Mine iron ore/ })).toBeVisible();
    await page.keyboard.press('KeyE');
    await fastForward(page, 3);
    await expect.poll(async () => count((await inv(page)).backpack, 'iron'), { timeout: 20_000 }).toBeGreaterThanOrEqual(1);
    // nails: one iron ingot (smelted from the ore at the furnace: its own test) makes six at the crafting table
    await give(page, [['ingot', 1]]);
    expect(await g('nearTarget', 'craft')).toBe('craft');
    await expect(prompt(page).getByRole('button', { name: /Use crafting table/ })).toBeVisible();
    await page.keyboard.press('KeyE');
    const screen = page.getByTestId('craft-screen');
    await screen.getByRole('option', { name: /Nails/ }).click();
    await expect(screen.getByRole('option', { name: /Nails/ })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    await fastForward(page, 1);
    expect(count((await inv(page)).backpack, 'nails')).toBe(6);
    await page.keyboard.press('Escape');
    // stage 1 at the steps' foot: the ghost, the card, the build
    expect(await g('nearTarget', 'site', 'site:deck1')).toBe('site:deck1');
    await fastForward(page, 0.2);
    expect((await deck()).stage).toBe(0);
    expect((await deck()).ghost).toBeGreaterThan(0.7);
    const card = page.getByTestId('site-card');
    await expect(card).toHaveAttribute('data-site', 'deck1');
    await expect(prompt(page).getByRole('button', { name: /See what the steps need/ })).toBeVisible();
    await give(page, [['slab', 4], ['planks', 6], ['beam', 3], ['nails', 6]]);
    await expect(prompt(page).getByRole('button', { name: /Build the steps/ })).toBeVisible();
    await page.keyboard.press('KeyE');
    await fastForward(page, 3);
    expect((await deck()).stage).toBe(1);
    await expect(page.getByTestId('live-region')).toContainText('You build the steps up the cliff!');
    // the next two builds, from where the one before leads
    for (const [k, needs, label] of [
      [2, [['slab', 2], ['planks', 6], ['beam', 2], ['nails', 12]], /Build the upper steps/],
      [3, [['planks', 8], ['beam', 4], ['nails', 18]], /Build the deck/],
    ] as const) {
      expect(await g('nearTarget', 'site', `site:deck${k}`)).toBe(`site:deck${k}`);
      await fastForward(page, 0.2);
      await expect(card).toHaveAttribute('data-site', `deck${k}`);
      await give(page, needs as unknown as Array<[string, number]>);
      await expect(prompt(page).getByRole('button', { name: label })).toBeVisible();
      await page.keyboard.press('KeyE');
      await fastForward(page, 3);
      expect((await deck()).stage).toBe(k);
    }
    // the climb, for real: from the meadow at the foot, corner by corner, up to the platform
    expect(await g('nearTarget', 'site', 'site:deck1', 1.2)).toBe('site:deck1');
    const route = (await deck()).route;
    for (const p of route) {
      await g('walkTo', p);
      await fastForward(page, 4);
    }
    const top = await page.evaluate(() => (window as any).__game.groundInfo());
    expect(top.walk).toBeCloseTo((await deck()).deckH, 2);
    // the bench: sit and look out; Space stands up
    expect(await g('nearTarget', 'bench', 'deck:bench')).toBe('deck:bench');
    await expect(prompt(page).getByRole('button', { name: /Sit on the bench/ })).toBeVisible();
    await page.keyboard.press('KeyE');
    await fastForward(page, 1);
    expect((await deck()).bench.visitor).toBe(true);
    await page.keyboard.press('Space');
    await fastForward(page, 1);
    expect((await deck()).bench.visitor).toBe(false);
    // remembered
    await startPlanet(page);
    expect((await deck()).stage).toBe(3);
  });

  test('the furnace: dig clay on a bank, stone blocks and firewood at the table, build it behind the table, smelt iron ore into ingots, nails from an ingot; it is remembered', async ({ page }) => {
    test.setTimeout(240_000);
    await startPlanet(page);
    const g = (f: string, ...a: unknown[]) => page.evaluate(([f, a]) => (window as any).__game[f as string](...(a as unknown[])), [f, a] as const);
    const furnace = async () => (await craft(page)).furnace!;
    // clay: a grey bed on the bank, the dig, two lumps come to the backpack, and it's dug out until it fills back up
    expect(await g('nearTarget', 'clay', 'clay:0')).toBe('clay:0');
    await expect(prompt(page).getByRole('button', { name: /Dig clay/ })).toBeVisible();
    await page.keyboard.press('KeyE');
    await fastForward(page, 3);
    await expect.poll(async () => count((await inv(page)).backpack, 'clay'), { timeout: 20_000 }).toBe(2);
    expect((await furnace()).clay[0].left).toBeGreaterThan(60);
    await expect(prompt(page).getByRole('button', { name: /Dig clay/ })).toHaveCount(0);
    // stone blocks (3 stones each) and firewood (3 from a log) at the crafting table
    await give(page, [['stone', 3], ['log', 1]]);
    expect(await g('nearTarget', 'craft')).toBe('craft');
    await expect(prompt(page).getByRole('button', { name: /Use crafting table/ })).toBeVisible();
    await page.keyboard.press('KeyE');
    let screen = page.getByTestId('craft-screen');
    for (const [name, item, n] of [
      [/Stone block/, 'block', 1],
      [/Firewood/, 'firewood', 3],
    ] as const) {
      await screen.getByRole('option', { name }).click();
      await expect(screen.getByRole('option', { name })).toHaveAttribute('aria-selected', 'true');
      await page.keyboard.press('Enter');
      await fastForward(page, 1);
      expect(count((await inv(page)).backpack, item)).toBe(n);
    }
    await page.keyboard.press('Space');
    await expect(screen).toHaveCount(0);
    // the site behind the table: its ghost, its card, what's missing, and it builds with everything there
    expect(await g('nearTarget', 'site', 'site:furnace')).toBe('site:furnace');
    await fastForward(page, 0.2);
    expect((await furnace()).built).toBe(false);
    expect((await furnace()).ghost).toBeGreaterThan(0.7);
    const card = page.getByTestId('site-card');
    await expect(card).toHaveAttribute('data-site', 'furnace');
    await expect(card.getByRole('heading', { name: 'The furnace' })).toBeVisible();
    await expect(card.getByTestId('site-need')).toHaveText([/Stone blocks\s*1 \/ 6/, /Clay\s*2 \/ 4/]);
    await expect(prompt(page).getByRole('button', { name: /See what the furnace needs/ })).toBeVisible();
    await page.keyboard.press('KeyE');
    await expect(page.locator('.toast')).toContainText('The furnace still needs');
    await give(page, [['block', 5], ['clay', 2]]);
    await expect(prompt(page).getByRole('button', { name: /Build the furnace/ })).toBeVisible();
    await page.keyboard.press('KeyE');
    await fastForward(page, 3);
    expect((await furnace()).built).toBe(true);
    expect((await furnace()).building).toBe(false);
    let i = await inv(page);
    expect([count(i.backpack, 'block'), count(i.backpack, 'clay')]).toEqual([0, 0]);
    await expect(page.getByTestId('live-region')).toContainText('You build the furnace!');
    await expect(card).toHaveCount(0);
    // smelting: iron ore and firewood make an ingot, and the fire roars while it does
    await give(page, [['iron', 2]]);
    await expect(prompt(page).getByRole('button', { name: /Use the furnace/ })).toBeVisible();
    await page.keyboard.press('KeyE');
    screen = page.getByTestId('craft-screen');
    await expect(screen.getByRole('dialog', { name: 'Furnace' })).toBeVisible();
    await expect(screen.getByRole('option', { name: /Iron ingot/ })).toHaveAttribute('aria-selected', 'true');
    await expect(screen.getByTestId('craft-go')).toContainText('Smelt');
    await page.keyboard.press('Equal');
    await page.keyboard.press('Enter');
    await fastForward(page, 0.5);
    expect((await furnace()).heat).toBeGreaterThan(0.9);
    await fastForward(page, 3);
    i = await inv(page);
    expect([count(i.backpack, 'ingot'), count(i.backpack, 'iron'), count(i.backpack, 'firewood')]).toEqual([2, 0, 1]);
    await expect(page.getByTestId('live-region')).toContainText('Smelted');
    await page.keyboard.press('Space');
    await expect(screen).toHaveCount(0);
    // nails: from an ingot at the table (iron ore alone makes none)
    expect(await g('nearTarget', 'craft')).toBe('craft');
    await page.keyboard.press('KeyE');
    screen = page.getByTestId('craft-screen');
    await screen.getByRole('option', { name: /Nails/ }).click();
    await page.keyboard.press('Enter');
    await fastForward(page, 1);
    i = await inv(page);
    expect([count(i.backpack, 'nails'), count(i.backpack, 'ingot')]).toEqual([6, 1]);
    await page.keyboard.press('Space');
    // remembered
    await startPlanet(page);
    expect((await furnace()).built).toBe(true);
  });

  test("Chopper's house: the ghost grows clearer as you come, the card says what's needed, E builds it, it's saved, solid and paintable", async ({ page }) => {
    test.setTimeout(200_000);
    await startPlanet(page);
    // (the doghouse's site: the swing's is a site too)
    const near = (u?: number) => page.evaluate((u) => (window as any).__game.nearTarget('site', 'site', u), u);
    expect(await near(11)).toBe('site');
    await fastForward(page, 0.2);
    const far = await craft(page);
    expect(far.built).toBe(false);
    expect(far.ghost).toBeLessThan(0.2);
    expect(far.near).toBe(false);
    await expect(page.getByTestId('site-card')).toHaveCount(0);
    // the card is up only while the site is what E would use (nothing else nearby gets a card)
    expect(await near(0.8)).toBe('site');
    await fastForward(page, 0.2);
    const close = await craft(page);
    expect(close.ghost).toBeGreaterThan(0.85);
    const card = page.getByTestId('site-card');
    await expect(card).toBeVisible();
    await expect(card.getByRole('heading', { name: "Chopper’s house" })).toBeVisible();
    await expect(card.getByTestId('site-need')).toHaveText([/Stone slabs\s*0 \/ 2/, /Wooden beams\s*0 \/ 2/, /Planks\s*0 \/ 4/, /Nails\s*0 \/ 6/]);
    // before it's built you can stand in its spot
    expect(await near(0.2)).toBe('site');
    // at the site: E says what's missing and builds nothing
    expect(await near()).toBe('site');
    await expect(prompt(page).getByRole('button', { name: /See what Chopper's house needs/ })).toBeVisible();
    await page.keyboard.press('KeyE');
    await expect(page.locator('.toast')).toContainText("still needs 2 stone slabs, 2 wooden beams, 4 planks and 6 nails");
    expect((await craft(page)).built).toBe(false);
    // with everything, the prompt changes and E builds it
    await give(page, [
      ['slab', 2],
      ['beam', 2],
      ['planks', 5],
      ['nails', 6],
    ]);
    await expect(prompt(page).getByRole('button', { name: /Build Chopper's house/ })).toBeVisible();
    await expect(card.getByTestId('site-need')).toHaveText([/2 \/ 2/, /2 \/ 2/, /4 \/ 4/, /6 \/ 6/]);
    await page.keyboard.press('KeyE');
    let c = await craft(page);
    expect(c.built).toBe(true);
    expect(c.building).toBe(true);
    const i = await inv(page);
    expect([count(i.backpack, 'slab'), count(i.backpack, 'beam'), count(i.backpack, 'planks')]).toEqual([0, 0, 1]);
    await fastForward(page, 3);
    c = await craft(page);
    expect(c.building).toBe(false);
    expect(c.ghost).toBe(0);
    await expect(card).toHaveCount(0);
    expect((await page.evaluate(() => (window as any).__game.chopper())).behaviour).toBe('house');
    // it's solid now: there's nowhere to stand inside it
    expect(await near(0.2)).toBeNull();
    // saved: still built after a reload
    await page.reload();
    await page.waitForFunction(() => (window as any).__game && (window as any).__game.getState().phase !== 'loading', null, { timeout: 60_000 });
    await expect.poll(async () => (await state(page)).phase).toBe('playing');
    expect((await craft(page)).built).toBe(true);
    // painting: one pot of a paint you've made, or Original red for free; the colour is saved
    await give(page, [['paint-blue', 1]]);
    expect(await near()).toBe('site');
    await expect(prompt(page).getByRole('button', { name: /Paint Chopper's house/ })).toBeVisible();
    await page.keyboard.press('KeyE');
    const palette = page.getByTestId('paint-screen');
    await expect(palette.getByRole('dialog', { name: 'Paint Chopper’s house' })).toBeVisible();
    await noSeriousViolations(page);
    await expect(palette.getByTestId('paint-original')).toHaveAttribute('aria-pressed', 'true');
    await expect(palette.getByTestId('paint-red')).toBeDisabled();
    await palette.getByTestId('paint-blue').click();
    await expect(palette).toHaveCount(0);
    expect((await craft(page)).colour).toBe('blue');
    expect(count((await inv(page)).backpack, 'paint-blue')).toBe(0);
    await page.waitForTimeout(300);
    await page.reload();
    await page.waitForFunction(() => (window as any).__game && (window as any).__game.getState().phase !== 'loading', null, { timeout: 60_000 });
    expect((await craft(page)).colour).toBe('blue');
  });
});

test.describe('player character', () => {
  test('loads the rigged CC0 character model', async ({ page }) => {
    const glb: string[] = [];
    page.on('response', (r) => r.url().endsWith('/models/character.glb') && glb.push(String(r.status())));
    await startPlanet(page);
    await expect.poll(async () => (await state(page)).avatar, { timeout: 20_000 }).toBe('model');
    // (the page warms the cache with it, so the loader's request is answered from the cache)
    expect(glb.length).toBeGreaterThan(0);
    expect(glb.every((s) => s === '200')).toBe(true);
    expect((await state(page)).outlines).toBeGreaterThan(0);
  });

  test("the character's outline shows through a building in front of it, and only then", async ({ page }) => {
    test.setTimeout(120_000);
    // hold the world still so the frames differ only by the outline
    await page.addInitScript(() => localStorage.setItem('site.pauseAmbient', '1'));
    await startPlanet(page);
    await expect.poll(async () => (await state(page)).avatar, { timeout: 20_000 }).toBe('model');
    await page.evaluate(() => {
      const g = (window as any).__game;
      g.setAdaptiveQuality(false);
      g.setTime(10.5);
      g.setWind(0);
    });
    // pixels the outline brightens (0 when nothing hides the character)
    const brightened = async () => {
      const shot = async (on: boolean) => {
        await page.evaluate((v) => (window as any).__game.setOutline(v), on);
        await page.waitForTimeout(1200);
        return (await page.screenshot({ clip: { x: 0, y: 70, width: 1280, height: 640 } })).toString('base64');
      };
      const off = await shot(false);
      const on = await shot(true);
      return page.evaluate(
        async ([a, b]) => {
          const read = async (b64: string) => {
            const img = new Image();
            img.src = `data:image/png;base64,${b64}`;
            await img.decode();
            const cv = document.createElement('canvas');
            cv.width = img.width;
            cv.height = img.height;
            const ctx = cv.getContext('2d')!;
            ctx.drawImage(img, 0, 0);
            return ctx.getImageData(0, 0, cv.width, cv.height).data;
          };
          const [d0, d1] = [await read(a), await read(b)];
          const lum = (d: Uint8ClampedArray, i: number) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
          let n = 0;
          for (let i = 0; i < d0.length; i += 4) if (lum(d1, i) - lum(d0, i) > 40) n++;
          return n;
        },
        [off, on] as const,
      );
    };
    // in the open: nothing to show through
    const open = await brightened();
    expect(open).toBeLessThan(200); // the idle animation alone moves a few edge pixels
    // behind the library, with the view tilted low so the roof hides the character
    await page.evaluate(() => (window as any).__game.standBehind('library'));
    await page.locator('.game-region').focus();
    await page.keyboard.down('PageDown');
    await page.waitForTimeout(1500);
    await page.keyboard.up('PageDown');
    await expect.poll(async () => (await state(page)).pitch).toBeCloseTo(30, 1);
    const hidden = await brightened();
    // the open count is idle-animation noise (measured 35–80 px between runs); a working outline gives ~560,
    // a broken one about the noise again
    expect(hidden).toBeGreaterThan(Math.max(400, open * 4));
  });

  test('the character picker switches to the female character (thick ring on the chosen one), by click or arrow keys, and remembers it', async ({ page }) => {
    test.setTimeout(150_000); // two planet loads
    const glbs: string[] = [];
    page.on('response', (r) => r.url().includes('/models/') && glbs.push(`${new URL(r.url()).pathname} ${r.status()}`));
    await startPlanet(page);
    const picker = page.getByRole('radiogroup', { name: 'Choose your character' });
    await expect(picker).toBeVisible();
    const radios = picker.getByRole('radio');
    await expect(radios).toHaveCount(2);
    const skater = page.locator('[data-character="skater"]');
    const sunny = page.locator('[data-character="sunny"]');
    await expect(skater).toHaveAttribute('aria-checked', 'true');
    await expect(sunny).toHaveAttribute('aria-checked', 'false');
    await expect.poll(async () => (await state(page)).avatarModel, { timeout: 20_000 }).toBe('skater');
    // the chosen one wears the thick ring
    const ring = (el: typeof skater) => el.evaluate((b) => parseFloat(getComputedStyle(b).borderTopWidth));
    expect(await ring(skater)).toBeGreaterThanOrEqual(4);
    expect(await ring(sunny)).toBeLessThanOrEqual(2);
    // portraits load
    await expect.poll(() => sunny.locator('img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await sunny.click();
    await expect(sunny).toHaveAttribute('aria-checked', 'true');
    await expect(skater).toHaveAttribute('aria-checked', 'false');
    expect(await ring(sunny)).toBeGreaterThanOrEqual(4);
    await expect.poll(async () => (await state(page)).avatarModel, { timeout: 20_000 }).toBe('sunny');
    expect(glbs).toContain('/models/character-female.glb 200');
    expect((await state(page)).avatar).toBe('model');
    // still walks
    const before = (await state(page)).pLocal;
    await page.keyboard.down('w');
    await page.waitForTimeout(700);
    await page.keyboard.up('w');
    expect((await state(page)).pLocal).not.toEqual(before);
    // remembered on the next visit
    expect(await page.evaluate(() => localStorage.getItem('site.character'))).toBe('sunny');
    await page.reload();
    await startPlanet(page);
    await expect(page.locator('[data-character="sunny"]')).toHaveAttribute('aria-checked', 'true');
    await expect.poll(async () => (await state(page)).avatarModel, { timeout: 20_000 }).toBe('sunny');
    // keyboard: the group is one Tab stop; an arrow key moves and selects
    await page.locator('[data-character="sunny"]').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('[data-character="skater"]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('[data-character="skater"]')).toBeFocused();
    await expect.poll(async () => (await state(page)).character).toBe('skater');
    await expect.poll(async () => (await state(page)).avatarModel, { timeout: 20_000 }).toBe('skater');
    await noSeriousViolations(page);
  });

  test('falls back to the procedural avatar if the model cannot load', async ({ page }) => {
    await page.route('**/models/character.glb', (r) => r.abort());
    await startPlanet(page);
    await page.waitForTimeout(1500);
    expect((await state(page)).avatar).toBe('procedural');
    expect((await state(page)).outlines).toBeGreaterThan(0);
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
  test("Prabin's welcome is on the page from the first paint and the game takes it over where it was: he faces you, E goes through his lines, a step ends it; keys are ignored when a HUD button has focus", async ({ page }) => {
    test.setTimeout(150_000);
    // (the game's code is held back, so the welcome is read while the planet loads)
    let release = () => {};
    const held = new Promise<void>((r) => (release = r));
    await page.route('**/game-mount*.js', async (r) => {
      await held;
      await r.continue();
    });
    let second = '';
    await openPlanet(page, '/play/', {
      welcome: true,
      beforeGame: async () => {
        const greet = page.locator('[data-greeting]');
        await expect(greet).toBeVisible();
        await expect(greet).toContainText('Prabin');
        await expect(greet.locator('.talk-head img')).toBeVisible();
        await expect(greet).toContainText('Welcome to my little planet');
        await expect(page.locator('[data-load-scene]')).toBeVisible();
        await greet.getByRole('button', { name: /Next/ }).click();
        await expect(greet).not.toContainText('Welcome to my little planet');
        second = (await greet.locator('[data-greeting-line]').textContent()) ?? '';
        release();
      },
    });
    await expect(page.getByRole('button', { name: 'Start exploring' })).toHaveCount(0);
    await expect(page.locator('.game-region')).toBeFocused();
    // the page's welcome is handed over: the game's talk box goes on from the same line
    await expect(page.locator('[data-greeting]')).toHaveCount(0);
    await expect(page.locator('[data-load-scene]')).toHaveCount(0);
    const talk = page.getByTestId('talk-box');
    await expect(talk).toBeVisible();
    await expect(talk).toContainText('Prabin');
    await expect(talk).toContainText(second);
    expect((await state(page)).talk!.index).toBe(1);
    const prabin = await page.evaluate(() => (window as any).__game.family().find((p: { id: string }) => p.id === 'prabin'));
    expect(prabin.chatting).toBe(true);
    expect(prabin.d).toBeLessThan(1.6);
    // the controls are in the talk, and where to find them again
    const lines = (await state(page)).talk!.lines as string[];
    expect(lines.join(' ')).toMatch(/W A S D/);
    expect(lines.at(-1)).toMatch(/notice board/);
    await page.waitForTimeout(350);
    await page.keyboard.press('e');
    await expect.poll(async () => (await state(page)).talk?.index).toBe(2);
    await expect(page.locator('.game-region')).toBeFocused();

    // a step ends the welcome and walks
    const before = await state(page);
    await page.keyboard.down('w');
    await page.waitForTimeout(700);
    await page.keyboard.up('w');
    await expect(talk).toBeHidden();
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

  test('the notice board by the path to the Lighthouse: walking up to it glows and prompts, E opens How to play; the menu opens it too', async ({ page }) => {
    test.setTimeout(150_000);
    await startPlanet(page);
    expect(await page.evaluate(() => (window as any).__game.nearTarget('notice', undefined, 0.8))).toBe('notice');
    const prompt = page.getByTestId('seat-prompt');
    await expect(prompt).toHaveAttribute('data-kind', 'notice');
    await expect(prompt.getByRole('button', { name: /Read the board/ })).toBeVisible();
    // the same glowing ring as every target
    await expect.poll(() => page.evaluate(() => (window as any).__game.__gfx()?.scene.getObjectByName('target-cue')?.visible)).toBe(true);
    await page.keyboard.press('e');
    const dialog = page.getByTestId('menu-dialog');
    await expect(dialog.getByRole('heading', { name: 'How to play' })).toBeVisible();
    await expect(dialog).toContainText('W');
    await expect(dialog.getByRole('heading', { name: 'Tips' })).toBeVisible();
    await noSeriousViolations(page);
    await page.keyboard.press('Space');
    await expect(dialog).toBeHidden();
    // from the menu: Show controls
    await page.getByTestId('menu-button').click();
    await dialog.getByRole('button', { name: 'Show controls' }).click();
    await expect(dialog.getByRole('heading', { name: 'How to play' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toBeHidden();
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

  test('proximity preview, open with E, close with Space (focus + URL restored)', async ({ page }) => {
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
    await expect(dialog.getByRole('link', { name: /Classic page/ })).toHaveAttribute('href', '/classic/workshop/');
    await noSeriousViolations(page);

    // Space closes it, through history like Esc and Close
    await page.keyboard.press('Space');
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/play\/(\?at=workshop)?$/);
    await expect(page.locator('.game-region')).toBeFocused();
  });

  test('click to walk: the walk cursor over the ground (not the sky), a marker where the character goes, gone once it stops', async ({ page }) => {
    test.setTimeout(120_000);
    await startPlanet(page);
    const region = page.locator('.game-region');
    const box = (await region.boundingBox())!;
    const marker = () => page.evaluate(() => (window as any).__game.__gfx()?.scene.getObjectByName('walk-marker')?.visible ?? null);
    expect(await marker()).toBe(false);
    // the sky: the game's arrow; the ground: the walk cursor (a generated image, not the system's)
    await page.mouse.move(box.x + 30, box.y + box.height * 0.3);
    await expect(region).not.toHaveAttribute('data-cursor', 'walk');
    const gx = box.x + box.width * 0.58;
    const gy = box.y + box.height * 0.78;
    await page.mouse.move(gx, gy);
    await expect(region).toHaveAttribute('data-cursor', 'walk');
    expect(await region.evaluate((el) => getComputedStyle(el).cursor)).toMatch(/image-set|url\(/);
    // a click walks there and leaves the marker, which goes once the walk ends
    await page.mouse.click(gx, gy);
    await expect.poll(marker).toBe(true);
    await expect.poll(async () => (await state(page)).autoWalk, { timeout: 60_000 }).toBe(false);
    await expect.poll(marker, { timeout: 20_000 }).toBe(false);
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
    await menu.getByRole('button', { name: /Fast travel/ }).click();
    await expect(menu.getByRole('heading', { name: 'Fast travel' })).toBeVisible();
    await menu.getByRole('button', { name: /Post Office/ }).click();
    await expect(menu).toBeHidden();
    await expect.poll(async () => (await state(page)).nearby, { timeout: 15_000 }).toBe('post-office');
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

  test('fast travel: T opens the places as tiles (so does the header button), the arrow keys go from tile to tile, a number flies there; the shortcuts work with the focus on nothing; B opens and closes the backpack', async ({ page }) => {
    test.setTimeout(120_000);
    await startPlanet(page);
    const menu = page.getByTestId('menu-dialog');
    // the header's button
    await page.getByTestId('travel-button').click();
    await expect(menu.getByRole('heading', { name: 'Fast travel' })).toBeVisible();
    const tiles = menu.locator('.travel-tile');
    await expect(tiles).toHaveCount(8);
    await expect(tiles.first()).toBeFocused();
    await expect(tiles.last()).toContainText('The plaza');
    await expect(tiles.last()).toHaveAttribute('aria-current', 'location');
    await noSeriousViolations(page);
    // T closes it, as it opened it
    await page.keyboard.press('t');
    await expect(menu).toBeHidden();
    // with the focus on nothing, T still opens it
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('t');
    await expect(menu.getByRole('heading', { name: 'Fast travel' })).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(tiles.nth(1)).toBeFocused();
    await expect(tiles.nth(1)).toContainText('Town Hall');
    await page.keyboard.press('Space');
    await expect(menu).toBeHidden();
    // B for the backpack, both ways
    await page.keyboard.press('b');
    await expect(page.getByTestId('inventory-screen')).toBeVisible();
    await page.keyboard.press('b');
    await expect(page.getByTestId('inventory-screen')).toHaveCount(0);
    // a place's number flies there
    await page.keyboard.press('t');
    await expect(menu.getByRole('heading', { name: 'Fast travel' })).toBeVisible();
    await page.keyboard.press('2');
    await expect(menu).toBeHidden();
    // the fly-over is ~16 frames at the capped step: slow under software rendering
    await expect.poll(async () => (await state(page)).nearby, { timeout: 20_000 }).toBe('town-hall');
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
