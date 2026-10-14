// @ts-check
/**
 * The launch token (documentation/desktop/spec.md §7.3, plan stage 7): when Atiya Studio starts a managed
 * site's dev server it gives it a token, new every launch, and adds it to every request its own views
 * make. The dev server then answers nothing else: not a browser tab, not another program on the computer
 * (in dev, private pages render unsealed, and edit mode can push). Pure.
 */
import { timingSafeEqual } from 'node:crypto';

/** The header the app's views send it in. */
export const LAUNCH_HEADER = 'x-atiya-launch';

/**
 * May this request be answered? Always without a token (the owner's own dev server).
 * @param {string | string[] | undefined | null} sent the request's header
 * @param {string | undefined} expected the server's token
 */
export function launchAllows(sent, expected) {
  if (!expected) return true;
  if (typeof sent !== 'string' || sent.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(sent), Buffer.from(expected));
}
