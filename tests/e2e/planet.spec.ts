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
  target: { kind: string; key: string; label: string } | null;
  acting: 'shake' | 'mine' | 'pick' | 'open' | null;
  invScreen: 'backpack' | 'chest' | null;
  /** Chopper's profile card is open. */
  chopperOpen: boolean;
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

test.describe('rendering', () => {
  test('hand-painted textures all load before the planet appears (no procedural fallback)', async ({ page }) => {
    const statuses: number[] = [];
    page.on('response', (r) => r.url().includes('/textures/') && statuses.push(r.status()));
    await openPlanet(page);
    const s = await state(page);
    expect(s.textures.failed).toBe(0);
    expect(s.textures.pending).toBe(0);
    expect(s.textures.loaded).toBeGreaterThanOrEqual(12);
    expect(statuses.length).toBe(s.textures.loaded);
    expect(statuses.every((c) => c === 200)).toBe(true);
  });

  test('tilt-shift survives adaptive quality falling all the way back', async ({ page }) => {
    await openPlanet(page, '/play/?quality=high');
    // this test drives the steps itself (forced steps bypass the flag); the monitor would otherwise
    // step down on its own at SwiftShader's frame rate, part-way through
    await page.evaluate(() => (window as any).__game.setAdaptiveQuality(false));
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

  test('the tilt-shift replaces the image rather than adding to it, so the frame is exposed once and highlights keep their range', async ({ page }) => {
    await openPlanet(page, '/play/?quality=high');
    await page.getByRole('button', { name: 'Start exploring' }).click();
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
    await page.getByRole('button', { name: 'Start exploring' }).click();
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
    await startPlanet(page);
    const lamps = () => page.evaluate(() => (window as any).__game.lamps() as number);
    await page.evaluate(() => (window as any).__game.setTime(11));
    await expect.poll(lamps).toBe(0);
    await page.evaluate(() => (window as any).__game.setTime(22));
    await expect.poll(lamps).toBeGreaterThanOrEqual(3);
    const plaza = await lamps();
    // walking up to the Workshop opens its door: its lamplight joins in
    await page.evaluate(() => (window as any).__game.travelTo('workshop'));
    await expect.poll(lamps, { timeout: 15_000 }).toBe(plaza + 1);
    // the Amphitheater's stage spot replaces it
    await page.evaluate(() => (window as any).__game.travelTo('amphitheater'));
    await expect.poll(lamps, { timeout: 15_000 }).toBe(plaza + 1);
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
    test.setTimeout(120_000);
    // saved "Always daytime": a hand-set time switches this visit to the cycle, without changing the saved choice
    await page.addInitScript(() => localStorage.setItem('site.timeMode', 'day'));
    await startPlanet(page);
    const badge = page.getByTestId('time-badge');
    await expect(badge).toHaveAttribute('role', 'slider');
    expect(await badge.evaluate((el) => getComputedStyle(el).cursor)).toBe('ew-resize');
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
    expect(await badge.evaluate((el) => getComputedStyle(el).cursor)).toBe('ew-resize');
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
  test('compass shows north; rotate buttons turn the view; the compass faces north again', async ({ page }) => {
    await startPlanet(page);
    expect((await state(page)).north).toBeCloseTo(0, 3);
    const compass = page.getByTestId('compass');
    await expect(compass).toHaveAttribute('aria-label', /facing north\./);
    await page.getByRole('button', { name: /Rotate view clockwise/ }).click();
    await expect.poll(async () => (await state(page)).north).toBeCloseTo(45, 0);
    await expect(compass).toHaveAttribute('aria-label', /facing north-west/);
    // a mouse click hands focus back to the planet, so WASD keeps working
    await expect(page.locator('.game-region')).toBeFocused();
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
    await page.getByRole('button', { name: /Rotate view counter-clockwise/ }).click();
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
    levels: { stream: number; wind: number; birds: boolean };
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
    await page.getByRole('button', { name: 'Start exploring' }).click();
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

test.describe('benches', () => {
  test('walking up to the plaza bench offers a seat; E sits, Escape stands up (not the menu), and a movement key stands up and walks off', async ({ page }) => {
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
    // Escape stands up in front of the bench, and doesn't open the menu
    await page.keyboard.press('Escape');
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

  test('Meet Chopper: E opens his card with his photo and a 3D Chopper; it passes axe; Esc closes it and hands back the planet', async ({ page }) => {
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
    // Escape closes it (not the menu), and the keys go back to the planet
    await page.keyboard.press('Escape');
    await expect(card).toBeHidden();
    const s = await state(page);
    expect(s.chopperOpen).toBe(false);
    expect(s.menuOpen).toBe(false);
    await expect(page.locator('.game-region')).toBeFocused();
    // its little canvas is gone with it (the WebGL context is released)
    await expect(page.getByTestId('chopper-3d')).toHaveCount(0);
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
});

test.describe('player character', () => {
  test('loads the rigged CC0 character model', async ({ page }) => {
    const glb: string[] = [];
    page.on('response', (r) => r.url().endsWith('/models/character.glb') && glb.push(String(r.status())));
    await startPlanet(page);
    await expect.poll(async () => (await state(page)).avatar, { timeout: 20_000 }).toBe('model');
    expect(glb).toEqual(['200']);
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
    expect(hidden).toBeGreaterThan(Math.max(400, open * 8));
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

  test('parallel landmark nav is keyboard reachable and travels', async ({ page }) => {
    await startPlanet(page);
    await page.locator('.game-region').focus();
    await page.keyboard.press('Tab');
    const nav = page.getByRole('navigation', { name: 'Planet landmarks' });
    await expect(nav.getByRole('button').first()).toBeFocused();
    await nav.getByRole('button', { name: /Town Hall/ }).click();
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
