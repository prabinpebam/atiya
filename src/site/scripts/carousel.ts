/**
 * The carousel's DOM wiring (tier 0; docs: documentation/site-ui/design-system.md §2): its buttons, dots
 * or filmstrip, keys and counter, a loop's order, autoplay's clock and holds, and a peek's room and shading. Carousel.astro's script runs it on each
 * carousel through `each`; the rules it applies are pure in `media.ts` and `units.ts`, and unit-tested.
 */
import { drawHaze } from './haze';
import { arrowStep, autoplayRuns, bleed, clampIndex, counter, hazeOf, hazePlan, loopOrder, narrowerThan, nearest, peekInset, peekOf, reveal, slideIndex, slideSeconds, MOVING_HOLD_SECONDS, type AutoplayHold } from './media';
import { cssNumber } from './units';

/** The names of the component's tokens the script reads (the component owns them, so it names them). */
export interface CarouselTokens {
  /** The least of each neighbour a peek keeps in view. */
  peekMin: string;
  /** Its container query's size: narrower than this, no peek (one slide at a time). */
  narrow: string;
  /** The blur at a neighbour's near edge. */
  blurNear: string;
  /** The blur at a neighbour's far end (the most). */
  blur: string;
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
  const loop = root.hasAttribute('data-loop') && slides.length > 1;
  const auto = root.hasAttribute('data-autoplay') && slides.length > 1;

  let current = 0;
  let revealed = 0;
  let frame = 0;
  // a move the reader asked for: the counter already shows where it's going, so the glide's
  // in-between positions don't count until the track settles (scrollend, or a pause where it's missing)
  let asked = false;
  let target = 0;
  let idle = 0;
  const hasEnd = 'onscrollend' in window;
  const settle = () => {
    // a scrollend left over from an earlier glide, while the one asked for is still on its way: wait for its own
    if (asked && nearest(track.scrollLeft, offsets()) !== target) return;
    asked = false;
    update(nearest(track.scrollLeft, offsets()));
    arrange();
  };
  // read when it's needed: a reader can turn reduced motion on while the page is open
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  // a loop: the slide shown is moved to the middle of the row once the track settles (CSS order; the DOM, the
  // dots and the lightbox keep their order), with the same picture under the same place, so there's always a
  // slide each way and the first follows the last
  const arrange = () => {
    if (!loop) return;
    const order = loopOrder(current, slides.length);
    let moved = false;
    slides.forEach((slide, k) => {
      if (slide.style.order === String(order[k])) return;
      slide.style.order = String(order[k]);
      moved = true;
    });
    if (moved) track.scrollTo({ left: offsets()[current], behavior: 'instant' });
  };
  // where each slide sits in the scroll (the track's own padding, a peek's room, taken off); a peek's track is
  // its slides' offset parent, so their offsets already start at the track
  const offsets = () => {
    const pad = parseFloat(getComputedStyle(track).paddingInlineStart) || 0;
    const origin = slides[0].offsetParent === track ? 0 : track.offsetLeft;
    return slides.map((slide) => slide.offsetLeft - origin - pad);
  };
  // a loop keeps the slide shown where it is when the layout changes (a resize, a peek's room): its neighbours
  // each way are copies of no one, so the nearest place could be another slide
  const pin = () => {
    if (loop && !asked) track.scrollTo({ left: offsets()[current], behavior: 'instant' });
    else update(nearest(track.scrollLeft, offsets()));
  };

