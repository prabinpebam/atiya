/**
 * Spotlight's DOM wiring (tier 0; docs: documentation/home-views/spotlight.md §5, §8, §9): one highlight on the
 * stage at a time. Previous, Next, the rail and Jump to are links to `#h-<id>` that work without a script; with it,
 * they change the highlight in place (the address follows, with no history entry), Left and Right do the same while
 * the keyboard is in the stage, and a swipe on the stage does on touch. Show the details opens the highlight's
 * evidence, and it stays open as the highlight changes. A change is said in the status line. Nothing moves on its
 * own. Spotlight.astro's script runs it on each spotlight through `each`; the address rules are pure
 * (`highlightFromHash`, `jumpTarget`, scripts/homeAddress.ts) and unit-tested.
 */
import { highlightFromHash, jumpTarget } from './homeAddress';
import { track } from './telemetry';

type How = 'next' | 'rail' | 'jump' | 'link';

/** A swipe: at least this many CSS pixels sideways, and more sideways than up or down. */
const SWIPE_PX = 48;

export function setupSpotlight(root: HTMLElement, signal: AbortSignal): void {
  const stage = root.querySelector<HTMLElement>('[data-spotlight-stage]');
  if (!stage) return;
  const slides = [...stage.querySelectorAll<HTMLElement>('[data-slide]')];
  const ids = slides.map((s) => s.dataset.slide!);
  const status = stage.querySelector<HTMLElement>('[data-spotlight-status]');
  const address = (hash: string) => history.replaceState(history.state, '', `${location.pathname}${location.search}${hash}`);
  let current = ids[0] ?? null;
  let detailsOpen = false;

  const slideOf = (id: string) => slides[ids.indexOf(id)];

  const setDetails = (slide: HTMLElement, open: boolean) => {
    const toggle = slide.querySelector<HTMLElement>('[data-spotlight-details]');
    const list = slide.querySelector<HTMLElement>('.details');
    if (!toggle || !list) return;
    list.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    const label = toggle.querySelector('[data-details-label]');
    if (label) label.textContent = open ? 'Hide the details' : 'Show the details';
  };

  /** Puts a highlight on the stage. `direction`: which way it came from, for a lively slide. */
  const show = (id: string, how: How, direction: 'forward' | 'back' = 'forward') => {
    const slide = slideOf(id);
    if (!slide) return;
    const before = current;
    for (const s of slides) {
      const on = s === slide;
      s.toggleAttribute('data-current', on);
      setDetails(s, on && detailsOpen);
    }
    current = id;
    const capability = slide.dataset.capability;
    for (const a of root.querySelectorAll<HTMLElement>('[data-rail]')) a.removeAttribute('aria-current');
    root.querySelector(`[data-rail="${CSS.escape(id)}"]`)?.setAttribute('aria-current', 'true');
    for (const a of root.querySelectorAll<HTMLElement>('[data-jump]')) {
      if (a.dataset.jump === capability) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    }
    if (before === id && how !== 'link') return;
    root.dataset.direction = direction;
    root.toggleAttribute('data-moved', true);
    address(`#h-${id}`);
    if (status) status.textContent = slide.getAttribute('aria-label') ?? '';
    track('highlight_view', { id, how });
    // the current rail item in view where the rail scrolls sideways, without moving the page
    const item = root.querySelector<HTMLElement>(`[data-rail="${CSS.escape(id)}"]`)?.closest('li');
    const rail = item?.parentElement;
    if (item && rail && rail.scrollWidth > rail.clientWidth) {
      const offset = item.offsetLeft - rail.offsetLeft;
      if (offset < rail.scrollLeft || offset + item.offsetWidth > rail.scrollLeft + rail.clientWidth) rail.scrollTo({ left: offset });
    }
  };

  const step = (by: 1 | -1, how: How) => {
    const i = current ? ids.indexOf(current) : -1;
    show(ids[(i + by + ids.length) % ids.length], how, by > 0 ? 'forward' : 'back');
  };

  root.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const target = e.target as Element;
    const toggle = target.closest<HTMLElement>('[data-spotlight-details]');
    if (toggle) {
      detailsOpen = toggle.getAttribute('aria-expanded') !== 'true';
      const slide = toggle.closest<HTMLElement>('[data-slide]');
      if (slide) setDetails(slide, detailsOpen);
      if (detailsOpen) track('capability_l3_open', { id: slide?.dataset.capability, view: 'spotlight', kind: 'all' });
      return;
    }
    const link = target.closest<HTMLAnchorElement>('a[href^="#h-"]');
    if (!link) return;
    const stepTo = link.dataset.step;
    if (stepTo) {
      e.preventDefault();
      step(stepTo === 'next' ? 1 : -1, 'next');
      return;
    }
    const jump = link.dataset.jump;
    if (jump !== undefined) {
      const to = jumpTarget((link.dataset.slides ?? '').split(' ').filter(Boolean), current);
      if (!to) return;
      e.preventDefault();
      show(to, 'jump');
      return;
    }
    const id = highlightFromHash(link.hash, ids);
    if (!id) return;
    e.preventDefault();
    const from = current ? ids.indexOf(current) : 0;
    show(id, link.dataset.rail ? 'rail' : 'link', ids.indexOf(id) < from ? 'back' : 'forward');
  });

  // Left and Right while the keyboard is in the stage, never taken from the page or a field
  stage.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if ((e.target as Element).closest('input, textarea, select, [contenteditable]')) return;
    const by = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!by || ids.length < 2) return;
    e.preventDefault();
    step(by, 'next');
    // the keyboard stays on the same control of the new highlight
    const was = e.target as HTMLElement;
    const kind = was.dataset.step ? `[data-step="${was.dataset.step}"]` : was.hasAttribute('data-spotlight-details') ? '[data-spotlight-details]' : 'a.title';
    if (current) slideOf(current)?.querySelector<HTMLElement>(kind)?.focus();
  });

  // a swipe on the stage (a touch or a pen drag; the buttons are always there too)
  let start: { x: number; y: number; id: number } | null = null;
  stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' && e.isPrimary) start = { x: e.clientX, y: e.clientY, id: e.pointerId };
  });
  stage.addEventListener('pointerup', (e) => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = null;
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1, 'next');
  });
  stage.addEventListener('pointercancel', () => (start = null));

  // an address with #h-<id> puts it on the stage (a link a colleague forwarded, a return visit)
  const fromAddress = () => {
    const id = highlightFromHash(location.hash, ids);
    if (id && id !== current) show(id, 'link');
  };
  window.addEventListener('hashchange', fromAddress, { signal });
  root.toggleAttribute('data-ready', true);
  fromAddress();
  // the first highlight's arrival isn't a change: no motion for it
  root.removeAttribute('data-moved');
}
