/**
 * Overlay scrollbars (tier 0; docs: documentation/site-ui/design-system.md §3). The native bar is
 * hidden (`scrollbar-width: none` in base.css), so a scroller takes no gutter and has no arrow buttons;
 * a frosted, indigo-tinted handle floats over its edge instead, where the scroll position is. It shows
 * while the scroller is hovered, scrolled, focused from the keyboard or its handle dragged, and fades
 * out at rest. Scrolling itself stays native (wheel, touch, keys); the handle can be dragged.
 *
 * A scroller opts in with `data-scrollbar`; PageShell sets up every one on each page (`overlay`) and
 * the page's own scroll (`overlayPage`). The handle is a sibling in the scroller's parent (never inside
 * it, where it would be laid out as a grid or flex item and lag behind the scrolled content).
 * `thumbGeometry` and `dragTo` are the pure rules, unit-tested.
 */

export interface Thumb {
  /** The handle's length along its edge (px). */
  size: number;
  /** How far along the edge it starts (px). */
  offset: number;
}

/** Where a handle sits on a track `track` px long: null when everything fits (no handle at all). */
export function thumbGeometry(view: number, content: number, scroll: number, track: number, min: number): Thumb | null {
  const range = content - view;
  if (range < 1 || track <= 0) return null;
  const size = Math.min(track, Math.max(min, (view / content) * track));
  const at = Math.min(Math.max(scroll, 0), range) / range;
  return { size, offset: at * (track - size) };
}

/** The scroll position a handle dragged `delta` px from where it was grabbed (at `start`) asks for. */
export function dragTo(start: number, delta: number, view: number, content: number, track: number, size: number): number {
  const range = content - view;
  const free = track - size;
  if (range <= 0 || free <= 0) return start;
  return Math.min(range, Math.max(0, start + (delta * range) / free));
}

type Axis = 'x' | 'y';

const css = (name: string): number => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(v);
  return v.endsWith('rem') ? n * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) : n;
};

const scrolls = (value: string) => value === 'auto' || value === 'scroll';

const attached = new WeakSet<HTMLElement>();

