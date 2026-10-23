/**
 * Edit cover's Background (documentation/gallery/spec.md §9.6): the colour behind the chosen tile's picture. Auto
 * (the picture's own edge colour), a few colours taken from the picture itself, any colour from the system's
 * picker, or one picked from anywhere on the screen with the eyedropper where the browser has one (Chromium and
 * Atiya Studio). Edit cover keeps each choice through the album's own queue (setBackground in model/cover.ts).
 */
import { extractColors } from '../../theme/extract';

/** What Edit cover lends its Background row. */
export interface BackgroundHost {
  /** The chosen tile's item ('' for none). */
  chosen(): string;
  /** An item's thumbnail, to take colours from. */
  thumb(id: string): string | undefined;
  /** An item's own edge colour (what Auto shows). */
  auto(id: string): string | undefined;
  /** The tile's own colour, if it has one. */
  colour(id: string): string | undefined;
  /** Keeps a colour for the tile, or Auto (null). */
  set(id: string, hex: string | null): void;
}

interface EyeDropperLike {
  open(options?: { signal?: AbortSignal }): Promise<{ sRGBHex: string }>;
}
type WithDropper = typeof window & { EyeDropper?: new () => EyeDropperLike };

const SWATCHES = 5;
const SAMPLE = 64;
const found = new Map<string, Promise<string[]>>();

/** A colour as `#rrggbb`, lowercase; from `#rgb`, `#rrggbb` or `rgb(r, g, b)`; null when it's none of them. */
export function hexOf(colour: string | undefined): string | null {
  const c = colour?.trim().toLowerCase() ?? '';
  if (/^#[0-9a-f]{6}$/.test(c)) return c;
  if (/^#[0-9a-f]{3}$/.test(c)) return `#${[...c.slice(1)].map((d) => d + d).join('')}`;
  const m = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/.exec(c);
  return m ? `#${m.slice(1, 4).map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0')).join('')}` : null;
}

/** The picture's own colours, most telling first, taken once per thumbnail. */
const coloursOf = (src: string): Promise<string[]> => {
  let p = found.get(src);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        try {
          const scale = Math.min(1, SAMPLE / Math.max(img.naturalWidth, img.naturalHeight, 1));
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.naturalWidth * scale));
          c.height = Math.max(1, Math.round(img.naturalHeight * scale));
          const ctx = c.getContext('2d', { willReadFrequently: true })!;
          ctx.drawImage(img, 0, 0, c.width, c.height);
          const hexes = extractColors(ctx.getImageData(0, 0, c.width, c.height).data, SWATCHES).map((s) => hexOf(s.hex));
          resolve([...new Set(hexes.filter((h): h is string => !!h))]);
        } catch {
          resolve([]);
        }
      };
      img.onerror = () => resolve([]);
      img.src = src;
    });
    found.set(src, p);
  }
  return p;
};

/** Sets up the Background row inside Edit cover; returns the function that paints it for the chosen tile. */
export function initCoverBackground(root: HTMLElement, panel: () => HTMLElement | null, signal: AbortSignal, host: BackgroundHost): () => void {
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => panel()?.querySelector<T>(sel) ?? null;
  const Dropper = (window as WithDropper).EyeDropper;

  const pressSwatches = (own: string | undefined) =>
    panel()
      ?.querySelectorAll<HTMLElement>('[data-cover-bg-swatch]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.coverBgSwatch === own)));

  const drawSwatches = (id: string, hexes: string[]) => {
    const box = $('[data-cover-bg-swatches]');
    const t = $<HTMLTemplateElement>('[data-cover-swatch-template]');
    if (!box || !t || host.chosen() !== id || box.dataset.for !== id) return;
    box.replaceChildren(
      ...hexes.map((hex) => {
        const b = (t.content.firstElementChild as HTMLElement).cloneNode(true) as HTMLElement;
        b.dataset.coverBgSwatch = hex;
        b.setAttribute('aria-label', `Use ${hex} from the picture`);
        b.querySelector<HTMLElement>('.ce-swatch')?.style.setProperty('--swatch', hex);
        return b;
      }),
    );
    pressSwatches(host.colour(id));
  };

  const paint = () => {
    const id = host.chosen();
    if (!id || !panel()) return;
    const own = host.colour(id);
    $('[data-cover-bg-auto]')?.setAttribute('aria-pressed', String(!own));
    const pick = $<HTMLInputElement>('[data-cover-bg-pick]');
    if (pick) pick.value = own ?? hexOf(host.auto(id)) ?? '#ffffff';
    const slot = $('[data-cover-bg-dropper-slot]');
    if (slot) slot.hidden = !Dropper;
    const box = $('[data-cover-bg-swatches]');
    if (box && box.dataset.for !== id) {
      box.dataset.for = id;
      box.replaceChildren();
      const thumb = host.thumb(id);
      if (thumb) void coloursOf(thumb).then((hexes) => drawSwatches(id, hexes));
    } else pressSwatches(own);
  };

  root.addEventListener(
    'click',
    (e) => {
      const el = (e.target as Element).closest<HTMLElement>('[data-cover-bg-auto], [data-cover-bg-swatch], [data-cover-bg-dropper]');
      const id = host.chosen();
      if (!el || !id || !panel()?.contains(el)) return;
      if (el.dataset.coverBgAuto !== undefined) return host.set(id, null);
      if (el.dataset.coverBgSwatch) return host.set(id, el.dataset.coverBgSwatch);
      if (Dropper)
        new Dropper()
          .open({ signal })
          .then((r) => {
            const hex = hexOf(r.sRGBHex);
            if (hex && host.chosen() === id) host.set(id, hex);
          })
          .catch(() => {});
    },
    { signal },
  );
  root.addEventListener(
    'change',
    (e) => {
      const t = e.target as HTMLInputElement;
      const id = host.chosen();
      if (!id || !t.matches('[data-cover-bg-pick]')) return;
      const hex = hexOf(t.value);
      if (hex) host.set(id, hex);
    },
    { signal },
  );
  return paint;
}
