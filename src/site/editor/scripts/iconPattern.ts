/**
 * Draws the icon watermark (components/IconPattern.astro; the cells from model/iconPattern.ts): every icon edit
 * mode uses, both duotone layers (the second fainter), in the field's text colour, on a canvas the size of the
 * window, so a resize only crops it. Drawn once the screen has painted; drawn again only when the window grows past
 * it, the pixel ratio changes, or the theme changes the colour.
 */
import { ICON_DATA, type IconPaths } from '../../design/iconData';
import { cssNumber } from '../../scripts/units';
import { patternCells } from '../model/iconPattern';

/** How strong the secondary layer is beside the primary (the icons' two inks, in one colour). */
const SECONDARY = 0.45;

const icons = (Object.values(ICON_DATA) as IconPaths[]).map((i) => ({ width: i.width, primary: new Path2D(i.primary), secondary: i.secondary ? new Path2D(i.secondary) : null }));

export function initIconPattern(field: HTMLElement, signal: AbortSignal) {
  const canvas = field.querySelector('canvas');
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return;
  let drawn = { w: 0, h: 0, ratio: 0, colour: '' };

  const draw = () => {
    if (signal.aborted) return;
    const style = getComputedStyle(field);
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const cell = cssNumber(style.getPropertyValue('--c-editor-pattern-cell'), rem);
    const largest = cssNumber(style.getPropertyValue('--c-editor-pattern-icon'), rem);
    const colour = style.color;
    const ratio = window.devicePixelRatio || 1;
    // the whole window, so making it smaller never needs a new drawing
    const w = Math.max(window.innerWidth, drawn.w);
    const h = Math.max(window.innerHeight, drawn.h);
    if (w <= drawn.w && h <= drawn.h && ratio === drawn.ratio && colour === drawn.colour) return;
    if (!(cell > 0 && largest > 0)) return;
    const started = performance.now();
    canvas.width = Math.ceil(w * ratio);
    canvas.height = Math.ceil(h * ratio);
    canvas.style.setProperty('--pattern-w', `${w}px`);
    canvas.style.setProperty('--pattern-h', `${h}px`);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = colour;
    for (const c of patternCells({ width: w, height: h, cell, icons: icons.length })) {
      const icon = icons[c.icon];
      // the icon's box (its width × 512) fitted to its size and centred in its cell
      const s = (largest * c.scale) / Math.max(icon.width, 512);
      ctx.setTransform(s * ratio, 0, 0, s * ratio, (c.x - (icon.width * s) / 2) * ratio, (c.y - (512 * s) / 2) * ratio);
      if (icon.secondary) {
        ctx.globalAlpha = SECONDARY;
        ctx.fill(icon.secondary);
      }
      ctx.globalAlpha = 1;
      ctx.fill(icon.primary);
    }
    drawn = { w, h, ratio, colour };
    // on idle, never in anyone's way; timed, so its cost is seen (performance.md)
    performance.measure('editor:icon-pattern', { start: started, end: performance.now() });
  };

  const soon = () => ('requestIdleCallback' in window ? requestIdleCallback(draw, { timeout: 1500 }) : setTimeout(draw, 200));
  soon();
  let resize = 0;
  window.addEventListener(
    'resize',
    () => {
      clearTimeout(resize);
      resize = window.setTimeout(draw, 250);
    },
    { signal },
  );
  // the theme (the system's, or the one chosen) changes the colour it's drawn in
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => soon(), { signal });
  const theme = new MutationObserver(() => soon());
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style', 'class'] });
  signal.addEventListener('abort', () => theme.disconnect());
}
