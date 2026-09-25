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
  heading: number;
  pitch: number;
  north: number;
  lift: number;
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

  test('the Reset button returns to the plaza facing north', async ({ page }) => {
    await startPlanet(page);
    await page.evaluate(() => (window as any).__game.teleport('library'));
    await page.getByRole('button', { name: /Rotate view counter-clockwise/ }).click();
    await page.getByRole('button', { name: /Reset position and direction/ }).click();
    await expect.poll(async () => (await state(page)).atSpawn, { timeout: 15_000 }).toBe(true);
    await expect.poll(async () => (await state(page)).traveling).toBeNull();
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
    await startPlanet(page);
    const doors = () => page.evaluate(() => (window as any).__game.doors() as Record<string, number>);
    const light = () => page.evaluate(() => (window as any).__game.doorLight() as { id: string | null; intensity: number });
    await page.evaluate(() => (window as any).__game.setTime(11));
    await expect.poll(async () => Object.keys(await doors()).length).toBe(7);
    expect(Object.values(await doors()).every((o) => o === 0)).toBe(true);
    await page.evaluate(() => (window as any).__game.travelTo('workshop'));
    await expect.poll(async () => (await doors()).workshop, { timeout: 10_000 }).toBe(1);
    expect((await light()).id).toBeNull(); // daylight: no lamp needed
    await page.evaluate(() => (window as any).__game.setTime(22));
    await expect.poll(async () => (await light()).id).toBe('workshop');
    expect((await light()).intensity).toBeGreaterThan(2);
    // walk off to the amphitheater: the workshop shuts, the curtain goes up and the light follows
    await page.evaluate(() => (window as any).__game.travelTo('amphitheater'));
    await expect.poll(async () => (await doors()).amphitheater, { timeout: 10_000 }).toBe(1);
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
    await expect.poll(async () => (await sound(page)).loaded, { timeout: 20_000 }).toBe(5);
    expect((await sound(page)).state).toBe('running');
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
    await expect.poll(() => played(page, 'doorOpen'), { timeout: 10_000 }).toBe(1);
    expect(await played(page, 'chime')).toBe(1);
    await page.evaluate(() => (window as any).__game.travelTo('amphitheater'));
    await expect.poll(() => played(page, 'curtain'), { timeout: 10_000 }).toBe(1);
    expect(await played(page, 'doorClose')).toBe(1);
    await page.keyboard.press('e');
    await expect.poll(() => played(page, 'sparkle')).toBe(1);
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
