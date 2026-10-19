/**
 * The site header's DOM wiring (tier 0; docs: documentation/site-ui/design-system.md §2, mobile-audit.md
 * §3.2): its theme switch, the menu under 56 rem, More (the sections that don't fit the bar's one line) and
 * tucking away while you read down on a phone. SiteHeader.astro's script runs it on each header through
 * `each`; the rules are pure in `header.ts` (`tuck`, `followCurrent`) and `theme.ts`, and unit-tested.
 */
import { bindThemeSwitch } from './theme';
import { followCurrent, tuck } from './header';
import { media } from '../design/responsive';

const storage = (): Storage | null => {
  try {
    return localStorage;
  } catch {
    return null;
  }
};

export function setupSiteHeader(header: HTMLElement, signal: AbortSignal): void {
  const sw = header.querySelector<HTMLElement>('[data-theme-switch]');
  if (sw) bindThemeSwitch(sw, document.documentElement, storage(), signal);
  const menu = setupMenu(header, signal);
  setupMore(header, signal);
  setupTuck(header, signal, menu.isOpen);
}

/** The menu under 56 rem: its button opens and closes it (its name and icon say what a press will do). */
function setupMenu(header: HTMLElement, signal: AbortSignal): { isOpen: () => boolean } {
  const toggle = header.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const nav = header.querySelector<HTMLElement>('[data-nav]');
  const isOpen = () => header.hasAttribute('data-menu-open');
  const setOpen = (open: boolean) => {
    if (!toggle) return;
    header.toggleAttribute('data-menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    const label = open ? 'Close menu' : 'Open menu';
    toggle.setAttribute('aria-label', label);
    toggle.dataset.label = label;
    // the icon says what a press will do
    const [viewBox, name, body] = (open ? header.dataset.iconClose : header.dataset.iconOpen)!.split('|');
    const svg = toggle.querySelector('svg');
    if (svg) {
      svg.setAttribute('viewBox', viewBox);
      svg.dataset.icon = name;
      svg.innerHTML = body;
    }
  };
  if (toggle && nav) {
    toggle.addEventListener('click', () => setOpen(!isOpen()), { signal });
    header.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape' && isOpen()) {
          setOpen(false);
          toggle.focus();
        }
      },
      { signal },
    );
    nav.addEventListener('click', (e) => (e.target as Element).closest('a') && setOpen(false), { signal });
    // a tap anywhere else closes it
    document.addEventListener(
      'pointerdown',
      (e) => {
        if (isOpen() && !header.contains(e.target as Node)) setOpen(false);
      },
      { signal },
    );
    // back to the wide layout: nothing stays open behind it
    matchMedia(media('md', 'min')).addEventListener('change', (m) => m.matches && setOpen(false), { signal });
  }
  return { isOpen };
}

/** The bar is always one line: sections that don't fit go behind More, the current one marked on it. */
function setupMore(header: HTMLElement, signal: AbortSignal): void {
  const nav = header.querySelector<HTMLElement>('[data-nav]');
  const more = header.querySelector<HTMLElement>('[data-nav-more]');
  const moreToggle = header.querySelector<HTMLButtonElement>('[data-more-toggle]');
  const moreList = header.querySelector<HTMLElement>('[data-more-list]');
  if (!nav || !more || !moreToggle || !moreList) return;
  const items = [...nav.querySelectorAll<HTMLElement>(':scope > ul > [data-nav-item]')];
  const copies = [...moreList.querySelectorAll<HTMLElement>('[data-more-item]')];
  const menuMode = matchMedia(media('md'));
  const moreOpen = () => moreList.matches(':popover-open');
  const place = () => {
    const r = moreToggle.getBoundingClientRect();
    moreList.style.setProperty('--more-top', `${Math.round(r.bottom)}px`);
    const w = moreList.offsetWidth;
    moreList.style.setProperty('--more-left', `${Math.round(Math.max(8, Math.min(r.right - w, innerWidth - w - 8)))}px`);
  };
  const setMore = (open: boolean, refocus = false) => {
    if (open === moreOpen()) return;
    if (open) {
      moreList.showPopover();
      place();
      moreList.querySelector<HTMLElement>('[data-more-item]:not([hidden]) a')?.focus();
    } else {
      moreList.hidePopover();
      if (refocus) moreToggle.focus();
    }
    moreToggle.setAttribute('aria-expanded', String(open));
  };
  const fit = () => {
    // under 56 rem the menu holds every section
    if (menuMode.matches) {
      for (const li of items) li.hidden = false;
      more.hidden = true;
      return setMore(false);
    }
    for (const li of items) li.hidden = false;
    more.hidden = true;
    const fits = () => nav.scrollWidth <= nav.clientWidth + 1;
    if (!fits()) {
      more.hidden = false;
      // from the end, until the rest and More share the line
      for (let i = items.length - 1; i >= 0 && !fits(); i--) items[i].hidden = true;
    }
    items.forEach((li, i) => (copies[i].hidden = !li.hidden));
    const hiddenCurrent = followCurrent(items, copies);
    more.toggleAttribute('data-current', hiddenCurrent);
    moreToggle.setAttribute('aria-label', hiddenCurrent ? 'More sections, including the current one' : 'More sections');
    if (more.hidden) setMore(false);
    else if (moreOpen()) place();
  };
  const sized = new ResizeObserver(() => fit());
  sized.observe(header.querySelector('.bar') ?? header);
  signal.addEventListener('abort', () => sized.disconnect());
  menuMode.addEventListener('change', fit, { signal });
  document.fonts?.ready.then(() => signal.aborted || fit());
  fit();
  moreToggle.addEventListener('click', () => setMore(!moreOpen()), { signal });
  moreList.addEventListener('click', (e) => (e.target as Element).closest('a') && setMore(false), { signal });
  header.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && moreOpen()) {
        e.stopPropagation();
        setMore(false, true);
      }
    },
    { signal },
  );
  document.addEventListener('keydown', (e) => e.key === 'Escape' && moreOpen() && setMore(false, true), { signal });
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (moreOpen() && !more.contains(e.target as Node)) setMore(false);
    },
    { signal },
  );
  // leaving the popover by Tab closes it
  moreList.addEventListener(
    'focusout',
    (e) => {
      if (moreOpen() && !more.contains(e.relatedTarget as Node | null)) setMore(false);
    },
    { signal },
  );
  addEventListener('scroll', () => moreOpen() && place(), { passive: true, signal });
}

/** Tuck the header away while reading down on a phone (upright or on its side); bring it back on the way up. */
function setupTuck(header: HTMLElement, signal: AbortSignal, menuOpen: () => boolean): void {
  const small = matchMedia(`${media('md')}, ${media('short')}`);
  let lastY = scrollY;
  let queued = false;
  const busy = () => menuOpen() || header.contains(document.activeElement) || !!header.querySelector('[aria-expanded="true"]');
  const update = () => {
    queued = false;
    const y = scrollY;
    const hidden = small.matches && tuck(lastY, y, header.offsetHeight, header.hasAttribute('data-tucked'), busy());
    header.toggleAttribute('data-tucked', hidden);
    lastY = y;
  };
  addEventListener(
    'scroll',
    () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    },
    { passive: true, signal },
  );
  header.addEventListener('focusin', () => header.removeAttribute('data-tucked'), { signal });
  small.addEventListener('change', update, { signal });
}
