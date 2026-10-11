/**
 * The article minimap's DOM wiring (tier 0; docs: documentation/site-ui/minimap.md): finding the landmarks,
 * drawing the strip, placing it, and its pointer, touch, focus and scroll input. ArticleMinimap.astro's
 * script runs it on each minimap through `each`; its rules are pure in `minimap.ts` (and `units.ts`), and
 * unit-tested.
 */
import { reveal } from './media';
import {
  accessibleName,
  boxPlacement,
  currentIndex,
  edgeSpeed,
  fitsBeside,
  groupLabel,
  headingLandmark,
  imageLandmark,
  jumpTarget,
  kindText,
  movedTooFar,
  readingLine,
  signature,
  tipY,
  TAP_CLICK_MS,
  waveAt,
  type Landmark,
} from './minimap';
import { cssNumber } from './units';

interface Entry extends Landmark {
  el: Element;
}

const GROUPS = '[data-gallery], [data-carousel]';

/** The landmarks in document order: headings, meaningful standalone pictures, galleries and carousels (as one each). */
function collect(source: Element): Entry[] {
  const groups = [...source.querySelectorAll(GROUPS)];
  const out: Entry[] = [];
  for (const el of source.querySelectorAll<HTMLElement>(`h1, h2, h3, h4, h5, h6, img, ${GROUPS}`)) {
    // hidden, a dialog (the lightbox) or a video's poster: not part of the reading
    if (el.closest('[hidden], [aria-hidden="true"], dialog, [data-video-embed]')) continue;
    if (groups.some((g) => g !== el && g.contains(el))) continue;
    let landmark: Landmark | null;
    if (el.matches(GROUPS)) {
      const count = el.matches('[data-carousel]') ? el.querySelectorAll('[data-carousel-slide]').length : el.querySelectorAll('img').length;
      landmark = { kind: 'gallery', label: groupLabel(el.getAttribute('aria-label'), el.querySelector('figcaption')?.textContent), count };
    } else if (/^H[1-6]$/.test(el.tagName)) {
      landmark = headingLandmark(Number(el.tagName[1]), el.textContent, document.title);
    } else {
      const img = el as HTMLImageElement;
      const r = img.getBoundingClientRect();
      landmark = imageLandmark({
        alt: img.getAttribute('alt'),
        caption: img.closest('figure')?.querySelector('figcaption')?.textContent ?? null,
        role: img.getAttribute('role'),
        width: r.width || img.width,
        height: r.height || img.height,
      });
    }
    if (landmark) out.push({ el, ...landmark });
  }
  return out;
}

/** The nearest ancestor that scrolls the source vertically, or null for the page itself. */
function scrollParent(el: Element): HTMLElement | null {
  for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if (oy === 'auto' || oy === 'scroll') return p;
  }
  return null;
}

/** A token's value as a number: px for a length, ms for a duration. */
const px = (name: string, from: Element = document.documentElement): number =>
  cssNumber(getComputedStyle(from).getPropertyValue(name), parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);

/** The names of the component's tokens the script reads (the component owns them, so it names them). */
export interface MinimapTokens {
  /** The strip's inset from the area's edge. */
  inset: string;
  /** The strip's width. */
  width: string;
  /** The strip's width on touch. */
  widthTouch: string;
  /** How long a tapped indicator stays selected. */
  pin: string;
  /** The edge zones where a held mouse scrolls the strip. */
  edgeZone: string;
  /** The fastest edge scroll, per frame. */
  edgeSpeed: string;
}

