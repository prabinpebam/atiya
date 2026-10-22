/**
 * The lightbox's zoom (tier 0; docs: documentation/gallery/spec.md §8.8, §8.5): Zoom in and Zoom out, the
 * keys, pinching, Ctrl and the wheel, a double-click or double-tap, dragging and the arrow keys to pan,
 * and swiping between items when not zoomed. The item is moved by a transform the stylesheet reads from
 * `--zoom-scale`, `--zoom-x` and `--zoom-y`; the larger size is fetched only when zooming starts. Every
 * rule (where it's offered, the steps, the limits of a pan) is pure in `zoomRules.ts`.
 */
import { swipe } from './media';
import { largestWidth, stageKind, type LightboxItem } from './lightboxRules';
import {
  FIT,
  canZoom,
  clampScale,
  dragPan,
  isFit,
  maxScale,
  panBy,
  pinchScale,
  stepIn,
  stepOut,
  swipeAllowed,
  toggleScale,
  touchAction,
  wheelFactor,
  zoomAbout,
  zoomAnnouncement,
  zoomOffered,
  type Point,
} from './zoomRules';

export interface ZoomParts {
  stage: HTMLElement;
  image: HTMLImageElement;
  /** Zoom out and Zoom in, in the top bar: shown only where zoom is offered. */
  group: HTMLElement;
  zoomIn: HTMLButtonElement;
  zoomOut: HTMLButtonElement;
  /** The polite live region the level is announced in. */
  status: HTMLElement;
}

export interface Zoom {
  /** A new item on the stage: back to its whole size, and offered once its picture is in. */
  prepare(item: LightboxItem | null, dark: boolean): void;
  zoomed(): boolean;
  offered(): boolean;
  /** A step in (1) or out (−1), round the centre. */
  step(by: -1 | 1): void;
  /** Back to the whole item. */
  fit(): void;
  /** An arrow key's pan. */
  pan(x: number, y: number): void;
}

const DOUBLE_TAP_MS = 300;

