/**
 * The game's cursors (design system §4, "Cursors"): Font Awesome Free solid shapes (CC BY 4.0, see
 * assets-src/CREDITS.md) outlined in the game's wood and cream, with a soft shadow so they read on
 * the sky, the grass and the wood panels alike, and small badges for the states that need them
 * (walk here: the gold ground ring the click leaves; not allowed: a red ban sign).
 *
 * Renders each one at 32 px and 64 px (1x / 2x) in Playwright's Chromium, finds its hotspot from the
 * pixels (the arrow's tip, the pointing finger's tip, or the centre), and writes:
 *   src/assets/cursors/<name>.png and <name>@2x.png
 *   src/styles/cursors.css (the states' selectors with their hotspots; never edit it by hand)
 *
 *   node scripts/build-cursors.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { faArrowPointer, faArrowsLeftRight, faBan, faHand, faHandBackFist, faHandPointer } from '@fortawesome/free-solid-svg-icons';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src/assets/cursors');
const CSS = join(ROOT, 'src/styles/cursors.css');
const SIZE = 32;

// the game's wood ink, the cream of its paper, the gold of its cues and a warm red (tokens.json's primitives)
const INK = '#3a2414';
const CREAM = '#fff4dc';
const GOLD = '#ffb02e';
const RED = '#d9412b';

/** A Font Awesome icon `h` px tall with its top-left at (x, y), cream with a 1.5 px ink outline. */
function shape(def, x, y, h, { fill = CREAM, ink = INK, outline = 1.5 } = {}) {
  const [w0, h0, , , d] = def.icon;
  const k = h / h0;
  const path = Array.isArray(d) ? d.join(' ') : d;
  return {
    w: w0 * k,
    svg: `<g transform="translate(${x} ${y}) scale(${k})"><path d="${path}" fill="${fill}" stroke="${ink}" stroke-width="${(outline * 2) / k}" stroke-linejoin="round" paint-order="stroke"/></g>`,
  };
}

const arrow = (h = 24) => shape(faArrowPointer, 2, 1.5, h).svg;

