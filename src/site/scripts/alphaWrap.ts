/**
 * Words round a picture's drawn shape: a float whose picture has transparent parts (an ink sketch, a cut-out)
 * gets a shape-outside traced from its own alpha, in the browser, so its words flow into the empty space beside
 * the ink, padded like a die-cut sticker (the rules: alphaWrapRules.ts). The browser still lays out every line.
 *
 * Mark the float `data-alpha-wrap` and give it, in its stylesheet: `shape-outside: var(--alpha-wrap-shape, none)`,
 * a `shape-margin` (the padding), `--alpha-wrap-measure` and `--alpha-wrap-band` (the least room words take), and
 * a float for each `data-wrap` side (start, end). The pixels are read once per picture file and kept; a resize
 * only maps the outline again. A picture from another origin, a photo with no empty space, or a browser without
 * shapes keeps its box, as before.
 */
import { silhouette, wrapShape, type Silhouette } from './alphaWrapRules';

const COLS = 192;
const THRESHOLD = 32;
const read = new Map<string, Promise<Silhouette | null>>();

/** The picture's silhouette, read once per file at a small size (its decoded pixels, already loaded: nothing is fetched). */
function silhouetteOf(img: HTMLImageElement): Promise<Silhouette | null> {
  const key = img.currentSrc || img.src;
  let hit = read.get(key);
  if (!hit) {
    hit = (async () => {
      const cols = Math.min(COLS, img.naturalWidth);
      const rows = Math.max(1, Math.round((img.naturalHeight * cols) / img.naturalWidth));
      const canvas = document.createElement('canvas');
      canvas.width = cols;
      canvas.height = rows;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;
      try {
        ctx.drawImage(img, 0, 0, cols, rows);
        return silhouette(ctx.getImageData(0, 0, cols, rows).data, cols, rows, THRESHOLD);
      } catch {
        // a picture from another origin without CORS can't be read: it keeps its box
        return null;
      }
    })();
    read.set(key, hit);
  }
  return hit;
}

/** A length a stylesheet gave (px, rem or em), in CSS pixels. */
function length(value: string, el: Element): number {
  const m = /^\s*(-?[\d.]+)(px|rem|em)?\s*$/.exec(value);
  if (!m) return 0;
  const n = Number(m[1]);
  if (m[2] === 'rem') return n * parseFloat(getComputedStyle(document.documentElement).fontSize);
  if (m[2] === 'em') return n * parseFloat(getComputedStyle(el).fontSize);
  return n;
}

/** Sets up one float (`[data-alpha-wrap]`); `signal` ends it. */
export function alphaWrap(el: HTMLElement, signal: AbortSignal): void {
  const img = el.querySelector('img');
  if (!img || !CSS.supports('shape-outside', 'inset(0)')) return;
  let shape: Silhouette | null = null;
  let src = '';

  const clear = () => {
    el.style.removeProperty('--alpha-wrap-shape');
    delete el.dataset.wrap;
  };

  const place = () => {
    const box = el.getBoundingClientRect();
    if (!shape || box.width === 0 || img.offsetWidth === 0) return;
    const drawn = img.getBoundingClientRect();
    const style = getComputedStyle(el);
    const rtl = style.direction === 'rtl';
    const wrap = wrapShape(
      shape,
      { width: box.width, height: box.height, image: { x: drawn.left - box.left, y: drawn.top - box.top, width: drawn.width, height: drawn.height } },
      { gap: parseFloat(style.shapeMargin) || 0, measure: length(style.getPropertyValue('--alpha-wrap-measure'), el), band: length(style.getPropertyValue('--alpha-wrap-band'), el) },
      'auto',
      rtl ? 'right' : 'left',
    );
    if (!wrap) return clear();
    el.style.setProperty('--alpha-wrap-shape', `polygon(${wrap.polygon})`);
    // words on the line's start side: the picture floats to its end
    el.dataset.wrap = (wrap.side === 'left') !== rtl ? 'end' : 'start';
  };

  const load = async () => {
    if (!img.complete || !img.naturalWidth) return;
    const now = img.currentSrc || img.src;
    if (now === src && shape) return place();
    src = now;
    const found = await silhouetteOf(img);
    if (signal.aborted || src !== now) return;
    shape = found;
    if (shape) place();
    else clear();
  };

  // a new file (a bigger one for a wider tile, the dark version) is read again; a resize only maps it again
  img.addEventListener('load', () => void load(), { signal });
  const sized = new ResizeObserver(() => (shape ? place() : void load()));
  sized.observe(el);
  signal.addEventListener('abort', () => sized.disconnect(), { once: true });
  void load();
}