export function setupZoom(p: ZoomParts, onSwipe: (dir: -1 | 1) => void): Zoom {
  let item: LightboxItem | null = null;
  let dark = false;
  let offered = false;
  let max = FIT;
  let scale = FIT;
  let pan: Point = { x: 0, y: 0 };
  let shown = 0;
  let larger = false;
  let announceTimer = 0;
  let lastTap = { t: 0, x: 0, y: 0 };
  let tapToggledAt = 0;

  const room = () => {
    const r = p.stage.getBoundingClientRect();
    return { width: r.width, height: r.height };
  };
  const fitted = () => ({ width: p.image.offsetWidth, height: p.image.offsetHeight });
  // a point on the page as an offset from the stage's centre
  const at = (x: number, y: number): Point => {
    const r = p.stage.getBoundingClientRect();
    return { x: x - (r.left + r.width / 2), y: y - (r.top + r.height / 2) };
  };

  const announce = (now = false) => {
    window.clearTimeout(announceTimer);
    const say = () => (p.status.textContent = zoomAnnouncement(scale));
    if (now) say();
    else announceTimer = window.setTimeout(say, 400);
  };

  // the larger size, fetched once zooming starts, swapped in when it's there (the size on the stage enlarged until then)
  const sharpen = () => {
    if (larger || !item || item.kind !== 'picture' || !item.stage || (dark && item.hrefDark)) return;
    // zooming started: the largest size, whatever the stage shows now (spec §8.7)
    if (largestWidth(item) <= p.image.naturalWidth) return;
    larger = true;
    const want = item;
    const img = new Image();
    img.onload = () => {
      if (item === want) p.image.src = want.href;
    };
    img.src = want.href;
  };

  const apply = () => {
    p.image.style.setProperty('--zoom-scale', String(scale));
    p.image.style.setProperty('--zoom-x', `${pan.x}px`);
    p.image.style.setProperty('--zoom-y', `${pan.y}px`);
    p.stage.toggleAttribute('data-zoomed', !isFit(scale));
    const can = canZoom(scale, max);
    p.zoomIn.disabled = !offered || !can.in;
    p.zoomOut.disabled = !offered || !can.out;
    p.group.hidden = !offered;
    p.stage.style.touchAction = touchAction(offered);
    if (!isFit(scale)) sharpen();
  };

  const to = (next: number, point: Point = { x: 0, y: 0 }) => {
    if (!offered) return;
    const z = zoomAbout({ scale, pan }, clampScale(next, max), point, fitted(), room());
    scale = z.scale;
    pan = z.pan;
    apply();
  };

  const measure = () => {
    offered = false;
    max = FIT;
    if (item && p.image.complete && p.image.naturalWidth && !p.image.hidden) {
      const kind = stageKind(item);
      shown = p.image.offsetWidth;
      if (kind === 'picture' || kind === 'drawing') {
        const largest = largestWidth(item);
        offered = zoomOffered(kind, largest, shown);
        max = offered ? maxScale(kind, largest, shown) : FIT;
      }
    }
    scale = FIT;
    pan = { x: 0, y: 0 };
    apply();
  };

  p.image.addEventListener('load', () => {
    // the larger size swapped in: the zoom stays where it is
    if (larger && item && p.image.src === item.href) return;
    requestAnimationFrame(measure);
  });
  new ResizeObserver(() => item && requestAnimationFrame(measure)).observe(p.stage);

  p.zoomIn.addEventListener('click', () => {
    to(stepIn(scale, max));
    announce(true);
  });
  p.zoomOut.addEventListener('click', () => {
    to(stepOut(scale, max));
    announce(true);
  });

  p.stage.addEventListener(
    'wheel',
    (event) => {
      const f = wheelFactor(event.deltaY, event.ctrlKey);
      if (f === null || !offered) return;
      event.preventDefault();
      to(scale * f, at(event.clientX, event.clientY));
      announce();
    },
    { passive: false },
  );

  const toggleAt = (x: number, y: number) => {
    if (!offered) return;
    to(toggleScale(scale, max), at(x, y));
    announce(true);
  };
  p.stage.addEventListener('dblclick', (event) => {
    if (performance.now() - tapToggledAt < 500) return;
    event.preventDefault();
    toggleAt(event.clientX, event.clientY);
  });

  // pointers: one drags (a pan when zoomed, else a swipe on touch), two pinch
  const pointers = new Map<number, Point>();
  let gesture: { scale: number; pan: Point; points: Point[]; pinched: boolean } | null = null;
  const start = () => {
    gesture = { scale, pan: { ...pan }, points: [...pointers.values()].map((q) => ({ ...q })), pinched: gesture?.pinched || pointers.size > 1 };
  };
  const spread = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  p.stage.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && (event.button !== 0 || !offered || isFit(scale))) return;
    if ((event.target as Element).closest('button, video, iframe, a')) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    p.stage.setPointerCapture(event.pointerId);
    p.stage.setAttribute('data-gesture', '');
    start();
  });
  p.stage.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId) || !gesture) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const now = [...pointers.values()];
    if (now.length >= 2 && gesture.points.length >= 2 && offered) {
      const s = pinchScale(gesture.scale, spread(gesture.points[0], gesture.points[1]), spread(now[0], now[1]), max);
      const m0 = mid(gesture.points[0], gesture.points[1]);
      const m1 = mid(now[0], now[1]);
      const z = zoomAbout({ scale: gesture.scale, pan: gesture.pan }, s, at(m0.x, m0.y), fitted(), room());
      scale = z.scale;
      pan = isFit(scale) ? z.pan : dragPan(z.pan, m1.x - m0.x, m1.y - m0.y, scale, fitted(), room());
      apply();
    } else if (now.length === 1 && !isFit(scale) && gesture.points.length === 1) {
      pan = dragPan(gesture.pan, now[0].x - gesture.points[0].x, now[0].y - gesture.points[0].y, scale, fitted(), room());
      apply();
    }
  });
  const end = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId) || !gesture) return;
    const first = gesture.points[0];
    const single = !gesture.pinched && pointers.size === 1;
    pointers.delete(event.pointerId);
    if (pointers.size > 0) {
      start();
      return;
    }
    p.stage.removeAttribute('data-gesture');
    const pinched = gesture.pinched;
    gesture = null;
    if (pinched) return announce(true);
    if (!single || event.type === 'pointercancel' || event.pointerType === 'mouse') return;
    const dx = event.clientX - first.x;
    const dy = event.clientY - first.y;
    const dir = swipe(dx, dy);
    if (dir !== 0 && swipeAllowed(scale)) return onSwipe(dir);
    // a tap, then another close by: a double-tap
    if (Math.hypot(dx, dy) < 10) {
      const t = performance.now();
      if (t - lastTap.t < DOUBLE_TAP_MS && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 30) {
        tapToggledAt = t;
        lastTap = { t: 0, x: 0, y: 0 };
        toggleAt(event.clientX, event.clientY);
      } else lastTap = { t, x: event.clientX, y: event.clientY };
    }
  };
  p.stage.addEventListener('pointerup', end);
  p.stage.addEventListener('pointercancel', end);

  return {
    prepare(next, isDark) {
      item = next;
      dark = isDark;
      larger = false;
      offered = false;
      scale = FIT;
      pan = { x: 0, y: 0 };
      apply();
      if (next && p.image.complete && p.image.naturalWidth) requestAnimationFrame(measure);
    },
    zoomed: () => !isFit(scale),
    offered: () => offered,
    step(by) {
      to(by > 0 ? stepIn(scale, max) : stepOut(scale, max));
      announce(true);
    },
    fit() {
      to(FIT);
      announce(true);
    },
    pan(x, y) {
      pan = panBy(pan, { x, y }, scale, fitted(), room());
      apply();
    },
  };
}
