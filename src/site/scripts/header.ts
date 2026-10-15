/**
 * The header's scroll behaviour on a phone (docs: documentation/site-ui/mobile-audit.md §3.2): it
 * tucks away while you read down and comes back as soon as you scroll up. Pure; unit-tested.
 */

/** Scrolls smaller than this (px) change nothing: a finger's jitter isn't a direction. */
export const TUCK_SLACK = 6;

/**
 * Whether the header should be tucked away after a scroll from `from` to `to`.
 * Never near the top (within its own height), never while it's busy (the menu or a list open, focus
 * inside); otherwise down tucks it, up brings it back, and a tiny move keeps what it was.
 */
export function tuck(from: number, to: number, headerHeight: number, tucked: boolean, busy: boolean): boolean {
  if (busy || to <= headerHeight) return false;
  const dy = to - from;
  if (Math.abs(dy) < TUCK_SLACK) return tucked;
  return dy > 0;
}

/**
 * One section link is the current one at a time (SiteHeader's More): the bar's while it shows, else its copy in
 * More. Both carry `data-is-current`; `aria-current` follows whichever is shown.
 */
export function followCurrent(items: readonly HTMLElement[], copies: readonly HTMLElement[]): boolean {
  let hiddenCurrent = false;
  items.forEach((li, i) => {
    const own = li.querySelector('a[data-is-current]');
    const copy = copies[i]?.querySelector('a[data-is-current]');
    if (!own || !copy) return;
    (li.hidden ? own : copy).removeAttribute('aria-current');
    (li.hidden ? copy : own).setAttribute('aria-current', 'page');
    hiddenCurrent ||= li.hidden;
  });
  return hiddenCurrent;
}