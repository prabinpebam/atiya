/**
 * The Gallery's lightbox and zoom in the browser (docs: documentation/gallery/spec.md §8; plan DoD rows 13
 * to 18 and 27), on the test build's fixture album (`tests/fixtures/gallery/`, public at
 * `/gallery/fixture-album/` in test builds only). The band and the album page themselves are
 * `gallery-pages.spec.ts`.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const ALBUM = '/gallery/fixture-album/';
const TITLE = 'A spring in the hills';
const VIEWER = `${TITLE}, album viewer`;
// The fixture album is in its default order, oldest taken first, the undated after in the file's order:
// p01 to p06, p12, p13, anim, plan (10th), p07, clip (12th), p08 to p11, p14 to p16, talk, short (21st).

const noSeriousViolations = async (page: Page) => {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => `${n.target.join(' ')} ${n.html.slice(0, 120)}`).join(', ')}`)).toEqual([]);
};

const viewer = (page: Page) => page.getByRole('dialog', { name: VIEWER });
const counter = (dialog: Locator) => dialog.locator('[data-lightbox-counter]');
const stage = (dialog: Locator) => dialog.locator('[data-lightbox-stage]');
const stageImage = (dialog: Locator) => dialog.locator('[data-lightbox-image]');
const thumbs = (dialog: Locator) => dialog.locator('[data-lightbox-thumb]');
const status = (dialog: Locator) => dialog.locator('[data-lightbox-status]');
const cellLink = (page: Page, id: string) => page.locator(`#item-${id} a[data-lightbox="album"]`);
const bandTile = (page: Page, id: string) => page.locator(`[data-album-band][data-album-id="fixture-album"] a[data-lightbox="band"][data-item-id="${id}"]`);
const srcOf = (img: Locator) => img.evaluate((i) => (i as HTMLImageElement).src);
const hrefOf = (a: Locator, data?: string) => a.evaluate((el, d) => new URL(d ? (el as HTMLElement).dataset[d]! : (el as HTMLAnchorElement).href, location.href).href, data);
const zoomX = (dialog: Locator) => stageImage(dialog).evaluate((i) => parseFloat((i as HTMLElement).style.getPropertyValue('--zoom-x') || '0'));

/** Opens the album page's lightbox at an item, by pressing its cell. */
async function openAt(page: Page, id: string): Promise<Locator> {
  const link = cellLink(page, id);
  await link.scrollIntoViewIfNeeded();
  await link.click();
  const dialog = viewer(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe('gallery: lightbox', () => {
  test('from a band: the whole album at once ("2 of 21" before the album page arrives), then its filmstrip in album order; Back closes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route(`**${ALBUM}`, async (route) => {
      if (route.request().resourceType() === 'document') return route.continue();
      await held;
      await route.continue();
    });
    await page.goto('/gallery/');
    const tile = bandTile(page, 'p02');
    await tile.scrollIntoViewIfNeeded();
    await tile.click();
    const dialog = viewer(page);
    await expect(dialog).toBeVisible();
    // the counter and the strip's places are the whole album's from the start
    await expect(counter(dialog)).toHaveText('2 of 21');
    await expect(dialog.locator('[data-lightbox-title]')).toHaveText(TITLE);
    await expect(thumbs(dialog)).toHaveCount(21);
    await expect(dialog.locator('[data-lightbox-caption]')).toHaveText('Oranges, just in.');
    // the address doesn't change on the section page
    expect(new URL(page.url()).pathname).toBe('/gallery/');
    await expect.poll(() => new URL(page.url()).hash).toBe('');
    release();
    await expect(thumbs(dialog).first()).toHaveAccessibleName(/^Show 1: A hill path at dawn\./);
    await expect(thumbs(dialog).nth(9)).toHaveAccessibleName(/^Show 10.*\(video\)$/);
    await expect(thumbs(dialog).nth(3)).toHaveAccessibleName(/^Show 4.*\(animated\)$/);
    await expect(counter(dialog)).toHaveText('2 of 21');
    await page.keyboard.press('ArrowRight');
    await expect(counter(dialog)).toHaveText('3 of 21');
    // Open the album, in the info panel, leads to the album page
    await page.keyboard.press('i');
    await expect(dialog.getByRole('link', { name: 'Open the album' })).toHaveAttribute('href', new RegExp(`${ALBUM}$`));
    await page.keyboard.press('i');
    await page.goBack();
    await expect(dialog).toBeHidden();
    expect(new URL(page.url()).pathname).toBe('/gallery/');
    await expect(tile).toBeFocused();
  });

  test('from a band, when the album page cannot be fetched: its own tiles in album order, and See all at the strip’s end', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.route(`**${ALBUM}`, (route) => (route.request().resourceType() === 'document' ? route.continue() : route.abort()));
    await page.goto('/gallery/');
    const tile = bandTile(page, 'plan');
    await tile.scrollIntoViewIfNeeded();
    await tile.click();
    const dialog = viewer(page);
    await expect(dialog).toBeVisible();
    await expect(thumbs(dialog)).toHaveCount(6);
    // p01, p02, anim, plan, clip, talk: the tiles in the album's order, the plan the fourth
    await expect(counter(dialog)).toHaveText('4 of 6');
    const seeAll = dialog.getByRole('link', { name: 'See all 21 in the album' });
    await expect(seeAll).toBeVisible();
    await expect(seeAll).toHaveAttribute('href', new RegExp(`${ALBUM}$`));
  });

  test('a picture: its stage size, caption and words; the info panel with I, kept as the reader moves', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(ALBUM);
    const dialog = await openAt(page, 'p02');
    await expect(page).toHaveURL(/#item-p02$/);
    await expect(stage(dialog)).toHaveAttribute('data-kind', 'picture');
    await expect.poll(() => srcOf(stageImage(dialog))).toBe(await hrefOf(cellLink(page, 'p02')));
    await expect(stageImage(dialog)).toHaveAttribute('alt', /.+/);
    await expect(dialog.locator('[data-lightbox-caption]')).toHaveText('Oranges, just in.');
    const info = dialog.getByRole('button', { name: 'Info' });
    await expect(info).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('i');
    await expect(info).toHaveAttribute('aria-pressed', 'true');
    const panel = dialog.getByRole('complementary', { name: 'About this item' });
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('Oranges, just in.');
    await expect(panel).toContainText('Imphal');
    await expect(panel).toContainText(`From the album: ${TITLE}`);
    // the caption moves into the panel rather than showing twice
    await expect(dialog.locator('[data-lightbox-caption-wrap]')).toBeHidden();
    await page.keyboard.press('ArrowRight');
    await expect(counter(dialog)).toHaveText('3 of 21');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('The cloud sat on the water all morning.');
    await expect(panel).toContainText('Loktak Lake');
    await noSeriousViolations(page);
    await page.keyboard.press('i');
    await expect(panel).toBeHidden();
  });

  test('a drawing: fitted to the stage and sharp, on its dark version in dark mode', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(ALBUM);
    const dialog = await openAt(page, 'plan');
    await expect(stage(dialog)).toHaveAttribute('data-kind', 'drawing');
    await expect.poll(() => srcOf(stageImage(dialog))).toBe(await hrefOf(cellLink(page, 'plan'), 'fullDark'));
    await expect(stage(dialog)).not.toHaveAttribute('data-paper', '');
    // as large as the stage allows: one side meets the stage's
    await expect
      .poll(async () => {
        const s = (await stage(dialog).boundingBox())!;
        const i = (await stageImage(dialog).boundingBox())!;
        return i.width <= s.width + 1 && i.height <= s.height + 1 && (Math.abs(i.width - s.width) < 2 || Math.abs(i.height - s.height) < 2);
      })
      .toBe(true);
    // a drawing can always be zoomed
    await expect(dialog.getByRole('button', { name: 'Zoom in' })).toBeVisible();
    await expect(dialog.locator('[data-lightbox-caption]')).toHaveText('The plan, drawn to scale.');
  });

  // plan DoD 2: a drawing stays an SVG, sharp at any size. The zoomed stage is measured against the same
  // drawing as a raster would show it (drawn at its fitted size, then enlarged 4 times): a vector's edges step
  // within a pixel or two, a raster's spread over about four
  test('a drawing zoomed to 400% stays sharp: its SVG redrawn, edges as crisp as at its own size', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(ALBUM);
    const dialog = await openAt(page, 'plan');
    await expect(stage(dialog)).toHaveAttribute('data-kind', 'drawing');
    const img = stageImage(dialog);
    await expect.poll(() => srcOf(img)).toMatch(/\.svg$/);
    await expect.poll(() => img.evaluate((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0)).toBe(true);
    const zoomIn = dialog.getByRole('button', { name: 'Zoom in' });
    while (await zoomIn.isEnabled()) await zoomIn.click();
    await expect(status(dialog)).toHaveText('Zoomed to 400%');
    // the transform has settled at 4 times, and the browser has had time to draw it again
    await expect
      .poll(() =>
        img.evaluate((i) => {
          const m = new DOMMatrix(getComputedStyle(i).transform);
          return Math.abs(m.a - 4) < 0.01 && i.getAnimations().length === 0;
        }),
      )
      .toBe(true);
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 500)))));

    const box = (await stage(dialog).boundingBox())!;
    const W = 640;
    const H = 200;
    const shot = await page.screenshot({ clip: { x: Math.round(box.x + box.width / 2 - W / 2), y: Math.round(box.y + box.height / 2 - H / 2), width: W, height: H } });
    const { zoomed, raster } = await img.evaluate(
      async (el, { b64, W, H }) => {
        const i = el as HTMLImageElement;
        // the sharpest step between neighbouring pixels in a row or column, against that line's contrast
        const crisp = (d: Uint8ClampedArray, w: number, h: number) => {
          const lum = (p: number) => 0.2126 * d[p] + 0.7152 * d[p + 1] + 0.0722 * d[p + 2];
          let best = 0;
          const line = (at: (k: number) => number, n: number) => {
            let lo = 255;
            let hi = 0;
            let step = 0;
            let prev = lum(at(0));
            for (let k = 0; k < n; k++) {
              const v = lum(at(k));
              lo = Math.min(lo, v);
              hi = Math.max(hi, v);
              if (k) step = Math.max(step, Math.abs(v - prev));
              prev = v;
            }
            if (hi - lo > 60) best = Math.max(best, step / (hi - lo));
          };
          for (let y = 0; y < h; y++) line((x) => (y * w + x) * 4, w);
          for (let x = 0; x < w; x++) line((y) => (y * w + x) * 4, h);
          return best;
        };
        const pixels = (src: CanvasImageSource, sx: number, sy: number) => {
          const c = new OffscreenCanvas(W, H);
          const g = c.getContext('2d')!;
          g.drawImage(src, sx, sy, W, H, 0, 0, W, H);
          return g.getImageData(0, 0, W, H).data;
        };
        const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
        const zoomed = crisp(pixels(await createImageBitmap(new Blob([bytes], { type: 'image/png' })), 0, 0), W, H);
        // the same drawing as a raster: drawn at its fitted size, enlarged 4 times, the same middle cut out
        const fw = i.offsetWidth;
        const fh = i.offsetHeight;
        const small = new OffscreenCanvas(fw, fh);
        const sg = small.getContext('2d')!;
        // on paper, as the light lightbox's scrim is
        sg.fillStyle = '#fbfaf7';
        sg.fillRect(0, 0, fw, fh);
        sg.drawImage(i, 0, 0, fw, fh);
        const big = new OffscreenCanvas(fw * 4, fh * 4);
        const bg = big.getContext('2d')!;
        bg.imageSmoothingQuality = 'high';
        bg.drawImage(small, 0, 0, fw * 4, fh * 4);
        const raster = crisp(pixels(big, fw * 2 - W / 2, fh * 2 - H / 2), W, H);
        return { zoomed, raster };
      },
      { b64: shot.toString('base64'), W, H },
    );
    expect(raster, 'the raster stand-in has edges to measure').toBeGreaterThan(0);
    expect(zoomed, `the zoomed drawing's sharpest edge (${zoomed.toFixed(2)}) against a 4× raster's (${raster.toFixed(2)})`).toBeGreaterThan(Math.max(0.45, raster * 1.3));
  });

  test('an animated picture plays with Pause over it, and starts paused on its still under reduced motion', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(ALBUM);
    let dialog = await openAt(page, 'anim');
    await expect(stage(dialog)).toHaveAttribute('data-kind', 'animated');
    const link = cellLink(page, 'anim');
    await expect.poll(() => srcOf(stageImage(dialog))).toBe(await hrefOf(link));
    await dialog.getByRole('button', { name: 'Pause' }).click();
    await expect.poll(() => srcOf(stageImage(dialog))).toBe(await hrefOf(link, 'still'));
    await expect(dialog.getByRole('button', { name: 'Play', exact: true })).toBeFocused();
    await expect(dialog.getByRole('button', { name: 'Zoom in' })).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(ALBUM);
    dialog = await openAt(page, 'anim');
    await expect.poll(() => srcOf(stageImage(dialog))).toBe(await hrefOf(cellLink(page, 'anim'), 'still'));
    await expect(dialog.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Pause' })).toBeHidden();
  });

  test('a video file: a player with controls, its captions as a track, and its length in the panel', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(ALBUM);
    const dialog = await openAt(page, 'clip');
    await expect(stage(dialog)).toHaveAttribute('data-kind', 'video');
    const video = dialog.locator('[data-lightbox-player] video');
    await expect(video).toHaveCount(1);
    await expect(video).toHaveJSProperty('controls', true);
    await expect(video).toHaveJSProperty('loop', true);
    await expect(video.locator('source')).toHaveAttribute('type', 'video/mp4');
    const track = video.locator('track');
    await expect(track).toHaveAttribute('kind', 'captions');
    await expect(track).toHaveAttribute('srclang', 'en');
    await expect(track).toHaveAttribute('label', 'English');
    await expect(track).toHaveJSProperty('default', true);
    await expect(dialog.getByRole('button', { name: 'Zoom in' })).toBeHidden();
    await page.keyboard.press('i');
    await expect(dialog.getByRole('complementary', { name: 'About this item' })).toContainText('Length 0:42');
    // moving on removes the player
    await page.keyboard.press('i');
    await page.keyboard.press('ArrowRight');
    await expect(counter(dialog)).toHaveText('13 of 21');
    await expect(video).toHaveCount(0);
  });

  test('an embed: its poster and Play, nothing loaded from the provider until Play; YouTube and Vimeo', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const asked: string[] = [];
    await page.route(/youtube-nocookie\.com|player\.vimeo\.com|youtube\.com|vimeo\.com/, (route) => {
      asked.push(route.request().url());
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>player</title>' });
    });
    await page.goto(ALBUM);
    const dialog = await openAt(page, 'talk');
    await expect(stage(dialog)).toHaveAttribute('data-kind', 'embed');
    const play = dialog.getByRole('button', { name: 'Play video' });
    await expect(play).toBeVisible();
    await expect(play).toBeFocused();
    await expect(dialog.locator('[data-lightbox-player] iframe')).toHaveCount(0);
    await expect(stageImage(dialog)).toBeVisible();
    expect(asked).toEqual([]);
    await page.keyboard.press('i');
    const panel = dialog.getByRole('complementary', { name: 'About this item' });
    await expect(panel.getByRole('link', { name: 'Watch on YouTube' })).toHaveAttribute('href', /youtube\.com\/watch\?v=aqz-KE-bpKQ/);
    await expect(panel).toContainText('Length 10:34');
    await expect(dialog.locator('[data-lightbox-download]')).toBeHidden();
    await play.click();
    const frame = dialog.locator('[data-lightbox-player] iframe');
    await expect(frame).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/aqz-KE-bpKQ.*autoplay=1/);
    await expect(frame).toHaveAttribute('title', /.+/);

    // the player has the focus: the keys are the dialog's again from its controls
    await dialog.getByRole('button', { name: 'Next image' }).focus();
    await page.keyboard.press('End');
    await expect(counter(dialog)).toHaveText('21 of 21');
    await expect(dialog.locator('[data-lightbox-player] iframe')).toHaveCount(0);
    await expect(panel.getByRole('link', { name: 'Watch on Vimeo' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Play video' }).click();
    await expect(dialog.locator('[data-lightbox-player] iframe')).toHaveAttribute('src', /player\.vimeo\.com\/video\/76979871/);
  });

  test('keyboard: arrows, Home and End, the filmstrip one Tab stop whose focus follows; Escape returns to the cell', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(ALBUM);
    const link = cellLink(page, 'p01');
    await link.focus();
    await page.keyboard.press('Enter');
    const dialog = viewer(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
    await expect(counter(dialog)).toHaveText('1 of 21');
    await page.keyboard.press('ArrowRight');
    await expect(counter(dialog)).toHaveText('2 of 21');
    await page.keyboard.press('End');
    await expect(counter(dialog)).toHaveText('21 of 21');
    await page.keyboard.press('ArrowRight');
    await expect(counter(dialog)).toHaveText('1 of 21');
    await page.keyboard.press('Home');
    await expect(counter(dialog)).toHaveText('1 of 21');
    // the strip: one Tab stop, the current thumbnail
    await expect(thumbs(dialog).and(dialog.locator('[tabindex="0"]'))).toHaveCount(1);
    await thumbs(dialog).first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(thumbs(dialog).nth(1)).toBeFocused();
    await expect(thumbs(dialog).nth(1)).toHaveAttribute('aria-current', 'true');
    await expect(counter(dialog)).toHaveText('2 of 21');
    await page.keyboard.press('Tab');
    await expect(dialog.locator('[data-lightbox-thumb]:focus')).toHaveCount(0);
    await noSeriousViolations(page);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(link).toBeFocused();
  });

  test('text cards stay on the page: the lightbox, its counter and filmstrip go through the items alone', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/gallery/fixture-story/');
    const link = cellLink(page, 'flags');
    await link.scrollIntoViewIfNeeded();
    await link.click();
    const dialog = page.getByRole('dialog', { name: 'A morning on the lake, album viewer' });
    await expect(dialog).toBeVisible();
    await expect(counter(dialog)).toHaveText('2 of 3');
    await expect(thumbs(dialog)).toHaveCount(3);
    // the next item is the map, past the text card
    await page.keyboard.press('ArrowRight');
    await expect(counter(dialog)).toHaveText('3 of 3');
    await expect(page).toHaveURL(/#item-map$/);
  });

  test('addresses: #item-<id> as it moves, Back closes, a loaded address opens there and closing leaves the cell; Copy link', async ({ page, context }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(ALBUM);
    const dialog = await openAt(page, 'p02');
    await expect(page).toHaveURL(/#item-p02$/);
    await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(/#item-p03$/);
    await page.goBack();
    await expect(dialog).toBeHidden();
    await expect.poll(() => new URL(page.url()).hash).toBe('');
    expect(new URL(page.url()).pathname).toBe(ALBUM);

    // a fresh load (not a change of fragment on the same page)
    await page.goto('/gallery/');
    await page.goto(`${ALBUM}#item-plan`);
    const opened = viewer(page);
    await expect(opened).toBeVisible();
    await expect(counter(opened)).toHaveText('10 of 21');
    await opened.getByRole('button', { name: 'Copy link' }).click();
    await expect(status(opened)).toHaveText('Link copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(new RegExp(`${ALBUM}#item-plan$`));
    await opened.getByRole('button', { name: 'Close' }).click();
    await expect(opened).toBeHidden();
    await expect.poll(() => new URL(page.url()).hash).toBe('');
    await expect(page.locator('#item-plan')).toBeInViewport();
  });

  test('downloads: named for the album and the item, only where allowed, never an embed', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(ALBUM);
    const dialog = await openAt(page, 'p01');
    await page.keyboard.press('i');
    const download = dialog.locator('[data-lightbox-download]');
    await expect(download).toBeVisible();
    await expect(download).toHaveAccessibleName(/^Download picture/);
    const [file] = await Promise.all([page.waitForEvent('download'), download.click()]);
    expect(file.suggestedFilename()).toBe('a-spring-in-the-hills-p01.webp');
    // p05 says no
    await thumbs(dialog).nth(4).click();
    await expect(counter(dialog)).toHaveText('5 of 21');
    await expect(download).toBeHidden();
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowLeft');
    await expect(counter(dialog)).toHaveText('20 of 21');
    await expect(download).toBeHidden();
  });

  test('the story: an album’s cells open the album viewer with its words', async ({ page }) => {
    await page.goto('/design/compounds/lightbox/');
    const link = page.locator('a[data-lightbox="album"][data-item-id="story-1"]');
    await link.scrollIntoViewIfNeeded();
    await link.click();
    const dialog = page.getByRole('dialog', { name: 'Sample album, album viewer' });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/#item-story-1$/);
    await page.keyboard.press('i');
    await expect(dialog.getByRole('complementary', { name: 'About this item' })).toContainText('Sample credit');
    await expect(dialog.locator('[data-lightbox-download]')).toBeVisible();
    await noSeriousViolations(page);
    await page.keyboard.press('i');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
});

test.describe('gallery: zoom', () => {
  test('the buttons and + − 0, the level announced, Escape fits then closes; the largest size fetched only when zooming starts', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const asked: string[] = [];
    page.on('request', (r) => asked.push(new URL(r.url()).pathname));
    await page.goto(ALBUM);
    const link = cellLink(page, 'p01');
    const largest = new URL(await hrefOf(link)).pathname;
    const dialog = await openAt(page, 'p01');
    await expect.poll(() => srcOf(stageImage(dialog))).toBe(await hrefOf(link, 'stage'));
    const zoomIn = dialog.getByRole('button', { name: 'Zoom in' });
    const zoomOut = dialog.getByRole('button', { name: 'Zoom out' });
    await expect(zoomIn).toBeVisible();
    await expect(zoomOut).toBeDisabled();
    await page.waitForTimeout(500);
    expect(asked, 'the kept-large size waits for zooming').not.toContain(largest);

    await zoomIn.click();
    await expect(stage(dialog)).toHaveAttribute('data-zoomed', '');
    await expect(status(dialog)).toHaveText('Zoomed to 150%');
    await expect(zoomOut).toBeEnabled();
    await expect.poll(() => asked.includes(largest)).toBe(true);
    await expect.poll(() => srcOf(stageImage(dialog))).toBe(await hrefOf(link));
    await page.keyboard.press('+');
    await expect(status(dialog)).toHaveText(/Zoomed to (2[0-9]{2}|3[0-9]{2})%/);
    await page.keyboard.press('-');
    await expect(status(dialog)).toHaveText('Zoomed to 150%');
    // arrows pan while zoomed, and never move
    const x0 = await zoomX(dialog);
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => zoomX(dialog)).not.toBe(x0);
    await expect(counter(dialog)).toHaveText('1 of 21');
    await page.keyboard.press('0');
    await expect(stage(dialog)).not.toHaveAttribute('data-zoomed', '');
    await expect(status(dialog)).toHaveText('Zoomed to 100%');
    await zoomIn.click();
    await expect(stage(dialog)).toHaveAttribute('data-zoomed', '');
    await page.keyboard.press('Escape');
    await expect(stage(dialog)).not.toHaveAttribute('data-zoomed', '');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('Ctrl and the wheel, a double-click, a drag to pan; the wheel alone never zooms, and moving on starts whole', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(ALBUM);
    const dialog = await openAt(page, 'p01');
    await expect(dialog.getByRole('button', { name: 'Zoom in' })).toBeVisible();
    const box = (await stage(dialog).boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.wheel(0, -400);
    await expect(stage(dialog)).not.toHaveAttribute('data-zoomed', '');
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -400);
    await page.keyboard.up('Control');
    await expect(stage(dialog)).toHaveAttribute('data-zoomed', '');
    await expect(status(dialog)).toHaveText(/Zoomed to \d+%/);
    await page.keyboard.press('0');
    await expect(stage(dialog)).not.toHaveAttribute('data-zoomed', '');

    await page.mouse.dblclick(cx, cy);
    await expect(stage(dialog)).toHaveAttribute('data-zoomed', '');
    const x0 = await zoomX(dialog);
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 120, cy, { steps: 6 });
    await page.mouse.up();
    await expect.poll(() => zoomX(dialog)).toBeGreaterThan(x0);
    await expect(counter(dialog)).toHaveText('1 of 21');

    await dialog.getByRole('button', { name: 'Next image' }).click();
    await expect(counter(dialog)).toHaveText('2 of 21');
    await expect(stage(dialog)).not.toHaveAttribute('data-zoomed', '');
    await expect(dialog.getByRole('button', { name: 'Zoom out' })).toBeDisabled();
  });

  test.describe('on a touch screen', () => {
    test.use({ hasTouch: true });

    test('a pinch zooms, a drag then pans without moving, and a swipe moves only at the whole item', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(ALBUM);
      const dialog = await openAt(page, 'p01');
      await expect(dialog.getByRole('button', { name: 'Zoom in' })).toBeVisible();
      const box = (await stage(dialog).boundingBox())!;
      const cx = Math.round(box.x + box.width / 2);
      const cy = Math.round(box.y + box.height / 2);
      const cdp = await page.context().newCDPSession(page);
      const touch = (type: string, pts: [number, number, number][]) =>
        cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) } as never);

      await touch('touchStart', [
        [cx - 40, cy, 0],
        [cx + 40, cy, 1],
      ]);
      for (let i = 1; i <= 8; i++)
        await touch('touchMove', [
          [cx - 40 - i * 15, cy, 0],
          [cx + 40 + i * 15, cy, 1],
        ]);
      await touch('touchEnd', []);
      await expect(stage(dialog)).toHaveAttribute('data-zoomed', '');
      await expect(status(dialog)).toHaveText(/Zoomed to \d+%/);

      // zoomed, a one-finger drag pans and never moves to the next item
      const x0 = await zoomX(dialog);
      await touch('touchStart', [[cx, cy, 2]]);
      for (let i = 1; i <= 6; i++) await touch('touchMove', [[cx - i * 30, cy, 2]]);
      await touch('touchEnd', []);
      await expect.poll(() => zoomX(dialog)).toBeLessThan(x0);
      await expect(counter(dialog)).toHaveText('1 of 21');

      await dialog.getByRole('button', { name: 'Zoom out' }).click();
      await page.keyboard.press('0');
      await expect(stage(dialog)).not.toHaveAttribute('data-zoomed', '');
      await touch('touchStart', [[cx + 100, cy, 3]]);
      for (let i = 1; i <= 6; i++) await touch('touchMove', [[cx + 100 - i * 40, cy, 3]]);
      await touch('touchEnd', []);
      await expect(counter(dialog)).toHaveText('2 of 21');
    });
  });
});