export function setupMinimap(nav: HTMLElement, signal: AbortSignal, tokens: MinimapTokens): void {
  const source = document.querySelector(nav.dataset.source || '[data-minimap-source]');
  const strip = nav.querySelector<HTMLOListElement>('[data-minimap-strip]');
  const tip = nav.querySelector<HTMLElement>('[data-minimap-tip]');
  const tipLabel = nav.querySelector<HTMLElement>('[data-tip-label]');
  const tipKind = nav.querySelector<HTMLElement>('[data-tip-kind]');
  const template = nav.querySelector<HTMLTemplateElement>('[data-minimap-row]');
  if (!source || !strip || !tip || !tipLabel || !tipKind || !template) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const container = scrollParent(source);
  if (container) {
    // inside the box that scrolls, not at the browser's edge: a side panel pushes it along with the content
    const host = container.parentElement!;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    container.after(nav);
    nav.dataset.mode = 'container';
  }

  let entries: Entry[] = [];
  let rows: HTMLButtonElement[] = [];
  let sig = '';
  let current = -1;
  let active: number | null = null;
  let pinned = 0;
  let pinTimer = 0;
  let ignoreClickUntil = 0;
  let frame = 0;
  let edgeLoop = 0;
  let speed = 0;
  let touch: { id: number; x: number; y: number; row: number } | null = null;

  // the scrolling area's box, in viewport coordinates
  const area = () => {
    if (container) return container.getBoundingClientRect();
    const w = document.documentElement.clientWidth;
    return { top: 0, left: 0, right: w, bottom: innerHeight, width: w, height: innerHeight } as DOMRect;
  };

  // in a box: along its right edge, inset top and bottom
  const place = () => {
    if (!container) return;
    const at = boxPlacement(container, px(tokens.inset), nav.getBoundingClientRect().width || px(tokens.width));
    nav.style.top = `${at.top}px`;
    nav.style.height = `${at.height}px`;
    nav.style.left = `${at.left}px`;
  };

  // never over the text: shown only where the column leaves it room
  const roomy = () => {
    const width = px(matchMedia('(pointer: coarse)').matches ? tokens.widthTouch : tokens.width);
    let textRight = -Infinity;
    for (const t of [...source.querySelectorAll('p, li, blockquote, h2, h3, h4')].slice(0, 40)) {
      const r = t.getBoundingClientRect();
      if (r.width > 0) textRight = Math.max(textRight, r.right);
    }
    return fitsBeside(area().right, px(tokens.inset), width, textRight, px('--space-2'));
  };

  const showTip = (i: number | null) => {
    if (i === null || !entries[i]) {
      tip.removeAttribute('data-show');
      return;
    }
    tipLabel.textContent = entries[i].label;
    tipKind.textContent = kindText(entries[i]);
    tip.setAttribute('data-show', '');
    placeTip();
  };

  const placeTip = () => {
    const row = active === null ? null : rows[active];
    if (!row) return;
    tip.style.setProperty('--tip-y', `${tipY(row.offsetTop, row.offsetHeight, strip.scrollTop)}px`);
  };

  const setActive = (i: number | null) => {
    active = i;
    rows.forEach((r, n) => {
      r.style.setProperty('--wave', String(waveAt(n, i)));
      r.toggleAttribute('data-active', n === i);
    });
    showTip(i);
  };

  const setCurrent = (i: number) => {
    if (i === current) return;
    current = i;
    rows.forEach((r, n) => (n === i ? r.setAttribute('aria-current', 'location') : r.removeAttribute('aria-current')));
    // keep it in view while the strip overflows, unless the reader is browsing the strip
    const row = rows[i];
    if (row && active === null && strip.scrollHeight > strip.clientHeight) {
      const by = reveal(row.offsetTop - strip.offsetTop, row.offsetTop - strip.offsetTop + row.offsetHeight, strip.scrollTop, strip.scrollTop + strip.clientHeight, row.offsetHeight);
      if (by) strip.scrollTop += by;
    }
  };

  const render = () => {
    strip.textContent = '';
    rows = entries.map((e, i) => {
      const li = (template.content.firstElementChild as HTMLElement).cloneNode(true) as HTMLElement;
      const row = li.querySelector('button')!;
      row.dataset.kind = e.kind;
      if (e.level) row.dataset.level = String(e.level);
      row.dataset.index = String(i);
      row.setAttribute('aria-label', accessibleName(e));
      strip.append(li);
      return row;
    });
    current = -1;
    if (active !== null && active >= rows.length) active = null;
    setActive(active);
  };

  // where the reader is: the last landmark past the reading line
  const update = () => {
    frame = 0;
    if (!entries.length) return;
    const a = area();
    const tops = entries.map((e) => e.el.getBoundingClientRect().top - a.top);
    setCurrent(currentIndex(tops, readingLine(a.height, sticky())));
    if (active !== null) placeTip();
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };

  // the list itself: drawn again only when it changes (count, kinds, levels, labels)
  const rebuild = () => {
    const next = collect(source);
    const s = signature(next);
    entries = next;
    if (s !== sig) {
      sig = s;
      render();
    }
    place();
    nav.hidden = entries.length === 0 || !roomy();
    update();
  };

  // a sticky header's height, as the page declares it for anchors (scroll-padding-top)
  const sticky = () => parseFloat(getComputedStyle(container ?? document.documentElement).scrollPaddingTop) || 0;

  const jump = (i: number) => {
    const e = entries[i];
    if (!e) return;
    const behavior = reduce.matches ? 'auto' : 'smooth';
    const minGap = px('--space-6');
    if (container) {
      const top = e.el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
      container.scrollTo({ top: jumpTarget(top, container.clientHeight, sticky(), minGap), behavior });
    } else {
      const top = e.el.getBoundingClientRect().top + scrollY;
      window.scrollTo({ top: jumpTarget(top, innerHeight, sticky(), minGap), behavior });
    }
  };

  const rowOf = (target: EventTarget | null) => {
    const row = target instanceof Element ? target.closest<HTMLButtonElement>('.row') : null;
    return row && strip.contains(row) ? Number(row.dataset.index) : null;
  };

  // a tap selects at once and stays a while (touch has no hover); a later tap isn't undone by this one's timer
  const pin = (i: number) => {
    window.clearTimeout(pinTimer);
    const mine = ++pinned;
    setActive(i);
    pinTimer = window.setTimeout(() => {
      if (pinned === mine) setActive(null);
    }, px(tokens.pin));
  };

  // edge auto-scroll for a mouse held near the strip's top or bottom: one loop at a time
  const stopEdge = () => {
    speed = 0;
    cancelAnimationFrame(edgeLoop);
    edgeLoop = 0;
  };
  const runEdge = () => {
    edgeLoop = 0;
    if (!speed) return;
    const before = strip.scrollTop;
    strip.scrollTop += speed;
    placeTip();
    if (strip.scrollTop === before) return stopEdge();
    edgeLoop = requestAnimationFrame(runEdge);
  };

  strip.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') {
        if (touch && e.pointerId === touch.id && movedTooFar(e.clientX - touch.x, e.clientY - touch.y)) touch = null;
        return;
      }
      const i = rowOf(e.target);
      if (i !== null && i !== active) setActive(i);
      if (strip.scrollHeight <= strip.clientHeight) return stopEdge();
      const r = strip.getBoundingClientRect();
      speed = edgeSpeed(e.clientY - r.top, r.height, px(tokens.edgeZone), px(tokens.edgeSpeed));
      if (!speed) stopEdge();
      else if (!edgeLoop) edgeLoop = requestAnimationFrame(runEdge);
    },
    { signal },
  );
  strip.addEventListener(
    'pointerleave',
    (e) => {
      stopEdge();
      if (e.pointerType === 'mouse' && !strip.contains(document.activeElement)) setActive(null);
    },
    { signal },
  );
  strip.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType === 'mouse') return;
      const i = rowOf(e.target);
      touch = i === null ? null : { id: e.pointerId, x: e.clientX, y: e.clientY, row: i };
    },
    { signal },
  );
  strip.addEventListener('pointercancel', () => (touch = null), { signal });
  strip.addEventListener(
    'pointerup',
    (e) => {
      if (e.pointerType === 'mouse' || !touch || e.pointerId !== touch.id) return;
      const i = touch.row;
      touch = null;
      // the click the browser sends after a tap is this same choice
      ignoreClickUntil = performance.now() + TAP_CLICK_MS;
      pin(i);
      jump(i);
    },
    { signal },
  );
  strip.addEventListener(
    'click',
    (e) => {
      const i = rowOf(e.target);
      if (i === null) return;
      if (performance.now() < ignoreClickUntil) return;
      setActive(i);
      jump(i);
    },
    { signal },
  );
  strip.addEventListener(
    'focusin',
    (e) => {
      const i = rowOf(e.target);
      if (i !== null) setActive(i);
    },
    { signal },
  );
  strip.addEventListener(
    'focusout',
    (e) => {
      if (!strip.contains(e.relatedTarget as Node | null) && !strip.matches(':hover')) setActive(null);
    },
    { signal },
  );
  strip.addEventListener('scroll', () => placeTip(), { passive: true, signal });

  (container ?? window).addEventListener('scroll', schedule, { passive: true, signal });
  window.addEventListener(
    'resize',
    () => {
      place();
      nav.hidden = entries.length === 0 || !roomy();
      schedule();
    },
    { signal },
  );

  // content and layout change after load (lazy pictures, embeds, galleries drawn in the browser)
  let rebuildFrame = 0;
  const later = () => {
    cancelAnimationFrame(rebuildFrame);
    rebuildFrame = requestAnimationFrame(rebuild);
  };
  const mo = new MutationObserver(later);
  mo.observe(source, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['alt', 'aria-label', 'hidden', 'aria-hidden'] });
  const ro = new ResizeObserver(later);
  ro.observe(source);
  if (container) ro.observe(container);
  source.addEventListener('load', later, { capture: true, signal });

  signal.addEventListener('abort', () => {
    mo.disconnect();
    ro.disconnect();
    stopEdge();
    cancelAnimationFrame(frame);
    cancelAnimationFrame(rebuildFrame);
    window.clearTimeout(pinTimer);
  });

  rebuild();
}