/** Set up the overlay handles for one scroller (the page's own, when it's document.documentElement). */
function attach(scroller: HTMLElement, signal: AbortSignal): void {
  // two components may point at the same scroller (Prose's code blocks also carry data-scrollbar)
  if (attached.has(scroller)) return;
  attached.add(scroller);
  signal.addEventListener('abort', () => attached.delete(scroller));
  const page = scroller === document.documentElement;
  // a list in the top layer (a select's, opened over a dialog) keeps its handles inside it, on its own layer
  const inside = !page && scroller.hasAttribute('popover');
  const host = (): HTMLElement => (page ? document.body : inside ? scroller : scroller.parentElement!);
  if (!page && !inside) {
    scroller.toggleAttribute('data-scrollbar', true);
    if (getComputedStyle(host()).position === 'static') host().style.position = 'relative';
  }

  const make = (axis: Axis) => {
    const t = document.createElement('div');
    t.className = 'sb-thumb';
    t.hidden = true;
    t.dataset.axis = axis;
    t.setAttribute('aria-hidden', 'true');
    if (page) t.dataset.page = '';
    return t;
  };
  const thumbs: Record<Axis, HTMLElement> = { y: make('y'), x: make('x') };
  const mount = () => {
    if (page) document.body.append(thumbs.y, thumbs.x);
    else if (inside) scroller.append(thumbs.y, thumbs.x);
    else scroller.after(thumbs.y, thumbs.x);
  };
  mount();
  signal.addEventListener('abort', () => {
    thumbs.y.remove();
    thumbs.x.remove();
  });

  const state = { hover: false, over: false, scrolling: false, drag: false, focus: false, near: false };
  const geo: Partial<Record<Axis, (Thumb & { track: number }) | null>> = {};
  let box = { top: 0, left: 0, width: 0, height: 0 };
  let k = { inset: 0, min: 0, room: 0, reach: 0 };
  let axes: Record<Axis, boolean> = { x: false, y: false };
  let frame = 0;
  let idle = 0;

  const show = () => {
    const on = state.hover || state.over || state.scrolling || state.drag || state.focus || state.near;
    for (const axis of ['x', 'y'] as Axis[]) thumbs[axis].toggleAttribute('data-show', on && !!geo[axis]);
  };

  const measure = () => {
    // a closed list may keep its box but be invisible (visibility, opacity): no handle then
    const shown =
      page ||
      (typeof scroller.checkVisibility === 'function'
        ? scroller.checkVisibility({ visibilityProperty: true, opacityProperty: true })
        : scroller.getClientRects().length > 0);
    const cs = getComputedStyle(scroller);
    axes = { x: shown && (page || scrolls(cs.overflowX)), y: shown && (page || scrolls(cs.overflowY)) };
    // a scroller on its own layer (a popup list) takes its handles with it: same layer, later in the DOM
    if (!page) for (const t of Object.values(thumbs)) t.style.zIndex = cs.zIndex === 'auto' ? '' : cs.zIndex;
    if (page || inside) box = { top: 0, left: 0, width: scroller.clientWidth, height: scroller.clientHeight };
    else if (shown) {
      // offsets ignore transforms (a list scaling open); rects are the fallback
      const h = host();
      const own = scroller.offsetParent === h;
      const r = scroller.getBoundingClientRect();
      const hr = h.getBoundingClientRect();
      box = {
        top: (own ? scroller.offsetTop : r.top - hr.top - h.clientTop) + scroller.clientTop,
        left: (own ? scroller.offsetLeft : r.left - hr.left - h.clientLeft) + scroller.clientLeft,
        width: scroller.clientWidth,
        height: scroller.clientHeight,
      };
    }
    const hover = css('--c-scrollbar-size-hover');
    const inset = css('--c-scrollbar-inset');
    k = { inset, min: css('--c-scrollbar-min'), room: hover + inset, reach: hover * 4 };
    place();
  };

  // the handle follows the scroll position; the box is measured when sizes change, not every frame
  const place = () => {
    frame = 0;
    const { inset, min, room } = k;
    const top = page ? scrollY : scroller.scrollTop;
    const left = page ? scrollX : Math.abs(scroller.scrollLeft);
    // handles inside their scroller move with its content: they're shifted back by the scroll
    const shiftY = inside ? scroller.scrollTop : 0;
    const shiftX = inside ? scroller.scrollLeft : 0;
    const bothY = axes.x && scroller.scrollWidth - scroller.clientWidth >= 1;
    const bothX = axes.y && scroller.scrollHeight - scroller.clientHeight >= 1;
    const trackY = box.height - 2 * inset - (bothY ? room : 0);
    const trackX = box.width - 2 * inset - (bothX ? room : 0);
    const gy = axes.y ? thumbGeometry(scroller.clientHeight, scroller.scrollHeight, top, trackY, min) : null;
    const gx = axes.x ? thumbGeometry(scroller.clientWidth, scroller.scrollWidth, left, trackX, min) : null;
    geo.y = gy && { ...gy, track: trackY };
    geo.x = gx && { ...gx, track: trackX };
    // nothing to scroll that way (or the scroller isn't shown): no handle at all
    thumbs.y.hidden = !gy;
    thumbs.x.hidden = !gx;
    if (gy) {
      const s = thumbs.y.style;
      s.top = `${box.top + shiftY + inset + gy.offset}px`;
      s.height = `${gy.size}px`;
      s.setProperty('--sb-edge', `${box.left + box.width}px`);
    }
    if (gx) {
      const s = thumbs.x.style;
      s.left = `${box.left + shiftX + inset + gx.offset}px`;
      s.width = `${gx.size}px`;
      s.setProperty('--sb-edge', `${box.top + box.height}px`);
    }
    show();
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(place);
  };

  const onScroll = () => {
    state.scrolling = true;
    window.clearTimeout(idle);
    idle = window.setTimeout(() => {
      state.scrolling = false;
      show();
    }, 900);
    schedule();
  };
  (page ? window : scroller).addEventListener('scroll', onScroll, { passive: true, signal });

  const ro = new ResizeObserver(() => measure());
  const watch = () => {
    ro.disconnect();
    ro.observe(page ? document.body : scroller);
    if (!page) {
      ro.observe(host());
      for (const child of scroller.children) if (!child.classList.contains('sb-thumb')) ro.observe(child);
    }
  };
  watch();
  signal.addEventListener('abort', () => ro.disconnect());
  if (!page) {
    // opening or closing (a popup list) changes attributes, not sizes; a fade ends with a transition
    const mo = new MutationObserver(() => measure());
    mo.observe(scroller, { attributes: true, attributeFilter: ['class', 'style', 'hidden', 'open', 'data-open'] });
    // the component that opens it may mark an ancestor (a select's root, a details)
    for (let el = scroller.parentElement, n = 0; el && n < 3; el = el.parentElement, n++) {
      mo.observe(el, { attributes: true, attributeFilter: ['class', 'hidden', 'open', 'data-open'] });
    }
    scroller.addEventListener('transitionend', measure, { signal });
    signal.addEventListener('abort', () => mo.disconnect());
  }
  window.addEventListener('resize', measure, { signal });

  if (page) {
    // the page's handles wake when the pointer nears their edge; a swapped-in page gets them back
    document.addEventListener(
      'pointermove',
      (e) => {
        const near = innerWidth - e.clientX < k.reach || innerHeight - e.clientY < k.reach;
        if (near !== state.near) {
          state.near = near;
          show();
        }
      },
      { passive: true, signal },
    );
    document.documentElement.addEventListener('pointerleave', () => ((state.near = false), show()), { signal });
    document.addEventListener(
      'astro:after-swap',
      () => {
        mount();
        watch();
        measure();
      },
      { signal },
    );
  } else {
    scroller.addEventListener('pointerenter', () => ((state.hover = true), measure()), { signal });
    scroller.addEventListener('pointerleave', () => ((state.hover = false), show()), { signal });
    scroller.addEventListener('focusin', () => ((state.focus = scroller.matches(':focus-visible') || !!scroller.querySelector(':focus-visible')), show()), { signal });
    scroller.addEventListener('focusout', () => ((state.focus = false), show()), { signal });
  }

  for (const axis of ['x', 'y'] as Axis[]) {
    const t = thumbs[axis];
    t.addEventListener('pointerenter', () => ((state.over = true), show()), { signal });
    t.addEventListener('pointerleave', () => ((state.over = false), show()), { signal });
    t.addEventListener(
      'pointerdown',
      (e) => {
        const g = geo[axis];
        if (e.button !== 0 || !g) return;
        e.preventDefault();
        e.stopPropagation();
        t.setPointerCapture(e.pointerId);
        state.drag = true;
        t.dataset.drag = '';
        const vert = axis === 'y';
        const origin = vert ? e.clientY : e.clientX;
        const start = vert ? (page ? scrollY : scroller.scrollTop) : page ? scrollX : Math.abs(scroller.scrollLeft);
        const view = vert ? scroller.clientHeight : scroller.clientWidth;
        const content = vert ? scroller.scrollHeight : scroller.scrollWidth;
        const move = (ev: PointerEvent) => {
          const to = dragTo(start, (vert ? ev.clientY : ev.clientX) - origin, view, content, g.track, g.size);
          scroller.scrollTo({ [vert ? 'top' : 'left']: to, behavior: 'instant' });
        };
        const end = () => {
          state.drag = false;
          delete t.dataset.drag;
          t.removeEventListener('pointermove', move);
          show();
        };
        t.addEventListener('pointermove', move);
        t.addEventListener('lostpointercapture', end, { once: true });
      },
      { signal },
    );
  }

  measure();
}

/** Overlay handles on a scroller that carries data-scrollbar (or any scroller a component points at). */
export const overlay = (scroller: HTMLElement, signal: AbortSignal): void => attach(scroller, signal);

let pageDone = false;
/** Overlay handles on the page's own scroll (once; they're carried over page swaps). */
export function overlayPage(): void {
  if (pageDone) return;
  pageDone = true;
  attach(document.documentElement, new AbortController().signal);
}