// where the ground ring the click leaves is drawn: a gold ellipse, outlined in ink (a dot in it read as an eye)
const ring = (cx, cy) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="6.4" ry="3.1" fill="none" stroke="${INK}" stroke-width="4.4"/>` +
  `<ellipse cx="${cx}" cy="${cy}" rx="6.4" ry="3.1" fill="none" stroke="${GOLD}" stroke-width="2.2"/>`;

const CURSORS = [
  // the game's arrow, and what shows it (the defaults the stylesheets set on non-interactive slots)
  { name: 'arrow', hot: 'tip', svg: () => arrow(), selectors: ['body.play', '.play .site-card .slot', '.play .slot.craft-cell.empty', '.play .slot.craft-big', '.play .slot.craft-icon'], fallback: 'default' },
  // anything you can click or tap: buttons, links, slots, recipes, the portraits, a landmark to travel to
  {
    name: 'pointer',
    hot: 'finger',
    svg: () => shape(faHandPointer, 5, 1.5, 26).svg,
    selectors: ['.play button', '.play .btn', '.play a', '.play label.check', '.play .slot', '.play [role="option"]', '.play .compass', '.play .avatar-btn', '.play .chopper-thumb', '.play .paint-swatch', '.play .game-region[data-cursor="walk"][data-hover="landmark"]', '.play .game-region[data-hover="landmark"]'],
    fallback: 'pointer',
  },
  // over the planet's ground: a click walks there (the ring is the marker it leaves)
  { name: 'walk', hot: 'tip', svg: () => arrow(21) + ring(23.5, 26.4), selectors: ['.play .game-region[data-cursor="walk"]'], fallback: 'pointer' },
  // a disabled control
  { name: 'not-allowed', hot: 'tip', svg: () => arrow(21) + shape(faBan, 18, 17.5, 12.5, { fill: RED, ink: CREAM, outline: 1.1 }).svg, selectors: ['.play :disabled', '.play [aria-disabled="true"]'], fallback: 'not-allowed' },
  // something you can turn by dragging (Chopper on his card), and while you drag (the planet, Chopper)
  { name: 'grab', hot: 'centre', svg: () => shape(faHand, 4, 4, 24).svg, selectors: ['.play .chopper-stage'], fallback: 'grab' },
  { name: 'grabbing', hot: 'centre', svg: () => shape(faHandBackFist, 8, 5.5, 21).svg, selectors: ['.play .game-region.dragging', '.play .game-region.dragging[data-hover]', '.play .chopper-stage:active'], fallback: 'grabbing' },
  // the clock: drag it sideways to set the time
  { name: 'ew-resize', hot: 'centre', svg: () => shape(faArrowsLeftRight, 2.5, 5, 22).svg, selectors: ['.play .time-badge'], fallback: 'ew-resize' },
];

const svgDoc = (inner, px) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${SIZE} ${SIZE}"><defs><filter id="s" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="0.5" dy="0.9" stdDeviation="0.55" flood-color="#000" flood-opacity="0.5"/></filter></defs><g filter="url(#s)">${inner}</g></svg>`;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
const rules = [];
for (const c of CURSORS) {
  const inner = c.svg();
  const shots = {};
  for (const scale of [1, 2]) {
    const px = SIZE * scale;
    // draw it into a canvas: the PNG, and (at 1x) the alpha to find the hotspot
    const res = await page.evaluate(
      async ({ svg, px, hot }) => {
        const img = new Image();
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        await img.decode();
        const cv = document.createElement('canvas');
        cv.width = cv.height = px;
        const g = cv.getContext('2d');
        g.drawImage(img, 0, 0, px, px);
        const a = g.getImageData(0, 0, px, px).data;
        let hx = px / 2;
        let hy = px / 2;
        if (hot !== 'centre') {
          // the first row with an opaque pixel (the shadow falls right and down, so this is the outline's tip)
          outer: for (let y = 0; y < px; y++) {
            const xs = [];
            for (let x = 0; x < px; x++) if (a[(y * px + x) * 4 + 3] > 160) xs.push(x);
            if (xs.length) {
              hy = y;
              hx = hot === 'tip' ? xs[0] : (xs[0] + xs[xs.length - 1]) / 2;
              break outer;
            }
          }
        }
        return { url: cv.toDataURL('image/png'), hx, hy };
      },
      { svg: svgDoc(inner, px), px, hot: c.hot },
    );
    const file = `${c.name}${scale === 2 ? '@2x' : ''}.png`;
    writeFileSync(join(OUT, file), Buffer.from(res.url.split(',')[1], 'base64'));
    shots[scale] = res;
  }
  const hx = Math.round(shots[1].hx);
  const hy = Math.round(shots[1].hy);
  const u = (f) => `url('../assets/cursors/${f}')`;
  rules.push(
    `/* ${c.name}: hotspot ${hx} ${hy} */\n${c.selectors.join(',\n')} {\n  cursor: ${u(`${c.name}.png`)} ${hx} ${hy}, ${c.fallback};\n  cursor: image-set(${u(`${c.name}.png`)} 1x, ${u(`${c.name}@2x.png`)} 2x) ${hx} ${hy}, ${c.fallback};\n}`,
  );
  console.log(`${c.name.padEnd(12)} hotspot ${hx},${hy}`);
}
await browser.close();

writeFileSync(
  CSS,
  `/*\n * The game's cursors (design system §4). Generated by scripts/build-cursors.mjs from Font Awesome\n * Free shapes: never edit by hand. Only the game (body.play) uses them; the website keeps the system's.\n * Each rule gives a plain url() first, for browsers without image-set() cursors.\n */\n\n${rules.join('\n\n')}\n`,
);
console.log(`wrote ${CURSORS.length * 2} PNGs and ${CSS.replace(ROOT, '.')}`);