  const clock = autoplay(track, count);
  const update = (i: number) => {
    const moved = clampIndex(i, slides.length) !== current;
    current = clampIndex(i, slides.length);
    count.textContent = counter(current, slides.length);
    if (prev) prev.disabled = !loop && current === 0;
    if (next) next.disabled = !loop && current === slides.length - 1;
    dots.forEach((dot, n) => {
      if (n === current) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
    slides.forEach((slide, n) => {
      const body = slide.querySelector<HTMLElement>('[data-carousel-part="body"]');
      if (body) body.inert = n !== current;
    });
    // a filmstrip that scrolls keeps the frame being shown in view (within itself, not the page)
    const on = dots[current];
    if (strip && on && current !== revealed && strip.scrollWidth > strip.clientWidth) {
      revealed = current;
      const s = strip.getBoundingClientRect();
      const r = on.getBoundingClientRect();
      const by = reveal(r.left, r.right, s.left, s.right, on.offsetWidth / 2);
      if (by) strip.scrollTo({ left: strip.scrollLeft + by, behavior: motion.matches ? 'auto' : 'smooth' });
    }
    // a new slide gets its whole time
    if (moved) clock.restart(false);
  };

  const go = (i: number) => {
    const nextIndex = slideIndex(i, slides.length, loop);
    // already there: no glide, nothing to wait for
    asked = nearest(track.scrollLeft, offsets()) !== nextIndex;
    target = nextIndex;
    // to the slide's place in the layout (scrollIntoView would centre its box as drawn, and a peeking
    // slide is drawn smaller)
    track.scrollTo({ left: offsets()[nextIndex], behavior: motion.matches ? 'auto' : 'smooth' });
    update(nextIndex);
  };

  // autoplay: a clock that moves on after each slide's time (its pill, or the filmstrip frame's bar, fills in
  // step with it: a CSS animation the attributes paint sets pause and show), held while anything in
  // AutoplayHold holds it. Its time is the script's (reduced motion cuts every animation to nothing)
  function autoplay(strip: HTMLElement, live: HTMLElement) {
    const off = { restart: (_again: boolean) => {}, start: () => {}, stop: () => {} };
    if (!auto) return off;
    const play = root.querySelector<HTMLButtonElement>('[data-carousel-play]');
    const glyphs = root.querySelector<HTMLTemplateElement>('[data-carousel-glyphs]');
    const ms = slideSeconds(Number(root.dataset.interval)) * 1000;
    const holds = new Set<AutoplayHold>(motion.matches ? ['stopped'] : []);
    let timer = 0;
    let since = 0;
    let left = ms;
    const runs = () => autoplayRuns(holds);
    const tick = () => {
      timer = 0;
      // a picture opened over the page (the lightbox): this slide starts its time again
      if (document.querySelector('dialog[open]')) return restart(true);
      if (!loop && current === slides.length - 1) return hold('stopped', true);
      go(current + 1);
    };
    const schedule = () => {
      window.clearTimeout(timer);
      timer = 0;
      if (!runs()) return;
      since = performance.now();
      timer = window.setTimeout(tick, left);
    };
    // the fill starts again: on a new slide by itself (it moves to that dot); on the same one, by taking its mark
    // off and putting it back
    function restart(again: boolean) {
      left = ms;
      const on = dots[current];
      if (again && on) {
        on.removeAttribute('aria-current');
        void on.offsetWidth;
        on.setAttribute('aria-current', 'true');
      }
      schedule();
    }
    const paint = () => {
      const stopped = holds.has('stopped');
      root.toggleAttribute('data-paused', !runs());
      root.toggleAttribute('data-stopped', stopped);
      root.toggleAttribute('data-moving', holds.has('moving'));
      live.setAttribute('aria-live', runs() ? 'off' : 'polite');
      if (!play) return;
      const label = stopped ? 'Play slides' : 'Pause slides';
      play.setAttribute('aria-label', label);
      play.dataset.label = label;
      const from = glyphs?.content.querySelector(`[data-glyph="${stopped ? 'play' : 'pause'}"]`);
      const to = play.querySelector('svg');
      if (from && to) {
        to.setAttribute('viewBox', from.getAttribute('viewBox') ?? '');
        to.dataset.icon = from.getAttribute('data-icon') ?? '';
        to.innerHTML = from.innerHTML;
      }
    };
    function hold(why: AutoplayHold, on: boolean) {
      if (holds.has(why) === on) return;
      const was = runs();
      if (on) holds.add(why);
      else holds.delete(why);
      if (was && !runs()) {
        window.clearTimeout(timer);
        timer = 0;
        left = Math.max(0, left - (performance.now() - since));
      } else if (!was && runs()) {
        schedule();
      }
      paint();
    }
    play?.addEventListener('click', () => {
      if (!holds.has('stopped')) return hold('stopped', true);
      // played again from a last slide that doesn't loop: from the first
      if (!loop && current === slides.length - 1) go(0);
      left = ms;
      hold('stopped', false);
    }, { signal });
    // keyboard focus coming in stops it for good (APG); the play button itself doesn't
    root.addEventListener('focusin', (event) => {
      const target = event.target as HTMLElement;
      if (target !== play && target.matches(':focus-visible')) hold('stopped', true);
    }, { signal });
    // the mouse moving over the slides (someone looking, reading, about to click): held, its pill a pause sign,
    // until it has been still a while; then the slide gets its whole time again
    let still = 0;
    strip.addEventListener('pointermove', (e) => {
      // a slide gliding under a still mouse isn't a move
      if (e.pointerType !== 'mouse' || (!e.movementX && !e.movementY)) return;
      hold('moving', true);
      window.clearTimeout(still);
      still = window.setTimeout(() => {
        hold('moving', false);
        restart(true);
      }, MOVING_HOLD_SECONDS * 1000);
    }, { signal });
    signal.addEventListener('abort', () => window.clearTimeout(still));
    strip.addEventListener('pointerdown', () => hold('drag', true), { signal });
    for (const end of ['pointerup', 'pointercancel'] as const) window.addEventListener(end, () => hold('drag', false), { signal });
    document.addEventListener('visibilitychange', () => hold('hidden', document.hidden), { signal });
    // reduced motion turned on while it plays: it stops, as it would have started
    motion.addEventListener('change', () => motion.matches && hold('stopped', true), { signal });
    const seen = new IntersectionObserver(([entry]) => hold('away', !entry || entry.intersectionRatio < 0.25), { threshold: [0, 0.25] });
    return {
      restart,
      start: () => {
        hold('hidden', document.hidden);
        seen.observe(root);
        paint();
        schedule();
      },
      stop: () => {
        window.clearTimeout(timer);
        seen.disconnect();
      },
    };
  }

  prev?.addEventListener('click', () => go(current - 1), { signal });
  next?.addEventListener('click', () => go(current + 1), { signal });
  dots.forEach((dot, i) => dot.addEventListener('click', () => go(i), { signal }));
  track.addEventListener('keydown', (event) => {
    if (event.target !== track) return;
    const step = arrowStep(event.key);
    if (!step) return;
    event.preventDefault();
    go(current + step);
  }, { signal });
  track.addEventListener('scrollend', settle, { signal });
  // the reader takes the track mid-glide: where it settles is theirs
  for (const take of ['pointerdown', 'wheel', 'touchstart'] as const) track.addEventListener(take, () => (asked = false), { signal, passive: true });
  track.addEventListener('scroll', () => {
    window.clearTimeout(idle);
    if (!hasEnd) idle = window.setTimeout(settle, 150);
    if (asked) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => update(nearest(track.scrollLeft, offsets())));
  }, { signal, passive: true });
  window.addEventListener('resize', pin, { signal });
  if (loop) {
    const sized = new ResizeObserver(pin);
    sized.observe(track);
    signal.addEventListener('abort', () => sized.disconnect(), { once: true });
  }

  if (peek) {
    const remPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const token = (name: string) => cssNumber(getComputedStyle(root).getPropertyValue(name), remPx());
    // the room beside the carousel, up to its bounds (and the viewport): no more than the fade needs (the
    // gap to a neighbour, then a slide's width). None in a column narrower than sm (the stylesheet's
    // container query: one slide at a time)
    const room = () => {
      const r = root.getBoundingClientRect();
      const box = (root.closest('[data-bleed-bounds]') ?? root.closest('main') ?? document.documentElement).getBoundingClientRect();
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      const narrow = narrowerThan(root.clientWidth, getComputedStyle(root).getPropertyValue(tokens.narrow), remPx());
      const { start, end } = bleed(r, box, document.documentElement.clientWidth, r.width + gap, narrow);
      // a neighbour's least shows past the gap
      const inset = peekInset(token(tokens.peekMin) + gap, start, end, narrow);
      root.style.setProperty('--bleed-start', `${start}px`);
      root.style.setProperty('--bleed-end', `${end}px`);
      root.style.setProperty('--inset', `${inset}px`);
      haze(r.width, start, end, inset, gap);
    };
    // the blur over each neighbour: an SVG filter on the track, drawn again only when its place changes
    const lens = root.querySelector<SVGFilterElement>('[data-carousel-haze]');
    let drawn = '';
    const haze = (width: number, start: number, end: number, inset: number, gap: number) => {
      if (!lens) return;
      const plan = hazePlan(hazeOf(width, start, end, inset, gap), token(tokens.blurNear), token(tokens.blur), gap, track.offsetHeight);
      const key = JSON.stringify(plan);
      if (key === drawn) return;
      drawn = key;
      if (drawHaze(lens, plan)) root.style.setProperty('--haze', `url(#${lens.id})`);
      else root.style.removeProperty('--haze');
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
    track.addEventListener('scroll', reshade, { passive: true, signal });
    const observer = new ResizeObserver(relayout);
    observer.observe(root);
    signal.addEventListener('abort', () => { observer.disconnect(); cancelAnimationFrame(shading); }, { once: true });
    window.addEventListener('resize', relayout, { signal });
    relayout();
    // a peeking slide is a hint: choosing it brings it to the middle (not the lightbox)
    slides.forEach((slide, i) =>
      slide.addEventListener('click', (e) => {
        if (i === current) return;
        e.preventDefault();
        e.stopPropagation();
        go(i);
      }, { signal }),
    );
  }
  update(0);
  arrange();
  clock.start();
  signal.addEventListener('abort', () => { cancelAnimationFrame(frame); window.clearTimeout(idle); clock.stop(); }, { once: true });
}
