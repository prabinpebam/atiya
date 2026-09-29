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
