/**
 * The carousel's DOM wiring (tier 0; docs: documentation/site-ui/design-system.md §2): its buttons, dots
 * or filmstrip, keys and counter, and a peek's room and shading. Carousel.astro's script runs it on each
 * carousel through `each`; the rules it applies are pure in `media.ts` and `units.ts`, and unit-tested.
 */
import { arrowStep, bleed, clampIndex, counter, nearest, peekInset, peekOf, reveal } from './media';
import { cssNumber } from './units';
import { media } from '../design/responsive';

/** The names of the component's tokens the script reads (the component owns them, so it names them). */
export interface CarouselTokens {
  /** The least of each neighbour a peek keeps in view. */
  peekMin: string;
}

export function setupCarousel(root: HTMLElement, signal: AbortSignal, tokens: CarouselTokens): void {
  if (root.dataset.ready !== undefined) return;
  root.dataset.ready = '';

  const track = root.querySelector<HTMLElement>('[data-carousel-track]');
  const slides = [...root.querySelectorAll<HTMLElement>('[data-carousel-slide]')];
  const prev = root.querySelector<HTMLButtonElement>('[data-carousel-prev]');
  const next = root.querySelector<HTMLButtonElement>('[data-carousel-next]');
  const count = root.querySelector<HTMLElement>('[data-carousel-counter]');
  const dots = [...root.querySelectorAll<HTMLButtonElement>('[data-carousel-dot]')];
  const strip = root.querySelector<HTMLElement>('[data-carousel-strip]');
  if (!track || !count || slides.length === 0) return;
  const peek = root.hasAttribute('data-peek');

  let current = 0;
  let revealed = 0;
  let frame = 0;
  // a move the reader asked for: the counter already shows where it's going, so the glide's
  // in-between positions don't count until the track settles (scrollend, or a pause where it's missing)
  let asked = false;
  let idle = 0;
  const hasEnd = 'onscrollend' in window;
  const settle = () => {
    asked = false;
    update(nearest(track.scrollLeft, offsets()));
  };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // where each slide sits in the scroll (the track's own padding, a peek's room, taken off)
  const offsets = () => {
    const pad = parseFloat(getComputedStyle(track).paddingInlineStart) || 0;
    return slides.map((slide) => slide.offsetLeft - track.offsetLeft - pad);
  };

  const update = (i: number) => {
    current = clampIndex(i, slides.length);
    count.textContent = counter(current, slides.length);
    if (prev) prev.disabled = current === 0;
    if (next) next.disabled = current === slides.length - 1;
    dots.forEach((dot, n) => {
      if (n === current) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
    // a filmstrip that scrolls keeps the frame being shown in view (within itself, not the page)
    const on = dots[current];
    if (strip && on && current !== revealed && strip.scrollWidth > strip.clientWidth) {
      revealed = current;
      const s = strip.getBoundingClientRect();
      const r = on.getBoundingClientRect();
      const by = reveal(r.left, r.right, s.left, s.right, on.offsetWidth / 2);
      if (by) strip.scrollTo({ left: strip.scrollLeft + by, behavior: reduce ? 'auto' : 'smooth' });
    }
  };

  const go = (i: number) => {
    const nextIndex = clampIndex(i, slides.length);
    // already there: no glide, nothing to wait for
    asked = nearest(track.scrollLeft, offsets()) !== nextIndex;
    // to the slide's place in the layout (scrollIntoView would centre its box as drawn, and a peeking
    // slide is drawn smaller)
    track.scrollTo({ left: offsets()[nextIndex], behavior: reduce ? 'auto' : 'smooth' });
    update(nextIndex);
  };

  prev?.addEventListener('click', () => go(current - 1));
  next?.addEventListener('click', () => go(current + 1));
  dots.forEach((dot, i) => dot.addEventListener('click', () => go(i)));
  track.addEventListener('keydown', (event) => {
    const step = arrowStep(event.key);
    if (!step) return;
    event.preventDefault();
    go(current + step);
  });
  track.addEventListener('scrollend', settle);
  track.addEventListener('scroll', () => {
    window.clearTimeout(idle);
    if (!hasEnd) idle = window.setTimeout(settle, 150);
    if (asked) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => update(nearest(track.scrollLeft, offsets())));
  });
  window.addEventListener('resize', () => update(nearest(track.scrollLeft, offsets())), { signal });

  if (peek) {
    const narrow = matchMedia(media('sm'));
    const token = (name: string) => cssNumber(getComputedStyle(root).getPropertyValue(name), parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
    // the room beside the carousel, up to its bounds (and the viewport): no more than the fade needs (the
    // gap to a neighbour, then a slide's width)
    const room = () => {
      const r = root.getBoundingClientRect();
      const box = (root.closest('[data-bleed-bounds]') ?? root.closest('main') ?? document.documentElement).getBoundingClientRect();
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      const { start, end } = bleed(r, box, document.documentElement.clientWidth, r.width + gap, narrow.matches);
      const inset = peekInset(token(tokens.peekMin), start, end, narrow.matches);
      root.style.setProperty('--bleed-start', `${start}px`);
      root.style.setProperty('--bleed-end', `${end}px`);
      root.style.setProperty('--inset', `${inset}px`);
    };
    // how far each slide is from the middle: 0 there, 1 a whole slide away (a neighbour)
    const shade = () => {
      const tr = track.getBoundingClientRect();
      const pad = parseFloat(getComputedStyle(track).scrollPaddingInlineStart) || 0;
      const middle = tr.left + pad + root.getBoundingClientRect().width / 2;
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      for (const slide of slides) {
        const centre = tr.left + slide.offsetLeft - track.offsetLeft - track.scrollLeft + slide.offsetWidth / 2;
        const { peek: by, side } = peekOf(centre, middle, slide.offsetWidth + gap);
        slide.style.setProperty('--peek', by.toFixed(3));
        slide.dataset.side = side;
      }
    };
    let shading = 0;
    const reshade = () => {
      if (!shading) shading = requestAnimationFrame(() => ((shading = 0), shade()));
    };
    const relayout = () => {
      room();
      shade();
    };
    track.addEventListener('scroll', reshade, { passive: true });
    new ResizeObserver(relayout).observe(root);
    window.addEventListener('resize', relayout, { signal });
    narrow.addEventListener('change', relayout, { signal });
    relayout();
    // a peeking slide is a hint: choosing it brings it to the middle (not the lightbox)
    slides.forEach((slide, i) =>
      slide.addEventListener('click', (e) => {
        if (i === current) return;
        e.preventDefault();
        e.stopPropagation();
        go(i);
      }),
    );
  }
  update(0);
}
